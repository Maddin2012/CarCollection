/* Führt alle Testreihen gegen einen lokalen Webserver aus.
   Aufruf: npm test   (oder: node tests/run.mjs) */
import { serve, launch, reporter } from './lib.mjs';
import * as grundfunktionen from './grundfunktionen.test.mjs';
import * as sicherung from './sicherung.test.mjs';
import * as plattformen from './plattformen.test.mjs';

const suiten = [grundfunktionen, sicherung, plattformen];

const { base, close } = await serve();
const browser = await launch();
const berichte = [];

try {
  for (const suite of suiten) {
    console.log(`\n== ${suite.name} ==`);
    const r = reporter(suite.name);
    try {
      await suite.default({ browser, base, ok: r.ok });
    } catch (e) {
      r.ok(false, `Testreihe abgebrochen: ${e.message.split('\n')[0]}`);
    }
    berichte.push(r);
  }
} finally {
  await browser.close();
  await close();
}

const pass = berichte.reduce((a, r) => a + r.pass, 0);
const fail = berichte.reduce((a, r) => a + r.fail, 0);

console.log('\n== Ergebnis ==');
for (const r of berichte) console.log(`  ${r.name}: ${r.pass} bestanden, ${r.fail} fehlgeschlagen`);
console.log(`  Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen`);

if (fail) {
  console.log('\nFehlgeschlagen:');
  for (const r of berichte) for (const l of r.failed) console.log(`  ${r.name}: ${l}`);
  process.exit(1);
}
