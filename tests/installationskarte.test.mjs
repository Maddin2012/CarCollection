/* Installationskarte (karte/): Der QR-Code im eingecheckten Bild muss genau
   auf die Adresse führen, unter der die App ausgeliefert wird. Die Adresse hat
   sich schon zweimal geändert (/CarCollection/ -> /Garage/ -> zurück); eine
   Karte, die ins Leere führt, fiele sonst erst beim Kumpel auf. Neu bauen:
   npm run karte */
import { readFileSync, existsSync } from 'node:fs';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { REPO } from './lib.mjs';
import { adresse } from '../karte/bau.mjs';

export const name = 'Installationskarte';

export default async function ({ ok }) {
  const soll = adresse();
  ok(/^https:\/\/[^/]+\/.+\/$/.test(soll), `Die Adresse aus CLAUDE.md ist vollständig (${soll})`);

  const pngPfad = REPO + 'karte/CarCollection-Installieren.png';
  ok(existsSync(pngPfad), 'Das Bild der Karte liegt im Repository');
  if (existsSync(pngPfad)) {
    const png = PNG.sync.read(readFileSync(pngPfad));
    const qr = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    ok(!!qr, `Der QR-Code im Bild ist lesbar (${png.width}×${png.height})`);
    ok(qr && qr.data === soll, `Er führt genau auf die Adresse der App (${qr && qr.data})`);
  }

  const pdfPfad = REPO + 'karte/CarCollection-Installieren.pdf';
  ok(existsSync(pdfPfad), 'Die PDF der Karte liegt im Repository');
  if (existsSync(pdfPfad)) {
    const pdf = readFileSync(pdfPfad);
    ok(pdf.subarray(0, 5).toString() === '%PDF-', 'Sie ist eine PDF');
    const seiten = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    ok(seiten === 1, `Sie hat genau eine Seite (${seiten})`);
  }

  // Die README verweist auf die Karte - der Verweis soll nicht ins Leere gehen.
  const readme = readFileSync(REPO + 'README.md', 'utf8');
  const verweise = [...readme.matchAll(/\]\((karte\/[^)]+)\)/g)].map(m => m[1]);
  ok(verweise.length >= 2, `Die README verweist auf Bild und PDF (${verweise.length})`);
  ok(verweise.every(v => existsSync(REPO + v)), 'Jeder Verweis führt auf eine vorhandene Datei');
}
