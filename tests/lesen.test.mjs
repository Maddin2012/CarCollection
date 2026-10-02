/* Dokumente und Teile: Antippen heißt ansehen, geändert wird über den Stift.

   Zwei Dinge werden hier ausdrücklich am Speicher geprüft und nicht am
   Aussehen: dass die Bilddatei ein Bearbeiten übersteht, und dass sie beim
   Löschen wirklich mitgeht. Und der neue Stapel-Fall - Maske über dem Vollbild -
   bekommt eine eigene Prüfung, statt dass ich annehme, die Korrektur aus
   Fassung 14 trage auch hier. */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { REPO, frei, watchErrors, bildDurchwinken } from './lib.mjs';

export const name = 'Nur lesen';

const BILD = join(REPO, 'icons/icon-512.png');

export default async function ({ browser, base, ok }) {
  // Eine gerade noch gültige PDF, wie in der Plattform-Reihe.
  const PDF = join(tmpdir(), 'carcollection-lesen-probe.pdf');
  writeFileSync(PDF, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
    + '2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  watchErrors(page, errors);
  await page.goto(base, { waitUntil: 'networkidle' });

  const zu = () => page.waitForFunction(
    () => !document.getElementById('sheet').classList.contains('open'), null, { timeout: 10000 });
  const reiter = async k => {
    await page.click(`[data-a="tab"][data-k="${k}"]`);
    await page.waitForTimeout(80);
  };
  const docs = () => page.evaluate(() => S.docs.map(d => ({ ...d })));
  const parts = () => page.evaluate(() => S.parts.map(p => ({ ...p })));
  const imSpeicher = id => page.evaluate(k => store.get('img:' + k).then(d => !!d), id);
  /* Das Blatt fährt von unten herein. Ein Treffer-Test unmittelbar nach dem
     Öffnen rennt gegen diese Animation: Die Mitte des Knopfes liegt dann noch
     woanders. Allein lief die Reihe deshalb grün, im vollen Lauf rot. Also
     warten, bis die Verschiebung des Blattes bei null steht. */
  const blattRuht = () => page.waitForFunction(() => {
    const p = document.querySelector('.panel');
    if (!p) return false;
    const t = getComputedStyle(p).transform;
    return t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)';
  }, null, { timeout: 5000 });

  // --- Fahrzeug und ein Bild-Dokument ---
  await page.click('[data-a="addVehicle"]');
  await page.fill('[name="name"]', 'VW Golf');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.head h2');

  await reiter('doc');
  await page.click('[data-a="addDoc"]');
  await page.setInputFiles('#fPick', BILD);
  await bildDurchwinken(page);
  await page.waitForSelector('#fname:not(:empty)');
  await page.fill('[name="title"]', 'TÜV-Bericht 2026');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.item');
  const docId = (await docs())[0].id;

  // --- Ansehen heißt ansehen ---
  await page.click('[data-a="openDoc"]');
  await page.waitForSelector('#full:not([hidden])');
  ok((await page.locator('[data-a="delFull"]').count()) === 0,
    'In der Vollbildanzeige gibt es keinen Löschen-Knopf mehr');
  ok(await frei(page, '.fbar [data-a="editDoc"]'),
    'Der Stift in der Leiste ist da und zu treffen');

  // --- Der Stift führt in die Maske ---
  await page.click('.fbar [data-a="editDoc"]');
  await page.waitForSelector('[name="title"]');
  ok(await page.inputValue('[name="title"]') === 'TÜV-Bericht 2026',
    'Die Maske ist mit dem Titel vorbelegt');
  ok(await page.inputValue('[name="category"]') === 'Fahrzeugpapiere',
    'Und mit der Kategorie');

  // --- Das Vollbild weicht der Maske, es stapelt sich nicht darüber ---
  // #full liegt auf z-index 30, #sheet auf 20: Gestapelt läge die Maske hinter
  // dem Bild und wäre nicht anzutippen. Geprüft wird deshalb, dass das
  // Vollbild beim Bearbeiten wirklich weg ist - und dass der Speichern-Knopf
  // nicht nur da, sondern auch zu treffen ist.
  ok(await page.evaluate(() => document.getElementById('full').hidden) === true,
    'Das Vollbild ist zu, während die Maske offen ist');
  await blattRuht();
  ok(await frei(page, '.panel [data-a="ok"]'), 'Der Speichern-Knopf ist zu treffen');

  // --- Zurück aus der Maske führt in die Liste ---
  await page.goBack();
  await zu();
  await page.waitForSelector('.item');
  ok((await page.textContent('.item .t')) === 'TÜV-Bericht 2026',
    'Zurück verwirft die Änderung und führt in die Liste');

  // --- Ändern, speichern ---
  await page.click('[data-a="openDoc"]');
  await page.waitForSelector('#full:not([hidden])');
  await page.click('.fbar [data-a="editDoc"]');
  await page.waitForSelector('[name="title"]');
  await page.fill('[name="title"]', 'TÜV-Bericht 2027');
  await page.selectOption('[name="category"]', 'TÜV / HU');
  await page.click('[data-a="ok"]');
  await zu();
  await page.waitForSelector('.item');
  ok((await page.textContent('.item .t')) === 'TÜV-Bericht 2027',
    'Die Liste zeigt den neuen Titel');
  ok((await page.textContent('.item .s')).includes('TÜV / HU')
     || (await page.textContent('#view')).includes('TÜV / HU'),
    'Und die neue Kategorie');
  // Am Speicher geprüft, nicht am Aussehen: Das Bearbeiten darf die Aufnahme
  // nicht angetastet haben.
  ok(await imSpeicher(docId) === true, 'Die Bilddatei liegt unverändert im Speicher');

  // --- Löschen in der Maske räumt alles weg ---
  await page.click('[data-a="openDoc"]');
  await page.waitForSelector('#full:not([hidden])');
  await page.click('.fbar [data-a="editDoc"]');
  await page.waitForSelector('[name="title"]');
  await page.click('.panel [data-a="del"]');
  await page.click('.panel [data-a="del"]');
  await zu();
  ok(await page.evaluate(() => document.getElementById('full').hidden) === true,
    'Nach dem Löschen ist das Vollbild zu');
  ok((await docs()).length === 0, 'Das Dokument ist weg');
  ok(await imSpeicher(docId) === false, 'Und die Bilddatei auch');
  await page.waitForSelector('.empty');
  ok((await page.locator('.item').count()) === 0, 'Die Liste ist leer');

  // --- PDF: Blatt ohne Löschen, mit Stift ---
  await page.click('[data-a="addDoc"]');
  await page.setInputFiles('#fPick', PDF);
  await page.waitForSelector('#fname:not(:empty)');
  await page.fill('[name="title"]', 'Rechnung Werkstatt');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.item');
  await page.click('[data-a="openDoc"]');
  await page.waitForSelector('[data-a="savePdf"]');
  ok((await page.locator('.panel [data-a="del"]').count()) === 0,
    'Die PDF-Ansicht hat keinen Löschen-Knopf');
  await blattRuht();
  ok(await frei(page, '.shead [data-a="editDoc"]'),
    'Dafür den Stift in der Ecke des Blattes');
  await page.click('.shead [data-a="editDoc"]');
  await page.waitForSelector('[name="title"]');
  ok(await page.inputValue('[name="title"]') === 'Rechnung Werkstatt',
    'Der Stift öffnet die Maske auch für eine PDF');
  await page.click('.panel .row [data-a="close"]');
  await zu();

  // --- Teile: Antippen heißt ansehen ---
  await reiter('part');
  await page.click('[data-a="addPart"]');
  await page.fill('[name="name"]', 'Sportluftfilter');
  await page.fill('[name="price"]', '89.90');
  await page.fill('[name="vendor"]', 'Teile-Müller');
  await page.fill('[name="partno"]', 'SLF-99');
  await page.fill('[name="note"]', 'Erste Zeile\nZweite Zeile');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.item');
  const partId = (await parts())[0].id;

  await page.click('.item');
  await page.waitForSelector('.panel');
  const blatt = (await page.textContent('.panel')).replace(/\s+/g, ' ');
  ok(blatt.includes('Sportluftfilter'), 'Das Leseblatt nennt die Bezeichnung');
  ok(blatt.includes('Teile-Müller') && blatt.includes('SLF-99'),
    'Händler und Teilenummer stehen da');
  ok(/89,90/.test(blatt), `Und der Preis (${(blatt.match(/[\d,]+\s*€/) || [''])[0]})`);
  ok(blatt.includes('Zweite Zeile'), 'Die Notiz steht da');
  ok((await page.locator('#sbody input, #sbody textarea, #sbody select').count()) === 0,
    'Im Leseblatt eines Teils gibt es kein einziges Eingabefeld');
  ok((await page.locator('.panel [data-a="ok"]').count()) === 0, 'Und keinen Speichern-Knopf');
  await blattRuht();
  ok(await frei(page, '.shead [data-a="editPart"]'),
    'Der Stift in der Ecke ist da und zu treffen');

  // --- Der Stift führt in die Maske ---
  await page.click('.shead [data-a="editPart"]');
  await page.waitForSelector('[name="name"]');
  ok(await page.inputValue('[name="name"]') === 'Sportluftfilter',
    'Die Maske ist mit den Werten vorbelegt');
  await page.fill('[name="name"]', 'Sportluftfilter K&N');
  await page.click('[data-a="ok"]');
  await zu();
  ok((await page.textContent('.item .t')) === 'Sportluftfilter K&N',
    'Die Liste zeigt die Änderung');

  // --- Löschen in der Maske ---
  await page.click('.item');
  await page.waitForSelector('.shead [data-a="editPart"]');
  await page.click('.shead [data-a="editPart"]');
  await page.waitForSelector('[name="name"]');
  await page.click('.panel [data-a="del"]');
  await page.click('.panel [data-a="del"]');
  await zu();
  ok((await parts()).length === 0, `Das Teil ist weg (${partId ? 'war angelegt' : ''})`);

  // --- Ein verknüpftes Teil nennt im Leseblatt den Eintrag ---
  await reiter('log');
  await page.click('[data-a="addLog"]');
  await page.fill('[name="title"]', 'Inspektion');
  await page.fill('[name="cost"]', '300');
  await page.fill('[name="pName"]', 'Ölfilter');
  await page.fill('[name="pPrice"]', '18');
  await page.click('[data-a="logPartNeu"]');
  await page.waitForSelector('#logParts .d');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.item');
  await reiter('part');
  await page.click('.item');
  await page.waitForSelector('.panel');
  const blatt2 = (await page.textContent('.panel')).replace(/\s+/g, ' ');
  ok(blatt2.includes('Inspektion'), 'Das Leseblatt nennt den Logbuch-Eintrag');
  ok(blatt2.includes('nicht noch einmal mit'), 'Und sagt, wie der Preis gezählt wird');
  await page.click('.panel .row [data-a="close"]');
  await zu();

  ok(errors.length === 0, `Keine JS-Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}
