/* Speicher: Lesefehler dürfen keine Daten verlieren, die Anzeige muss die
   Wahrheit sagen, und die Datenrettung muss finden, was noch da ist.

   Der Kern dieser Reihe ist, dass sich Fehler *stellen* lassen: Vor dem
   Neuladen wird dem Seitenkontext beigebracht, einen bestimmten Schlüssel nicht
   mehr herzugeben. Genau das ist am 02.10.2026 auf dem Gerät passiert - nur
   wusste es niemand, weil die App den Fehler wie "nichts da" behandelte. */
import { watchErrors } from './lib.mjs';

export const name = 'Speicher';

/* Legt vor dem nächsten Laden fest, dass IndexedDB-Lesezugriffe auf diese
   Schlüssel scheitern. Gehängt wird das an IDBObjectStore.get, also unterhalb
   der App - sie merkt davon nichts außer dem Fehler.

   Geworfen wird *sofort*, nicht über ein abort() im Timeout: Sonst gäbe es ein
   Wettrennen mit der Transaktion, und wenn die zuerst fertig wird, sieht die
   App ein leeres Ergebnis statt eines Fehlers - also genau den anderen Fall.
   Der Wurf landet im Promise-Körper von tx() und wird daraus eine Ablehnung. */
const leseFehlerFuer = (page, schluessel) => page.addInitScript(keys => {
  const echt = IDBObjectStore.prototype.get;
  IDBObjectStore.prototype.get = function (k) {
    if (keys.includes(k)) throw new DOMException('Lesefehler gestellt', 'UnknownError');
    return echt.call(this, k);
  };
  // Ein Weg am Haken vorbei, nur für den Test: Sonst liefe die Prüfung, ob der
  // Schlüssel im Speicher unverändert ist, in denselben gestellten Fehler und
  // bekäme null - was wie "überschrieben" aussähe, obwohl nichts passiert ist.
  window.__roh = k => new Promise((res, rej) => {
    const q = indexedDB.open('fahrzeugakte', 1);
    q.onsuccess = () => {
      const t = q.result.transaction('kv', 'readonly');
      const rq = echt.call(t.objectStore('kv'), k);
      t.oncomplete = () => res(rq.result ?? null);
      t.onabort = t.onerror = () => rej(t.error);
    };
    q.onerror = () => rej(q.error);
  });
}, schluessel);

export default async function ({ browser, base, ok }) {
  // ---------------------------------------------------------------- Teil 1
  // Ein Lesefehler an einem Fahrzeug darf es nicht aus der Liste werfen.
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    watchErrors(page, errors);
    await page.goto(base, { waitUntil: 'networkidle' });

    const anlegen = async (name) => {
      await page.click('[data-a="addVehicle"]');
      await page.fill('[name="name"]', name);
      await page.click('[data-a="ok"]');
      await page.waitForSelector('.head h2');
      const id = await page.evaluate(() => S.id);
      await page.goBack();
      await page.waitForSelector('.mini, .grid');
      return id;
    };
    const idA = await anlegen('VW Golf');
    const idB = await anlegen('Audi A4');
    ok((await page.locator('.card.mini').count()) === 2, 'Zwei Fahrzeuge angelegt');

    // Jetzt das eine Fahrzeug unlesbar machen und neu laden. Dieselbe Seite,
    // nicht ein neuer Kontext: storageState überträgt kein IndexedDB, der neue
    // Kontext hätte also überhaupt keine Daten und die Prüfung wäre leer.
    const p2 = page, fehler2 = errors;
    await leseFehlerFuer(p2, ['akte:v:' + idA]);
    await p2.reload({ waitUntil: 'networkidle' });
    // Nicht blind auf .grid warten: Fällt die Kennung wieder aus der Liste -
    // also genau der Fehler, den diese Reihe sucht -, bleibt ein Fahrzeug
    // übrig und die App startet auf dessen Karte. Ein Warten auf .grid würde
    // dann in einen Zeitablauf laufen und die ganze Reihe abbrechen, statt zu
    // sagen, welche Prüfung umfällt.
    await p2.waitForSelector('.grid, .head h2');
    if (await p2.locator('.head h2').count()) {
      await p2.goBack();
      await p2.waitForSelector('.grid, .empty');
    }

    const idxNach = await p2.evaluate(() => IDX.slice());
    ok(idxNach.includes(idA) && idxNach.includes(idB),
      `Die unlesbare Kennung bleibt in der Liste (${idxNach.length} Einträge)`);
    ok((await p2.locator('.card.mini.tot').count()) === 1,
      'Das unlesbare Fahrzeug steht als Platzhalter in der Garage');
    const platzText = await p2.locator('.card.mini.tot').count()
      ? await p2.textContent('.card.mini.tot') : '';
    ok(platzText.includes('nicht lesbar'),
      'Der Platzhalter sagt, dass der Datensatz nicht lesbar war');

    // Und das Entscheidende: nach einem Speichern am *anderen* Fahrzeug muss
    // die Kennung weiterhin in akte:index stehen. Genau hier ging sie bisher
    // dauerhaft verloren - die Kachel allein zu prüfen würde das nicht fangen.
    if (await p2.locator(`.card.mini[data-id="${idB}"]`).count()) await p2.click(`.card.mini[data-id="${idB}"]`);
    else await p2.click('[data-a="open"]');
    await p2.waitForSelector('.head h2');
    await p2.click('[data-a="editVehicle"]');
    await p2.waitForSelector('[name="name"]');
    await p2.fill('[name="name"]', 'Audi A4 Avant');
    await p2.click('[data-a="ok"]');
    await p2.waitForFunction(() => !document.getElementById('sheet').classList.contains('open'));

    const gespeichert = await p2.evaluate(async () => {
      const roh = await store.get('akte:index');
      return roh ? JSON.parse(roh).ids : null;
    });
    ok(!!gespeichert && gespeichert.includes(idA),
      `Nach dem Speichern steht die unlesbare Kennung weiter in akte:index (${JSON.stringify(gespeichert)})`);
    ok(fehler2.length === 0, `Keine JS-Fehler im Lesefehler-Fall${fehler2.length ? ': ' + fehler2.join(' | ') : ''}`);
    await ctx.close();
  }

  // ---------------------------------------------------------------- Teil 2
  // Ein Lesefehler an der Liste selbst: keine leere Garage behaupten, und auf
  // keinen Fall die Liste überschreiben.
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.click('[data-a="addVehicle"]');
    await page.fill('[name="name"]', 'BMW 320i');
    await page.click('[data-a="ok"]');
    await page.waitForSelector('.head h2');
    const vorher = await page.evaluate(() => store.get('akte:index'));

    const p2 = page;
    const fehler = [];
    watchErrors(p2, fehler);
    await leseFehlerFuer(p2, ['akte:index']);
    await p2.reload({ waitUntil: 'networkidle' });
    await p2.waitForSelector('#speicherAlarm');

    ok(await p2.evaluate(() => gesperrt === true), 'Die App sperrt das Schreiben der Liste');
    ok((await p2.textContent('#speicherAlarm')).includes('nicht lesen'),
      'Die Garage sagt im Klartext, dass der Speicher nicht lesbar war');
    ok((await p2.locator('.empty').count()) === 1, 'Es steht keine Karte da, die es nicht gibt');

    // Ein Speicherversuch darf die Liste nicht anfassen. Gelesen wird am
    // gestellten Fehler vorbei, sonst prüfte man den Haken statt die App.
    await p2.evaluate(() => saveIndex());
    const nachher = await p2.evaluate(() => window.__roh('akte:index'));
    ok(nachher === vorher && !!vorher,
      `akte:index im Speicher ist unverändert (${JSON.stringify(nachher)})`);
    ok(fehler.length === 0, `Keine JS-Fehler im Listenfall${fehler.length ? ': ' + fehler.join(' | ') : ''}`);
    await ctx.close();
  }

  // ---------------------------------------------------------------- Teil 3
  // Eine echte Waise - Kennung in der Liste, Datensatz nachweislich weg -
  // darf gestrichen werden. Sonst stünden Platzhalter für Daten, die es
  // wirklich nicht mehr gibt.
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.click('[data-a="addVehicle"]');
    await page.fill('[name="name"]', 'Opel Astra');
    await page.click('[data-a="ok"]');
    await page.waitForSelector('.head h2');
    await page.evaluate(async () => {
      IDX.push('gibtsnicht');
      await saveIndex();
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.head h2, .grid');
    ok(!(await page.evaluate(() => IDX.includes('gibtsnicht'))),
      'Eine echte Waise wird aus der Liste gestrichen');
    ok((await page.locator('.card.mini.tot').count()) === 0,
      'Für eine echte Waise steht kein Platzhalter da');
    await ctx.close();
  }

  // ---------------------------------------------------------------- Teil 4
  // Datenrettung: ein verwaister Datensatz in IndexedDB, der nicht in der
  // Liste steht - genau das Bild nach einem verlorenen Index.
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    watchErrors(page, errors);
    page.on('dialog', d => d.dismiss());
    await page.goto(base, { waitUntil: 'networkidle' });

    await page.evaluate(async () => {
      const akte = {
        id: 'waise1',
        v: { name: 'Mercedes 190E', variant: '', plate: 'M-XY 99', year: '1990', km: 210000,
             tuev: '', vin: '', hsn: '', tsn: '', service: '', serviceKm: '', power: '', displacement: '', fuel: '' },
        logs: [{ id: 'l1', title: 'Zahnriemen', type: 'Wartung', date: '2026-01-05' },
               { id: 'l2', title: 'Bremsen', type: 'Reparatur', date: '2026-02-05' }],
        parts: [{ id: 'p1', name: 'Luftfilter' }],
        docs: [], cover: false
      };
      await store.set('akte:v:waise1', JSON.stringify(akte));
    });
    await page.click('[data-a="settings"]');
    await page.waitForSelector('[data-a="rettung"]');
    ok((await page.locator('#rettung .d').count()) === 0, 'Vor dem Suchen steht kein Ergebnis da');

    await page.click('[data-a="rettung"]');
    // Auf das Ergebnis warten, nicht auf einen Treffer: Findet die Rettung
    // nichts, soll die Prüfung rot werden und benennen, was fehlt - nicht die
    // Reihe mit einem Zeitablauf abbrechen.
    await page.waitForFunction(() => !!rettung);
    const text = (await page.textContent('#rettung')).replace(/\s+/g, ' ');
    ok(text.includes('Mercedes 190E'), 'Die Rettung findet den verwaisten Datensatz');
    ok(text.includes('M-XY 99'), 'Mit Kennzeichen');
    ok(/2 Logbuch/.test(text), `Und mit den Anzahlen (${text.match(/\d+ Logbuch[^·]*/) || ''})`);

    if (await page.locator('[data-a="rettungHolen"]').count()) {
      await page.click('[data-a="rettungHolen"]');
      await page.waitForFunction(() => IDX.includes('waise1')).catch(() => {});
    }
    ok(await page.evaluate(() => IDX.includes('waise1')),
      'Zurückholen nimmt das Fahrzeug in die Liste auf');

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => IDX.includes('waise1')).catch(() => {});
    ok(await page.evaluate(() => !!(VEH['waise1'] && VEH['waise1'].v.name === 'Mercedes 190E')),
      'Das zurückgeholte Fahrzeug übersteht ein Neuladen');
    ok(errors.length === 0, `Keine JS-Fehler bei der Rettung${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }

  // ---------------------------------------------------------------- Teil 5
  // Die Rettung muss in *beiden* Speichern suchen. Rutscht die App still von
  // IndexedDB auf localStorage ab, liegen die Daten im anderen - und sucht man
  // nur im benutzten, findet man nie etwas.
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.on('dialog', d => d.dismiss());
    await page.goto(base, { waitUntil: 'networkidle' });
    ok(await page.evaluate(() => speicherArt === 'idb'), 'Benutzt wird IndexedDB');

    await page.evaluate(() => {
      localStorage.setItem('akte:v:nurls', JSON.stringify({
        id: 'nurls', v: { name: 'Ford Capri', plate: 'K-LS 1' }, logs: [], parts: [], docs: [], cover: false
      }));
    });
    await page.click('[data-a="settings"]');
    await page.click('[data-a="rettung"]');
    await page.waitForFunction(() => !!rettung);
    ok((await page.textContent('#rettung')).includes('Ford Capri'),
      'Ein Datensatz im Notspeicher wird gefunden, obwohl IndexedDB benutzt wird');

    if (await page.locator('[data-a="rettungHolen"]').count()) {
      await page.click('[data-a="rettungHolen"]');
      await page.waitForFunction(() => IDX.includes('nurls')).catch(() => {});
    }
    const umgezogen = await page.evaluate(() => store.get('akte:v:nurls').then(r => !!r));
    ok(umgezogen, 'Beim Holen wandert er in den benutzten Speicher');
    await ctx.close();
  }

  // ---------------------------------------------------------------- Teil 6
  // Ein leeres Ergebnis ist auch eine Antwort und wird benannt.
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.click('[data-a="settings"]');
    await page.click('[data-a="rettung"]');
    await page.waitForFunction(() => !!rettung);
    const text = (await page.textContent('#rettung')).replace(/\s+/g, ' ');
    ok(text.includes('wirklich weg'),
      'Ein leeres Ergebnis wird benannt, nicht verschwiegen');
    ok(/IndexedDB 0 Fahrzeuge/.test(text) || /0 Fahrzeuge/.test(text),
      `Die Zahlen beider Speicher stehen da (${text.slice(0, 90)})`);
    await ctx.close();
  }

  // ---------------------------------------------------------------- Teil 7
  // Die Speicheranzeige sagt die Wahrheit über den Schutz.
  for (const [wert, erwartet, alarm] of [[true, 'ja', false], [false, 'nein', true]]) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.addInitScript(w => {
      Object.defineProperty(navigator.storage, 'persist', { configurable: true, value: async () => w });
      Object.defineProperty(navigator.storage, 'persisted', { configurable: true, value: async () => w });
    }, wert);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.click('[data-a="settings"]');
    await page.waitForSelector('[data-a="rettung"]');
    const sicht = (await page.textContent('#view')).replace(/\s+/g, ' ');
    const zeile = sicht.match(/Vor dem Räumen geschützt\s*(\S+)/);
    ok(!!zeile && zeile[1] === erwartet,
      `Bei persisted()=${wert} steht "${erwartet}" da (${zeile ? zeile[1] : 'nichts'})`);
    ok(sicht.includes('nicht gewährt') === alarm,
      `Die Warnung erscheint${alarm ? '' : ' nicht'}, wenn der Schutz ${wert ? 'besteht' : 'fehlt'}`);

    await page.goBack();
    await page.waitForSelector('.empty, .grid');
    const hat = await page.evaluate(() => {
      const a = document.getElementById('speicherAlarm');
      return a ? a.textContent : '';
    });
    ok(hat.includes('nicht geschützt') === alarm,
      `Der Garagenhinweis zum Schutz erscheint${alarm ? '' : ' nicht'}`);
    await ctx.close();
  }

  // ---------------------------------------------------------------- Teil 8
  // Letzte Sicherung: ohne eine wird gemahnt, mit einer frischen nicht, mit
  // einer alten wieder.
  {
    const ctx = await browser.newContext({ acceptDownloads: true });
    const page = await ctx.newPage();
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.click('[data-a="addVehicle"]');
    await page.fill('[name="name"]', 'Mazda MX-5');
    await page.click('[data-a="ok"]');
    await page.waitForSelector('.head h2');
    await page.goBack();
    await page.waitForSelector('.grid');
    ok((await page.textContent('#speicherAlarm')).includes('Noch keine Sicherung'),
      'Ohne Sicherung mahnt die Garage');

    await page.click('[data-a="settings"]');
    await page.waitForSelector('[data-a="backupOut"]');
    ok((await page.textContent('#sicherStat')) === 'noch keine',
      'Die Einstellungen sagen "noch keine"');
    await Promise.all([page.waitForEvent('download'), page.click('[data-a="backupOut"]')]);
    // Auf das neu Gezeichnete warten, nicht auf die Variable: backupOut setzt
    // sicherungDatum und zeichnet erst danach. Alleine lief der Test grün durch,
    // im vollen Lauf verlor er das Wettrennen.
    await page.waitForFunction(() => {
      const el = document.getElementById('sicherStat');
      return el && el.textContent.includes('heute');
    });
    ok(true, 'Nach der Sicherung steht das heutige Datum da');

    await page.goBack();
    await page.waitForSelector('.grid');
    ok((await page.locator('#speicherAlarm').count()) === 0
       || !(await page.textContent('#speicherAlarm')).includes('Sicherung'),
      'Die Mahnung ist weg');

    // 40 Tage zurückstellen: Die Frist steht auf 30.
    await page.evaluate(async () => {
      const d = new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10);
      await store.set('akte:sicherung', d);
    });
    await page.reload({ waitUntil: 'networkidle' });
    // Mit genau einem Fahrzeug startet die App auf dessen Karte - dort gibt es
    // keine Garagenhinweise, also erst einen Schritt zurück.
    await page.waitForSelector('.head h2, .grid');
    if (await page.locator('.head h2').count()) {
      await page.goBack();
      await page.waitForSelector('.grid');
    }
    await page.waitForSelector('#speicherAlarm');
    ok((await page.textContent('#speicherAlarm')).includes('vor 40 Tagen'),
      'Eine alte Sicherung wird wieder angemahnt');
    await ctx.close();
  }
}
