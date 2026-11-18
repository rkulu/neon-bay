// audio.js — every sound in Neon Bay is synthesized live with WebAudio.
// No audio files, no network: oscillators, filtered noise and a small
// step-sequencer bass line make up the whole soundscape.
let ctx = null;
let master = null;
let musicGain = null;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let musicTimer = 0;
let musicStep = 0;
let unlocked = false;

const BASS_LINE = [55, 0, 55, 65.41, 0, 55, 49, 58.27, 55, 0, 55, 65.41, 73.42, 0, 65.41, 49];

export function unlockAudio() {
  if (unlocked) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.12;
    musicGain.connect(master);
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    const sirenLfo = ctx.createOscillator();
    sirenLfo.frequency.value = 0.6;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 260;
    sirenLfo.connect(lfoGain);
    lfoGain.connect(sirenOsc.frequency);
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    sirenLfo.start();
    if (ctx.state === 'suspended') ctx.resume();
    unlocked = true;
  } catch (e) { /* audio stays off; the game plays silently */ }
}

function noiseBuffer(duration) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function blip(freq, dur, type, vol, slideTo) {
  if (!ctx) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + dur);
  } catch (e) { /* ignore */ }
}

function noiseHit(dur, vol, filterFreq) {
  if (!ctx) return;
  try {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  } catch (e) { /* ignore */ }
}

export function playSound(name) {
  if (!ctx) return;
  switch (name) {
    case 'gun': noiseHit(0.12, 0.5, 2600); blip(180, 0.09, 'square', 0.22, 60); break;
    case 'punch': noiseHit(0.08, 0.4, 500); blip(120, 0.08, 'sine', 0.3, 55); break;
    case 'pickup': blip(660, 0.09, 'sine', 0.25); setTimeout(() => blip(990, 0.12, 'sine', 0.25), 70); break;
    case 'cash': blip(880, 0.08, 'sine', 0.22); setTimeout(() => blip(1174, 0.1, 'sine', 0.22), 80); setTimeout(() => blip(1568, 0.16, 'sine', 0.22), 160); break;
    case 'crash': noiseHit(0.3, 0.55, 700); break;
    case 'horn': blip(370, 0.18, 'square', 0.12, 370); break;
    case 'mission': [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.14, 'sine', 0.25), i * 90)); break;
    case 'fail': blip(220, 0.3, 'sawtooth', 0.2, 110); break;
    case 'busted': blip(440, 0.2, 'square', 0.2, 330); setTimeout(() => blip(330, 0.35, 'square', 0.2, 220), 180); break;
    default: break;
  }
}

// Called every frame: engine hum follows speed, siren follows wanted level,
// and the bass sequencer keeps a quiet groove going.
export function updateAudio(state, dt) {
  if (!ctx) return;
  try {
    const car = state.player.inCar ? state.cars.find((c) => c.id === state.player.carId) : null;
    const speed = car ? Math.abs(car.v || 0) : 0;
    if (engineGain) engineGain.gain.value = car ? 0.02 + Math.min(0.06, speed / 4000) : 0;
    if (engineOsc) engineOsc.frequency.value = 50 + speed * 0.45;
    if (sirenGain) sirenGain.gain.value = state.wanted > 0 && state.screen === 'play' ? 0.028 : 0;
    musicTimer += dt;
    if (musicTimer >= 0.24) {
      musicTimer = 0;
      const note = BASS_LINE[musicStep % BASS_LINE.length];
      musicStep++;
      if (note > 0) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = note;
        g.gain.setValueAtTime(0.5, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        o.connect(g); g.connect(musicGain);
        o.start(); o.stop(ctx.currentTime + 0.24);
      }
      if (musicStep % 4 === 0) {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer(0.03);
        const f = ctx.createBiquadFilter();
        f.type = 'highpass'; f.frequency.value = 6000;
        const g = ctx.createGain();
        g.gain.value = 0.12;
        src.connect(f); f.connect(g); g.connect(musicGain);
        src.start();
      }
    }
  } catch (e) { /* ignore */ }
}
