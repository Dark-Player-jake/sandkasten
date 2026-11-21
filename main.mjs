import { createWorld, step, paint, set, stats, ecosystemScene, M } from './sim.mjs';

const W = 320, H = 180;
let world = createWorld(W, H, Date.now() & 0xffff);

const MATERIALS = [
  { m: M.SAND, name: 'Sand', key: '1', rgb: [217, 179, 108] },
  { m: M.WATER, name: 'Wasser', key: '2', rgb: [64, 132, 214] },
  { m: M.STONE, name: 'Stein', key: '3', rgb: [120, 116, 110] },
  { m: M.WOOD, name: 'Holz', key: '4', rgb: [128, 86, 50] },
  { m: M.FIRE, name: 'Feuer', key: '5', rgb: [242, 110, 34] },
  { m: M.OIL, name: 'Öl', key: '6', rgb: [70, 52, 40] },
  { m: M.SEED, name: 'Samen', key: '7', rgb: [176, 200, 90] },
  { m: M.BEETLE, name: 'Käfer', key: '8', rgb: [168, 62, 44] },
  { m: M.LAVA, name: 'Lava', key: '9', rgb: [230, 70, 30] },
  { m: M.ACID, name: 'Säure', key: '0', rgb: [150, 230, 60] },
  { m: M.ICE, name: 'Eis', key: 'q', rgb: [190, 225, 240] },
  { m: M.PLANT, name: 'Pflanze', key: 'w', rgb: [70, 150, 60] },
  { m: M.STEAM, name: 'Dampf', key: 'e', rgb: [210, 215, 225] },
  { m: M.SMOKE, name: 'Rauch', key: 'r', rgb: [110, 108, 112] },
  { m: M.EMPTY, name: 'Radierer', key: 'x', rgb: [235, 228, 216] },
];

// Farbtabelle: je Material 4 Helligkeitsstufen, ausgewählt über shade.
// Im Dunkelmodus wären Öl und Rauch auf dem dunklen Grund kaum sichtbar, daher eigene Töne.
const DARK_RGB = { [M.OIL]: [128, 98, 72], [M.SMOKE]: [150, 148, 154] };
const LUT = new Uint32Array(16 * 4);
function buildLut(dark) { for (const mat of MATERIALS) for (let s = 0; s < 4; s++) {
  const { m } = mat, rgb = (dark && DARK_RGB[m]) || mat.rgb;
  const f = 0.9 + s * 0.06;
  const [r, g, b] = rgb.map((c) => Math.min(255, Math.round(c * f)));
  LUT[m * 4 + s] = (255 << 24) | (b << 16) | (g << 8) | r;
} }
const darkMq = matchMedia('(prefers-color-scheme: dark)');
buildLut(darkMq.matches);
darkMq.addEventListener?.('change', (e) => { buildLut(e.matches); renderChart(); });

const $ = (id) => document.getElementById(id);
const canvas = $('world'), ctx = canvas.getContext('2d');
const img = ctx.createImageData(W, H), px = new Uint32Array(img.data.buffer);
const chart = $('chart'), cctx = chart.getContext('2d');

let current = M.SAND, brush = 4, speed = 1, paused = false, raining = false;
const history = [];

// Palette
const pal = $('palette');
for (const mat of MATERIALS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-label', `${mat.name} (Taste ${mat.key.toUpperCase()})`);
  b.title = `${mat.name} (${mat.key.toUpperCase()})`;
  b.dataset.m = mat.m;
  b.innerHTML = `<i style="background:rgb(${mat.rgb})"></i><span>${mat.name}</span>`;
  b.addEventListener('click', () => select(mat.m));
  pal.append(b);
}
function select(m) {
  current = m;
  for (const b of pal.children) { const on = +b.dataset.m === m; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; }
}
// Radiogruppe: ein Tab-Stopp, Pfeiltasten wechseln das Material
pal.addEventListener('keydown', (e) => {
  const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (!d) return;
  e.preventDefault();
  const bs = [...pal.children], k = (bs.indexOf(document.activeElement) + d + bs.length) % bs.length;
  select(+bs[k].dataset.m); bs[k].focus();
});
select(M.SAND);

// Eingabe
let drawing = false, erase = false, last = null, pointer = null;
const toCell = (e) => {
  const r = canvas.getBoundingClientRect();
  return [Math.floor(((e.clientX - r.left) / r.width) * W), Math.floor(((e.clientY - r.top) / r.height) * H)];
};
function strokeTo([x, y]) {
  const m = erase ? M.EMPTY : current;
  const chance = m === M.BEETLE || m === M.SEED ? 0.04 : m === M.STONE || m === M.WOOD || m === M.EMPTY || m === M.ICE ? 1 : 0.5;
  const [lx, ly] = last ?? [x, y];
  const n = Math.max(1, Math.hypot(x - lx, y - ly) | 0);
  for (let k = 0; k <= n; k++) paint(world, Math.round(lx + ((x - lx) * k) / n), Math.round(ly + ((y - ly) * k) / n), brush, m, chance);
  last = [x, y];
}
// Nur ein Zeiger malt; weitere Finger oder Mittelklick werden ignoriert
canvas.addEventListener('pointerdown', (e) => {
  if (drawing || (e.button !== 0 && e.button !== 2)) return;
  drawing = true; erase = e.button === 2; last = null; pointer = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  strokeTo(toCell(e));
});
canvas.addEventListener('pointermove', (e) => { if (drawing && e.pointerId === pointer) strokeTo(toCell(e)); });
const endStroke = (e) => { if (e.pointerId === pointer) { drawing = false; pointer = null; } };
canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', endStroke);
canvas.addEventListener('lostpointercapture', endStroke);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

$('brush').addEventListener('input', (e) => { brush = +e.target.value; $('brushOut').value = brush; });
$('speed').addEventListener('input', (e) => { speed = +e.target.value; $('speedOut').value = `${speed}×`; });
function setPaused(p) {
  paused = p;
  $('pause').textContent = p ? 'Weiter' : 'Pause';
  $('stepBtn').disabled = !p;
}
$('pause').addEventListener('click', () => setPaused(!paused));
$('stepBtn').addEventListener('click', () => step(world));
$('clear').addEventListener('click', () => {
  world = createWorld(W, H, Date.now() & 0xffff); history.length = 0;
  if (raining) { setRain(false); say('Geleert, Regen ist aus.'); }
});
$('scene').addEventListener('click', () => { buildScene(); history.length = 0; setRain(true); say('Ökosystem angelegt, sanfter Regen ist an.'); });

function setRain(on) { raining = on; $('rain').setAttribute('aria-pressed', String(on)); $('rain').textContent = on ? 'Regen an' : 'Regen'; }
$('rain').addEventListener('click', () => setRain(!raining));
$('shot').addEventListener('click', () => {
  const big = document.createElement('canvas'); big.width = W * 4; big.height = H * 4;
  const b = big.getContext('2d'); b.imageSmoothingEnabled = false;
  b.fillStyle = getComputedStyle(canvas).backgroundColor; b.fillRect(0, 0, big.width, big.height);
  b.drawImage(canvas, 0, 0, big.width, big.height);
  const a = document.createElement('a'); a.download = 'sandkasten.png'; a.href = big.toDataURL('image/png'); a.click();
});

const KEY = 'sandkasten.save.v1';
$('save').addEventListener('click', () => {
  try {
    const bin = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) { bin[i * 4] = world.type[i]; bin[i * 4 + 1] = world.life[i]; bin[i * 4 + 2] = world.gene[i]; bin[i * 4 + 3] = world.shade[i]; }
    let s = ''; for (let i = 0; i < bin.length; i += 8192) s += String.fromCharCode(...bin.subarray(i, i + 8192));
    localStorage.setItem(KEY, btoa(s));
    say('Gespeichert.');
  } catch { say('Speichern nicht möglich (Browser-Speicher gesperrt oder voll).'); }
});
$('load').addEventListener('click', () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return say('Noch nichts gespeichert.');
    const s = atob(raw);
    const n = s.length / (W * H); // 3 Byte: alter Stand ohne Farbton, 4 Byte: mit Farbton (bestimmt die Pflanzenhöhe)
    if (n !== 3 && n !== 4) return say('Spielstand passt nicht zu dieser Version.');
    world = createWorld(W, H, Date.now() & 0xffff);
    for (let i = 0; i < W * H; i++) {
      const t = s.charCodeAt(i * n);
      if (t > M.BEETLE) continue; // unbekanntes Material verwerfen statt abstürzen
      world.type[i] = t; world.life[i] = s.charCodeAt(i * n + 1); world.gene[i] = s.charCodeAt(i * n + 2);
      world.shade[i] = n === 4 ? s.charCodeAt(i * n + 3) : (Math.random() * 255) | 0;
    }
    history.length = 0;
    say('Geladen.');
  } catch { say('Laden nicht möglich.'); }
});

function resizeBrush(d) { brush = Math.max(1, Math.min(16, brush + d)); $('brush').value = brush; $('brushOut').value = brush; }
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.metaKey) return;
  // [ ] liegen auf deutschen Tastaturen auf AltGr/Option, deshalb vor dem Modifier-Filter
  if (e.key === '[' || e.key === ']') { e.preventDefault(); resizeBrush(e.key === ']' ? 1 : -1); return; }
  if (e.ctrlKey || e.altKey || e.repeat && e.key === ' ') return; // Strg+Plus/Minus bleibt Browser-Zoom
  if (e.key === '+' || e.key === '-') { resizeBrush(e.key === '+' ? 1 : -1); return; }
  const mat = MATERIALS.find((x) => x.key === e.key.toLowerCase());
  if (mat) { select(mat.m); return; }
  if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); setPaused(!paused); } // auf Knöpfen löst die Leertaste den Knopf aus
  else if (e.key === '.' && paused) step(world);
});

let msgTimer;
function say(t) { $('msg').textContent = t; clearTimeout(msgTimer); msgTimer = setTimeout(() => ($('msg').textContent = ''), 3500); }

function buildScene() {
  world = createWorld(W, H, Date.now() & 0xffff);
  ecosystemScene(world);
}

function render() {
  const { type, shade } = world;
  for (let i = 0; i < px.length; i++) {
    const t = type[i];
    px[i] = t === M.EMPTY ? 0 : LUT[t * 4 + (shade[i] & 3)];
  }
  ctx.clearRect(0, 0, W, H);
  ctx.putImageData(img, 0, 0);
}

function renderChart() {
  const dpr = Math.min(2, devicePixelRatio || 1), cw = chart.clientWidth || 240, ch = chart.clientHeight || 70;
  if (chart.width !== Math.round(cw * dpr) || chart.height !== Math.round(ch * dpr)) { chart.width = Math.round(cw * dpr); chart.height = Math.round(ch * dpr); }
  cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cctx.clearRect(0, 0, cw, ch);
  if (history.length < 2) return;
  const maxB = Math.max(4, ...history.map((h) => h.beetles));
  const maxP = Math.max(20, ...history.map((h) => h.plants));
  const line = (key, max, color) => {
    cctx.beginPath();
    history.forEach((h, k) => {
      const x = (k / (history.length - 1)) * cw, y = ch - 4 - (h[key] / max) * (ch - 8);
      k ? cctx.lineTo(x, y) : cctx.moveTo(x, y);
    });
    cctx.strokeStyle = color; cctx.lineWidth = 2; cctx.stroke();
  };
  line('plants', maxP, '#4c9a3c');
  line('beetles', maxB, getComputedStyle(document.body).color);
}

let frame = 0, lastT = 0, acc = 0;
const TICK = 1000 / 60; // Simulation läuft mit 60 Schritten/s × Tempo, unabhängig von der Bildwiederholrate
function loop(t) {
  acc = Math.min(acc + (lastT ? t - lastT : TICK), TICK * 4); // nach Tab-Wechsel nicht nachholen
  lastT = t;
  const ticks = Math.floor(acc / TICK + 0.1); // Toleranz gegen schwankende Frame-Abstände (sonst 0/2-Ruckeln)
  acc -= ticks * TICK;
  // Gedrückt halten streut weiter, im Takt der Simulation; Käfer und Samen nur beim Bewegen, sonst gäbe ein Klick einen Schwarm
  if (drawing && last && current !== M.BEETLE && current !== M.SEED) for (let s = 0; s < ticks; s++) strokeTo(last);
  if (!paused) for (let s = 0; s < ticks * speed; s++) {
    if (raining && world.rng() < 0.2) { const x = (world.rng() * W) | 0; if (world.type[x] === M.EMPTY) set(world, x, 0, M.WATER); }
    step(world);
    // Flammen flackern über den Farbton
    if ((world.tick & 3) === 0) for (let i = 0; i < world.type.length; i++) if (world.type[i] === M.FIRE || world.type[i] === M.LAVA) world.shade[i] = (Math.random() * 4) | 0;
  }
  render();
  if (++frame % 15 === 0) {
    const s = stats(world);
    $('sBeetles').textContent = s.beetles;
    $('sPlants').textContent = s.plants;
    $('sGene').textContent = s.beetles ? Math.round((s.avgGene / 255) * 100) + ' %' : '–';
    if (!paused) { history.push(s); if (history.length > 240) history.shift(); }
    renderChart();
  }
  requestAnimationFrame(loop);
}

buildScene();
setRain(true);
requestAnimationFrame(loop);
