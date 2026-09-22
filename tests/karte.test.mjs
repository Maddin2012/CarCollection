/* Fahrzeugkarte: letzter Service, Titelbild in der Maske, Höhe des Bildes. */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { png, watchErrors } from './lib.mjs';

export const name = 'Fahrzeugkarte';

export default async function ({ browser, base, ok }) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  watchErrors(page, errors);
  await page.goto(base, { waitUntil: 'networkidle' });

  // Ein deutlich nicht quadratisches Bild - sonst ließe sich ein falsches
  // Seitenverhältnis in der Vorschau nicht von einem richtigen unterscheiden.
  const bildPfad = join(tmpdir(), 'titelbild-quer.png');
  writeFileSync(bildPfad, png(300, 180, (x, y) => [200, (x * 255 / 300) | 0, (y * 255 / 180) | 0]));

  /* Den Wert einer Datenzeile der Karte lesen, an ihrer Beschriftung gefunden. */
  const zeile = beschriftung => page.evaluate(b => {
    const el = [...document.querySelectorAll('.stats .stat')]
      .find(s => s.querySelector('span').textContent.trim() === b);
    return el ? el.querySelector('b').textContent.trim() : null;
  }, beschriftung);

  // Ein geschlossenes Sheet ist leer und damit nie "sichtbar" - waitForSelector
  // würde darauf ewig warten. Also auf die Klasse selbst schauen.
  const sheetZu = () => page.waitForFunction(
    () => !document.getElementById('sheet').classList.contains('open'), null, { timeout: 10000 });

  const zurKarte = async () => {
    await page.click('[data-a="tab"][data-k="card"]');
    await page.waitForSelector('.head h2');
  };

  const logEintrag = async (titel, art, datum, kmWert) => {
    await page.click('[data-a="tab"][data-k="log"]');
    await page.click('[data-a="addLog"]');
    await page.fill('[name="title"]', titel);
    await page.selectOption('[name="type"]', art);
    await page.fill('[name="date"]', datum);
    if (kmWert) await page.fill('[name="km"]', String(kmWert));
    await page.click('[data-a="ok"]');
    await page.waitForSelector('.item');
    await zurKarte();
  };

  // --- Fahrzeug anlegen ---
  await page.click('[data-a="addVehicle"]');
  await page.fill('[name="name"]', 'VW Golf');
  await page.fill('[name="km"]', '140000');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.head h2');

  ok(await zeile('Letzter Service') !== null, 'Die Karte hat eine Zeile "Letzter Service"');
  ok(await zeile('Letzter Service') === '–', 'Ohne Wartung und ohne Feld steht dort ein Strich');

  // --- Aus dem Logbuch ---
  await logEintrag('Inspektion', 'Wartung', '2026-03-12', 142500);
  ok(await zeile('Letzter Service') === '12.03.2026 · 142.500 km',
    `Wartung aus dem Logbuch steht auf der Karte (${await zeile('Letzter Service')})`);

  // Eine Reparatur ist kein Service. Genau diese Prüfung fällt um, wenn
  // schlicht der jüngste Logbuch-Eintrag genommen wird.
  await logEintrag('Auspuff geschweißt', 'Reparatur', '2026-08-01', 145000);
  ok(await zeile('Letzter Service') === '12.03.2026 · 142.500 km',
    `Eine neuere Reparatur ändert den Service nicht (${await zeile('Letzter Service')})`);

  await logEintrag('Ölwechsel', 'Wartung', '2026-06-05', 144000);
  ok(await zeile('Letzter Service') === '05.06.2026 · 144.000 km',
    `Von zwei Wartungen gewinnt die jüngere (${await zeile('Letzter Service')})`);

  // --- Handfeld in der Maske ---
  const maskeAuf = async () => {
    await page.click('[data-a="editVehicle"]');
    await page.waitForSelector('[name="service"]');
  };
  await maskeAuf();
  await page.fill('[name="service"]', '2026-07-20');
  await page.fill('[name="serviceKm"]', '144800');
  await page.click('[data-a="ok"]');
  await sheetZu();
  ok(await zeile('Letzter Service') === '20.07.2026 · 144.800 km',
    `Das neuere Handfeld gewinnt gegen das Logbuch (${await zeile('Letzter Service')})`);

  await logEintrag('Große Inspektion', 'Wartung', '2026-09-01', 146200);
  ok(await zeile('Letzter Service') === '01.09.2026 · 146.200 km',
    `Eine neuere Wartung gewinnt wieder gegen das Handfeld (${await zeile('Letzter Service')})`);

  await maskeAuf();
  ok(await page.inputValue('[name="service"]') === '2026-07-20',
    'Die Maske zeigt weiter den Handwert, nicht den angezeigten');
  await page.click('.panel .row [data-a="close"]');
  await sheetZu();

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.head h2');
  ok(await zeile('Letzter Service') === '01.09.2026 · 146.200 km', 'Der Service übersteht ein Neuladen');
  ok(await page.evaluate(() => VEH[IDX[0]].v.service) === '2026-07-20',
    'Das Handfeld liegt unverändert im Speicher');

  // --- Das Titelbild ist von der Karte verschwunden ---
  ok(await page.locator('.photo .edit').count() === 0, 'Kein Knopf "Bild ändern" mehr auf der Karte');
  ok(await page.evaluate(() => !document.getElementById('coverBox').closest('[data-a]')),
    'Das Titelbild trägt keine Aktion mehr');
  await page.click('#coverBox');
  await page.waitForTimeout(200);
  ok(await page.locator('#sheet.open').count() === 0,
    'Ein Tipp auf das Titelbild öffnet nichts');

  // --- Titelbild in der Maske: Abbrechen schreibt nichts ---
  const imSpeicher = () => page.evaluate(() => store.get('img:cover:' + S.id).then(d => !!d));
  ok(await imSpeicher() === false, 'Vor dem Wählen liegt kein Titelbild im Speicher');

  await maskeAuf();
  await page.setInputFiles('#coverIn', bildPfad);
  await page.waitForFunction(() => {
    const b = document.getElementById('cbox');
    return b && b.style.backgroundImage.startsWith('url(');
  });
  ok(true, 'Das gewählte Bild erscheint als Vorschau in der Maske');
  ok(await page.locator('#coverOff:not([hidden])').count() === 1, 'Der Knopf "Entfernen" wird sichtbar');

  await page.click('.panel .row [data-a="close"]');
  await sheetZu();
  // Nicht nur das Aussehen prüfen: Das Bild könnte trotzdem schon im Speicher
  // liegen. Gelesen wird deshalb der Speicher selbst.
  ok(await imSpeicher() === false, 'Nach dem Abbrechen liegt nichts im Speicher');
  ok(await page.evaluate(() => VEH[IDX[0]].cover) === false, 'Und die Akte weiß von keinem Bild');

  // --- Speichern legt es wirklich ab ---
  await maskeAuf();
  await page.setInputFiles('#coverIn', bildPfad);
  await page.waitForFunction(() => {
    const b = document.getElementById('cbox');
    return b && b.style.backgroundImage.startsWith('url(');
  });
  await page.click('[data-a="ok"]');
  await sheetZu();
  ok(await imSpeicher() === true, 'Nach dem Speichern liegt das Bild im Speicher');

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.head h2');
  await page.waitForFunction(() => {
    const b = document.getElementById('coverBox');
    return b && b.style.backgroundImage.startsWith('url(');
  });
  ok(true, 'Das Titelbild übersteht ein Neuladen und steht auf der Karte');

  // --- Entfernen ---
  await maskeAuf();
  await page.click('[data-a="coverOff"]');
  await page.waitForFunction(() => {
    const b = document.getElementById('cbox');
    return b && !b.style.backgroundImage;
  });
  ok(await imSpeicher() === true, 'Entfernen allein löscht noch nichts – erst das Speichern');
  await page.click('[data-a="ok"]');
  await sheetZu();
  ok(await imSpeicher() === false, 'Nach dem Speichern ist das Bild aus dem Speicher weg');
  ok(await page.evaluate(() => VEH[IDX[0]].cover) === false, 'Und die Akte weiß nichts mehr davon');

  // --- Höhe des Bildbereichs ---
  // Gemessen wird der dargestellte Bereich, nicht die CSS-Regel: Eine Regel
  // kann dastehen und doch von etwas anderem überschrieben werden.
  for (const [w, h] of [[360, 780], [390, 844], [1280, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    const r = await page.evaluate(() => {
      const b = document.getElementById('coverBox').getBoundingClientRect();
      return { w: b.width, h: b.height };
    });
    ok(Math.abs(r.w / r.h - 4 / 3) < 0.01,
      `Bei ${w} px ist der Bildbereich 4:3 (${Math.round(r.w)}x${Math.round(r.h)})`);
    const breit = await page.evaluate(() =>
      document.documentElement.scrollWidth <= window.innerWidth);
    ok(breit, `Bei ${w} px läuft nichts seitlich über`);
  }
  await page.setViewportSize({ width: 390, height: 844 });

  ok(errors.length === 0, `Keine JS-Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}
