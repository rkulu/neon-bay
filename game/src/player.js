// player.js — Maya Reyes on foot: walking, running, entering and leaving
// cars, and the punch. Driving itself lives in cars.js.
import { moveWithCollision } from './city.js';

export function newPlayer(x, y) {
  return {
    x, y, a: 0, health: 100, ammo: 24, cash: 480,
    inCar: false, carId: -1,
    punchT: 0, punchCd: 0, hurtT: 0, speed: 0,
  };
}

const FOOT_SPEED = 175;
const RUN_SPEED = 265;

export function updatePlayerOnFoot(state, input, dt) {
  const p = state.player;
  if (p.inCar || state.screen !== 'play' || state.pause) return;
  const k = input.keys;
  let dx = 0, dy = 0;
  if (k.has('KeyW') || k.has('ArrowUp')) dy -= 1;
  if (k.has('KeyS') || k.has('ArrowDown')) dy += 1;
  if (k.has('KeyA') || k.has('ArrowLeft')) dx -= 1;
  if (k.has('KeyD') || k.has('ArrowRight')) dx += 1;
  const len = Math.hypot(dx, dy);
  const running = k.has('ShiftLeft') || k.has('ShiftRight');
  const speed = running ? RUN_SPEED : FOOT_SPEED;
  if (len > 0) {
    dx /= len; dy /= len;
    p.a = Math.atan2(dy, dx);
    const moved = moveWithCollision(state.city, p.x, p.y, dx * speed * dt, dy * speed * dt, 14);
    p.x = moved.x; p.y = moved.y;
    p.speed = speed;
    if (Math.random() < dt * 2 && running) addFootstep(state);
  } else {
    p.speed = 0;
  }
  p.punchT = Math.max(0, p.punchT - dt);
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.hurtT = Math.max(0, p.hurtT - dt);
  // Aim follows the mouse, in world space.
  const cam = state.cam;
  const wx = input.mouse.x + cam.x - state.view.w / 2;
  const wy = input.mouse.y + cam.y - state.view.h / 2;
  p.aim = Math.atan2(wy - p.y, wx - p.x);
}

function addFootstep(state) {
  state.particles.push({
    x: state.player.x, y: state.player.y + 10, vx: 0, vy: 0,
    life: 0.4, maxLife: 0.4, color: '#ffffff', size: 2, fade: true,
  });
}

export function nearestCarToPlayer(state, maxDist) {
  const p = state.player;
  let best = null, bestD = maxDist;
  for (const c of state.cars) {
    if (c.wrecked) continue;
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
