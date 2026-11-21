// Zellulärer Automat: reine Logik ohne DOM, damit sie unter node:test läuft.

export const M = {
  EMPTY: 0, SAND: 1, WATER: 2, STONE: 3, WOOD: 4, FIRE: 5, SMOKE: 6, OIL: 7,
  PLANT: 8, LAVA: 9, STEAM: 10, ACID: 11, ICE: 12, SEED: 13, BEETLE: 14,
};

// Dichte bestimmt, wer wen verdrängt. Feste Stoffe haben Infinity.
const DENSITY = new Float32Array(15);
DENSITY[M.EMPTY] = 0; DENSITY[M.SMOKE] = 0.1; DENSITY[M.STEAM] = 0.1; DENSITY[M.FIRE] = 0.2;
DENSITY[M.OIL] = 0.8; DENSITY[M.WATER] = 1; DENSITY[M.ACID] = 1.1; DENSITY[M.LAVA] = 2.5;
DENSITY[M.SAND] = 1.6; DENSITY[M.SEED] = 1.2; DENSITY[M.BEETLE] = 1.3;
for (const m of [M.STONE, M.WOOD, M.PLANT, M.ICE]) DENSITY[m] = Infinity;

const FLAMMABLE = new Uint8Array(15);
FLAMMABLE[M.WOOD] = 14; FLAMMABLE[M.OIL] = 40; FLAMMABLE[M.PLANT] = 18; FLAMMABLE[M.SEED] = 20; FLAMMABLE[M.BEETLE] = 25;

const isFluid = (m) => DENSITY[m] < 1.5 && m !== M.SEED && m !== M.BEETLE; // darf von Pulver verdrängt werden
const isGas = (m) => m === M.SMOKE || m === M.STEAM || m === M.FIRE;

export function createWorld(w, h, seed = 1) {
  const n = w * h;
  return {
    w, h, tick: 0,
    type: new Uint8Array(n), life: new Uint8Array(n), shade: new Uint8Array(n),
    gene: new Uint8Array(n), moved: new Uint8Array(n),
    rng: mulberry32(seed),
  };
}

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const START_LIFE = { [M.FIRE]: 40, [M.SMOKE]: 90, [M.STEAM]: 140, [M.BEETLE]: 160 };

export function set(world, x, y, m, gene = 128) {
  if (x < 0 || y < 0 || x >= world.w || y >= world.h) return;
  const i = y * world.w + x;
  world.type[i] = m;
  world.life[i] = START_LIFE[m] ?? 0;
  world.shade[i] = (world.rng() * 255) | 0;
  world.gene[i] = m === M.BEETLE ? gene : 0;
}

export function get(world, x, y) {
  if (x < 0 || y < 0 || x >= world.w || y >= world.h) return M.STONE; // Rand wirkt wie Wand
  return world.type[y * world.w + x];
}

export function paint(world, cx, cy, r, m, chance = 1) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    if (x * x + y * y > r * r || world.rng() > chance) continue;
    const t = get(world, cx + x, cy + y);
    if (m === M.EMPTY || t === M.EMPTY || isGas(t)) set(world, cx + x, cy + y, m);
  }
}

function swap(w, a, b) {
  const { type, life, shade, gene, moved } = w;
  let t = type[a]; type[a] = type[b]; type[b] = t;
  t = life[a]; life[a] = life[b]; life[b] = t;
  t = shade[a]; shade[a] = shade[b]; shade[b] = t;
  t = gene[a]; gene[a] = gene[b]; gene[b] = t;
  moved[b] = 1; moved[a] = 1;
}

function idx(w, x, y) { return (x < 0 || y < 0 || x >= w.w || y >= w.h) ? -1 : y * w.w + x; }

// Versucht zu (x+dx, y+dy) zu ziehen, wenn das Ziel leichter ist.
function tryMove(w, i, x, y, dx, dy) {
  const j = idx(w, x + dx, y + dy);
  if (j < 0 || w.moved[j]) return false;
  const me = w.type[i], other = w.type[j];
  const lighter = dy < 0 ? other === M.EMPTY || (DENSITY[other] > DENSITY[me] && isFluid(other) && !isGas(other)) // Gas steigt durch Flüssigkeit
    : dy > 0 ? DENSITY[other] < DENSITY[me] && (isFluid(other) || other === M.EMPTY)
    : other === M.EMPTY || (isGas(other) && !isGas(me));
  if (!lighter) return false;
  swap(w, i, j);
  return true;
}

function neighbors(w, x, y, fn) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const j = idx(w, x + dx, y + dy);
    if (j >= 0) fn(j, dx, dy);
  }
}

function become(w, i, m) {
  w.type[i] = m; w.life[i] = START_LIFE[m] ?? 0; w.gene[i] = 0; w.moved[i] = 1;
}

function powder(w, i, x, y) {
  if (tryMove(w, i, x, y, 0, 1)) return;
  const d = w.rng() < 0.5 ? -1 : 1;
  if (tryMove(w, i, x, y, d, 1)) return;
  tryMove(w, i, x, y, -d, 1);
}

function liquid(w, i, x, y, spread) {
  if (tryMove(w, i, x, y, 0, 1)) return;
  const d = w.rng() < 0.5 ? -1 : 1;
  if (tryMove(w, i, x, y, d, 1) || tryMove(w, i, x, y, -d, 1)) return;
  let cx = x, cur = i;
  for (let s = 0; s < spread; s++) {
    if (!tryMove(w, cur, cx, y, d, 0)) break;
    cx += d; cur = idx(w, cx, y);
  }
}

function gas(w, i, x, y) {
  const d = ((w.rng() * 3) | 0) - 1;
  if (tryMove(w, i, x, y, d, -1) || tryMove(w, i, x, y, 0, -1)) return;
  tryMove(w, i, x, y, w.rng() < 0.5 ? -1 : 1, 0);
}

function burnNeighbors(w, x, y, boost = 1) {
  neighbors(w, x, y, (j) => {
    const f = FLAMMABLE[w.type[j]];
    if (f && w.rng() * 100 < f * boost) {
      const solid = DENSITY[w.type[j]] === Infinity;
      become(w, j, M.FIRE);
      if (solid) { w.gene[j] = 1; w.life[j] = 90; } // Glut bleibt am Ort, statt aufzusteigen
    }
    else if (w.type[j] === M.ICE && w.rng() < 0.05 * boost) become(w, j, M.WATER);
    else if (w.type[j] === M.WATER && w.rng() < 0.02 * boost) become(w, j, M.STEAM);
  });
}

function beetle(w, i, x, y) {
  const g = w.gene[i];
  // Energie: schnelle Käfer (hohes Gen) verbrauchen mehr, finden aber eher Futter.
  const cost = w.rng() < 0.15 + g / 800 ? 1 : 0;
  if (w.life[i] <= cost) { become(w, i, w.rng() < 0.4 ? M.SEED : M.SAND); return; } // tote Käfer düngen
  w.life[i] -= cost;
  // Fressen
  let ate = false;
  neighbors(w, x, y, (j) => {
    // Satte Käfer fressen nicht, Wurzeln (Höhe 0) bleiben stehen: so wächst immer etwas nach
    if (!ate && w.life[i] < 200 && w.type[j] === M.PLANT && w.gene[j] > 0) { become(w, j, M.EMPTY); w.life[i] = Math.min(255, w.life[i] + 40); ate = true; }
  });
  // Vermehrung mit Mutation
  if (w.life[i] > 190 && w.rng() < 0.03) {
    const j = idx(w, x + (w.rng() < 0.5 ? -1 : 1), y);
    if (j >= 0 && w.type[j] === M.EMPTY) {
      const child = Math.max(1, Math.min(255, g + ((w.rng() * 41) | 0) - 20));
      w.type[j] = M.BEETLE; w.life[j] = 90; w.gene[j] = child; w.shade[j] = w.shade[i] ^ 1; w.moved[j] = 1;
      w.life[i] -= 120;
    }
  }
  // Im Wasser: zur Oberfläche schwimmen statt am Grund festzusitzen
  const wet = (t) => t === M.WATER || t === M.OIL || t === M.ACID;
  if (wet(get(w, x, y - 1)) || wet(get(w, x - 1, y)) || wet(get(w, x + 1, y))) {
    const up = idx(w, x, y - 1);
    if (up >= 0 && wet(w.type[up]) && w.rng() < 0.5) { swap(w, i, up); return; }
    const side = idx(w, x + ((w.shade[i] & 1) ? 1 : -1), y);
    if (side >= 0 && wet(w.type[side]) && w.rng() < 0.3) { swap(w, i, side); return; }
  }
  if (tryMove(w, i, x, y, 0, 1)) return; // fällt ohne Halt
  // Futtersuche: gelegentlich Umgebung absuchen und zur nächsten Pflanze drehen. Schnelle Käfer sehen weiter.
  if ((w.tick + i) % 8 === 0) {
    const reach = 12 + (g >> 4); // schnelle Käfer sehen weiter (12–27 Zellen)
    let best = 0, bestD = Infinity;
    for (let dy = -8; dy <= 8; dy++) for (let dx = -reach; dx <= reach; dx++) {
      if (dx && get(w, x + dx, y + dy) === M.PLANT && Math.abs(dx) < bestD) { bestD = Math.abs(dx); best = dx; }
    }
    if (best) w.shade[i] = (w.shade[i] & ~1) | (best > 0 ? 1 : 0);
    else if (w.rng() < 0.03) w.shade[i] ^= 1; // ohne Futter in Sicht: ab und zu umkehren und weitersuchen
  }
  if (w.rng() * 255 > g) return;
  const d = (w.shade[i] & 1) ? 1 : -1; // Laufrichtung steckt im Farbton-Bit
  // Nicht freiwillig ins Wasser laufen: Kante zum See erkennen und umdrehen
  if (wet(get(w, x + d, y)) || wet(get(w, x + d, y + 1))) { w.shade[i] ^= 1; return; }
  if (tryMove(w, i, x, y, d, 0)) return;
  if (get(w, x + d, y) !== M.EMPTY && tryMove(w, i, x, y, d, -1)) return; // eine Stufe klettern
  if (get(w, x + d, y) !== M.EMPTY && get(w, x + d, y - 1) !== M.EMPTY && get(w, x, y - 1) === M.EMPTY && tryMove(w, i, x, y, 0, -1)) return; // an Wänden hochkrabbeln
  w.shade[i] ^= 1; // umdrehen
}

function step1(w, i, x, y) {
  const m = w.type[i];
  switch (m) {
    case M.SAND: powder(w, i, x, y); break;
    case M.SEED: {
      const below = get(w, x, y + 1);
      if ((below === M.SAND || below === M.PLANT) && w.rng() < 0.05) {
        let wet = false;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (get(w, x + dx, y + dy) === M.WATER) wet = true;
        if (wet) { become(w, i, M.PLANT); w.life[i] = 12 + ((w.rng() * 20) | 0); w.gene[i] = 0; }
      } else powder(w, i, x, y);
      break;
    }
    case M.WATER: {
      let done = false;
      neighbors(w, x, y, (j) => {
        if (done) return;
        const t = w.type[j];
        if (t === M.LAVA) { become(w, j, M.STONE); become(w, i, M.STEAM); done = true; }
        else if (t === M.FIRE) { become(w, j, M.SMOKE); }
        else if (t === M.ICE && w.rng() < 0.002) { become(w, i, M.ICE); done = true; }
      });
      if (!done) liquid(w, i, x, y, 4);
      break;
    }
    case M.OIL: liquid(w, i, x, y, 2); break;
    case M.ACID: {
      let done = false;
      neighbors(w, x, y, (j) => {
        const t = w.type[j];
        if (done || t === M.EMPTY || t === M.ACID || isGas(t)) return;
        if (w.rng() < (t === M.STONE ? 0.004 : 0.05)) {
          become(w, j, w.rng() < 0.3 ? M.SMOKE : M.EMPTY);
          if (w.rng() < 0.4) become(w, i, M.EMPTY);
          done = true;
        }
      });
      if (!done) liquid(w, i, x, y, 3);
      break;
    }
    case M.LAVA: {
      burnNeighbors(w, x, y, 1.5);
      neighbors(w, x, y, (j) => { if (w.type[j] === M.SAND && w.rng() < 0.002) become(w, j, M.LAVA); });
      if (w.rng() < 0.4) liquid(w, i, x, y, 1);
      break;
    }
    case M.FIRE: {
      burnNeighbors(w, x, y, 1);
      if (--w.life[i] === 0) { become(w, i, w.rng() < 0.5 ? M.SMOKE : M.EMPTY); break; }
      if (w.gene[i]) { // Glut: schickt Flammen nach oben
        const up = idx(w, x, y - 1);
        if (up >= 0 && w.type[up] === M.EMPTY && w.rng() < 0.15) { become(w, up, M.FIRE); w.life[up] = 12; }
      } else if (w.rng() < 0.3) gas(w, i, x, y);
      break;
    }
    case M.SMOKE: if (--w.life[i] === 0) become(w, i, M.EMPTY); else gas(w, i, x, y); break;
    case M.STEAM: {
      if (--w.life[i] === 0) { become(w, i, w.rng() < 0.85 ? M.WATER : M.EMPTY); break; } // Dampf kondensiert meist wieder
      gas(w, i, x, y); break;
    }
    case M.ICE: {
      neighbors(w, x, y, (j) => { if (w.type[j] === M.WATER && w.rng() < 0.003) become(w, j, M.ICE); });
      break;
    }
    case M.PLANT: {
      // life = gespeichertes Wasser, gene = Höhe über der Wurzel. Die Endhöhe steckt im Farbton (Stängel teilen ihn).
      if (w.rng() > 0.08) break;
      // Ohne Wasser welken Triebe langsam (Wurzeln bleiben), so wuchert nichts endlos zu
      if (w.life[i] === 0 && w.gene[i] > 0 && w.rng() < 0.02) { become(w, i, M.EMPTY); break; }
      const maxH = 5 + (w.shade[i] % 22);
      neighbors(w, x, y, (j, dx, dy) => {
        const t = w.type[j];
        if (t === M.WATER && w.life[i] < 40 && w.rng() < 0.25) { become(w, j, M.EMPTY); w.life[i] += 10; }
        else if (w.life[i] > 1 && dy === -1 && t === M.EMPTY && w.gene[i] < maxH && w.rng() < 0.2 * (1 - w.gene[i] / (maxH + 4))) {
          const h = w.gene[i] + 1;
          become(w, j, M.PLANT); w.shade[j] = w.shade[i]; w.gene[j] = h; w.life[j] = w.life[i] - 1; w.life[i] = 0;
        } else if (w.life[i] > 0 && t === M.PLANT && w.life[j] < w.life[i] - 1) { // Wasser im Stängel weiterreichen
          const half = (w.life[i] - w.life[j]) >> 1; w.life[i] -= half; w.life[j] += half;
        } else if (t === M.EMPTY && dy === -1 && w.life[i] > 4 && w.rng() < 0.01) { // Verdunstung: Wasser kehrt als Dampf zurück
          become(w, j, M.STEAM); w.life[i] -= 4;
        } else if (t === M.EMPTY && dy >= 0 && dx && w.gene[i] >= maxH - 1 && w.life[i] > 6 && w.rng() < 0.006) { // reife Pflanze streut Samen
          become(w, j, M.SEED); w.life[i] -= 6;
        }
      });
      break;
    }
    case M.BEETLE: beetle(w, i, x, y); break;
  }
}

export function step(w) {
  w.moved.fill(0);
  const ltr = (w.tick++ & 1) === 0;
  for (let y = w.h - 1; y >= 0; y--) {
    for (let k = 0; k < w.w; k++) {
      const x = ltr ? k : w.w - 1 - k;
      const i = y * w.w + x;
      if (w.moved[i] || w.type[i] === M.EMPTY) continue;
      step1(w, i, x, y);
    }
  }
}

export function stats(w) {
  let beetles = 0, geneSum = 0, plants = 0;
  for (let i = 0; i < w.type.length; i++) {
    if (w.type[i] === M.BEETLE) { beetles++; geneSum += w.gene[i]; }
    else if (w.type[i] === M.PLANT) plants++;
  }
  return { beetles, plants, avgGene: beetles ? geneSum / beetles : 0 };
}

export function count(w, m) {
  let c = 0;
  for (let i = 0; i < w.type.length; i++) if (w.type[i] === m) c++;
  return c;
}

// Startszene: Hügel aus Sand über Stein, ein See in der Mitte, Samen, Regenwasser, ein paar Käfer.
export function ecosystemScene(world) {
  const { w: W, h: H, rng: r } = world;
  for (let x = 0; x < W; x++) {
    const ground = Math.round(H - 30 - 14 * Math.sin(x / 37) - 8 * Math.sin(x / 13 + 1));
    const lake = x > W * 0.4 && x < W * 0.62;
    for (let y = ground; y < H; y++) set(world, x, y, y > ground + 10 ? M.STONE : M.SAND);
    if (lake) for (let y = ground - 2; y < ground + 9; y++) set(world, x, y, M.WATER);
  }
  for (let k = 0; k < 160; k++) set(world, (r() * W) | 0, ((r() * 40) | 0) + 10, M.SEED);
  for (let k = 0; k < 30; k++) for (let y = 0; y < 6; y++) set(world, 30 + k * 9, 4 + y, M.WATER);
  for (let k = 0; k < 6; k++) {
    const x = 20 + ((r() * (W - 40)) | 0);
    set(world, x, 5, M.BEETLE, 90 + ((r() * 80) | 0));
    world.life[5 * W + x] = 255; // genug Vorrat, bis die ersten Pflanzen stehen
  }
}
