/* Gemeinsame Bausteine der Testreihen: Webserver, Browser, Protokoll. */
import { chromium } from 'playwright';
import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  return chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
}

export function reporter(name) {
  const r = { name, pass: 0, fail: 0, failed: [] };
  r.ok = (cond, label) => {
    if (cond) r.pass++; else { r.fail++; r.failed.push(label); }
    console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`);
  };
  return r;
}

/* Sammelt Seitenfehler und Konsolenfehler einer Seite ein. */
export function watchErrors(page, errors) {
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
}
