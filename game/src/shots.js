// shots.js — deterministic staged scenes for screenshots: the game is put
// in a fixed state (same seed every time) and the browser captures it.
import { newState } from './world.js';
import { makeCar } from './cars.js';
import { spawnEnemy } from './combat.js';

function putPlayerInCar(state, type, x, y, angle, speed) {
  const car = state.cars.find((c) => c.type === type && c.parked && c.kind === 'civilian');
  if (!car) return null;
  car.x = x; car.y = y; car.a = angle; car.v = speed;
  car.driver = 'player'; car.parked = false; car.ai = null;
  state.player.inCar = true;
  state.player.carId = car.id;
  state.player.x = x; state.player.y = y; state.player.a = angle;
  state.cam.x = x; state.cam.y = y;
  return car;
}

function addPoliceChase(state, count, distance) {
  const p = state.player;
  for (let i = 0; i < count; i++) {
    const ang = Math.PI + (i - 1) * 0.5;
    const x = p.x + Math.cos(ang) * distance - 120 * i;
    const y = p.y + Math.sin(ang) * (distance * 0.55) + (i % 2 ? 60 : -60);
    const car = makeCar(x, y, Math.atan2(p.y - y, p.x - x), 1, 'police', 'police');
    car.v = 200;
    state.cars.push(car);
    state.cops.push({ x, y, a: car.a, v: 200, onFoot: false, carId: car.id, arrestT: 0, health: 100 });
  }
}

function stageMission(state, name, giver, goal, reward) {
  state.mission = {
    idx: 1, name, giver, reward, stage: 0, goal,
    target: { x: 1500, y: 1500, label: 'Sunset Plaza' },
    timer: 0, kills: 0, collected: 0, enemiesTotal: 3,
    checkpoints: null, cpIndex: 0, crates: [], enemiesSpawned: true,
  };
}

export function stageShot(name) {
  const s = newState({ ignoreSave: true, seed: 7 });
  s.shot = name;
  s.screen = name === 'start' ? 'title' : 'play';
  s.elapsed = 286; // lands the clock at golden hour (about 18:12)
  s.toastT = 0;
  s.toast = '';
  s.saveAvailable = false;

  if (name === 'chase') {
    s.player.x = 1500; s.player.y = 1100;
    const getaway = putPlayerInCar(s, 2, 1500, 1100, 0.1, 200);
    if (getaway) getaway.color = '#e45f4d'; // red getaway car, distinct from police white
    s.wanted = 4;
    s.player.cash = 1750;
    s.player.ammo = 18;
    addPoliceChase(s, 3, 420);
    // A delivery job in progress: far target, so it cannot complete while settling.
    s.mission = {
      idx: 0, name: 'First Delivery', giver: 'Luz Ortega', reward: 400, stage: 1,
      goal: 'Deliver the case to the Coral Hotel',
      target: { x: 2700, y: 300, label: 'Coral Hotel' },
      timer: 0, kills: 0, collected: 0, enemiesTotal: 0,
      checkpoints: null, cpIndex: 0, crates: [], enemiesSpawned: false,
    };
    s.dialogue = { speaker: 'Luz Ortega', text: 'Lose them, Maya — the case has to reach the Coral Hotel.', t: 9 };
    // Traffic ahead and skid marks behind the getaway car.
    const t1 = s.cars.find((c) => c.driver === 'traffic');
    if (t1) { t1.x = 1850; t1.y = 1100; t1.a = 0; t1.v = 90; }
    const t2 = s.cars.find((c) => c.driver === 'traffic' && c !== t1);
    if (t2) { t2.x = 2100; t2.y = 1150; t2.a = 0; t2.v = 70; }
    for (let i = 0; i < 6; i++) {
      s.skids.push({ x: 1500 - i * 40, y: 1100 + (i % 2 ? 14 : -14), a: 0.1, life: 3 });
    }
  }

  if (name === 'drive') {
    s.player.x = 1100; s.player.y = 1100;
    putPlayerInCar(s, 1, 1100, 1100, 0, 210);
    s.wanted = 1;
    s.player.cash = 940;
    addPoliceChase(s, 1, 380);
    s.mission = {
      idx: 0, name: 'First Delivery', giver: 'Luz Ortega', reward: 400, stage: 1,
      goal: 'Deliver the case to the Coral Hotel',
      target: { x: 2700, y: 300, label: 'Coral Hotel' },
      timer: 0, kills: 0, collected: 0, enemiesTotal: 0,
      checkpoints: null, cpIndex: 0, crates: [], enemiesSpawned: false,
    };
    const cars = s.cars.filter((c) => c.driver === 'traffic');
    const spots = [[1450, 1100], [1700, 1150], [1950, 1100], [1350, 1050]];
    cars.slice(0, 4).forEach((c, i) => {
      c.x = spots[i][0]; c.y = spots[i][1]; c.a = 0; c.v = 80 + i * 10;
      if (c.ai) { c.ai.axis = 'h'; c.ai.line = 1100; c.ai.dir = 1; c.ai.lane = 18; }
    });
  }

  if (name === 'mission') {
    s.player.x = 1500; s.player.y = 1380; s.player.a = Math.PI / 2;
    s.player.aim = Math.PI / 2;
    s.cam.x = 1500; s.cam.y = 1450;
    s.wanted = 0;
    s.player.cash = 1120;
    stageMission(s, 'The Shakedown', 'Nico Vale', 'Defeat Marlow’s thugs in Sunset Plaza · 0/3', 650);
    spawnEnemy(s, 1560, 1480, false);
    spawnEnemy(s, 1440, 1520, false);
    spawnEnemy(s, 1530, 1570, false);
    s.dialogue = { speaker: 'Nico Vale', text: 'Three of Marlow’s thugs, right there in the plaza. Send them home, Maya.', t: 9 };
    s.pickups.push({ x: 1420, y: 1400, kind: 'health', t: 0 });
  }

  return s;
}
