'use strict';
// ---------------------------------------------------------------------------
// Sound: all music, ambience and effects are synthesised with the Web Audio
// API — no audio files. (Named Sound, not Audio, to avoid the browser global.)
// ---------------------------------------------------------------------------

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

const SCALES = {
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
};

// Each mood: tempo, key (MIDI), steps per bar (eighth notes), chord loop
// ([offset from key, 'm'|'M']), scale, arpeggio pattern, drum pattern and
// melody density. La Folía, the Andalusian cadence and the Phrygian colour
// are all period-appropriate Iberian material.
const MOODS = {
  title: { bpm: 66, key: 50, steps: 6, scale: 'harmonic', melody: 0.45, lead: 'recorder',
    chords: [[0, 'm'], [7, 'M'], [0, 'm'], [-2, 'M'], [3, 'M'], [-2, 'M'], [0, 'm'], [7, 'M']],
    arp: [0, 2, 1, 2, 1, 2], drums: 'd.....' },
  sea: { bpm: 76, key: 45, steps: 6, scale: 'aeolian', melody: 0.3, lead: 'recorder',
    chords: [[0, 'm'], [-2, 'M'], [-4, 'M'], [-2, 'M']],
    arp: [0, 1, 2, 3, 2, 1], drums: 'd..t..' },
  land: { bpm: 100, key: 50, steps: 8, scale: 'mixolydian', melody: 0.5, lead: 'recorder', strum: true,
    chords: [[0, 'M'], [5, 'M'], [0, 'M'], [7, 'M'], [-2, 'M'], [5, 'M'], [0, 'M'], [7, 'M']],
    arp: [-1, 2, 1, 2, -1, 2, 1, 2], drums: 'D.t.d.t.' },
  battle: { bpm: 138, key: 45, steps: 8, scale: 'harmonic', melody: 0.35, lead: 'brass', ostinato: true,
    chords: [[0, 'm'], [-2, 'M'], [-4, 'M'], [-5, 'M']],
    arp: [0, -1, 1, -1, 2, -1, 1, -1], drums: 'BdDdBdDT' },
  town: { bpm: 84, key: 50, steps: 6, scale: 'harmonic', melody: 0.55, lead: 'recorder',
    chords: [[0, 'm'], [7, 'M'], [0, 'm'], [-2, 'M'], [3, 'M'], [-2, 'M'], [0, 'm'], [7, 'M']],
    arp: [0, 2, 1, 2, 1, 2], drums: 'D.t.t.' },
};

const Sound = {
  ctx: null, ready: false,
  settings: { music: 0.55, sfx: 0.8, amb: 0.5, muted: false },
  mood: null, targetMood: 'title', switching: false,
  step: 0, bar: 0, melDeg: 7, melBusy: 0,
  cache: {}, last: {},

  // ------------------------------------------------------------ setup
  loadSettings() {
    try { const v = JSON.parse(localStorage.getItem('conquista-audio')); if (v) Object.assign(this.settings, v); } catch (e) { /* storage unavailable */ }
  },
  saveSettings() {
    try { localStorage.setItem('conquista-audio', JSON.stringify(this.settings)); } catch (e) { /* storage unavailable */ }
  },

  // must be called from a user gesture: browsers block audio until then
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    const c = this.ctx;
    this.loadSettings();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.25;
    this.master = c.createGain();
    this.master.connect(comp); comp.connect(c.destination);
    this.reverb = c.createConvolver(); this.reverb.buffer = this.impulse(2.6);
    this.reverb.connect(this.master);
    this.bus = {};
    for (const [k, send] of [['music', 0.45], ['sfx', 0.25], ['amb', 0.1]]) {
      const g = c.createGain(); g.connect(this.master);
      const s = c.createGain(); s.gain.value = send; g.connect(s); s.connect(this.reverb);
      this.bus[k] = g;
    }
    this.fader = c.createGain(); this.fader.gain.value = 0; this.fader.connect(this.bus.music);
    this.white = this.noiseBuffer(2, false);
    this.brown = this.noiseBuffer(4, true);
    this.buildAmbience();
    this.applySettings();
    this.ready = true;
    this.nextTime = c.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 30);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend(); else this.ctx.resume();
    });
  },
  applySettings() {
    if (!this.ctx) return;
    const s = this.settings, t = this.ctx.currentTime;
    const set = (g, v) => g.gain.setTargetAtTime(s.muted ? 0 : v, t, 0.05);
    set(this.bus.music, s.music * 0.7);
    set(this.bus.sfx, s.sfx);
    set(this.bus.amb, s.amb * 0.8);
  },
  setSetting(k, v) { this.settings[k] = v; this.applySettings(); this.saveSettings(); },

  noiseBuffer(sec, brown) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  },
  impulse(sec) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2);
    }
    return b;
  },

  // ------------------------------------------------------------ building blocks
  gain(v, dest) { const g = this.ctx.createGain(); g.gain.value = v; g.connect(dest); return g; },
  env(g, t, a, peak, d, sustain = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + d);
  },
  osc(type, f, t, dur, dest) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    o.connect(dest); o.start(t); o.stop(t + dur + 0.05); return o;
  },
  noise(t, dur, dest, brown) {
    const s = this.ctx.createBufferSource(); s.buffer = brown ? this.brown : this.white;
    s.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); return s;
  },
  filter(type, f, q, dest) {
    const fl = this.ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; if (q) fl.Q.value = q; fl.connect(dest); return fl;
  },

  // Karplus-Strong plucked string: sounds like a guitar or vihuela
  pluckBuf(midi, bright) {
    const key = midi + (bright ? 'b' : 'd');
    if (this.cache[key]) return this.cache[key];
    const c = this.ctx, sr = c.sampleRate, f = mtof(midi);
    const len = Math.floor(sr * (midi < 48 ? 2.4 : 1.7));
    const b = c.createBuffer(1, len, sr), d = b.getChannelData(0);
    const N = Math.max(2, Math.round(sr / f));
    let prev = 0;
    for (let i = 0; i < N; i++) { const w = Math.random() * 2 - 1; prev = bright ? w : prev * 0.5 + w * 0.5; d[i] = prev; }
    const decay = midi < 48 ? 0.998 : 0.996;
    for (let i = N; i < len; i++) d[i] = decay * 0.5 * (d[i - N] + d[i - N - 1 >= 0 ? i - N - 1 : 0]);
    return (this.cache[key] = b);
  },
  pluck(midi, t, vol, dest, bright = true) {
    const s = this.ctx.createBufferSource(); s.buffer = this.pluckBuf(midi, bright);
    const g = this.gain(vol, dest);
    const lp = this.filter('lowpass', bright ? 4200 : 1800, 0.7, g);
    s.connect(lp); s.start(t);
  },
  recorder(midi, t, dur, vol, dest) {
    const c = this.ctx, f = mtof(midi);
    const g = this.gain(0, dest);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.05);
    g.gain.setValueAtTime(vol, t + Math.max(0.06, dur - 0.08));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const lp = this.filter('lowpass', f * 4, 0.5, g);
    const o = this.osc('sine', f, t, dur, lp);
    const o2 = this.osc('triangle', f * 2, t, dur, this.gain(0.12, lp));
    const lfo = c.createOscillator(); lfo.frequency.value = 5.2;
    const lg = c.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.3, dur));
    lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    lfo.start(t); lfo.stop(t + dur + 0.05);
    const breath = this.gain(vol * 0.15, g);
    this.noise(t, dur, this.filter('bandpass', f * 2, 3, breath));
  },
  brass(midi, t, dur, vol, dest) {
    const f = mtof(midi);
    const g = this.gain(0, dest);
    this.env(g, t, 0.03, vol, dur, vol * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2; lp.connect(g);
    lp.frequency.setValueAtTime(500, t); lp.frequency.exponentialRampToValueAtTime(2600, t + 0.06); lp.frequency.exponentialRampToValueAtTime(900, t + dur);
    this.osc('sawtooth', f, t, dur + 0.15, lp);
    this.osc('sawtooth', f * 1.006, t, dur + 0.15, lp);
  },
  drum(t, vol, dest, low = 1) {
    const g = this.gain(0, dest);
    this.env(g, t, 0.004, vol, 0.35 * low);
    const o = this.osc('sine', 150 / low, t, 0.5 * low, g);
    o.frequency.exponentialRampToValueAtTime(52 / low, t + 0.25 * low);
    const ng = this.gain(0, dest); this.env(ng, t, 0.002, vol * 0.4, 0.05);
    this.noise(t, 0.08, this.filter('lowpass', 900, 0, ng));
  },
  jingle(t, vol, dest) {
    const g = this.gain(0, dest); this.env(g, t, 0.003, vol, 0.14);
    this.noise(t, 0.2, this.filter('highpass', 6500, 0, g));
  },

  // ------------------------------------------------------------ music
  setMood(m) { if (MOODS[m]) this.targetMood = m; },
  schedule() {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const now = c.currentTime;
    if (this.targetMood !== this.mood && !this.switching) {
      this.switching = true;
      const fade = this.targetMood === 'battle' ? 0.35 : 1.4;
      this.fader.gain.cancelScheduledValues(now);
      this.fader.gain.setValueAtTime(this.fader.gain.value, now);
      this.fader.gain.linearRampToValueAtTime(0.0001, now + fade);
      this.switchAt = now + fade;
    }
    if (this.switching) {
      if (now < this.switchAt) return;
      this.mood = this.targetMood; this.switching = false;
      this.step = 0; this.bar = 0; this.melBusy = 0; this.melDeg = 7;
      this.nextTime = now + 0.05;
      this.fader.gain.cancelScheduledValues(now);
      this.fader.gain.setValueAtTime(0.0001, now);
      this.fader.gain.linearRampToValueAtTime(1, now + (this.mood === 'battle' ? 0.3 : 2));
    }
    if (!this.mood) return;
    const M = MOODS[this.mood], sd = 60 / M.bpm / 2;
    if (this.nextTime < now - 0.2) this.nextTime = now + 0.05;
    while (this.nextTime < now + 0.15) {
      this.playStep(M, this.step, this.nextTime, sd);
      this.nextTime += sd;
      if (++this.step >= M.steps) { this.step = 0; this.bar++; }
    }
  },
  playStep(M, step, t, sd) {
    const out = this.fader;
    const [off, q] = M.chords[this.bar % M.chords.length];
    const root = M.key + off;
    const tones = [0, q === 'm' ? 3 : 4, 7, 12].map((x) => root + x + 12);
    const phraseEnd = this.bar % 4 === 3;
    // bass
    if (step === 0) this.pluck(root - (root > 48 ? 12 : 0), t, 0.42, out, false);
    if (M.ostinato && step % 2 === 0) this.pluck(root + (step % 4 ? 7 : 0), t, 0.3, out, false);
    // strummed chord or arpeggio
    if (M.strum && (step === 0 || step === 4)) tones.slice(0, 3).forEach((m, i) => this.pluck(m, t + i * 0.018, 0.16, out));
    const a = M.arp[step];
    if (a >= 0) this.pluck(tones[a], t, step === 0 ? 0.24 : 0.17, out);
    // drums
    const d = M.drums[step];
    if (d === 'D') this.drum(t, 0.5, out);
    else if (d === 'd') this.drum(t, 0.22, out);
    else if (d === 'B') this.drum(t, 0.75, out, 1.6);
    else if (d === 't' || d === 'T') this.jingle(t, d === 'T' ? 0.12 : 0.06, out);
    // brass stabs in battle
    if (this.mood === 'battle' && step === 0 && this.bar % 2 === 0) tones.slice(0, 3).forEach((m) => this.brass(m, t, sd * 1.5, 0.05, out));
    // melody: a random walk through the mode, landing on chord tones on strong beats
    if (this.melBusy > 0) { this.melBusy--; return; }
    const strong = step === 0 || step === M.steps / 2;
    let p = M.melody * (strong ? 1.5 : 0.8);
    if (phraseEnd && step > M.steps / 2) p = 0;
    if (Math.random() > p) return;
    const sc = SCALES[M.scale];
    this.melDeg = clamp(this.melDeg + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)], 4, 13);
    const toMidi = (deg) => M.key + 12 + sc[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7);
    let m = toMidi(this.melDeg);
    if (strong || (phraseEnd && step === 0)) {
      // snap to the nearest chord tone
      const pcs = tones.map((x) => x % 12);
      for (let k = 0; k < 3 && !pcs.includes(((m % 12) + 12) % 12); k++) { this.melDeg += 1; m = toMidi(this.melDeg); }
    }
    const len = phraseEnd && step === 0 ? M.steps : 1 + Math.floor(Math.random() * (M.lead === 'brass' ? 2 : 3));
    this.melBusy = len - 1;
    if (M.lead === 'brass') this.brass(m, t, sd * len * 0.9, 0.07, out);
    else this.recorder(m, t, sd * len * 0.95, 0.11, out);
  },

  // ------------------------------------------------------------ ambience
  buildAmbience() {
    const c = this.ctx, out = this.bus.amb;
    const loop = (buf) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
    const lfo = (f, depth, target) => { const o = c.createOscillator(); o.frequency.value = f; const g = c.createGain(); g.gain.value = depth; o.connect(g); g.connect(target); o.start(); };
    // waves: brown noise with a slow swell
    this.ambSea = this.gain(0, out);
    const swell = this.gain(0.6, this.ambSea);
    lfo(0.11, 0.4, swell.gain);
    loop(this.brown).connect(this.filter('lowpass', 650, 0.4, swell));
    // wind: band-passed noise with a wandering centre
    this.ambWind = this.gain(0, out);
    const bp = this.filter('bandpass', 520, 0.9, this.ambWind);
    lfo(0.07, 260, bp.frequency);
    loop(this.white).connect(bp);
    // insects: a high buzz with a fast tremolo
    this.ambJungle = this.gain(0, out);
    const trem = this.gain(0.5, this.ambJungle);
    lfo(27, 0.45, trem.gain);
    loop(this.white).connect(this.filter('bandpass', 5200, 7, trem));
  },
  setAmbience(sea, wind, jungle) {
    const t = this.ctx.currentTime;
    this.ambSea.gain.setTargetAtTime(sea * 0.5, t, 0.8);
    this.ambWind.gain.setTargetAtTime(wind * 0.35, t, 0.8);
    this.ambJungle.gain.setTargetAtTime(jungle * 0.05, t, 0.8);
    this.jungleLevel = jungle; this.gullLevel = sea > 0.5 && wind < 0.6 ? 0.4 : 0;
  },
  chirp(t) {
    const g = this.gain(0, this.bus.amb);
    const f = 2200 + Math.random() * 2200, n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const tt = t + i * (0.07 + Math.random() * 0.05);
      const gg = this.gain(0, g); this.env(gg, tt, 0.005, 0.08, 0.06);
      const o = this.osc('sine', f, tt, 0.08, gg);
      o.frequency.exponentialRampToValueAtTime(f * (Math.random() < 0.5 ? 1.4 : 0.7), tt + 0.06);
    }
    g.gain.value = 1;
  },
  gull(t) {
    const g = this.gain(0, this.bus.amb); this.env(g, t, 0.05, 0.05, 0.5);
    const o = this.osc('sawtooth', 1300, t, 0.6, this.filter('bandpass', 1800, 4, g));
    o.frequency.linearRampToValueAtTime(1700, t + 0.12); o.frequency.linearRampToValueAtTime(1100, t + 0.5);
  },

  // called every frame by the main loop
  update(dt, scene) {
    if (!this.ready) return;
    this.setMood(scene);
    const s = typeof Game !== 'undefined' ? Game.s : null;
    let sea = 0, wind = 0.15, jungle = 0;
    if (!s) { sea = 0.5; wind = 0.2; } else {
      const u = Game.active(), t = World.t(u.x, u.y), lat = World.lat(u.y);
      if (!s.party) { sea = 1; wind = Math.abs(lat) > 38 ? 0.9 : 0.45; }
      else {
        if (t === TT.JUNGLE) jungle = 1; else if (t === TT.FOREST) jungle = 0.5; else if (t === TT.SAVANNA || t === TT.GRASS) jungle = 0.2;
        if (t === TT.MOUNTAIN) wind = 0.85; else if (t === TT.DESERT || t === TT.STEPPE) wind = 0.6;
        for (const [dx, dy] of DIRS8) if (World.isWater(u.x + dx, u.y + dy) && World.t(u.x + dx, u.y + dy) !== TT.RIVER) sea = 0.45;
      }
      if (this.storm > 0) { wind = 1; sea = 1; this.storm -= dt; }
    }
    this.setAmbience(sea, wind, jungle);
    const now = this.ctx.currentTime;
    if (this.jungleLevel > 0.1 && Math.random() < dt * 0.9 * this.jungleLevel) this.chirp(now + 0.05);
    if (this.gullLevel && Math.random() < dt * 0.08) this.gull(now + 0.05);
  },

  // ------------------------------------------------------------ effects
  play(name, delay = 0) {
    if (!this.ready || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const cd = { click: 0.03, step: 0.12, hoof: 0.12, creak: 1.2, coins: 0.6, bell: 2, thunder: 2, horn: 2, hammer: 1, toll: 3 }[name] || 0.05;
    if (this.last[name] && now - this.last[name] < cd) return;
    this.last[name] = now;
    const f = this.sfx[name];
    if (f) f.call(this, now + delay, this.bus.sfx);
  },
  sfx: {
    click(t, o) { const g = this.gain(0, o); this.env(g, t, 0.002, 0.08, 0.04); this.osc('triangle', 1400, t, 0.05, g); },
    shot(t, o) {
      const g = this.gain(0, o); this.env(g, t, 0.001, 0.45, 0.18);
      this.noise(t, 0.25, this.filter('highpass', 700, 0, g));
      const b = this.gain(0, o); this.env(b, t, 0.001, 0.5, 0.12);
      this.osc('sine', 140, t, 0.15, b).frequency.exponentialRampToValueAtTime(45, t + 0.12);
    },
    volley(t, o) { for (let i = 0; i < 6; i++) this.sfx.shot.call(this, t + 0.05 + Math.random() * 0.5, o); },
    cannon(t, o) {
      const g = this.gain(0, o); this.env(g, t, 0.003, 0.75, 1.4);
      this.noise(t, 1.6, this.filter('lowpass', 500, 0.5, g), true);
      const b = this.gain(0, o); this.env(b, t, 0.002, 0.7, 0.7);
      this.osc('sine', 80, t, 0.8, b).frequency.exponentialRampToValueAtTime(28, t + 0.6);
      const cr = this.gain(0, o); this.env(cr, t, 0.001, 0.5, 0.15);
      this.noise(t, 0.2, this.filter('highpass', 1500, 0, cr));
    },
    clash(t, o) {
      for (let k = 0; k < 3; k++) {
        const tt = t + k * (0.12 + Math.random() * 0.15);
        for (const f of [2300, 3150, 4720, 6100]) {
          const g = this.gain(0, o); this.env(g, tt, 0.001, 0.06, 0.2 + Math.random() * 0.3);
          this.osc('sine', f * (0.9 + Math.random() * 0.2), tt, 0.6, g);
        }
        const n = this.gain(0, o); this.env(n, tt, 0.001, 0.25, 0.04);
        this.noise(tt, 0.06, this.filter('highpass', 3000, 0, n));
      }
    },
    hoof(t, o) {
      const g = this.gain(0, o); this.env(g, t, 0.002, 0.35, 0.07);
      this.osc('sine', 110, t, 0.09, g).frequency.exponentialRampToValueAtTime(60, t + 0.07);
      const n = this.gain(0, o); this.env(n, t, 0.001, 0.15, 0.04);
      this.noise(t, 0.06, this.filter('lowpass', 900, 0, n));
    },
    gallop(t, o) { for (let i = 0; i < 9; i++) this.sfx.hoof.call(this, t + Math.floor(i / 3) * 0.32 + (i % 3) * 0.07, o); },
    step(t, o) {
      for (let i = 0; i < 3; i++) {
        const g = this.gain(0, o); this.env(g, t + i * 0.09, 0.002, 0.09, 0.05);
        this.noise(t + i * 0.09, 0.07, this.filter('lowpass', 700, 0, g));
      }
    },
    warcry(t, o) {
      for (let v = 0; v < 6; v++) {
        const tt = t + Math.random() * 0.4, f = 200 + Math.random() * 140, dur = 0.7 + Math.random() * 0.5;
        const g = this.gain(0, o); this.env(g, tt, 0.08, 0.05, dur);
        const f1 = this.filter('bandpass', 850, 5, g), f2 = this.filter('bandpass', 1350, 6, g);
        const osc = this.osc('sawtooth', f, tt, dur, f1); osc.connect(f2);
        osc.frequency.linearRampToValueAtTime(f * 1.35, tt + dur * 0.3); osc.frequency.linearRampToValueAtTime(f * 0.9, tt + dur);
      }
    },
    arrows(t, o) {
      for (let i = 0; i < 6; i++) {
        const tt = t + Math.random() * 0.5;
        const g = this.gain(0, o); this.env(g, tt, 0.01, 0.12, 0.18);
        const bp = this.filter('bandpass', 3000, 4, g);
        bp.frequency.exponentialRampToValueAtTime(700, tt + 0.2);
        this.noise(tt, 0.25, bp);
      }
    },
    drumroll(t, o) { for (let i = 0; i < 14; i++) this.drum(t + i * 0.055, 0.1 + i * 0.025, o); },
    horn(t, o) {
      for (let k = 0; k < 2; k++) {
        const tt = t + k * 0.9, g = this.gain(0, o);
        g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(0.18, tt + 0.15); g.gain.linearRampToValueAtTime(0.0001, tt + 0.8);
        const lp = this.filter('lowpass', 900, 1, g);
        const os = this.osc('sawtooth', 185, tt, 0.85, lp); os.frequency.linearRampToValueAtTime(205, tt + 0.2);
      }
    },
    chime(t, o) { [74, 78, 81, 86].forEach((m, i) => this.pluck(m, t + i * 0.09, 0.3, o)); },
    shimmer(t, o) {
      for (let i = 0; i < 8; i++) {
        const tt = t + i * 0.06, g = this.gain(0, o); this.env(g, tt, 0.01, 0.07, 1.2);
        this.osc('sine', mtof(84 + [0, 4, 7, 11, 12, 16, 19, 24][i]), tt, 1.3, g);
      }
    },
    coins(t, o) {
      for (let i = 0; i < 7; i++) {
        const tt = t + Math.random() * 0.4, g = this.gain(0, o); this.env(g, tt, 0.001, 0.08, 0.15);
        this.osc('sine', 3200 + Math.random() * 2200, tt, 0.2, g);
        this.osc('sine', 5100 + Math.random() * 1800, tt, 0.12, this.gain(0.5, g));
      }
    },
    bell(t, o, base = 392, vol = 0.12) {
      for (const [r, a] of [[0.5, 1], [1, 0.8], [1.19, 0.5], [1.5, 0.4], [2, 0.35], [2.5, 0.2], [3, 0.15]]) {
        const g = this.gain(0, o); this.env(g, t, 0.003, vol * a, 2.8 / Math.sqrt(r));
        this.osc('sine', base * r, t, 3, g);
      }
    },
    drum(t, o) { this.drum(t, 0.7, o, 1.6); this.drum(t + 0.45, 0.6, o, 1.6); },
    toll(t, o) { this.sfx.bell.call(this, t, o, 196, 0.1); },
    hammer(t, o) {
      for (let i = 0; i < 4; i++) {
        const tt = t + i * 0.28, g = this.gain(0, o); this.env(g, tt, 0.001, 0.3, 0.08);
        this.noise(tt, 0.1, this.filter('bandpass', 1600, 2, g));
        const b = this.gain(0, o); this.env(b, tt, 0.001, 0.2, 0.1); this.osc('triangle', 420, tt, 0.12, b);
      }
    },
    thunder(t, o) {
      this.storm = 6;
      const c = this.gain(0, o); this.env(c, t, 0.001, 0.4, 0.25);
      this.noise(t, 0.3, this.filter('highpass', 1200, 0, c));
      const g = this.gain(0, o);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
      this.noise(t, 3.6, this.filter('lowpass', 280, 0.5, g), true);
    },
    creak(t, o) {
      const g = this.gain(0, o); this.env(g, t, 0.15, 0.1, 0.6);
      const os = this.osc('sawtooth', 60, t, 0.8, this.filter('bandpass', 650, 9, g));
      os.frequency.linearRampToValueAtTime(48, t + 0.4); os.frequency.linearRampToValueAtTime(70, t + 0.75);
    },
    splash(t, o) {
      const g = this.gain(0, o); this.env(g, t, 0.01, 0.35, 0.5);
      const bp = this.filter('bandpass', 1400, 1, g); bp.frequency.exponentialRampToValueAtTime(500, t + 0.5);
      this.noise(t, 0.6, bp);
    },
    // short musical cues
    discovery(t, o) {
      [62, 66, 69, 74].forEach((m, i) => this.pluck(m, t + i * 0.12, 0.35, o));
      this.recorder(78, t + 0.5, 0.35, 0.14, o); this.recorder(81, t + 0.85, 0.9, 0.14, o);
    },
    victory(t, o) {
      [[62, 0, 0.2], [66, 0.2, 0.2], [69, 0.4, 0.2], [74, 0.6, 0.9]].forEach(([m, d, l]) => { this.brass(m, t + d, l, 0.12, o); this.brass(m - 12, t + d, l, 0.08, o); });
      this.drum(t + 0.6, 0.7, o, 1.5);
    },
    defeat(t, o) {
      [[69, 0, 0.5], [67, 0.5, 0.5], [65, 1, 0.5], [64, 1.5, 1.4]].forEach(([m, d, l]) => this.recorder(m, t + d, l, 0.12, o));
      this.drum(t, 0.5, o, 2); this.drum(t + 1.5, 0.5, o, 2);
    },
    gameover(t, o) { this.sfx.bell.call(this, t, o, 147, 0.14); this.sfx.bell.call(this, t + 2.2, o, 131, 0.12); },
  },

  // ------------------------------------------------------------ game hooks
  onLog(msg, cls) {
    if (!this.ready) return;
    if (cls === 'discovery') this.play('discovery');
    else if (cls === 'artifact') this.play('shimmer');
    else if (/HURRICANE|storm strikes/.test(msg)) this.play('thunder');
    else if (/war party|COUNTER-OFFENSIVE/.test(msg)) this.play('horn');
    else if (/is complete/.test(msg)) this.play('hammer');
    else if (/baptise|mission church|Christian town/.test(msg)) this.play('bell');
    else if (/corsairs/i.test(msg)) this.play('cannon');
    else if (/sacked|overrun|drive out|martyr/.test(msg)) this.play('toll');
    else if (cls === 'good' && /gold|treasure|Collected|ducats|tribute/.test(msg)) this.play('coins');
    else if (/starving|perished/.test(msg)) this.play('toll');
  },
  moved(onLand, horses) {
    if (!this.ready) return;
    if (onLand) { this.play('step'); if (horses > 0) this.play('hoof', 0.05); }
    else if (Math.random() < 0.25) this.play('creak');
  },
  battleRound(tactic, s) {
    if (tactic === 'volley') { if (s.arquebuses > 0) this.play('volley'); if (s.cannons > 0) this.play('cannon', 0.25); }
    else if (tactic === 'charge') { if (s.horses > 0) this.play('gallop'); this.play('clash', 0.9); }
    else if (tactic === 'melee') this.play('clash');
    else this.play('drumroll');
    this.play(Math.random() < 0.5 ? 'arrows' : 'warcry', 0.5);
  },
};
