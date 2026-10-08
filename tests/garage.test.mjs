/* Garage zum Durchwischen (Fassung 30): Karussell mit einrastenden Karten,
   Punkte darunter, gemerkte Stelle, "+" oben neben dem Zahnrad.

   Gewischt wird hier mit einer Scroll-Geste des Browsers (CDP
   Input.synthesizeScrollGesture). Eine Touch-Geste kommt in diesem
   Testbrowser grundsätzlich nicht an - auch nicht auf einer leeren Testseite,
   am 08.10.2026 nachgeprüft. Geprüft sind damit Scrollen und Einrasten, nicht
   der Finger selbst. */
import { watchErrors, frei } from './lib.mjs';

export const name = 'Garage';

export default async function ({ browser, base, ok }) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 892 } });
  const page = await ctx.newPage();
  const errors = [];
  watchErrors(page, errors);
  await page.goto(base, { waitUntil: 'networkidle' });

  // Drei Fahrzeuge, gespeichert wie über die Maske.
  await page.evaluate(async () => {
    for (const [n, pl] of [['BMW E30', 'M-EZ 325'], ['VW T3', 'M-VW 1987'], ['Porsche 944', 'M-PS 944']]) {
      const x = newVeh(); x.v.name = n; x.v.plate = pl;
      VEH[x.id] = x; IDX.push(x.id); S = x; await save();
    }
    S = null; view = 'garage'; render();
  });
  await page.waitForSelector('#karussell');

  const lage = () => page.evaluate(() => {
    const k = document.getElementById('karussell');
    const karten = [...k.children].map(c => { const r = c.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, w: r.width, name: (c.querySelector('.mh b') || {}).textContent }; });
    const punkte = [...document.querySelectorAll('#punkte button')];
    return { karten, iw: innerWidth, index: karussellIndex(), aktiv: punkte.findIndex(b => b.classList.contains('an')), punkte: punkte.length,
      snap: getComputedStyle(k).scrollSnapType, doc: document.documentElement.scrollWidth };
  });

  let z = await lage();
  ok(z.karten.length === 3, `Drei Karten im Karussell (${z.karten.length})`);
  ok(z.karten.every(c => Math.abs(c.t - z.karten[0].t) < 1), 'Die Karten stehen nebeneinander, nicht untereinander');
  ok(z.karten.every(c => c.w >= 0.8 * z.iw), `Jede Karte ist groß (${Math.round(z.karten[0].w)} von ${z.iw} px)`);
  // Mindestens 24 px vom Nachbarn müssen zu sehen sein - "beginnt vor dem
  // Rand" allein reicht nicht: Auch bei ganz breiten Karten begann die nächste
  // 4 px vor dem Rand, und die Prüfung lief grün (Gegenprobe, 08.10.2026).
  ok(z.karten[1].l > z.karten[0].r && z.iw - z.karten[1].l >= 24,
    `Die nächste Karte lugt herein (${Math.round(z.iw - z.karten[1].l)} px zu sehen)`);
  ok(z.snap === 'x mandatory', `Die Karten rasten ein (${z.snap})`);
  ok(z.punkte === 3 && z.aktiv === 0, `Drei Punkte, der erste aktiv (${z.punkte}, aktiv ${z.aktiv})`);
  ok(await page.locator('.add').count() === 0, 'Keine Kachel zum Hinzufügen im Karussell');

  // --- Hochformat (Fassung 31) ---
  const form = () => page.evaluate(() => {
    const c = document.querySelector('#karussell>.card'), r = c.getBoundingClientRect();
    const inn = c.querySelector('.card-in').getBoundingClientRect(), f = c.querySelector('.photo').getBoundingClientRect();
    const fu = c.querySelector('.fuss'), fr = fu ? fu.getBoundingClientRect() : null;
    return { w: r.width, h: r.height, unten: r.bottom, ih: innerHeight,
      bildDeckt: Math.abs(f.left - inn.left) < 1 && Math.abs(f.top - inn.top) < 1 && Math.abs(f.right - inn.right) < 1 && Math.abs(f.bottom - inn.bottom) < 1,
      fussUnten: !!fr && Math.abs(fr.bottom - inn.bottom) < 1 && fr.top > inn.top + inn.height / 2,
      nameIm: !!fu && !!fu.querySelector('.mh b') };
  });
  let f = await form();
  ok(f.h >= 1.25 * f.w - 1, `Die Karte steht im Hochformat (${Math.round(f.w)} × ${Math.round(f.h)} px)`);
  ok(f.bildDeckt, 'Das Titelbild füllt die ganze Karte');
  ok(f.fussUnten && f.nameIm, 'Name und Angaben liegen unten über dem Bild');
  // Ohne Hinweise darüber reicht die Karte bis kurz über den Fensterrand -
  // genau der leere Raum darunter war das, was gestört hat.
  await page.evaluate(() => { geschuetzt = true; sicherungDatum = new Date().toISOString(); render(); });
  f = await form();
  ok(f.ih - f.unten <= 80 && f.unten <= f.ih,
    `Ohne Hinweise füllt sie den Platz bis unten (${Math.round(f.ih - f.unten)} px Rest für die Punkte)`);
  // Die Höhe folgt dem Fenster.
  await page.setViewportSize({ width: 412, height: 760 });
  await page.waitForTimeout(100);
  const f2 = await form();
  ok(f2.h < f.h - 50 && f2.ih - f2.unten <= 80, `Bei kleinerem Fenster wird sie neu gerechnet (${Math.round(f.h)} → ${Math.round(f2.h)} px)`);
  await page.setViewportSize({ width: 412, height: 892 });
  await page.waitForTimeout(100);

  // --- Wischen ---
  const cdp = await ctx.newCDPSession(page);
  const wische = async dx => {
    const m = await page.evaluate(() => { const r = document.getElementById('karussell').getBoundingClientRect(); return { x: Math.round(r.left + r.width * 0.6), y: Math.round(r.top + r.height * 0.4) }; });
    await cdp.send('Input.synthesizeScrollGesture', { x: m.x, y: m.y, xDistance: dx, yDistance: 0, gestureSourceType: 'mouse', speed: 800 });
    await page.waitForTimeout(700);
  };
  await wische(-200);
  z = await lage();
  ok(z.index === 1 && Math.abs(z.karten[1].l - 16) < 2,
    `Nach einem Wisch steht die zweite Karte eingerastet am Rand (bei ${Math.round(z.karten[1].l)} px)`);
  ok(z.aktiv === 1, `Der zweite Punkt ist aktiv (${z.aktiv})`);

  // --- Punkt antippen ---
  await page.click('#punkte button:nth-child(3)');
  await page.waitForTimeout(800);
  z = await lage();
  ok(z.index === 2 && z.karten[2].r <= z.iw + 1 && z.karten[2].l >= 0,
    `Ein Tipp auf den dritten Punkt zeigt die dritte Karte (${z.karten[2].name})`);
  ok(z.aktiv === 2, 'Und der dritte Punkt ist aktiv');

  // --- Öffnen und zurück: die Stelle bleibt ---
  await page.click('#karussell>.card:nth-child(3)');
  await page.waitForSelector('.head h2');
  ok(await page.textContent('.head h2') === 'Porsche 944', 'Ein Tipp auf die Karte öffnet dieses Fahrzeug');
  await page.goBack();
  await page.waitForSelector('#karussell');
  await page.waitForTimeout(150);
  z = await lage();
  ok(z.index === 2 && z.aktiv === 2 && z.karten[2].l >= 0 && z.karten[2].r <= z.iw + 1,
    `Zurück in der Garage steht sie wieder beim Porsche, nicht beim ersten (Karte ${z.index + 1})`);

  // --- Hinzufügen oben ---
  ok(await frei(page, '#topBtn [data-a="addVehicle"]'), 'Das Plus oben ist da und frei');
  ok(await frei(page, '#topBtn [data-a="settings"]'), 'Das Zahnrad daneben auch');
  await page.click('#topBtn [data-a="addVehicle"]');
  await page.waitForSelector('#sheet.open [name="name"]');
  ok(await page.locator('#sheet.open [name="name"]').count() === 1, 'Das Plus öffnet die Maske für ein neues Fahrzeug');
  await page.goBack();
  await page.waitForFunction(() => !document.getElementById('sheet').classList.contains('open'));

  // --- Schmales Handy ---
  await page.setViewportSize({ width: 360, height: 740 });
  await page.waitForTimeout(100);
  z = await lage();
  ok(z.doc <= z.iw, `Bei 360 px rollt die Seite selbst nicht seitlich (${z.doc} von ${z.iw} px)`);
  const f3 = await form();
  ok(f3.h >= 1.25 * f3.w - 1, `Auch bei 360 px Hochformat (${Math.round(f3.w)} × ${Math.round(f3.h)} px)`);
  // Die Karte ist immer 44 px schmaler als der Platz, damit die nächste
  // hereinlugt - bei 360 px sind das 79 % (284 px). Gemessen, nicht geschätzt.
  ok(z.karten[0].w >= 0.75 * z.iw, `Und die Karten sind weiter groß (${Math.round(z.karten[0].w)} von ${z.iw} px)`);
  await page.setViewportSize({ width: 412, height: 892 });

  // --- Ein unlesbares Fahrzeug ist eine eigene Karte ---
  await page.evaluate(() => { IDX.push('kaputt-test'); render(); });
  z = await lage();
  ok(z.karten.length === 4 && z.punkte === 4, `Ein unlesbares Fahrzeug steht als Karte im Karussell (${z.karten.length} Karten, ${z.punkte} Punkte)`);
  ok(await page.locator('#karussell>.card.tot').count() === 1, 'Als Platzhalter gekennzeichnet');

  // --- Ein Fahrzeug: keine Punkte. Leere Garage: wie bisher ---
  await page.evaluate(() => { IDX = IDX.slice(0, 1); render(); });
  z = await lage();
  ok(z.karten.length === 1 && z.punkte === 0, 'Bei einem Fahrzeug gibt es keine Punkte');
  await page.evaluate(() => { IDX = []; render(); });
  ok(await page.locator('#karussell').count() === 0 && await page.locator('.empty').count() === 1,
    'Die leere Garage zeigt den Hinweis statt eines leeren Karussells');
  ok(await page.locator('.actions [data-a="addVehicle"]').count() === 1, 'Mit dem Knopf für das erste Fahrzeug');

  ok(errors.length === 0, `Keine JS-Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}
