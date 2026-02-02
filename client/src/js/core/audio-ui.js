/**
 * Audio UI mixin — menu, HUD, countdown, achievement sounds.
 * Mixed into AudioManager.prototype via Object.assign.
 */
export const audioUI = {
  playGameOver() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    this._triggerDuck(0);
    const p0 = this._getDest(0);

    // Descending tones
    [440, 370, 330, 262].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.2;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain).connect(p0);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  },

  playCountdown() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(440, now);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain).connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  },

  playGo() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain).connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  },

  playCountdownBeep() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain).connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  },

  playLevelUp() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;

    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.12;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain).connect(this.destination);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  },

  playLifeLost() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.3);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain).connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  },

  playAchievement() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;

    [784, 988, 1175, 1318].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.1;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain).connect(this.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  },

  playSelect() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain).connect(this._getDest(2));
    osc.start(now);
    osc.stop(now + 0.08);
  },

  playUIHover() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 2000;
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
    osc.connect(gain).connect(this._getDest(2));
    osc.start(now);
    osc.stop(now + 0.02);
  },

  playUIClick() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 1500;
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.connect(gain).connect(this._getDest(2));
    osc.start(now);
    osc.stop(now + 0.03);
  },

  playUIToggle(on = true) {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(on ? 800 : 1200, now);
    osc.frequency.exponentialRampToValueAtTime(on ? 1200 : 800, now + 0.06);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain).connect(this._getDest(2));
    osc.start(now);
    osc.stop(now + 0.06);
  },

  playUIBack() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1000, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain).connect(this._getDest(2));
    osc.start(now);
    osc.stop(now + 0.08);
  },

  playUIError() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 200;
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain).connect(this._getDest(2));
    osc.start(now);
    osc.stop(now + 0.15);
  },

  /** Dissolve effect sound — rising noise sweep + shimmer */
  playDissolve() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    // Noise sweep
    const bufSize = ctx.sampleRate * 0.3;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (i / bufSize) * Math.exp(-i / (bufSize * 0.8));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(4000, now + 0.3);
    filter.Q.value = 2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    noise.connect(filter).connect(gain).connect(this.destination);
    if (this.reverbSend) noise.connect(this.reverbSend);
    noise.start(now);
    // Shimmer
    const shimmer = ctx.createOscillator();
    const sGain = ctx.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(2000, now);
    shimmer.frequency.exponentialRampToValueAtTime(4000, now + 0.25);
    sGain.gain.setValueAtTime(0.04, now);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    shimmer.connect(sGain).connect(this.destination);
    shimmer.start(now);
    shimmer.stop(now + 0.3);
  },
};
