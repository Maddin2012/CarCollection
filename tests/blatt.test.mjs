/* Das Blatt nach unten wegziehen.

   Die Geste wird mit selbst erzeugten PointerEvents nachgestellt - dasselbe
   Vorgehen wie in vollbild.test.mjs: pointerdown an das Element, das an der
   Stelle wirklich liegt, pointermove und pointerup ans Fenster. Genau so hört
   die App zu, und nur so kommt die Geste ohne setPointerCapture aus.

   Zwei Dinge sind hier wichtiger, als sie aussehen:

   - Geprüft wird nicht nur, DASS das Blatt zugeht, sondern wohin EIN Zurück
     danach führt. Ein closeSheet() statt dismissModal() schlösse das Blatt
     genauso und ließe einen toten History-Eintrag stehen.
   - Die Prüfung auf overscroll-behavior belegt die Regel, nicht das Verhalten
     von Chrome auf dem Gerät. Ob dort das Pull-to-Refresh wirklich ausbleibt,
     lässt sich von hier aus nicht messen. */
import { watchErrors, frei } from './lib.mjs';

export const name = 'Blatt ziehen';

// Ein Zug über dem Griff (oder einem anderen Punkt) in Schritten, damit die
// App die Bewegung sieht und nicht nur Anfang und Ende.
const ziehen = (page, von, dy, { schritte = 6, halten = false } = {}) =>
  page.evaluate(({ von, dy, schritte, halten }) => {
    const senden = (typ, x, y, ziel) => {
      const e = new PointerEvent(typ, { pointerId: 7, clientX: x, clientY: y,
        bubbles: true, cancelable: true, pointerType: 'touch' });
      (ziel || window).dispatchEvent(e);
    };
    const el = document.querySelector(von);
    // Fehlt das Element, passiert nichts. Sonst risse eine Gegenprobe die
    // ganze Reihe ab, statt die Prüfung rot zu machen, um die es geht.
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
    senden('pointerdown', x, y, document.elementFromPoint(x, y) || el);
    for (let i = 1; i <= schritte; i++) senden('pointermove', x, y + Math.round(dy * i / schritte));
    if (!halten) senden('pointerup', x, y + dy);
    return true;
  }, { von, dy, schritte, halten });

const offen = page => page.evaluate(
  () => document.getElementById('sheet').classList.contains('open'));
const schub = page => page.evaluate(() => {
  const p = document.querySelector('.panel');
  return p ? (p.style.transform || '') : null;
});

export default async function ({ browser, base, ok }) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  watchErrors(page, errors);
  await page.goto(base, { waitUntil: 'networkidle' });

  const reiter = async k => {
    await page.click(`[data-a="tab"][data-k="${k}"]`);
    await page.waitForTimeout(80);
  };
  const zu = () => page.waitForFunction(
    () => !document.getElementById('sheet').classList.contains('open'), null, { timeout: 10000 });

  // --- Die Regel gegen das Neuladen ---
  // Beide Stellen: html, damit eine durchgelaufene Geste kein Neuladen
  // auslöst, und .panel, damit sie gar nicht erst durchläuft.
  ok(await page.evaluate(
    () => getComputedStyle(document.documentElement).overscrollBehaviorY) === 'contain',
    'Das Dokument reicht einen Überzug nicht weiter (kein Pull-to-Refresh)');

  // --- Fahrzeug und ein Scheckheft-Eintrag ---
  await page.click('[data-a="addVehicle"]');
  await page.fill('[name="name"]', 'VW Golf');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.head h2');

  await reiter('log');
  await page.click('[data-a="addLog"]');
  await page.fill('[name="title"]', 'Zahnriemen gewechselt');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.item');

  await page.click('.item');
  await page.waitForSelector('.shead [data-a="editLog"]');
  ok(await page.evaluate(
    () => getComputedStyle(document.querySelector('.panel')).overscrollBehaviorY) === 'contain',
    'Und das Blatt selbst auch nicht');

  // --- Der Griff ist zu treffen ---
  const griff = await page.locator('.grab').boundingBox();
  ok(griff.height >= 24, `Der Griff ist mindestens 24 px hoch (${Math.round(griff.height)} px)`);
  ok(await frei(page, '.grab'), 'Und er ist frei, nicht nur vorhanden');

  // --- Nach oben geht nichts ---
  await ziehen(page, '.grab', -80, { halten: true });
  ok(await schub(page) === '', 'Nach oben lässt sich das Blatt nicht ziehen');
  await ziehen(page, '.grab', 0);

  // --- Kurzer Zug federt zurück ---
  // In Schritten über 400 ms gezogen, damit es kein Schlenker ist: Ein
  // schneller Zug derselben Länge soll ja schließen.
  await page.evaluate(() => {
    const senden = (typ, y, ziel) => (ziel || window).dispatchEvent(new PointerEvent(typ,
      { pointerId: 9, clientX: 180, clientY: y, bubbles: true, cancelable: true, pointerType: 'touch' }));
    const g = document.querySelector('.grab');
    if (!g) return;
    const r = g.getBoundingClientRect();
    const y0 = Math.round(r.top + r.height / 2);
    senden('pointerdown', y0, g);
    return new Promise(fertig => {
      let i = 0;
      const t = setInterval(() => {
        senden('pointermove', y0 + ++i * 5);
        if (i === 6) { clearInterval(t); senden('pointerup', y0 + 30); fertig(); }
      }, 70);
    });
  });
  ok(await offen(page), 'Ein kurzer Zug schließt das Blatt nicht');
  await page.waitForTimeout(260);
  ok(await schub(page) === '', 'Und das Blatt federt zurück');

  // --- Im Blattinneren beginnt nichts ---
  await ziehen(page, '#sbody', 150, { halten: true });
  ok(await schub(page) === '', 'Im Blattinneren beginnt kein Zug');
  await ziehen(page, '#sbody', 0);
  ok(await offen(page), 'Das Blatt steht danach noch');

  // --- Der Stift bleibt ein Knopf ---
  await ziehen(page, '.shead [data-a="editLog"]', 150, { halten: true });
  ok(await schub(page) === '', 'Auf dem Stift in der Ecke beginnt kein Zug');
  await ziehen(page, '.shead [data-a="editLog"]', 0);
  if (await page.locator('.shead [data-a="editLog"]').count()) {
    await page.click('.shead [data-a="editLog"]');
    await page.waitForSelector('[name="title"]');
  }
  ok(await page.locator('[name="title"]').count() === 1
    && await page.inputValue('[name="title"]') === 'Zahnriemen gewechselt',
    'Ein Tipp darauf öffnet weiterhin die Maske');

  // --- Auch die Bearbeiten-Maske lässt sich wegziehen ---
  const warMaske = await page.locator('[name="title"]').count() === 1;
  await ziehen(page, '.grab', 150);
  await page.waitForTimeout(200);
  ok(warMaske && !await offen(page), 'Auch eine Bearbeiten-Maske lässt sich wegziehen');

  // --- Ziehen schließt das Leseblatt, ohne einen toten Eintrag zu lassen ---
  if (await offen(page)) { await ziehen(page, '.grab', 150); await zu(); }
  await page.click('.item');
  await page.waitForSelector('.shead [data-a="editLog"]');
  await ziehen(page, '.shead h2', 150);
  await zu();
  ok(await page.locator('[data-a="addLog"]').count() === 1,
    'Nach dem Wegziehen steht man weiterhin im Scheckheft');

  // Das ist die Prüfung, die closeSheet() statt dismissModal() auffliegen
  // lässt: Bliebe der Eintrag stehen, liefe dieses Zurück ins Leere und man
  // stünde noch im Fahrzeug.
  await page.goBack();
  await page.waitForTimeout(150);
  ok(await page.locator('.mini, .add').count() > 0,
    'Ein Zurück führt danach in die Garage - kein toter History-Eintrag');

  // --- Dasselbe am Ersatzteil ---
  if (await page.locator('[data-a="open"]').count()) {
    await page.click('[data-a="open"]');
    await page.waitForSelector('.head h2');
  }
  await reiter('part');
  await page.click('[data-a="addPart"]');
  await page.fill('[name="name"]', 'Zahnriemensatz');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.item');
  await page.click('.item');
  await page.waitForSelector('.shead [data-a="editPart"]');
  await ziehen(page, '.grab', 150);
  await zu();
  ok(await page.locator('[data-a="addPart"]').count() === 1,
    'Auch das Leseblatt eines Ersatzteils lässt sich wegziehen');

  ok(errors.length === 0, `Keine JS-Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}
