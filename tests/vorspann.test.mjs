/* Vorspann beim Öffnen (Fassung 28): Bildmarke und Name, drei Sekunden ab
   Seitenstart, ohne Abkürzen. Diese Reihe läuft als einzige ohne den
   Abschalter, den lib.mjs allen anderen Kontexten mitgibt. */
import { watchErrors } from './lib.mjs';

export const name = 'Vorspann';

export default async function ({ browser, base, ok }) {
  const neu = browser.newContextMitVorspann || browser.newContext.bind(browser);
  const ctx = await neu({ viewport: { width: 412, height: 892 } });
  const page = await ctx.newPage();
  const errors = [];
  watchErrors(page, errors);

  // Zustand des Vorspanns, dazu die Zeit seit Seitenstart - gewartet wird
  // bis zu einem festen Zeitpunkt, nicht eine feste Spanne ab jetzt.
  const zustand = () => page.evaluate(() => {
    const v = document.getElementById('vorspann');
    const mitte = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    if (!v) return { da: false, t: performance.now(), mitteImVorspann: false };
    const r = v.getBoundingClientRect(), cs = getComputedStyle(v);
    const img = v.querySelector('img');
    return {
      da: true, t: performance.now(),
      sichtbar: !v.hidden && cs.display !== 'none' && cs.opacity !== '0',
      deckt: r.left <= 0 && r.top <= 0 && r.right >= innerWidth && r.bottom >= innerHeight,
      bild: !!img && img.complete && img.naturalWidth > 0,
      text: (v.querySelector('b') || {}).textContent || '',
      mitteImVorspann: !!mitte && v.contains(mitte),
      passt: [...v.children].every(k => { const q = k.getBoundingClientRect(); return q.left >= 0 && q.right <= innerWidth && q.top >= 0 && q.bottom <= innerHeight; })
    };
  });
  const bis = async ms => {
    const t = await page.evaluate(() => performance.now());
    if (t < ms) await page.waitForTimeout(ms - t);
  };

  await page.goto(base, { waitUntil: 'domcontentloaded' });
  let z = await zustand();
  ok(z.da && z.sichtbar, `Direkt nach dem Öffnen steht der Vorspann (bei ${Math.round(z.t)} ms)`);
  ok(z.deckt, 'Er deckt das ganze Fenster');
  await page.waitForFunction(() => { const i = document.querySelector('#vorspann img'); return i && i.complete; }, null, { timeout: 5000 });
  z = await zustand();
  ok(z.bild, 'Die Bildmarke ist geladen');
  ok(z.text === 'CarCollection', `Darunter steht der Name (${z.text})`);
  ok(z.passt, 'Bild und Name passen bei 412 px ins Fenster');

  // Die App lädt darunter weiter: Der Vorspann verzögert den Start nicht.
  await page.waitForFunction(() => document.getElementById('view').children.length > 0, null, { timeout: 5000 });
  z = await zustand();
  ok(z.sichtbar, `Die App ist darunter schon gezeichnet, während der Vorspann noch steht (${Math.round(z.t)} ms)`);

  // Kein Abkürzen: Ein Tipp wird abgefangen und blendet nicht aus.
  await page.mouse.click(206, 446);
  await bis(2500);
  z = await zustand();
  ok(z.sichtbar, `Bei 2,5 s steht er noch, auch nach einem Tipp (${Math.round(z.t)} ms)`);
  ok(z.mitteImVorspann, 'Ein Tipp in die Mitte trifft den Vorspann, nicht die App');

  await bis(3600);
  z = await zustand();
  ok(z.da && !z.sichtbar, `Nach 3,6 s ist er weg (${Math.round(z.t)} ms)`);
  ok(!z.mitteImVorspann, 'Danach erreicht ein Tipp die App');
  ok(await page.evaluate(() => document.getElementById('vorspann').hidden),
    'Und er ist ganz verborgen, nicht nur durchsichtig');

  // Nach einem Neuladen wieder da.
  await page.reload({ waitUntil: 'domcontentloaded' });
  z = await zustand();
  ok(z.da && z.sichtbar, 'Nach einem Neuladen steht er wieder');

  // Schmales Handy.
  await page.setViewportSize({ width: 360, height: 640 });
  await page.waitForTimeout(50);
  z = await zustand();
  ok(z.passt, 'Bei 360 × 640 passen Bild und Name ins Fenster');
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'Und nichts läuft seitlich über');

  // Der Abschalter der übrigen Reihen wirkt - sonst wären deren Klicks in den
  // ersten drei Sekunden abgefangen worden.
  const ohne = await browser.newContext();
  const p2 = await ohne.newPage();
  await p2.goto(base, { waitUntil: 'domcontentloaded' });
  ok(await p2.evaluate(() => !document.getElementById('vorspann')),
    'Mit dem Abschalter der Tests gibt es keinen Vorspann');
  await ohne.close();

  ok(errors.length === 0, `Keine JS-Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}
