/* Titelbild: Ausschnitt einstellen (Fassung 33). Das Foto bleibt unverändert,
   am Fahrzeug liegt die Lage {x, y, z}. Gezogen und gezoomt wird mit selbst
   erzeugten Zeiger-Ereignissen - Touch-Gesten kommen im Testbrowser nicht an;
   die Ereignisse treffen dieselben Handler wie ein Finger. */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { png, watchErrors, frei } from './lib.mjs';

export const name = 'Titelbild';

export default async function ({ browser, base, ok }) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 892 } });
  const page = await ctx.newPage();
  const errors = [];
  watchErrors(page, errors);
  await page.goto(base, { waitUntil: 'networkidle' });

  // Breites Querformat (2:1) - genau der Fall, der in der hohen Garagen-Karte
  // nicht passte.
  const bildPfad = join(tmpdir(), 'titelbild-breit.png');
  writeFileSync(bildPfad, png(1200, 600, (x, y) => [(x * 255 / 1200) | 0, (y * 255 / 600) | 0, 120]));

  const ids = await page.evaluate(async () => {
    const out = [];
    for (const n of ['BMW E30', 'Porsche 944']) {
      const x = newVeh(); x.v.name = n; VEH[x.id] = x; IDX.push(x.id); S = x; await save(); out.push(x.id);
    }
    S = null; view = 'garage'; render(); A.open({ id: out[0] });
    return out;
  });
  await page.waitForSelector('.head h2');

  // Lage des Bildes in einem Rahmen, aus der gesetzten Darstellung gelesen.
  const geo = sel => page.evaluate(sel => {
    const el = document.querySelector(sel), L = el && el.querySelector(':scope>.bildlage');
    if (!L || !L.style.backgroundSize) return null;
    const [dw, dh] = L.style.backgroundSize.split(' ').map(parseFloat);
    const [x, y] = L.style.backgroundPosition.split(' ').map(parseFloat);
    return { dw, dh, x, y, W: el.clientWidth, H: el.clientHeight,
      mx: (el.clientWidth / 2 - x) / dw, my: (el.clientHeight / 2 - y) / dh };
  }, sel);
  const rahmen = () => page.evaluate(() => { const r = document.getElementById('aRahmen').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
  const zeiger = folge => page.evaluate(folge => {
    const ziel = document.getElementById('aRahmen');
    for (const [t, id, x, y] of folge)
      (t === 'pointerdown' ? ziel : window).dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: x, clientY: y, bubbles: true, isPrimary: id === 1, pointerType: 'touch' }));
  }, folge);
  const lage = () => page.evaluate(() => AS && { ...AS.lage });
  const maskeAuf = async () => { await page.click('[data-a="editVehicle"]'); await page.waitForSelector('#sheet.open #cbox'); };
  // Duldsam: Schließt der Ausschnitt nicht, wird das als Prüfung rot gemeldet,
  // statt die ganze Reihe in einen Zeitablauf laufen zu lassen.
  const aufZu = () => page.waitForFunction(() => document.getElementById('ausschnitt').hidden, null, { timeout: 5000 }).then(() => true, () => false);
  const sheetZu = () => page.waitForFunction(() => !document.getElementById('sheet').classList.contains('open'));

  // --- Foto wählen öffnet den Ausschnitt ---
  await maskeAuf();
  await page.setInputFiles('#coverIn', bildPfad);
  await page.waitForSelector('#ausschnitt:not([hidden]) #aRahmen');
  await page.waitForTimeout(150);
  let r = await rahmen();
  ok(r.h > r.w * 1.25, `Nach der Auswahl öffnet sich der Ausschnitt im Hochformat (${Math.round(r.w)} × ${Math.round(r.h)} px)`);
  ok(!!(await geo('#aVor')), 'Darunter steht die Vorschau für die Fahrzeugkarte');
  let L = await lage();
  ok(L.x === .5 && L.y === .5 && L.z === 1, 'Er beginnt in der Mitte, bildfüllend');

  // --- Ziehen ---
  const cx = r.l + r.w / 2, cy = r.t + r.h / 2;
  await zeiger([['pointerdown', 1, cx, cy], ['pointermove', 1, cx - 60, cy], ['pointermove', 1, cx - 120, cy], ['pointerup', 1, cx - 120, cy]]);
  L = await lage();
  ok(L.x > .55, `Nach links ziehen holt den rechten Bildteil in die Mitte (x ${L.x.toFixed(3)})`);
  await zeiger([['pointerdown', 1, cx, cy], ['pointermove', 1, cx + 3000, cy + 3000], ['pointerup', 1, cx + 3000, cy + 3000]]);
  let g = await geo('#aRahmen');
  ok(g.x <= 0.5 && g.x + g.dw >= g.W - 0.5 && g.y <= 0.5 && g.y + g.dh >= g.H - 0.5,
    'Weit über den Rand gezogen, deckt das Bild den Rahmen weiter (geklemmt)');

  // --- Zwei Finger: der Punkt zwischen den Fingern bleibt stehen ---
  await page.click('[data-a="ausReset"]');
  const ax = r.l + r.w * 0.35, ay = r.t + r.h * 0.45;
  g = await geo('#aRahmen');
  const vor = { u: (ax - r.l - g.x) / g.dw, v: (ay - r.t - g.y) / g.dh };
  await zeiger([['pointerdown', 1, ax - 30, ay], ['pointerdown', 2, ax + 30, ay],
    ['pointermove', 1, ax - 60, ay], ['pointermove', 2, ax + 60, ay],
    ['pointermove', 1, ax - 90, ay], ['pointermove', 2, ax + 90, ay],
    ['pointerup', 1, ax - 90, ay], ['pointerup', 2, ax + 90, ay]]);
  g = await geo('#aRahmen'); L = await lage();
  const nach = { u: (ax - r.l - g.x) / g.dw, v: (ay - r.t - g.y) / g.dh };
  ok(L.z > 2.5, `Auseinanderziehen zoomt hinein (z ${L.z.toFixed(2)})`);
  ok(Math.abs(nach.u - vor.u) < 0.01 && Math.abs(nach.v - vor.v) < 0.01,
    `Der Bildpunkt zwischen den Fingern bleibt stehen (${vor.u.toFixed(3)} → ${nach.u.toFixed(3)})`);

  // --- Ganz heraus: das ganze Bild, mit unscharfem Rand ---
  await zeiger([['pointerdown', 1, cx - 150, cy], ['pointerdown', 2, cx + 150, cy],
    ['pointermove', 1, cx - 5, cy], ['pointermove', 2, cx + 5, cy],
    ['pointerup', 1, cx - 5, cy], ['pointerup', 2, cx + 5, cy]]);
  g = await geo('#aRahmen');
  ok(g.dw <= g.W + 0.5 && g.dh <= g.H + 0.5 && Math.abs(g.dw - g.W) < 1,
    `Ganz herausgezoomt ist das ganze Bild im Rahmen (${Math.round(g.dw)} × ${Math.round(g.dh)} in ${g.W} × ${g.H})`);
  ok(await page.evaluate(() => {
    const el = document.getElementById('aRahmen'), b = getComputedStyle(el, '::before');
    return el.classList.contains('mitlage') && /blur/.test(b.backdropFilter || b.webkitBackdropFilter || '') && el.style.backgroundImage.startsWith('url(');
  }), 'Der freie Rand zeigt eine unscharfe Kopie des Bildes');

  // --- Eine bekannte Lage einstellen, übernehmen, speichern ---
  await page.click('[data-a="ausReset"]');
  await zeiger([['pointerdown', 1, cx, cy], ['pointermove', 1, cx - 60, cy], ['pointerup', 1, cx - 60, cy]]);
  const gewaehlt = await lage();
  await page.click('[data-a="ausOk"]');
  ok(await aufZu(), 'Übernehmen schließt den Ausschnitt');
  ok(await page.locator('#sheet.open').count() === 1, 'Übernehmen schließt nur den Ausschnitt, die Maske steht noch');
  ok(!!(await geo('#cbox')), 'Die Vorschau in der Maske zeigt den Ausschnitt');
  await page.click('[data-a="ok"]');
  await sheetZu();
  const gespeichert = await page.evaluate(() => S.coverLage);
  ok(gespeichert && Math.abs(gespeichert.x - gewaehlt.x) < 1e-9 && gespeichert.z === gewaehlt.z,
    `Gespeichert wird die eingestellte Lage (x ${gespeichert && gespeichert.x.toFixed(3)})`);
  await page.waitForFunction(() => { const b = document.getElementById('coverBox'); return b && b.querySelector('.bildlage'); });
  g = await geo('#coverBox');
  ok(Math.abs(g.mx - gewaehlt.x) < 0.01,
    `Die Fahrzeugkarte zeigt denselben Bildpunkt in der Mitte (${g.mx.toFixed(3)} statt ${gewaehlt.x.toFixed(3)})`);
  ok(g.dw >= g.W - 0.5 && g.dh >= g.H - 0.5, 'Und füllt ihren 4:3-Rahmen ohne Rand');

  // --- Garage: dieselbe Lage ---
  await page.goBack();
  await page.waitForSelector('#karussell');
  await page.waitForFunction(id => { const b = document.querySelector(`[data-cover="${id}"]`); return b && b.querySelector('.bildlage'); }, ids[0]);
  g = await geo(`[data-cover="${ids[0]}"]`);
  ok(Math.abs(g.mx - gewaehlt.x) < 0.01 && Math.abs(g.my - .5) < 0.01,
    `Die Garagen-Karte zeigt denselben Bildpunkt in der Mitte (${g.mx.toFixed(3)})`);

  // --- Nachträglich anpassen, ohne das Bild neu zu schreiben ---
  await page.click(`#karussell [data-id="${ids[0]}"]`);
  await page.waitForSelector('.head h2');
  const bildVorher = await page.evaluate(id => store.get('img:cover:' + id), ids[0]);
  await maskeAuf();
  // Der Knopf steht unten in der Maske - erst ins Bild holen, dann prüfen,
  // ob er wirklich zu treffen ist.
  await page.evaluate(() => document.getElementById('coverLageBtn').scrollIntoView({ block: 'center' }));
  ok(await frei(page, '#coverLageBtn'), 'In der Maske steht "Ausschnitt anpassen" bereit');
  await page.click('#coverLageBtn');
  await page.waitForSelector('#ausschnitt:not([hidden]) #aRahmen');
  L = await lage();
  ok(Math.abs(L.x - gewaehlt.x) < 1e-9, 'Der Ausschnitt öffnet mit der gespeicherten Lage');
  r = await rahmen();
  await zeiger([['pointerdown', 1, r.l + r.w / 2, r.t + r.h / 2], ['pointermove', 1, r.l + r.w / 2 + 80, r.t + r.h / 2], ['pointerup', 1, r.l + r.w / 2 + 80, r.t + r.h / 2]]);
  const neu = await lage();
  await page.click('[data-a="ausOk"]');
  await aufZu();
  await page.click('[data-a="ok"]');
  await sheetZu();
  const nachher = await page.evaluate(id => ({ lage: VEH[id].coverLage }), ids[0]);
  ok(Math.abs(nachher.lage.x - neu.x) < 1e-9 && neu.x < gewaehlt.x, 'Die neue Lage ist gespeichert');
  ok(await page.evaluate(id => store.get('img:cover:' + id), ids[0]) === bildVorher,
    'Das Bild selbst liegt unverändert im Speicher - nur die Lage hat sich geändert');

  // --- Zurück-Geste schließt nur den Ausschnitt; Abbrechen schreibt nichts ---
  await maskeAuf();
  await page.click('#coverLageBtn');
  await page.waitForSelector('#ausschnitt:not([hidden])');
  r = await rahmen();
  await zeiger([['pointerdown', 1, r.l + r.w / 2, r.t + r.h / 2], ['pointermove', 1, r.l + r.w / 2 - 90, r.t + r.h / 2], ['pointerup', 1, r.l + r.w / 2 - 90, r.t + r.h / 2]]);
  await page.goBack();
  ok(await aufZu() && await page.locator('#sheet.open').count() === 1, 'Die Zurück-Geste schließt nur den Ausschnitt, die Maske steht noch');
  await page.click('.panel .row [data-a="close"]');
  await sheetZu();
  ok(Math.abs(await page.evaluate(id => VEH[id].coverLage.x, ids[0]) - neu.x) < 1e-9,
    'Abbrechen der Maske lässt die gespeicherte Lage, wie sie war');

  // --- Ein Fahrzeug ohne gespeicherte Lage zeigt wie bisher die Mitte ---
  await page.evaluate(async ([id, d]) => { await store.set('img:cover:' + id, d); IMG['img:cover:' + id] = d; VEH[id].cover = true; delete VEH[id].coverLage; },
    [ids[1], await page.evaluate(id => store.get('img:cover:' + id), ids[0])]);
  await page.goBack();
  await page.waitForSelector('#karussell');
  await page.evaluate(id => A.open({ id }), ids[1]);
  await page.waitForFunction(() => { const b = document.getElementById('coverBox'); return b && b.querySelector('.bildlage'); });
  g = await geo('#coverBox');
  ok(Math.abs(g.mx - .5) < 0.01 && Math.abs(g.my - .5) < 0.01 && (Math.abs(g.dw - g.W) < 1 || Math.abs(g.dh - g.H) < 1),
    'Ein älteres Fahrzeug ohne Lage zeigt das Bild wie bisher bildfüllend aus der Mitte');

  // --- Sicherung ---
  const rund = await page.evaluate(async id => {
    // collectBackup legt die Fahrzeug-Objekte selbst in die Sicherung - also
    // erst zur Datei machen, wie es beim Speichern auch geschieht.
    const d = JSON.parse(JSON.stringify(await collectBackup())); const vorher = { ...VEH[id].coverLage };
    const inDatei = d.vehicles.find(x => x.id === id).coverLage;
    delete VEH[id].coverLage; await applyBackup(d, false);
    return { inDatei, vorher, danach: VEH[id].coverLage };
  }, ids[0]);
  ok(rund.inDatei && rund.inDatei.x === rund.vorher.x, 'Die Sicherung trägt die Lage des Titelbilds');
  ok(rund.danach && rund.danach.x === rund.vorher.x && rund.danach.z === rund.vorher.z, 'Einlesen bringt sie zurück');

  // --- Schmales Handy ---
  // Das Einlesen führt in die Garage - das Fahrzeug wieder öffnen.
  await page.evaluate(id => A.open({ id }), ids[0]);
  await page.waitForSelector('.head h2');
  await page.setViewportSize({ width: 360, height: 640 });
  await maskeAuf();
  await page.click('#coverLageBtn');
  await page.waitForSelector('#ausschnitt:not([hidden]) #aRahmen');
  await page.waitForTimeout(150);
  r = await rahmen();
  ok(r.l >= 0 && r.t >= 0 && r.l + r.w <= 360 && r.t + r.h <= 640, `Bei 360 × 640 passt der Rahmen ins Fenster (${Math.round(r.w)} × ${Math.round(r.h)})`);
  ok(await frei(page, '[data-a="ausOk"]') && await frei(page, '[data-a="ausZu"]') && await frei(page, '[data-a="ausReset"]'),
    'Übernehmen, Abbrechen und Zurücksetzen sind frei');
  await page.click('[data-a="ausZu"]');
  await aufZu();

  ok(errors.length === 0, `Keine JS-Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}
