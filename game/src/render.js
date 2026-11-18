// render.js — draws Neon Bay: the city, the cars and people on it, the
// lighting, and the title / pause / busted / wasted screens.
import { WORLD_W, WORLD_H, ROADS_X, ROADS_Y, ROAD_HALF, isOnRoad } from './city.js';
import { drawHUD } from './hud.js';
import { missionTarget, sideTarget, currentGiver } from './missions.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  function draw(state) {
    const w = canvas.width, h = canvas.height;
    state.view.w = w; state.view.h = h;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0e1a22';
    ctx.fillRect(0, 0, w, h);
    const camX = clamp(state.cam.x - w / 2, 0, Math.max(0, WORLD_W - w));
    const camY = clamp(state.cam.y - h / 2, 0, Math.max(0, WORLD_H - h));
    ctx.save();
    ctx.translate(-camX, -camY);
    drawGround(ctx, state);
    drawMarkers(ctx, state);
    drawSkids(ctx, state);
    drawPickups(ctx, state);
    for (const car of state.cars) drawCar(ctx, state, car);
    for (const ped of state.peds) drawPed(ctx, ped);
    for (const e of state.enemies) drawEnemy(ctx, e);
    for (const cop of state.cops) drawCop(ctx, state, cop);
    drawPlayer(ctx, state);
    drawBullets(ctx, state);
    drawParticles(ctx, state);
    ctx.restore();
    drawLighting(ctx, state, w, h);
    if (state.screen === 'play') {
      drawHUD(ctx, state);
      if (!state.player.inCar) drawReticle(ctx, state);
    } else {
      drawScreen(ctx, state, w, h);
    }
  }

  return { draw, canvas };
}

function drawGround(ctx, state) {
  const city = state.city;
  // Grass base.
  ctx.fillStyle = '#7fae6a';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // City blocks (pavement).
  ctx.fillStyle = '#d8d2c4';
  for (let i = 0; i < ROADS_X.length - 1; i++) {
    for (let j = 0; j < ROADS_Y.length - 1; j++) {
      const x0 = ROADS_X[i] + ROAD_HALF, x1 = ROADS_X[i + 1] - ROAD_HALF;
      const y0 = ROADS_Y[j] + ROAD_HALF, y1 = ROADS_Y[j + 1] - ROAD_HALF;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
  // South strip and beach.
  ctx.fillStyle = '#d8d2c4';
  ctx.fillRect(0, ROADS_Y[ROADS_Y.length - 1] + ROAD_HALF, 2920, WORLD_H - ROADS_Y[ROADS_Y.length - 1] - ROAD_HALF);
  ctx.fillStyle = '#ecd9a0';
  ctx.fillRect(2920, 0, 190, WORLD_H);
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(3110, 0, WORLD_W - 3110, WORLD_H);
  ctx.fillRect(0, 2330, WORLD_W, WORLD_H - 2330);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  for (let y = 60; y < WORLD_H; y += 130) {
    ctx.beginPath(); ctx.moveTo(3120, y); ctx.quadraticCurveTo(3150, y + 12, 3180, y); ctx.stroke();
  }
  // Parks and trees.
  for (const park of city.parks) {
    ctx.fillStyle = '#5da85f';
    ctx.fillRect(park.x, park.y, park.w, park.h);
  }
  for (const tree of city.trees) {
    ctx.fillStyle = '#2f6b3a';
    ctx.beginPath(); ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4c9a58';
    ctx.beginPath(); ctx.arc(tree.x - 3, tree.y - 3, tree.r * 0.7, 0, Math.PI * 2); ctx.fill();
  }
  // Roads.
  for (const rx of ROADS_X) {
    ctx.fillStyle = '#3c4148';
    ctx.fillRect(rx - ROAD_HALF, 0, ROAD_HALF * 2, WORLD_H);
    ctx.fillStyle = '#c9c2b2';
    ctx.fillRect(rx - ROAD_HALF - 7, 0, 7, WORLD_H);
    ctx.fillRect(rx + ROAD_HALF, 0, 7, WORLD_H);
    ctx.strokeStyle = '#e8d44d';
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, WORLD_H); ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const ry of ROADS_Y) {
    ctx.fillStyle = '#3c4148';
    ctx.fillRect(0, ry - ROAD_HALF, WORLD_W, ROAD_HALF * 2);
    ctx.fillStyle = '#c9c2b2';
    ctx.fillRect(0, ry - ROAD_HALF - 7, WORLD_W, 7);
    ctx.fillRect(0, ry + ROAD_HALF, WORLD_W, 7);
    ctx.strokeStyle = '#e8d44d';
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(WORLD_W, ry); ctx.stroke();
    ctx.setLineDash([]);
  }
  // Buildings.
  for (const b of city.buildings) {
    ctx.fillStyle = 'rgba(20,30,25,0.25)';
    ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, 7);
    ctx.fillStyle = '#5a6b62';
    for (let xx = b.x + 18; xx < b.x + b.w - 14; xx += 42) {
      ctx.fillRect(xx, b.y + 22, 18, 12);
      ctx.fillRect(xx, b.y + b.h - 34, 18, 12);
    }
    if (b.tall) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + b.w * 0.6, b.y + b.h * 0.25, 26, 36);
    }
  }
  // Palms along the beach.
  for (let y = 120; y < WORLD_H; y += 260) {
    drawPalm(ctx, 2960, y);
    drawPalm(ctx, 3060, y + 130);
  }
}

function drawPalm(ctx, x, y) {
  ctx.fillStyle = '#74513b';
  ctx.fillRect(x, y, 7, 26);
  ctx.strokeStyle = '#438c62';
  ctx.lineWidth = 6;
  for (let a = 0; a < 6; a++) {
    const t = a * Math.PI / 3;
    ctx.beginPath(); ctx.moveTo(x + 3, y + 4); ctx.lineTo(x + 3 + Math.cos(t) * 26, y + 4 + Math.sin(t) * 20); ctx.stroke();
  }
}

function drawMarkers(ctx, state) {
  const targets = [];
  const mt = missionTarget(state);
  if (mt) targets.push({ ...mt, color: '#ffd45e' });
  const st = sideTarget(state);
  if (st) targets.push({ ...st, color: '#7dff8a' });
  const giver = currentGiver(state);
  if (giver && !state.mission) targets.push({ x: giver.giverAt.x, y: giver.giverAt.y, label: giver.giver, color: '#ffd45e' });
  if (state.mission && state.mission.crates) {
    for (const crate of state.mission.crates) {
      if (!crate.taken) targets.push({ x: crate.x, y: crate.y, label: 'Crate', color: '#ffd45e' });
    }
  }
  if (state.mission && state.mission.checkpoints) {
    const cp = state.mission.checkpoints[state.mission.cpIndex];
    if (cp) targets.push({ x: cp.x, y: cp.y, label: 'Checkpoint', color: '#ffd45e' });
  }
  for (const m of targets) {
    const bob = Math.sin(state.elapsed * 3) * 5;
    ctx.save();
    ctx.translate(m.x, m.y + bob);
    ctx.fillStyle = 'rgba(255,212,94,0.16)';
    ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = m.color;
    ctx.fillRect(-14, -14, 28, 28);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-14, -14, 28, 8);
    ctx.restore();
  }
}

function drawSkids(ctx, state) {
  for (const s of state.skids) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.a);
    ctx.fillStyle = 'rgba(27,32,30,' + (s.life * 0.08) + ')';
    ctx.fillRect(-22, -3, 44, 6);
    ctx.restore();
  }
}

function drawPickups(ctx, state) {
  for (const pk of state.pickups) {
    const bob = Math.sin(state.elapsed * 4 + pk.x) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'health') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-11, -11, 22, 22);
      ctx.fillStyle = '#e34b4b';
      ctx.fillRect(-3, -8, 6, 16);
      ctx.fillRect(-8, -3, 16, 6);
    } else if (pk.kind === 'ammo') {
      ctx.fillStyle = '#ffd23d';
      ctx.fillRect(-11, -8, 22, 16);
      ctx.fillStyle = '#7a5b00';
      ctx.fillRect(-7, -4, 4, 8); ctx.fillRect(0, -4, 4, 8); ctx.fillRect(7, -4, 4, 8);
    } else {
      ctx.fillStyle = '#7dff8a';
      ctx.fillRect(-10, -10, 20, 20);
      ctx.fillStyle = '#0c5a1e';
      ctx.font = '700 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 5);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }
  for (const pkg of state.packages) {
    if (pkg.taken) continue;
    const bob = Math.sin(state.elapsed * 3 + pkg.y) * 3;
    ctx.save();
    ctx.translate(pkg.x, pkg.y + bob);
    ctx.fillStyle = '#c98a3f';
    ctx.fillRect(-12, -12, 24, 24);
    ctx.fillStyle = '#8a5a1e';
    ctx.fillRect(-12, -3, 24, 6);
    ctx.fillStyle = '#ffd45e';
    ctx.fillRect(-2, -12, 4, 24);
    ctx.restore();
  }
}

function drawCar(ctx, state, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.a);
  ctx.fillStyle = 'rgba(0,0,0,0.27)';
  ctx.fillRect(-car.len / 2 - 2, -car.wid / 2 - 1, car.len + 4, car.wid + 6);
  const body = car.wrecked ? '#5a5a5a' : car.color;
  ctx.fillStyle = body;
  roundRectPath(ctx, -car.len / 2, -car.wid / 2, car.len, car.wid, 9);
  ctx.fill();
  ctx.fillStyle = '#a9d7d4';
  ctx.fillRect(-car.len * 0.18, -car.wid / 2 + 4, car.len * 0.26, car.wid - 8);
  ctx.fillStyle = '#222e34';
  ctx.fillRect(car.len / 2 - 8, -car.wid / 2 + 3, 5, car.wid - 6);
  ctx.fillStyle = '#faf0c7';
  ctx.fillRect(car.len / 2 - 2, -car.wid / 2 + 3, 3, 6);
  ctx.fillRect(car.len / 2 - 2, car.wid / 2 - 9, 3, 6);
  if (car.kind === 'police') {
    ctx.fillStyle = '#2b4d67';
    ctx.fillRect(-car.len * 0.3, -car.wid / 2, car.len * 0.18, car.wid);
    const flash = Math.floor(state.elapsed * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#fa4354' : '#3e9ceb';
    ctx.fillRect(-6, -car.wid / 2 - 4, 12, 5);
    ctx.fillStyle = flash ? '#3e9ceb' : '#fa4354';
    ctx.fillRect(-6, car.wid / 2 - 1, 12, 5);
  }
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#222222';
    for (let i = 0; i < 5; i++) ctx.fillRect(-car.len / 2 + 6 + i * 12, -car.wid / 2 + 2, 6, 5);
    ctx.fillStyle = '#f2c230';
    ctx.fillRect(-8, -car.wid / 2 - 6, 16, 6);
  }
  if (car.health <= 40 && !car.wrecked) {
    ctx.fillStyle = 'rgba(90,90,90,0.6)';
    ctx.beginPath(); ctx.arc(-car.len / 4, -car.wid / 4, 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  if (car.driver === 'player') {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(car.x, car.y, 46, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}

function drawPed(ctx, ped) {
  if (!ped.alive) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(ped.x, ped.y, 12, 6, ped.a, 0, Math.PI * 2); ctx.fill();
    return;
  }
  const bob = Math.sin(ped.walkPhase) * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.23)';
  ctx.beginPath(); ctx.ellipse(ped.x, ped.y + 6, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.color;
  ctx.beginPath(); ctx.arc(ped.x, ped.y + bob * 0.4, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f1caad';
  ctx.beginPath(); ctx.arc(ped.x, ped.y - 9 + bob * 0.4, 4.5, 0, Math.PI * 2); ctx.fill();
}

function drawEnemy(ctx, e) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(e.x, e.y + 6, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8a2f2f';
  ctx.beginPath(); ctx.arc(e.x, e.y, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f1caad';
  ctx.beginPath(); ctx.arc(e.x, e.y - 10, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#222222';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.a) * 22, e.y + Math.sin(e.a) * 22); ctx.stroke();
}

function drawCop(ctx, state, cop) {
  if (!cop.onFoot) return; // the cruiser is drawn as a car
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(cop.x, cop.y + 6, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#294d68';
  ctx.beginPath(); ctx.arc(cop.x, cop.y, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#dfe9ef';
  ctx.beginPath(); ctx.arc(cop.x, cop.y - 10, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1d3550';
  ctx.fillRect(cop.x - 6, cop.y - 16, 12, 4);
  if (cop.arrestT > 0) {
    ctx.fillStyle = '#ff5a3d';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STOP!', cop.x, cop.y - 26);
    ctx.textAlign = 'left';
  }
}

function drawPlayer(ctx, state) {
  const p = state.player;
  if (p.inCar) return; // the car shows where Maya is
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(0, 10, 13, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(p.a);
  // Pistol arm.
  ctx.strokeStyle = '#222222';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(24, 0); ctx.stroke();
  // Punch swing.
  if (p.punchT > 0) {
    ctx.strokeStyle = 'rgba(255,210,61,0.9)';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, 34, -0.6, 0.6); ctx.stroke();
  }
  ctx.fillStyle = '#35667b';
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#edbe91';
  ctx.beginPath(); ctx.arc(0, -11, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath(); ctx.arc(0, -13, 6.5, Math.PI, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBullets(ctx, state) {
  for (const b of state.bullets) {
    ctx.strokeStyle = 'rgba(255,224,137,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - Math.cos(b.a) * 14, b.y - Math.sin(b.a) * 14);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = '#ffe089';
    ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill();
  }
}

function drawParticles(ctx, state) {
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawLighting(ctx, state, w, h) {
  const clock = state.clock;
  let alpha = 0;
  if (clock >= 20 || clock < 5.5) alpha = 0.30;
  else if (clock >= 17.5) alpha = 0.14;
  else if (clock < 7) alpha = 0.10;
  if (alpha > 0) {
    ctx.fillStyle = 'rgba(12,22,58,' + alpha + ')';
    ctx.fillRect(0, 0, w, h);
  }
  const vign = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  vign.addColorStop(0, 'rgba(8,18,25,0)');
  vign.addColorStop(1, 'rgba(8,18,25,0.28)');
  ctx.fillStyle = vign;
  ctx.fillRect(0, 0, w, h);
}

function drawReticle(ctx, state) {
  const p = state.player;
  const camX = clamp(state.cam.x - state.view.w / 2, 0, Math.max(0, WORLD_W - state.view.w));
  const camY = clamp(state.cam.y - state.view.h / 2, 0, Math.max(0, WORLD_H - state.view.h));
  const sx = p.x - camX + Math.cos(p.aim) * 26;
  const sy = p.y - camY + Math.sin(p.aim) * 26;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2); ctx.stroke();
}

function drawScreen(ctx, state, w, h) {
  ctx.fillStyle = 'rgba(8,25,34,0.62)';
  ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = 'top';
  if (state.screen === 'title') {
    ctx.fillStyle = '#edc07c';
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText('NEON BAY  /  A SUN-SOAKED COASTAL CITY', 75, 66);
    ctx.fillStyle = '#fff2d8';
    ctx.font = '900 84px system-ui, sans-serif';
    ctx.fillText('NEON BAY', 72, 110);
    ctx.fillStyle = '#f3bc67';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText('AN ORIGINAL OPEN-WORLD CRIME STORY', 80, 210);
    ctx.fillStyle = '#e0e9dc';
    ctx.font = '400 18px system-ui, sans-serif';
    ctx.fillText('Maya Reyes came to Neon Bay with one delivery and no plan.', 80, 268);
    ctx.fillText('She will leave with a city full of stories — if the police let her.', 80, 296);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.fillText(state.saveAvailable ? 'ENTER  NEW GAME     ·     C  CONTINUE SAVED GAME' : 'ENTER  NEW GAME', 80, 372);
    ctx.fillStyle = '#d5c39e';
    ctx.font = '400 15px system-ui, sans-serif';
    ctx.fillText('WASD / arrows move & drive  ·  Mouse aim  ·  Click fire  ·  E enter / exit car  ·  F punch', 80, 420);
    ctx.fillText('Shift run  ·  Space brake  ·  P pause  ·  R title  ·  T taxi fare when driving a cab', 80, 446);
    ctx.fillText('Five story jobs  ·  traffic & pedestrians  ·  wanted level & police  ·  live minimap', 80, 472);
    ctx.fillStyle = '#efc879';
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillText('A STORY OF SUN, SPEED & SECOND CHANCES', 80, 620);
  } else if (state.pause) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 58px system-ui, sans-serif';
    ctx.fillText('PAUSED', 80, 300);
    ctx.font = '400 18px system-ui, sans-serif';
    ctx.fillText('P / Esc resume  ·  S save game  ·  R back to title', 80, 380);
  } else if (state.screen === 'busted' || state.screen === 'wasted') {
    const busted = state.screen === 'busted';
    ctx.fillStyle = busted ? '#7fb7ff' : '#f36f5d';
    ctx.font = '900 72px system-ui, sans-serif';
    ctx.fillText(busted ? 'BUSTED' : 'WASTED', 80, 280);
    ctx.fillStyle = '#ffffff';
    ctx.font = '400 20px system-ui, sans-serif';
    ctx.fillText(busted ? 'The Neon Bay police took you in. Maya will be out soon.' : 'Maya went down in the streets of Neon Bay.', 80, 372);
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.fillText('Press R to try again — your saved progress remains', 80, 420);
  }
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
