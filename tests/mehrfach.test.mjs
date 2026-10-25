/* Mehrere Dateien auf einmal und die Kategorie aus dem Filter (Fassung 35).

   Gewünscht am Pixel: Beim Dokument-Hinzufügen mehrere Dateien gleichzeitig
   wählen; jede wird ein eigenes Dokument mit eigenem Titel. Fotos gehen der
   Reihe nach durch den Zuschnitt ("Bild 2 von 3"), ein abgebrochenes fällt
   allein weg. Und ist oben ein Filter gewählt, steht er in der Maske schon als
   Kategorie.

   Geprüft wird an S.docs *und* am Bildspeicher - eine Liste allein sagt
   nicht, ob die Dateien wirklich liegen oder nach einem Fehler liegenbleiben. */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { watchErrors, png, frei } from './lib.mjs';

export const name = 'Mehrere Dateien';

export default async function ({ browser, base, ok }) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 892 } });
  const page = await ctx.newPage();
  const errors = [];
  watchErrors(page, errors);
  await page.goto(base, { waitUntil: 'networkidle' });

  const pdf = n => { const p = join(tmpdir(), n);
    writeFileSync(p, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
      + '2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n% ' + n + '\n');
    return p; };
  const bild = (n, farbe) => { const p = join(tmpdir(), n); writeFileSync(p, png(300, 200, () => farbe)); return p; };
  const PDF_A = pdf('rechnung-a.pdf'), PDF_B = pdf('rechnung-b.pdf'), PDF_C = pdf('rechnung-c.pdf');
  const VORN = bild('blatt-vorn.png', [200, 40, 40]), HINTEN = bild('blatt-hinten.png', [40, 40, 200]);

  const bilder = () => page.evaluate(async () => {
    const keys = await store.keys('idb');
    return keys.filter(k => typeof k === 'string' && k.startsWith('img:'));
  });
  const titel = () => page.$$eval('#dokListe .dtitel', l => l.map(e => e.value));
  const zuschnitt = text => page.waitForFunction(t => {
    const e = document.querySelector('#edit:not([hidden]) .et span');
    return !!e && e.textContent.includes(t);
  }, text, { timeout: 8000 }).then(() => true, () => false);
  const kategorie = () => page.$eval('#sbody [name="category"]', e => e.value);
  const maskeZu = async () => {
    await page.click('#sheet [data-a="close"].btn');
    await page.waitForFunction(() => !document.getElementById('sheet').classList.contains('open'));
  };

  // --- Fahrzeug, Reiter Dokumente ---
  await page.click('[data-a="addVehicle"]');
  await page.fill('[name="name"]', 'BMW E30');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.head h2');
  await page.click('[data-a="tab"][data-k="doc"]');
  await page.waitForSelector('[data-a="addDoc"]');

  // --- Vier Dateien auf einmal: zwei PDF, zwei Bilder ---
  await page.click('[data-a="addDoc"]');
  ok(await page.$eval('#fPick', e => e.multiple), 'Die Dateiauswahl lässt mehrere Dateien zu');
  ok((await page.textContent('[data-a="pickFile"]')).trim() === 'Dateien wählen', 'Der Knopf heißt „Dateien wählen“');
  await page.selectOption('#sbody [name="category"]', 'Fahrwerk');
  await page.fill('#sbody [name="date"]', '2026-09-14');
  await page.setInputFiles('#fPick', [PDF_A, VORN, PDF_B, HINTEN]);
  ok(await zuschnitt('Bild 1 von 2'), 'Das erste Foto kommt in den Zuschnitt, mit „Bild 1 von 2“');
  await page.click('[data-a="editUeber"]');
  await page.waitForSelector('[data-a="editSpeichern"]');
  ok((await page.textContent('#edit .et span')).includes('Bild 1 von 2'), 'Auch im Ergebnis steht „Bild 1 von 2“');
  await page.click('[data-a="editSpeichern"]');
  ok(await zuschnitt('Bild 2 von 2'), 'Danach öffnet sich der Zuschnitt für das zweite Foto');
  // Das zweite per Zurück-Geste abbrechen: nur dieses fällt weg.
  await page.goBack();
  await page.waitForSelector('#edit[hidden]', { state: 'attached' });
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => document.getElementById('edit').hidden && document.getElementById('sheet').classList.contains('open')),
    'Die Zurück-Geste schließt nur den Zuschnitt, die Maske steht noch');
  ok(JSON.stringify(await page.evaluate(() => modalStack)) === '["sheet"]', 'Danach liegt nur noch die Maske im Stapel');
  ok(JSON.stringify(await titel()) === JSON.stringify(['rechnung-a', 'rechnung-b', 'blatt-vorn']),
    `Die Liste zeigt drei Dateien, je mit dem Dateinamen als Titel (${(await titel()).join(', ')})`);
  ok((await page.textContent('#fname')) === '3 Dateien ausgewählt', 'Die Maske meldet „3 Dateien ausgewählt“');
  ok(await page.$eval('#titelEinzeln', e => e.hidden), 'Das einzelne Titelfeld tritt zurück');
  ok(await kategorie() === 'Fahrwerk', 'Die gewählte Kategorie bleibt stehen');

  // --- Ein leerer Titel: nichts wird gespeichert ---
  const zeile = i => page.locator('#dokListe .dtitel').nth(i);
  await zeile(1).fill('');
  await page.click('[data-a="ok"]');
  await page.waitForTimeout(200);
  ok((await page.textContent('#err')).includes('für jede Datei einen Titel'), 'Ein leerer Titel wird gemeldet');
  ok(await page.evaluate(() => S.docs.length) === 0 && (await bilder()).length === 0, 'Dabei wird nichts gespeichert');

  // --- Speicherfehler beim zweiten Schreiben: nichts bleibt liegen ---
  await zeile(1).fill('Rechnung Federn');
  await page.evaluate(() => {
    window._echtSet = store.set; let n = 0;
    store.set = async (k, v) => (k.startsWith('img:') && ++n === 2) ? false : window._echtSet(k, v);
  });
  await page.click('[data-a="ok"]');
  await page.waitForTimeout(300);
  await page.evaluate(() => { store.set = window._echtSet; });
  ok((await page.textContent('#err')).includes('Es wurde nichts angelegt'), 'Ein Speicherfehler wird gemeldet');
  ok(await page.evaluate(() => S.docs.length) === 0, 'Nach dem Fehler entsteht kein Dokument');
  ok((await bilder()).length === 0, 'Die schon geschriebene erste Datei ist wieder weg');
  ok(await page.evaluate(() => document.getElementById('sheet').classList.contains('open')), 'Die Maske bleibt offen, nichts Getipptes geht verloren');

  // --- Umbenennen, eine entfernen, speichern ---
  await zeile(0).fill('Rechnung Bilstein');
  await page.click('#dokListe [data-a="dokWeg"] >> nth=2');
  ok(JSON.stringify(await titel()) === JSON.stringify(['Rechnung Bilstein', 'Rechnung Federn']),
    'Entfernen nimmt nur diese Zeile, Getipptes bleibt stehen');
  await page.click('[data-a="ok"]');
  await page.waitForFunction(() => !document.getElementById('sheet').classList.contains('open'));
  const docs = await page.evaluate(() => S.docs.map(d => ({ ...d })));
  ok(docs.length === 2 && docs.map(d => d.title).join('|') === 'Rechnung Bilstein|Rechnung Federn',
    `Zwei Dokumente mit den eingetragenen Titeln (${docs.map(d => d.title).join(', ')})`);
  ok(docs.every(d => d.category === 'Fahrwerk' && d.date === '2026-09-14' && d.type === 'pdf'),
    'Beide in der gewählten Kategorie, mit dem Datum');
  const liegt = await page.evaluate(async ids => {
    const r = []; for (const id of ids) r.push(!!(await store.get('img:' + id))); return r;
  }, docs.map(d => d.id));
  ok(liegt.every(Boolean) && (await bilder()).length === 2, 'Jede Datei liegt im Speicher, keine zu viel');
  ok(await page.locator('.item').count() === 2, 'Beide stehen in der Liste');

  // --- Von zwei auf eine: das einzelne Titelfeld kommt zurück ---
  await page.click('[data-a="addDoc"]');
  await page.setInputFiles('#fPick', [PDF_A, PDF_C]);
  await page.waitForSelector('#dokListe .dtitel');
  await zeile(1).fill('TÜV 2026');
  await page.click('#dokListe [data-a="dokWeg"] >> nth=0');
  ok(!(await page.$eval('#titelEinzeln', e => e.hidden)) && await page.$eval('#sbody [name="title"]', e => e.value) === 'TÜV 2026'
    && await page.locator('#dokListe .d').count() === 0,
    'Bleibt eine Datei, steht ihr Titel wieder im einzelnen Feld');
  ok((await page.textContent('#fname')).includes('rechnung-c.pdf'), 'und die Maske nennt die Datei');
  await maskeZu();

  // --- Kategorie aus dem Filter ---
  await page.click('[data-a="fDoc"][data-k="Fahrwerk"]');
  await page.click('[data-a="addDoc"]');
  ok(await kategorie() === 'Fahrwerk', 'Filter „Fahrwerk“ → die Maske hat Fahrwerk gewählt');
  await maskeZu();
  await page.click('[data-a="fDoc"][data-k="Alle"]');
  await page.click('[data-a="addDoc"]');
  ok(await kategorie() === 'Fahrzeugpapiere', 'Filter „Alle“ → wie bisher Fahrzeugpapiere');
  await maskeZu();
  await page.evaluate(() => { S.docs.push({ id: 'probe-foto', type: 'image', title: 'Probe', category: 'Fotos', date: '' }); render(); });
  await page.click('[data-a="fDoc"][data-k="Fotos"]');
  await page.click('[data-a="addDoc"]');
  ok(await kategorie() === 'Fotos', 'Filter „Fotos“ → Fotos');
  await maskeZu();
  await page.evaluate(() => { S.docs = S.docs.filter(d => d.id !== 'probe-foto'); window._df = 'Alle'; render(); });

  // --- Logbuch-Eintrag: mehrere Anhänge auf einmal ---
  await page.click('[data-a="tab"][data-k="log"]');
  await page.click('[data-a="addLog"]');
  await page.fill('[name="title"]', 'Fahrwerk erneuert');
  await page.click('[data-a="pickFile"]');
  await page.setInputFiles('#fPick', [PDF_A, PDF_B]);
  await page.waitForFunction(() => document.querySelectorAll('#anhaenge .d').length === 2, null, { timeout: 5000 }).catch(() => {});
  ok(await page.locator('#anhaenge .d').count() === 2, 'Im Logbuch-Eintrag kommen zwei Dateien auf einmal als zwei Anhänge an');
  await page.click('[data-a="ok"]');
  await page.waitForFunction(() => !document.getElementById('sheet').classList.contains('open'));
  ok(await page.evaluate(() => S.docs.filter(d => d.logId).length) === 2, 'und werden beide am Eintrag gespeichert');

  // --- 360 px: die Liste passt ---
  await page.setViewportSize({ width: 360, height: 640 });
  await page.click('[data-a="tab"][data-k="doc"]');
  await page.click('[data-a="addDoc"]');
  await page.setInputFiles('#fPick', [PDF_A, PDF_B, PDF_C]);
  await page.waitForSelector('#dokListe .dtitel');
  await zeile(0).fill('Ein sehr langer Titel für eine Rechnung über das komplette Fahrwerk');
  ok(await page.evaluate(() => { const p = document.querySelector('#sheet .panel'); return p.scrollWidth <= p.clientWidth; }),
    'Bei 360 px läuft die Liste nicht seitlich über');
  await page.$eval('#dokListe [data-a="dokWeg"]', e => e.scrollIntoView({ block: 'center' }));
  ok(await frei(page, '#dokListe [data-a="dokWeg"]'), 'Das ✕ ist frei anzutippen');
  await page.$eval('[data-a="ok"]', e => e.scrollIntoView({ block: 'center' }));
  ok(await frei(page, '[data-a="ok"]'), 'Speichern ist frei anzutippen');
  await maskeZu();

  ok(errors.length === 0, 'Keine JS-Fehler' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}
