// hud.js — the heads-up display: health, cash, ammo, wanted stars, speed,
// clock, objective tracker, dialogue and prompts, drawn over the world.
import { drawMinimap } from './minimap.js';
import { objectiveText, missionTarget, sideTarget } from './missions.js';
import { districtAt } from './city.js';

export function drawHUD(ctx, state) {
  const w = state.view.w, h = state.view.h;
  const p = state.player;
  ctx.save();
  ctx.textBaseline = 'top';
  // Top-left: identity, cash, health, ammo.
  ctx.fillStyle = 'rgba(4,18,24,0.82)';
  roundRect(ctx, 20, 18, 320, 108, 10); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 17px system-ui, sans-serif';
  ctx.fillText('MAYA REYES', 36, 28);
  ctx.fillStyle = '#efbe7e';
  ctx.font = '800 30px system-ui, sans-serif';
  ctx.fillText('$' + p.cash.toLocaleString(), 36, 52);
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillStyle = '#cbd8d3';
  ctx.fillText('HEALTH', 200, 30);
  ctx.fillStyle = '#23393c';
  ctx.fillRect(200, 52, 120, 14);
  ctx.fillStyle = p.health < 35 ? '#ff6558' : '#67d49c';
  ctx.fillRect(200, 52, 120 * Math.max(0, p.health) / 100, 14);
  ctx.fillStyle = '#e8d9b1';
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillText(p.inCar ? 'PISTOL  ' + p.ammo + '  ·  DRIVING' : 'PISTOL  ' + p.ammo, 36, 96);
  // Top-right: wanted stars, clock, district.
  const stars = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
  ctx.font = '700 26px system-ui, sans-serif';
  ctx.fillStyle = '#f8c75b';
  ctx.textAlign = 'right';
  ctx.fillText(stars, w - 24, 24);
  const hr = Math.floor(state.clock), mn = Math.floor((state.clock % 1) * 60);
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillStyle = '#f2eee1';
  ctx.fillText(String(hr).padStart(2, '0') + ':' + String(mn).padStart(2, '0') + '  ·  ' + districtAt(p.x, p.y).toUpperCase(), w - 24, 58);
  ctx.textAlign = 'left';
  // Objective panel, top center.
  const obj = objectiveText(state);
  ctx.fillStyle = 'rgba(5,19,25,0.86)';
  roundRect(ctx, 368, 18, 480, 92, 10); ctx.fill();
  ctx.fillStyle = '#f2bd59';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillText(obj.title.toUpperCase(), 386, 30);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 17px system-ui, sans-serif';
  ctx.fillText(obj.goal, 386, 54);
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillStyle = '#b5c8c5';
  ctx.fillText((obj.giver ? obj.giver + '   •   ' : '') + 'Reward $' + obj.reward, 386, 82);
  // Speed + car health while driving.
  if (p.inCar) {
    const car = state.cars.find((c) => c.id === p.carId);
    if (car) {
      ctx.fillStyle = 'rgba(5,18,25,0.8)';
      roundRect(ctx, 20, 140, 190, 80, 10); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.fillText('SPEED', 34, 148);
      ctx.font = '800 26px system-ui, sans-serif';
      ctx.fillText(Math.abs(Math.round(car.v * 0.55)) + ' km/h', 34, 166);
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.fillStyle = '#e1b68d';
      ctx.fillText('ENGINE ' + Math.max(0, Math.round(car.health)) + '%', 34, 196);
    }
  }
  // Minimap, bottom right.
  drawMinimap(ctx, state, w - 244, h - 196, 220);
  // Interaction prompt.
  if (state.prompt) {
    ctx.fillStyle = 'rgba(5,18,25,0.85)';
    const pw = ctx.measureText(state.prompt).width + 36;
    roundRect(ctx, (w - pw) / 2, h - 268, pw, 36, 8); ctx.fill();
    ctx.fillStyle = '#ffe0a1';
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.prompt, w / 2, h - 258);
    ctx.textAlign = 'left';
  }
  // Dialogue box.
  if (state.dialogue && state.dialogue.t > 0) {
    ctx.fillStyle = 'rgba(5,18,25,0.88)';
    roundRect(ctx, 300, h - 210, w - 600, 74, 10); ctx.fill();
    ctx.fillStyle = '#f2bd59';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText(state.dialogue.speaker.toUpperCase(), 322, h - 200);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 16px system-ui, sans-serif';
    wrapText(ctx, state.dialogue.text, 322, h - 176, w - 644, 22);
  }
  // Toast line.
  if (state.toastT > 0 && state.toast) {
    ctx.fillStyle = 'rgba(5,18,25,0.83)';
    const tw = ctx.measureText(state.toast).width + 40;
    roundRect(ctx, (w - tw) / 2, h - 130, tw, 40, 8); ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe0a1';
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillText(state.toast, w / 2, h - 119);
    ctx.textAlign = 'left';
  }
  // Controls reminder.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText('WASD move / drive · Shift run · Space brake · E enter / exit · F punch · Click shoot · P pause · R title', 24, h - 24);
  // Low-health flash.
  if (p.health < 30 && !p.inCar) {
    ctx.fillStyle = 'rgba(255,40,40,' + (0.08 + 0.05 * Math.sin(state.elapsed * 6)) + ')';
    ctx.fillRect(0, 0, w, h);
  }
  // Hurt flash.
  if (p.hurtT > 0) {
    ctx.fillStyle = 'rgba(255,40,40,' + (p.hurtT * 0.5) + ')';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}
