/* PDFs in der App ansehen (Fassung 36).

   Gewünscht am Pixel: Eine gespeicherte PDF ansehen, ohne sie erst weitergeben
   oder abspeichern zu müssen. PDF.js malt die Seiten in der App.

   Die Test-PDF wird hier erzeugt: Seite 1 rot, Seite 2 blau. Geprüft wird an
   den gemalten Pixeln, nicht daran, dass "irgendein Canvas" da ist - ein leeres
   Canvas sähe genauso aus. Dazu: keine Anfrage an fremde Server, und offline
   geht es auch. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { REPO, watchErrors, frei } from './lib.mjs';

export const name = 'PDF ansehen';

// Eine gültige PDF mit einer vollflächig gefüllten Seite je Farbe (0..1).
function pdfErzeugen(farben) {
  const obj = [];
  const kids = farben.map((_, i) => `${3 + 2 * i} 0 R`).join(' ');
  obj.push('<< /Type /Catalog /Pages 2 0 R >>');
  obj.push(`<< /Type /Pages /Kids [${kids}] /Count ${farben.length} >>`);
  for (const [r, g, b] of farben) {
    const n = obj.length + 1;
    obj.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${n + 1} 0 R >>`);
    const inhalt = `${r} ${g} ${b} rg 0 0 595 842 re f`;
    obj.push(`<< /Length ${inhalt.length} >>\nstream\n${inhalt}\nendstream`);
  }
  let text = '%PDF-1.4\n';
  const lagen = [];
  obj.forEach((o, i) => { lagen.push(text.length); text += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = text.length;
  text += `xref\n0 ${obj.length + 1}\n0000000000 65535 f \n`
    + lagen.map(l => String(l).padStart(10, '0') + ' 00000 n \n').join('')
    + `trailer\n<< /Size ${obj.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return text;
}

export default async function ({ browser, base, ok }) {
  // --- Die Bibliothek im Repository ist unveränderter Mozilla-Code ---
  // Abgelegt als .js statt .mjs: Den Typ für .js liefert jeder Server richtig,
  // ein Modul mit falschem Typ lädt der Browser nicht.
  for (const f of ['pdf.min', 'pdf.worker.min']) {
    const hier = readFileSync(join(REPO, 'vendor/pdfjs', f + '.js'));
    const quelle = readFileSync(join(REPO, 'node_modules/pdfjs-dist/legacy/build', f + '.mjs'));
    ok(hier.equals(quelle), `vendor/pdfjs/${f}.js ist bytegleich mit pdfjs-dist (legacy/build/${f}.mjs)`);
  }
  ok(readFileSync(join(REPO, 'vendor/pdfjs/LICENSE')).equals(readFileSync(join(REPO, 'node_modules/pdfjs-dist/LICENSE'))),
    'Die Lizenz liegt mit dabei');
  const fassung = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')).devDependencies['pdfjs-dist'];
  ok(/^\d+\.\d+\.\d+$/.test(fassung), `pdfjs-dist ist auf eine genaue Fassung festgelegt (${fassung})`);

  const PDF = join(tmpdir(), 'pdf-zwei-seiten.pdf');
  writeFileSync(PDF, pdfErzeugen([[1, 0, 0], [0, 0, 1]]));
  const KAPUTT = join(tmpdir(), 'pdf-kaputt.pdf');
  writeFileSync(KAPUTT, '%PDF-1.4\ndas ist keine PDF\n%%EOF\n');

  const ctx = await browser.newContext({ viewport: { width: 412, height: 892 } });
  const page = await ctx.newPage();
  const errors = [];
  watchErrors(page, errors);
  const fremd = [];
  const origin = new URL(base).origin;
  ctx.on('request', r => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) fremd.push(u); });
  await page.goto(base, { waitUntil: 'networkidle' });

  const p = () => page.evaluate(() => P && { s: P.s, x: P.x, y: P.y, W: P.W, H: P.H, hoehe: P.hoehe });
  const gemalt = n => page.waitForFunction(n => document.querySelectorAll('#pseiten canvas[data-guete]').length >= n, n, { timeout: 15000 }).then(() => true, () => false);
  const farbe = i => page.evaluate(i => {
    const c = document.querySelectorAll('#pseiten canvas')[i];
    if (!c || !c.width) return null;
    const d = c.getContext('2d').getImageData(c.width >> 1, c.height >> 1, 1, 1).data;
    return [d[0], d[1], d[2]];
  }, i);
  const zeiger = folge => page.evaluate(folge => {
    const f = document.getElementById('fpdf'), r = f.getBoundingClientRect();
    for (const [t, id, x, y] of folge)
      (t === 'pointerdown' ? f : window).dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: r.left + x, clientY: r.top + y, bubbles: true, isPrimary: id === 1, pointerType: 'touch' }));
  }, folge);
  const nr = () => page.textContent('#pnr');
  const anlegen = async (datei, titel) => {
    await page.click('[data-a="addDoc"]');
    await page.setInputFiles('#fPick', datei);
    await page.waitForSelector('#fname:not(:empty)');
    await page.fill('[name="title"]', titel);
    await page.click('[data-a="ok"]');
    await page.waitForFunction(() => !document.getElementById('sheet').classList.contains('open'));
  };
  const oeffnen = async titel => {
    await page.locator('[data-a="openDoc"]', { hasText: titel }).click();
    await page.waitForSelector('#full:not([hidden]) #fpdf');
  };

  // --- Fahrzeug, zwei Dokumente ---
  await page.click('[data-a="addVehicle"]');
  await page.fill('[name="name"]', 'BMW E30');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.head h2');
  await page.click('[data-a="tab"][data-k="doc"]');
  await anlegen(PDF, 'Rechnung Fahrwerk');
  await anlegen(KAPUTT, 'Kaputte Datei');

  // --- Öffnen: die Seiten sind wirklich gemalt ---
  await oeffnen('Rechnung Fahrwerk');
  ok(await page.locator('#sheet.open').count() === 0, 'Die PDF öffnet im Vollbild, nicht mehr im Blatt mit „Öffnen oder sichern“');
  ok(await gemalt(2), 'Beide Seiten werden gemalt');
  ok(await page.locator('#pseiten canvas').count() === 2, 'Zwei Seiten untereinander');
  const rot = await farbe(0), blau = await farbe(1);
  ok(rot && rot[0] > 200 && rot[1] < 60 && rot[2] < 60, `Seite 1 zeigt ihren Inhalt: rot (${rot})`);
  ok(blau && blau[2] > 200 && blau[0] < 60 && blau[1] < 60, `Seite 2 zeigt ihren Inhalt: blau (${blau})`);
  ok((await nr()) === 'Seite 1 von 2', `Unten steht „Seite 1 von 2“ (${await nr()})`);
  let g = await p();
  ok(Math.abs(g.y) < 0.5, 'Die Anzeige beginnt oben');
  const breite = await page.$eval('#pseiten canvas', c => c.getBoundingClientRect().width);
  ok(Math.abs(breite - (g.W - 16)) < 1, `Eine Seite füllt die Breite (${Math.round(breite)} von ${g.W} px)`);

  // --- Ein Finger schiebt, am Ende ist Schluss ---
  await zeiger([['pointerdown', 1, 200, 600], ['pointermove', 1, 200, 400], ['pointermove', 1, 200, -3000], ['pointerup', 1, 200, -3000]]);
  await page.waitForTimeout(100);
  g = await p();
  ok(Math.abs(g.y - (g.H - g.hoehe * g.s)) < 0.5, `Weit nach oben geschoben, bleibt die Anzeige am Ende stehen (y ${g.y.toFixed(1)})`);
  ok((await nr()) === 'Seite 2 von 2', `Danach steht „Seite 2 von 2“ da (${await nr()})`);
  await zeiger([['pointerdown', 1, 200, 300], ['pointermove', 1, 200, 5000], ['pointerup', 1, 200, 5000]]);
  await page.waitForTimeout(100);
  ok(Math.abs((await p()).y) < 0.5, 'Und zurück nach unten geschoben, oben am Anfang');

  // --- Zwei Finger zoomen um den Punkt dazwischen ---
  const guete0 = Number(await page.$eval('#pseiten canvas', c => c.dataset.guete));
  g = await p();
  const mx = 206, my = 300;
  const vor = { u: (mx - g.x) / g.s, v: (my - g.y) / g.s };
  await zeiger([['pointerdown', 1, mx - 50, my], ['pointerdown', 2, mx + 50, my],
    ['pointermove', 1, mx - 150, my], ['pointermove', 2, mx + 150, my],
    ['pointerup', 1, mx - 150, my], ['pointerup', 2, mx + 150, my]]);
  g = await p();
  const nach = { u: (mx - g.x) / g.s, v: (my - g.y) / g.s };
  ok(g.s > 2.5, `Auseinanderziehen vergrößert (${g.s.toFixed(2)}×)`);
  ok(Math.abs(nach.u - vor.u) < 0.5 && Math.abs(nach.v - vor.v) < 0.5,
    `Der Punkt zwischen den Fingern bleibt stehen (${vor.u.toFixed(1)}/${vor.v.toFixed(1)} → ${nach.u.toFixed(1)}/${nach.v.toFixed(1)})`);
  const schaerfer = await page.waitForFunction(g0 => Number(document.querySelector('#pseiten canvas').dataset.guete) > g0 * 2, guete0, { timeout: 15000 }).then(() => true, () => false);
  ok(schaerfer, 'Danach wird die Seite in höherer Auflösung neu gemalt');
  ok((await farbe(0) || [])[0] > 200, 'und zeigt weiter ihren Inhalt');

  // --- Teilen bleibt möglich ---
  await page.evaluate(() => {
    window.__geteilt = null;
    navigator.canShare = () => true;
    navigator.share = async d => { window.__geteilt = d.files.map(f => ({ name: f.name, type: f.type, size: f.size })); };
  });
  await page.click('#full .fbar [data-a="savePdf"]');
  await page.waitForFunction(() => window.__geteilt, null, { timeout: 5000 }).catch(() => {});
  const geteilt = await page.evaluate(() => window.__geteilt);
  ok(!!geteilt && geteilt[0].name === 'Rechnung Fahrwerk.pdf' && geteilt[0].type === 'application/pdf' && geteilt[0].size > 100,
    `Der Teilen-Knopf gibt die PDF weiter (${geteilt && geteilt[0].name})`);

  // --- Zurück-Geste schließt nur die Anzeige ---
  await page.goBack();
  await page.waitForSelector('#full[hidden]', { state: 'attached' });
  ok(await page.locator('[data-a="addDoc"]').count() === 1 && await page.evaluate(() => P === null),
    'Die Zurück-Geste schließt die Anzeige und gibt die PDF frei');

  // --- Der Stift führt in die Maske ---
  await oeffnen('Rechnung Fahrwerk');
  await gemalt(1);
  await page.click('#full .fbar [data-a="editDoc"]');
  await page.waitForSelector('#sheet.open [name="title"]');
  ok(await page.inputValue('[name="title"]') === 'Rechnung Fahrwerk' && await page.locator('#full[hidden]').count() === 1,
    'Der Stift öffnet die Maske des Dokuments');
  await page.click('.panel .row [data-a="close"]');
  await page.waitForFunction(() => !document.getElementById('sheet').classList.contains('open'));

  // --- Eine kaputte PDF: Hinweis und der Weg nach draußen ---
  await oeffnen('Kaputte Datei');
  await page.waitForFunction(() => /nicht anzeigen/.test((document.getElementById('pinfo') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
  ok((await page.textContent('#pinfo')).includes('lässt sich hier nicht anzeigen'), 'Eine kaputte PDF meldet, dass sie sich hier nicht anzeigen lässt');
  ok(await page.locator('#pinfo [data-a="savePdf"]').count() === 1, 'und bietet „PDF öffnen oder sichern“ an');
  ok(await page.evaluate(() => S.docs.length) === 2, 'Dabei wird nichts gelöscht');
  await page.goBack();
  await page.waitForSelector('#full[hidden]', { state: 'attached' });

  // --- 360 px: Leiste frei ---
  await page.setViewportSize({ width: 360, height: 640 });
  await oeffnen('Rechnung Fahrwerk');
  ok(await gemalt(1), 'Auch bei 360 px wird gemalt');
  for (const [sel, was] of [['#full .fbar [data-a="closeFull"]', 'Schließen'], ['#full .fbar [data-a="savePdf"]', 'Teilen'], ['#full .fbar [data-a="editDoc"]', 'Stift']])
    ok(await frei(page, sel), `Bei 360 px ist „${was}“ frei`);
  const b360 = await page.$eval('#pseiten canvas', c => c.getBoundingClientRect().width);
  ok(Math.abs(b360 - 344) < 1, `und die Seite passt sich der Breite an (${Math.round(b360)} px)`);
  await page.goBack();
  await page.waitForSelector('#full[hidden]', { state: 'attached' });

  ok(fremd.length === 0, 'Keine Anfrage an fremde Server' + (fremd.length ? ': ' + fremd.join(', ') : ''));

  // --- Offline: aus dem Vorab-Cache des Service Workers ---
  // Eigener Kontext, in dem PDF.js nie online geladen wurde. Sonst läge es
  // schon deshalb im Cache, weil der Service Worker jede abgerufene Datei
  // mitnimmt - und die Prüfung belegte nichts (so beim ersten Versuch
  // passiert: die Gegenprobe ohne Vorab-Eintrag blieb grün).
  const ctx2 = await browser.newContext({ viewport: { width: 412, height: 892 } });
  const zwei = await ctx2.newPage();
  const errors2 = [];
  watchErrors(zwei, errors2);
  const gescheitert = [];
  zwei.on('requestfailed', r => gescheitert.push(new URL(r.url()).pathname));
  await zwei.goto(base, { waitUntil: 'networkidle' });
  await zwei.click('[data-a="addVehicle"]');
  await zwei.fill('[name="name"]', 'Offline-Probe');
  await zwei.click('[data-a="ok"]');
  await zwei.waitForSelector('.head h2');
  await zwei.click('[data-a="tab"][data-k="doc"]');
  await zwei.click('[data-a="addDoc"]');
  await zwei.setInputFiles('#fPick', PDF);
  await zwei.waitForSelector('#fname:not(:empty)');
  await zwei.fill('[name="title"]', 'Offline-Rechnung');
  await zwei.click('[data-a="ok"]');
  await zwei.waitForFunction(() => !document.getElementById('sheet').classList.contains('open'));
  const vorab = await zwei.evaluate(async () => {
    if (!navigator.serviceWorker) return 'kein Service Worker';
    const reg = await navigator.serviceWorker.ready;
    if (!reg.active) return 'nicht aktiv';
    if (performance.getEntriesByType('resource').some(e => e.name.includes('vendor/pdfjs'))) return 'PDF.js wurde schon geladen';
    const name = (await caches.keys()).find(k => k.startsWith('carcollection-'));
    const c = await caches.open(name);
    return (await c.match('./vendor/pdfjs/pdf.min.js')) && (await c.match('./vendor/pdfjs/pdf.worker.min.js')) ? 'ok' : 'fehlt im Cache';
  });
  ok(vorab === 'ok', `Der Service Worker legt PDF.js schon bei der Installation ab (${vorab})`);
  await ctx2.setOffline(true);
  await zwei.reload({ waitUntil: 'load' }).catch(() => {});
  await zwei.waitForSelector('[data-a="open"], .karussell [data-id]', { timeout: 10000 }).catch(() => {});
  await zwei.evaluate(() => { const id = IDX[0]; garagePos = id; S = VEH[id]; view = 'vehicle'; tab = 'doc'; render(); });
  await zwei.locator('[data-a="openDoc"]', { hasText: 'Offline-Rechnung' }).click();
  const offline = await zwei.waitForFunction(() => document.querySelectorAll('#pseiten canvas[data-guete]').length >= 1, null, { timeout: 15000 }).then(() => true, () => false);
  ok(offline, 'Ohne Netz geht die PDF trotzdem auf');
  // Offline scheitert nur die Update-Abfrage version.json - die kommt mit
  // Absicht nie aus dem Cache (siehe sw.js), die App fängt das ab. Der
  // Browser meldet sie trotzdem in der Konsole; genau diese Meldungen zählen
  // hier nicht als Fehler der App.
  ok(gescheitert.every(u => u.endsWith('/version.json')), `Offline scheitert nur die Update-Abfrage (${[...new Set(gescheitert)].join(', ') || 'nichts'})`);
  const versionFehler = gescheitert.filter(u => u.endsWith('/version.json')).length;
  for (let i = 0; i < versionFehler; i++) {
    const k = errors2.indexOf('console: Failed to load resource: net::ERR_FAILED');
    if (k >= 0) errors2.splice(k, 1);
  }
  await ctx2.setOffline(false);
  await ctx2.close();

  ok(errors.length === 0 && errors2.length === 0, 'Keine JS-Fehler' + ([...errors, ...errors2].length ? ': ' + [...errors, ...errors2].join(' | ') : ''));
  await ctx.close();
}
