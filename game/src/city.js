// The city of Neon Bay: a fixed street grid, blocks of buildings, parks, a beach
// strip and the sea along the east edge. Built once from a seed; the same seed
// always gives the same city, so screenshots are reproducible.
import { BEACH_W, BLOCK, CITY, GRID, PALETTE, ROAD, SEA_W, blockX, blockY, makeRng, pick, rr, streetX, streetY } from './config.js';

// Block kinds: downtown blocks (centre) get tall neon towers, others get houses
// and shops, a few become parks, and the east column is the beach.
export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];   // {x, y, w, h, color, roof, neon, tall}
  const trees = [];       // {x, y, r}
  const umbrellas = [];   // {x, y, color}
  const parks = [];       // {x, y, w, h}
  const downtown = { x0: blockX(2), y0: blockY(2), x1: blockX(4) + BLOCK, y1: blockY(4) + BLOCK };

  for (let i = 0; i < GRID; i += 1) {
    for (let j = 0; j < GRID; j += 1) {
      const bx = blockX(i);
      const by = blockY(j);
      const isDowntown = i >= 2 && i <= 4 && j >= 2 && j <= 4;
      const isBeachBlock = i === GRID - 1;
      // One in eight inland blocks is a park; the east column is beachfront.
      if (!isDowntown && !isBeachBlock && rng() < 0.13) {
        parks.push({ x: bx, y: by, w: BLOCK, h: BLOCK });
        for (let t = 0; t < 9; t += 1) {
          trees.push({ x: bx + 24 + rng() * (BLOCK - 48), y: by + 24 + rng() * (BLOCK - 48), r: 10 + rng() * 9 });
        }
        continue;
      }
      if (isBeachBlock) {
        // Beachfront motels: low buildings on the west half, sand on the east.
        const n = 2;
        for (let k = 0; k < n; k += 1) {
          const w = 70 + rng() * 50;
          const h = 50 + rng() * 40;
          buildings.push({
            x: bx + 14 + k * 110, y: by + 30 + rng() * 90, w, h,
            color: pick(rng, PALETTE.building), roof: pick(rng, PALETTE.roof),
            neon: rng() < 0.5, tall: false,
          });
        }
        for (let u = 0; u < 3; u += 1) {
          umbrellas.push({ x: bx + BLOCK - 60 + rng() * 40, y: by + 20 + u * 70, color: pick(rng, PALETTE.roof) });
        }
        continue;
      }
      // Normal block: 2x2 buildings with a courtyard gap, or one big one downtown.
      if (isDowntown) {
        const w = 120 + rng() * 80;
        const h = 120 + rng() * 80;
        buildings.push({
          x: bx + (BLOCK - w) / 2, y: by + (BLOCK - h) / 2, w, h,
          color: pick(rng, PALETTE.building), roof: pick(rng, PALETTE.roof),
          neon: true, tall: true,
        });
      } else {
        const cols = 2, rows = 2;
        const cw = BLOCK / cols, ch = BLOCK / rows;
        for (let a = 0; a < cols; a += 1) {
          for (let b = 0; b < rows; b += 1) {
            const w = cw - 36 - rng() * 20;
            const h = ch - 36 - rng() * 20;
            buildings.push({
              x: bx + a * cw + 18 + rng() * 8, y: by + b * ch + 18 + rng() * 8, w, h,
              color: pick(rng, PALETTE.building), roof: pick(rng, PALETTE.roof),
              neon: rng() < 0.25, tall: false,
            });
          }
        }
      }
    }
  }

  // Parked cars live on the streets; their spots are picked at runtime.
  return { buildings, trees, umbrellas, parks, downtown, seed, rng };
}

// Is a circle (x, y, r) blocked by any building?
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

// Push a circle out of buildings; returns true when a push happened.
export function resolveBuildings(city, body, r) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    let dx = body.x - cx, dy = body.y - cy;
    let d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 < 0.0001) {
      // Centre inside the rect: push out along the smallest penetration axis.
      const pl = body.x - b.x, pr = b.x + b.w - body.x;
      const pt = body.y - b.y, pb = b.y + b.h - body.y;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) body.x = b.x - r;
      else if (m === pr) body.x = b.x + b.w + r;
      else if (m === pt) body.y = b.y - r;
      else body.y = b.y + b.h + r;
    } else {
      const d = Math.sqrt(d2);
      body.x = cx + (dx / d) * r;
      body.y = cy + (dy / d) * r;
    }
  }
  return hit;
}

// A point on a street, away from intersections: used for spawning cars and peds.
export function randomStreetPoint(rng) {
  const horizontal = rng() < 0.5;
  const street = Math.floor(rng() * (GRID + 1));
  const along = rr(rng, ROAD + 40, CITY - ROAD - 40);
  if (horizontal) return { x: along, y: streetY(street) + (rng() < 0.5 ? -14 : 14) };
  return { x: streetX(street) + (rng() < 0.5 ? -14 : 14), y: along };
}

export function worldWidth() { return CITY + BEACH_W + SEA_W; }
export function worldHeight() { return CITY; }
