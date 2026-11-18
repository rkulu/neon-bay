// missions.js — Maya Reyes's story: five jobs from courier Luz Ortega and
// fixer Nico Vale, plus the side work that pays between jobs: taxi fares,
// street packages and a dawn time trial.
import { playSound } from './audio.js';
import { spawnEnemy, spawnPickup } from './combat.js';
import { addWanted } from './police.js';
import { nearestRoadPoint } from './city.js';

export const MISSION_DEFS = [
  {
    name: 'First Delivery', giver: 'Luz Ortega', reward: 400,
    giverAt: { x: 700, y: 700 },
    intro: 'Luz: A sealed case for the old hotel. Pick it up at the marina, then bring it to the Coral Hotel. No detours.',
    stages: [
      { goal: 'Pick up the sealed case at the marina', target: { x: 700, y: 700, label: 'Marina pickup' } },
      { goal: 'Deliver the case to the Coral Hotel', target: { x: 2700, y: 300, label: 'Coral Hotel' } },
    ],
  },
  {
    name: 'The Shakedown', giver: 'Nico Vale', reward: 650,
    giverAt: { x: 1500, y: 1500 },
    intro: 'Nico: Three of Marlow’s thugs are leaning on my shops in Sunset Plaza. Send them home. Fists or pistol — your call.',
    stages: [
      { goal: 'Defeat Marlow’s thugs in Sunset Plaza · 0/3', target: { x: 1500, y: 1500, label: 'Sunset Plaza' }, enemies: 3 },
    ],
  },
  {
    name: 'Wheels Up', giver: 'Luz Ortega', reward: 900,
    giverAt: { x: 1100, y: 300 },
    intro: 'Luz: A client wants a sport car, no questions. Steal one and bring it to the garage on the east strip. The police will notice.',
    stages: [
      { goal: 'Steal a sport car and bring it to the garage', target: { x: 2700, y: 700, label: 'Garage' }, needSport: true },
    ],
  },
  {
    name: 'Harbor Heist', giver: 'Nico Vale', reward: 1200,
    giverAt: { x: 700, y: 1900 },
    intro: 'Nico: Marlow’s crew stashed three crates on the docks. Grab them all — the guards are armed, so come ready.',
    stages: [
      { goal: 'Collect the crates on the docks · 0/3', target: { x: 700, y: 2100, label: 'Old Harbor docks' }, crates: 3, enemies: 4 },
    ],
  },
  {
    name: 'The Last Run', giver: 'Luz Ortega', reward: 2000,
    giverAt: { x: 2700, y: 1900 },
    intro: 'Luz: One last run, Maya. Five checkpoints, ninety seconds, the whole city watching. Drive like the bay is on fire.',
    stages: [
      { goal: 'Hit all 5 checkpoints before time runs out', target: { x: 2700, y: 1900, label: 'Start line' }, race: true, timeLimit: 90 },
    ],
  },
];

const RACE_POINTS = [
  { x: 2700, y: 1900 }, { x: 700, y: 1900 }, { x: 700, y: 300 },
  { x: 2300, y: 300 }, { x: 2700, y: 1500 },
];

export function currentGiver(state) {
  if (state.mission) return null;
  if (state.missionIndex >= MISSION_DEFS.length) return null;
  return MISSION_DEFS[state.missionIndex];
}

export function missionTarget(state) {
  if (state.mission) return state.mission.target;
  const giver = currentGiver(state);
  return giver ? { x: giver.giverAt.x, y: giver.giverAt.y, label: giver.giver } : null;
}

export function startMission(state) {
  const def = MISSION_DEFS[state.missionIndex];
  if (!def) return;
  const stage = def.stages[0];
  state.mission = {
    idx: state.missionIndex, name: def.name, giver: def.giver, reward: def.reward,
    stage: 0, goal: stage.goal, target: stage.target,
    timer: stage.timeLimit || 0, kills: 0, collected: 0, enemiesTotal: stage.enemies || 0,
    checkpoints: stage.race ? RACE_POINTS.map((p) => ({ ...p })) : null,
    cpIndex: 0, crates: [], enemiesSpawned: false,
  };
  state.dialogue = { speaker: def.giver, text: def.intro, t: 7 };
  playSound('mission');
  if (stage.enemies) {
    const cx = stage.target.x, cy = stage.target.y;
    for (let i = 0; i < stage.enemies; i++) {
      spawnEnemy(state, cx + (i - 1) * 70, cy + (i % 2 ? -60 : 60), def.name === 'Harbor Heist');
    }
    state.mission.enemiesSpawned = true;
  }
  if (stage.crates) {
    for (let i = 0; i < stage.crates; i++) {
      const cx = 500 + i * 160, cy = 2100 + (i % 2) * 80;
      state.mission.crates.push({ x: cx, y: cy, taken: false });
    }
  }
  if (stage.race) {
    state.mission.target = { x: RACE_POINTS[0].x, y: RACE_POINTS[0].y, label: 'Checkpoint 1/5' };
    state.toast = 'Race started — 90 seconds, 5 checkpoints';
    state.toastT = 3;
  }
}

function advanceStage(state) {
  const def = MISSION_DEFS[state.mission.idx];
  const m = state.mission;
  m.stage++;
  if (m.stage >= def.stages.length) { completeMission(state); return; }
  const stage = def.stages[m.stage];
  m.goal = stage.goal;
  m.target = stage.target;
  m.timer = stage.timeLimit || 0;
  m.kills = 0; m.collected = 0;
  playSound('mission');
}

function completeMission(state) {
  const m = state.mission;
  state.player.cash += m.reward;
  state.stats.missionsDone++;
  state.missionIndex++;
  state.mission = null;
  state.toast = `JOB COMPLETE · +$${m.reward}`;
  state.toastT = 4;
  state.dialogue = { speaker: m.giver, text: m.name === 'The Last Run'
    ? 'Luz: You did it, Maya. Neon Bay is yours now — every street, every sunrise.'
    : 'Job done. The next one is already waiting.', t: 5 };
  playSound('cash');
  state.enemies = [];
  // world.tick picks this up and autosaves after the job.
  state.needsSave = true;
}

function failMission(state, reason) {
  state.mission = null;
  state.toast = reason;
  state.toastT = 4;
  state.enemies = [];
  playSound('fail');
}

export function updateMissions(state, dt) {
  const p = state.player;
  const m = state.mission;
  if (!m) return;
  const def = MISSION_DEFS[m.idx];
  const stage = def.stages[m.stage];
  // Timed stages.
  if (stage.timeLimit) {
    m.timer -= dt;
    if (m.timer <= 0) { failMission(state, 'Out of time — the job fell through'); return; }
  }
  if (stage.enemies) {
    const alive = state.enemies.length;
    const want = stage.enemies;
    // Count thugs defeated by comparing spawned count to remaining.
    const defeated = (m.enemiesTotal || want) - alive;
    m.kills = Math.max(0, defeated);
    m.goal = stage.goal.replace(/· \d+\/\d+/, `· ${Math.min(want, m.kills)}/${want}`);
    if (m.kills >= want) { advanceStage(state); return; }
  }
  if (stage.crates) {
    for (const crate of m.crates) {
      if (!crate.taken && !p.inCar && Math.hypot(crate.x - p.x, crate.y - p.y) < 40) {
        crate.taken = true;
        m.collected++;
        playSound('pickup');
        state.toast = `Crate ${m.collected}/3 secured`;
        state.toastT = 2;
      }
    }
    m.goal = stage.goal.replace(/· \d+\/\d+/, `· ${m.collected}/3`);
    if (m.collected >= 3) { advanceStage(state); return; }
  }
  if (stage.race && m.checkpoints) {
    const cp = m.checkpoints[m.cpIndex];
    if (cp && Math.hypot(cp.x - p.x, cp.y - p.y) < 90) {
      m.cpIndex++;
      playSound('pickup');
      if (m.cpIndex >= m.checkpoints.length) { advanceStage(state); return; }
      const next = m.checkpoints[m.cpIndex];
      m.target = { x: next.x, y: next.y, label: `Checkpoint ${m.cpIndex + 1}/5` };
      m.goal = `Hit all 5 checkpoints before time runs out · ${m.cpIndex}/5`;
    }
  }
  if (stage.needSport) {
    const car = p.inCar ? state.cars.find((c) => c.id === p.carId) : null;
    if (car && car.type === 2 && Math.hypot(car.x - m.target.x, car.y - m.target.y) < 110) {
      advanceStage(state); return;
    }
  }
  // Plain go-to stages: reach the target marker.
  if (!stage.enemies && !stage.crates && !stage.race && !stage.needSport) {
    if (Math.hypot(p.x - m.target.x, p.y - m.target.y) < 90) { advanceStage(state); return; }
  }
}

// --- Side work -------------------------------------------------------------

export function updateSide(state, dt) {
  const p = state.player;
  const s = state.side;
  if (!s) return;
  s.timer += dt;
  if (s.kind === 'taxi') {
    if (s.stage === 'pickup' && Math.hypot(p.x - s.target.x, p.y - s.target.y) < 80) {
      s.stage = 'dropoff';
      const dest = nearestRoadPoint(state.rng);
      s.target = { x: dest.x, y: dest.y, label: 'Fare destination' };
      s.fare = 80 + Math.floor(Math.random() * 80);
      state.toast = 'Passenger aboard — take them to the marker';
      state.toastT = 3;
    } else if (s.stage === 'dropoff' && Math.hypot(p.x - s.target.x, p.y - s.target.y) < 80) {
      p.cash += s.fare;
      state.stats.fares++;
      state.toast = `Fare complete · +$${s.fare}`;
      state.toastT = 3;
      playSound('cash');
      state.side = null;
    }
    if (s.timer > 120) { state.side = null; state.toast = 'The passenger gave up and left'; state.toastT = 3; }
  }
  if (s.kind === 'race') {
    const cp = s.checkpoints[s.cpIndex];
    if (cp && Math.hypot(cp.x - p.x, cp.y - p.y) < 90) {
      s.cpIndex++;
      playSound('pickup');
      if (s.cpIndex >= s.checkpoints.length) {
        p.cash += 500;
        state.toast = 'Time trial complete · +$500';
        state.toastT = 3;
        playSound('cash');
        state.side = null;
        return;
      }
      const next = s.checkpoints[s.cpIndex];
      s.target = { x: next.x, y: next.y, label: `Gate ${s.cpIndex + 1}/4` };
    }
    if (s.timer > 75) {
      state.side = null;
      state.toast = 'Time trial failed — try again at the flag';
      state.toastT = 3;
      playSound('fail');
    }
  }
}

export function startTaxiFare(state) {
  const spot = nearestRoadPoint(state.rng);
  state.side = { kind: 'taxi', stage: 'pickup', target: { x: spot.x, y: spot.y, label: 'Passenger' }, timer: 0, fare: 0 };
  state.toast = 'Taxi fare — pick up the passenger at the marker';
  state.toastT = 3;
}

export function startTimeTrial(state) {
  state.side = {
    kind: 'race', timer: 0, cpIndex: 0,
    checkpoints: [
      { x: 2700, y: 300 }, { x: 300, y: 1500 }, { x: 1500, y: 1900 }, { x: 2700, y: 1900 },
    ],
    target: { x: 2700, y: 300, label: 'Gate 1/4' },
  };
  state.toast = 'Time trial — 4 gates, 75 seconds';
  state.toastT = 3;
}

export function sideTarget(state) {
  return state.side ? state.side.target : null;
}

export function objectiveText(state) {
  if (state.mission) {
    const m = state.mission;
    let goal = m.goal;
    if (m.timer > 0) goal += ` · ${Math.ceil(m.timer)}s`;
    return { title: m.name, goal, giver: m.giver, reward: m.reward };
  }
  if (state.side) {
    if (state.side.kind === 'taxi') {
      return { title: 'Taxi fare', goal: state.side.stage === 'pickup' ? 'Pick up the passenger' : 'Drop the passenger at the marker', giver: 'Neon Cab Co.', reward: state.side.fare || 120 };
    }
    return { title: 'Time trial', goal: `Reach gate ${state.side.cpIndex + 1}/4 · ${Math.max(0, Math.ceil(75 - state.side.timer))}s left`, giver: 'Street League', reward: 500 };
  }
  const giver = currentGiver(state);
  if (giver) return { title: giver.name, goal: `Meet ${giver.giver} at the gold marker`, giver: giver.giver, reward: giver.reward };
  return { title: 'Free roam', goal: 'Neon Bay is yours — drive, explore, take side jobs', giver: '', reward: 0 };
}
