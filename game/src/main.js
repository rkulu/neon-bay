// main.js — boot and the frame loop. In normal play it runs the game;
// with ?shot= it stages one deterministic scene, lets it settle for a
// moment, draws it once, and raises window.__shotReady for screenshots.
import { newState, tick, saveGame, loadSave } from './world.js';
import { createRenderer } from './render.js';
import { makeInput, makeDummyInput } from './input.js';
import { stageShot } from './shots.js';
import { unlockAudio, playSound } from './audio.js';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const view = createRenderer(canvas);
const io = makeInput(canvas);
const params = new URLSearchParams(location.search);
const shot = params.get('shot');

window.addEventListener('keydown', () => unlockAudio(), { once: true });
canvas.addEventListener('mousedown', () => unlockAudio(), { once: true });

if (shot) {
  // Screenshot mode: stage, settle, draw, signal.
  const s = stageShot(shot);
  view.draw(s);
  const dummy = makeDummyInput();
  // Keep the gas down while a driving scene settles, so the chase stays fast.
  if (shot === 'chase' || shot === 'drive') dummy.keys.add('KeyW');
  for (let i = 0; i < 45; i++) tick(s, dummy, 1 / 30);
  view.draw(s);
  requestAnimationFrame(() => {
    view.draw(s);
    window.__shotReady = true;
  });
} else {
  let s = newState({ ignoreSave: true });
  s.saveAvailable = !!loadSave();
  let last = performance.now();
  // Test hook: lets automated smoke tests inspect the live state.
  window.__neonbay = { get state() { return s; } };

  function frame(now) {
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    if (s.screen === 'title') {
      if (io.keys.has('Enter') || io.keys.has('Space') || io.mouse.click) {
        io.keys.delete('Enter'); io.keys.delete('Space'); io.mouse.click = false;
        s = newState({ ignoreSave: true });
        s.screen = 'play';
        unlockAudio();
        playSound('mission');
      } else if (io.keys.has('KeyC') && s.saveAvailable) {
        io.keys.delete('KeyC');
        s = newState();
        s.screen = 'play';
        unlockAudio();
      }
    } else if (s.screen === 'busted' || s.screen === 'wasted') {
      if (io.keys.has('KeyR') || io.keys.has('Enter') || io.mouse.click) {
        io.keys.delete('KeyR'); io.keys.delete('Enter'); io.mouse.click = false;
        s = newState();
        s.screen = 'play';
      }
    } else if (s.screen === 'play') {
      tick(s, io, dt);
    }
    io.clearHits();
    view.draw(s);
    status.textContent = s.screen + '. Health ' + Math.round(s.player.health) + '. Cash ' + s.player.cash + '.';
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.addEventListener('beforeunload', () => { if (s.screen === 'play') saveGame(s); });
}
