/* Dokumentenscan: Ecken ziehen, entzerren, drehen, Dokument-Modus.

   Der Kern ist Rechnerei, und die lässt sich hart prüfen, statt sie anzusehen:
   Ein Quellbild mit bekannten Ecken hinein, Pixel wieder heraus. Alles in
   index.html steht auf oberster Ebene und ist damit aus page.evaluate
   erreichbar - so greifen die übrigen Reihen schon auf VEH und store zu. */
import { watchErrors, png } from './lib.mjs';

export const name = 'Scan';

// Quer (300 x 200) mit grüner Marke oben links. Nicht quadratisch, sonst ließe
// sich eine Drehung nicht von einem Nichtstun unterscheiden.
const QUELLE = png(300, 200, (x, y) => (x < 60 && y < 40) ? [0, 255, 0] : [250, 250, 250]);
const BILD = { name: 'blatt.png', mimeType: 'image/png', buffer: QUELLE };

export default async function ({ browser, base, ok }) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  watchErrors(page, errors);
  await page.goto(base, { waitUntil: 'networkidle' });

  // ------------------------------------------------------------ Die Rechnung

  // --- Entzerren: ein schiefes Viereck wird ein sauberes Rechteck ---
  // Rot auf Weiß: Kommt an allen vier Ecken und in der Mitte Rot heraus, ist
  // genau das Viereck herausgelöst worden und nichts vom weißen Grund.
  const ent = await page.evaluate(() => {
    const src = document.createElement('canvas'); src.width = 400; src.height = 300;
    const c = src.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, 400, 300);
    const ecken = [[60, 40], [330, 80], [300, 260], [40, 210]];
    c.fillStyle = '#ff0000';
    c.beginPath(); c.moveTo(60, 40); c.lineTo(330, 80); c.lineTo(300, 260); c.lineTo(40, 210);
    c.closePath(); c.fill();
    const out = entzerren(src, ecken, 1600);
    const d = out.getContext('2d').getImageData(0, 0, out.width, out.height).data;
    const px = (x, y) => { const i = (y * out.width + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    const m = 3;   // etwas Abstand zur Kante, die ist antialiasiert
    const rot = p => p[0] > 200 && p[1] < 60 && p[2] < 60;
    return {
      w: out.width, h: out.height,
      alleRot: [px(m, m), px(out.width - 1 - m, m), px(out.width - 1 - m, out.height - 1 - m),
                px(m, out.height - 1 - m), px(out.width >> 1, out.height >> 1)].every(rot)
    };
  });
  // Erwartet: die jeweils längere gegenüberliegende Kante
  const erwW = Math.round(Math.max(Math.hypot(270, 40), Math.hypot(260, 50)));
  const erwH = Math.round(Math.max(Math.hypot(20, 170), Math.hypot(30, 180)));
  ok(ent.w === erwW && ent.h === erwH,
    `Maße folgen den längeren Kanten: ${ent.w}×${ent.h}, erwartet ${erwW}×${erwH}`);
  ok(ent.alleRot, 'Vier Ecken und die Mitte sind rein rot - das Viereck ist geradegerückt');

  // --- Entartete Ecken kippen die App nicht ---
  ok(await page.evaluate(() => {
    const src = document.createElement('canvas'); src.width = 40; src.height = 40;
    src.getContext('2d').fillRect(0, 0, 40, 40);
    const out = entzerren(src, [[10, 10], [10, 10], [10, 10], [10, 10]], 1600);
    return out.width >= 1 && out.height >= 1;
  }), 'Vier Ecken auf demselben Punkt ergeben trotzdem ein Bild');

  // --- Dokument-Modus: Graustufen und gespreizter Kontrast ---
  const dok = await page.evaluate(() => {
    const src = document.createElement('canvas'); src.width = 256; src.height = 20;
    const c = src.getContext('2d');
    for (let x = 0; x < 256; x++) {
      const v = 100 + Math.round(x / 255 * 40);       // flauer Verlauf, 100..140
      c.fillStyle = `rgb(${v},${v - 5},${v + 5})`; c.fillRect(x, 0, 1, 20);
    }
    const vor = c.getImageData(0, 0, 256, 20).data;
    let vmin = 255, vmax = 0;
    for (let i = 0; i < vor.length; i += 4) { vmin = Math.min(vmin, vor[i]); vmax = Math.max(vmax, vor[i]); }
    const d = dokumentModus(src).getContext('2d').getImageData(0, 0, 256, 20).data;
    let min = 255, max = 0, grau = true;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] !== d[i + 1] || d[i] !== d[i + 2]) grau = false;
      min = Math.min(min, d[i]); max = Math.max(max, d[i]);
    }
    return { vor: [vmin, vmax], nach: [min, max], grau };
  });
  ok(dok.grau, 'Dokument-Modus liefert Graustufen (R = G = B)');
  ok(dok.nach[1] - dok.nach[0] > 200,
    `Kontrast ist gespreizt: vorher ${dok.vor.join('..')}, nachher ${dok.nach.join('..')}`);

  // --- Fast einfarbig: lieber nichts spreizen als Rauschen aufblasen ---
  ok(await page.evaluate(() => {
    const src = document.createElement('canvas'); src.width = 32; src.height = 32;
    const c = src.getContext('2d'); c.fillStyle = 'rgb(130,130,130)'; c.fillRect(0, 0, 32, 32);
    const d = dokumentModus(src).getContext('2d').getImageData(0, 0, 32, 32).data;
    return d[0] > 100 && d[0] < 160;
  }), 'Eine fast einfarbige Fläche wird nicht auseinandergerissen');

  // --- Drehen: Maße getauscht, Ecken wandern mit ---
  const dreh = await page.evaluate(() => {
    const src = document.createElement('canvas'); src.width = 400; src.height = 300;
    const c = src.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, 400, 300);
    c.fillStyle = '#00ff00'; c.fillRect(0, 0, 40, 30);        // Marke oben links
    const r = drehen90(src, [[10, 10], [390, 10], [390, 290], [10, 290]]);
    const d = r.canvas.getContext('2d').getImageData(0, 0, r.canvas.width, r.canvas.height).data;
    const px = (x, y) => { const i = (y * r.canvas.width + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    return { w: r.canvas.width, h: r.canvas.height, ecken: r.ecken,
             obenRechts: px(r.canvas.width - 5, 5), obenLinks: px(5, 5) };
  });
  ok(dreh.w === 300 && dreh.h === 400, `Maße sind getauscht: ${dreh.w}×${dreh.h}`);
  ok(dreh.obenRechts[1] > 200 && dreh.obenRechts[0] < 60,
    'Was oben links war, liegt nach dem Drehen oben rechts');
  ok(dreh.obenLinks[0] > 200 && dreh.obenLinks[1] > 200, 'Und oben links ist jetzt der Grund');
  ok(JSON.stringify(dreh.ecken) === JSON.stringify([[10, 10], [290, 10], [290, 390], [10, 390]]),
    `Die Ecken wandern richtig mit: ${JSON.stringify(dreh.ecken)}`);

  // ------------------------------------------------------------- Die Bedienung

  await page.click('[data-a="addVehicle"]');
  await page.fill('[name="name"]', 'VW Golf');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.head h2');
  await page.click('[data-a="tab"][data-k="doc"]');
  await page.waitForSelector('[data-a="addDoc"]');

  // --- Der Zuschnitt schiebt sich vor das Ablegen ---
  await page.click('[data-a="addDoc"]');
  await page.setInputFiles('#fPick', BILD);
  await page.waitForSelector('#edit:not([hidden])');
  ok(true, 'Nach der Auswahl öffnet sich der Zuschnitt');
  ok((await page.locator('#ewrap .ecorner').count()) === 4, 'Vier Griffe zum Ziehen');
  ok((await page.locator('#ewrap canvas').count()) === 1, 'Das Bild steht darunter');
  ok((await page.locator('#fname').textContent().catch(() => '')) === '',
    'Vorher ist noch nichts übernommen');

  // --- Eine Ecke ziehen ändert das Vieleck ---
  const punkte = () => page.getAttribute('#equad', 'points');
  const vorher = await punkte();
  const griff = page.locator('#ewrap .ecorner[data-ecke="0"]');
  const b = await griff.boundingBox();
  const bild = await page.locator('#ewrap canvas').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(bild.x + bild.width * 0.3, bild.y + bild.height * 0.25, { steps: 8 });
  await page.mouse.up();
  const nachher = await punkte();
  ok(vorher !== nachher, `Ziehen verschiebt die Ecke: ${vorher} → ${nachher}`);
  ok(await page.evaluate(() => E.unberuehrt === false), 'Die App merkt sich, dass zugeschnitten wurde');

  // --- Ganzes Bild setzt zurück ---
  await page.click('[data-a="editReset"]');
  ok(await page.evaluate(() => E.unberuehrt === true && E.ecken[0][0] === 0 && E.ecken[0][1] === 0),
    '"Ganzes Bild" setzt die Ecken zurück');

  // --- Drehen dreht auch die Anzeige ---
  const vorDrehen = await page.evaluate(() => [E.arbeit.width, E.arbeit.height]);
  await page.click('[data-a="editDrehen"]');
  const nachDrehen = await page.evaluate(() => [E.arbeit.width, E.arbeit.height]);
  ok(nachDrehen[0] === vorDrehen[1] && nachDrehen[1] === vorDrehen[0],
    `Drehen tauscht die Maße: ${vorDrehen.join('×')} → ${nachDrehen.join('×')}`);
  await page.waitForSelector('#ewrap .ecorner');
  ok((await page.locator('#ewrap .ecorner').count()) === 4, 'Die Griffe sind nach dem Drehen noch da');

  // --- Zweite Stufe: Ergebnis und Dokument-Modus ---
  await page.click('[data-a="editUeber"]');
  await page.waitForSelector('[data-a="editDok"]');
  ok((await page.locator('#ewrap canvas').count()) === 1, 'Die zweite Stufe zeigt das Ergebnis');
  const bunt = await page.evaluate(() => {
    const c = document.querySelector('#ewrap canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < d.length; i += 4) if (d[i] !== d[i + 1] || d[i] !== d[i + 2]) return true;
    return false;
  });
  ok(bunt, 'Ohne Dokument-Modus bleibt das Bild farbig');
  await page.click('[data-a="editDok"]');
  await page.waitForSelector('[data-a="editDok"].on');
  ok(await page.evaluate(() => {
    const c = document.querySelector('#ewrap canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < d.length; i += 4) if (d[i] !== d[i + 1] || d[i] !== d[i + 2]) return false;
    return true;
  }), 'Mit Dokument-Modus ist es grau');
  await page.click('[data-a="editDok"]');
  await page.waitForSelector('[data-a="editDok"]:not(.on)');
  ok(!(await page.locator('[data-a="editDok"].on').count()), 'Der Dokument-Modus lässt sich wieder abschalten');

  // --- Zurück zur ersten Stufe und wieder vor ---
  await page.click('[data-a="editZurueck"]');
  await page.waitForSelector('[data-a="editUeber"]');
  ok((await page.locator('#ewrap .ecorner').count()) === 4, 'Zurück führt in den Zuschnitt');
  await page.click('[data-a="editUeber"]');
  await page.waitForSelector('[data-a="editSpeichern"]');

  // --- Speichern übernimmt in die Maske ---
  await page.click('[data-a="editSpeichern"]');
  await page.waitForSelector('#edit[hidden]', { state: 'attached' });
  ok(await page.locator('#sheet.open').count() === 1, 'Das Sheet steht danach noch offen');
  ok((await page.textContent('#fname')).includes('blatt.png'),
    `Die Maske nennt die Datei: ${await page.textContent('#fname')}`);
  await page.fill('[name="title"]', 'Fahrzeugschein');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.item');
  ok((await page.locator('.item').count()) === 1, 'Das Dokument ist angelegt');

  // --- Das Gespeicherte trägt die Drehung wirklich ---
  // Die Quelle ist 300 x 200 quer; nach einer Vierteldrehung muss sie hochkant
  // sein und die grüne Marke oben rechts stehen statt oben links.
  const gespeichert = await page.evaluate(async () => {
    const d = await store.get('img:' + VEH[IDX[0]].docs[0].id);
    return await new Promise(r => {
      const i = new Image();
      i.onload = () => {
        const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
        c.getContext('2d').drawImage(i, 0, 0);
        const g = c.getContext('2d');
        const p = (x, y) => { const q = g.getImageData(x, y, 1, 1).data; return [q[0], q[1], q[2]]; };
        r({ w: i.width, h: i.height, or: p(i.width - 8, 8), ol: p(8, 8) });
      };
      i.src = d;
    });
  });
  ok(gespeichert.h > gespeichert.w,
    `Aus quer wurde hochkant: ${gespeichert.w}x${gespeichert.h}`);
  ok(gespeichert.or[1] > 180 && gespeichert.or[0] < 120,
    `Die Marke steht oben rechts: ${gespeichert.or.join(',')}`);
  ok(gespeichert.ol[0] > 180 && gespeichert.ol[1] > 180,
    `Oben links ist der Grund: ${gespeichert.ol.join(',')}`);

  // ------------------------------------------------------------ Die Navigation

  // --- Zurück schließt nur den Zuschnitt, das Sheet bleibt mit seinen Werten ---
  await page.click('[data-a="tab"][data-k="log"]');
  await page.waitForSelector('[data-a="addLog"]');
  await page.click('[data-a="addLog"]');
  await page.fill('[name="title"]', 'Bremsen erneuert');
  await page.fill('[name="cost"]', '412.90');
  await page.setInputFiles('#fPick', BILD);
  await page.waitForSelector('#edit:not([hidden])');
  await page.goBack();
  await page.waitForSelector('#edit[hidden]', { state: 'attached' });
  ok(await page.locator('#sheet.open').count() === 1, 'Zurück schließt nur den Zuschnitt');
  ok((await page.inputValue('[name="title"]')) === 'Bremsen erneuert'
    && (await page.inputValue('[name="cost"]')) === '412.90',
    'Die schon getippten Werte stehen unverändert da');
  ok((await page.locator('#logDocs .d').count()) === 0, 'Ein abgebrochener Zuschnitt hängt nichts an');

  // --- Und ein zweites Zurück schließt das Sheet ---
  await page.goBack();
  await page.waitForFunction(() => !document.getElementById('sheet').classList.contains('open'));
  // Wir stehen im Logbuch-Reiter - dort gibt es keine .head h2, wohl aber den
  // Hinzufügen-Knopf des Reiters.
  ok(await page.locator('[data-a="addLog"]').count() === 1,
    'Das zweite Zurück schließt das Sheet und bleibt im Fahrzeug');
  ok(await page.evaluate(() => VEH[IDX[0]].logs.length === 0), 'Der abgebrochene Eintrag wurde nicht angelegt');

  // --- Abbrechen im Zuschnitt verhält sich wie Zurück ---
  await page.click('[data-a="addLog"]');
  await page.fill('[name="title"]', 'Ölwechsel');
  await page.setInputFiles('#fPick', BILD);
  await page.waitForSelector('#edit:not([hidden])');
  await page.click('[data-a="editAb"]');
  await page.waitForSelector('#edit[hidden]', { state: 'attached' });
  ok(await page.locator('#sheet.open').count() === 1
    && (await page.inputValue('[name="title"]')) === 'Ölwechsel',
    'Abbrechen im Zuschnitt lässt das Sheet stehen');

  // --- Der Zuschnitt aus der Logbuch-Maske heraus legt wirklich an ---
  await page.setInputFiles('#fPick', BILD);
  await page.waitForSelector('#edit:not([hidden])');
  await page.click('[data-a="editUeber"]');
  await page.waitForSelector('[data-a="editSpeichern"]');
  await page.click('[data-a="editSpeichern"]');
  await page.waitForSelector('#logDocs .d');
  ok((await page.locator('#logDocs .d').count()) === 1,
    'Aus der Logbuch-Maske heraus landet der Scan in der Anhangliste');
  await page.click('[data-a="ok"]');
  await page.waitForFunction(() => !document.getElementById('sheet').classList.contains('open'));
  ok(await page.evaluate(() => VEH[IDX[0]].docs.length === 2), 'Und wird mit dem Eintrag gespeichert');

  // --- PDFs gehen weiterhin ohne Zuschnitt durch ---
  // Für ein PDF gibt es nichts geradezurücken.
  await page.click('[data-a="tab"][data-k="doc"]');
  await page.waitForSelector('[data-a="addDoc"]');
  await page.click('[data-a="addDoc"]');
  await page.setInputFiles('#fPick', {
    name: 'schein.pdf', mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
      + '2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n')
  });
  await page.waitForSelector('#fname:not(:empty)');
  ok(await page.locator('#edit[hidden]').count() === 1, 'Ein PDF öffnet keinen Zuschnitt');
  await page.click('.panel .row [data-a="close"]');

  ok(errors.length === 0, `Keine JS-Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}
