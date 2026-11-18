// pedestrians.js — the people of Neon Bay: they stroll the sidewalks,
// cross at intersections, and run for cover when shots ring out.
import { ROADS_X, ROADS_Y, WORLD_W, WORLD_H, sidewalkPoint, isOnRoad } from './city.js';

const PED_COLORS = ['#f0a38b', '#477e79', '#d6b844', '#5a6f99', '#c96a8a', '#7a9e4f'];

export function makePedestrians(city, rng, count) {
  const peds = [];
  for (let i = 0; i < (count || 46); i++) {
    const p = sidewalkPoint(rng);
    peds.push({
      x: p.x, y: p.y, a: rng() * Math.PI * 2,
      speed: 26 + rng() * 30, color: PED_COLORS[i % PED_COLORS.length],
      panic: 0, alive: true, walkPhase: rng() * Math.PI * 2,
      tx: null, ty: null, threatX: 0, threatY: 0,
    });
  }
  return peds;
}

export function scarePedestrians(state, x, y, radius) {
  for (const ped of state.peds) {
    if (!ped.alive) continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) {
      ped.panic = 3 + Math.random() * 2;
      ped.threatX = x; ped.threatY = y;
    }
  }
}

export function updatePedestrians(state, dt) {
  const p = state.player;
  const playerCar = p.inCar ? state.cars.find((c) => c.id === p.carId) : null;
  for (const ped of state.peds) {
    if (!ped.alive) continue;
    ped.walkPhase += dt * 6;
    if (ped.panic > 0) {
      ped.panic -= dt;
      const away = Math.atan2(ped.y - ped.threatY, ped.x - ped.threatX);
      ped.a = away;
      ped.x += Math.cos(away) * 150 * dt;
      ped.y += Math.sin(away) * 150 * dt;
      ped.x = Math.max(24, Math.min(WORLD_W - 24, ped.x));
      ped.y = Math.max(24, Math.min(WORLD_H - 24, ped.y));
      continue;
    }
    // Stroll along the sidewalk; pick a new direction at intersections.
    if (ped.tx === null || Math.hypot(ped.tx - ped.x, ped.ty - ped.y) < 24) {
      const vertical = Math.random() < 0.5;
      if (vertical) {
        const rx = ROADS_X[Math.floor(Math.random() * ROADS_X.length)];
        ped.tx = rx + (Math.random() < 0.5 ? -1 : 1) * 72;
        ped.ty = 100 + Math.random() * (WORLD_H - 200);
      } else {
        const ry = ROADS_Y[Math.floor(Math.random() * ROADS_Y.length)];
        ped.tx = 100 + Math.random() * (WORLD_W - 200);
        ped.ty = ry + (Math.random() < 0.5 ? -1 : 1) * 72;
      }
    }
    const dx = ped.tx - ped.x, dy = ped.ty - ped.y;
    const d = Math.hypot(dx, dy);
    if (d > 1) {
      ped.a = Math.atan2(dy, dx);
      ped.x += (dx / d) * ped.speed * dt;
      ped.y += (dy / d) * ped.speed * dt;
    }
    // Hit by the player's car: a crime, and the pedestrian goes down.
    if (playerCar && Math.abs(playerCar.v) > 90 && Math.hypot(ped.x - playerCar.x, ped.y - playerCar.y) < 40) {
      ped.alive = false;
      state.crimeT = 0;
      state.wanted = Math.min(5, state.wanted + 1);
      state.toast = 'Pedestrian struck — police alerted';
      state.toastT = 3;
      scarePedestrians(state, ped.x, ped.y, 320);
    }
    // A pedestrian in the road ahead of a traffic car makes it slow down.
    if (isOnRoad(ped.x, ped.y)) {
      for (const car of state.cars) {
        if (car.driver === 'traffic' && Math.hypot(car.x - ped.x, car.y - ped.y) < 60) {
          car.v *= Math.max(0, 1 - dt * 3);
        }
      }
    }
  }
}
