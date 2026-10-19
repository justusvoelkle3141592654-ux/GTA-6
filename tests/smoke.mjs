// Automatischer Smoke-Test im Headless-Chromium (Software-Rendering).
// Aufruf: node tests/smoke.mjs [ausgabeordner]
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || join(root, 'tests/out');
mkdirSync(out, { recursive: true });
const errors = [];
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} ${info}`); };

const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('file://' + join(root, 'dist/Velmar.html'));
await page.waitForTimeout(1500);
await page.screenshot({ path: join(out, '01_hauptmenue.png') });
const G = (fn, arg) => page.evaluate(fn, arg);

await page.getByText('Neues Spiel').click();
await page.waitForTimeout(1500);
check('Spiel gestartet', await G(() => __velmar.state === 'play'));
check('Mission 1 aktiv', await G(() => __velmar.mission.active && __velmar.mission.active.idx === 0));
await page.screenshot({ path: join(out, '02_start.png') });

// Zu Fuß laufen
const p0 = await G(() => [__velmar.player.x, __velmar.player.z]);
await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
const p1 = await G(() => [__velmar.player.x, __velmar.player.z]);
check('Figur bewegt sich', Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 1, JSON.stringify([p0, p1].map((p) => p.map(Math.round))));

// Mission 1
await G(() => __velmar.teleport(...__velmar.PLACES.kiosk));
await page.waitForTimeout(500);
check('M1 Schritt 2 (Einsteigen)', await G(() => __velmar.mission.active.step === 1));
await G(() => __velmar.teleport(149, 126));
await page.waitForTimeout(300);
await page.keyboard.press('KeyF');
await page.waitForTimeout(300);
check('In Pico eingestiegen', await G(() => __velmar.player.inCar && __velmar.player.inCar.type === 'pico'));
await page.keyboard.down('KeyW'); await page.waitForTimeout(2500);
const sp = await G(() => __velmar.player.inCar.speed);
await page.screenshot({ path: join(out, '03_fahren.png') });
await page.keyboard.up('KeyW');
check('Auto fährt', sp > 3, 'speed=' + sp.toFixed(1));
await G(() => __velmar.teleport(...__velmar.PLACES.garage));
await page.waitForTimeout(500);
check('Mission 1 erfüllt', await G(() => __velmar.mission.done === 1));
check('Autosave geschrieben', await G(() => !!localStorage.getItem('velmar_save_auto')));

// Mission 2
await page.keyboard.press('KeyF'); await page.waitForTimeout(300);
await G(() => __velmar.teleport(...__velmar.PLACES.m2start)); await page.waitForTimeout(500);
check('Mission 2 aktiv', await G(() => __velmar.mission.active && __velmar.mission.active.idx === 1));
await G(() => __velmar.teleport(355, 195)); await page.waitForTimeout(300);
await page.keyboard.press('KeyF'); await page.waitForTimeout(300);
check('In Kastor eingestiegen', await G(() => __velmar.player.inCar && __velmar.player.inCar.type === 'kastor'));
check('Zeitlimit läuft', await G(() => __velmar.mission.active.timeLeft > 80));
await G(() => __velmar.teleport(...__velmar.PLACES.westkai)); await page.waitForTimeout(500);
check('Mission 2 erfüllt', await G(() => __velmar.mission.done === 2));

// Mission 3
await G(() => __velmar.teleport(...__velmar.PLACES.m3start)); await page.waitForTimeout(500);
check('Mission 3 aktiv', await G(() => __velmar.mission.active && __velmar.mission.active.idx === 2));
await G(() => __velmar.teleport(...__velmar.PLACES.ostkai)); await page.waitForTimeout(500);
check('Fahndungsstufe 2 nach Abholung', await G(() => __velmar.law.level === 2));
await page.waitForFunction(() => __velmar.cars.some((c) => c.police && c.ai && c.ai.mode === 'chase'), null, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(3000);
const police = await G(() => __velmar.cars.filter((c) => c.police && c.ai && c.ai.mode === 'chase').length);
check('Polizei verfolgt', police >= 1, 'Streifen=' + police);
await page.screenshot({ path: join(out, '04_polizei.png') });
await G(() => __velmar.teleport(...__velmar.PLACES.versteck)); await page.waitForTimeout(500);
check('Versteck gesperrt solange gesucht', await G(() => __velmar.mission.done === 2));
await G(() => __velmar.setWanted(0)); await page.waitForTimeout(500);
check('Mission 3 erfüllt', await G(() => __velmar.mission.done === 3));

// Polizei abhängen per Timer (ohne Sichtkontakt)
await G(() => __velmar.setWanted(1));
await G(() => { for (const c of [...__velmar.cars]) if (c.police) c.wrecked = true; });
await page.waitForFunction(() => __velmar.law.level === 0, null, { timeout: 90000 }).catch(() => {});
check('Fahndung endet nach Timer ohne Sichtkontakt', await G(() => __velmar.law.level === 0));

// Speichern / Laden
const saved = await G(() => { __velmar.player.money = 4321; return __velmar.writeSave(1); });
check('Slot 1 gespeichert', saved);
await G(() => localStorage.setItem('velmar_save_2', '{kaputt'));
const info2 = await G(() => __velmar.readSaveInfo(2));
check('Defekter Spielstand erkannt', info2 && info2.ok === false, info2 && info2.error);
const err2 = await G(() => __velmar.loadSave(2));
check('Defekter Spielstand stürzt nicht ab', typeof err2 === 'string' && await G(() => __velmar.state === 'play'), err2);
await G(() => { __velmar.player.money = 1; });
const err1 = await G(() => __velmar.loadSave(1));
check('Slot 1 geladen', err1 === null && await G(() => __velmar.player.money === 4321 && __velmar.mission.done === 3));

// 60 Sekunden laufen lassen (Smoke-Test), mit Fahren
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
check('Pausemenü', await G(() => __velmar.state === 'pause'));
await page.screenshot({ path: join(out, '05_pause.png') });
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
await G(() => __velmar.teleport(215, 280));
const c = await G(() => { const n = __velmar.nearestEnterableCar(); return !!n; });
const t0 = Date.now();
while (Date.now() - t0 < 60000) {
  await page.keyboard.down('KeyW');
  await page.keyboard.down(Math.random() < 0.5 ? 'KeyA' : 'KeyD');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyA'); await page.keyboard.up('KeyD');
  await page.waitForTimeout(1500);
}
await page.keyboard.up('KeyW');
const stats = await G(() => ({ fps: __velmar.fps, cars: __velmar.cars.length, peds: __velmar.peds.length, state: __velmar.state }));
check('60 s Dauerlauf ohne Fehler', errors.length === 0, JSON.stringify(stats));
await page.screenshot({ path: join(out, '06_stadt.png') });

// Kartenrand / Wasser
await G(() => __velmar.teleport(300, 572));
await page.keyboard.down('KeyS'); await page.waitForTimeout(2000); await page.keyboard.up('KeyS');
const z = await G(() => __velmar.player.z);
check('Spieler bleibt vor dem Wasser', z < 575, 'z=' + z.toFixed(1));

console.log('\nFehler im Browser:', errors.length ? errors : 'keine');
const failed = results.filter((r) => !r.ok).length;
console.log(`\nErgebnis: ${results.length - failed}/${results.length} bestanden`);
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
