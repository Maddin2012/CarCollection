/* Einstellungen hinter dem Zahnrad: Sicherung, Fassung, Update-Prüfung.

   Die Update-Prüfung läuft gegen eine abgefangene version.json. Der Service
   Worker ist in diesen Kontexten abgeschaltet, sonst entschiede er, was die
   Seite zu sehen bekommt, und die Prüfung liefe ins Leere. Dass er die Datei
   durchlässt statt sie zu cachen, wird weiter unten eigens geprüft - dort mit
   eingeschaltetem Service Worker. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { REPO, watchErrors } from './lib.mjs';

export const name = 'Einstellungen';

// Die Fassung, die die App von sich behauptet - aus der Quelle gelesen, nicht
// hier noch einmal hingeschrieben.
const FASSUNG = (readFileSync(join(REPO, 'index.html'), 'utf8')
  .match(/const APP_VERSION='([^']+)'/) || [])[1];

const anlegen = async (page, name) => {
  await page.click('[data-a="addVehicle"]');
  await page.fill('[name="name"]', name);
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.head h2');
};

export default async function ({ browser, base, ok }) {
  ok(!!FASSUNG, `index.html nennt eine Fassung: ${FASSUNG}`);

  // ------------------------------------------------- Bedienung und Navigation
  {
    const ctx = await browser.newContext({ acceptDownloads: true, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errors = [];
    watchErrors(page, errors);
    await page.goto(base, { waitUntil: 'networkidle' });

    // --- Zahnrad statt leerer Kopfzeile ---
    ok((await page.locator('#topBtn [data-a="settings"]').count()) === 1,
      'Zahnrad steht oben rechts in der Garage');
    ok((await page.locator('#view [data-a="backupOut"]').count()) === 0,
      'Die Sicherungs-Knöpfe stehen nicht mehr in der Garage');

    // --- Einstellungen öffnen ---
    await page.click('[data-a="settings"]');
    await page.waitForSelector('.sect');
    ok((await page.textContent('#title')) === 'Einstellungen', 'Kopfzeile nennt die Einstellungen');
    const text = (await page.textContent('#view')).replace(/\s+/g, ' ');
    ok(text.includes('Sicherung'), 'Abschnitt Sicherung vorhanden');
    ok(text.includes('Updates'), 'Abschnitt Updates vorhanden');
    ok((await page.locator('[data-a="backupOut"]').count()) === 1,
      'Sicherung speichern liegt in den Einstellungen');
    ok((await page.locator('[data-a="backupIn"]').count()) === 1,
      'Sicherung einlesen liegt in den Einstellungen');
    ok((await page.locator('[data-a="backupOut"][disabled]').count()) === 1,
      'Ohne Fahrzeug lässt sich keine Sicherung speichern');

    // --- Die laufende Fassung steht da ---
    const fassung = await page.locator('.sect .stat', { hasText: 'Fassung' }).textContent();
    ok(fassung.includes(FASSUNG), `Die laufende Fassung steht in den Einstellungen: ${FASSUNG}`);

    // --- Zurück-Geste schließt die Einstellungen ---
    await page.goBack();
    await page.waitForSelector('.empty');
    ok((await page.textContent('#title')) === 'Garage', 'Zurück führt aus den Einstellungen in die Garage');

    // --- Der Schließen-Knopf tut dasselbe, ohne toten Eintrag ---
    await page.click('[data-a="settings"]');
    await page.waitForSelector('.sect');
    await page.click('[data-a="closeSettings"]');
    await page.waitForSelector('.empty');
    ok((await page.textContent('#title')) === 'Garage', 'Der Schließen-Knopf führt in die Garage');

    // --- Einstellungen überstehen ein Neuladen ---
    await page.click('[data-a="settings"]');
    await page.waitForSelector('.sect');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.sect');
    ok((await page.textContent('#title')) === 'Einstellungen',
      'Nach dem Neuladen stehen die Einstellungen noch offen');
    await page.goBack();
    await page.waitForSelector('.empty');
    ok((await page.textContent('#title')) === 'Garage',
      'Auch nach dem Neuladen führt ein Zurück in die Garage, nicht aus der App');

    // --- Sicherung lässt sich von hier aus auslösen ---
    await anlegen(page, 'VW Golf');
    await page.goBack();
    await page.waitForSelector('.mini');
    await page.click('[data-a="settings"]');
    await page.waitForSelector('[data-a="backupOut"]:not([disabled])');
    const [dl] = await Promise.all([
      page.waitForEvent('download'), page.click('[data-a="backupOut"]')]);
    ok(/^carcollection-sicherung-\d{4}-\d{2}-\d{2}\.txt$/.test(dl.suggestedFilename()),
      `Sicherung aus den Einstellungen: ${dl.suggestedFilename()}`);

    // --- Der Weg wird benannt, statt ihn erraten zu lassen ---
    // Ohne diese Zeile war nicht zu erkennen, warum kein Teilen-Blatt aufging.
    await page.waitForSelector('#bakNote');
    ok((await page.textContent('#bakNote')).includes('Heruntergeladen'),
      `Die App sagt, was sie getan hat: "${await page.textContent('#bakNote')}"`);

    // --- Der Inhalt ist weiterhin JSON, nur die Endung ist eine andere ---
    const roh = readFileSync(await dl.path(), 'utf8');
    const geparst = JSON.parse(roh);
    ok(geparst.app === 'carcollection' && Array.isArray(geparst.vehicles),
      'Die .txt enthält unverändert die Sicherung als JSON');

    // --- Und eine alte .json-Sicherung liest sie weiterhin ein ---
    const altPfad = join(tmpdir(), 'alte-sicherung.json');
    writeFileSync(altPfad, roh);
    await page.setInputFiles('#backupIn', altPfad);
    await page.waitForSelector('[data-a="restoreMerge"]', { timeout: 5000 }).catch(() => {});
    ok((await page.locator('[data-a="restoreMerge"]').count()) === 1,
      'Eine Sicherung mit der alten Endung .json wird weiterhin angenommen');
    await page.click('.panel .row [data-a="close"]');
    await page.waitForFunction(() => !document.getElementById('sheet').classList.contains('open'));

    ok(errors.length === 0, `Keine JS-Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }

  // ------------------------------------------------- Update-Prüfung: gleich
  {
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    await ctx.route('**/version.json*', r =>
      r.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: FASSUNG }) }));
    const page = await ctx.newPage();
    const errors = [];
    watchErrors(page, errors);
    await page.goto(base, { waitUntil: 'networkidle' });

    ok((await page.locator('.alert').count()) === 0,
      'Bei gleicher Fassung meldet sich die stille Prüfung nicht');
    await page.click('[data-a="settings"]');
    await page.waitForSelector('[data-a="checkUpdate"]');
    ok((await page.locator('#upNote').count()) === 0, 'Vor der Prüfung steht dort kein Ergebnis');
    await page.click('[data-a="checkUpdate"]');
    await page.waitForSelector('#upNote');
    ok((await page.textContent('#upNote')).includes('neueste'),
      `Auf Knopfdruck meldet sie die neueste Fassung: "${await page.textContent('#upNote')}"`);

    ok(errors.length === 0, `Keine JS-Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }

  // ------------------------------------------- Update-Prüfung: es gibt was Neues
  {
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    await ctx.route('**/version.json*', r =>
      r.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: '999' }) }));
    const page = await ctx.newPage();
    const errors = [];
    watchErrors(page, errors);
    await page.goto(base, { waitUntil: 'networkidle' });

    // Die stille Prüfung beim Start meldet sich hier sehr wohl.
    await page.waitForSelector('.alert', { timeout: 10000 });
    ok((await page.textContent('.alert')).includes('999'),
      'Die stille Prüfung beim Start weist auf die neue Fassung hin');
    await page.click('.alert [data-a="settings"], .alert button');
    await page.waitForSelector('.sect');
    ok((await page.textContent('#title')) === 'Einstellungen',
      'Der Hinweis führt in die Einstellungen');
    await page.click('[data-a="checkUpdate"]');
    await page.waitForSelector('#upNote');
    const note = await page.textContent('#upNote');
    ok(note.includes('999'), `Die Einstellungen nennen die bereitliegende Fassung: "${note}"`);
    ok((await page.locator('.sect .stat', { hasText: 'Fassung' }).textContent()).includes(FASSUNG),
      'Die laufende Fassung bleibt daneben sichtbar');

    ok(errors.length === 0, `Keine JS-Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }

  // ------------------------------------- Ohne Verbindung meldet sie das ehrlich
  {
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errors = [];
    watchErrors(page, errors);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.click('[data-a="settings"]');
    await page.waitForSelector('[data-a="checkUpdate"]');
    await ctx.route('**/version.json*', r => r.abort());
    await page.click('[data-a="checkUpdate"]');
    await page.waitForSelector('#upNote');
    ok((await page.textContent('#upNote')).includes('nicht möglich'),
      'Ohne Verbindung sagt die Prüfung das, statt "alles aktuell" zu behaupten');

    // Der abgebrochene Abruf ist hier der Sinn der Übung - Chromium meldet ihn
    // trotzdem auf der Konsole. Alles andere wäre ein echter Fehler.
    const echte = errors.filter(e => !/ERR_FAILED|version\.json/.test(e));
    ok(echte.length === 0, `Keine JS-Fehler außer dem erwarteten Abbruch${echte.length ? ': ' + echte.join(' | ') : ''}`);
    await ctx.close();
  }

  // --------------------- Der Service Worker legt version.json nicht im Cache ab
  // Täte er es, meldete die App nach dem ersten Abruf auf ewig dieselbe Fassung.
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    watchErrors(page, errors);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(() => navigator.serviceWorker.ready);
    // Zweimal abrufen: Beim zweiten Mal griffe ein Cache-Treffer.
    const gelesen = await page.evaluate(async () => {
      const a = await fetch('version.json?t=1').then(r => r.json());
      const b = await fetch('version.json?t=2').then(r => r.json());
      return [a.version, b.version];
    });
    ok(gelesen[0] === FASSUNG && gelesen[1] === FASSUNG,
      `version.json ist trotz Service Worker lesbar: ${gelesen.join(', ')}`);
    const imCache = await page.evaluate(async () => {
      let treffer = 0;
      for (const name of await caches.keys()) {
        const c = await caches.open(name);
        for (const req of await c.keys()) if (req.url.includes('version.json')) treffer++;
      }
      return treffer;
    });
    ok(imCache === 0, `version.json liegt in keinem Cache (gefunden: ${imCache})`);

    ok(errors.length === 0, `Keine JS-Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }
}
