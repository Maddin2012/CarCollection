/* Navigation über die History: Die Zurück-Geste des Handys soll einen Schritt
   zurückgehen und nicht die App verlassen.

   Die Geste selbst lässt sich hier nicht auslösen - Playwright kennt keinen
   Randwisch. Geprüft wird der Mechanismus darunter, den die Geste bedient:
   goBack() löst dasselbe popstate aus. */
import { watchErrors } from './lib.mjs';

export const name = 'Navigation';

export default async function ({ browser, base, ok }) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  watchErrors(page, errors);

  const inGarage = () => page.locator('.mini, .empty').count().then(n => n > 0);
  const imFahrzeug = () => page.locator('.head h2').count().then(n => n > 0);
  const sheetOffen = () => page.locator('#sheet.open').count().then(n => n === 1);
  const vollbildOffen = () => page.evaluate(() => !document.getElementById('full').hidden);

  await page.goto(base, { waitUntil: 'networkidle' });

  // --- Zwei Fahrzeuge anlegen; beim ersten bleibt die App auf dessen Karte ---
  for (const [name, plate] of [['VW Golf', 'M-AB 1234'], ['BMW E30', 'M-CD 325']]) {
    if (await imFahrzeug()) { await page.goBack(); await page.waitForSelector('.mini'); }
    await page.click('[data-a="addVehicle"]');
    await page.fill('[name="name"]', name);
    await page.fill('[name="plate"]', plate);
    await page.click('[data-a="ok"]');
    await page.waitForSelector('.head h2');
  }
  ok((await page.textContent('.head h2')) === 'BMW E30',
    'Neues Fahrzeug landet auf seiner eigenen Karte');

  // --- Zurück aus der Karte führt in die Garage ---
  await page.goBack();
  await page.waitForSelector('.mini');
  ok(await inGarage(), 'Zurück aus der Karte führt in die Garage');
  ok((await page.locator('.mini').count()) === 2, 'Beide Fahrzeuge stehen in der Garage');

  // --- Zurück aus einem Reiter führt ebenfalls direkt in die Garage ---
  await page.click('[data-a="open"]');
  await page.waitForSelector('.head h2');
  await page.click('[data-a="tab"][data-k="part"]');
  await page.waitForSelector('[data-a="addPart"]');
  await page.goBack();
  await page.waitForSelector('.mini');
  ok(await inGarage(), 'Zurück aus dem Teile-Reiter führt in die Garage, nicht zur Karte');

  // --- Ein offenes Sheet schließt sich beim Zurückgehen ---
  await page.click('[data-a="open"]');
  await page.waitForSelector('.head h2');
  await page.click('[data-a="editVehicle"]');
  ok(await sheetOffen(), 'Sheet ist offen');
  await page.goBack();
  await page.waitForFunction(() => !document.getElementById('sheet').classList.contains('open'));
  ok(!(await sheetOffen()) && await imFahrzeug(),
    'Zurück schließt das Sheet und bleibt auf der Karte');

  // --- Kein toter Eintrag: Abbrechen darf das Zurückgehen nicht verbrauchen ---
  // Genau dafür geht das Schließen über history.back() statt direkt.
  await page.click('[data-a="editVehicle"]');
  await page.click('.panel .row [data-a="close"]');
  await page.waitForFunction(() => !document.getElementById('sheet').classList.contains('open'));
  ok(await imFahrzeug(), 'Abbrechen schließt das Sheet und bleibt auf der Karte');
  await page.goBack();
  await page.waitForSelector('.mini');
  ok(await inGarage(), 'Ein einziges Zurück nach dem Abbrechen führt in die Garage');

  // --- Vollbild verhält sich wie ein Sheet ---
  await page.click('[data-a="open"]');
  await page.waitForSelector('.head h2');
  await page.click('[data-a="tab"][data-k="doc"]');
  await page.click('[data-a="addDoc"]');
  await page.setInputFiles('#fPick', new URL('../icons/icon-192.png', import.meta.url).pathname);
  await page.waitForSelector('#fname:not(:empty)');
  await page.fill('[name="title"]', 'Rechnung');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.item');
  await page.click('[data-a="openDoc"]');
  await page.waitForSelector('#full:not([hidden])');
  ok(await vollbildOffen(), 'Vollbild ist offen');
  await page.goBack();
  await page.waitForSelector('#full[hidden]', { state: 'attached' });
  ok(!(await vollbildOffen()) && (await page.locator('.item').count()) === 1,
    'Zurück schließt das Vollbild, das Dokument bleibt');

  // --- Der Reiter überlebt ein Neuladen, weil er per replaceState mitläuft ---
  await page.click('[data-a="tab"][data-k="log"]');
  await page.waitForSelector('[data-a="addLog"]');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[data-a="addLog"]');
  ok((await page.locator('[data-a="tab"][data-k="log"].on').count()) === 1,
    'Der Reiter bleibt nach dem Neuladen erhalten');

  // --- Fahrzeug löschen landet in der Garage ---
  await page.click('[data-a="tab"][data-k="card"]');
  await page.waitForSelector('.head h2');
  await page.click('[data-a="editVehicle"]');
  await page.click('[data-a="del"]');
  await page.click('[data-a="del"]');
  await page.waitForSelector('.mini');
  ok(await inGarage() && (await page.locator('.mini').count()) === 1,
    'Nach dem Löschen steht man in der Garage, ein Fahrzeug weniger');

  ok(errors.length === 0, `Keine JS-Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}
