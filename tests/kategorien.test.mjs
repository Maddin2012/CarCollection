/* Scheckheft: mehrere Kategorien je Eintrag (Fassung 27). Ein großer Service
   mit Arbeiten an Bremsen und Fahrwerk soll ein Eintrag bleiben. */
import { watchErrors } from './lib.mjs';

export const name = 'Kategorien';

export default async function ({ browser, base, ok }) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  watchErrors(page, errors);
  await page.goto(base, { waitUntil: 'networkidle' });

  const sheetZu = () => page.waitForFunction(
    () => !document.getElementById('sheet').classList.contains('open'), null, { timeout: 10000 });
  // Was in der Maske angetippt ist - an Klasse und aria-pressed gelesen.
  const chips = () => page.evaluate(() => [...document.querySelectorAll('#logKats .chip')]
    .map(b => ({ k: b.dataset.k, an: b.classList.contains('on'), aria: b.getAttribute('aria-pressed') })));
  const tippe = k => page.click(`#logKats .chip[data-k="${k}"]`);
  // Aus dem Speicher gelesen, nicht aus der Anzeige.
  const gespeichert = titel => page.evaluate(async t => {
    const v = JSON.parse(await store.get('akte:v:' + S.id));
    return v.logs.find(l => l.title === t) || null;
  }, titel);
  const leseblatt = async titel => {
    await page.click(`.item:has-text("${titel}")`);
    await page.waitForSelector('#sheet.open');
    const z = await page.evaluate(() => {
      const s = [...document.querySelectorAll('#sbody .stat')]
        .find(x => /^Kategorie/.test(x.querySelector('span').textContent.trim()));
      return s ? { k: s.querySelector('span').textContent.trim(), v: s.querySelector('b').textContent.trim() } : null;
    });
    return z;
  };
  const listenzeile = titel => page.evaluate(t =>
    [...document.querySelectorAll('.item')].find(i => i.querySelector('.t').textContent === t)
      ?.querySelector('.s').textContent ?? null, titel);

  // --- Fahrzeug, Scheckheft ---
  await page.click('[data-a="addVehicle"]');
  await page.fill('[name="name"]', 'Skoda Octavia RS');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.head h2');
  await page.click('[data-a="tab"][data-k="log"]');

  // --- Neuer Eintrag: nichts vorausgewählt ---
  await page.click('[data-a="addLog"]');
  await page.waitForSelector('#logKats');
  let c = await chips();
  ok(c.length === 11, `Alle elf Kategorien stehen zur Wahl (${c.length})`);
  ok(c.every(x => !x.an && x.aria === 'false'), 'Bei einem neuen Eintrag ist keine Kategorie vorausgewählt');
  ok(await page.locator('#sbody select[name="category"]').count() === 0,
    'Die einzelne Auswahlliste für die Kategorie gibt es nicht mehr');

  // Bei 360 px brechen die Knöpfe um, statt seitlich zu rollen - sonst wären
  // nicht alle auf einmal zu sehen.
  await page.setViewportSize({ width: 360, height: 780 });
  await page.waitForTimeout(80);
  const breite = await page.evaluate(() => {
    const k = document.getElementById('logKats'), p = document.querySelector('#sheet .panel');
    return { kats: k.scrollWidth - k.clientWidth, panel: p.scrollWidth - p.clientWidth };
  });
  ok(breite.kats <= 0 && breite.panel <= 0,
    `Bei 360 px läuft nichts seitlich über (Kategorien ${breite.kats} px, Maske ${breite.panel} px)`);
  await page.setViewportSize({ width: 1280, height: 720 });

  // --- An- und abwählen ---
  await page.fill('[name="title"]', 'Großer Service');
  await page.selectOption('[name="type"]', 'Wartung');
  await tippe('Bremsen'); await tippe('Motor'); await tippe('Fahrwerk');
  await tippe('Fahrwerk');   // wieder ab
  c = await chips();
  ok(c.filter(x => x.an).map(x => x.k).join(',') === 'Motor,Bremsen',
    `Antippen schaltet an und wieder ab (${c.filter(x => x.an).map(x => x.k).join(',')})`);
  ok(c.find(x => x.k === 'Bremsen').aria === 'true' && c.find(x => x.k === 'Fahrwerk').aria === 'false',
    'aria-pressed folgt dem Zustand');
  await page.click('[data-a="ok"]');
  await sheetZu();

  let l = await gespeichert('Großer Service');
  ok(l && JSON.stringify(l.kategorien) === '["Motor","Bremsen"]',
    `Gespeichert werden beide Kategorien, in fester Reihenfolge (${l && JSON.stringify(l.kategorien)})`);
  ok(l && !('category' in l), 'Der Eintrag trägt kein einzelnes "category" mehr');
  ok((await listenzeile('Großer Service') || '').includes('Motor, Bremsen'),
    `Die Liste nennt beide (${await listenzeile('Großer Service')})`);
  let z = await leseblatt('Großer Service');
  ok(z && z.k === 'Kategorien' && z.v === 'Motor, Bremsen',
    `Das Leseblatt nennt beide unter "Kategorien" (${z && z.k}: ${z && z.v})`);
  await page.goBack(); await sheetZu();

  // --- Übersteht Neuladen, Maske zeigt die Wahl wieder ---
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.item');
  ok((await listenzeile('Großer Service') || '').includes('Motor, Bremsen'), 'Beide Kategorien überstehen ein Neuladen');
  await leseblatt('Großer Service');
  await page.click('#sheet [data-a="editLog"]');
  await page.waitForSelector('#logKats');
  c = await chips();
  ok(c.filter(x => x.an).map(x => x.k).join(',') === 'Motor,Bremsen',
    'Die Maske zeigt beide wieder als gewählt');
  ok(await page.inputValue('[name="pCat"]') === 'Motor',
    `Ein neues Teil am Eintrag übernimmt die erste Kategorie (${await page.inputValue('[name="pCat"]')})`);
  await page.goBack(); await sheetZu();

  // --- Ohne Kategorie ---
  await page.click('[data-a="addLog"]');
  await page.fill('[name="title"]', 'Ohne Kategorie');
  await page.click('[data-a="ok"]');
  await sheetZu();
  l = await gespeichert('Ohne Kategorie');
  ok(l && Array.isArray(l.kategorien) && l.kategorien.length === 0, 'Ein Eintrag ohne Kategorie lässt sich speichern');
  const leer = await listenzeile('Ohne Kategorie');
  ok(leer !== null && !/·\s*·/.test(leer) && !/·\s*$/.test(leer.trim()),
    `Die Liste zeigt dann keinen leeren Platz zwischen den Punkten (${leer})`);
  z = await leseblatt('Ohne Kategorie');
  ok(z && z.v === '–', `Das Leseblatt zeigt einen Strich (${z && z.v})`);
  await page.goBack(); await sheetZu();

  // --- Ältere Einträge mit einer einzelnen Kategorie ---
  // So liegen sie bis Fassung 26 im Speicher und in jeder Sicherung.
  await page.evaluate(async () => {
    S.logs.push({ id: uid(), title: 'Alter Eintrag', type: 'Reparatur', category: 'Getriebe', date: '2026-05-01', km: '', cost: '', note: '' });
    S.logs.push({ id: uid(), title: 'Unbekannte Kategorie', type: 'Umbau', category: 'Auspuff', date: '2026-04-01', km: '', cost: '', note: '' });
    await save(); render();
  });
  await page.waitForSelector('.item:has-text("Alter Eintrag")');
  ok((await listenzeile('Alter Eintrag') || '').includes('Getriebe'), 'Ein alter Eintrag zeigt seine Kategorie weiter an');
  z = await leseblatt('Alter Eintrag');
  ok(z && z.k === 'Kategorie' && z.v === 'Getriebe', `Und im Leseblatt (${z && z.k}: ${z && z.v})`);
  await page.click('#sheet [data-a="editLog"]');
  await page.waitForSelector('#logKats');
  c = await chips();
  ok(c.filter(x => x.an).map(x => x.k).join(',') === 'Getriebe', 'In der Maske ist sie angetippt');
  await tippe('Elektrik');
  await page.click('[data-a="ok"]');
  await sheetZu();
  l = await gespeichert('Alter Eintrag');
  ok(l && JSON.stringify(l.kategorien) === '["Getriebe","Elektrik"]' && !('category' in l),
    `Beim Speichern wird daraus eine Liste (${l && JSON.stringify(l.kategorien)}, category ${l && 'category' in l ? 'noch da' : 'weg'})`);

  // Ein Wert außerhalb der festen Liste darf beim Speichern nicht still
  // verschwinden.
  await leseblatt('Unbekannte Kategorie');
  await page.click('#sheet [data-a="editLog"]');
  await page.waitForSelector('#logKats');
  c = await chips();
  ok(c.some(x => x.k === 'Auspuff' && x.an), 'Ein unbekannter alter Wert bleibt wählbar und angetippt');
  await page.click('[data-a="ok"]');
  await sheetZu();
  l = await gespeichert('Unbekannte Kategorie');
  ok(l && JSON.stringify(l.kategorien) === '["Auspuff"]', `Und überlebt das Speichern (${l && JSON.stringify(l.kategorien)})`);

  // --- Sicherung ---
  const sicherung = await page.evaluate(async () => JSON.stringify(await collectBackup()));
  ok(sicherung.includes('"kategorien":["Motor","Bremsen"]'), 'Die Sicherung trägt die Kategorien mit');

  ok(errors.length === 0, `Keine JS-Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}
