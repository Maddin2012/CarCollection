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
  // Nicht mehr "persistent === true": Das bedeutete nur "nicht der
  // Arbeitsspeicher" und stand auch bei localStorage da. Geprüft wird jetzt,
  // welcher Speicher es wirklich ist.
  ok(await page.evaluate(() => speicherArt === 'idb'), 'Die Akte liegt in IndexedDB');
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
  // Seit Schritt 10 wird das Titelbild in der Bearbeiten-Maske geändert,
  // nicht mehr über einen eigenen Knopf auf dem Bild.
  ok(await page.locator('.photo .edit').count() === 0,
    'Kein Knopf "Bild ändern" mehr auf dem Titelbild');

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

  // --- Die untere Leiste (Fassung 17) ---
  // Gemessen wird die Breite des Beschriftungstexts selbst, nicht scrollWidth
  // des Knopfes: der Text ist zentriert, ein Überlauf ginge nach beiden Seiten
  // und wäre in scrollWidth nicht zu sehen.
  const knoepfe = () => page.evaluate(() =>
    [...document.querySelectorAll('#nav button')].map(b => {
      const t = [...b.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
      const r = document.createRange(); r.selectNode(t);
      return {
        k: b.dataset.k, text: t.textContent.trim(),
        breit: Math.ceil(r.getBoundingClientRect().width), platz: b.clientWidth
      };
    }));
  const leiste = await knoepfe();
  const texte = leiste.map(b => b.text).join(', ');
  ok(texte === 'Cars, Scheckheft, Dokumente, Ersatzteile',
    `Die Leiste heißt Cars, Scheckheft, Dokumente, Ersatzteile (${texte})`);
  ok(leiste.map(b => b.k).join(',') === 'card,log,doc,part',
    `Die Kennungen der Reiter sind unverändert (${leiste.map(b => b.k).join(',')})`);
  for (const b of leiste) {
    ok(b.breit <= b.platz,
      `"${b.text}" passt bei 360 px in den Knopf (${b.breit} von ${b.platz} px)`);
  }

  // Die vier Symbole der Leiste. Zwei gleiche wären in der Leiste nicht zu
  // unterscheiden - geprüft wird deshalb, dass alle vier eigene Pfade sind.
  const symbole = await page.evaluate(() =>
    ['card', 'log', 'doc', 'part'].map(k => ICONS[k]));
  ok(new Set(symbole).size === 4,
    `Alle vier Reiter tragen ein eigenes Symbol (${new Set(symbole).size} von 4)`);
  // Seit Fassung 18 ist der erste Reiter ein Auto von vorn, keine Karteikarte.
  ok(!symbole[0].includes('<rect'),
    'Der erste Reiter ist keine Karteikarte mehr');
  ok((symbole[0].match(/<path/g) || []).length === 3,
    `Das Auto besteht aus Dach, Wagenkasten und Scheinwerfern (${(symbole[0].match(/<path/g) || []).length} Pfade)`);
  ok(await page.locator('[data-a="tab"][data-k="card"] svg path').count() === 3,
    'Und wird in der Leiste auch so gezeichnet');

  await page.setViewportSize({ width: 1280, height: 720 });

  // Kopfzeile und Leiste stammen seit Fassung 17 aus derselben Quelle. Geprüft
  // wird die Gleichheit je Reiter - sonst fiele ein Auseinanderdriften der
  // beiden Texte nicht auf. Einzige Ausnahme: der Karten-Reiter.
  for (const b of leiste) {
    await page.click(`[data-a="tab"][data-k="${b.k}"]`);
    await page.waitForTimeout(80);
    const titel = await page.textContent('#title');
    const soll = b.k === 'card' ? 'CarCollection' : b.text;
    ok(titel === soll, `Kopfzeile im Reiter "${b.text}" lautet "${soll}" (${titel})`);
  }

  // Umbenannt wurden nur Leiste und Kopfzeile - die Texte in den Ansichten
  // selbst bleiben, wie sie waren.
  await page.click('[data-a="tab"][data-k="part"]');
  await page.waitForTimeout(80);
  ok((await page.textContent('#view')).includes('Noch keine Teile'),
    'Im Reiter selbst heißt es weiterhin "Teile"');
  await page.click('[data-a="tab"][data-k="card"]');
  await page.waitForSelector('.foot');
  ok((await page.textContent('.foot')).includes('Teile'),
    'Die Fußzeile der Karte zählt weiterhin "Teile"');

  // --- Farben (Fassung 25) ---
  // Akzent in Gold passend zum App-Symbol, Warnungen in Orange. Gemessen wird
  // am gezeichneten Element, nicht nur an der Variable - sonst fiele eine
  // Stelle, die die Variable nicht benutzt, nicht auf.
  const GOLD = 'rgb(210, 178, 106)', ORANGE = 'rgb(240, 160, 75)';
  const farben = await page.evaluate(() => {
    const wurzel = getComputedStyle(document.documentElement);
    const pille = document.createElement('span');
    pille.className = 'pill warn'; pille.textContent = 'TÜV';
    document.body.append(pille);
    const warn = getComputedStyle(pille).color; pille.remove();
    return {
      accent: wurzel.getPropertyValue('--accent').trim().toUpperCase(),
      warnVar: wurzel.getPropertyValue('--warn').trim().toUpperCase(),
      reiter: getComputedStyle(document.querySelector('#nav button.on')).color,
      warn
    };
  });
  ok(farben.accent === '#D2B26A', `Der Akzent ist Symbol-Gold (${farben.accent})`);
  ok(farben.warnVar === '#F0A04B', `Die Warnfarbe ist Orange (${farben.warnVar})`);
  ok(farben.reiter === GOLD, `Der aktive Reiter unten ist golden (${farben.reiter})`);
  // Die Warnfarbe war früher ein Goldgelb. Neben einem goldenen Akzent sähe
  // eine fällige TÜV-Warnung aus wie ein Knopf - deshalb dieser Vergleich.
  ok(farben.warn === ORANGE && farben.warn !== farben.reiter,
    `Eine Warnung ist orange und hebt sich vom Akzent ab (${farben.warn})`);
  await page.click('[data-a="tab"][data-k="log"]');
  await page.waitForSelector('[data-a="addLog"]');
  const knopf = await page.evaluate(() => {
    const b = document.querySelector('[data-a="addLog"]');
    return { primaer: b.classList.contains('primary'), hg: getComputedStyle(b).backgroundColor };
  });
  ok(knopf.primaer && knopf.hg === GOLD, `Der Hauptknopf ist golden (${knopf.hg})`);
  // Das Blau stand nicht nur in der Variable, sondern auch fest in der
  // Füllung beim Ecken-Ziehen im Scan. Es darf nirgends mehr stehen.
  const quelle = await page.evaluate(() => fetch('index.html', { cache: 'no-store' }).then(r => r.text()));
  ok(!/6EC6E0|110,\s*198,\s*224/i.test(quelle), 'Im Quelltext steht kein Blau des alten Akzents mehr');
  await page.click('[data-a="tab"][data-k="card"]');
  await page.waitForSelector('.foot');

  // --- Logbuch-Eintrag ---
  await page.click('[data-a="tab"][data-k="log"]');
  await page.click('[data-a="addLog"]');

  // --- Feldpaare in der Maske (Fassung 26) ---
  // field() und select() liefern Beschriftung und Feld als Geschwister. Im
  // einfachen zweispaltigen Raster stand deshalb die Beschriftung neben dem
  // eigenen Feld, und die Zeilen saßen versetzt - auf dem Pixel gemeldet.
  // Gemessen bei 360 px, der engsten unterstützten Breite.
  await page.setViewportSize({ width: 360, height: 780 });
  await page.waitForTimeout(80);
  const paare = await page.evaluate(() => {
    const r = e => e.getBoundingClientRect();
    const ohneKlasse = [...document.querySelectorAll('#sbody .two')]
      .filter(t => t.querySelector(':scope > label') && !t.classList.contains('paar')).length;
    const zeilen = [...document.querySelectorAll('#sbody .two.paar')].map(t => {
      const l = [...t.querySelectorAll(':scope > label')], f = [...t.querySelectorAll(':scope > input, :scope > select')];
      return {
        name: l.map(x => x.textContent).join(' / '),
        zwei: l.length === 2 && f.length === 2,
        // jede Beschriftung über ihrem eigenen Feld, in derselben Spalte
        darueber: l.every((x, i) => f[i] && r(x).bottom <= r(f[i]).top + 1 && Math.abs(r(x).left - r(f[i]).left) < 2),
        // beide Spalten auf gleicher Höhe, links vor rechts
        buendig: f.length === 2 && Math.abs(r(f[0]).top - r(f[1]).top) < 1 && Math.abs(r(l[0]).top - r(l[1]).top) < 1 && r(f[0]).right <= r(f[1]).left
      };
    });
    const p = document.querySelector('#sheet .panel');
    return { ohneKlasse, zeilen, ueberlauf: p.scrollWidth - p.clientWidth };
  });
  // Drei seit Fassung 27: "Art / Kategorie" ist kein Paar mehr, die
  // Kategorien stehen als eigene Zeile zum Antippen darunter.
  ok(paare.zeilen.length === 3, `Die Scheckheft-Maske hat drei Feldpaare (${paare.zeilen.length})`);
  ok(paare.ohneKlasse === 0, `Jedes Feldpaar ist als solches gekennzeichnet (${paare.ohneKlasse} ohne)`);
  for (const z of paare.zeilen) {
    ok(z.zwei && z.darueber, `"${z.name}": jede Beschriftung steht über ihrem Feld`);
    ok(z.buendig, `"${z.name}": beide Felder auf gleicher Höhe nebeneinander`);
  }
  ok(paare.ueberlauf <= 0, `Die Maske läuft bei 360 px nicht seitlich über (${paare.ueberlauf} px)`);
  await page.setViewportSize({ width: 1280, height: 720 });

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
  // Die Kennung der App. Ohne "id" leitet Chrome sie aus start_url ab - jede
  // Änderung daran würde die installierte App stillschweigend verwaisen
  // lassen. Der Wert ist hier festgenagelt, weil ein Ändern genau das
  // auslöst: Chrome hielte sie für eine andere App.
  ok(manifest && manifest.id === '/CarCollection/app',
    `Das Manifest trägt eine ausdrückliche Kennung (${manifest && manifest.id})`);
  ok(await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => !!r)), 'Service Worker registriert');
  for (const i of ['icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png']) {
    ok(await page.evaluate(u => fetch(u).then(r => r.status), i) === 200, `Icon erreichbar: ${i}`);
  }

  // --- Die Symbole selbst ---
  // Erreichbar heißt nicht brauchbar. Geprüft werden die Maße und - bei den
  // beiden Manifest-Symbolen - der sichere Bereich: Android legt über ein
  // maskierbares Symbol eine eigene Form und schneidet bis zu 20 % je Rand
  // weg. Was außerhalb des Kreises mit 40 % der Kantenlänge liegt, kann
  // verschwinden; ohne diese Prüfung merkt man das erst auf dem Homescreen.
  const symbol = (datei, soll) => page.evaluate(async ({ datei, soll }) => {
    const bild = new Image();
    await new Promise((fertig, schief) => {
      bild.onload = fertig; bild.onerror = schief; bild.src = datei;
    });
    const c = document.createElement('canvas');
    c.width = bild.width; c.height = bild.height;
    const x = c.getContext('2d');
    x.drawImage(bild, 0, 0);
    const p = x.getImageData(0, 0, c.width, c.height).data;
    // Hintergrundfarbe aus der Ecke lesen, statt sie anzunehmen.
    const grund = [p[0], p[1], p[2]];
    const gleich = i => Math.abs(p[i] - grund[0]) < 12
      && Math.abs(p[i + 1] - grund[1]) < 12 && Math.abs(p[i + 2] - grund[2]) < 12;
    const m = c.width / 2, r = c.width * 0.4;
    let draussen = 0, drinnen = 0;
    for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) {
      const i = (y * c.width + xx) * 4;
      if (gleich(i)) continue;
      ((xx - m) ** 2 + (y - m) ** 2 > r * r) ? draussen++ : drinnen++;
    }
    return { breite: bild.width, hoehe: bild.height, draussen, drinnen, soll };
  }, { datei, soll });

  for (const [datei, soll, maskiert] of [
    ['icons/icon-192.png', 192, true],
    ['icons/icon-512.png', 512, true],
    ['icons/apple-touch-icon.png', 180, false]
  ]) {
    const s = await symbol(datei, soll);
    ok(s.breite === soll && s.hoehe === soll,
      `${datei} misst ${soll}×${soll} (${s.breite}×${s.hoehe})`);
    // Nicht leer: Sonst wäre die Prüfung auf den sicheren Bereich auch für
    // eine reine Hintergrundfläche grün.
    ok(s.drinnen > soll * soll * 0.01,
      `${datei} trägt ein Zeichen (${s.drinnen} Punkte)`);
    if (maskiert) {
      ok(s.draussen === 0,
        `${datei} bleibt im sicheren Bereich (${s.draussen} Punkte außerhalb)`);
    }
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
  // --- Das Manifest kommt nie aus dem Cache ---
  // Es entscheidet, als welche App der Browser die Seite führt. Lag es wie
  // jede andere Datei im Cache, erreichte eine Änderung daran - etwa eine neue
  // Kennung - das Gerät nicht. Genau so ist es am 03.10.2026 passiert.
  // Geprüft wird hart: Der Cache-Eintrag wird mit einem erfundenen Manifest
  // überschrieben. Kommt der beim Abrufen zurück, liefert der Service Worker
  // aus dem Cache und der Mangel ist wieder da.
  await page.evaluate(async () => {
    const c = await caches.open((await caches.keys())[0]);
    await c.put('manifest.webmanifest', new Response(
      JSON.stringify({ name: 'AUS DEM CACHE', id: '/falsch', icons: [] }),
      { headers: { 'Content-Type': 'application/manifest+json' } }));
  });
  const frisch = await page.evaluate(
    () => fetch('manifest.webmanifest').then(r => r.json()).catch(() => null));
  ok(frisch && frisch.name === 'CarCollection' && frisch.id === '/CarCollection/app',
    `Das Manifest kommt vom Netz, nicht aus dem Cache (${frisch && frisch.name})`);

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
