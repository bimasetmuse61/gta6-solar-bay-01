// Solar Bay — city.js
// The city itself: a road grid, building blocks, parks, a plaza, the
// beach and the bay on the east edge. Everything is generated from one
// seed, so the map is identical every run. Buildings are solid rectangles
// the player and cars collide with; roads are the lanes traffic follows.

import { WORLD, DISTRICTS, PALETTE } from './config.js';
import { mulberry32, randInt, pick, hashString } from './random.js';

export const ROAD_LINES = [];
for (let v = 200; v < WORLD.width; v += WORLD.roadSpacing) ROAD_LINES.push(v);
for (let v = 200; v < WORLD.height; v += WORLD.roadSpacing) ROAD_LINES.push(v);

function isRoadX(x) {
  for (const line of ROAD_LINES) {
    if (Math.abs(x - line) < WORLD.roadWidth / 2 + WORLD.sidewalk) return true;
  }
  return false;
}

function isRoadY(y) {
  for (const line of ROAD_LINES) {
    if (Math.abs(y - line) < WORLD.roadWidth / 2 + WORLD.sidewalk) return true;
  }
  return false;
}

export function isOnRoad(x, y) {
  return isRoadX(x) || isRoadY(y);
}

/** Nearest point on a road centre line (used to snap traffic and peds). */
export function nearestRoadPoint(x, y) {
  let bestX = ROAD_LINES[0];
  let bestY = ROAD_LINES[0];
  for (const line of ROAD_LINES) {
    if (Math.abs(line - x) < Math.abs(bestX - x)) bestX = line;
    if (Math.abs(line - y) < Math.abs(bestY - y)) bestY = line;
  }
  return { x: bestX, y: bestY };
}

export function districtAt(x, y) {
  for (const district of DISTRICTS) {
    if (x >= district.x0 && x < district.x1 && y >= district.y0 && y < district.y1) {
      return district.name;
    }
  }
  return 'Solar Bay';
}

/**
 * Build the city from a seed. Returns buildings (solid rects with a
 * colour, height shade and window grid), parks, the beach strip and the
 * water, plus the special places missions use (hideout, marina, warehouse,
 * courier depot, gold-car spot).
 */
export function buildCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const parks = [];
  const trees = [];

  // The bay: everything east of x = 2920 is water, with a sand beach.
  const beach = { x0: 2840, y0: 0, x1: 2920, y1: WORLD.height };
  const water = { x0: 2920, y0: 0, x1: WORLD.width, y1: WORLD.height };

  // One park per district row, plus the central plaza.
  const parkBlocks = [
    { bx: 1, by: 2 }, { bx: 4, by: 1 }, { bx: 2, by: 5 },
    { bx: 5, by: 4 }, { bx: 6, by: 6 }, { bx: 0, by: 6 },
  ];
  for (const park of parkBlocks) {
    const x0 = park.bx * WORLD.roadSpacing + WORLD.roadWidth / 2 + WORLD.sidewalk + 8;
    const y0 = park.by * WORLD.roadSpacing + WORLD.roadWidth / 2 + WORLD.sidewalk + 8;
    const size = WORLD.roadSpacing - WORLD.roadWidth - 2 * WORLD.sidewalk - 16;
    parks.push({ x: x0, y: y0, w: size, h: size });
    for (let i = 0; i < 14; i += 1) {
      trees.push({ x: x0 + 14 + rng() * (size - 28), y: y0 + 14 + rng() * (size - 28), r: 9 + rng() * 7 });
    }
  }
  // Central plaza in Midtown.
  const plaza = { x: 1700, y: 900, w: 280, h: 280 };

  const roofColors = ['#c98a5e', '#b5764f', '#d9a05b', '#a8688a', '#7d8aa0', '#c96f4a', '#8fa98f'];
  const wallColors = ['#e8b48a', '#f0c9a0', '#e8a87c', '#d9b8c4', '#b8c4d0', '#e8a05c', '#c4d6b0'];

  for (let bx = 0; bx < 7; bx += 1) {
    for (let by = 0; by < 7; by += 1) {
      const isPark = parkBlocks.some((p) => p.bx === bx && p.by === by);
      if (isPark) continue;
      if (bx === 4 && by === 2) continue; // plaza block
      const x0 = bx * WORLD.roadSpacing + WORLD.roadWidth / 2 + WORLD.sidewalk + 6;
      const y0 = by * WORLD.roadSpacing + WORLD.roadWidth / 2 + WORLD.sidewalk + 6;
      const blockSize = WORLD.roadSpacing - WORLD.roadWidth - 2 * WORLD.sidewalk - 12;
      if (x0 + blockSize > beach.x0) continue; // the beach has no buildings
      const blockRng = mulberry32(hashString(`block-${bx}-${by}-${seed}`));
      const kind = blockRng();
      if (kind < 0.18) {
        // One big tower.
        const w = blockSize * (0.55 + blockRng() * 0.25);
        const h = blockSize * (0.55 + blockRng() * 0.25);
        buildings.push(makeBuilding(x0 + (blockSize - w) / 2, y0 + (blockSize - h) / 2, w, h, blockRng, roofColors, wallColors, true));
      } else if (kind < 0.5) {
        // Two buildings side by side.
        const w = blockSize / 2 - 14;
        const h = blockSize * (0.5 + blockRng() * 0.3);
        buildings.push(makeBuilding(x0, y0 + 8, w, h, blockRng, roofColors, wallColors, false));
        buildings.push(makeBuilding(x0 + w + 28, y0 + blockSize - h - 8, w, h, blockRng, roofColors, wallColors, false));
      } else {
        // Four small shops in a row.
        const w = blockSize / 2 - 12;
        const h = blockSize / 2 - 12;
        buildings.push(makeBuilding(x0, y0, w, h, blockRng, roofColors, wallColors, false));
        buildings.push(makeBuilding(x0 + w + 24, y0, w, h, blockRng, roofColors, wallColors, false));
        buildings.push(makeBuilding(x0, y0 + h + 24, w, h, blockRng, roofColors, wallColors, false));
        buildings.push(makeBuilding(x0 + w + 24, y0 + h + 24, w, h, blockRng, roofColors, wallColors, false));
      }
    }
  }

  // Special places the missions use.
  const places = {
    hideout: { x: 620, y: 1420, name: 'Rosa\u2019s Garage' },
    depot: { x: 1820, y: 620, name: 'Courier Depot' },
    warehouse: { x: 2620, y: 2220, name: 'Harbor Warehouse' },
    marina: { x: 2700, y: 420, name: 'Marina' },
    goldCar: { x: 2720, y: 460, name: 'Gold Comet' },
    dropA: { x: 620, y: 2620, name: 'South Beach Kiosk' },
    dropB: { x: 2620, y: 1820, name: 'Docks Gate' },
    pier: { x: 2900, y: 1500, name: 'Old Pier' },
  };

  return { buildings, parks, trees, plaza, beach, water, places };
}

function makeBuilding(x, y, w, h, rng, roofs, walls, tower) {
  const roof = pick(rng, roofs);
  const wall = pick(rng, walls);
  const cols = Math.max(2, Math.floor(w / 34));
  const rows = Math.max(2, Math.floor(h / 34));
  return {
    x, y, w, h, roof, wall, cols, rows, tower,
    shade: 0.85 + rng() * 0.3,
  };
}

/** True when the circle (x, y, r) overlaps any solid building. */
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

/** Push a circle out of buildings and the world edge; returns corrected x,y. */
export function resolveBuildingCollision(city, x, y, r) {
  for (const b of city.buildings) {
    const closestX = Math.max(b.x, Math.min(x, b.x + b.w));
    const closestY = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - closestX;
    const dy = y - closestY;
    const distSq = dx * dx + dy * dy;
    if (distSq < r * r) {
      if (distSq === 0) {
        x = b.x - r - 1;
      } else {
        const dist = Math.sqrt(distSq);
        x = closestX + (dx / dist) * r;
        y = closestY + (dy / dist) * r;
      }
    }
  }
  x = Math.max(r, Math.min(WORLD.width - r, x));
  y = Math.max(r, Math.min(WORLD.height - r, y));
  return { x, y };
}
