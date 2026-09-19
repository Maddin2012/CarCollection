/* Dokumente direkt am Logbuch-Eintrag.

   Der Kern ist das Datenmodell: Ein Dokument liegt ausschließlich in S.docs und
   trägt ein Feld logId. Es gibt also nichts zu synchronisieren - der Reiter
   Dokumente und der Logbuch-Eintrag zeigen denselben Satz. Geprüft wird das
   nicht nur an der Oberfläche, sondern auch im gespeicherten Stand. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { REPO, watchErrors } from './lib.mjs';

export const name = 'Logbuch-Dokumente';

const BILD = join(REPO, 'icons/icon-192.png');
const BILD2 = join(REPO, 'icons/icon-512.png');

export default async function ({ browser, base, ok }) {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  watchErrors(page, errors);
  await page.goto(base, { waitUntil: 'networkidle' });

  const reiter = async k => {
    await page.click(`[data-a="tab"][data-k="${k}"]`);
    await page.waitForSelector(`[data-a="tab"][data-k="${k}"].on`);
  };
  const zu = () => page.waitForFunction(
    () => !document.getElementById('sheet').classList.contains('open'));
  // Der gespeicherte Stand, nicht nur das, was gerade auf dem Schirm steht.
  const docs = () => page.evaluate(() => VEH[IDX[0]].docs.map(
    d => ({ id: d.id, title: d.title, logId: d.logId || null, category: d.category, date: d.date })));
  const logs = () => page.evaluate(() => VEH[IDX[0]].logs.map(l => ({ id: l.id, title: l.title })));

  // --- Fahrzeug anlegen ---
  await page.click('[data-a="addVehicle"]');
  await page.fill('[name="name"]', 'VW Golf');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.head h2');

  // --- Eintrag mit zwei Dokumenten anlegen ---
  await reiter('log');
  await page.click('[data-a="addLog"]');
  ok((await page.locator('#logDocs').count()) === 1, 'Die Maske hat einen Bereich für Dokumente');
  ok((await page.textContent('#logDocs')).includes('Noch nichts angehängt'),
    'Anfangs hängt nichts daran');

  await page.fill('[name="title"]', 'Zahnriemen gewechselt');
  await page.fill('[name="date"]', '2026-03-14');
  await page.fill('[name="cost"]', '780.50');
  await page.setInputFiles('#fPick', BILD);
  await page.waitForSelector('#logDocs .d');
  ok((await page.locator('#logDocs .d').count()) === 1, 'Erstes Dokument erscheint in der Liste');
  await page.setInputFiles('#fPick', BILD2);
  await page.waitForFunction(() => document.querySelectorAll('#logDocs .d').length === 2);
  ok((await page.locator('#logDocs .d').count()) === 2, 'Mehrere Dokumente sind möglich');

  // --- Vor dem Speichern liegt noch nichts im Bestand ---
  ok((await docs()).length === 0, 'Vor dem Speichern ist noch nichts abgelegt');

  await page.click('[data-a="ok"]');
  await zu();
  await page.waitForSelector('.item');

  const d1 = await docs();
  const l1 = await logs();
  ok(d1.length === 2, `Beide Dokumente sind gespeichert (${d1.length})`);
  ok(d1.every(d => d.logId === l1[0].id), 'Beide tragen die Kennung des Eintrags');
  ok(d1[0].title === 'Zahnriemen gewechselt (1)' && d1[1].title === 'Zahnriemen gewechselt (2)',
    `Titel folgen dem Eintrag und sind nummeriert: ${d1.map(d => d.title).join(', ')}`);
  ok(d1.every(d => d.date === '2026-03-14'), 'Das Datum des Eintrags wird übernommen');
  ok(d1.every(d => d.category === 'Rechnungen'), 'Voreingestellte Kategorie ist Rechnungen');

  // --- Der Eintrag nennt die Anzahl ---
  ok((await page.textContent('.item .s')).includes('2 Dokumente'),
    `Der Eintrag nennt die Anzahl: ${await page.textContent('.item .s')}`);

  // --- Und sie stehen im Reiter Dokumente, mit Bezug ---
  await reiter('doc');
  await page.waitForSelector('.item');
  ok((await page.locator('.item').count()) === 2, 'Beide stehen im Reiter Dokumente');
  const zeilen = (await page.textContent('#view')).replace(/\s+/g, ' ');
  ok(zeilen.includes('zu: Zahnriemen gewechselt'), 'Der Bezug zum Eintrag wird genannt');
  ok(zeilen.includes('Rechnungen'), 'Sie liegen unter Rechnungen');

  // --- Nichts liegt doppelt: eine einzige Quelle ---
  ok(await page.evaluate(() => {
    const v = VEH[IDX[0]];
    return v.logs.every(l => !('docs' in l)) && v.docs.length === 2;
  }), 'Die Dokumente hängen nicht zusätzlich am Logbuch-Eintrag');

  // --- Ein Neuladen ändert daran nichts ---
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.item');
  const d2 = await docs();
  ok(d2.length === 2 && d2.every(d => d.logId === l1[0].id), 'Der Bezug übersteht ein Neuladen');

  // --- Beim Bearbeiten stehen die Anhänge wieder da ---
  await reiter('log');
  await page.click('[data-a="editLog"]');
  await page.waitForSelector('#logDocs .d');
  ok((await page.locator('#logDocs .d').count()) === 2,
    'Beim Bearbeiten stehen die angehängten Dokumente in der Maske');

  // --- Abbrechen hängt nichts an ---
  await page.setInputFiles('#fPick', BILD);
  await page.waitForFunction(() => document.querySelectorAll('#logDocs .d').length === 3);
  await page.click('.panel .row [data-a="close"]');
  await zu();
  ok((await docs()).length === 2, 'Abbrechen legt das neu Gewählte nicht ab');

  // --- Das × löst nur den Bezug, es löscht nicht ---
  await page.click('[data-a="editLog"]');
  await page.waitForSelector('#logDocs .d');
  await page.click('#logDocs .d [data-a="logDocOff"]');
  await page.waitForFunction(() => document.querySelectorAll('#logDocs .d').length === 1);
  await page.click('[data-a="ok"]');
  await zu();
  const d3 = await docs();
  ok(d3.length === 2, 'Das gelöste Dokument ist noch da');
  ok(d3.filter(d => d.logId).length === 1, 'Nur eines hängt noch am Eintrag');
  ok(d3.filter(d => !d.logId).length === 1, 'Das andere hat den Bezug verloren');
  await reiter('doc');
  await page.waitForSelector('.item');
  ok((await page.locator('.item').count()) === 2, 'Beide stehen weiter im Reiter Dokumente');

  // --- Den Eintrag löschen: die Dokumente bleiben ---
  // Eine Rechnung ist auch ohne den Eintrag noch etwas wert.
  await reiter('log');
  await page.click('[data-a="editLog"]');
  await page.click('.panel [data-a="del"]');
  await page.click('.panel [data-a="del"]');
  await zu();
  ok((await logs()).length === 0, 'Der Eintrag ist gelöscht');
  const d4 = await docs();
  ok(d4.length === 2, 'Die Dokumente haben ihn überlebt');
  ok(d4.every(d => !d.logId), 'Sie tragen keinen Bezug mehr');
  await reiter('doc');
  await page.waitForSelector('.item');
  ok((await page.locator('.item').count()) === 2, 'Und stehen weiter im Reiter Dokumente');
  ok(!(await page.textContent('#view')).includes('zu:'), 'Ohne Eintrag wird kein Bezug genannt');

  // --- Die Bilder sind noch da, nicht nur die Einträge ---
  ok(await page.evaluate(async () => {
    for (const d of VEH[IDX[0]].docs) if (!(await store.get('img:' + d.id))) return false;
    return true;
  }), 'Die Bilddateien liegen weiterhin im Speicher');

  // --- Löschen im Reiter Dokumente entfernt sie wirklich ---
  await page.click('[data-a="openDoc"]');
  await page.waitForSelector('#full:not([hidden])');
  await page.click('[data-a="delFull"]');
  await page.click('[data-a="delFull"]');
  await page.waitForFunction(() => document.querySelectorAll('.item').length === 1);
  ok((await docs()).length === 1, 'Im Reiter Dokumente lässt sich löschen');

  ok(errors.length === 0, `Keine JS-Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();

  // ------------------------------------------------------- Sicherung und Alter
  {
    const ctx2 = await browser.newContext({ acceptDownloads: true });
    const page2 = await ctx2.newPage();
    const fehler2 = [];
    watchErrors(page2, fehler2);
    await page2.goto(base, { waitUntil: 'networkidle' });

    await page2.click('[data-a="addVehicle"]');
    await page2.fill('[name="name"]', 'BMW E30');
    await page2.click('[data-a="ok"]');
    await page2.waitForSelector('.head h2');
    await page2.click('[data-a="tab"][data-k="log"]');
    await page2.waitForSelector('[data-a="addLog"]');
    await page2.click('[data-a="addLog"]');
    await page2.fill('[name="title"]', 'Bremsen erneuert');
    await page2.setInputFiles('#fPick', BILD);
    await page2.waitForSelector('#logDocs .d');
    await page2.click('[data-a="ok"]');
    await page2.waitForFunction(
      () => !document.getElementById('sheet').classList.contains('open'));
    await page2.waitForSelector('.item');

    // --- Die Sicherung trägt den Bezug mit ---
    await page2.goBack();
    await page2.waitForSelector('.mini');
    await page2.click('[data-a="settings"]');
    await page2.waitForSelector('[data-a="backupOut"]:not([disabled])');
    const [dl] = await Promise.all([
      page2.waitForEvent('download'), page2.click('[data-a="backupOut"]')]);
    const datei = await dl.path();
    const sicherung = JSON.parse(readFileSync(datei, 'utf8'));
    const docBak = sicherung.vehicles[0].docs[0];
    const logBak = sicherung.vehicles[0].logs[0];
    ok(docBak && docBak.logId === logBak.id, 'Die Sicherung enthält den Bezug logId');

    // --- Eine Sicherung ohne logId bleibt lesbar ---
    // So sahen alle Sicherungen vor Schritt 6 aus.
    const alt = JSON.parse(readFileSync(datei, 'utf8'));
    for (const fz of alt.vehicles) for (const d of fz.docs) delete d.logId;
    const altPfad = join(tmpdir(), 'sicherung-ohne-logid.json');
    writeFileSync(altPfad, JSON.stringify(alt));
    await page2.setInputFiles('#backupIn', altPfad);
    await page2.waitForSelector('[data-a="restoreReplace"]');
    await page2.click('[data-a="restoreReplace"]');
    await page2.click('[data-a="restoreReplace"]');
    await page2.waitForFunction(
      () => !document.getElementById('sheet').classList.contains('open'), null, { timeout: 10000 });
    await page2.waitForSelector('.mini');
    ok(await page2.evaluate(() => VEH[IDX[0]].docs.length === 1 && !VEH[IDX[0]].docs[0].logId),
      'Sicherung ohne logId wird angenommen, das Dokument bleibt ohne Bezug');
    await page2.click('[data-a="open"]');
    await page2.waitForSelector('.head h2');
    await page2.click('[data-a="tab"][data-k="doc"]');
    await page2.waitForSelector('.item');
    ok(!(await page2.textContent('#view')).includes('zu:'),
      'Ohne logId wird kein Bezug erfunden');
    await page2.click('[data-a="tab"][data-k="log"]');
    await page2.waitForSelector('.item');
    ok(!(await page2.textContent('.item .s')).includes('Dokument'),
      'Und der Eintrag zählt keine Dokumente, die ihm nicht gehören');

    ok(fehler2.length === 0, `Keine JS-Fehler${fehler2.length ? ': ' + fehler2.join(' | ') : ''}`);
    await ctx2.close();
  }
}
