/* Bilder am Logbuch-Eintrag und Anhänge am Teil.

   Der Kern: Ein Bild ist ein Dokument mit der Kategorie "Fotos". Allein die
   Art des gedrückten Knopfes entscheidet darüber - sonst unterscheidet sich ein
   Bild in nichts von einem Scan. Geprüft wird deshalb an den Kategorien beider
   Sätze, nicht daran, dass irgendetwas angelegt wurde.

   Beim Abbrechen werden S.docs *und* der Bildspeicher gelesen: Prüft man nur
   die Liste, kann die Bilddatei trotzdem schon unter img:… liegen. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { REPO, watchErrors, bildDurchwinken } from './lib.mjs';

export const name = 'Anhänge';

const BILD = join(REPO, 'icons/icon-512.png');

export default async function ({ browser, base, ok }) {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  watchErrors(page, errors);
  await page.goto(base, { waitUntil: 'networkidle' });

  const PDF = join(tmpdir(), 'carcollection-anhang-probe.pdf');
  writeFileSync(PDF, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
    + '2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

  const zu = () => page.waitForFunction(
    () => !document.getElementById('sheet').classList.contains('open'), null, { timeout: 10000 });
  const reiter = async k => {
    await page.click(`[data-a="tab"][data-k="${k}"]`);
    await page.waitForTimeout(80);
  };
  const docs = () => page.evaluate(() => S.docs.map(d => ({ ...d })));
  const bilder = () => page.evaluate(async () => {
    const keys = await store.keys('idb');
    return keys.filter(k => typeof k === 'string' && k.startsWith('img:')).length;
  });

  // --- Fahrzeug ---
  await page.click('[data-a="addVehicle"]');
  await page.fill('[name="name"]', 'VW Golf');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.head h2');

  // ------------------------------------------------- Am Logbuch-Eintrag
  await reiter('log');
  await page.click('[data-a="addLog"]');
  await page.fill('[name="title"]', 'Zahnriemen gewechselt');
  await page.fill('[name="date"]', '2026-05-04');

  // Ein Dokument …
  await page.click('[data-a="pickFile"]');
  await page.setInputFiles('#fPick', BILD);
  await bildDurchwinken(page);
  await page.waitForSelector('#anhaenge .d');

  // … und ein Bild. Das Bild muss durch denselben Zuschnitt gehen, sonst wäre
  // die Entscheidung "wie bisher" nicht eingehalten.
  await page.click('[data-a="pickFotoFile"]');
  ok(await page.inputValue('#fPick') === '', 'Die Dateiauswahl ist zurückgesetzt');
  ok(await page.getAttribute('#fPick', 'accept') === 'image/*',
    'Beim Bild lässt die Dateiauswahl nur Bilder zu');
  await page.setInputFiles('#fPick', BILD);
  await page.waitForSelector('#edit:not([hidden])');
  ok(true, 'Ein Bild geht durch denselben Zuschnitt');
  await bildDurchwinken(page);
  await page.waitForFunction(() => document.querySelectorAll('#anhaenge .d').length === 2);

  const liste = (await page.textContent('#anhaenge')).replace(/\s+/g, ' ');
  ok(/DOK/.test(liste) && /FOTO/.test(liste),
    `Die Liste unterscheidet DOK und FOTO (${liste.slice(0, 80)})`);

  ok((await docs()).length === 0, 'Vor dem Speichern liegt noch nichts in der Akte');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.item');

  const d1 = await docs();
  ok(d1.length === 2, `Zwei Anhänge in der Akte (${d1.length})`);
  const kats = d1.map(d => d.category).sort();
  ok(kats[0] === 'Fotos' && kats[1] === 'Rechnungen',
    `Einer unter Fotos, einer unter Rechnungen (${kats.join(', ')})`);
  const logId = await page.evaluate(() => S.logs[0].id);
  // Die Länge gehört mit in die Prüfung: every() auf einem leeren Array ist
  // true, die Zusicherung wäre sonst auch ohne jeden Anhang grün.
  ok(d1.length === 2 && d1.every(d => d.logId === logId),
    'Beide tragen den Bezug auf den Eintrag');
  ok(d1.length === 2 && d1.every(d => d.date === '2026-05-04'),
    'Beide übernehmen das Datum des Eintrags');

  // --- Im Reiter Dokumente in getrennten Gruppen ---
  await reiter('doc');
  await page.waitForSelector('.grp');
  const gruppen = await page.evaluate(() =>
    [...document.querySelectorAll('.grp span:first-child')].map(e => e.textContent));
  ok(gruppen.includes('Rechnungen') && gruppen.includes('Fotos'),
    `Beide Gruppen stehen da (${gruppen.join(', ')})`);
  ok((await page.locator('.item').count()) === 2, 'Und beide Anhänge');

  // ------------------------------------------------- Am Teil
  await reiter('part');
  await page.click('[data-a="addPart"]');
  await page.fill('[name="name"]', 'Zahnriemensatz');
  await page.fill('[name="date"]', '2026-05-02');
  await page.click('[data-a="pickFotoFile"]');
  await page.setInputFiles('#fPick', BILD);
  await bildDurchwinken(page);
  await page.waitForSelector('#anhaenge .d');
  await page.click('[data-a="pickFile"]');
  ok(await page.getAttribute('#fPick', 'accept') === 'image/*,application/pdf',
    'Beim Dokument sind auch PDFs erlaubt');
  await page.setInputFiles('#fPick', PDF);
  await page.waitForFunction(() => document.querySelectorAll('#anhaenge .d').length === 2);
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.item');

  const partId = await page.evaluate(() => S.parts[0].id);
  const d2 = (await docs()).filter(d => d.partId);
  ok(d2.length === 2, `Zwei Anhänge am Teil (${d2.length})`);
  ok(d2.length === 2 && d2.every(d => d.partId === partId),
    'Beide tragen den Bezug auf das Teil');
  const typen = d2.map(d => d.type).sort();
  ok(typen[0] === 'image' && typen[1] === 'pdf', `Bild und PDF (${typen.join(', ')})`);
  const fotoAmTeil = d2.find(d => d.type === 'image');
  ok(!!fotoAmTeil && fotoAmTeil.category === 'Fotos', 'Das Bild liegt unter Fotos');

  ok((await page.textContent('.item .s')).includes('2 Anhänge'),
    `Die Teile-Zeile nennt die Anzahl (${await page.textContent('.item .s')})`);

  await reiter('doc');
  ok((await page.textContent('#view')).includes('zu: Zahnriemensatz'),
    'Im Reiter Dokumente steht der Bezug auf das Teil');

  // --- Im Leseblatt des Teils ---
  await reiter('part');
  await page.click('.item');
  await page.waitForSelector('.shead [data-a="editPart"]');
  ok((await page.locator('#sbody .item[data-a="openDoc"]').count()) === 2,
    'Das Leseblatt des Teils listet beide Anhänge');
  await page.click('.panel .row [data-a="close"]');
  await zu();

  // --- Abbrechen schreibt nichts: Liste und Bildspeicher ---
  const vorherDocs = (await docs()).length, vorherBilder = await bilder();
  await page.click('[data-a="addPart"]');
  await page.fill('[name="name"]', 'Spannrolle');
  await page.click('[data-a="pickFotoFile"]');
  await page.setInputFiles('#fPick', BILD);
  await bildDurchwinken(page);
  await page.waitForSelector('#anhaenge .d');
  await page.click('.panel .row [data-a="close"]');
  await zu();
  ok((await docs()).length === vorherDocs, 'Abbrechen legt keinen Anhang an');
  ok(await bilder() === vorherBilder,
    `Und keine Bilddatei im Speicher (${await bilder()} statt ${vorherBilder})`);

  // --- Das × löst nur ---
  await page.click('.item');
  await page.waitForSelector('.shead [data-a="editPart"]');
  await page.click('.shead [data-a="editPart"]');
  await page.waitForSelector('#anhaenge .d');
  await page.click('#anhaenge .d [data-a="anhangOff"]');
  await page.waitForFunction(() => document.querySelectorAll('#anhaenge .d').length === 1);
  await page.click('[data-a="ok"]');
  await zu();
  const d3 = await docs();
  ok(d3.length === 4, `Der gelöste Anhang ist noch da (${d3.length})`);
  ok(d3.filter(d => d.partId === partId).length === 1, 'Nur einer hängt noch am Teil');

  // --- Teil löschen: Anhänge bleiben, verlieren den Bezug ---
  await page.click('.item');
  await page.waitForSelector('.shead [data-a="editPart"]');
  await page.click('.shead [data-a="editPart"]');
  await page.waitForSelector('[name="name"]');
  await page.click('.panel [data-a="del"]');
  await page.click('.panel [data-a="del"]');
  await zu();
  ok(await page.evaluate(() => S.parts.length) === 0, 'Das Teil ist gelöscht');
  const d4 = await docs();
  ok(d4.length === 4, 'Die Anhänge haben es überlebt');
  ok(d4.length === 4 && d4.every(d => !d.partId), 'Und tragen keinen Bezug mehr');

  // --- Die Sicherung trägt das Foto mit ---
  // Das belegt, dass die eine Ablage hält: collectBackup musste nichts lernen.
  await page.goBack();
  await page.waitForSelector('.mini, .karussell');
  await page.click('[data-a="settings"]');
  await page.waitForSelector('[data-a="backupOut"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-a="backupOut"]')]);
  const sicherung = JSON.parse(readFileSync(await dl.path(), 'utf8'));
  const fotos = sicherung.vehicles[0].docs.filter(d => d.category === 'Fotos');
  ok(fotos.length === 2, `Die Sicherung enthält beide Fotos (${fotos.length})`);
  ok(fotos.length === 2 && fotos.every(d => (sicherung.images['img:' + d.id] || '').startsWith('data:image/')),
    'Mit eingebetteten Bilddaten');

  ok(errors.length === 0, `Keine JS-Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}
