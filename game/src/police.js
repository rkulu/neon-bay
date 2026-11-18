// police.js — the wanted system: crimes raise the heat, police cruisers
// and foot cops chase, ram and arrest, and the heat cools off when the
// player stays hidden and quiet.
import { ROADS_X, ROADS_Y, nearestRoadPoint } from './city.js';
import { makeCar, damageCar } from './cars.js';
import { playSound } from './audio.js';

export function addWanted(state, n) {
  state.wanted = Math.max(0, Math.min(5, state.wanted + n));
  state.crimeT = 0;
  state.decayT = 0;
}

export function spawnPoliceCar(state) {
  const p = state.player;
  const spot = nearestRoadPoint(state.rng);
  // Keep the spawn off-screen but close enough to join the chase.
  const dx = spot.x - p.x, dy = spot.y - p.y;
  const d = Math.hypot(dx, dy) || 1;
  const sx = p.x + (dx / d) * 620, sy = p.y + (dy / d) * 620;
  const car = makeCar(sx, sy, Math.atan2(p.y - sy, p.x - sx), 1, 'police', 'police');
  car.v = 180;
  state.cars.push(car);
  const cop = {
    x: sx, y: sy, a: car.a, v: 0, onFoot: false, carId: car.id,
    arrestT: 0, health: 100,
  };
  state.cops.push(cop);
  return cop;
}

export function spawnFootCop(state) {
  const p = state.player;
  const ang = Math.random() * Math.PI * 2;
  const cop = {
    x: p.x + Math.cos(ang) * 480, y: p.y + Math.sin(ang) * 480,
    a: 0, v: 0, onFoot: true, carId: -1, arrestT: 0, health: 100,
  };
  state.cops.push(cop);
  return cop;
}

export function updatePolice(state, dt) {
  const p = state.player;
  const wanted = state.wanted;
  // Reinforcements arrive while the heat is on.
  const policeCars = state.cops.filter((c) => !c.onFoot).length;
  const footCops = state.cops.filter((c) => c.onFoot).length;
  if (wanted > 0) {
    const wantCars = Math.min(4, wanted);
    const wantFoot = p.inCar ? 0 : Math.min(3, wanted - 1);
    if (policeCars < wantCars && Math.random() < dt * 0.9) spawnPoliceCar(state);
    if (footCops < wantFoot && Math.random() < dt * 0.7) spawnFootCop(state);
  }
  // Each cop chases, rams, or tries to make the arrest.
  for (const cop of state.cops) {
    const dx = p.x - cop.x, dy = p.y - cop.y;
    const d = Math.hypot(dx, dy) || 1;
    cop.a = Math.atan2(dy, dx);
    if (!cop.onFoot) {
      const car = state.cars.find((c) => c.id === cop.carId);
      if (!car || car.wrecked) { cop.onFoot = true; cop.carId = -1; continue; }
      const speed = 190 + wanted * 28;
      // Pure pursuit with a turn limit so the chase feels drivable.
      let diff = cop.a - car.a;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.a += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
      car.v += (speed - car.v) * Math.min(1, dt * 1.4);
      car.x += Math.cos(car.a) * car.v * dt;
      car.y += Math.sin(car.a) * car.v * dt;
      cop.x = car.x; cop.y = car.y;
      // Ram the player's car — or the player, if they are on foot.
      const playerCar = p.inCar ? state.cars.find((c) => c.id === p.carId) : null;
      if (playerCar && d < 62) {
        damageCar(state, playerCar, 6 * dt);
        playerCar.v *= 0.96;
        if (Math.random() < dt * 2) playSound('crash');
        state.particles.push({ x: car.x, y: car.y, vx: 0, vy: 0, life: 0.3, maxLife: 0.3, color: '#ffd23d', size: 4 });
      } else if (!p.inCar && d < 44) {
        // Cop bails out to chase on foot.
        cop.onFoot = true;
        cop.carId = -1;
        car.driver = 'none';
        car.parked = true;
        car.v = 0;
        playSound('arrest');
      }
    } else {
      const speed = 168 + wanted * 6;
      cop.x += Math.cos(cop.a) * speed * dt;
      cop.y += Math.sin(cop.a) * speed * dt;
      if (d < 38) {
        cop.arrestT += dt;
        if (cop.arrestT > 1.1) {
          state.screen = 'busted';
          playSound('busted');
          return;
        }
      } else {
        cop.arrestT = Math.max(0, cop.arrestT - dt * 2);
      }
      // A foot cop close to a slow player car gets back in the chase.
      if (p.inCar && d < 60) {
        const car = state.cars.find((c) => c.id === cop.carId);
        if (car && !car.wrecked) { cop.onFoot = false; }
      }
    }
  }
  // Heat cools off when no cop can see the player and no crime happened.
  state.crimeT += dt;
  let nearest = Infinity;
  for (const cop of state.cops) nearest = Math.min(nearest, Math.hypot(cop.x - p.x, cop.y - p.y));
  if (wanted > 0 && nearest > 430 && state.crimeT > 8) {
    state.decayT += dt;
    if (state.decayT > 6) {
      state.decayT = 0;
      state.wanted = Math.max(0, wanted - 1);
      if (state.wanted === 0) {
        state.toast = 'You lost them — the heat is off';
        state.toastT = 3;
      }
    }
  } else {
    state.decayT = 0;
  }
  // Stand down when the heat is gone.
  if (wanted === 0 && state.cops.length > 0) {
    for (const cop of state.cops) {
      if (!cop.onFoot) {
        const car = state.cars.find((c) => c.id === cop.carId);
        if (car) { car.driver = 'none'; car.parked = true; car.v = 0; }
      }
    }
    state.cops = [];
  }
}
