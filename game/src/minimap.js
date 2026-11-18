// minimap.js — the live minimap: the whole city shrunk into a corner,
// with the player, police, mission marker, cars and side jobs on it.
import { WORLD_W, WORLD_H, ROADS_X, ROADS_Y, ROAD_HALF } from './city.js';
import { missionTarget, sideTarget } from './missions.js';

export function drawMinimap(ctx, state, x, y, size) {
  const p = state.player;
  const scale = size / WORLD_W;
  const h = WORLD_H * scale;
  ctx.save();
  ctx.fillStyle = 'rgba(5,20,26,0.85)';
  ctx.fillRect(x, y, size + 24, h + 24);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, size + 24, h + 24);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 12, y + 12, size, h);
  ctx.clip();
  ctx.translate(x + 12, y + 12);
  // Ground, water, beach.
  ctx.fillStyle = '#3f6b4a';
  ctx.fillRect(0, 0, size, h);
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(3110 * scale, 0, (WORLD_W - 3110) * scale, h);
  ctx.fillRect(0, 2330 * scale, size, (WORLD_H - 2330) * scale);
  ctx.fillStyle = '#ecd9a0';
  ctx.fillRect(2920 * scale, 0, 190 * scale, h);
  // Roads.
  ctx.fillStyle = '#8a8f96';
  for (const rx of ROADS_X) ctx.fillRect((rx - ROAD_HALF) * scale, 0, ROAD_HALF * 2 * scale, h);
  for (const ry of ROADS_Y) ctx.fillRect(0, (ry - ROAD_HALF) * scale, size, ROAD_HALF * 2 * scale);
  // Buildings.
  ctx.fillStyle = '#5a6b62';
  for (const b of state.city.buildings) ctx.fillRect(b.x * scale, b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
  // Side-job and mission markers.
  const target = missionTarget(state) || sideTarget(state);
  if (target) {
    const pulse = 5 + 2 * Math.sin(state.elapsed * 5);
    ctx.fillStyle = '#ffd45e';
    ctx.beginPath();
    ctx.arc(target.x * scale, target.y * scale, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff2c0';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Street packages.
  ctx.fillStyle = '#7dff8a';
  for (const pkg of state.packages) {
    if (!pkg.taken) ctx.fillRect(pkg.x * scale - 2, pkg.y * scale - 2, 4, 4);
  }
  // Cars, police, enemies, player.
  ctx.fillStyle = '#c8d2cc';
  for (const car of state.cars) {
    if (car.wrecked) continue;
    ctx.fillRect(car.x * scale - 2, car.y * scale - 2, 4, 4);
  }
  ctx.fillStyle = '#4fa3ff';
  for (const cop of state.cops) {
    ctx.beginPath();
    ctx.arc(cop.x * scale, cop.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ff5a3d';
  for (const e of state.enemies) {
    ctx.beginPath();
    ctx.arc(e.x * scale, e.y * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  ctx.save();
  ctx.translate(p.x * scale, p.y * scale);
  ctx.rotate(p.a);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.restore();
}
