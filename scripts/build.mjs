// Baut dist/Velmar.html: eine einzelne, offline spielbare Datei.
// Aufruf: node scripts/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const three = read('web/vendor/three.min.js');
const game = read('web/src/game.js');
for (const [name, src] of [['three.min.js', three], ['game.js', game]]) {
  if (/<\/script/i.test(src)) { console.error(`FEHLER: ${name} enthält "</script"`); process.exit(1); }
}
const html = read('web/src/index.template.html')
  .replace('/*THREE_JS*/', () => three)
  .replace('/*GAME_JS*/', () => game);
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/Velmar.html'), html);
console.log(`OK: dist/Velmar.html (${(html.length / 1024).toFixed(0)} KB)`);
