// city.js — Neon Bay's map: roads, blocks, buildings, beach and collision.
// One deterministic layout built from a seeded random generator, so every
// session (and every screenshot) sees the same city.
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_HALF = 55;

export const ROADS_X = [300, 700, 1100, 1500, 1900, 2300, 2700];
export const ROADS_Y = [300, 700, 1100, 1500, 1900];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROOF_COLORS = ['#b5543f', '#c98a4b', '#7d8aa0', '#a35d6e', '#5d7a5a', '#8a6f9e', '#c2b280', '#4f7d8a'];
const DISTRICTS = [
  ['Old Harbor', 'Marina Row'], ['Palm Court', 'Sunset Plaza'],
  ['Civic Quarter', 'Neon Strip'], ['Juniper Hills', 'Coral Beach'],
];

export function buildCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const parks = [];
  const trees = [];
  for (let i = 0; i < ROADS_X.length - 1; i++) {
    for (let j = 0; j < ROADS_Y.length - 1; j++) {
      const x0 = ROADS_X[i] + ROAD_HALF + 14;
      const x1 = ROADS_X[i + 1] - ROAD_HALF - 14;
      const y0 = ROADS_Y[j] + ROAD_HALF + 14;
      const y1 = ROADS_Y[j + 1] - ROAD_HALF - 14;
      if (x1 > 2920) continue; // beach strip, no buildings
      if ((i + j) % 5 === 4) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let t = 0; t < 7; t++) {
          trees.push({ x: x0 + 20 + rng() * (x1 - x0 - 40), y: y0 + 20 + rng() * (y1 - y0 - 40), r: 12 + rng() * 10 });
        }
        continue;
      }
      const bw = (x1 - x0) * (0.45 + rng() * 0.35);
      const bh = (y1 - y0) * (0.45 + rng() * 0.35);
      const bx = x0 + rng() * Math.max(1, x1 - x0 - bw);
      const by = y0 + rng() * Math.max(1, y1 - y0 - bh);
      buildings.push({
        x: bx, y: by, w: bw, h: bh,
        color: ROOF_COLORS[Math.floor(rng() * ROOF_COLORS.length)],
        tall: rng() < 0.25,
      });
      if (rng() < 0.4) {
        const bw2 = (x1 - x0) * 0.25, bh2 = (y1 - y0) * 0.25;
        buildings.push({
          x: x0 + rng() * Math.max(1, x1 - x0 - bw2), y: y0 + rng() * Math.max(1, y1 - y0 - bh2),
          w: bw2, h: bh2, color: ROOF_COLORS[Math.floor(rng() * ROOF_COLORS.length)], tall: false,
        });
      }
    }
  }
  // Harbor containers along the south docks.
  for (let k = 0; k < 8; k++) {
    buildings.push({ x: 340 + k * 130, y: 2090 + (k % 2) * 60, w: 100, h: 40, color: ['#c96a3f', '#4f7d8a', '#8a6f9e'][k % 3], tall: false, container: true });
  }
  return { buildings, parks, trees };
}

export function isOnRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_HALF) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= ROAD_HALF) return true;
  return false;
}

export function onBeach(x) { return x > 2920; }
export function inWater(x, y) { return x > 3110 || y > 2330; }

export function pointBlocked(city, x, y, r = 0) {
  if (x < 20 + r || y < 20 + r || x > WORLD_W - 20 - r || y > WORLD_H - 20 - r) return true;
  if (inWater(x, y)) return true;
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}

// Move with axis-separated collision so the player slides along walls.
export function moveWithCollision(city, x, y, dx, dy, r) {
  const nx = x + dx;
  if (!pointBlocked(city, nx, y, r)) x = nx;
  const ny = y + dy;
  if (!pointBlocked(city, x, ny, r)) y = ny;
  return { x, y };
}

export function nearestRoadPoint(rng) {
  if (rng() < 0.5) {
    return { x: ROADS_X[Math.floor(rng() * ROADS_X.length)], y: 120 + rng() * (WORLD_H - 240) };
  }
  return { x: 120 + rng() * (WORLD_W - 240), y: ROADS_Y[Math.floor(rng() * ROADS_Y.length)] };
}

export function sidewalkPoint(rng) {
  const p = nearestRoadPoint(rng);
  if (rng() < 0.5) p.x += (rng() < 0.5 ? -1 : 1) * (ROAD_HALF + 16);
  else p.y += (rng() < 0.5 ? -1 : 1) * (ROAD_HALF + 16);
  return p;
}

export function districtAt(x, y) {
  const cx = Math.min(DISTRICTS[0].length - 1, Math.floor(x / (WORLD_W / 2)));
  const cy = Math.min(DISTRICTS.length - 1, Math.floor(y / (WORLD_H / 2)));
  return DISTRICTS[cy][cx];
}

export function clampToWorld(x, y) {
  return { x: Math.max(24, Math.min(WORLD_W - 24, x)), y: Math.max(24, Math.min(WORLD_H - 24, y)) };
}
