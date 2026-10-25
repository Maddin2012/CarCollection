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
  ok(g.dw <= g.W + 0.5 && g.dh <= g.H + 0.5,
    `Ganz herausgezoomt ist das ganze Bild im Rahmen (${Math.round(g.dw)} × ${Math.round(g.dh)} in ${g.W} × ${g.H})`);
  // Bis zur Hälfte von "ganzes Bild" - kleiner nicht, sonst bleibt nur Rand.
  ok(Math.abs(g.dw - g.W / 2) < 1,
    `Herauszoomen geht bis zur halben Breite des Rahmens, nicht weiter (${Math.round(g.dw)} von ${g.W} px)`);
  ok(await page.evaluate(() => {
    const el = document.getElementById('aRahmen'), b = getComputedStyle(el, '::before');
    return el.classList.contains('mitlage') && /blur/.test(b.backdropFilter || b.webkitBackdropFilter || '') && el.style.backgroundImage.startsWith('url(');
  }), 'Der freie Rand zeigt eine unscharfe Kopie des Bildes');

  // Seit Fassung 34 wird der gewählte Bildbereich gespeichert: der Teil des
  // Fotos, der im Rahmen zu sehen war. Jeder Rahmen muss ihn vollständig
  // zeigen - auf der Fahrzeugkarte über dem Namen (untere 15 % frei).
  const bereich = g => ({ x0: Math.max(0, -g.x / g.dw), y0: Math.max(0, -g.y / g.dh),
    x1: Math.min(1, (g.W - g.x) / g.dw), y1: Math.min(1, (g.H - g.y) / g.dh) });
  const gleich = (a, b) => ['x0', 'y0', 'x1', 'y1'].every(k => Math.abs(a[k] - b[k]) < 0.01);
  const drin = (g, b, unten = 0) => g.x + b.x0 * g.dw >= -0.5 && g.x + b.x1 * g.dw <= g.W + 0.5
    && g.y + b.y0 * g.dh >= -0.5 && g.y + b.y1 * g.dh <= g.H * (1 - unten) + 0.5;
  const zeig = b => `${b.x0.toFixed(2)}–${b.x1.toFixed(2)} × ${b.y0.toFixed(2)}–${b.y1.toFixed(2)}`;

  // --- Einen Ausschnitt einstellen, übernehmen, speichern ---
  await page.click('[data-a="ausReset"]');
  await zeiger([['pointerdown', 1, cx, cy], ['pointermove', 1, cx - 60, cy], ['pointerup', 1, cx - 60, cy]]);
  const gewaehlt = bereich(await geo('#aRahmen'));
  ok(drin(await geo('#aVor'), gewaehlt, 0.15), `Die Vorschau zeigt den gewählten Bereich ganz (${zeig(gewaehlt)})`);
  await page.click('[data-a="ausOk"]');
  ok(await aufZu(), 'Übernehmen schließt den Ausschnitt');
  ok(await page.locator('#sheet.open').count() === 1, 'Übernehmen schließt nur den Ausschnitt, die Maske steht noch');
  ok(!!(await geo('#cbox')), 'Die Vorschau in der Maske zeigt den Ausschnitt');
  await page.click('[data-a="ok"]');
  await sheetZu();
  const gespeichert = await page.evaluate(() => S.coverLage);
  ok(gespeichert && typeof gespeichert.x0 === 'number' && gleich(gespeichert, gewaehlt),
    `Gespeichert wird genau der gewählte Bereich (${gespeichert && typeof gespeichert.x0 === 'number' ? zeig(gespeichert) : JSON.stringify(gespeichert)})`);
  await page.waitForFunction(() => { const b = document.getElementById('coverBox'); return b && b.querySelector('.bildlage'); });
  g = await geo('#coverBox');
  ok(drin(g, gewaehlt, 0.15), 'Die Fahrzeugkarte zeigt den gewählten Bereich ganz, über dem Namen');

  // --- Garage: genau wie im Ausschnitt ---
  await page.goBack();
  await page.waitForSelector('#karussell');
  await page.waitForFunction(id => { const b = document.querySelector(`[data-cover="${id}"]`); return b && b.querySelector('.bildlage'); }, ids[0]);
  g = await geo(`[data-cover="${ids[0]}"]`);
  ok(gleich(bereich(g), gewaehlt), `Die Garagen-Karte zeigt genau den gewählten Bereich (${zeig(bereich(g))})`);

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
  ok(gleich(bereich(await geo('#aRahmen')), gewaehlt), 'Der Ausschnitt öffnet mit dem gespeicherten Bereich');
  r = await rahmen();
  await zeiger([['pointerdown', 1, r.l + r.w / 2, r.t + r.h / 2], ['pointermove', 1, r.l + r.w / 2 + 80, r.t + r.h / 2], ['pointerup', 1, r.l + r.w / 2 + 80, r.t + r.h / 2]]);
  const neu = bereich(await geo('#aRahmen'));
  await page.click('[data-a="ausOk"]');
  await aufZu();
  await page.click('[data-a="ok"]');
  await sheetZu();
  const nachher = await page.evaluate(id => VEH[id].coverLage, ids[0]);
  ok(gleich(nachher, neu) && neu.x0 < gewaehlt.x0, `Der neue Bereich ist gespeichert (${zeig(nachher)})`);
  ok(await page.evaluate(id => store.get('img:cover:' + id), ids[0]) === bildVorher,
    'Das Bild selbst liegt unverändert im Speicher - nur der Ausschnitt hat sich geändert');

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
  ok(gleich(await page.evaluate(id => VEH[id].coverLage, ids[0]), neu),
    'Abbrechen der Maske lässt den gespeicherten Bereich, wie er war');

  // --- Gemeldet am Pixel: Hochkant-Foto, ganz herausgezoomt ---
  // Die Fahrzeugkarte schnitt es unten ab, und in der Garage lag das Auto
  // unter Name und Kennzeichen. Das Foto bekommt unten einen roten Streifen
  // ("die Räder"); der muss überall ganz und frei zu sehen sein.
  const hochPfad = join(tmpdir(), 'titelbild-hoch.png');
  writeFileSync(hochPfad, png(900, 1200, (x, y) => y > 1080 ? [220, 30, 30] : y > 700 ? [235, 235, 235] : [120, 130, 140]));
  await maskeAuf();
  await page.setInputFiles('#coverIn', hochPfad);
  await page.waitForSelector('#ausschnitt:not([hidden]) #aRahmen');
  await page.waitForTimeout(150);
  ok(await page.evaluate(() => { const f = document.querySelector('#aRahmen .fuss'); return !!f && f.textContent.includes('BMW E30'); }),
    'Der Ausschnitt zeigt Name und Kennzeichen dort, wo sie in der Garage stehen');
  r = await rahmen();
  await zeiger([['pointerdown', 1, r.l + r.w / 2 - 150, r.t + r.h / 2], ['pointerdown', 2, r.l + r.w / 2 + 150, r.t + r.h / 2],
    ['pointermove', 1, r.l + r.w / 2 - 5, r.t + r.h / 2], ['pointermove', 2, r.l + r.w / 2 + 5, r.t + r.h / 2],
    ['pointerup', 1, r.l + r.w / 2 - 5, r.t + r.h / 2], ['pointerup', 2, r.l + r.w / 2 + 5, r.t + r.h / 2]]);
  const ganz = bereich(await geo('#aRahmen'));
  ok(gleich(ganz, { x0: 0, y0: 0, x1: 1, y1: 1 }), `Ganz herausgezoomt ist das ganze Foto gewählt (${zeig(ganz)})`);
  ok(drin(await geo('#aVor'), ganz, 0.15), 'Die Vorschau der Fahrzeugkarte zeigt das ganze Foto');
  // Herausgezoomt muss es sich trotzdem verschieben lassen - sonst bliebe das
  // Auto unter dem Namen, und man könnte nichts dagegen tun.
  const fussOben = sel => page.evaluate(sel => { const el = document.querySelector(sel), f = el.closest('.card, .arahmen').querySelector('.fuss');
    return f.getBoundingClientRect().top - el.getBoundingClientRect().top; }, sel);
  await zeiger([['pointerdown', 1, r.l + r.w / 2, r.t + r.h / 2], ['pointermove', 1, r.l + r.w / 2, r.t + r.h / 2 - 150],
    ['pointermove', 1, r.l + r.w / 2, r.t + r.h / 2 - 400], ['pointerup', 1, r.l + r.w / 2, r.t + r.h / 2 - 400]]);
  g = await geo('#aRahmen');
  const fA = await fussOben('#aRahmen');
  ok(g.y + g.dh <= fA + 1 && g.y >= -0.5, `Herausgezoomt lässt sich das Foto über den Namen schieben (Unterkante ${Math.round(g.y + g.dh)}, Name ab ${Math.round(fA)} px)`);
  // ... und zwar bis ganz an den oberen Rand, nicht nur ein Stück.
  ok(Math.abs(g.y) < 1, `Hochgezogen liegt das kleine Foto oben am Rand an (Oberkante ${g.y.toFixed(1)} px)`);
  const obenAnteil = { y: g.y / g.H, dh: g.dh / g.H };
  await page.click('[data-a="ausOk"]');
  await aufZu();
  await page.click('[data-a="ok"]');
  await sheetZu();
  await page.waitForFunction(() => { const b = document.getElementById('coverBox'); return b && b.querySelector('.bildlage'); });
  g = await geo('#coverBox');
  ok(drin(g, ganz, 0.15), `Die Fahrzeugkarte zeigt das ganze Foto, unten frei über dem Namen (Unterkante ${Math.round(g.y + g.dh)} von ${g.H} px)`);
  await page.goBack();
  await page.waitForSelector('#karussell');
  await page.waitForFunction(id => { const b = document.querySelector(`[data-cover="${id}"]`); return b && b.querySelector('.bildlage'); }, ids[0]);
  g = await geo(`[data-cover="${ids[0]}"]`);
  ok(drin(g, ganz), 'Die Garagen-Karte zeigt das ganze Foto');
  const fG = await fussOben(`[data-cover="${ids[0]}"]`);
  ok(Math.abs(g.y / g.H - obenAnteil.y) < 0.01 && Math.abs(g.dh / g.H - obenAnteil.dh) < 0.01 && g.y + g.dh <= fG + 1,
    `Und genau an der Stelle wie im Ausschnitt, über dem Namen (Unterkante ${Math.round(g.y + g.dh)}, Name ab ${Math.round(fG)} px)`);
  await page.click(`#karussell [data-id="${ids[0]}"]`);
  await page.waitForSelector('.head h2');

  // --- Auch ungewöhnliche Formate: Garage zeigt genau, was der Ausschnitt zeigte ---
  // Ganz klein gezoomt und in eine Ecke geschoben, nachgerechnet mit den
  // Funktionen der App: Rahmen -> gespeicherter Bereich -> Garage.
  const abweichung = await page.evaluate(() => {
    const W = 361, H = 630, aus = [];
    for (const [w, h] of [[900, 1200], [1200, 600], [4000, 500], [500, 4000]])
      for (const [ex, ey] of [[0, 0], [1, 1], [0, 1]]) {
        const g0 = lageRechnen(w, h, W, H, { x: .5, y: .5, z: .01 }, true);
        const x = ex ? W - g0.dw : 0, y = ey ? H - g0.dh : 0;
        const g = lageRechnen(w, h, W, H, { x: (W / 2 - x) / g0.dw, y: (H / 2 - y) / g0.dh, z: g0.s / g0.cover }, true);
        const b = JSON.parse(JSON.stringify(bereichAus(g, W, H)));
        const n = lageGeo(w, h, W, H, b, true, 0);
        aus.push(Math.max(Math.abs(n.x - g.x), Math.abs(n.y - g.y), Math.abs(n.dw - g.dw)));
      }
    return Math.max(...aus);
  });
  ok(abweichung < 0.5, `Auch Panorama und hohe Streifen stehen in der Garage genau wie im Ausschnitt (größte Abweichung ${abweichung.toFixed(2)} px)`);

  // --- Eine Lage aus Fassung 33 ({x,y,z}) wird weiter wie damals gezeigt ---
  await page.evaluate(id => { VEH[id].coverLage = { x: .5, y: .5, z: 1 }; render(); }, ids[0]);
  await page.waitForFunction(() => { const b = document.getElementById('coverBox'); return b && b.querySelector('.bildlage'); });
  g = await geo('#coverBox');
  ok(Math.abs(g.mx - .5) < 0.01 && (Math.abs(g.dw - g.W) < 1 || Math.abs(g.dh - g.H) < 1),
    'Eine Lage aus Fassung 33 wird weiter bildfüllend aus der Mitte gezeigt');
  await page.evaluate(id => { VEH[id].coverLage = { x0: 0, y0: 0, x1: 1, y1: 1 }; }, ids[0]);

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
  ok(rund.inDatei && gleich(rund.inDatei, rund.vorher), 'Die Sicherung trägt den Ausschnitt des Titelbilds');
  ok(rund.danach && gleich(rund.danach, rund.vorher), 'Einlesen bringt ihn zurück');

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
