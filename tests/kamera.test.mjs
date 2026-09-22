/* Die Kamera in der App.

   Chromium spielt eine Kamera vor (Schalter in lib.mjs). Geprüft wird deshalb
   nicht nur, dass Schaltflächen da sind, sondern dass wirklich ein Bild läuft
   und im Zuschnitt ankommt.

   Der Umweg über die Kamera-App des Geräts lässt sich hier nicht nachstellen -
   genau deshalb geht der Weg jetzt durch die App selbst. */
import { watchErrors, frei } from './lib.mjs';

export const name = 'Kamera';

const anlegen = async page => {
  await page.click('[data-a="addVehicle"]');
  await page.fill('[name="name"]', 'VW Golf');
  await page.click('[data-a="ok"]');
  await page.waitForSelector('.head h2');
};

// Zustand der Kameraspuren, aus der App selbst gelesen.
const spuren = page => page.evaluate(
  () => (E && E.strom) ? E.strom.getTracks().map(t => t.readyState) : null);

export default async function ({ browser, base, ok }) {
  // --------------------------------------------------- Der gewöhnliche Weg
  {
    const ctx = await browser.newContext();
    await ctx.grantPermissions(['camera']);
    const page = await ctx.newPage();
    const errors = [];
    watchErrors(page, errors);
    await page.goto(base, { waitUntil: 'networkidle' });

    await anlegen(page);
    await page.click('[data-a="tab"][data-k="doc"]');
    await page.waitForSelector('[data-a="addDoc"]');
    await page.click('[data-a="addDoc"]');

    // --- "Scannen" öffnet die Kamerastufe in der App ---
    await page.click('[data-a="pickCam"]');
    await page.waitForSelector('#edit:not([hidden])');
    ok((await page.textContent('.ebar .et b')) === 'Scannen',
      'Scannen öffnet die Kamerastufe, ohne die App zu verlassen');

    // --- Und es läuft wirklich ein Bild, nicht nur ein leeres Element ---
    await page.waitForSelector('#ewrap video');
    await page.waitForFunction(() => {
      const v = document.querySelector('#ewrap video');
      return v && v.readyState >= 2 && v.videoWidth > 0;
    }, null, { timeout: 15000 });
    const strom = await page.evaluate(() => {
      const v = document.querySelector('#ewrap video');
      return { w: v.videoWidth, h: v.videoHeight, readyState: v.readyState };
    });
    ok(strom.readyState >= 2 && strom.w > 0,
      `Das Sucherbild läuft: ${strom.w}×${strom.h}, readyState ${strom.readyState}`);
    ok((await spuren(page)).every(s => s === 'live'), 'Die Kameraspur ist offen');
    ok((await page.locator('[data-a="ausloesen"]:not([disabled])').count()) === 1,
      'Der Auslöser ist bereit');

    // --- Und er ist auch wirklich zu treffen ---
    // Das Sucherbild kommt in 2560x1920 - ohne Einpassen legte es sich über die
    // Knöpfe, und der Auslöser war zwar da, aber nicht anklickbar.
    for (const [b, h] of [[412, 915], [1280, 720], [900, 500]]) {
      await page.setViewportSize({ width: b, height: h });
      await page.waitForTimeout(150);
      ok(await frei(page, '[data-a="ausloesen"]'),
        `Bei ${b}x${h} liegt der Auslöser frei, nicht unter dem Sucherbild`);
    }
    await page.setViewportSize({ width: 412, height: 915 });
    await page.waitForTimeout(150);

    // --- Auslösen führt in den Zuschnitt, mit den Maßen des Stroms ---
    await page.click('[data-a="ausloesen"]');
    await page.waitForSelector('#ewrap .ecorner');
    ok((await page.locator('#ewrap .ecorner').count()) === 4,
      'Nach dem Auslösen stehen die vier Griffe da');
    const arbeit = await page.evaluate(() => [E.arbeit.width, E.arbeit.height]);
    const erwartet = Math.min(1, 2000 / Math.max(strom.w, strom.h));
    ok(arbeit[0] === Math.round(strom.w * erwartet) && arbeit[1] === Math.round(strom.h * erwartet),
      `Das aufgenommene Bild hat die Maße des Stroms: ${arbeit.join('×')}`);

    // --- Und die Kamera ist danach aus ---
    // Eine im Hintergrund weiterlaufende Kamera wäre ein echter Fehler.
    ok((await spuren(page)) === null,
      'Nach dem Auslösen ist die Kamera freigegeben');
    ok((await page.locator('#ewrap video').count()) === 0,
      'Das Sucherbild ist verschwunden');

    // --- Das Aufgenommene ist kein leeres Bild ---
    ok(await page.evaluate(() => {
      const d = E.arbeit.getContext('2d').getImageData(0, 0, E.arbeit.width, E.arbeit.height).data;
      for (let i = 0; i < d.length; i += 4) if (d[i] || d[i + 1] || d[i + 2]) return true;
      return false;
    }), 'Die Aufnahme enthält wirklich Bildinhalt');

    // --- Von hier an der bekannte Weg: Ecken, Übernehmen, Speichern ---
    await page.click('[data-a="editUeber"]');
    await page.waitForSelector('[data-a="editSpeichern"]');
    await page.click('[data-a="editSpeichern"]');
    await page.waitForSelector('#edit[hidden]', { state: 'attached' });
    ok((await page.locator('#sheet.open').count()) === 1, 'Die Maske steht danach noch offen');
    ok((await page.textContent('#fname')).includes('Aufnahme-'),
      `Die Maske nennt die Aufnahme: ${await page.textContent('#fname')}`);
    await page.fill('[name="title"]', 'Fahrzeugschein');
    await page.click('[data-a="ok"]');
    await page.waitForSelector('.item');
    ok(await page.evaluate(() => VEH[IDX[0]].docs.length === 1),
      'Das Dokument ist aus der Kamera heraus angelegt');

    ok(errors.length === 0, `Keine JS-Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }

  // ------------------------------------- Abbrechen gibt die Kamera wieder frei
  {
    const ctx = await browser.newContext();
    await ctx.grantPermissions(['camera']);
    const page = await ctx.newPage();
    const errors = [];
    watchErrors(page, errors);
    await page.goto(base, { waitUntil: 'networkidle' });
    await anlegen(page);
    await page.click('[data-a="tab"][data-k="log"]');
    await page.waitForSelector('[data-a="addLog"]');
    await page.click('[data-a="addLog"]');
    await page.fill('[name="title"]', 'Bremsen erneuert');

    // --- Aus der Logbuch-Maske heraus geht es genauso ---
    await page.click('[data-a="pickCam"]');
    await page.waitForSelector('#ewrap video');
    await page.waitForSelector('[data-a="ausloesen"]:not([disabled])');
    ok((await spuren(page)).every(s => s === 'live'), 'Auch aus dem Logbuch läuft die Kamera');

    // --- Freigegeben heißt wirklich bereit ---
    // Der Auslöser war einmal schon anklickbar, während das Bild noch keine
    // Daten hatte - ein Tipp lief dann stumm ins Leere.
    ok(await page.evaluate(() => {
      const b = document.querySelector('[data-a="ausloesen"]');
      const v = document.querySelector('#ewrap video');
      return !b || b.disabled || (v && v.videoWidth > 0 && v.readyState >= 2);
    }), 'Der Auslöser ist nur freigegeben, wenn das Sucherbild wirklich läuft');

    // --- Der Abbrechen-Knopf schließt nur die Schicht und beendet den Strom ---
    await page.click('[data-a="editAb"]');
    await page.waitForSelector('#edit[hidden]', { state: 'attached' });
    ok((await page.locator('#sheet.open').count()) === 1, 'Die Logbuch-Maske steht noch');
    ok((await page.inputValue('[name="title"]')) === 'Bremsen erneuert',
      'Die getippten Werte sind unverändert');
    ok((await page.locator('#logDocs .d').count()) === 0, 'Abbrechen hängt nichts an');

    // --- Und die Zurück-Geste tut dasselbe ---
    await page.click('[data-a="pickCam"]');
    await page.waitForSelector('#ewrap video');
    await page.waitForSelector('[data-a="ausloesen"]:not([disabled])');
    await page.goBack();
    await page.waitForSelector('#edit[hidden]', { state: 'attached' });
    ok((await page.locator('#sheet.open').count()) === 1,
      'Die Zurück-Geste schließt nur die Kamerastufe');
    ok(await page.evaluate(() => E === null), 'Der Zuschnitt-Zustand ist abgeräumt');

    // --- Aus der Kamera heraus anlegen klappt auch im Logbuch ---
    // Bewusst nur auf den freigegebenen Auslöser gewartet, auf nichts sonst:
    // Genau das muss reichen, damit ein Tipp auch wirklich etwas bewirkt.
    await page.click('[data-a="pickCam"]');
    await page.waitForSelector('[data-a="ausloesen"]:not([disabled])');
    await page.click('[data-a="ausloesen"]');
    await page.waitForSelector('#ewrap .ecorner');
    await page.click('[data-a="editUeber"]');
    await page.waitForSelector('[data-a="editSpeichern"]');
    await page.click('[data-a="editSpeichern"]');
    await page.waitForSelector('#logDocs .d');
    ok((await page.locator('#logDocs .d').count()) === 1,
      'Die Aufnahme landet in der Anhangliste des Logbuch-Eintrags');
    await page.click('[data-a="ok"]');
    await page.waitForFunction(() => !document.getElementById('sheet').classList.contains('open'));
    ok(await page.evaluate(() => VEH[IDX[0]].docs.length === 1 && !!VEH[IDX[0]].docs[0].logId),
      'Und hängt am Eintrag');

    ok(errors.length === 0, `Keine JS-Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }

  // ------------------------------------------- Wenn die Kamera nicht mitspielt
  for (const [titel, stellen, erwartet] of [
    ['Erlaubnis verweigert', () => {
      navigator.mediaDevices.getUserMedia = async () => {
        const e = new Error('abgelehnt'); e.name = 'NotAllowedError'; throw e;
      };
    }, 'nicht freigegeben'],
    ['Keine Kamera vorhanden', () => {
      Object.defineProperty(Navigator.prototype, 'mediaDevices',
        { configurable: true, get: () => undefined });
    }, 'keine kamera'],
    ['Kamera belegt', () => {
      navigator.mediaDevices.getUserMedia = async () => {
        const e = new Error('belegt'); e.name = 'NotReadableError'; throw e;
      };
    }, 'belegt']
  ]) {
    const ctx = await browser.newContext();
    await ctx.addInitScript(stellen);
    const page = await ctx.newPage();
    const errors = [];
    watchErrors(page, errors);
    await page.goto(base, { waitUntil: 'networkidle' });
    await anlegen(page);
    await page.click('[data-a="tab"][data-k="doc"]');
    await page.waitForSelector('[data-a="addDoc"]');
    await page.click('[data-a="addDoc"]');
    await page.click('[data-a="pickCam"]');
    await page.waitForSelector('[data-a="kameraApp"]', { timeout: 10000 });
    const text = (await page.textContent('.ebusy')).toLowerCase();
    ok(text.includes(erwartet),
      `${titel}: die App nennt den Grund – "${await page.textContent('.ebusy')}"`);
    ok((await page.locator('[data-a="ausloesen"]').count()) === 0,
      `${titel}: kein Auslöser, der ins Leere führt`);
    ok((await page.locator('[data-a="kameraApp"]').count()) === 1,
      `${titel}: der Weg über die Kamera-App steht als Rückfallebene bereit`);
    ok(errors.length === 0, `${titel}: keine JS-Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }

  // ------------------------- showErr ohne offene Maske wirft nicht mehr
  // Vorher war $('#err') dann null und die Meldung ging im Fehlerpfad unter.
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    watchErrors(page, errors);
    await page.goto(base, { waitUntil: 'networkidle' });
    const dialoge = [];
    page.on('dialog', d => { dialoge.push(d.message()); d.dismiss(); });
    ok(await page.evaluate(() => {
      try { showErr('Probe ohne Maske'); return true; } catch (e) { return false; }
    }), 'showErr wirft ohne offene Maske nicht mehr');
    await page.waitForTimeout(200);
    ok(dialoge.length === 1 && dialoge[0] === 'Probe ohne Maske',
      'Stattdessen wird die Meldung sichtbar gemacht');
    ok(errors.length === 0, `Keine JS-Fehler${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }
}
