/* Speicherung, Anzeige und die PWA-Bausteine. */
import { watchErrors } from './lib.mjs';

export const name = 'Grundfunktionen';

export default async function ({ browser, base, ok }) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  watchErrors(page, errors);
  await page.goto(base, { waitUntil: 'networkidle' });

  // --- Speicher-Backend ---
  ok(await page.evaluate(() => !!window.indexedDB), 'IndexedDB im Browser vorhanden');
  ok(await page.evaluate(() => persistent === true), 'App meldet dauerhaften Speicher');
  ok(await page.locator('.note.warn').count() === 0, 'Kein "Speichern nicht verfügbar"-Hinweis');

  // --- Fahrzeug anlegen ---
  await page.click('[data-a="addVehicle"]');
  await page.fill('[name="name"]', 'VW Golf');
  await page.fill('[name="variant"]', 'GTI Edition 35');
  await page.fill('[name="plate"]', 'M-AB 1234');
  await page.fill('[name="km"]', '123456');
  await page.fill('[name="tuev"]', '2026-11');
  await page.fill('[name="vin"]', 'WVWZZZ1KZAW123456');
  await page.fill('[name="hsn"]', '0603');
  await page.fill('[name="tsn"]', 'bgx');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.head h2');
  ok((await page.textContent('.head h2')) === 'VW Golf', 'Fahrzeug angelegt und Karte sichtbar');

  // --- Datenfelder der Karte ---
  const karte = (await page.textContent('.stats')).replace(/\s+/g, ' ');
  ok(karte.includes('WVWZZZ1KZAW123456'), 'FIN steht auf der Karte');
  // Die Beschriftungen enthalten selbst Ziffern ("zu 2.1"), deshalb exakt prüfen
  ok(/HSN \(zu 2\.1\)\s*0603/.test(karte), 'HSN steht auf der Karte');
  ok(/TSN \(zu 2\.2\)\s*BGX/.test(karte), 'TSN steht auf der Karte, in Großbuchstaben');
  ok(await page.evaluate(() => VEH[IDX[0]].v.tsn) === 'BGX', 'TSN wird in Großbuchstaben gespeichert');
  for (const weg of ['Leistung', 'Hubraum', 'Kraftstoff']) {
    ok(!karte.includes(weg), `${weg} steht nicht mehr auf der Karte`);
  }
  await page.click('[data-a="editVehicle"]');
  ok(await page.locator('[name="power"]').count() === 1,
    'Leistung ist in der Bearbeiten-Maske weiterhin erfassbar');
  ok(await page.inputValue('[name="hsn"]') === '0603', 'HSN ist beim Bearbeiten vorbelegt');
  await page.click('.panel .row [data-a="close"]');

  // --- Aufgeräumte Oberfläche ---
  ok(await page.locator('#topBtn [data-a="editVehicle"] svg').count() === 1,
    'Bearbeiten ist ein Stift-Icon in der Kopfzeile');
  ok(await page.locator('[data-a="updateKm"]').count() === 0,
    'Kein eigener Knopf für den Kilometerstand mehr');

  await page.goBack();
  await page.waitForSelector('.mini');
  ok(await page.locator('.mini .photo .plate').count() === 0,
    'Kennzeichen steht nicht mehr im Bildbereich');
  ok((await page.textContent('.mini .ms')).includes('M-AB 1234'),
    'Kennzeichen steht in der Textzeile der Karte');
  ok(await page.locator('#topBtn [data-a="addVehicle"]').count() === 0,
    'Kein Hinzufügen-Knopf mehr oben in der Garage');
  ok(await page.locator('.add[data-a="addVehicle"]').count() === 1,
    'Die große Kachel zum Hinzufügen bleibt');

  // --- Kein seitlicher Überlauf auf einem schmalen Gerät ---
  // Ein umbruchunfähiges Element in der Fahrzeugkarte hat genau das schon
  // einmal ausgelöst, ohne dass eine der übrigen Prüfungen angeschlagen hätte.
  const passtInsFenster = () => page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.waitForTimeout(120);
  ok(await passtInsFenster(), 'Garage scrollt bei 360 px nicht seitlich');
  await page.click('[data-a="open"]');
  await page.waitForSelector('.head h2');
  await page.waitForTimeout(120);
  ok(await passtInsFenster(), 'Fahrzeugkarte scrollt bei 360 px nicht seitlich');
  await page.setViewportSize({ width: 1280, height: 720 });

  // --- Logbuch-Eintrag ---
  await page.click('[data-a="tab"][data-k="log"]');
  await page.click('[data-a="addLog"]');
  await page.fill('[name="title"]', 'Zahnriemen gewechselt');
  await page.fill('[name="cost"]', '780.50');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.item');
  ok((await page.locator('.item').count()) === 1, 'Logbuch-Eintrag gespeichert');

  // --- Neu laden: Daten müssen überleben ---
  // Der zuletzt gezeigte Reiter steht im History-Eintrag und wird beim Start
  // wiederhergestellt - nach dem Neuladen steht man also wieder im Logbuch.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[data-a="addLog"]');
  ok((await page.locator('.item').count()) === 1, 'Logbuch-Eintrag überlebt Neuladen');
  await page.click('[data-a="tab"][data-k="card"]');
  await page.waitForSelector('.head h2');
  ok((await page.textContent('.head h2')) === 'VW Golf', 'Fahrzeug überlebt Neuladen');
  ok((await page.textContent('.head p')) === 'GTI Edition 35', 'Variante überlebt Neuladen');
  ok((await page.textContent('.stats')).includes('123.456 km'), 'Kilometerstand überlebt Neuladen');
  ok((await page.textContent('.foot')).includes('781'), 'Kosten aus dem Logbuch in der Summe');

  // --- Zweiter Tab derselben Herkunft ---
  const page2 = await ctx.newPage();
  await page2.goto(base, { waitUntil: 'networkidle' });
  await page2.waitForSelector('.head h2');
  ok((await page2.textContent('.head h2')) === 'VW Golf', 'Daten auch in neuem Tab vorhanden');

  // --- Liegt es wirklich in IndexedDB? ---
  const keys = await page.evaluate(async () => {
    const db = await new Promise(r => { const q = indexedDB.open('fahrzeugakte', 1); q.onsuccess = () => r(q.result); });
    return await new Promise(r => { const q = db.transaction('kv').objectStore('kv').getAllKeys(); q.onsuccess = () => r(q.result); });
  });
  ok(keys.includes('akte:index'), 'akte:index liegt in IndexedDB');
  ok(keys.some(k => String(k).startsWith('akte:v:')), 'Fahrzeugdatensatz liegt in IndexedDB');

  // --- PWA-Bausteine ---
  const manifest = await page.evaluate(() => fetch('manifest.webmanifest').then(r => r.ok && r.json()));
  ok(manifest && manifest.name === 'CarCollection' && manifest.icons.length === 4, 'Manifest wird ausgeliefert');
  ok(await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => !!r)), 'Service Worker registriert');
  for (const i of ['icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png']) {
    ok(await page.evaluate(u => fetch(u).then(r => r.status), i) === 200, `Icon erreichbar: ${i}`);
  }

  // --- Der Service Worker legt auch nicht vorab gespeicherte Dateien ab ---
  // Das clone() lag einmal einen Mikrotask zu spät: Die Seite hatte den Körper
  // dann schon gelesen, das Klonen warf einen TypeError und es landete nie
  // etwas im Cache. Sichtbar war davon nichts, weil die sechs Dateien aus
  // ASSETS schon beim Installieren abgelegt werden.
  await page.evaluate(() => navigator.serviceWorker.ready);
  const imCache = u => page.evaluate(async u => {
    for (const n of await caches.keys()) {
      const c = await caches.open(n);
      for (const r of await c.keys()) if (r.url.endsWith(u)) return true;
    }
    return false;
  }, u);
  ok(!(await imCache('/README.md')), 'README.md liegt vorher nicht im Cache');
  await page.evaluate(() => fetch('README.md').then(r => r.text()));
  await page.waitForFunction(async () => {
    for (const n of await caches.keys()) {
      const c = await caches.open(n);
      for (const r of await c.keys()) if (r.url.endsWith('/README.md')) return true;
    }
    return false;
  }, null, { timeout: 5000 }).catch(() => {});
  ok(await imCache('/README.md'), 'Der Service Worker legt eine abgerufene Datei im Cache ab');

  // --- Offline ---
  await ctx.setOffline(true);
  const page3 = await ctx.newPage();
  let offlineOk = true, status = null;
  try {
    const res = await page3.goto(base, { waitUntil: 'domcontentloaded' });
    status = res && res.status();
    await page3.waitForSelector('.head h2', { timeout: 5000 });   // das Rendern ist asynchron
  } catch { offlineOk = false; }
  ok(offlineOk && status === 200, 'App lädt offline aus dem Cache');
  ok(offlineOk && (await page3.textContent('.head h2')) === 'VW Golf', 'Daten offline vorhanden');
  await ctx.setOffline(false);

  ok(errors.length === 0, `Keine JS-Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}
