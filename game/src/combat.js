// combat.js — shooting, punching, enemy gunmen, bullets and pickups.
import { pointBlocked } from './city.js';
import { playSound } from './audio.js';
import { addWanted } from './police.js';
import { scarePedestrians } from './pedestrians.js';
import { damageCar } from './cars.js';

export function spawnEnemy(state, x, y, armed) {
  const e = {
    x, y, a: 0, health: 60, armed: !!armed, shootCd: 1 + Math.random(),
    speed: 120, state: 'hunt', punchCd: 0,
  };
  state.enemies.push(e);
  return e;
}

export function spawnPickup(state, x, y, kind) {
  state.pickups.push({ x, y, kind, t: 0 });
}

export function tryShoot(state) {
  const p = state.player;
  if (p.inCar) return false;
  if (p.ammo <= 0) { playSound('fail'); return false; }
  p.ammo--;
  const spread = (Math.random() - 0.5) * 0.06;
  state.bullets.push({
    x: p.x + Math.cos(p.aim) * 22, y: p.y + Math.sin(p.aim) * 22,
    a: p.aim + spread, life: 0.9, from: 'player', dmg: 34,
  });
  playSound('gun');
  scarePedestrians(state, p.x, p.y, 420);
  // A gunshot only draws the police when someone sees or hears it close by.
  const witnessed = state.cops.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 520)
    || state.peds.some((ped) => ped.alive && Math.hypot(ped.x - p.x, ped.y - p.y) < 300);
  if (witnessed) addWanted(state, 1);
  return true;
}

export function tryPunch(state) {
  const p = state.player;
  if (p.inCar || p.punchCd > 0) return false;
  p.punchT = 0.22;
  p.punchCd = 0.45;
  playSound('punch');
  const reach = 52;
  const hx = p.x + Math.cos(p.aim) * reach, hy = p.y + Math.sin(p.aim) * reach;
  let hitAnything = false;
  for (const e of state.enemies) {
    if (Math.hypot(e.x - p.x, e.y - p.y) < 58) {
      e.health -= 25;
      e.x += Math.cos(p.aim) * 14; e.y += Math.sin(p.aim) * 14;
      hitAnything = true;
    }
  }
  for (const cop of state.cops) {
    if (cop.onFoot && Math.hypot(cop.x - p.x, cop.y - p.y) < 58) {
      cop.health -= 25;
      hitAnything = true;
      addWanted(state, 1);
    }
  }
  for (const ped of state.peds) {
    if (ped.alive && Math.hypot(ped.x - hx, ped.y - hy) < 30) {
      ped.alive = false;
      hitAnything = true;
      addWanted(state, 1);
      state.toast = 'Assault reported';
      state.toastT = 2;
      scarePedestrians(state, ped.x, ped.y, 320);
    }
  }
  if (hitAnything) {
    state.particles.push({ x: hx, y: hy, vx: 0, vy: 0, life: 0.25, maxLife: 0.25, color: '#ffd23d', size: 10 });
  }
  return hitAnything;
}

export function hurtPlayer(state, dmg) {
  const p = state.player;
  p.health = Math.max(0, p.health - dmg);
  p.hurtT = 0.35;
  if (p.health <= 0 && state.screen === 'play') {
    state.screen = 'wasted';
    playSound('fail');
  }
}

export function updateCombat(state, input, dt) {
  const p = state.player;
  // Shooting: click, or hold to keep firing at a steady rate.
  state.shootCd = Math.max(0, (state.shootCd || 0) - dt);
  if ((input.mouse.click || input.mouse.down) && state.shootCd <= 0) {
    input.mouse.click = false;
    if (tryShoot(state)) state.shootCd = 0.22;
    else state.shootCd = 0.3;
  }
  if (input.pressed('KeyF')) tryPunch(state);
  // Bullets fly, stop at walls, and hit what they meet.
  for (const b of state.bullets) {
    b.x += Math.cos(b.a) * 720 * dt;
    b.y += Math.sin(b.a) * 720 * dt;
    b.life -= dt;
    if (pointBlocked(state.city, b.x, b.y, 2)) {
      b.life = 0;
      state.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.2, maxLife: 0.2, color: '#ffd23d', size: 3 });
      continue;
    }
    if (b.from === 'player') {
      for (const e of state.enemies) {
        if (Math.hypot(e.x - b.x, e.y - b.y) < 20) {
          e.health -= b.dmg; b.life = 0;
          state.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.3, maxLife: 0.3, color: '#ff5a3d', size: 5 });
        }
      }
      for (const cop of state.cops) {
        if (Math.hypot(cop.x - b.x, cop.y - b.y) < 20) {
          cop.health -= b.dmg; b.life = 0;
          addWanted(state, 1);
        }
      }
      for (const ped of state.peds) {
        if (ped.alive && Math.hypot(ped.x - b.x, ped.y - b.y) < 16) {
          ped.alive = false; b.life = 0;
          addWanted(state, 1);
          state.toast = 'A bystander was hit — police alerted';
          state.toastT = 3;
          scarePedestrians(state, ped.x, ped.y, 320);
        }
      }
      for (const car of state.cars) {
        if (!car.wrecked && Math.hypot(car.x - b.x, car.y - b.y) < 26) {
          b.life = 0;
          // Shooting a car damages it; shooting a police car is a big crime.
          if (car.kind === 'police') addWanted(state, 1);
        }
      }
    } else {
      if (Math.hypot(p.x - b.x, p.y - b.y) < 16 && !p.inCar) {
        b.life = 0;
        hurtPlayer(state, b.dmg * 0.6);
      }
      const car = p.inCar ? state.cars.find((c) => c.id === p.carId) : null;
      if (car && Math.hypot(car.x - b.x, car.y - b.y) < 26) {
        b.life = 0;
        damageCar(state, car, 4);
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
  // Enemies hunt the player and shoot back.
  for (const e of state.enemies) {
    if (e.health <= 0) continue;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    e.a = Math.atan2(p.y - e.y, p.x - e.x);
    e.shootCd -= dt;
    e.punchCd = Math.max(0, e.punchCd - dt);
    if (d > 320) {
      // Too far: hold position and watch the street.
    } else if (e.armed && d > 150) {
      e.x += Math.cos(e.a) * e.speed * dt;
      e.y += Math.sin(e.a) * e.speed * dt;
      if (e.shootCd <= 0) {
        e.shootCd = 1.3 + Math.random() * 0.8;
        const spread = (Math.random() - 0.5) * 0.24;
        state.bullets.push({ x: e.x, y: e.y, a: e.a + spread, life: 0.9, from: 'enemy', dmg: 12 });
        playSound('gun');
      }
    } else if (d <= 150 && e.armed && e.shootCd <= 0) {
      e.shootCd = 1.3 + Math.random() * 0.8;
      state.bullets.push({ x: e.x, y: e.y, a: e.a + (Math.random() - 0.5) * 0.2, life: 0.9, from: 'enemy', dmg: 12 });
      playSound('gun');
    } else if (d < 42 && e.punchCd <= 0) {
      e.punchCd = 0.9;
      hurtPlayer(state, 10);
      playSound('punch');
    }
  }
  // The dead drop cash, and sometimes a pickup.
  for (const e of state.enemies) {
    if (e.health <= 0 && !e.looted) {
      e.looted = true;
      state.stats.kills++;
      p.cash += 25;
      if (Math.random() < 0.35) spawnPickup(state, e.x, e.y, Math.random() < 0.5 ? 'health' : 'ammo');
      state.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0.5, maxLife: 0.5, color: '#ff5a3d', size: 12 });
    }
  }
  state.enemies = state.enemies.filter((e) => e.health > 0);
  // Pickups: walk over to collect.
  for (const pk of state.pickups) {
    pk.t += dt;
    if (!p.inCar && Math.hypot(pk.x - p.x, pk.y - p.y) < 30) {
      pk.taken = true;
      if (pk.kind === 'health') { p.health = Math.min(100, p.health + 40); state.toast = 'Health +40'; }
      if (pk.kind === 'ammo') { p.ammo += 24; state.toast = 'Ammo +24'; }
      if (pk.kind === 'cash') { p.cash += 60; state.toast = 'Found $60'; }
      state.toastT = 2;
      playSound('pickup');
    }
  }
  state.pickups = state.pickups.filter((pk) => !pk.taken && pk.t < 90);
  // Loose cash packages on the street.
  for (const pkg of state.packages) {
    if (pkg.taken) { pkg.respawnT -= dt; if (pkg.respawnT <= 0) { pkg.taken = false; } continue; }
    if (!p.inCar && Math.hypot(pkg.x - p.x, pkg.y - p.y) < 32) {
      pkg.taken = true;
      pkg.respawnT = 60;
      p.cash += 60;
      state.toast = 'Package collected · +$60';
      state.toastT = 2;
      playSound('cash');
    }
  }
}
