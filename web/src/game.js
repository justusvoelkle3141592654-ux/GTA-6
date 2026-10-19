// Velmar – Open-World-Prototyp (Browser-Version, Three.js)
// Alle Inhalte (Stadt, Namen, Figuren, Texte, Töne) sind selbst erstellt bzw. zur Laufzeit erzeugt.
(function () {
'use strict';

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
function angDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------------------------------------------------------------------------
// Konfiguration (Daten statt Code)
// ---------------------------------------------------------------------------
const SAVE_VERSION = 1;
const BLOCK = 70, NB = 8, CITY = BLOCK * NB, WATER_Z = CITY + 15, LANE = 3.5;

const CFG = {
  quality: {
    niedrig: { shadow: 0, dpr: 1, traffic: 8, peds: 14 },
    mittel: { shadow: 1024, dpr: 1.5, traffic: 12, peds: 22 },
    hoch: { shadow: 2048, dpr: 2, traffic: 16, peds: 30 },
  },
  wantedPolice: [0, 2, 3, 5],   // gleichzeitige Streifen je Fahndungsstufe
  escapeTime: [0, 10, 14, 18],  // Sekunden ohne Sichtkontakt bis zum Verlust
  sightRange: 90, closeSight: 25,
  arrestDist: 6.5, arrestTime: 3,
  trafficSpeed: 11,
};

// Fahrzeugdaten (eigene Namen und Designs)
const VEH = {
  pico:    { name: 'Pico',       w: 1.8,  h: 1.5, l: 3.9, max: 33, acc: 13,  steer: 2.1, hp: 100, colors: [0x6fc2a8, 0xe8c547, 0x4f7fc9, 0xd9d9d9, 0xb5523b, 0x7b6aa8] },
  falkner: { name: 'Falkner GT', w: 2.0,  h: 1.2, l: 4.5, max: 50, acc: 22,  steer: 2.3, hp: 80,  colors: [0xc8302c, 0x222222] },
  kastor:  { name: 'Kastor',     w: 2.2,  h: 2.5, l: 5.4, max: 26, acc: 8.5, steer: 1.6, hp: 160, colors: [0xeeeeee, 0x9aa6b0, 0xd6c27a] },
  streife: { name: 'Streife',    w: 1.95, h: 1.5, l: 4.4, max: 41, acc: 18,  steer: 2.2, hp: 140, colors: [0x1f3f8f] },
};

// Fußgänger-Varianten
const PED_VARIANTS = [
  { shirt: 0x3d6fb6, pants: 0x2b2b33, skin: 0xe0b48f },
  { shirt: 0xb84a3e, pants: 0x4a4038, skin: 0xc68e62 },
  { shirt: 0x5c9a5a, pants: 0x30343c, skin: 0x8d5a3b },
  { shirt: 0xd9c25a, pants: 0x3b4a6b, skin: 0xf0cfae },
  { shirt: 0x8b5fa8, pants: 0x222222, skin: 0xa8734f },
];

const PLACES = {
  start: [78.5, 100], kiosk: [148.5, 112], garage: [354, 175], m2start: [341.5, 168],
  westkai: [35, 490], m3start: [105, 490], ostkai: [430, 562], versteck: [105, 280],
  hospital: [218.5, 230], policeStation: [288.5, 430],
};

const MISSIONS = [
  {
    title: 'Ankunft', start: PLACES.start, reward: 300, keep: 'pico',
    intro: 'Du bist mit der Fähre in Velmar angekommen. Deine Cousine Ilka erwartet dich an ihrem Kiosk.',
    spawn: [{ id: 'pico', type: 'pico', pos: [146, 126], h: 0, color: 0x6fc2a8 }],
    steps: [
      { type: 'goto', pos: PLACES.kiosk, r: 3, onFoot: true, text: 'Geh zu Ilkas Kiosk.' },
      { type: 'enter', veh: 'pico', text: 'Steig in den Pico.',
        say: 'Ilka: „Da bist du ja! Brunos alter Pico steht gleich vorne an der Straße. Bring ihn bitte zu seiner Werkstatt.“' },
      { type: 'goto', pos: PLACES.garage, r: 6, veh: 'pico', text: 'Fahr den Pico zu Brunos Werkstatt.' },
    ],
    outro: 'Bruno: „Läuft ja noch, die alte Kiste. Behalt ihn – als Anzahlung für deinen nächsten Job.“',
  },
  {
    title: 'Eilige Lieferung', start: PLACES.m2start, reward: 600, critical: ['van'],
    intro: 'Bruno: „Ein Kunde am Westkai wartet dringend auf Ersatzteile. Nimm den Kastor und beeil dich!“',
    spawn: [{ id: 'van', type: 'kastor', pos: [356.5, 192], h: 0, color: 0xeeeeee }],
    steps: [
      { type: 'enter', veh: 'van', text: 'Steig in den Lieferwagen Kastor.' },
      { type: 'goto', pos: PLACES.westkai, r: 6, veh: 'van', time: 90, text: 'Liefere die Teile zum Westkai, bevor die Zeit abläuft.' },
    ],
    outro: 'Kunde: „Gerade noch rechtzeitig. Grüß Bruno von mir.“',
  },
  {
    title: 'Hafennacht', start: PLACES.m3start, reward: 1000,
    intro: 'Ilka: „Am Ostkai steht eine Kiste mit meinen Sachen. Die Hafenwache ist neugierig – hol sie und lass dich nicht erwischen.“',
    steps: [
      { type: 'goto', pos: PLACES.ostkai, r: 6, text: 'Hol die Kiste am Ostkai ab.' },
      { type: 'setWanted', level: 2, say: 'Hafenwache: „Halt! Stehen bleiben!“ – Die Polizei wurde alarmiert.' },
      { type: 'lose', text: 'Häng die Polizei ab.' },
      { type: 'goto', pos: PLACES.versteck, r: 6, clean: true, text: 'Bring die Kiste zu Ilkas Versteck.' },
    ],
    outro: 'Ilka: „Danke dir. Jetzt kennst du die Stadt – sie gehört dir.“ Alle Missionen erfüllt – freies Spiel.',
  },
];

const CRIME_TEXT = {
  theft: 'Fahrzeugdiebstahl wurde gemeldet!',
  copcar: 'Streifenwagen gestohlen!',
  hitped: 'Ein Zeuge hat den Unfall gemeldet!',
  accident: 'Unfall mit Sachschaden gemeldet!',
  hitcop: 'Angriff auf einen Streifenwagen!',
};

// ---------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('velmar_settings') || '{}');
    return {
      volume: typeof s.volume === 'number' ? clamp(s.volume, 0, 1) : 0.7,
      quality: CFG.quality[s.quality] ? s.quality : 'mittel',
    };
  } catch (e) { return { volume: 0.7, quality: 'mittel' }; }
}
const settings = loadSettings();
function saveSettings() { try { localStorage.setItem('velmar_settings', JSON.stringify(settings)); } catch (e) { /* Speicher nicht verfügbar */ } }
const Q = () => CFG.quality[settings.quality];

// ---------------------------------------------------------------------------
// Renderer, Szene, Licht
// ---------------------------------------------------------------------------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const SKY = 0xa9c9e2;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 160, 420);
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.5, 900);
scene.add(new THREE.HemisphereLight(0xe4f0ff, 0x5a6248, 1.6));
const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
sun.position.set(60, 120, 30);
const sc = sun.shadow.camera;
sc.left = -90; sc.right = 90; sc.top = 90; sc.bottom = -90; sc.near = 10; sc.far = 320;
sun.shadow.bias = -0.0008;
scene.add(sun); scene.add(sun.target);

function applyQuality() {
  const q = Q();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.dpr));
  const want = q.shadow > 0;
  if (renderer.shadowMap.enabled !== want || (want && sun.shadow.mapSize.x !== q.shadow)) {
    renderer.shadowMap.enabled = want;
    sun.castShadow = want;
    if (want) {
      sun.shadow.mapSize.set(q.shadow, q.shadow);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    scene.traverse((o) => {
      if (!o.material) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; });
    });
  }
}
applyQuality();
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const matCache = {};
function lam(color) { return matCache[color] || (matCache[color] = new THREE.MeshLambertMaterial({ color })); }

// ---------------------------------------------------------------------------
// Kollisionsdaten (achsenparallele Boxen in einem Raster)
// ---------------------------------------------------------------------------
const boxes = [];
const grid = new Map();
const gkey = (i, j) => i * 1000 + j;
const EDGES = [
  { minX: -90, maxX: -12, minZ: -90, maxZ: WATER_Z + 90, h: 9 },
  { minX: CITY + 12, maxX: CITY + 90, minZ: -90, maxZ: WATER_Z + 90, h: 9 },
  { minX: -90, maxX: CITY + 90, minZ: -90, maxZ: -12, h: 9 },
  { minX: -90, maxX: CITY + 90, minZ: WATER_Z - 1, maxZ: WATER_Z + 90, h: 0 },
];
function addBox(b) {
  boxes.push(b);
  const i0 = Math.floor(b.minX / BLOCK), i1 = Math.floor(b.maxX / BLOCK);
  const j0 = Math.floor(b.minZ / BLOCK), j1 = Math.floor(b.maxZ / BLOCK);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const k = gkey(i, j);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(b);
  }
}
function forBoxesNear(x, z, fn) {
  const i = Math.floor(x / BLOCK), j = Math.floor(z / BLOCK);
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
    const l = grid.get(gkey(i + di, j + dj));
    if (l) for (let n = 0; n < l.length; n++) fn(l[n]);
  }
  for (let n = 0; n < EDGES.length; n++) fn(EDGES[n]);
}
// Kreis gegen Box: liefert Normale und Eindringtiefe oder null
function circleBox(px, pz, r, b) {
  const cx = clamp(px, b.minX, b.maxX), cz = clamp(pz, b.minZ, b.maxZ);
  const dx = px - cx, dz = pz - cz, d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 < 1e-8) {
    const l = px - b.minX, rr = b.maxX - px, t = pz - b.minZ, bt = b.maxZ - pz;
    const m = Math.min(l, rr, t, bt);
    if (m === l) return { nx: -1, nz: 0, pen: l + r };
    if (m === rr) return { nx: 1, nz: 0, pen: rr + r };
    if (m === t) return { nx: 0, nz: -1, pen: t + r };
    return { nx: 0, nz: 1, pen: bt + r };
  }
  const d = Math.sqrt(d2);
  return { nx: dx / d, nz: dz / d, pen: r - d };
}
// Strecke gegen Box (Slab-Test), liefert t in [0,1] oder Infinity
function segBox(x1, z1, x2, z2, b) {
  let tmin = 0, tmax = 1;
  const dx = x2 - x1, dz = z2 - z1;
  if (Math.abs(dx) < 1e-9) { if (x1 < b.minX || x1 > b.maxX) return Infinity; }
  else {
    let t1 = (b.minX - x1) / dx, t2 = (b.maxX - x1) / dx;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  if (Math.abs(dz) < 1e-9) { if (z1 < b.minZ || z1 > b.maxZ) return Infinity; }
  else {
    let t1 = (b.minZ - z1) / dz, t2 = (b.maxZ - z1) / dz;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}
function segBlocked(x1, z1, x2, z2, minH) {
  const lx = Math.min(x1, x2), hx = Math.max(x1, x2), lz = Math.min(z1, z2), hz = Math.max(z1, z2);
  let best = Infinity;
  for (let n = 0; n < boxes.length; n++) {
    const b = boxes[n];
    if (b.h < minH || b.maxX < lx || b.minX > hx || b.maxZ < lz || b.minZ > hz) continue;
    const t = segBox(x1, z1, x2, z2, b);
    if (t < best) best = t;
  }
  return best;
}
function insideAnyBox(x, z, r) {
  let hit = false;
  forBoxesNear(x, z, (b) => { if (!hit && circleBox(x, z, r, b)) hit = true; });
  return hit;
}
function groundY(x, z) {
  if (x < 7 || z < 7 || x > CITY - 7 || z > CITY - 7) return 0.02;
  const mx = x % BLOCK, mz = z % BLOCK;
  return (mx > 7 && mx < 63 && mz > 7 && mz < 63) ? 0.2 : 0.02;
}

// ---------------------------------------------------------------------------
// Stadtgenerierung (fester Seed, damit die Stadt immer gleich aussieht)
// ---------------------------------------------------------------------------
const rnd = mulberry32(20261019);

function makeWindowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#56677a'; g.fillRect(12, 14, 40, 34);
  g.fillStyle = '#8ea4bb'; g.fillRect(12, 14, 40, 9);
  g.fillStyle = '#d8d8d8'; g.fillRect(10, 48, 44, 3);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const winTex = makeWindowTex();
const wallMats = [0xd8c9b0, 0xc9b49a, 0xb9c6cf, 0xe3dccd, 0xaab8a2, 0xd1ab92, 0xa3b4c8, 0xc4c0b8]
  .map((c) => new THREE.MeshLambertMaterial({ color: c, map: winTex }));
const towerMats = [0x8fa9c2, 0x9fb4c0, 0x7f93a8, 0xb7c3cc]
  .map((c) => new THREE.MeshLambertMaterial({ color: c, map: winTex }));
const roofMat = lam(0x5b5f63);

function buildingGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], null, null, [w, h], [w, h]]; // +x,-x,+y,-y,+z,-z
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    if (!dims[f]) { uv.setXY(i, 0.02, 0.02); continue; }
    uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(dims[f][0] / 4)), uv.getY(i) * Math.max(1, Math.round(dims[f][1] / 3.5)));
  }
  return g;
}
function addBuilding(x0, z0, w, d, h, mat) {
  const m = new THREE.Mesh(buildingGeo(w, h, d), [mat, mat, roofMat, roofMat, mat, mat]);
  m.position.set(x0 + w / 2, h / 2 + 0.2, z0 + d / 2);
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  addBox({ minX: x0, maxX: x0 + w, minZ: z0, maxZ: z0 + d, h });
}
function addBoxMesh(w, h, d, x, y, z, color, collide) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(color));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  if (collide) addBox({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h: y + h / 2 });
  return m;
}
function makeSign(text, x, y, z, rotY, w, h, bg, fg) {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w);
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = fg; g.font = `bold ${Math.round(c.height * 0.55)}px system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t }));
  m.position.set(x, y, z); m.rotation.y = rotY;
  scene.add(m);
}

const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 3, 6);
const crownGeo = new THREE.IcosahedronGeometry(2.2, 0);
function addTree(x, z, collide) {
  const t = new THREE.Mesh(trunkGeo, lam(0x6b4a2f)); t.position.set(x, 1.7, z); t.castShadow = true; scene.add(t);
  const c = new THREE.Mesh(crownGeo, lam(rnd() < 0.5 ? 0x4f7f3a : 0x5d8c44)); c.position.set(x, 4.4, z); c.castShadow = true; scene.add(c);
  if (collide) addBox({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4, h: 6 });
}

function district(i, j) {
  if (i === 2 && j === 5) return 'park';
  if (j === 7) return 'hafen';
  if (i === 4 && j === 3) return 'turm';
  if ((i === 3 || i === 4) && j >= 2 && j <= 4) return 'innenstadt';
  return 'wohnen';
}

function buildCity() {
  // Boden, Asphalt, Kai, Wasser
  const groundDepth = WATER_Z + 700;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1500, groundDepth), lam(0x76935a));
  ground.rotation.x = -Math.PI / 2; ground.position.set(CITY / 2, 0, WATER_Z - groundDepth / 2); ground.receiveShadow = true;
  scene.add(ground);
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(CITY + 14, CITY + 14), lam(0x3c3f44));
  asphalt.rotation.x = -Math.PI / 2; asphalt.position.set(CITY / 2, 0.01, CITY / 2); asphalt.receiveShadow = true;
  scene.add(asphalt);
  const quay = new THREE.Mesh(new THREE.PlaneGeometry(CITY + 40, WATER_Z - CITY - 7), lam(0x8b877e));
  quay.rotation.x = -Math.PI / 2; quay.position.set(CITY / 2, 0.012, (CITY + 7 + WATER_Z) / 2); quay.receiveShadow = true;
  scene.add(quay);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1500, 700), new THREE.MeshLambertMaterial({ color: 0x2f6f8f }));
  water.rotation.x = -Math.PI / 2; water.position.set(CITY / 2, -0.6, WATER_Z + 350);
  scene.add(water);
  addBoxMesh(CITY + 40, 1, 1, CITY / 2, -0.5, WATER_Z, 0x6f6b64, false);
  // Poller entlang der Kaikante
  for (let x = -6; x <= CITY + 6; x += 8) addBoxMesh(0.4, 0.9, 0.4, x, 0.45, WATER_Z - 1.3, 0x333333, false);

  // Mittelstreifen (instanziert)
  const dashGeo = new THREE.BoxGeometry(0.22, 0.03, 2.6);
  const dashes = [];
  for (let k = 0; k <= NB; k++) {
    for (let t = -4; t <= CITY + 4; t += 6) {
      const m = ((t % BLOCK) + BLOCK) % BLOCK;
      if (m < 9 || m > BLOCK - 9) continue;
      dashes.push([k * BLOCK, t, 0]); dashes.push([t, k * BLOCK, Math.PI / 2]);
    }
  }
  const inst = new THREE.InstancedMesh(dashGeo, lam(0xe8e2c8), dashes.length);
  const o = new THREE.Object3D();
  dashes.forEach((d, n) => { o.position.set(d[0], 0.03, d[1]); o.rotation.set(0, d[2], 0); o.updateMatrix(); inst.setMatrixAt(n, o.matrix); });
  scene.add(inst);

  // Blöcke
  for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
    const cx = i * BLOCK + BLOCK / 2, cz = j * BLOCK + BLOCK / 2;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(56, 0.2, 56), lam(0xaaa79f));
    slab.position.set(cx, 0.1, cz); slab.receiveShadow = true; scene.add(slab);
    const dist = district(i, j);
    const lotColor = { park: 0x5f8f4a, hafen: 0x8a8478, innenstadt: 0x9a978f, turm: 0x9a978f, wohnen: 0x87986f }[dist];
    const lot = new THREE.Mesh(new THREE.BoxGeometry(50, 0.22, 50), lam(lotColor));
    lot.position.set(cx, 0.11, cz); lot.receiveShadow = true; scene.add(lot);
    const lx = i * BLOCK + 10, lz = j * BLOCK + 10, L = 50;

    if (dist === 'park') {
      for (let n = 0; n < 22; n++) {
        const x = lx + 3 + rnd() * (L - 6), z = lz + 3 + rnd() * (L - 6);
        if (Math.abs(x - cx) < 7 && Math.abs(z - cz) < 7) continue;
        addTree(x, z, true);
      }
      const f = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.4, 0.8, 20), lam(0xb8b3a8));
      f.position.set(cx, 0.6, cz); scene.add(f);
      const w = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.1, 20), lam(0x4f93b8));
      w.position.set(cx, 1.0, cz); scene.add(w);
      addBox({ minX: cx - 4, maxX: cx + 4, minZ: cz - 4, maxZ: cz + 4, h: 1 });
    } else if (dist === 'hafen') {
      addBuilding(lx, lz, L, 20, 9 + rnd() * 4, lam(0xa7a29a));
      const cc = [0xb5523b, 0x3b6fb5, 0x4f9a5a, 0xd0a23a, 0x7a7f86];
      for (let r = 0; r < 3; r++) for (let s = 0; s < 2; s++) {
        if (rnd() < 0.2) continue;
        addBoxMesh(12, 2.6, 2.6, lx + 8 + s * 30, 1.5, lz + 27 + r * 7, pick(cc), true);
        if (rnd() < 0.5) addBoxMesh(12, 2.6, 2.6, lx + 8 + s * 30, 4.1, lz + 27 + r * 7, pick(cc), false);
      }
    } else if (dist === 'turm') {
      addBuilding(lx + 7, lz + 7, 36, 36, 118, towerMats[2]);
      addBuilding(lx + 12, lz + 12, 26, 26, 132, towerMats[3]);
    } else {
      const tall = dist === 'innenstadt';
      for (let qa = 0; qa < 2; qa++) for (let qb = 0; qb < 2; qb++) {
        const w = (tall ? 20 : 18) + rnd() * 3, d = (tall ? 20 : 18) + rnd() * 3;
        const x0 = qa === 0 ? lx : lx + L - w, z0 = qb === 0 ? lz : lz + L - d;
        const h = tall ? 30 + rnd() * 55 : 8 + rnd() * 15;
        addBuilding(x0, z0, w, d, h, tall ? pick(towerMats) : wallMats[Math.floor(rnd() * wallMats.length)]);
      }
      if (!tall) addTree(cx, cz, true);
    }
  }

  // Wahrzeichen und Schilder
  makeSign('KIOSK', 149.9, 3.4, 112, -Math.PI / 2, 6, 1.2, '#c0392b', '#ffffff');
  makeSign('BRUNOS WERKSTATT', 359.9, 4.2, 175, -Math.PI / 2, 12, 1.6, '#24496b', '#f2c14e');
  makeSign('KRANKENHAUS', 219.9, 5, 230, -Math.PI / 2, 10, 1.5, '#ffffff', '#c0392b');
  makeSign('POLIZEI', 289.9, 5, 430, -Math.PI / 2, 8, 1.4, '#1f3f8f', '#ffffff');
  makeSign('VELMAR TOWER', 315, 20, 247.9, Math.PI, 20, 3, '#1b2430', '#e8e2c8');
  // Leuchtturm auf einer kleinen Insel
  const isl = new THREE.Mesh(new THREE.CylinderGeometry(14, 16, 2, 24), lam(0x8b877e)); isl.position.set(CITY + 40, -0.2, WATER_Z + 45); scene.add(isl);
  for (let n = 0; n < 6; n++) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(2.6 - n * 0.2, 2.8 - n * 0.2, 4, 16), lam(n % 2 ? 0xffffff : 0xc0392b));
    s.position.set(CITY + 40, 2.8 + n * 4, WATER_Z + 45); s.castShadow = true; scene.add(s);
  }
  // Stadtgrenze: Zaun und Hügel am Horizont
  for (const [x, z, w, d] of [[-11, CITY / 2, 0.3, CITY + 24], [CITY + 11, CITY / 2, 0.3, CITY + 24], [CITY / 2, -11, CITY + 24, 0.3]]) {
    addBoxMesh(w, 1.2, d, x, 0.6, z, 0x6f6b64, false);
  }
  const hillMat = lam(0x5f7d4a);
  for (let n = 0; n < 16; n++) {
    const a = (n / 16) * Math.PI * 1.1 + Math.PI * 0.95;
    const r = 520 + rnd() * 120;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(80 + rnd() * 60, 12, 8), hillMat);
    hill.scale.y = 0.35 + rnd() * 0.3;
    hill.position.set(CITY / 2 + Math.cos(a) * r, -10, CITY / 2 + Math.sin(a) * r);
    scene.add(hill);
  }
  for (let n = 0; n < 40; n++) {
    const side = n % 3;
    const x = side === 0 ? -20 - rnd() * 60 : side === 1 ? CITY + 20 + rnd() * 60 : rnd() * CITY;
    const z = side === 2 ? -20 - rnd() * 60 : rnd() * CITY;
    addTree(x, z, false);
  }
}
buildCity();

// ---------------------------------------------------------------------------
// Straßennetz für KI
// ---------------------------------------------------------------------------
const nodePos = (n) => [n[0] * BLOCK, n[1] * BLOCK];
function neighbors(n) {
  const r = [];
  if (n[0] > 0) r.push([n[0] - 1, n[1]]);
  if (n[0] < NB) r.push([n[0] + 1, n[1]]);
  if (n[1] > 0) r.push([n[0], n[1] - 1]);
  if (n[1] < NB) r.push([n[0], n[1] + 1]);
  return r;
}
const sameNode = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
const nearestNode = (x, z) => [clamp(Math.round(x / BLOCK), 0, NB), clamp(Math.round(z / BLOCK), 0, NB)];

// ---------------------------------------------------------------------------
// Figuren
// ---------------------------------------------------------------------------
const limbGeo = new THREE.BoxGeometry(0.17, 0.82, 0.2);
const armGeo = new THREE.BoxGeometry(0.12, 0.66, 0.14);
const torsoGeo = new THREE.BoxGeometry(0.5, 0.68, 0.3);
const headGeo = new THREE.SphereGeometry(0.16, 10, 8);
function buildPerson(v, scale) {
  const g = new THREE.Group();
  const mk = (geo, mat, x, y, z, pivotY) => {
    const piv = new THREE.Group(); piv.position.set(x, pivotY, z);
    const m = new THREE.Mesh(geo, mat); m.position.y = y - pivotY; m.castShadow = true;
    piv.add(m); g.add(piv); return piv;
  };
  const legL = mk(limbGeo, lam(v.pants), -0.11, 0.42, 0, 0.84);
  const legR = mk(limbGeo, lam(v.pants), 0.11, 0.42, 0, 0.84);
  mk(torsoGeo, lam(v.shirt), 0, 1.18, 0, 1.18);
  const armL = mk(armGeo, lam(v.shirt), -0.32, 1.17, 0, 1.48);
  const armR = mk(armGeo, lam(v.shirt), 0.32, 1.17, 0, 1.48);
  mk(headGeo, lam(v.skin), 0, 1.7, 0, 1.7);
  g.scale.setScalar(scale || 1);
  g.userData.limbs = [legL, legR, armL, armR];
  scene.add(g);
  return g;
}
function animatePerson(g, phase, moving) {
  const s = Math.sin(phase) * 0.7 * moving;
  const [legL, legR, armL, armR] = g.userData.limbs;
  legL.rotation.x = s; legR.rotation.x = -s; armL.rotation.x = -s * 0.8; armR.rotation.x = s * 0.8;
}

// ---------------------------------------------------------------------------
// Fahrzeuge
// ---------------------------------------------------------------------------
const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 12); wheelGeo.rotateZ(Math.PI / 2);
const wheelMat = lam(0x1d1d1f), glassMat = lam(0x2a3a48), tailMat = new THREE.MeshLambertMaterial({ color: 0x8a1d1d, emissive: 0x550000 });
let carIdCounter = 0;

function buildCarMesh(type, color) {
  const d = VEH[type];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff6d8, emissive: 0xfff2c0, emissiveIntensity: 0.15 });
  const box = (w, h, l, x, y, z, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat);
    m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
  };
  const ud = { bodyMat, headMat, pivots: [], bars: [] };
  if (type === 'kastor') {
    box(d.w, d.h - 0.35, d.l * 0.68, 0, 0.35 + (d.h - 0.35) / 2, -d.l * 0.16, bodyMat);
    box(d.w * 0.98, 0.9, d.l * 0.32, 0, 0.8, d.l * 0.34, bodyMat);
    box(d.w * 0.94, 0.75, d.l * 0.3, 0, 1.62, d.l * 0.33, [glassMat, glassMat, bodyMat, bodyMat, glassMat, glassMat]);
  } else {
    const bh = d.h * 0.42;
    box(d.w, bh, d.l, 0, 0.35 + bh / 2, 0, bodyMat);
    const ch = d.h * 0.4, cabMat = type === 'streife' ? lam(0xf2f2f2) : bodyMat;
    box(d.w * 0.86, ch, d.l * (type === 'falkner' ? 0.42 : 0.5), 0, 0.35 + bh + ch / 2, -d.l * 0.06,
      [glassMat, glassMat, cabMat, cabMat, glassMat, glassMat]);
    if (type === 'streife') {
      const top = 0.35 + bh + ch + 0.08;
      for (const sx of [-0.4, 0.4]) {
        const m = new THREE.MeshLambertMaterial({ color: 0x2a5cff, emissive: 0x1030ff, emissiveIntensity: 0.1 });
        ud.bars.push(m);
        box(0.7, 0.16, 0.3, sx, top, -d.l * 0.06, m);
      }
    }
  }
  const fy = 0.35 + (type === 'kastor' ? 0.5 : d.h * 0.25);
  for (const sx of [-1, 1]) {
    box(0.42, 0.18, 0.05, sx * (d.w / 2 - 0.35), fy, d.l / 2 + 0.01, headMat);
    box(0.36, 0.16, 0.05, sx * (d.w / 2 - 0.32), fy, -d.l / 2 - 0.01, tailMat);
  }
  for (const sz of [1, -1]) for (const sx of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(sx * (d.w / 2 - 0.08), 0.38, sz * (d.l / 2 - 0.8));
    const w = new THREE.Mesh(wheelGeo, wheelMat); piv.add(w); g.add(piv);
    if (sz === 1) ud.pivots.push(piv);
  }
  g.userData = ud;
  scene.add(g);
  return g;
}

class Car {
  constructor(type, x, z, h, color) {
    this.id = ++carIdCounter;
    this.type = type; this.d = VEH[type];
    this.x = x; this.z = z; this.h = h; this.y = groundY(x, z);
    this.speed = 0; this.hp = this.d.hp; this.wrecked = false;
    this.police = type === 'streife';
    this.mesh = buildCarMesh(type, color != null ? color : pick(this.d.colors));
    this.driver = null; // 'player' | 'ai' | null
    this.ai = null; this.steerVis = 0; this.lights = false; this.thr = 0;
    this.smokeT = 0; this.persistent = false;
  }
  circles() {
    const d = this.d, r = d.w * 0.55, off = d.l / 2 - r;
    const fx = Math.sin(this.h), fz = Math.cos(this.h);
    return [[this.x + fx * off, this.z + fz * off, r], [this.x - fx * off, this.z - fz * off, r]];
  }
}
let cars = [];

function spawnCar(type, x, z, h, color) { const c = new Car(type, x, z, h, color); cars.push(c); return c; }
function removeCar(c) {
  scene.remove(c.mesh);
  c.mesh.traverse((o) => { if (o.geometry && o.geometry !== wheelGeo) o.geometry.dispose(); });
  c.mesh.userData.bodyMat.dispose(); c.mesh.userData.headMat.dispose();
  c.mesh.userData.bars.forEach((m) => m.dispose());
  cars = cars.filter((o) => o !== c);
  if (ownedCar === c) ownedCar = null;
}
function damageCar(c, amount) {
  if (c.wrecked || amount <= 0) return;
  c.hp -= amount;
  if (c.hp <= 0) {
    c.hp = 0; c.wrecked = true; c.speed *= 0.3;
    c.mesh.userData.bodyMat.color.multiplyScalar(0.35);
    if (c.driver === 'player') { exitCar(); toast('Totalschaden! Das Fahrzeug ist hinüber.'); }
    else if (c.driver === 'ai') { const p = spawnPedAt(c.x + 3, c.z); if (p) flee(p, c.x, c.z); c.driver = null; c.ai = null; }
  }
}

// Arcade-Fahrphysik: Gas thr [-1..1], Lenkung str [-1..1] (+ = rechts), Handbremse hb
function driveCar(c, thr, str, hb, dt) {
  const d = c.d;
  if (c.wrecked) { thr = 0; hb = true; }
  c.thr = thr;
  if (thr > 0) {
    if (c.speed < -0.5) c.speed += 24 * thr * dt;
    else c.speed += d.acc * thr * Math.max(0, 1 - c.speed / d.max) * 1.35 * dt;
  } else if (thr < 0) {
    if (c.speed > 0.5) c.speed += 26 * thr * dt;
    else c.speed = Math.max(-9, c.speed + d.acc * 0.6 * thr * dt);
  } else {
    const f = 2.5 * dt;
    c.speed = Math.abs(c.speed) < f ? 0 : c.speed - Math.sign(c.speed) * f;
  }
  if (hb) { const f = 16 * dt; c.speed = Math.abs(c.speed) < f ? 0 : c.speed - Math.sign(c.speed) * f; }
  c.speed -= c.speed * 0.04 * dt;
  const sp = c.speed;
  const steerFactor = Math.min(1, Math.abs(sp) / 6) * (1 - Math.min(0.45, Math.abs(sp) / d.max * 0.45));
  c.h -= d.steer * str * steerFactor * (hb ? 1.6 : 1) * Math.sign(sp) * dt;
  c.x += Math.sin(c.h) * sp * dt;
  c.z += Math.cos(c.h) * sp * dt;
  c.steerVis = lerp(c.steerVis, -str * 0.5, Math.min(1, 10 * dt));
  collideCarWorld(c);
}

function collideCarWorld(c) {
  let impact = 0;
  const vx = Math.sin(c.h) * c.speed, vz = Math.cos(c.h) * c.speed;
  for (const circ of c.circles()) {
    forBoxesNear(circ[0], circ[1], (b) => {
      const hit = circleBox(circ[0], circ[1], circ[2], b);
      if (!hit) return;
      c.x += hit.nx * hit.pen; c.z += hit.nz * hit.pen;
      circ[0] += hit.nx * hit.pen; circ[1] += hit.nz * hit.pen;
      const vn = -(vx * hit.nx + vz * hit.nz);
      if (vn > impact) impact = vn;
    });
  }
  if (impact > 1.5) {
    c.speed *= impact > 8 ? 0.25 : 0.75;
    if (impact > 5) damageCar(c, (impact - 5) * 4);
    if (c.driver === 'player') {
      if (impact > 14) hurtPlayer((impact - 14) * 2.5);
      audio.crash(Math.min(1, impact / 20));
      shake = Math.min(1, impact / 15);
    }
  }
}

function collideCars() {
  for (let a = 0; a < cars.length; a++) for (let b = a + 1; b < cars.length; b++) {
    const A = cars[a], B = cars[b];
    if (Math.abs(A.x - B.x) > 8 || Math.abs(A.z - B.z) > 8) continue;
    const ca = A.circles(), cb = B.circles();
    let impact = 0;
    for (const p of ca) for (const q of cb) {
      const dx = p[0] - q[0], dz = p[1] - q[1], d = Math.hypot(dx, dz), rr = p[2] + q[2];
      if (d >= rr || d < 1e-6) continue;
      const nx = dx / d, nz = dz / d, pen = (rr - d) / 2;
      A.x += nx * pen; A.z += nz * pen; B.x -= nx * pen; B.z -= nz * pen;
      const rv = (Math.sin(A.h) * A.speed - Math.sin(B.h) * B.speed) * nx + (Math.cos(A.h) * A.speed - Math.cos(B.h) * B.speed) * nz;
      if (-rv > impact) impact = -rv;
    }
    if (impact > 2) {
      A.speed *= 0.6; B.speed *= 0.6;
      if (impact > 5) { damageCar(A, (impact - 5) * 3); damageCar(B, (impact - 5) * 3); }
      const pc = A.driver === 'player' ? A : B.driver === 'player' ? B : null;
      if (pc) {
        const other = pc === A ? B : A;
        audio.crash(Math.min(1, impact / 18)); shake = Math.min(1, impact / 15);
        if (impact > 14) hurtPlayer((impact - 14) * 2);
        if (other.police) crime('hitcop', pc.x, pc.z);
        else if (other.driver === 'ai' && impact > 5) crime('accident', pc.x, pc.z);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Spieler
// ---------------------------------------------------------------------------
const player = { x: 0, z: 0, h: 0, health: 100, money: 100, inCar: null, phase: 0, moving: 0, hitCd: 0 };
player.mesh = buildPerson({ shirt: 0xe07b24, pants: 0x2d3a4f, skin: 0xd9a77e }, 1.05);
let ownedCar = null;
let shake = 0;

function hurtPlayer(n) { player.health = Math.max(0, player.health - n); }

function nearestEnterableCar() {
  let best = null, bd = Infinity;
  for (const c of cars) {
    if (c.wrecked) continue;
    const d = Math.sqrt(dist2(c.x, c.z, player.x, player.z)) - c.d.l / 2;
    if (d < 2.6 && d < bd) { bd = d; best = c; }
  }
  return best;
}
function enterCar(c) {
  if (c.driver === 'ai') {
    const rx = -Math.cos(c.h), rz = Math.sin(c.h);
    const p = spawnPedAt(c.x - rx * (c.d.w / 2 + 1), c.z - rz * (c.d.w / 2 + 1));
    if (p) flee(p, c.x, c.z);
    crime(c.police ? 'copcar' : 'theft', c.x, c.z);
  } else if (c.police) {
    crime('copcar', c.x, c.z);
  }
  c.ai = null; c.driver = 'player'; c.persistent = true;
  player.inCar = c; player.mesh.visible = false;
}
function exitCar() {
  const c = player.inCar;
  if (!c) return;
  const rx = -Math.cos(c.h), rz = Math.sin(c.h), off = c.d.w / 2 + 0.9;
  let ex = c.x + rx * off, ez = c.z + rz * off;
  if (insideAnyBox(ex, ez, 0.4)) { ex = c.x - rx * off; ez = c.z - rz * off; }
  if (insideAnyBox(ex, ez, 0.4)) { ex = c.x + Math.sin(c.h) * (c.d.l / 2 + 1); ez = c.z + Math.cos(c.h) * (c.d.l / 2 + 1); }
  player.x = ex; player.z = ez; player.h = c.h;
  c.driver = null; c.lights = false;
  player.inCar = null; player.mesh.visible = true;
}

function updatePlayerOnFoot(inp, dt) {
  player.hitCd -= dt;
  player.h -= inp.turn * 2.7 * dt;
  let spd = inp.fwd * (inp.sprint ? 7.2 : 4.2);
  if (inp.fwd < 0) spd *= 0.55;
  player.x += Math.sin(player.h) * spd * dt;
  player.z += Math.cos(player.h) * spd * dt;
  player.moving = Math.abs(spd) / 4.2;
  player.phase += Math.abs(spd) * dt * 2.2;
  forBoxesNear(player.x, player.z, (b) => {
    const hit = circleBox(player.x, player.z, 0.4, b);
    if (hit) { player.x += hit.nx * hit.pen; player.z += hit.nz * hit.pen; }
  });
  for (const c of cars) {
    if (Math.abs(c.x - player.x) > 6 || Math.abs(c.z - player.z) > 6) continue;
    for (const [cx, cz, r] of c.circles()) {
      const dx = player.x - cx, dz = player.z - cz, d = Math.hypot(dx, dz);
      if (d < r + 0.4 && d > 1e-6) {
        player.x += dx / d * (r + 0.4 - d); player.z += dz / d * (r + 0.4 - d);
        if (Math.abs(c.speed) > 5 && c.driver === 'ai' && player.hitCd <= 0) {
          hurtPlayer(Math.abs(c.speed) * 1.5); player.hitCd = 1.2; c.speed *= 0.5; audio.crash(0.5);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Fußgänger
// ---------------------------------------------------------------------------
let peds = [];
function blockRect(bi, bj) { return [bi * BLOCK + 8.5, bi * BLOCK + 61.5, bj * BLOCK + 8.5, bj * BLOCK + 61.5]; }
function pedCorner(p, k) {
  const [a, b, c, e] = blockRect(p.bi, p.bj);
  return [[a, c], [b, c], [b, e], [a, e]][k];
}
function nearestPerim(p) {
  const [a, b, c, e] = blockRect(p.bi, p.bj);
  const x = clamp(p.x, a, b), z = clamp(p.z, c, e);
  const da = x - a, db = b - x, dc = z - c, de = e - z, m = Math.min(da, db, dc, de);
  if (m === da) return [a, z]; if (m === db) return [b, z]; if (m === dc) return [x, c]; return [x, e];
}
function spawnPedAt(x, z) {
  const bi = clamp(Math.floor(x / BLOCK), 0, NB - 1), bj = clamp(Math.floor(z / BLOCK), 0, NB - 1);
  const v = pick(PED_VARIANTS);
  const p = { x, z, h: Math.random() * 6.28, bi, bj, state: 'return', timer: 0, target: 0, dir: Math.random() < 0.5 ? 1 : -1,
    speed: 1.2 + Math.random() * 0.5, phase: Math.random() * 6, moving: 0, fx: 0, fz: 0,
    mesh: buildPerson(v, 0.92 + Math.random() * 0.16) };
  peds.push(p);
  return p;
}
function spawnPedNear() {
  for (let t = 0; t < 10; t++) {
    const a = Math.random() * Math.PI * 2, r = 55 + Math.random() * 90;
    const x = player.x + Math.cos(a) * r, z = player.z + Math.sin(a) * r;
    if (x < 8 || z < 8 || x > CITY - 8 || z > CITY - 8) continue;
    const bi = Math.floor(x / BLOCK), bj = Math.floor(z / BLOCK);
    const q = nearestPerim({ x, z, bi, bj });
    const p = spawnPedAt(q[0], q[1]);
    p.state = 'walk';
    const [ra, rb, rc, re] = blockRect(bi, bj);
    const corners = [[ra, rc], [rb, rc], [rb, re], [ra, re]];
    let bk = 0, bd = Infinity;
    corners.forEach((cc, k) => { const d = dist2(cc[0], cc[1], q[0], q[1]); if (d < bd) { bd = d; bk = k; } });
    p.target = bk;
    return p;
  }
  return null;
}
function removePed(p) { scene.remove(p.mesh); peds = peds.filter((o) => o !== p); }
function flee(p, fx, fz) {
  if (p.state === 'down') return;
  p.state = 'flee'; p.timer = 3 + Math.random() * 2; p.fx = fx; p.fz = fz;
}
function scarePeds(x, z, r) { for (const p of peds) if (dist2(p.x, p.z, x, z) < r * r) flee(p, x, z); }

function updatePed(p, dt) {
  if (p.state === 'down') {
    p.timer -= dt;
    if (p.timer <= 0) { p.state = 'return'; p.mesh.rotation.x = 0; }
    return;
  }
  let tx, tz, spd;
  if (p.state === 'flee') {
    p.timer -= dt;
    const dx = p.x - p.fx, dz = p.z - p.fz, l = Math.hypot(dx, dz) || 1;
    tx = p.x + dx / l * 5; tz = p.z + dz / l * 5; spd = 4.6;
    if (p.timer <= 0) {
      p.state = 'return';
      p.bi = clamp(Math.floor(p.x / BLOCK), 0, NB - 1); p.bj = clamp(Math.floor(p.z / BLOCK), 0, NB - 1);
    }
  } else if (p.state === 'return') {
    const q = nearestPerim(p); tx = q[0]; tz = q[1]; spd = 1.6;
    if (dist2(p.x, p.z, tx, tz) < 0.5) {
      p.state = 'walk';
      let bk = 0, bd = Infinity;
      for (let k = 0; k < 4; k++) { const cc = pedCorner(p, k); const d = dist2(cc[0], cc[1], p.x, p.z); if (d < bd) { bd = d; bk = k; } }
      p.target = bk;
    }
  } else {
    const cc = pedCorner(p, p.target); tx = cc[0]; tz = cc[1]; spd = p.speed;
    if (dist2(p.x, p.z, tx, tz) < 0.6) p.target = (p.target + p.dir + 4) % 4;
  }
  const dx = tx - p.x, dz = tz - p.z;
  if (dx * dx + dz * dz > 0.0004) {
    p.h += angDiff(p.h, Math.atan2(dx, dz)) * Math.min(1, dt * 8);
    p.x += Math.sin(p.h) * spd * dt; p.z += Math.cos(p.h) * spd * dt;
    p.moving = Math.min(1.4, spd / 1.4); p.phase += spd * dt * 2.4;
  } else p.moving = 0;
  forBoxesNear(p.x, p.z, (b) => {
    const hit = circleBox(p.x, p.z, 0.35, b);
    if (hit) { p.x += hit.nx * hit.pen; p.z += hit.nz * hit.pen; }
  });
  // Fahrzeuge: Ausweichen, Anfahren
  for (const c of cars) {
    if (Math.abs(c.x - p.x) > 16 || Math.abs(c.z - p.z) > 16) continue;
    const as = Math.abs(c.speed);
    if (c.driver === 'player' && as > 9 && p.state === 'walk') {
      const fx = Math.sin(c.h), fz = Math.cos(c.h);
      if ((p.x - c.x) * fx + (p.z - c.z) * fz > 0) flee(p, c.x, c.z);
    }
    for (const [cx, cz, r] of c.circles()) {
      const ddx = p.x - cx, ddz = p.z - cz, d = Math.hypot(ddx, ddz);
      if (d >= r + 0.35 || d < 1e-6) continue;
      if (as > 5) {
        p.state = 'down'; p.timer = 5; p.mesh.rotation.x = -Math.PI / 2;
        p.x += ddx / d * 1.5; p.z += ddz / d * 1.5;
        c.speed *= 0.85;
        if (c.driver === 'player') { crime('hitped', p.x, p.z); audio.crash(0.3); scarePeds(p.x, p.z, 25); }
        return;
      }
      p.x += ddx / d * (r + 0.35 - d); p.z += ddz / d * (r + 0.35 - d);
    }
  }
}

// ---------------------------------------------------------------------------
// Verkehr und Polizei-KI
// ---------------------------------------------------------------------------
function trafficTarget(c) {
  const f = [Math.sign(c.ai.to[0] - c.ai.from[0]), Math.sign(c.ai.to[1] - c.ai.from[1])];
  const p = nodePos(c.ai.to);
  return [p[0] - f[1] * LANE, p[1] + f[0] * LANE];
}
function toTraffic(c) {
  const n = nearestNode(c.x, c.z);
  const nb = neighbors(n);
  let best = nb[0], bd = -Infinity;
  const fx = Math.sin(c.h), fz = Math.cos(c.h);
  for (const m of nb) { const s = (m[0] - n[0]) * fx + (m[1] - n[1]) * fz; if (s > bd) { bd = s; best = m; } }
  c.ai = { mode: 'traffic', from: n, to: best, wait: 0, ignore: 0, stuck: 0, rev: 0 };
  c.driver = 'ai';
}
function toChase(c) {
  c.ai = { mode: 'chase', node: nearestNode(c.x, c.z), prev: null, stuck: 0, rev: 0 };
  c.driver = 'ai';
}
function obstacleAhead(c, range) {
  const fx = Math.sin(c.h), fz = Math.cos(c.h), rx = -fz, rz = fx;
  const test = (x, z, w) => {
    const dx = x - c.x, dz = z - c.z, ah = dx * fx + dz * fz;
    return ah > 0 && ah < range && Math.abs(dx * rx + dz * rz) < w;
  };
  for (const o of cars) if (o !== c && Math.abs(o.x - c.x) < range + 3 && Math.abs(o.z - c.z) < range + 3 && test(o.x, o.z, 2.4)) return true;
  if (!player.inCar && test(player.x, player.z, 1.8)) return true;
  for (const p of peds) if (Math.abs(p.x - c.x) < range && Math.abs(p.z - c.z) < range && test(p.x, p.z, 1.6)) return true;
  return false;
}
function steerTo(c, tx, tz) { return clamp(-angDiff(c.h, Math.atan2(tx - c.x, tz - c.z)) * 2.2, -1, 1); }

function updateTraffic(c, dt) {
  const ai = c.ai;
  let [tx, tz] = trafficTarget(c);
  if (dist2(c.x, c.z, tx, tz) < 36) {
    const opts = neighbors(ai.to).filter((n) => !sameNode(n, ai.from));
    const straight = [ai.to[0] * 2 - ai.from[0], ai.to[1] * 2 - ai.from[1]];
    const st = opts.find((n) => sameNode(n, straight));
    const next = (st && Math.random() < 0.5) ? st : pick(opts.length ? opts : neighbors(ai.to));
    ai.from = ai.to; ai.to = next;
    [tx, tz] = trafficTarget(c);
  }
  const diff = Math.abs(angDiff(c.h, Math.atan2(tx - c.x, tz - c.z)));
  let target = CFG.trafficSpeed * (diff > 0.45 ? 0.55 : 1);
  if (ai.ignore > 0) ai.ignore -= dt;
  else if (obstacleAhead(c, 8 + Math.abs(c.speed) * 0.6)) {
    target = 0; ai.wait += dt;
    if (ai.wait > 3) { ai.wait = 0; ai.ignore = 1.5; if (dist2(c.x, c.z, player.x, player.z) < 900) audio.honk(0.3); }
  } else ai.wait = 0;
  const thr = c.speed < target - 0.5 ? 0.8 : c.speed > target + 1 ? -1 : 0;
  driveCar(c, thr, steerTo(c, tx, tz), false, dt);
}

function updateChase(c, dt) {
  const ai = c.ai;
  const tc = player.inCar;
  const px = player.x, pz = player.z;
  const vx = tc ? Math.sin(tc.h) * tc.speed : 0, vz = tc ? Math.cos(tc.h) * tc.speed : 0;
  const d = Math.sqrt(dist2(c.x, c.z, px, pz));
  let ax, az, nodeDist = Infinity;
  if (d < 45) { ax = px + vx * 0.6; az = pz + vz * 0.6; }
  else {
    const np = nodePos(ai.node);
    if (dist2(c.x, c.z, np[0], np[1]) < 100) {
      let best = null, bd = Infinity;
      for (const m of neighbors(ai.node)) {
        if (sameNode(m, ai.prev)) continue;
        const mp = nodePos(m), dd = dist2(mp[0], mp[1], px, pz);
        if (dd < bd) { bd = dd; best = m; }
      }
      ai.prev = ai.node; ai.node = best || ai.prev;
    }
    [ax, az] = nodePos(ai.node);
    nodeDist = Math.sqrt(dist2(c.x, c.z, ax, az));
  }
  const diff = Math.abs(angDiff(c.h, Math.atan2(ax - c.x, az - c.z)));
  let str = steerTo(c, ax, az), thr;
  if (ai.rev > 0) { ai.rev -= dt; driveCar(c, -1, -str, false, dt); return; }
  const stopDist = player.inCar ? 12 : 18;
  if (d < stopDist) thr = c.speed > (player.inCar ? 5 : 3) ? -1 : 0.3;
  else if (diff > 1.3 && c.speed > 14) thr = -0.6;
  else if (nodeDist < c.speed * 1.4 && c.speed > 15) thr = -0.8; // vor Kreuzungen abbremsen
  else thr = 1;
  if (thr > 0 && Math.abs(c.speed) < 1.5) { ai.stuck += dt; if (ai.stuck > 1.3) { ai.stuck = 0; ai.rev = 1.1; } }
  else ai.stuck = 0;
  driveCar(c, thr, str, diff > 1.6 && c.speed > 10, dt);
}

function randomNodeNear(minD, maxD) {
  for (let t = 0; t < 40; t++) {
    const n = [Math.floor(Math.random() * (NB + 1)), Math.floor(Math.random() * (NB + 1))];
    const p = nodePos(n), d = Math.sqrt(dist2(p[0], p[1], player.x, player.z));
    if (d >= minD && d <= maxD) return n;
  }
  return null;
}
function spaceFree(x, z, r) { return !cars.some((c) => dist2(c.x, c.z, x, z) < r * r); }
function spawnTraffic() {
  const n = randomNodeNear(110, 220);
  if (!n) return;
  const to = pick(neighbors(n));
  const fx = Math.sign(to[0] - n[0]), fz = Math.sign(to[1] - n[1]);
  const p = nodePos(n);
  const x = p[0] + fx * 12 - fz * LANE, z = p[1] + fz * 12 + fx * LANE;
  if (!spaceFree(x, z, 12)) return;
  const r = Math.random();
  const type = r < 0.6 ? 'pico' : r < 0.84 ? 'kastor' : r < 0.9 ? 'falkner' : 'streife';
  const c = spawnCar(type, x, z, Math.atan2(fx, fz));
  c.ai = { mode: 'traffic', from: n, to, wait: 0, ignore: 0, stuck: 0, rev: 0 };
  c.driver = 'ai'; c.speed = 8;
}
function spawnPolice() {
  const n = randomNodeNear(90, 170);
  if (!n) return;
  const p = nodePos(n);
  if (!spaceFree(p[0], p[1], 10)) return;
  const c = spawnCar('streife', p[0], p[1], Math.atan2(player.x - p[0], player.z - p[1]));
  toChase(c);
}

// ---------------------------------------------------------------------------
// Polizei und Fahndungsstufe
// ---------------------------------------------------------------------------
const law = { level: 0, unseen: 0, seen: false, arrest: 0, t: 0, spawnT: 0, cd: {} };
function hasWitness(x, z) {
  if (peds.some((p) => p.state !== 'down' && dist2(p.x, p.z, x, z) < 30 * 30)) return true;
  return cars.some((c) => c.police && !c.wrecked && c.driver === 'ai' && dist2(c.x, c.z, x, z) < 70 * 70);
}
function setWanted(l, quiet) {
  l = clamp(l, 0, 3);
  if (l === law.level) return;
  const up = l > law.level;
  law.level = l; law.unseen = 0;
  if (l === 0) {
    if (!quiet) toast('Die Polizei hat deine Spur verloren.');
    for (const c of cars) if (c.ai && c.ai.mode === 'chase') toTraffic(c);
  } else if (up && !quiet) toast('Fahndungsstufe ' + l);
}
function crime(kind, x, z) {
  if (law.cd[kind] > 0) return;
  law.cd[kind] = 3;
  const w = hasWitness(x, z);
  let lvl = law.level;
  if (kind === 'theft' || kind === 'accident') { if (w) lvl = Math.max(lvl, 1); }
  else if (kind === 'copcar') lvl = Math.max(lvl, 2);
  else if (kind === 'hitped') { if (w) lvl = Math.min(3, Math.max(1, lvl + 1)); }
  else if (kind === 'hitcop') lvl = Math.min(3, Math.max(1, lvl + 1));
  if (lvl > law.level) { setWanted(lvl, true); toast(CRIME_TEXT[kind] + ' Fahndungsstufe ' + lvl); }
}
function playerSpeed() { return player.inCar ? Math.abs(player.inCar.speed) : player.moving * 4.2; }

function updateLaw(dt) {
  for (const k in law.cd) law.cd[k] -= dt;
  if (law.level === 0) { law.arrest = 0; law.seen = false; return; }
  law.t -= dt;
  if (law.t <= 0) {
    law.t = 0.25;
    let seen = false;
    for (const c of cars) {
      if (!c.police || c.wrecked || c.driver !== 'ai') continue;
      const d2 = dist2(c.x, c.z, player.x, player.z);
      if (c.ai.mode !== 'chase' && d2 < 150 * 150) toChase(c);
      if (!seen && (d2 < CFG.closeSight * CFG.closeSight ||
          (d2 < CFG.sightRange * CFG.sightRange && segBlocked(c.x, c.z, player.x, player.z, 3) === Infinity))) seen = true;
    }
    law.seen = seen;
  }
  if (law.seen) law.unseen = 0; else law.unseen += dt;
  if (law.unseen > CFG.escapeTime[law.level]) { setWanted(0); return; }
  let close = false;
  for (const c of cars) if (c.police && !c.wrecked && c.driver === 'ai' && dist2(c.x, c.z, player.x, player.z) < CFG.arrestDist * CFG.arrestDist) close = true;
  if (close && playerSpeed() < 3) law.arrest += dt; else law.arrest = Math.max(0, law.arrest - dt * 2);
  if (law.arrest >= CFG.arrestTime) { busted(); return; }
  law.spawnT -= dt;
  if (law.spawnT <= 0) {
    law.spawnT = 1.5;
    const n = cars.filter((c) => c.police && c.ai && c.ai.mode === 'chase' && !c.wrecked).length;
    if (n < CFG.wantedPolice[law.level]) spawnPolice();
  }
}

function busted() {
  const fine = Math.min(player.money, 150);
  player.money -= fine;
  banner('FESTGENOMMEN', `Strafe: ${fine} $` + (mission.active ? ' – Mission fehlgeschlagen' : ''));
  afterIncident(PLACES.policeStation);
}
function wasted() {
  const fee = Math.min(player.money, 100);
  player.money -= fee;
  banner('IM KRANKENHAUS', `Behandlungskosten: ${fee} $` + (mission.active ? ' – Mission fehlgeschlagen' : ''));
  afterIncident(PLACES.hospital);
}
function afterIncident(pos) {
  if (mission.active) failMission(null);
  if (player.inCar) exitCar();
  setWanted(0, true);
  for (const c of [...cars]) if (c.police && c.driver === 'ai' && dist2(c.x, c.z, pos[0], pos[1]) < 60 * 60) removeCar(c);
  player.x = pos[0]; player.z = pos[1]; player.h = Math.PI / 2; player.health = 100; law.arrest = 0;
  snapCamera = true;
}

// ---------------------------------------------------------------------------
// Missionen
// ---------------------------------------------------------------------------
const mission = { done: 0, active: null };
function startMission(idx) {
  const m = MISSIONS[idx];
  const a = { idx, m, step: -1, vehicles: {}, timeLeft: null };
  for (const s of m.spawn || []) {
    const c = spawnCar(s.type, s.pos[0], s.pos[1], s.h, s.color);
    c.persistent = true; a.vehicles[s.id] = c;
  }
  mission.active = a;
  showDialog(m.intro, 7);
  nextStep();
}
function nextStep() {
  const a = mission.active;
  a.step++;
  if (a.step >= a.m.steps.length) { completeMission(); return; }
  const s = a.m.steps[a.step];
  if (s.say) showDialog(s.say, 7);
  a.timeLeft = s.time || null;
  if (s.type === 'setWanted') { setWanted(s.level); nextStep(); }
}
function completeMission() {
  const a = mission.active;
  player.money += a.m.reward;
  mission.done = Math.max(mission.done, a.idx + 1);
  if (a.m.keep && a.vehicles[a.m.keep] && !a.vehicles[a.m.keep].wrecked) ownedCar = a.vehicles[a.m.keep];
  banner('MISSION ERFÜLLT', `${a.m.title}  +${a.m.reward} $`);
  showDialog(a.m.outro, 8);
  mission.active = null;
  writeSave('auto');
}
function failMission(reason) {
  const a = mission.active;
  if (!a) return;
  for (const id in a.vehicles) {
    const c = a.vehicles[id];
    if (player.inCar === c) { c.persistent = true; continue; }
    if (cars.includes(c)) removeCar(c);
  }
  mission.active = null;
  if (reason) banner('MISSION FEHLGESCHLAGEN', reason);
}
function currentObjective() {
  const a = mission.active;
  if (!a) {
    if (mission.done < MISSIONS.length) return { pos: MISSIONS[mission.done].start, start: true };
    return null;
  }
  const s = a.m.steps[a.step];
  if (s.type === 'goto') return { pos: s.pos, r: s.r };
  if (s.type === 'enter') { const c = a.vehicles[s.veh]; return c ? { pos: [c.x, c.z], car: true } : null; }
  return null;
}
function updateMission(dt) {
  const a = mission.active;
  if (!a) {
    if (mission.done < MISSIONS.length) {
      const st = MISSIONS[mission.done].start;
      if (dist2(player.x, player.z, st[0], st[1]) < 16 && law.level === 0) startMission(mission.done);
    }
    return;
  }
  const s = a.m.steps[a.step];
  for (const id of a.m.critical || []) {
    const c = a.vehicles[id];
    if (c && c.wrecked) { failMission('Der Lieferwagen ist Schrott.'); return; }
  }
  if (a.timeLeft != null) {
    a.timeLeft -= dt;
    if (a.timeLeft <= 0) { failMission('Die Zeit ist abgelaufen.'); return; }
  }
  if (s.type === 'enter') {
    const c = a.vehicles[s.veh];
    if (!c || c.wrecked) { failMission('Das Fahrzeug ist zerstört.'); return; }
    if (player.inCar === c) nextStep();
  } else if (s.type === 'goto') {
    if (dist2(player.x, player.z, s.pos[0], s.pos[1]) > s.r * s.r) return;
    if (s.onFoot && player.inCar) return;
    if (s.veh && player.inCar !== a.vehicles[s.veh]) return;
    if (s.clean && law.level > 0) return;
    nextStep();
  } else if (s.type === 'lose') {
    if (law.level === 0) nextStep();
  }
}
function objectiveText() {
  const a = mission.active;
  if (!a) {
    if (mission.done < MISSIONS.length) return ['Nächste Mission', `„${MISSIONS[mission.done].title}“ – folge der gelben Markierung.`];
    return ['Freies Spiel', 'Alle Missionen erfüllt. Erkunde Velmar.'];
  }
  const s = a.m.steps[a.step];
  let t = s.text || '';
  if (s.type === 'goto' && s.veh && player.inCar !== a.vehicles[s.veh]) t = 'Steig wieder in dein Missionsfahrzeug.';
  else if (s.type === 'goto' && s.clean && law.level > 0) t = 'Häng zuerst die Polizei ab.';
  else if (s.type === 'goto' && s.onFoot && player.inCar) t += ' (zu Fuß)';
  return [`Mission ${a.idx + 1}: ${a.m.title}`, t];
}

// ---------------------------------------------------------------------------
// Partikel (Rauch bei Fahrzeugschaden)
// ---------------------------------------------------------------------------
const smokeTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 2, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
})();
const particles = [];
for (let n = 0; n < 70; n++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0x777777, transparent: true, depthWrite: false }));
  s.visible = false; scene.add(s);
  particles.push({ s, life: 0, vy: 0 });
}
let pIdx = 0;
function emitSmoke(x, y, z, dark) {
  const p = particles[pIdx]; pIdx = (pIdx + 1) % particles.length;
  p.life = 1.6; p.vy = 1.2 + Math.random();
  p.s.position.set(x + (Math.random() - 0.5) * 0.5, y, z + (Math.random() - 0.5) * 0.5);
  p.s.material.color.setHex(dark ? 0x222222 : 0x8a8a8a);
  p.s.visible = true;
}
function updateParticles(dt) {
  for (const p of particles) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.s.visible = false; continue; }
    p.s.position.y += p.vy * dt;
    const k = 1.6 - p.life;
    p.s.scale.setScalar(0.8 + k * 1.6);
    p.s.material.opacity = Math.min(1, p.life) * 0.7;
  }
}

// ---------------------------------------------------------------------------
// Audio (zur Laufzeit synthetisiert, keine Fremddateien)
// ---------------------------------------------------------------------------
const audio = {
  ctx: null, master: null, engOsc: null, engGain: null, engFilter: null, sirenOsc: null, sirenGain: null, hornGain: null,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = this.ctx = new AC();
      this.master = ctx.createGain(); this.master.gain.value = settings.volume; this.master.connect(ctx.destination);
      this.engOsc = ctx.createOscillator(); this.engOsc.type = 'sawtooth'; this.engOsc.frequency.value = 50;
      this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 600;
      this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
      this.engOsc.connect(this.engFilter); this.engFilter.connect(this.engGain); this.engGain.connect(this.master); this.engOsc.start();
      this.sirenOsc = ctx.createOscillator(); this.sirenOsc.type = 'triangle'; this.sirenOsc.frequency.value = 700;
      this.sirenGain = ctx.createGain(); this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master); this.sirenOsc.start();
      this.hornGain = ctx.createGain(); this.hornGain.gain.value = 0; this.hornGain.connect(this.master);
      for (const f of [370, 466]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(this.hornGain); o.start(); }
    } catch (e) { this.ctx = null; }
  },
  setVolume(v) { if (this.master) this.master.gain.value = v; },
  update(inCar, speed, thr, horn, sirenLevel, t) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.engOsc.frequency.setTargetAtTime(inCar ? 42 + Math.abs(speed) * 3.4 + Math.max(0, thr) * 14 : 40, now, 0.08);
    this.engGain.gain.setTargetAtTime(inCar ? 0.05 + Math.max(0, thr) * 0.03 : 0, now, 0.1);
    this.hornGain.gain.setTargetAtTime(horn ? 0.05 : 0, now, 0.02);
    this.sirenOsc.frequency.setTargetAtTime((t % 1) < 0.5 ? 640 : 860, now, 0.03);
    this.sirenGain.gain.setTargetAtTime(sirenLevel * 0.045, now, 0.2);
  },
  noise(dur, vol) {
    if (!this.ctx) return;
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const g = ctx.createGain(); g.gain.value = vol; s.connect(g); g.connect(this.master); s.start();
  },
  crashT: 0,
  crash(v) { const t = performance.now(); if (t - this.crashT < 250) return; this.crashT = t; this.noise(0.35, 0.25 * v + 0.05); },
  honk(v) {
    if (!this.ctx) return;
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = 410; g.gain.value = 0.03 * v;
    o.connect(g); g.connect(this.master); o.start(); o.stop(ctx.currentTime + 0.35);
  },
  click() {
    if (!this.ctx) return;
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 880; g.gain.value = 0.04; o.connect(g); g.connect(this.master); o.start(); o.stop(ctx.currentTime + 0.05);
  },
};

// ---------------------------------------------------------------------------
// Eingabe: Tastatur, Gamepad, Touch
// ---------------------------------------------------------------------------
const keys = {};
const pressed = new Set();
addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (!keys[e.code]) pressed.add(e.code);
  keys[e.code] = true;
  audio.init();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches);
if (isTouch) {
  document.body.classList.add('touchmode');
  document.querySelectorAll('#touch .tb').forEach((el) => {
    const k = el.dataset.k;
    const on = (e) => { e.preventDefault(); if (!keys[k]) pressed.add(k); keys[k] = true; audio.init(); };
    const off = (e) => { e.preventDefault(); keys[k] = false; };
    el.addEventListener('touchstart', on); el.addEventListener('touchend', off); el.addEventListener('touchcancel', off);
  });
}

const gpPrev = {};
function readInput() {
  const k = (c) => !!keys[c];
  const inp = {
    fwd: (k('KeyW') || k('ArrowUp') || k('TouchUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') || k('TouchDown') ? 1 : 0),
    turn: (k('KeyD') || k('ArrowRight') || k('TouchRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') || k('TouchLeft') ? 1 : 0),
    hb: k('Space') || k('TouchBrake'), sprint: k('ShiftLeft') || k('ShiftRight'), horn: k('KeyH'),
    enter: pressed.has('KeyF') || pressed.has('Enter') || pressed.has('TouchEnter'),
    pause: pressed.has('Escape') || pressed.has('KeyP') || pressed.has('TouchPause'),
    lights: pressed.has('KeyL'), cam: pressed.has('KeyC'), debug: pressed.has('F3'),
  };
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of gps) {
    if (!gp) continue;
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const b = (i) => (gp.buttons[i] ? gp.buttons[i].value : 0);
    const edge = (i) => { const v = b(i) > 0.5, was = gpPrev[gp.index + ':' + i]; gpPrev[gp.index + ':' + i] = v; return v && !was; };
    if (Math.abs(ax) > 0.15) inp.turn = ax;
    const gas = b(7) - b(6);
    if (Math.abs(gas) > 0.05) inp.fwd = gas;
    else if (!player.inCar && Math.abs(ay) > 0.2) inp.fwd = -ay;
    if (b(0) > 0.5) { inp.hb = true; inp.sprint = true; }
    if (b(2) > 0.5) inp.horn = true;
    if (edge(3)) inp.enter = true;
    if (edge(9)) inp.pause = true;
    break;
  }
  pressed.clear();
  return inp;
}

// ---------------------------------------------------------------------------
// HUD und Minikarte
// ---------------------------------------------------------------------------
let dialogT = 0, toastT = 0, bannerT = 0;
function showDialog(text, sec) { const el = $('dialog'); el.textContent = text; el.classList.remove('hidden'); dialogT = sec || 6; }
function toast(text) { const el = $('toast'); el.textContent = text; el.classList.remove('hidden'); toastT = 3.5; }
function banner(big, small) {
  const el = $('banner'); el.querySelector('.big').textContent = big; el.querySelector('.small').textContent = small || '';
  el.classList.remove('hidden'); bannerT = 3.5;
}

const mapCanvas = document.createElement('canvas');
const MAP_PAD = 30, MAP_S = 1;
mapCanvas.width = mapCanvas.height = (CITY + MAP_PAD * 2) * MAP_S;
(function drawStaticMap() {
  const g = mapCanvas.getContext('2d');
  const tx = (v) => (v + MAP_PAD) * MAP_S;
  g.fillStyle = '#5d7448'; g.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
  g.fillStyle = '#2f6f8f'; g.fillRect(0, tx(WATER_Z), mapCanvas.width, mapCanvas.height);
  g.fillStyle = '#3b3e44'; g.fillRect(tx(-7), tx(-7), (CITY + 14) * MAP_S, (CITY + 14) * MAP_S);
  g.fillStyle = '#8b877e'; g.fillRect(tx(-7), tx(CITY + 7), (CITY + 14) * MAP_S, (WATER_Z - CITY - 7) * MAP_S);
  for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
    g.fillStyle = district(i, j) === 'park' ? '#5f8f4a' : '#9b988f';
    g.fillRect(tx(i * BLOCK + 7), tx(j * BLOCK + 7), 56 * MAP_S, 56 * MAP_S);
  }
  g.fillStyle = '#6e6b66';
  for (const b of boxes) if (b.h >= 2) g.fillRect(tx(b.minX), tx(b.minZ), (b.maxX - b.minX) * MAP_S, (b.maxZ - b.minZ) * MAP_S);
})();

const mm = $('minimap'), mg = mm.getContext('2d');
let camYaw = 0;
function drawMinimap(t) {
  const W = mm.width, R = W / 2, scale = W / 220;
  mg.save();
  mg.clearRect(0, 0, W, W);
  mg.beginPath(); mg.arc(R, R, R, 0, Math.PI * 2); mg.clip();
  mg.fillStyle = '#5d7448'; mg.fillRect(0, 0, W, W);
  mg.translate(R, R); mg.scale(scale, scale); mg.rotate(camYaw - Math.PI);
  mg.translate(-player.x, -player.z);
  mg.drawImage(mapCanvas, -MAP_PAD, -MAP_PAD, mapCanvas.width / MAP_S, mapCanvas.height / MAP_S);
  for (const c of cars) {
    if (dist2(c.x, c.z, player.x, player.z) > 160 * 160 || c === player.inCar) continue;
    if (c.police) mg.fillStyle = (Math.floor(t * 4) % 2) ? '#ff4040' : '#4070ff';
    else if (c === ownedCar) mg.fillStyle = '#6fc28a';
    else mg.fillStyle = '#d8d8d8';
    mg.fillRect(c.x - 2.5, c.z - 2.5, 5, 5);
  }
  mg.restore();
  // Ziel (am Rand fixiert, wenn außerhalb)
  const obj = currentObjective();
  if (obj) {
    const dx = obj.pos[0] - player.x, dz = obj.pos[1] - player.z;
    const a = camYaw - Math.PI, ca = Math.cos(a), sa = Math.sin(a);
    let sx = (dx * ca - dz * sa) * scale, sy = (dx * sa + dz * ca) * scale;
    const l = Math.hypot(sx, sy), maxL = R - 9;
    if (l > maxL) { sx *= maxL / l; sy *= maxL / l; }
    mg.fillStyle = obj.start ? '#f29a2e' : '#f2c14e'; mg.strokeStyle = '#000'; mg.lineWidth = 2;
    mg.beginPath(); mg.arc(R + sx, R + sy, 6, 0, Math.PI * 2); mg.fill(); mg.stroke();
  }
  // Spielerpfeil
  const ph = player.inCar ? player.inCar.h : player.h;
  mg.save(); mg.translate(R, R); mg.rotate(-angDiff(camYaw, ph));
  mg.fillStyle = '#ffffff'; mg.strokeStyle = '#000'; mg.lineWidth = 1.5;
  mg.beginPath(); mg.moveTo(0, -8); mg.lineTo(6, 6); mg.lineTo(0, 3); mg.lineTo(-6, 6); mg.closePath(); mg.fill(); mg.stroke();
  mg.restore();
  mg.fillStyle = '#fff'; mg.font = 'bold 12px system-ui'; mg.textAlign = 'center';
}

function updateHUD() {
  const [tt, tx] = objectiveText();
  $('mTitle').textContent = tt; $('mText').textContent = tx;
  const a = mission.active;
  $('mTimer').textContent = a && a.timeLeft != null ? `⏱ ${Math.ceil(a.timeLeft)} s` : '';
  $('money').textContent = `$ ${player.money}`;
  const stars = $('stars').children;
  for (let i = 0; i < 3; i++) stars[i].className = i < law.level ? 'on' : '';
  $('stars').classList.toggle('search', law.level > 0 && !law.seen);
  $('lawText').textContent = law.level === 0 ? '' : law.seen ? 'Sichtkontakt!' :
    `Suche läuft – noch ${Math.max(0, Math.ceil(CFG.escapeTime[law.level] - law.unseen))} s`;
  $('hpBar').firstElementChild.style.width = player.health + '%';
  const c = player.inCar;
  $('carWrap').classList.toggle('hidden', !c);
  if (c) { $('carName').textContent = c.d.name; $('carBar').firstElementChild.style.width = (c.hp / c.d.hp * 100) + '%'; }
  $('speed').innerHTML = c ? `${Math.round(Math.abs(c.speed) * 3.6)}<small>km/h</small>` : '';
  const hint = $('hint');
  let h = '';
  if (!c) { const n = nearestEnterableCar(); if (n) h = `${isTouch ? '„Ein/Aus“' : 'F'}: Einsteigen (${n.d.name})`; }
  hint.textContent = h; hint.classList.toggle('hidden', !h);
  const ar = $('arrest');
  ar.classList.toggle('hidden', law.arrest <= 0.05);
  ar.querySelector('.bar > div').style.width = (law.arrest / CFG.arrestTime * 100) + '%';
}

// ---------------------------------------------------------------------------
// Missionsmarker und Zielpfeil
// ---------------------------------------------------------------------------
function makeMarker(color) {
  const g = new THREE.Group();
  const col = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 30, 24, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
  col.position.y = 15; g.add(col);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.25; g.add(ring);
  g.visible = false; scene.add(g);
  return g;
}
const objMarker = makeMarker(0xf2c14e);
const arrowGeo = new THREE.ConeGeometry(0.45, 1.3, 10); arrowGeo.rotateX(Math.PI / 2);
const arrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: 0xf2c14e }));
arrow.visible = false; scene.add(arrow);

function updateMarkers(t) {
  const obj = currentObjective();
  if (obj && !obj.car) {
    const r = obj.r || 3;
    objMarker.visible = true; objMarker.position.set(obj.pos[0], groundY(obj.pos[0], obj.pos[1]), obj.pos[1]);
    objMarker.scale.set(r, 1, r);
    objMarker.children[0].material.color.setHex(obj.start ? 0xf29a2e : 0xf2c14e);
    objMarker.children[1].material.color.setHex(obj.start ? 0xf29a2e : 0xf2c14e);
  } else objMarker.visible = false;
  if (obj) {
    const d = Math.sqrt(dist2(obj.pos[0], obj.pos[1], player.x, player.z));
    arrow.visible = d > 12;
    const base = player.inCar ? player.inCar : player;
    arrow.position.set(base.x, (player.inCar ? player.inCar.d.h + 1.6 : 2.6) + Math.sin(t * 3) * 0.12, base.z);
    arrow.rotation.y = Math.atan2(obj.pos[0] - base.x, obj.pos[1] - base.z);
  } else arrow.visible = false;
}

// ---------------------------------------------------------------------------
// Speichern / Laden (3 Slots + Autosave, Versionsnummer, Migration)
// ---------------------------------------------------------------------------
const SAVE_KEY = (slot) => 'velmar_save_' + slot;
const MIGRATIONS = {
  // Beispielstruktur: 1: (d) => { ...; d.version = 2; return d; }
};
function serialize() {
  const c = player.inCar || null;
  const oc = ownedCar && !ownedCar.wrecked && cars.includes(ownedCar) ? ownedCar : null;
  return {
    version: SAVE_VERSION, savedAt: Date.now(),
    player: { x: c ? c.x : player.x, z: c ? c.z : player.z, h: c ? c.h : player.h, health: player.health, inOwnedCar: !!(c && c === oc) },
    money: player.money, missionsDone: mission.done,
    ownedCar: oc ? { type: oc.type, x: oc.x, z: oc.z, h: oc.h, hp: oc.hp, color: oc.mesh.userData.bodyMat.color.getHex() } : null,
  };
}
function validateSave(raw) {
  let d = raw;
  if (!d || typeof d !== 'object') throw new Error('Kein gültiges Format');
  if (typeof d.version !== 'number') throw new Error('Versionsnummer fehlt');
  if (d.version > SAVE_VERSION) throw new Error('Spielstand stammt aus einer neueren Version');
  while (d.version < SAVE_VERSION) {
    const m = MIGRATIONS[d.version];
    if (!m) throw new Error('Keine Migration für Version ' + d.version);
    d = m(d);
  }
  const num = (v, lo, hi) => { if (typeof v !== 'number' || !isFinite(v)) throw new Error('Ungültiger Wert'); return clamp(v, lo, hi); };
  const p = d.player || {};
  const out = {
    player: { x: num(p.x, -8, CITY + 8), z: num(p.z, -8, WATER_Z - 3), h: num(p.h, -100, 100), health: num(p.health, 1, 100), inOwnedCar: !!p.inOwnedCar },
    money: Math.round(num(d.money, 0, 1e9)), missionsDone: Math.round(num(d.missionsDone, 0, MISSIONS.length)), ownedCar: null,
  };
  if (d.ownedCar) {
    const o = d.ownedCar;
    if (!VEH[o.type]) throw new Error('Unbekannter Fahrzeugtyp');
    out.ownedCar = { type: o.type, x: num(o.x, -8, CITY + 8), z: num(o.z, -8, WATER_Z - 3), h: num(o.h, -100, 100),
      hp: num(o.hp, 1, VEH[o.type].hp), color: typeof o.color === 'number' ? o.color : null };
  }
  return out;
}
function writeSave(slot) {
  try { localStorage.setItem(SAVE_KEY(slot), JSON.stringify(serialize())); if (slot === 'auto') toast('Automatisch gespeichert.'); return true; }
  catch (e) { toast('Speichern nicht möglich: ' + e.message); return false; }
}
function readSaveInfo(slot) {
  try {
    const raw = localStorage.getItem(SAVE_KEY(slot));
    if (!raw) return null;
    const d = JSON.parse(raw);
    validateSave(d);
    return { ok: true, date: new Date(d.savedAt || 0), done: d.missionsDone, money: d.money };
  } catch (e) { return { ok: false, error: e.message }; }
}
function loadSave(slot) {
  let d;
  try {
    const raw = localStorage.getItem(SAVE_KEY(slot));
    if (!raw) throw new Error('Slot ist leer');
    d = validateSave(JSON.parse(raw));
  } catch (e) { return 'Spielstand konnte nicht geladen werden: ' + e.message; }
  resetWorld();
  player.money = d.money; player.health = d.player.health; mission.done = d.missionsDone;
  let px = d.player.x, pz = d.player.z;
  if (insideAnyBox(px, pz, 0.5)) { px = PLACES.start[0]; pz = PLACES.start[1]; }
  player.x = px; player.z = pz; player.h = d.player.h;
  if (d.ownedCar) {
    const o = d.ownedCar;
    let ox = o.x, oz = o.z;
    if (insideAnyBox(ox, oz, 1.5)) { ox = px + 4; oz = pz; }
    ownedCar = spawnCar(o.type, ox, oz, o.h, o.color);
    ownedCar.hp = o.hp; ownedCar.persistent = true;
    if (d.player.inOwnedCar) enterCar(ownedCar);
  }
  startGame();
  toast('Spielstand geladen.');
  return null;
}

// ---------------------------------------------------------------------------
// Spielzustand, Menüs
// ---------------------------------------------------------------------------
let state = 'menu'; // 'menu' | 'play' | 'pause'
let gameStarted = false;
let camFar = false, snapCamera = true, showDebug = false;

function resetWorld() {
  if (player.inCar) exitCar();
  for (const c of [...cars]) removeCar(c);
  for (const p of [...peds]) removePed(p);
  for (const p of particles) { p.life = 0; p.s.visible = false; }
  mission.active = null; mission.done = 0;
  law.level = 0; law.unseen = 0; law.arrest = 0; law.cd = {}; law.seen = false;
  ownedCar = null;
  player.health = 100; player.money = 100; player.mesh.visible = true;
  // Fester Sportwagen zum Ausprobieren
  const gt = spawnCar('falkner', 216, 245, 0, 0xc8302c); gt.persistent = true;
}
function newGame() {
  resetWorld();
  player.x = PLACES.start[0]; player.z = PLACES.start[1]; player.h = 0;
  startGame();
  startMission(0);
}
function startGame() {
  gameStarted = true; state = 'play'; snapCamera = true;
  $('menu').classList.add('hidden'); $('hud').classList.remove('hidden');
  $('touch').classList.toggle('hidden', !isTouch);
}
function pauseGame() { state = 'pause'; showMenu('pause'); }
function resumeGame() { state = 'play'; $('menu').classList.add('hidden'); $('hud').classList.remove('hidden'); $('touch').classList.toggle('hidden', !isTouch); }

function btn(label, fn, cls) {
  const b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls;
  b.addEventListener('click', () => { audio.init(); audio.click(); fn(); });
  return b;
}
function slotLabel(slot, name) {
  const info = readSaveInfo(slot);
  if (!info) return `${name} – leer`;
  if (!info.ok) return `${name} – beschädigt (${info.error})`;
  return `${name} – ${info.date.toLocaleString('de-DE')} · Missionen ${info.done}/3 · ${info.money} $`;
}
function showMenu(name, msg) {
  const box = $('menuBox');
  box.innerHTML = '';
  $('menu').classList.remove('hidden');
  $('touch').classList.add('hidden');
  const back = () => showMenu(gameStarted ? 'pause' : 'main');
  const h = (tag, text, cls) => { const e = document.createElement(tag); e.textContent = text; if (cls) e.className = cls; box.appendChild(e); return e; };
  if (name === 'main') {
    $('hud').classList.add('hidden');
    h('h1', 'VELMAR'); h('div', 'Hafenstadt · Open-World-Prototyp', 'sub');
    box.appendChild(btn('Neues Spiel', newGame));
    box.appendChild(btn('Spiel laden', () => showMenu('load')));
    box.appendChild(btn('Einstellungen', () => showMenu('settings')));
    box.appendChild(btn('Steuerung', () => showMenu('controls')));
  } else if (name === 'pause') {
    h('h2', 'Pause');
    box.appendChild(btn('Fortsetzen', resumeGame));
    box.appendChild(btn('Speichern', () => showMenu('save')));
    box.appendChild(btn('Laden', () => showMenu('load')));
    box.appendChild(btn('Einstellungen', () => showMenu('settings')));
    box.appendChild(btn('Steuerung', () => showMenu('controls')));
    box.appendChild(btn('Zum Hauptmenü', () => { gameStarted = false; resetWorld(); state = 'menu'; showMenu('main'); }));
  } else if (name === 'save') {
    h('h2', 'Speichern');
    const blocked = mission.active ? 'Während einer Mission kann nicht gespeichert werden.' :
      law.level > 0 ? 'Mit Fahndungsstufe kann nicht gespeichert werden.' : '';
    if (blocked) h('div', blocked, 'msg');
    else for (const s of [1, 2, 3]) box.appendChild(btn(slotLabel(s, 'Slot ' + s), () => { if (writeSave(s)) showMenu('save', 'Gespeichert in Slot ' + s + '.'); }));
    box.appendChild(btn('Zurück', back));
  } else if (name === 'load') {
    h('h2', 'Laden');
    for (const s of ['auto', 1, 2, 3]) {
      const label = slotLabel(s, s === 'auto' ? 'Autosave' : 'Slot ' + s);
      box.appendChild(btn(label, () => { const err = loadSave(s); if (err) showMenu('load', err); }));
    }
    box.appendChild(btn('Zurück', back));
  } else if (name === 'settings') {
    h('h2', 'Einstellungen');
    h('label', 'Lautstärke');
    const r = document.createElement('input'); r.type = 'range'; r.min = 0; r.max = 1; r.step = 0.05; r.value = settings.volume;
    r.addEventListener('input', () => { settings.volume = +r.value; audio.setVolume(settings.volume); saveSettings(); });
    box.appendChild(r);
    h('label', 'Grafik');
    const row = document.createElement('div'); row.className = 'row';
    for (const q of ['niedrig', 'mittel', 'hoch']) {
      row.appendChild(btn(q[0].toUpperCase() + q.slice(1), () => { settings.quality = q; saveSettings(); applyQuality(); showMenu('settings'); }, settings.quality === q ? 'sel' : ''));
    }
    box.appendChild(row);
    box.appendChild(btn('Zurück', back));
  } else if (name === 'controls') {
    h('h2', 'Steuerung');
    const rows = [
      ['W / ↑', 'Gas / vorwärts gehen'], ['S / ↓', 'Bremsen, rückwärts'], ['A D / ← →', 'Lenken / drehen'],
      ['Shift', 'Sprinten (zu Fuß)'], ['Leertaste', 'Handbremse'], ['F / Enter', 'Ein- und aussteigen'],
      ['H', 'Hupe'], ['L', 'Licht'], ['C', 'Kameraabstand'], ['Esc / P', 'Pause'],
      ['Gamepad', 'Stick lenken · RT Gas · LT Bremse · A Handbremse/Sprint · Y Ein/Aus · X Hupe · Start Pause'],
      ['Touch', 'Pfeiltasten auf dem Bildschirm, „Ein/Aus“, „HB“, „II“'],
    ];
    const t = document.createElement('table');
    for (const [a, b] of rows) { const tr = t.insertRow(); tr.insertCell().textContent = a; tr.insertCell().textContent = b; }
    box.appendChild(t);
    box.appendChild(btn('Zurück', back));
  }
  if (msg) h('div', msg, 'msg');
  const first = box.querySelector('button'); if (first && !isTouch) first.focus();
}

// ---------------------------------------------------------------------------
// Spielschleife
// ---------------------------------------------------------------------------
let spawnT = 0, hudT = 0, mapT = 0, elapsed = 0, fpsAcc = 0, fpsN = 0, fps = 0;

function update(dt, inp) {
  elapsed += dt;
  if (inp.debug) showDebug = !showDebug;
  if (inp.cam) camFar = !camFar;
  if (inp.enter) {
    if (player.inCar) { if (Math.abs(player.inCar.speed) < 6) exitCar(); else toast('Zum Aussteigen langsamer fahren.'); }
    else { const c = nearestEnterableCar(); if (c) enterCar(c); }
  }
  const pc = player.inCar;
  if (pc) {
    if (inp.lights) pc.lights = !pc.lights;
    driveCar(pc, inp.fwd, inp.turn, inp.hb, dt);
    player.x = pc.x; player.z = pc.z; player.h = pc.h;
    if (inp.horn) scarePeds(pc.x, pc.z, 18);
  } else {
    updatePlayerOnFoot(inp, dt);
  }
  for (const c of cars) {
    if (c === pc) continue;
    if (c.driver === 'ai' && c.ai) {
      if (c.ai.mode === 'chase') updateChase(c, dt); else updateTraffic(c, dt);
    } else if (Math.abs(c.speed) > 0.01) driveCar(c, 0, 0, true, dt);
  }
  collideCars();
  for (const p of [...peds]) updatePed(p, dt);
  updateLaw(dt);
  if (state !== 'play') return;
  updateMission(dt);
  if (player.health <= 0) wasted();

  spawnT -= dt;
  if (spawnT <= 0) {
    spawnT = 0.5;
    const q = Q();
    for (const c of [...cars]) {
      const d2 = dist2(c.x, c.z, player.x, player.z);
      const isMissionCar = mission.active && Object.values(mission.active.vehicles).includes(c);
      if (c === pc || c === ownedCar || isMissionCar) continue;
      if (d2 > 270 * 270 && (!c.persistent || d2 > 400 * 400)) removeCar(c);
      else if (c.wrecked && d2 > 150 * 150) removeCar(c);
    }
    for (const p of [...peds]) if (dist2(p.x, p.z, player.x, player.z) > 175 * 175) removePed(p);
    const traffic = cars.filter((c) => c.ai && c.ai.mode === 'traffic').length;
    if (traffic < q.traffic) spawnTraffic();
    if (peds.length < q.peds) { spawnPedNear(); spawnPedNear(); }
  }

  // Rauch bei beschädigten Fahrzeugen
  for (const c of cars) {
    if (c.hp > c.d.hp * 0.4) continue;
    c.smokeT -= dt;
    if (c.smokeT <= 0 && dist2(c.x, c.z, player.x, player.z) < 120 * 120) {
      c.smokeT = c.wrecked ? 0.12 : 0.25;
      emitSmoke(c.x + Math.sin(c.h) * c.d.l * 0.35, c.y + 1.2, c.z + Math.cos(c.h) * c.d.l * 0.35, c.wrecked);
    }
  }
}

function syncMeshes(t, dt) {
  for (const c of cars) {
    c.y = lerp(c.y, groundY(c.x, c.z), Math.min(1, dt * 10));
    c.mesh.position.set(c.x, c.y, c.z);
    c.mesh.rotation.y = c.h;
    const ud = c.mesh.userData;
    for (const p of ud.pivots) p.rotation.y = c.steerVis;
    ud.headMat.emissiveIntensity = c.lights || (c.driver === 'ai' && !c.police) ? 1.4 : 0.15;
    const flashing = c.police && c.ai && c.ai.mode === 'chase';
    ud.bars.forEach((m, i) => { m.emissiveIntensity = flashing ? ((Math.floor(t * 6) + i) % 2 ? 2.5 : 0.1) : 0.1; });
  }
  for (const p of peds) {
    p.mesh.position.set(p.x, groundY(p.x, p.z) + (p.state === 'down' ? 0.25 : 0), p.z);
    p.mesh.rotation.y = p.h;
    animatePerson(p.mesh, p.phase, p.state === 'down' ? 0 : p.moving);
  }
  if (!player.inCar) {
    player.mesh.position.set(player.x, groundY(player.x, player.z), player.z);
    player.mesh.rotation.y = player.h;
    animatePerson(player.mesh, player.phase, player.moving);
  }
}

function updateCamera(dt) {
  const c = player.inCar;
  const tx = player.x, tz = player.z;
  const th = c ? c.h : player.h;
  if (snapCamera) { camYaw = th; }
  else camYaw += angDiff(camYaw, th) * Math.min(1, dt * (c ? 2.6 : 4));
  const k = camFar ? 1.6 : 1;
  const dist = (c ? 7.5 + c.d.l * 0.6 : 5.2) * k;
  const height = (c ? 2.8 + c.d.h * 0.7 : 2.4) * k;
  let cx = tx - Math.sin(camYaw) * dist, cz = tz - Math.cos(camYaw) * dist;
  const hitT = segBlocked(tx, tz, cx, cz, 3);
  if (hitT !== Infinity) { const f = Math.max(0.15, hitT - 0.08); cx = tx + (cx - tx) * f; cz = tz + (cz - tz) * f; }
  const want = new THREE.Vector3(cx, height + groundY(tx, tz), cz);
  if (snapCamera) { camera.position.copy(want); snapCamera = false; }
  else camera.position.lerp(want, Math.min(1, dt * 8));
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake * 0.6; camera.position.y += (Math.random() - 0.5) * shake * 0.4;
    shake = Math.max(0, shake - dt * 2.5);
  }
  camera.lookAt(tx, (c ? c.d.h * 0.6 : 1.5) + groundY(tx, tz), tz);
  sun.position.set(tx + 60, 120, tz + 30); sun.target.position.set(tx, 0, tz);
}

function menuCamera(t) {
  const a = t * 0.05;
  camera.position.set(CITY / 2 + Math.cos(a) * 260, 120, CITY / 2 + Math.sin(a) * 260);
  camera.lookAt(CITY / 2, 20, CITY / 2);
  sun.position.set(CITY / 2 + 60, 160, CITY / 2 + 30); sun.target.position.set(CITY / 2, 0, CITY / 2);
}

function updateTimers(dt) {
  if (dialogT > 0) { dialogT -= dt; if (dialogT <= 0) $('dialog').classList.add('hidden'); }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.add('hidden'); }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').classList.add('hidden'); }
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  const inp = readInput();
  if (state === 'play') {
    if (inp.pause) { pauseGame(); }
    else {
      update(dt, inp);
      updateTimers(dt);
    }
    syncMeshes(t, dt);
    updateCamera(dt);
    updateMarkers(t);
    hudT -= dt; if (hudT <= 0) { hudT = 0.1; updateHUD(); }
    mapT -= dt; if (mapT <= 0) { mapT = 1 / 20; drawMinimap(t); }
    let siren = 0;
    if (law.level > 0) for (const c of cars) if (c.police && c.ai && c.ai.mode === 'chase') siren = Math.max(siren, 1 - Math.sqrt(dist2(c.x, c.z, player.x, player.z)) / 150);
    audio.update(!!player.inCar, player.inCar ? player.inCar.speed : 0, player.inCar ? player.inCar.thr : 0, inp.horn, Math.max(0, siren), t);
  } else {
    if (state === 'pause' && inp.pause) resumeGame();
    if (state === 'menu') menuCamera(t);
    audio.update(false, 0, 0, false, 0, t);
  }
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  const dbg = $('debug');
  dbg.classList.toggle('hidden', !showDebug);
  if (showDebug) dbg.textContent = `FPS ${fps.toFixed(0)}\nAutos ${cars.length}\nFußgänger ${peds.length}\nPos ${player.x.toFixed(0)}, ${player.z.toFixed(0)}`;
  renderer.render(scene, camera);
}

showMenu('main');
requestAnimationFrame(frame);

// Schnittstelle für automatisierte Tests (keine Spielfunktion)
window.__velmar = {
  player, mission, law, MISSIONS, PLACES, get cars() { return cars; }, get peds() { return peds; }, get state() { return state; },
  get fps() { return fps; }, newGame, loadSave, writeSave, readSaveInfo, setWanted, enterCar, exitCar, nearestEnterableCar,
  teleport(x, z) { if (player.inCar) { player.inCar.x = x; player.inCar.z = z; player.inCar.speed = 0; } player.x = x; player.z = z; snapCamera = true; },
};
})();
