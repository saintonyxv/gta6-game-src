// Vice Blocks — shared constants, palette and small helpers.
// Neon Bay is a fictional sunset city; every name, place and colour here is original.

// World layout: a grid of blocks separated by streets.
export const BLOCK = 240;      // building block size in world px
export const ROAD = 72;        // street width in world px
export const GRID = 7;         // blocks across and down
export const CITY = GRID * BLOCK + (GRID + 1) * ROAD; // total city span in px
export const BEACH_W = 160;    // sand strip along the east edge
export const SEA_W = 220;      // water beyond the sand

// Sunset palette: neon pink, teal, warm sand, deep purple night.
export const PALETTE = {
  asphalt: '#2b2340',
  asphaltDark: '#241d36',
  lane: '#f5d76e',
  sidewalk: '#4a3f66',
  grass: '#1f7a4d',
  parkDark: '#17603d',
  sand: '#e8c98a',
  sea: '#1b6f8e',
  seaDeep: '#145a75',
  building: ['#3d2b5c', '#4a3568', '#5c3a6e', '#33284f', '#6b3a5e', '#463a7a'],
  roof: ['#ff5da2', '#19e3d6', '#ffb347', '#7c5cff', '#ff7a59'],
  neonPink: '#ff2e88',
  neonTeal: '#19e3d6',
  neonYellow: '#ffd23f',
  player: '#ffd23f',
  police: '#2f7bff',
  hudBg: 'rgba(16, 8, 32, 0.72)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const BEST_KEY = 'vice-blocks.best-cash';
export const STEP = 1 / 60;

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// Deterministic RNG (mulberry32) so the city and every screenshot are reproducible.
export function makeRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function rr(rng, lo, hi) { return lo + rng() * (hi - lo); }

// Street centre coordinates: street index 0..GRID (GRID+1 streets each way).
export function streetX(i) { return ROAD / 2 + i * (BLOCK + ROAD); }
export function streetY(i) { return ROAD / 2 + i * (BLOCK + ROAD); }
// Block origin (top-left) for block column i, row j.
export function blockX(i) { return ROAD + i * (BLOCK + ROAD); }
export function blockY(j) { return ROAD + j * (BLOCK + ROAD); }
