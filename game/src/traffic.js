// traffic.js — the city's traffic: AI cars that follow the road grid,
// turn at intersections, and slow down for the car ahead of them.
import { ROADS_X, ROADS_Y, WORLD_W, WORLD_H } from './city.js';

export function updateTraffic(state, dt) {
  const p = state.player;
  for (const car of state.cars) {
    if (car.driver !== 'traffic' || car.wrecked || !car.ai) continue;
    const ai = car.ai;
    // Slow for the car ahead in the same lane.
    let targetSpeed = ai.speed;
    for (const other of state.cars) {
      if (other === car || other.wrecked) continue;
      const dx = other.x - car.x, dy = other.y - car.y;
      const ahead = ai.axis === 'v' ? dy * ai.dir : dx * ai.dir;
      const lateral = ai.axis === 'v' ? Math.abs(dx) : Math.abs(dy);
      if (ahead > 0 && ahead < 85 && lateral < 42) { targetSpeed = 0; break; }
    }
    // Slow for the player standing or driving in front of us.
    const pdx = p.x - car.x, pdy = p.y - car.y;
    const pAhead = ai.axis === 'v' ? pdy * ai.dir : pdx * ai.dir;
    const pLat = ai.axis === 'v' ? Math.abs(pdx) : Math.abs(pdy);
    if (pAhead > 0 && pAhead < 70 && pLat < 40) targetSpeed = 0;
    car.v += (targetSpeed - car.v) * Math.min(1, dt * 2.2);
    const step = car.v * dt;
    if (ai.axis === 'v') {
      car.y += ai.dir * step;
      car.x += (ai.line + ai.lane - car.x) * Math.min(1, dt * 3);
      car.a = ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (car.y < 130 || car.y > WORLD_H - 130) { ai.dir *= -1; car.y = Math.max(130, Math.min(WORLD_H - 130, car.y)); }
    } else {
      car.x += ai.dir * step;
      car.y += (ai.line + ai.lane - car.y) * Math.min(1, dt * 3);
      car.a = ai.dir > 0 ? 0 : Math.PI;
      if (car.x < 130 || car.x > WORLD_W - 130) { ai.dir *= -1; car.x = Math.max(130, Math.min(WORLD_W - 130, car.x)); }
    }
    // At an intersection, sometimes turn onto the crossing road.
    const nearCross = ai.axis === 'v'
      ? ROADS_Y.some((ry) => Math.abs(car.y - ry) < 26)
      : ROADS_X.some((rx) => Math.abs(car.x - rx) < 26);
    if (nearCross && Math.random() < dt * 0.25) {
      if (ai.axis === 'v') {
        const ry = ROADS_Y.reduce((b, v) => (Math.abs(car.y - v) < Math.abs(car.y - b) ? v : b), ROADS_Y[0]);
        ai.axis = 'h'; ai.line = ry; ai.dir = Math.random() < 0.5 ? 1 : -1;
        ai.lane = (Math.random() < 0.5 ? -1 : 1) * 18;
        car.y = ry;
      } else {
        const rx = ROADS_X.reduce((b, v) => (Math.abs(car.x - v) < Math.abs(car.x - b) ? v : b), ROADS_X[0]);
        ai.axis = 'v'; ai.line = rx; ai.dir = Math.random() < 0.5 ? 1 : -1;
        ai.lane = (Math.random() < 0.5 ? -1 : 1) * 18;
        car.x = rx;
      }
    }
  }
}
