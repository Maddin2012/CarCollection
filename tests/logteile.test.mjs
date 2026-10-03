/* Logbuch-Eintrag zum Lesen, Teile am Eintrag und die Kostenregel.

   Die Kostenregel ist der Kern: Ein verknüpftes Teil zählt in den Ausgaben der
   Karte nicht noch einmal mit, weil sein Preis in den Kosten des Eintrags
   steckt. Geprüft wird deshalb mit zwei verschiedenen Zahlen - 500 mit Bezug,
   700 ohne. Eine Prüfung auf nur eine Zahl wäre auch grün, wenn gar nichts
   gerechnet wird. */
import { join } from 'node:path';
import { REPO, frei, watchErrors, bildDurchwinken } from './lib.mjs';

export const name = 'Logbuch-Teile';

const BILD = join(REPO, 'icons/icon-512.png');

export default async function ({ browser, base, ok }) {
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
  const parts = () => page.evaluate(() => S.parts.map(p => ({ ...p })));
  const logs = () => page.evaluate(() => S.logs.map(l => ({ ...l })));
  const ausgaben = async () => {
    await reiter('card');
    await page.waitForSelector('.foot');
    const t = await page.textContent('.foot');
    const m = t.match(/([\d.]+)\s*€/);
    return m ? Number(m[1].replace(/\./g, '')) : null;
  };
  // Bewusst auf .item und nicht auf .item[data-a="openLog"]: Öffnet der Eintrag
  // wieder direkt die Maske - der Fehler, den diese Reihe sucht -, soll das die
  // Leseblatt-Prüfungen rot machen und nicht die ganze Reihe mit einem
  // Zeitablauf abbrechen.
  const lesen = async () => {
    await page.click('.item');
    await page.waitForSelector('.panel');
  };
  const stift = () => page.locator('.shead [data-a="editLog"]');
  const bearbeiten = async () => {
    await lesen();
    if (await stift().count()) await page.click('.shead [data-a="editLog"]');
    await page.waitForSelector('#logPartForm');
  };

  // --- Fahrzeug und ein Eintrag mit 500 € ---
  await page.click('[data-a="addVehicle"]');
  await page.fill('[name="name"]', 'VW Golf');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.head h2');

  await reiter('log');
  await page.click('[data-a="addLog"]');
  await page.fill('[name="title"]', 'Zahnriemen gewechselt');
  await page.fill('[name="cost"]', '500');
  await page.fill('[name="km"]', '120000');
  await page.fill('[name="note"]', 'Erste Zeile\nZweite Zeile');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.item');

  // --- Das Leseblatt ---
  await lesen();
  const blatt = (await page.textContent('.panel')).replace(/\s+/g, ' ');
  ok(blatt.includes('Zahnriemen gewechselt'), 'Das Leseblatt nennt den Titel');
  ok(/Kosten\s*500,00/.test(blatt), `Und die Kosten (${(blatt.match(/Kosten\s*[\d.,]+\s*€/) || [''])[0]})`);
  ok(/Kilometerstand\s*120\.000/.test(blatt), 'Und den Kilometerstand');
  ok(blatt.includes('Zweite Zeile'), 'Die Notiz steht da');
  // Das ist der Punkt: lesen, nicht bearbeiten.
  ok((await page.locator('#sbody input, #sbody textarea, #sbody select').count()) === 0,
    'Im Leseblatt gibt es kein einziges Eingabefeld');
  ok((await page.locator('.panel [data-a="ok"]').count()) === 0, 'Und keinen Speichern-Knopf');
  ok(await frei(page, '.shead [data-a="editLog"]'),
    'Der Stift in der Ecke des Blattes ist da und zu treffen');

  if (await stift().count()) await page.click('.shead [data-a="editLog"]');
  await page.waitForSelector('[name="title"]');
  ok(await page.inputValue('[name="title"]') === 'Zahnriemen gewechselt',
    'Der Stift öffnet die Maske mit den Werten des Eintrags');
  await page.click('.panel .row [data-a="close"]');
  await zu();

  // --- Neues Teil am Eintrag ---
  await bearbeiten();
  await page.fill('[name="pName"]', 'Zahnriemensatz');
  await page.fill('[name="pPrice"]', '200');
  await page.fill('[name="pNo"]', 'ZRS-4711');
  await page.click('[data-a="logPartNeu"]');
  await page.waitForSelector('#logParts .d');
  ok(await page.inputValue('[name="pName"]') === '',
    'Nach dem Hinzufügen ist das Formular wieder leer');
  ok((await parts()).length === 0, 'Vor dem Speichern liegt noch kein Teil in der Akte');
  await page.click('[data-a="ok"]');
  await zu();

  const p1 = await parts();
  ok(p1.length === 1, `Nach dem Speichern gibt es genau ein Teil (${p1.length})`);
  ok(p1[0].name === 'Zahnriemensatz' && String(p1[0].price) === '200' && p1[0].partno === 'ZRS-4711',
    'Mit Bezeichnung, Preis und Teilenummer');
  ok(p1[0].logId === (await logs())[0].id, 'Und mit dem Bezug auf den Eintrag');
  ok(p1[0].status === 'Verbaut', 'Status ist Verbaut');

  // --- Der Eintrag selbst bleibt sauber ---
  // vals() sammelt jedes Feld der Maske ein. Ohne die Ausnahme für
  // data-nebenform klebten pName, pCat, pPrice, pNo am Logbuch-Eintrag.
  const l1 = (await logs())[0];
  const fremd = Object.keys(l1).filter(k => /^p[A-Z]/.test(k));
  ok(fremd.length === 0, `Der Eintrag trägt keine Felder des Teile-Formulars (${fremd.join(', ') || 'keine'})`);

  // --- Im Reiter Teile mit Bezug ---
  await reiter('part');
  await page.waitForSelector('.item');
  ok((await page.textContent('.item .s')).includes('zu: Zahnriemen gewechselt'),
    'Das Teil nennt im Reiter Teile den Eintrag');
  ok((await page.textContent('#view')).includes('nicht noch einmal mit'),
    'Unter der Summe steht, warum die Zahlen nicht dasselbe zählen');

  // --- Die Kostenregel ---
  ok(await ausgaben() === 500, `Verknüpft zählt das Teil nicht doppelt (${await ausgaben()} €)`);

  // --- Im Leseblatt steht das Teil ---
  await reiter('log');
  await lesen();
  const blatt2 = (await page.textContent('.panel')).replace(/\s+/g, ' ');
  ok(blatt2.includes('Zahnriemensatz') && blatt2.includes('ZRS-4711'),
    'Das Leseblatt listet das verknüpfte Teil');
  ok((await page.textContent('.item .s')) !== null, 'Die Liste dahinter steht noch');
  await page.click('.panel .row [data-a="close"]');
  await zu();
  ok((await page.textContent('.item .s')).includes('1 Teil'),
    `Der Eintrag nennt die Anzahl der Teile (${await page.textContent('.item .s')})`);

  // --- Abbrechen schreibt nichts ---
  await bearbeiten();
  await page.fill('[name="pName"]', 'Spannrolle');
  await page.click('[data-a="logPartNeu"]');
  await page.waitForFunction(() => document.querySelectorAll('#logParts .d').length === 2);
  await page.click('.panel .row [data-a="close"]');
  await zu();
  ok((await parts()).length === 1, 'Abbrechen legt das Teil nicht ab');

  // --- Lösen nimmt nur den Bezug ---
  await bearbeiten();
  await page.click('#logParts .d [data-a="logPartOff"]');
  await page.waitForFunction(() => document.querySelectorAll('#logParts .d').length === 0);
  await page.click('[data-a="ok"]');
  await zu();
  const p2 = await parts();
  ok(p2.length === 1, 'Das gelöste Teil ist noch da');
  ok(!p2[0].logId, 'Es trägt keinen Bezug mehr');
  ok(await ausgaben() === 700, `Ohne Bezug zählt es wieder mit (${await ausgaben()} €)`);
  await reiter('part');
  ok(!(await page.textContent('#view')).includes('zu:'), 'Und im Reiter Teile steht kein Bezug');

  // --- Vorhandenes Teil verknüpfen ---
  await page.click('[data-a="addPart"]');
  await page.fill('[name="name"]', 'Wasserpumpe');
  await page.fill('[name="price"]', '90');
  await page.click('[data-a="ok"]');
  await zu();
  ok((await parts()).length === 2, 'Zwei Teile im Reiter Teile');

  await reiter('log');
  await bearbeiten();
  const frei2 = await page.evaluate(() =>
    [...document.querySelectorAll('#logPartPick option')].map(o => o.textContent));
  ok(frei2.some(t => t.includes('Wasserpumpe')) && frei2.some(t => t.includes('Zahnriemensatz')),
    `Die Auswahl zeigt die freien Teile (${frei2.length - 1})`);
  // selectOption nimmt kein Muster, also erst die Kennung der Option holen.
  const wpWert = await page.evaluate(() =>
    [...document.querySelectorAll('#logPartPick option')]
      .find(o => o.textContent.includes('Wasserpumpe')).value);
  await page.selectOption('#logPartPick', wpWert);
  await page.click('[data-a="logPartAn"]');
  await page.waitForSelector('#logParts .d');
  await page.click('[data-a="ok"]');
  await zu();
  const p3 = await parts();
  ok(p3.length === 2, 'Verknüpfen legt kein zweites Teil an');
  ok(p3.filter(p => p.logId).length === 1, 'Genau eines hängt am Eintrag');
  ok(p3.find(p => p.name === 'Wasserpumpe').logId === l1.id, 'Und zwar die Wasserpumpe');
  ok(await ausgaben() === 700, `Die Wasserpumpe zählt nun nicht mehr mit (${await ausgaben()} €)`);

  // Ein verknüpftes Teil darf nicht noch einmal in der Auswahl stehen.
  await reiter('log');
  await bearbeiten();
  const frei3 = await page.evaluate(() =>
    [...document.querySelectorAll('#logPartPick option')].map(o => o.textContent).join('|'));
  ok(!frei3.includes('Wasserpumpe'), 'Ein schon verknüpftes Teil steht nicht mehr in der Auswahl');
  await page.click('.panel .row [data-a="close"]');
  await zu();

  // --- Eintrag löschen: Teile bleiben und zählen wieder ---
  await bearbeiten();
  await page.click('.panel [data-a="del"]');
  await page.click('.panel [data-a="del"]');
  await zu();
  ok((await logs()).length === 0, 'Der Eintrag ist gelöscht');
  const p4 = await parts();
  ok(p4.length === 2, 'Die Teile haben ihn überlebt');
  ok(p4.every(p => !p.logId), 'Sie tragen keinen Bezug mehr');
  ok(await ausgaben() === 290, `Und zählen wieder voll mit (${await ausgaben()} €)`);

  // --- Dokument aus dem Leseblatt öffnen, Zurück führt ins Blatt ---
  await reiter('log');
  await page.click('[data-a="addLog"]');
  await page.fill('[name="title"]', 'Inspektion');
  await page.setInputFiles('#fPick', BILD);
  await bildDurchwinken(page);
  await page.waitForSelector('#anhaenge .d');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.item');
  await lesen();
  ok((await page.locator('#sbody .item[data-a="openDoc"]').count()) === 1,
    'Das Leseblatt listet das Dokument');
  if (!(await page.locator('#sbody .item[data-a="openDoc"]').count())) {
    ok(false, 'Ein Tipp darauf öffnet die Vollbildanzeige');
    ok(false, 'Zurück führt ins Leseblatt und nicht ins Logbuch');
  } else {
  await page.click('#sbody .item[data-a="openDoc"]');
  await page.waitForSelector('#full:not([hidden])');
  ok(true, 'Ein Tipp darauf öffnet die Vollbildanzeige');
  await page.goBack();
  await page.waitForSelector('#full[hidden]', { state: 'attached' });
  ok((await stift().count()) === 1,
    'Zurück führt ins Leseblatt und nicht ins Logbuch');
  await page.goBack();
  await zu();
  }

  // --- Das Zahnrad ---
  await page.goBack();
  await page.waitForSelector('.grid, .mini');
  const pfade = await page.evaluate(() => ({ gear: ICONS.gear, part: ICONS.part }));
  ok(pfade.gear !== pfade.part, 'Zahnrad und Teile-Symbol sind nicht derselbe Pfad');
  ok(pfade.gear.includes('<path') && !pfade.gear.includes('M12 3v3'),
    'Das Zahnrad ist kein Kranz aus Strahlen wie das Teile-Symbol');
  ok(await frei(page, '#topBtn [data-a="settings"]'),
    'Der Knopf oben rechts ist da und zu treffen');

  ok(errors.length === 0, `Keine JS-Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}
