// cars.js — the cars of Neon Bay: five types with their own speed and
// handling, spawning, player driving physics, damage and wrecking.
import { ROADS_X, ROADS_Y, ROAD_HALF, pointBlocked, moveWithCollision, nearestRoadPoint } from './city.js';
import { playSound } from './audio.js';

export const CAR_TYPES = [
  { name: 'Hatch', len: 62, wid: 32, accel: 300, top: 235, turn: 3.4 },
  { name: 'Sedan', len: 74, wid: 36, accel: 320, top: 265, turn: 3.1 },
  { name: 'Sport', len: 78, wid: 36, accel: 430, top: 330, turn: 3.6 },
  { name: 'Van', len: 86, wid: 40, accel: 240, top: 200, turn: 2.6 },
  { name: 'Taxi', len: 74, wid: 36, accel: 320, top: 270, turn: 3.1 },
];

const CAR_COLORS = ['#ed6654', '#3e7e91', '#e4ba50', '#dce5dd', '#8a6aa1', '#ee8d53', '#37a890', '#c94f6d'];
let nextCarId = 0;

export function makeCar(x, y, a, type, kind, driver) {
  const t = CAR_TYPES[type];
  return {
    id: nextCarId++, x, y, a, v: 0, type, kind: kind || 'civilian',
    color: kind === 'police' ? '#e8e8dc' : kind === 'taxi' ? '#f2c230' : CAR_COLORS[nextCarId % CAR_COLORS.length],
    health: 100, parked: false, driver: driver || 'none', wrecked: false,
    ai: null, smokeT: 0, len: t.len, wid: t.wid,
  };
}

export function makeCars(city, rng) {
  nextCarId = 0;
  const cars = [];
  // Parked cars tucked along the roads.
  for (let i = 0; i < 26; i++) {
    const p = nearestRoadPoint(rng);
    const vertical = rng() < 0.5;
    const off = (rng() < 0.5 ? -1 : 1) * (ROAD_HALF - 16);
    const x = vertical ? p.x + off : p.x;
    const y = vertical ? p.y : p.y + off;
    if (pointBlocked(city, x, y, 24)) continue;
    const c = makeCar(x, y, vertical ? Math.PI / 2 : 0, Math.floor(rng() * 4), 'civilian', 'none');
    c.parked = true;
    cars.push(c);
  }
  // Moving traffic.
  for (let i = 0; i < 22; i++) {
    const p = nearestRoadPoint(rng);
    const vertical = rng() < 0.5;
    const c = makeCar(p.x, p.y, vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI),
      Math.floor(rng() * 4), 'civilian', 'traffic');
    c.v = 80 + rng() * 60;
    c.ai = {
      axis: vertical ? 'v' : 'h',
      line: vertical ? p.x : p.y,
      dir: rng() < 0.5 ? 1 : -1,
      lane: (rng() < 0.5 ? -1 : 1) * 18,
      speed: 80 + rng() * 60,
    };
    cars.push(c);
  }
  // Taxis waiting for fares near the strip.
  for (let i = 0; i < 4; i++) {
    const c = makeCar(1500 + (i - 1.5) * 90, 300 + 40, 0, 4, 'taxi', 'none');
    c.parked = true;
    cars.push(c);
  }
  // One police cruiser parked by the station.
  const pc = makeCar(1500, 700 - 40, Math.PI, 1, 'police', 'none');
  pc.parked = true;
  cars.push(pc);
  // A sport car the story will point at, parked by the marina.
  const sc = makeCar(700 + 40, 1900 - 40, 0, 2, 'civilian', 'none');
  sc.parked = true;
  cars.push(sc);
  return cars;
}

export function carById(state, id) {
  return state.cars.find((c) => c.id === id) || null;
}

export function damageCar(state, car, dmg) {
  if (!car || car.wrecked) return;
  car.health -= dmg;
  if (car.health <= 40 && car.smokeT <= 0) {
    car.smokeT = 0.4;
    state.particles.push({ x: car.x, y: car.y, vx: 0, vy: -30, life: 0.8, maxLife: 0.8, color: '#555555', size: 8 });
  }
  if (car.health <= 0) {
    car.wrecked = true;
    car.v = 0;
    for (let i = 0; i < 14; i++) {
      state.particles.push({
        x: car.x, y: car.y, vx: (Math.random() - 0.5) * 260, vy: (Math.random() - 0.5) * 260,
        life: 0.7, maxLife: 0.7, color: ['#ff9a3d', '#ff5a3d', '#555555'][i % 3], size: 5,
      });
    }
    playSound('crash');
    if (state.player.carId === car.id) {
      // The player is thrown clear of the wreck.
      state.player.inCar = false;
      state.player.carId = -1;
      state.player.x = car.x + 50;
      state.player.y = car.y;
      state.player.health = Math.max(5, state.player.health - 20);
    }
  }
}

// Arcade driving for the player's car: throttle, reverse, handbrake,
// steering that bites harder at speed, and wall / car collisions.
export function updatePlayerCar(state, input, dt) {
  const p = state.player;
  const car = carById(state, p.carId);
  if (!car || car.wrecked) { p.inCar = false; p.carId = -1; return; }
  const t = CAR_TYPES[car.type];
  const k = input.keys;
  const gas = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
  car.v += gas * t.accel * dt;
  if (k.has('Space')) car.v *= Math.pow(0.06, dt);
  car.v -= car.v * 0.35 * dt; // rolling drag
  car.v = Math.max(-t.top * 0.45, Math.min(t.top, car.v));
  const steer = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
  const steerPower = t.turn * Math.min(1, Math.abs(car.v) / 90) * (car.v >= 0 ? 1 : -1);
  const beforeA = car.a;
  car.a += steer * steerPower * dt;
  const nx = car.x + Math.cos(car.a) * car.v * dt;
  const ny = car.y + Math.sin(car.a) * car.v * dt;
  const moved = moveWithCollision(state.city, car.x, car.y, nx - car.x, ny - car.y, 20);
  if ((moved.x !== nx || moved.y !== ny) && Math.abs(car.v) > 60) {
    damageCar(state, car, Math.abs(car.v) * 0.06);
    playSound('crash');
    car.v *= -0.25;
  }
  car.x = moved.x; car.y = moved.y;
  // Bump into other cars.
  for (const other of state.cars) {
    if (other === car || other.wrecked) continue;
    const d = Math.hypot(other.x - car.x, other.y - car.y);
    if (d < 52 && d > 0.01) {
      const push = (52 - d) / 2;
      const ux = (other.x - car.x) / d, uy = (other.y - car.y) / d;
      other.x += ux * push; other.y += uy * push;
      car.x -= ux * push * 0.5; car.y -= uy * push * 0.5;
      if (Math.abs(car.v) > 120) {
        damageCar(state, other, 8);
        damageCar(state, car, 5);
        playSound('crash');
      }
      car.v *= 0.92;
    }
  }
  // Skid marks on hard turns at speed.
  if (Math.abs(car.v) > 150 && Math.abs(car.a - beforeA) > 0.02) {
    state.skids.push({ x: car.x - Math.cos(car.a) * 20, y: car.y - Math.sin(car.a) * 20, a: car.a, life: 3 });
    if (Math.random() < dt * 8) {
      state.particles.push({ x: car.x, y: car.y, vx: 0, vy: 0, life: 0.4, maxLife: 0.4, color: '#cccccc', size: 3 });
    }
  }
  car.smokeT = Math.max(0, car.smokeT - dt);
  if (car.health <= 40 && Math.random() < dt * 6) {
    state.particles.push({ x: car.x, y: car.y - 10, vx: (Math.random() - 0.5) * 20, vy: -40, life: 0.9, maxLife: 0.9, color: '#666666', size: 7 });
  }
  p.x = car.x; p.y = car.y; p.a = car.a; p.speed = Math.abs(car.v);
}

export function nearestCar(state, maxDist) {
  const p = state.player;
  let best = null, bestD = maxDist;
  for (const c of state.cars) {
    if (c.wrecked) continue;
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
