/* Gemeinsame Bausteine der Testreihen: Webserver, Browser, Protokoll. */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

export const REPO = fileURLToPath(new URL('..', import.meta.url));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.md': 'text/markdown; charset=utf-8',
  '.pdf': 'application/pdf'
};

/* Liefert das Repository aus. Port 0 heißt: einen freien wählen lassen,
   damit parallele Läufe sich nicht ins Gehege kommen. */
export function serve(root = REPO) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = join(root, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    try {
      if (!statSync(file).isFile()) throw new Error('keine Datei');
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
      createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404');
    }
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    // localhost statt 127.0.0.1: nur dann gilt die Seite als sicherer
    // Kontext, und nur dann läuft der Service Worker.
    resolve({ base: `http://localhost:${port}/`, close: () => new Promise(r => server.close(r)) });
  }));
}

/* CHROMIUM_PATH setzen, wenn ein vorinstalliertes Chromium genutzt werden soll,
   das nicht zu Playwrights eigener Ablage gehört. Sonst sucht Playwright selbst. */
export function launch() {
  return chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    // Eine vorgespielte Kamera, damit der Scan-Weg wirklich durchlaufen wird und
    // nicht nur das Vorhandensein von Schaltflächen geprüft ist. Geliefert wird
    // ein bewegtes Farbbild in der angefragten Auflösung.
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
  });
}

export function reporter(name) {
  const r = { name, pass: 0, fail: 0, failed: [] };
  r.ok = (cond, label) => {
    if (cond) r.pass++; else { r.fail++; r.failed.push(label); }
    console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`);
  };
  return r;
}

/* Ein PNG bekannter Maße bauen. Die Icons im Repository sind alle quadratisch -
   damit ließe sich eine Drehung nicht von einem Nichtstun unterscheiden.
   malen(x,y) liefert [r,g,b] für jeden Punkt. */
export function png(w, h, malen) {
  const roh = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0, p = 0; y < h; y++) {
    roh[p++] = 0;                                  // Filtertyp "keiner"
    for (let x = 0; x < w; x++) {
      const [r, g, b] = malen(x, y);
      roh[p++] = r; roh[p++] = g; roh[p++] = b;
    }
  }
  const crcTab = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    crcTab[n] = c >>> 0;
  }
  const crc = buf => {
    let c = 0xFFFFFFFF;
    for (const b of buf) c = crcTab[(c ^ b) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };
  const chunk = (typ, daten) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(daten.length);
    const koerper = Buffer.concat([Buffer.from(typ, 'ascii'), daten]);
    const pruef = Buffer.alloc(4); pruef.writeUInt32BE(crc(koerper));
    return Buffer.concat([len, koerper, pruef]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;                        // 8 Bit, Echtfarben ohne Alpha
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(roh)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* Liegt an der Mitte dieser Schaltfläche wirklich sie selbst - oder deckt
   etwas sie zu? Ein zu groß dargestelltes Bild hat genau das getan: Der Knopf
   war da, sichtbar und aktiv, aber nicht zu treffen. Vorhandensein allein
   belegt also nichts. */
export function frei(page, selektor) {
  return page.evaluate(s => {
    const b = document.querySelector(s);
    if (!b) return false;
    const r = b.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const oben = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !!oben && (oben === b || b.contains(oben));
  }, selektor);
}

/* Seit Schritt 7 schiebt sich der Zuschnitt zwischen Auswahl und Ablegen.
   Wer ihn nicht prüfen will, winkt ihn hiermit unverändert durch - genau wie
   ein Nutzer, der nichts ändern möchte: zweimal tippen. */
export async function bildDurchwinken(page) {
  await page.waitForSelector('#edit:not([hidden]) [data-a="editUeber"]');
  await page.click('[data-a="editUeber"]');
  await page.waitForSelector('[data-a="editSpeichern"]');
  await page.click('[data-a="editSpeichern"]');
  await page.waitForSelector('#edit[hidden]', { state: 'attached' });
}

/* Sammelt Seitenfehler und Konsolenfehler einer Seite ein. */
export function watchErrors(page, errors) {
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
}
