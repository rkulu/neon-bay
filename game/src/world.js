// world.js — the game state and the main tick: it wires every system
// together (player, cars, traffic, pedestrians, police, missions, combat)
// and owns saving and loading.
import { buildCity, mulberry32 } from './city.js';
import { newPlayer, updatePlayerOnFoot, nearestCarToPlayer } from './player.js';
import { makeCars, carById, updatePlayerCar } from './cars.js';
import { updateTraffic } from './traffic.js';
import { makePedestrians, updatePedestrians } from './pedestrians.js';
import { updatePolice, addWanted } from './police.js';
import { updateMissions, updateSide, startMission, currentGiver, startTaxiFare, startTimeTrial } from './missions.js';
import { updateCombat } from './combat.js';
import { updateAudio, playSound } from './audio.js';

const SAVE_KEY = 'neonbay.save';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function saveGame(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.player.cash, ammo: state.player.ammo,
      missionIndex: state.missionIndex, health: state.player.health,
      x: state.player.x, y: state.player.y, clock: state.clock,
    }));
    state.saveAvailable = true;
  } catch (e) { /* storage unavailable; the game still plays */ }
}

export function newState(opts) {
  const options = opts || {};
  const seed = options.seed || 7;
  const rng = mulberry32(seed);
  const city = buildCity(seed);
  const saved = options.ignoreSave ? null : loadSave();
  const player = newPlayer(1500, 1100);
  if (saved) {
    player.cash = saved.cash ?? 480;
    player.ammo = saved.ammo ?? 24;
    player.health = saved.health ?? 100;
    player.x = saved.x ?? 1500;
    player.y = saved.y ?? 1100;
  }
  const state = {
    seed, rng, city,
    player,
    cars: makeCars(city, rng),
    peds: makePedestrians(city, rng, 46),
    cops: [],
    enemies: [],
    bullets: [],
    pickups: [
      { x: 1100, y: 1100, kind: 'health', t: 0 },
      { x: 2300, y: 1500, kind: 'health', t: 0 },
      { x: 1500, y: 700, kind: 'ammo', t: 0 },
      { x: 700, y: 1500, kind: 'ammo', t: 0 },
    ],
    packages: [
      { x: 300, y: 1100, taken: false, respawnT: 0 },
      { x: 1900, y: 700, taken: false, respawnT: 0 },
      { x: 2300, y: 1900, taken: false, respawnT: 0 },
      { x: 1100, y: 1900, taken: false, respawnT: 0 },
      { x: 2700, y: 1100, taken: false, respawnT: 0 },
    ],
    particles: [],
    skids: [],
    wanted: 0, crimeT: 99, decayT: 0,
    clock: saved?.clock ?? 8.2, elapsed: 0,
    screen: 'title', pause: false, shot: null,
    mission: null, missionIndex: saved?.missionIndex ?? 0,
    dialogue: null, toast: 'Maya Reyes · courier, new to Neon Bay', toastT: 5,
    prompt: '', side: null,
    stats: { kills: 0, stolen: 0, missionsDone: 0, fares: 0 },
    cam: { x: player.x, y: player.y },
    view: { w: 1280, h: 720 },
    saveAvailable: !!saved,
    needsSave: false, shootCd: 0,
  };
  return state;
}

export function addCrime(state, n) { addWanted(state, n); }

export function tick(state, input, dt) {
  if (state.screen !== 'play') return;
  // Pause menu.
  if (state.pause) {
    if (input.pressed('KeyP') || input.pressed('Escape')) state.pause = false;
    else if (input.pressed('KeyS')) { saveGame(state); state.toast = 'Game saved'; state.toastT = 2; }
    else if (input.pressed('KeyR')) { state.pause = false; state.screen = 'title'; }
    return;
  }
  if (input.pressed('KeyP') || input.pressed('Escape')) { state.pause = true; return; }
  if (input.pressed('KeyR')) { state.screen = 'title'; return; }

  state.elapsed += dt;
  state.clock = (8.2 + state.elapsed * 0.035) % 24;
  if (state.dialogue) { state.dialogue.t -= dt; if (state.dialogue.t <= 0) state.dialogue = null; }
  state.toastT = Math.max(0, state.toastT - dt);
  state.prompt = '';

  // Camera follows the player smoothly.
  const p = state.player;
  state.cam.x += (p.x - state.cam.x) * Math.min(1, dt * 5);
  state.cam.y += (p.y - state.cam.y) * Math.min(1, dt * 5);

  // Enter / exit cars, talk to contacts, start the time trial.
  if (input.pressed('KeyE')) {
    if (p.inCar) {
      const car = carById(state, p.carId);
      if (car) { car.driver = 'none'; }
      if (state.side && state.side.kind === 'taxi') state.side = null;
      p.inCar = false;
      p.carId = -1;
      p.x = p.x + 46; p.y = p.y + 10;
      p.health = Math.max(1, p.health);
      state.toast = 'Back on foot';
      state.toastT = 2;
    } else {
      const giver = currentGiver(state);
      if (giver && Math.hypot(giver.giverAt.x - p.x, giver.giverAt.y - p.y) < 90) {
        startMission(state);
      } else if (!state.side && Math.hypot(2700 - p.x, 1900 - p.y) < 90) {
        startTimeTrial(state);
      } else {
        const car = nearestCarToPlayer(state, 78);
        if (car) {
          const wasTraffic = car.driver === 'traffic';
          const wasTaxi = car.kind === 'taxi';
          car.driver = 'player';
          car.parked = false;
          car.ai = null;
          p.inCar = true;
          p.carId = car.id;
          if (wasTraffic) {
            addWanted(state, 1);
            state.stats.stolen++;
            state.toast = 'Vehicle reported stolen';
            state.toastT = 3;
            playSound('horn');
          } else if (wasTaxi) {
            startTaxiFare(state);
          } else {
            state.toast = 'You took the car';
            state.toastT = 2;
          }
        }
      }
    }
  }

  // Movement.
  if (p.inCar) updatePlayerCar(state, input, dt);
  else updatePlayerOnFoot(state, input, dt);

  updateTraffic(state, dt);
  updatePedestrians(state, dt);
  updatePolice(state, dt);
  updateMissions(state, dt);
  updateSide(state, dt);
  updateCombat(state, input, dt);
  updateAudio(state, dt);

  // Interaction prompt for the nearest thing worth pressing E on.
  if (!p.inCar) {
    const giver = currentGiver(state);
    if (giver && Math.hypot(giver.giverAt.x - p.x, giver.giverAt.y - p.y) < 90) {
      state.prompt = 'E — Talk to ' + giver.giver + ' · ' + giver.name;
    } else if (!state.side && Math.hypot(2700 - p.x, 1900 - p.y) < 90) {
      state.prompt = 'E — Start the dawn time trial';
    } else {
      const car = nearestCarToPlayer(state, 78);
      if (car) state.prompt = 'E — Enter ' + (car.kind === 'taxi' ? 'Taxi' : car.kind === 'police' ? 'Police cruiser' : 'car');
    }
  } else {
    state.prompt = 'E — Exit car';
  }

  // Particles and skid marks age out.
  for (const pt of state.particles) {
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
  for (const s of state.skids) s.life -= dt;
  state.skids = state.skids.filter((s) => s.life > 0);

  if (state.needsSave) { state.needsSave = false; saveGame(state); }
}
