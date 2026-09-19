/* Sicherung: exportieren, Speicher leeren, wieder einlesen. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { REPO, watchErrors } from './lib.mjs';

export const name = 'Sicherung';

export default async function ({ browser, base, ok }) {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  const dialoge = [];
  // Das Einlesen schreibt asynchron in den Speicher und schließt erst danach
  // das Sheet. Darauf zu warten ist das einzige verlässliche Ende-Signal -
  // die Garage selbst steht oft schon vorher auf dem Schirm.
  const eingelesen = () => page.waitForFunction(
    () => !document.getElementById('sheet').classList.contains('open'), null, { timeout: 10000 });
  watchErrors(page, errors);
  page.on('dialog', d => { dialoge.push(d.message()); d.dismiss(); });
  await page.goto(base, { waitUntil: 'networkidle' });

  // --- Fahrzeug, Logbuch-Eintrag und ein Dokument mit Bild anlegen ---
  await page.click('[data-a="addVehicle"]');
  await page.fill('[name="name"]', 'VW Golf');
  await page.fill('[name="plate"]', 'M-AB 1234');
  await page.fill('[name="km"]', '123456');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.head h2');

  await page.click('[data-a="tab"][data-k="log"]');
  await page.click('[data-a="addLog"]');
  await page.fill('[name="title"]', 'Zahnriemen gewechselt');
  await page.fill('[name="cost"]', '780.50');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.item');

  await page.click('[data-a="tab"][data-k="doc"]');
  await page.click('[data-a="addDoc"]');
  await page.setInputFiles('#fPick', join(REPO, 'icons/icon-512.png'));
  await page.waitForSelector('#fname:not(:empty)');
  await page.fill('[name="title"]', 'TÜV-Bericht 2026');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.item');
  ok((await page.locator('.item').count()) === 1, 'Dokument mit Bild angelegt');

  // --- Bild öffnet in Vollbild, nicht im Sheet ---
  // #full trägt im geschlossenen Zustand das hidden-Attribut und ist damit nie
  // "visible" - beim Warten darauf also ausdrücklich auf attached prüfen.
  const zu = () => page.waitForSelector('#full[hidden]', { state: 'attached' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('[data-a="openDoc"]');
  await page.waitForSelector('#full:not([hidden])');
  ok(await page.locator('#sheet.open').count() === 0, 'Bild öffnet nicht im Sheet');
  ok((await page.textContent('.fbar .ft b')) === 'TÜV-Bericht 2026', 'Vollbild nennt den Titel');
  const gross = await page.evaluate(() => {
    const i = document.querySelector('.fimg img'), f = document.getElementById('full');
    const r = i.getBoundingClientRect(), fr = f.getBoundingClientRect();
    return { breite: r.width / fr.width, hoehe: r.height / fr.height };
  });
  ok(gross.breite > 0.9, `Bild füllt die Breite (${Math.round(gross.breite * 100)} %)`);
  ok(gross.hoehe > 0.5, `Bild nutzt die Höhe (${Math.round(gross.hoehe * 100)} %)`);

  await page.keyboard.press('Escape');
  await zu();
  ok(await page.locator('#full[hidden]').count() === 1, 'Escape schließt die Vollbildanzeige');
  await page.click('[data-a="openDoc"]');
  await page.waitForSelector('#full:not([hidden])');
  await page.click('[data-a="closeFull"]');
  await zu();
  ok((await page.locator('.item').count()) === 1, 'Schließen löscht das Dokument nicht');
  await page.setViewportSize({ width: 1280, height: 720 });

  // --- Sicherung herunterladen ---
  // Die Sicherung liegt seit Schritt 5 in den Einstellungen, nicht mehr in der Garage.
  await page.goBack();
  await page.waitForSelector('.mini');
  await page.click('[data-a="settings"]');
  await page.waitForSelector('[data-a="backupOut"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-a="backupOut"]')]);
  const file = await dl.path();
  ok(/^carcollection-sicherung-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()),
    `Dateiname: ${dl.suggestedFilename()}`);

  const backup = JSON.parse(readFileSync(file, 'utf8'));
  ok(backup.app === 'carcollection' && backup.version === 1, 'Sicherung trägt Kennung und Version');
  ok(backup.vehicles.length === 1, 'Ein Fahrzeug in der Sicherung');
  ok(backup.vehicles[0].logs.length === 1 && backup.vehicles[0].docs.length === 1, 'Logbuch und Dokument enthalten');
  const imgKeys = Object.keys(backup.images);
  ok(imgKeys.length === 1 && backup.images[imgKeys[0]].startsWith('data:image/'), 'Bilddaten sind eingebettet');

  // --- Alles löschen, als wäre es ein frisches Gerät ---
  // Erst zurück in die Garage: Die Einstellungen überstehen seit Schritt 5 ein
  // Neuladen, sonst stünde die App danach wieder dort statt vor leerer Garage.
  await page.goBack();
  await page.waitForSelector('.mini');
  await page.evaluate(async () => {
    const db = await new Promise(r => { const q = indexedDB.open('fahrzeugakte', 1); q.onsuccess = () => r(q.result); });
    await new Promise(r => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').clear(); t.oncomplete = r; });
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.empty');
  ok((await page.locator('.empty').count()) === 1, 'Garage ist nach dem Löschen leer');

  // --- Sicherung einlesen ---
  await page.setInputFiles('#backupIn', file);
  await page.waitForSelector('[data-a="restoreReplace"]');
  const sheet = (await page.textContent('.panel')).replace(/\s+/g, ' ');
  ok(sheet.includes('VW Golf'), 'Dialog nennt das enthaltene Fahrzeug');
  ok(/Fahrzeuge\s*1\b/.test(sheet), 'Dialog zeigt die Anzahl der Fahrzeuge');

  await page.click('[data-a="restoreReplace"]');
  ok((await page.textContent('[data-a="restoreReplace"]')) === 'Wirklich alles ersetzen?', 'Ersetzen fragt einmal nach');
  await page.click('[data-a="restoreReplace"]');
  await eingelesen();
  await page.waitForSelector('.mini');
  ok((await page.textContent('.mini .mh b')) === 'VW Golf', 'Fahrzeug ist wiederhergestellt');

  // --- Inhalte prüfen ---
  await page.click('[data-a="open"]');
  await page.waitForSelector('.head h2');
  ok((await page.textContent('.stats')).includes('123.456 km'), 'Kilometerstand wiederhergestellt');
  ok((await page.textContent('.foot')).includes('781'), 'Kosten wiederhergestellt');
  await page.click('[data-a="tab"][data-k="doc"]');
  await page.waitForSelector('.item');
  ok((await page.textContent('.item .t')) === 'TÜV-Bericht 2026', 'Dokument wiederhergestellt');
  const thumb = await page.evaluate(() => getComputedStyle(document.querySelector('[data-thumb]')).backgroundImage);
  ok(thumb.startsWith('url("data:image/'), 'Dokumentenbild wiederhergestellt');

  // --- Zusammenführen darf nicht doppeln ---
  await page.goBack();
  await page.setInputFiles('#backupIn', file);
  await page.waitForSelector('[data-a="restoreMerge"]');
  await page.click('[data-a="restoreMerge"]');
  await eingelesen();
  ok((await page.locator('.mini').count()) === 1, 'Zusammenführen legt kein Duplikat an');

  // --- Sicherung ohne die neuen Felder bleibt lesbar ---
  // Vor Schritt 2 kannte das Format hsn und tsn nicht.
  const ohneFelder = JSON.parse(readFileSync(file, 'utf8'));
  for (const fz of ohneFelder.vehicles) { delete fz.v.hsn; delete fz.v.tsn; }
  const ohnePfad = join(tmpdir(), 'sicherung-ohne-schluesselnummern.json');
  writeFileSync(ohnePfad, JSON.stringify(ohneFelder));
  await page.setInputFiles('#backupIn', ohnePfad);
  await page.waitForSelector('[data-a="restoreMerge"]', { timeout: 5000 }).catch(() => {});
  ok(await page.locator('[data-a="restoreMerge"]').count() === 1,
    'Sicherung ohne HSN und TSN wird angenommen');
  await page.click('[data-a="restoreMerge"]');
  await eingelesen();
  ok(await page.evaluate(() => VEH[IDX[0]].v.hsn) === '',
    'Fehlende Schlüsselnummern werden zu Leerwerten, nicht zu undefined');

  // --- Sicherung aus der Zeit vor der Umbenennung bleibt lesbar ---
  const alt = JSON.parse(readFileSync(file, 'utf8'));
  alt.app = 'fahrzeugakte';
  const altPfad = join(tmpdir(), 'alte-sicherung.json');
  writeFileSync(altPfad, JSON.stringify(alt));
  await page.setInputFiles('#backupIn', altPfad);
  await page.waitForSelector('[data-a="restoreMerge"]', { timeout: 5000 }).catch(() => {});
  const angenommen = await page.locator('[data-a="restoreMerge"]').count() === 1;
  ok(angenommen, `Sicherung mit alter Kennung "fahrzeugakte" wird angenommen${angenommen ? '' : ' - Dialoge: ' + JSON.stringify(dialoge)}`);
  if (angenommen) await page.click('.panel .row [data-a="close"]');
  await eingelesen();

  // --- Fremde Datei wird abgewiesen ---
  const vorher = dialoge.length;
  await page.setInputFiles('#backupIn', join(REPO, 'manifest.webmanifest'));
  await page.waitForTimeout(400);
  ok(dialoge.length > vorher && dialoge[dialoge.length - 1].includes('keine Sicherung'),
    'Fremde JSON-Datei wird abgewiesen');

  ok(errors.length === 0, `Keine JS-Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}
