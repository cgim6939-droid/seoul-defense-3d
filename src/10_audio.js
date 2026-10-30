// ============================================================
//  사운드 (WebAudio 합성 — 외부 파일 없음)
// ============================================================
const AUDIO = {
  ctx: null, master: null, reverb: null, noise: null, boss: null,
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = this.ctx = new C();
    this.master = ctx.createGain(); this.master.gain.value = SETTINGS.volume;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5;
    this.master.connect(comp).connect(ctx.destination);
    this.reverb = ctx.createConvolver(); this.reverb.buffer = this.ir(2.6, 3);
    const rg = ctx.createGain(); rg.gain.value = 0.32; this.reverb.connect(rg).connect(this.master);
    const len = ctx.sampleRate * 2, nb = ctx.createBuffer(1, len, ctx.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = nb;
    this.ambient();
  },
  setVolume(v) { if (this.master) this.master.gain.value = v; },
  ir(dur, decay) {
    const ctx = this.ctx, len = (dur * ctx.sampleRate) | 0, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  },
  out(pan = 0, gain = 1, rev = 0.3) {
    const ctx = this.ctx, g = ctx.createGain(), p = ctx.createStereoPanner();
    g.gain.value = gain; p.pan.value = clamp(pan, -1, 1);
    g.connect(p); p.connect(this.master);
    if (rev > 0) { const s = ctx.createGain(); s.gain.value = rev; p.connect(s); s.connect(this.reverb); }
    return g;
  },
  at(x, y, z, gain = 1, rev = 0.4, ref = 12) {
    const dx = x - camera.position.x, dz = z - camera.position.z, dy = y - camera.position.y;
    const d = Math.hypot(dx, dy, dz);
    const rel = Math.atan2(dx, -dz) - (-P.yaw);
    const g = gain / (1 + d / ref);
    if (g < 0.01) return null;
    return this.out(Math.sin(rel) * 0.8, g, rev + Math.min(0.5, d / 120));
  },
  env(param, t, a, peak, d) {
    param.setValueAtTime(0.0001, t); param.exponentialRampToValueAtTime(peak, t + a); param.exponentialRampToValueAtTime(0.0001, t + a + d);
  },
  nz(dest, t, dur, type, f0, f1, q, peak, a = 0.002) {
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); f.Q.value = q;
    const g = ctx.createGain(); this.env(g.gain, t, a, peak, dur);
    s.connect(f).connect(g).connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.1);
  },
  tone(dest, t, dur, type, f0, f1, peak, a = 0.003) {
    const ctx = this.ctx, o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
    const g = ctx.createGain(); this.env(g.gain, t, a, peak, dur);
    o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.1);
  },
  shot(kind) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const c = { pistol: [1900, 0.14, 0.8, 0.5], rifle: [1300, 0.2, 0.9, 0.8], shotgun: [750, 0.4, 1.2, 1.2] }[kind];
    const o = this.out(0, 1, 0.55);
    this.nz(o, t, c[1], 'bandpass', c[0] * 1.7, c[0] * 0.4, 0.8, c[2]);
    this.tone(o, t, 0.14, 'sine', 170, 40, c[3]);
    this.nz(o, t, 0.03, 'highpass', 5000, 3000, 0.7, 0.4, 0.001);
  },
  click(v = 0.3, f = 2600) { if (!this.ctx) return; const t = this.ctx.currentTime; const o = this.out(0.2, 1, 0.05); this.nz(o, t, 0.035, 'bandpass', f, f * 0.7, 3, v, 0.001); },
  dry() { this.click(0.25, 3800); },
  step(k = 1) { if (!this.ctx) return; const t = this.ctx.currentTime; this.nz(this.out(R(-0.2, 0.2), 1, 0.05), t, 0.07, 'lowpass', 900, 200, 0.7, 0.12 * k, 0.004); },
  land() { if (!this.ctx) return; const t = this.ctx.currentTime; const o = this.out(0, 1, 0.1); this.nz(o, t, 0.15, 'lowpass', 600, 120, 0.7, 0.4); this.tone(o, t, 0.12, 'sine', 90, 40, 0.4); },
  hit(head) {
    if (!this.ctx) return; const t = this.ctx.currentTime; const o = this.out(0, 1, 0);
    this.tone(o, t, 0.05, 'sine', head ? 2600 : 1900, head ? 2400 : 1700, head ? 0.22 : 0.12);
    if (head) this.tone(o, t + 0.04, 0.12, 'sine', 3400, 3300, 0.12);
  },
  kill() { if (!this.ctx) return; const t = this.ctx.currentTime; const o = this.out(0, 1, 0.1); this.tone(o, t, 0.12, 'triangle', 900, 1300, 0.15); },
  hurt() { if (!this.ctx) return; const t = this.ctx.currentTime; const o = this.out(0, 1, 0.1); this.nz(o, t, 0.2, 'lowpass', 1200, 200, 1, 0.5); this.tone(o, t, 0.18, 'sawtooth', 160, 80, 0.12); },
  alien(x, y, z, kind = 'hurt') {
    if (!this.ctx) return; const o = this.at(x, y, z, 0.9, 0.4); if (!o) return; const t = this.ctx.currentTime;
    if (kind === 'die') { this.tone(o, t, 0.6, 'sawtooth', 420, 60, 0.25); this.nz(o, t, 0.4, 'bandpass', 900, 200, 2, 0.4); }
    else if (kind === 'attack') { this.tone(o, t, 0.3, 'sawtooth', 220, 520, 0.2); this.nz(o, t, 0.25, 'bandpass', 1500, 600, 4, 0.2); }
    else this.tone(o, t, 0.12, 'square', R(500, 700), R(900, 1200), 0.09);
  },
  warp(x, y, z) {
    if (!this.ctx) return; const o = this.at(x, y, z, 0.8, 0.5, 20); if (!o) return; const t = this.ctx.currentTime;
    this.nz(o, t, 0.9, 'bandpass', 200, 3000, 6, 0.5, 0.2); this.tone(o, t, 0.8, 'sine', 300, 1200, 0.15, 0.3);
  },
  zap(x, y, z) {
    if (!this.ctx) return; const o = this.at(x, y, z, 0.7, 0.3, 15); if (!o) return; const t = this.ctx.currentTime;
    this.tone(o, t, 0.2, 'square', 1200, 180, 0.25); this.nz(o, t, 0.15, 'highpass', 3000, 1500, 1, 0.12);
  },
  boom(x, y, z, big = 1) {
    if (!this.ctx) return; const o = this.at(x, y, z, 1.6 * big, 0.8, 30); if (!o) return; const t = this.ctx.currentTime;
    this.nz(o, t, 1.4 * big, 'lowpass', 1800, 90, 0.7, 1.2); this.tone(o, t, 0.7, 'sine', 80, 25, 1.1); this.nz(o, t, 0.08, 'highpass', 3000, 1500, 0.7, 0.6, 0.001);
  },
  horn(x, y, z) {
    if (!this.ctx) return; const o = this.at(x, y, z, 0.6, 0.4, 15); if (!o) return; const t = this.ctx.currentTime;
    for (const f of [415, 520]) { const ctx = this.ctx, os = ctx.createOscillator(); os.type = 'square'; os.frequency.value = f;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.setValueAtTime(0.12, t + 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      os.connect(lp).connect(g).connect(o); os.start(t); os.stop(t + 0.5); }
  },
  siren() {
    if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime, o = this.out(0, 0.14, 1.2);
    const os = ctx.createOscillator(); os.type = 'sawtooth';
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    os.frequency.setValueAtTime(380, t);
    for (let i = 0; i < 3; i++) { os.frequency.linearRampToValueAtTime(900, t + i * 2.4 + 1.3); os.frequency.linearRampToValueAtTime(380, t + i * 2.4 + 2.4); }
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 0.8); g.gain.setValueAtTime(1, t + 6); g.gain.exponentialRampToValueAtTime(0.0001, t + 7.2);
    os.connect(lp).connect(g).connect(o); os.start(t); os.stop(t + 7.3);
  },
  chime() {
    if (!this.ctx) return; const t = this.ctx.currentTime, o = this.out(0, 0.5, 0.6);
    [523, 659, 784, 1047].forEach((f, i) => this.tone(o, t + i * 0.09, 0.5, 'triangle', f, f, 0.18));
  },
  pickup() { if (!this.ctx) return; const t = this.ctx.currentTime, o = this.out(0, 0.6, 0.2); this.tone(o, t, 0.15, 'sine', 700, 1400, 0.3); this.tone(o, t + 0.08, 0.2, 'sine', 1050, 2100, 0.2); },
  ambient() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 4, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const s = ctx.createBufferSource(); s.buffer = b; s.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    const g = ctx.createGain(); g.gain.value = 0.18;
    s.connect(lp).connect(g).connect(this.master); s.start();
    const w = ctx.createBufferSource(); w.buffer = this.noise; w.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.6;
    const wg = ctx.createGain(); wg.gain.value = 0.02;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09; const lg = ctx.createGain(); lg.gain.value = 0.015;
    lfo.connect(lg).connect(wg.gain); lfo.start();
    w.connect(bp).connect(wg).connect(this.master); w.start();
  },
  bossHum(on, k = 1) {
    if (!this.ctx) return; const ctx = this.ctx;
    if (on && !this.boss) {
      const g = ctx.createGain(); g.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
      const oscs = [55, 55.7, 82.4].map(f => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); return o; });
      lp.connect(g).connect(this.master); this.boss = { g, oscs };
    }
    if (this.boss) {
      this.boss.g.gain.setTargetAtTime(on ? 0.14 * k : 0, ctx.currentTime, 0.4);
      if (!on) { const b = this.boss; this.boss = null; setTimeout(() => b.oscs.forEach(o => o.stop()), 1500); }
    }
  },
};
