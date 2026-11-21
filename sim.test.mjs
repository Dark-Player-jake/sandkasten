import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, set, get, step, count, stats, paint, ecosystemScene, M } from './sim.mjs';

const run = (w, n) => { for (let i = 0; i < n; i++) step(w); };

test('Sand fällt auf den Boden und bleibt erhalten', () => {
  const w = createWorld(20, 20);
  paint(w, 10, 3, 2, M.SAND);
  const before = count(w, M.SAND);
  run(w, 60);
  assert.equal(count(w, M.SAND), before);
  assert.equal(get(w, 10, 19), M.SAND);
  for (let x = 0; x < 20; x++) for (let y = 0; y < 10; y++) assert.notEqual(get(w, x, y), M.SAND);
});

test('Wasser verteilt sich flach, Sand sinkt darunter', () => {
  const w = createWorld(30, 10);
  for (let x = 13; x < 17; x++) for (let y = 0; y < 4; y++) set(w, x, y, M.WATER);
  run(w, 200);
  let bottomWater = 0;
  for (let x = 0; x < 30; x++) if (get(w, x, 9) === M.WATER) bottomWater++;
  assert.equal(count(w, M.WATER), 16);
  assert.ok(bottomWater >= 14, `Wasser liegt flach (${bottomWater})`);
  set(w, 15, 0, M.SAND);
  run(w, 30);
  assert.equal(get(w, 15, 9), M.SAND);
});

test('Öl schwimmt auf Wasser', () => {
  const w = createWorld(6, 10);
  for (let x = 0; x < 6; x++) { set(w, x, 8, M.OIL); set(w, x, 9, M.OIL); set(w, x, 2, M.WATER); set(w, x, 3, M.WATER); }
  run(w, 200);
  for (let x = 0; x < 6; x++) { assert.equal(get(w, x, 9), M.WATER); assert.equal(get(w, x, 7), M.OIL); }
});

test('Feuer verbrennt Holz und erlischt', () => {
  for (const seed of [1, 2, 3, 4, 5]) burnTest(seed);
});
function burnTest(seed) {
  const w = createWorld(20, 20, seed);
  for (let x = 5; x < 15; x++) set(w, x, 15, M.WOOD);
  for (let x = 5; x < 8; x++) set(w, x, 14, M.FIRE); // ein Pinselstrich, kein Einzelfunke
  run(w, 600);
  assert.equal(count(w, M.WOOD), 0);
  assert.equal(count(w, M.FIRE), 0);
}

test('Wasser kühlt Lava zu Stein', () => {
  const w = createWorld(10, 10);
  for (let x = 0; x < 10; x++) set(w, x, 9, M.LAVA);
  for (let x = 0; x < 10; x++) set(w, x, 5, M.WATER);
  run(w, 100);
  assert.ok(count(w, M.STONE) > 0);
});

test('Gas steigt auf', () => {
  const w = createWorld(5, 20);
  set(w, 2, 19, M.STEAM);
  run(w, 25);
  let y = -1;
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === M.STEAM) y = Math.floor(i / 5);
  assert.ok(y >= 0 && y < 5, `Dampf oben (${y})`);
});

test('Käfer fressen Pflanzen, vermehren sich und verhungern ohne Futter', () => {
  const w = createWorld(60, 12, 7);
  for (let x = 0; x < 60; x++) set(w, x, 11, M.STONE);
  // Stängel: Wurzel unten (Höhe 0), darüber fressbare Triebe
  for (let x = 0; x < 60; x++) for (let y = 7; y < 11; y++) if (x % 3) { set(w, x, y, M.PLANT); w.gene[y * 60 + x] = 10 - y; }
  set(w, 30, 6, M.BEETLE);
  let peak = 0;
  for (let i = 0; i < 3000; i++) { step(w); peak = Math.max(peak, stats(w).beetles); }
  assert.ok(peak > 1, `Vermehrung (${peak})`);
  assert.ok(count(w, M.PLANT) < 160, 'Pflanzen wurden gefressen');
  run(w, 6000);
  if (count(w, M.PLANT) === 0) assert.equal(stats(w).beetles, 0);
});

test('Samen keimen nur mit Wasser in der Nähe', () => {
  const dry = createWorld(10, 10, 3), wet = createWorld(10, 10, 3);
  for (const w of [dry, wet]) { for (let x = 0; x < 10; x++) set(w, x, 9, M.SAND); set(w, 5, 8, M.SEED); }
  set(wet, 7, 8, M.WATER); set(wet, 8, 8, M.STONE); set(wet, 6, 8, M.STONE);
  run(dry, 300); run(wet, 300);
  assert.equal(count(dry, M.PLANT), 0);
  assert.ok(count(wet, M.PLANT) > 0);
});

test('Ein einzelner Funke entzündet Holz meistens', () => {
  let lit = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const w = createWorld(12, 8, seed);
    for (let x = 0; x < 12; x++) set(w, x, 7, M.WOOD);
    set(w, 6, 6, M.FIRE);
    run(w, 60);
    if (count(w, M.WOOD) < 12) lit++;
  }
  assert.ok(lit >= 36, `entzündet in ${lit}/60 Fällen`);
});

test('Startszene mit sanftem Regen: Käfer überleben lange, das Tempo-Gen verändert sich', () => {
  let survived = 0, drift = 0;
  for (const seed of [3, 4]) {
    const w = createWorld(320, 180, seed);
    ecosystemScene(w);
    for (let t = 0; t < 7000; t++) {
      if (w.rng() < 0.2) { const x = (w.rng() * 320) | 0; if (w.type[x] === M.EMPTY) set(w, x, 0, M.WATER); }
      step(w);
    }
    const s = stats(w);
    if (s.beetles > 0) { survived++; drift = Math.max(drift, Math.abs(s.avgGene - 128)); }
  }
  assert.ok(survived >= 1, 'mindestens eine Population lebt nach 7000 Ticks');
  assert.ok(drift > 5, `Gen-Mittel hat sich verschoben (${drift.toFixed(1)})`);
});
