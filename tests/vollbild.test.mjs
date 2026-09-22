/* Vergrößern und Schieben in der Vollbildanzeige.

   Zwei Finger lassen sich mit selbst erzeugten PointerEvents nachstellen -
   geprüft ist damit die Rechnung, nicht das Gefühl. Genau deshalb kommt die
   Geste ohne setPointerCapture aus: Das verlangt einen echten Zeiger. */
import { watchErrors, png, frei } from './lib.mjs';

export const name = 'Vollbild';

// Hochkant und quer, damit sich das Einpassen nicht in einer Richtung
// zufällig richtig ausgeht. Ecken farbig markiert, um sie wiederzufinden.
const marke = (w, h) => (x, y) =>
  (x < w * 0.1 && y < h * 0.1) ? [0, 255, 0]
    : (x > w * 0.9 && y > h * 0.9) ? [255, 0, 0]
      : [245, 245, 245];
const HOCH = { name: 'schein.png', mimeType: 'image/png', buffer: png(900, 1400, marke(900, 1400)) };
const QUER = { name: 'quer.png', mimeType: 'image/png', buffer: png(1600, 900, marke(1600, 900)) };

// Zwei Finger nachstellen. Die App hört auf pointerdown am Dokument und auf
// pointermove/-up am Fenster - genau so wird hier gesendet. Wichtig: Das
// pointerdown geht an das Element, das an der Stelle wirklich liegt. Schickt
// man es stur an .fimg, sieht die App nie das Bild als Ziel und kann einen
// Tipp darauf nicht von einem daneben unterscheiden.
const geste = (page, schritte) => page.evaluate(s => {
  const senden = (typ, id, x, y) => {
    const e = new PointerEvent(typ, { pointerId: id, clientX: x, clientY: y,
      bubbles: true, cancelable: true, pointerType: 'touch' });
    const ziel = typ === 'pointerdown'
      ? (document.elementFromPoint(x, y) || document.querySelector('.fimg'))
      : window;
    ziel.dispatchEvent(e);
  };
  for (const [typ, id, x, y] of s) senden(typ, id, x, y);
}, schritte);

const stand = page => page.evaluate(() => V && ({
  s: +V.s.toFixed(4), x: Math.round(V.x), y: Math.round(V.y),
  breite: V.bild.offsetWidth, hoehe: V.bild.offsetHeight
}));

const ecke = page => page.evaluate(() => {
  const r = document.querySelector('.fimg img').getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top),
           w: Math.round(r.width), h: Math.round(r.height) };
});

const anlegenMit = async (page, datei) => {
  await page.click('[data-a="addVehicle"]');
  await page.fill('[name="name"]', 'VW Golf');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.head h2');
  await page.click('[data-a="tab"][data-k="doc"]');
  await page.waitForSelector('[data-a="addDoc"]');
  await page.click('[data-a="addDoc"]');
  await page.setInputFiles('#fPick', datei);
  await page.waitForSelector('[data-a="editUeber"]');
  await page.click('[data-a="editUeber"]');
  await page.waitForSelector('[data-a="editSpeichern"]');
  await page.click('[data-a="editSpeichern"]');
  await page.waitForSelector('#edit[hidden]', { state: 'attached' });
  await page.fill('[name="title"]', 'Fahrzeugschein');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.item');
};

const oeffnen = async page => {
  await page.click('[data-a="openDoc"]');
  await page.waitForSelector('#full:not([hidden])');
  await page.waitForFunction(() => V && V.bild.offsetWidth > 1);
};

export default async function ({ browser, base, ok }) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await ctx.newPage();
  const errors = [];
  watchErrors(page, errors);
  await page.goto(base, { waitUntil: 'networkidle' });

  await anlegenMit(page, HOCH);
  await oeffnen(page);

  // ------------------------------------------------------------- Einpassen
  // Das Element muss sich mit dem sichtbaren Bild decken - nur dann trifft ein
  // Tipp daneben die Fläche und nicht das Bild, und nur dann stimmen die
  // Grenzen fürs Schieben. Die alte Prüfung maß das Element, das wegen
  // width/height:100% immer die ganze Fläche einnahm: grün ohne Aussage.
  for (const [b, h] of [[412, 915], [1280, 720], [900, 500]]) {
    await page.setViewportSize({ width: b, height: h });
    await page.waitForTimeout(150);
    const m = await page.evaluate(() => {
      const f = document.querySelector('.fimg'), i = f.querySelector('img');
      const cs = getComputedStyle(f), r = f.getBoundingClientRect();
      const fw = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const fh = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const ir = i.getBoundingClientRect();
      return { fw, fh, iw: ir.width, ih: ir.height,
               verh: i.naturalWidth / i.naturalHeight };
    });
    ok(m.iw <= m.fw + 1 && m.ih <= m.fh + 1,
      `Bei ${b}x${h} bleibt das Bild in der Fläche (${Math.round(m.iw)}x${Math.round(m.ih)} in ${Math.round(m.fw)}x${Math.round(m.fh)})`);
    ok(m.iw >= m.fw - 1 || m.ih >= m.fh - 1,
      `Bei ${b}x${h} füllt es sie in mindestens einer Richtung aus`);
    ok(Math.abs(m.iw / m.ih - m.verh) < 0.02,
      `Bei ${b}x${h} bleibt das Seitenverhältnis erhalten`);
  }
  await page.setViewportSize({ width: 412, height: 915 });
  await page.waitForTimeout(150);

  // ------------------------------------------------------------ Aufziehen
  ok((await stand(page)).s === 1, 'Frisch geöffnet ist der Maßstab 1');
  const vorEcke = await ecke(page);
  // Zwei Finger, die von der Bildmitte aus auseinandergehen.
  const mitte = { x: vorEcke.x + vorEcke.w / 2, y: vorEcke.y + vorEcke.h / 2 };
  await geste(page, [
    ['pointerdown', 1, mitte.x - 50, mitte.y], ['pointerdown', 2, mitte.x + 50, mitte.y],
    ['pointermove', 1, mitte.x - 100, mitte.y], ['pointermove', 2, mitte.x + 100, mitte.y],
    ['pointerup', 1, mitte.x - 100, mitte.y], ['pointerup', 2, mitte.x + 100, mitte.y]
  ]);
  const auf = await stand(page);
  ok(Math.abs(auf.s - 2) < 0.05, `Doppelter Fingerabstand ergibt Maßstab 2 (${auf.s})`);
  const nachEcke = await ecke(page);
  ok(Math.abs(nachEcke.w / vorEcke.w - 2) < 0.05,
    `Das Bild ist sichtbar doppelt so breit (${vorEcke.w} → ${nachEcke.w})`);

  // --- Um die Mitte gezogen bleibt die Mitte stehen ---
  const neueMitte = { x: nachEcke.x + nachEcke.w / 2, y: nachEcke.y + nachEcke.h / 2 };
  ok(Math.abs(neueMitte.x - mitte.x) < 3 && Math.abs(neueMitte.y - mitte.y) < 3,
    `Um die Mitte gezogen bleibt die Mitte stehen (${Math.round(neueMitte.x)},${Math.round(neueMitte.y)} statt ${Math.round(mitte.x)},${Math.round(mitte.y)})`);

  // --- Und zwar um den Punkt zwischen den Fingern, nicht um die Bildmitte ---
  // Zieht man symmetrisch um die Mitte auf, sind beide Verhalten nicht zu
  // unterscheiden - die Prüfung oben allein belegt also nichts. Deshalb hier
  // ausdrücklich abseits der Mitte: Dieselbe Stelle des Bildes muss danach
  // wieder unter dem Fingerpunkt liegen.
  await page.evaluate(() => { V.s = 1; V.x = 0; V.y = 0; vollAnwenden(); });
  const basis = await ecke(page);
  const anker = { x: basis.x + basis.w * 0.25, y: basis.y + basis.h * 0.25 };
  const anteilVor = { x: (anker.x - basis.x) / basis.w, y: (anker.y - basis.y) / basis.h };
  await geste(page, [
    ['pointerdown', 60, anker.x - 40, anker.y], ['pointerdown', 61, anker.x + 40, anker.y],
    ['pointermove', 60, anker.x - 80, anker.y], ['pointermove', 61, anker.x + 80, anker.y],
    ['pointerup', 60, anker.x - 80, anker.y], ['pointerup', 61, anker.x + 80, anker.y]
  ]);
  const danach = await ecke(page);
  const anteilNach = { x: (anker.x - danach.x) / danach.w, y: (anker.y - danach.y) / danach.h };
  ok(Math.abs(anteilNach.x - anteilVor.x) < 0.02 && Math.abs(anteilNach.y - anteilVor.y) < 0.02,
    `Dieselbe Stelle liegt weiter unter den Fingern (${anteilVor.x.toFixed(3)}/${anteilVor.y.toFixed(3)} → ${anteilNach.x.toFixed(3)}/${anteilNach.y.toFixed(3)})`);

  // Zurück auf den Stand, den die folgenden Prüfungen erwarten.
  await page.evaluate(() => { V.s = 2; V.x = 0; V.y = 0; vollAnwenden(); });

  // ------------------------------------------------------------- Schieben
  const vorSchieben = await ecke(page);
  await geste(page, [
    ['pointerdown', 3, mitte.x, mitte.y],
    ['pointermove', 3, mitte.x - 60, mitte.y],
    ['pointerup', 3, mitte.x - 60, mitte.y]
  ]);
  const nachSchieben = await ecke(page);
  ok(nachSchieben.x < vorSchieben.x - 30,
    `Im vergrößerten Bild lässt es sich schieben (${vorSchieben.x} → ${nachSchieben.x})`);
  ok(await page.locator('#full:not([hidden])').count() === 1,
    'Ein Schieben schließt die Anzeige nicht');

  // --- Über den Rand hinaus geht es nicht ---
  for (let i = 0; i < 6; i++) {
    await geste(page, [
      ['pointerdown', 10 + i, mitte.x, mitte.y],
      ['pointermove', 10 + i, mitte.x - 400, mitte.y - 400],
      ['pointerup', 10 + i, mitte.x - 400, mitte.y - 400]
    ]);
  }
  const grenze = await page.evaluate(() => {
    const f = document.querySelector('.fimg'), i = f.querySelector('img');
    const cs = getComputedStyle(f), r = f.getBoundingClientRect();
    const fw = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const fh = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const ir = i.getBoundingClientRect();
    return { links: ir.left, oben: ir.top, rechts: ir.right, unten: ir.bottom,
             fl: r.left + parseFloat(cs.paddingLeft), fo: r.top + parseFloat(cs.paddingTop),
             fr: r.right - parseFloat(cs.paddingRight), fu: r.bottom - parseFloat(cs.paddingBottom),
             fw, fh, iw: ir.width, ih: ir.height };
  });
  // Das Bild ist größer als die Fläche - dann darf nirgends ein Rand aufreißen.
  ok(grenze.iw > grenze.fw && grenze.links <= grenze.fl + 1 && grenze.rechts >= grenze.fr - 1,
    'Waagerecht bleibt kein Rand frei, egal wie weit man schiebt');
  ok(grenze.ih <= grenze.fh + 1 || (grenze.oben <= grenze.fo + 1 && grenze.unten >= grenze.fu - 1),
    'Senkrecht ebenso');

  // ------------------------------------------------------------- Zuziehen
  await geste(page, [
    ['pointerdown', 20, mitte.x - 100, mitte.y], ['pointerdown', 21, mitte.x + 100, mitte.y],
    ['pointermove', 20, mitte.x - 10, mitte.y], ['pointermove', 21, mitte.x + 10, mitte.y],
    ['pointerup', 20, mitte.x - 10, mitte.y], ['pointerup', 21, mitte.x + 10, mitte.y]
  ]);
  const zu = await stand(page);
  ok(zu.s === 1, `Zuziehen führt zurück auf Maßstab 1 (${zu.s})`);
  ok(zu.x === 0 && zu.y === 0, 'Und das Bild steht wieder mittig');

  // --- Unter 1 und über 6 geht es nicht ---
  await geste(page, [
    ['pointerdown', 30, mitte.x - 100, mitte.y], ['pointerdown', 31, mitte.x + 100, mitte.y],
    ['pointermove', 30, mitte.x - 2, mitte.y], ['pointermove', 31, mitte.x + 2, mitte.y],
    ['pointerup', 30, mitte.x - 2, mitte.y], ['pointerup', 31, mitte.x + 2, mitte.y]
  ]);
  ok((await stand(page)).s === 1, 'Unter Maßstab 1 geht es nicht');
  await geste(page, [
    ['pointerdown', 40, mitte.x - 10, mitte.y], ['pointerdown', 41, mitte.x + 10, mitte.y],
    ['pointermove', 40, mitte.x - 900, mitte.y], ['pointermove', 41, mitte.x + 900, mitte.y],
    ['pointerup', 40, mitte.x - 900, mitte.y], ['pointerup', 41, mitte.x + 900, mitte.y]
  ]);
  ok((await stand(page)).s === 6, `Über Maßstab 6 auch nicht (${(await stand(page)).s})`);

  // ------------------------------------------------------- Tippen und Schließen
  // Bei Maßstab 6 füllt das Bild die Fläche; erst zurück auf 1, damit daneben
  // überhaupt Platz ist.
  await page.evaluate(() => { V.s = 1; V.x = 0; V.y = 0; vollAnwenden(); });
  const b = await ecke(page);
  ok(await page.locator('#full:not([hidden])').count() === 1, 'Die Anzeige steht noch offen');

  // --- Ein Tipp auf das Bild schließt nicht ---
  await geste(page, [
    ['pointerdown', 50, b.x + b.w / 2, b.y + b.h / 2],
    ['pointerup', 50, b.x + b.w / 2, b.y + b.h / 2]
  ]);
  ok(await page.locator('#full:not([hidden])').count() === 1,
    'Ein Tipp auf das Bild schließt nicht');

  // --- Ein Tipp daneben schon ---
  const daneben = await page.evaluate(() => {
    const f = document.querySelector('.fimg').getBoundingClientRect();
    const i = document.querySelector('.fimg img').getBoundingClientRect();
    // Links oder oben neben dem Bild, je nachdem wo Platz ist
    return (i.left - f.left > 12) ? { x: f.left + 5, y: f.top + f.height / 2 }
                                  : { x: f.left + f.width / 2, y: f.top + 3 };
  });
  await geste(page, [
    ['pointerdown', 51, daneben.x, daneben.y],
    ['pointerup', 51, daneben.x, daneben.y]
  ]);
  await page.waitForSelector('#full[hidden]', { state: 'attached' });
  ok(await page.locator('#full[hidden]').count() === 1,
    'Ein Tipp neben dem Bild schließt');

  // --- Erneut geöffnet ist der Maßstab wieder 1 ---
  await oeffnen(page);
  ok((await stand(page)).s === 1, 'Erneut geöffnet steht der Maßstab wieder auf 1');

  // --- Mausrad vergrößert ---
  const m2 = await ecke(page);
  await page.mouse.move(m2.x + m2.w / 2, m2.y + m2.h / 2);
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(80);
  ok((await stand(page)).s > 1, `Das Mausrad vergrößert (${(await stand(page)).s})`);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(80);
  ok((await stand(page)).s === 1, 'Und zurück');

  // --- Der Schließen-Knopf ist frei und schließt ---
  ok(await frei(page, '.fbar [data-a="closeFull"]'), 'Der Schließen-Knopf liegt frei');
  await page.click('.fbar [data-a="closeFull"]');
  await page.waitForSelector('#full[hidden]', { state: 'attached' });
  ok(await page.locator('.item').count() === 1, 'Schließen löscht das Dokument nicht');

  // ------------------------------------------------- Auch ein Querformat passt
  await page.click('[data-a="addDoc"]');
  await page.setInputFiles('#fPick', QUER);
  await page.waitForSelector('[data-a="editUeber"]');
  await page.click('[data-a="editUeber"]');
  await page.waitForSelector('[data-a="editSpeichern"]');
  await page.click('[data-a="editSpeichern"]');
  await page.waitForSelector('#edit[hidden]', { state: 'attached' });
  await page.fill('[name="title"]', 'Querformat');
  await page.click('[data-a="ok"]');
  await page.waitForFunction(() => document.querySelectorAll('.item').length === 2);
  await page.click('.item:last-of-type [data-a="openDoc"], [data-a="openDoc"]');
  await page.waitForSelector('#full:not([hidden])');
  await page.waitForFunction(() => V && V.bild.offsetWidth > 1);
  const q = await page.evaluate(() => {
    const f = document.querySelector('.fimg'), i = f.querySelector('img');
    const cs = getComputedStyle(f), r = f.getBoundingClientRect();
    const fw = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const fh = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const ir = i.getBoundingClientRect();
    return { fw, fh, iw: ir.width, ih: ir.height, verh: i.naturalWidth / i.naturalHeight };
  });
  ok(q.iw <= q.fw + 1 && q.ih <= q.fh + 1, 'Auch ein Querformat bleibt in der Fläche');
  ok(q.iw >= q.fw - 1 || q.ih >= q.fh - 1, 'Und füllt sie in einer Richtung aus');
  ok(Math.abs(q.iw / q.ih - q.verh) < 0.02, 'Das Seitenverhältnis stimmt auch dort');

  await page.goBack();
  await page.waitForSelector('#full[hidden]', { state: 'attached' });
  ok(await page.locator('#full[hidden]').count() === 1, 'Die Zurück-Geste schließt weiterhin');

  ok(errors.length === 0, `Keine JS-Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}
