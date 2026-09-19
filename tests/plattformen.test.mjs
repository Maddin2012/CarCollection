/* Prüft die plattformabhängigen Pfade, indem Safaris Eigenheiten im Chromium
   nachgestellt werden: fehlendes <input type="month"> und der
   Startbildschirm-Modus, in dem Dateien über das Teilen-Blatt gehen.

   Das ersetzt keinen Test auf echter Apple-Hardware. Belegt ist damit, dass
   die Weichen greifen — nicht, dass Safari sich dahinter erwartungsgemäß
   verhält. */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { watchErrors } from './lib.mjs';

export const name = 'Plattformen';

// Safari kennt input[type=month] nicht; der Getter meldet dann "text".
const SAFARI_MONTH = () => {
  const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'type');
  Object.defineProperty(HTMLInputElement.prototype, 'type', {
    configurable: true,
    get() { const t = d.get.call(this); return t === 'month' ? 'text' : t; },
    set(v) { d.set.call(this, v); }
  });
};

// navigator.standalone gibt es nur auf iOS und nur im Startbildschirm-Modus.
const IOS_STANDALONE = () => {
  window.__shared = [];
  Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => true });
  Object.defineProperty(Navigator.prototype, 'canShare', {
    configurable: true, writable: true,
    value: d => !!(d && d.files && d.files.length)
  });
  Object.defineProperty(Navigator.prototype, 'share', {
    configurable: true, writable: true,
    value: async d => { window.__shared.push(d.files.map(f => ({ name: f.name, type: f.type, size: f.size }))); }
  });
};

// Android-Chrome bietet das Teilen-Blatt für Dateien an, kennt aber kein
// navigator.standalone und kann ebenso gut herunterladen.
const ANDROID_SHARE = () => {
  window.__shared = [];
  Object.defineProperty(Navigator.prototype, 'canShare', {
    configurable: true, writable: true,
    value: d => !!(d && d.files && d.files.length)
  });
  Object.defineProperty(Navigator.prototype, 'share', {
    configurable: true, writable: true,
    value: async d => { window.__shared.push(d.files.map(f => ({ name: f.name, type: f.type, size: f.size }))); }
  });
};

export default async function ({ browser, base, ok }) {
  const pdf = join(tmpdir(), 'carcollection-probe.pdf');
  writeFileSync(pdf, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
    + '2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

  // ------------------------------------------------------------ Safari-Fall
  {
    const ctx = await browser.newContext();
    await ctx.addInitScript(SAFARI_MONTH);
    await ctx.addInitScript(IOS_STANDALONE);
    const page = await ctx.newPage();
    const errors = [];
    watchErrors(page, errors);
    await page.goto(base, { waitUntil: 'networkidle' });

    // --- Ersatz für das Monatsfeld ---
    await page.click('[data-a="addVehicle"]');
    ok(await page.locator('[name="tuev"]').count() === 0, 'Kein natives Monatsfeld (wie in Safari)');
    ok(await page.locator('select[name="tuev_m"]').count() === 1, 'Ersatz: Auswahlfeld für den Monat');
    ok(await page.locator('select[name="tuev_y"]').count() === 1, 'Ersatz: Auswahlfeld für das Jahr');

    await page.fill('[name="name"]', 'VW Golf');
    await page.fill('[name="km"]', '123456');
    await page.selectOption('select[name="tuev_m"]', '11');
    await page.selectOption('select[name="tuev_y"]', '2026');
    await page.click('[data-a="ok"]');
    await page.waitForSelector('.head h2');
    ok((await page.textContent('.stats')).includes('11/2026'), 'Ersatzfelder ergeben ein gültiges TÜV-Datum');
    ok(await page.evaluate(() => VEH[IDX[0]].v.tuev) === '2026-11', 'Gespeichert als "2026-11"');

    // --- Beim Bearbeiten vorausgewählt ---
    await page.click('[data-a="editVehicle"]');
    ok(await page.inputValue('select[name="tuev_m"]') === '11', 'Monat ist beim Bearbeiten vorausgewählt');
    ok(await page.inputValue('select[name="tuev_y"]') === '2026', 'Jahr ist beim Bearbeiten vorausgewählt');
    await page.click('.panel .row [data-a="close"]');

    // --- Leeres Datum darf nicht zu Unsinn führen ---
    await page.click('[data-a="editVehicle"]');
    await page.selectOption('select[name="tuev_m"]', '');
    await page.click('[data-a="ok"]');
    await page.waitForSelector('.head h2');
    ok(await page.evaluate(() => VEH[IDX[0]].v.tuev) === '', 'Ohne Monat bleibt das TÜV-Datum leer');
    ok(!(await page.textContent('.stats')).includes('NaN'), 'Kein NaN in der Anzeige');

    // --- Kalendereintrag über das Teilen-Blatt ---
    await page.click('[data-a="editVehicle"]');
    await page.selectOption('select[name="tuev_m"]', '11');
    await page.selectOption('select[name="tuev_y"]', '2026');
    await page.click('[data-a="ok"]');
    await page.waitForSelector('[data-a="tuevIcs"]');
    await page.click('[data-a="tuevIcs"]');
    await page.waitForFunction(() => window.__shared.length > 0);
    let shared = await page.evaluate(() => window.__shared);
    ok(/\.ics$/.test(shared[0][0].name), `Kalendereintrag wird geteilt: ${shared[0][0].name}`);
    ok(shared[0][0].type.startsWith('text/calendar'), 'Kalendereintrag hat den richtigen Typ');

    // --- PDF teilen statt data:-Verweis ---
    await page.click('[data-a="tab"][data-k="doc"]');
    await page.click('[data-a="addDoc"]');
    await page.setInputFiles('#fPick', pdf);
    await page.waitForSelector('#fname:not(:empty)');
    await page.fill('[name="title"]', 'Fahrzeugschein');
    await page.click('[data-a="ok"]');
    await page.waitForSelector('.item');
    await page.click('[data-a="openDoc"]');
    await page.waitForSelector('[data-a="savePdf"]');
    ok(await page.locator('#full[hidden]').count() === 1, 'PDFs öffnen weiterhin im Sheet, nicht in Vollbild');
    ok(await page.locator('.viewer a[href^="data:"]').count() === 0, 'Kein data:-Verweis mehr für PDFs');
    await page.click('[data-a="savePdf"]');
    await page.waitForFunction(() => window.__shared.length > 1);
    shared = await page.evaluate(() => window.__shared);
    ok(shared[1][0].name === 'Fahrzeugschein.pdf' && shared[1][0].type === 'application/pdf',
      `PDF wird geteilt: ${shared[1][0].name}`);
    ok(shared[1][0].size > 0, 'PDF-Inhalt ist nicht leer');
    await page.click('.panel .row [data-a="close"]');

    // --- Sicherung im Startbildschirm-Modus ---
    await page.goBack();
    await page.waitForSelector('[data-a="settings"]');
    await page.click('[data-a="settings"]');
    await page.waitForSelector('[data-a="backupOut"]');
    await page.click('[data-a="backupOut"]');
    await page.waitForFunction(() => window.__shared.length > 2);
    shared = await page.evaluate(() => window.__shared);
    ok(/^carcollection-sicherung-\d{4}-\d{2}-\d{2}\.json$/.test(shared[2][0].name),
      `Sicherung wird geteilt: ${shared[2][0].name}`);
    ok(shared[2][0].type === 'application/json', 'Sicherung hat den richtigen Typ');

    ok(errors.length === 0, `Keine JS-Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }

  // ------------------------------------------- Android und Desktop: Download
  {
    const ctx = await browser.newContext({ acceptDownloads: true });
    const page = await ctx.newPage();
    const errors = [];
    watchErrors(page, errors);
    await page.goto(base, { waitUntil: 'networkidle' });

    await page.click('[data-a="addVehicle"]');
    ok(await page.locator('input[name="tuev"]').count() === 1, 'Natives Monatsfeld bleibt, wo es unterstützt wird');
    await page.fill('[name="name"]', 'BMW E30');
    await page.fill('[name="tuev"]', '2026-10');
    await page.click('[data-a="ok"]');
    await page.waitForSelector('.head h2');
    ok((await page.textContent('.stats')).includes('10/2026'), 'Natives Monatsfeld liefert weiterhin das Datum');

    const [ics] = await Promise.all([page.waitForEvent('download'), page.click('[data-a="tuevIcs"]')]);
    ok(/\.ics$/.test(ics.suggestedFilename()), `Kalendereintrag wird heruntergeladen: ${ics.suggestedFilename()}`);

    await page.goBack();
    await page.waitForSelector('[data-a="settings"]');
    await page.click('[data-a="settings"]');
    await page.waitForSelector('[data-a="backupOut"]');
    const [bak] = await Promise.all([page.waitForEvent('download'), page.click('[data-a="backupOut"]')]);
    ok(/\.json$/.test(bak.suggestedFilename()), `Sicherung wird heruntergeladen: ${bak.suggestedFilename()}`);

    ok(errors.length === 0, `Keine JS-Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }

  // ------------------------------- Android: Teilen-Blatt, obwohl Download ginge
  // Bis Schritt 5 griff das Teilen nur im Startbildschirm-Modus von iOS. Auf
  // Android landete die Sicherung im Download-Ordner, wo man sie von Hand
  // heraussuchen musste. Jetzt hat das Teilen-Blatt überall Vorrang, wo der
  // Browser es für Dateien anbietet - navigator.standalone gibt es hier nicht.
  {
    const ctx = await browser.newContext({ acceptDownloads: true });
    await ctx.addInitScript(ANDROID_SHARE);
    const page = await ctx.newPage();
    const errors = [];
    watchErrors(page, errors);
    await page.goto(base, { waitUntil: 'networkidle' });

    ok(await page.evaluate(() => navigator.standalone === undefined),
      'Kein Startbildschirm-Modus - es ist der gewöhnliche Android-Fall');
    ok(await page.evaluate(() => 'download' in document.createElement('a')),
      'Der Download wäre hier möglich - das Teilen hat trotzdem Vorrang');

    await page.click('[data-a="addVehicle"]');
    await page.fill('[name="name"]', 'Opel Kadett');
    await page.click('[data-a="ok"]');
    await page.waitForSelector('.head h2');
    await page.goBack();
    await page.waitForSelector('.mini');
    await page.click('[data-a="settings"]');
    await page.waitForSelector('[data-a="backupOut"]:not([disabled])');

    // Kommt ein Download, ist das Teilen übergangen worden.
    let heruntergeladen = false;
    page.on('download', () => { heruntergeladen = true; });
    await page.click('[data-a="backupOut"]');
    await page.waitForFunction(() => window.__shared.length > 0);
    const shared = await page.evaluate(() => window.__shared);
    ok(/^carcollection-sicherung-\d{4}-\d{2}-\d{2}\.json$/.test(shared[0][0].name),
      `Sicherung geht ins Teilen-Blatt: ${shared[0][0].name}`);
    await page.waitForTimeout(400);
    ok(!heruntergeladen, 'Und nicht zusätzlich in den Download-Ordner');

    // --- Abgebrochenes Teilen lädt nicht ersatzweise herunter ---
    await page.evaluate(() => {
      navigator.share = async () => { const e = new Error('abgebrochen'); e.name = 'AbortError'; throw e; };
    });
    heruntergeladen = false;
    await page.click('[data-a="backupOut"]');
    await page.waitForTimeout(600);
    ok(!heruntergeladen, 'Bricht man das Teilen ab, wird nichts heruntergeladen');

    // --- Scheitert das Teilen anders, greift der Download als Rückfallebene ---
    await page.evaluate(() => { navigator.share = async () => { throw new Error('kaputt'); }; });
    const [dl] = await Promise.all([
      page.waitForEvent('download'), page.click('[data-a="backupOut"]')]);
    ok(/\.json$/.test(dl.suggestedFilename()),
      `Scheitert das Teilen, wird heruntergeladen: ${dl.suggestedFilename()}`);

    ok(errors.length === 0, `Keine JS-Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }
}
