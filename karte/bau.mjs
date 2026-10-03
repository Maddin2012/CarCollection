/* Baut die Installationskarte: karte/CarCollection-Installieren.png (zum
   Weiterschicken) und .pdf (zum Ausdrucken). Neu bauen, wenn sich Adresse,
   Bedienweg oder Aussehen ändern:  npm run karte
   Die Adresse kommt aus CLAUDE.md - dieselbe Quelle prüft die Testreihe
   "Installationskarte", damit eine veraltete Karte auffällt. */
import QR from 'qrcode';
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const D = REPO + 'karte/';
export const adresse = () => {
  const m = readFileSync(REPO + 'CLAUDE.md', 'utf8').match(/`(https:\/\/[^`]+)`/);
  if (!m) throw new Error('Keine Adresse in CLAUDE.md gefunden');
  return m[1];
};
const URL_APP = adresse();
const [host, ...pfad] = URL_APP.replace('https://', '').split('/');
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
const qr = await QR.toString(URL_APP, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, color: { dark: '#10151F', light: '#FFFFFF' } });
const icon = 'data:image/png;base64,' + readFileSync(REPO + 'icons/icon-512.png').toString('base64');
const html = `<!doctype html><meta charset=utf-8><style>
*{box-sizing:border-box} body{margin:0;background:#10151F;color:#E9EDF5;font:28px/1.4 Roboto,"DejaVu Sans",system-ui,sans-serif}
.k{width:1080px;padding:64px 72px 72px}
.kopf{display:flex;align-items:center;gap:28px}
.marke{width:300px;aspect-ratio:2/1;overflow:hidden;display:flex;align-items:center;justify-content:center;flex:none}
.marke img{width:100%;flex:none}
h1{margin:0;font-size:64px;letter-spacing:.01em;background:linear-gradient(135deg,#EBDCA9,#8C7838 45%,#F3E7BC 75%,#EBDCA9);-webkit-background-clip:text;background-clip:text;color:transparent}
.unter{color:#8C97AE;font-size:28px;margin-top:4px}
.qr{display:flex;gap:40px;align-items:center;margin:44px 0 40px;padding:32px;border:2px solid #2C3649;border-radius:28px;background:#171E2B}
.qr .code{width:330px;height:330px;flex:none;background:#fff;border-radius:18px;padding:8px}
.qr .code svg{width:100%;height:100%;display:block}
.qr b{display:block;font-size:30px;margin-bottom:10px} .url{color:#D2B26A;font-size:29px;word-break:break-all;font-weight:700}
h2{font-size:34px;margin:36px 0 14px;color:#D2B26A}
ol{margin:0;padding-left:40px} li{margin:6px 0}
.platt{display:grid;grid-template-columns:1fr 1fr;gap:28px}
.platt>div{background:#171E2B;border:2px solid #2C3649;border-radius:24px;padding:24px 28px}
.platt h3{margin:0 0 10px;font-size:30px}
.hinweis{color:#C9D1E0}
.not{margin-top:40px;border:2px solid #2C3649;border-left:10px solid #F0A04B;border-radius:24px;background:#171E2B;padding:26px 32px}
.not h2{margin:0 0 12px;color:#F0A04B}
.not h3{margin:18px 0 6px;font-size:29px}
.warn{color:#F0A04B;font-weight:700}
em{font-style:normal;color:#fff;font-weight:700}
.fuss{margin-top:36px;color:#8C97AE;font-size:24px;text-align:center}
</style><div class=k>
<div class=kopf><div class=marke><img src="${icon}"></div><div><h1>CarCollection</h1><div class=unter>Deine Fahrzeugakte auf dem Handy</div></div></div>
<div class=qr><div class=code>${qr}</div><div><b>Mit der Kamera scannen<br>oder Link öffnen:</b><div class=url>${host}<br>/${pfad.join('/')}</div></div></div>
<h2>Installieren</h2>
<div class=platt>
<div><h3>Android · Chrome</h3><ol><li>Link in <em>Chrome</em> öffnen</li><li><em>⋮</em> oben rechts</li><li><em>„App installieren"</em></li></ol></div>
<div><h3>iPhone · Safari</h3><ol><li>Link in <em>Safari</em> öffnen (nicht Chrome)</li><li><em>Teilen</em>-Symbol</li><li><em>„Zum Home-Bildschirm"</em></li></ol></div>
</div>
<h2>Gut zu wissen</h2>
<div class=hinweis>Alle Daten bleiben auf deinem Handy – nichts geht an einen Server. Jedes Handy hat seine eigene Garage und startet leer.<br>
Regelmäßig sichern: Zahnrad oben rechts → <em>„Sicherung speichern"</em> → Google Drive.</div>
<div class=not><h2>Notfall</h2>
<h3>Neues Handy oder Garage leer</h3>
<div>App installieren → Zahnrad → <em>„Sicherung einlesen"</em> → Sicherungsdatei aus Drive wählen.</div>
<h3>Chrome meldet „Diese App wurde bereits installiert"</h3>
<div>Chrome → <em>⋮</em> → Einstellungen → Website-Einstellungen → Alle Websites → <em>${host}</em> → <em>Löschen und zurücksetzen</em>. Danach neu installieren und die Sicherung einlesen.</div>
<div class=warn style="margin-top:10px">Achtung: Das löscht die Garage auf diesem Handy – vorher Sicherung speichern!</div>
</div>
<div class=fuss>${URL_APP}</div>
</div>`;
writeFileSync(D + '.karte.html', html);
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const p = await b.newPage({ viewport: { width: 1080, height: 800 }, deviceScaleFactor: 1 });
await p.goto('file://' + D + '.karte.html'); await p.waitForTimeout(300);
const el = await p.$('.k');
await el.screenshot({ path: D + 'CarCollection-Installieren.png' });
const h = await p.evaluate(() => document.querySelector('.k').offsetHeight);
await p.pdf({ path: D + 'CarCollection-Installieren.pdf', width: '1080px', height: (h + 2) + 'px', printBackground: true, pageRanges: '1' });
await b.close();
unlinkSync(D + '.karte.html');
console.log('Karte gebaut für', URL_APP);
}
