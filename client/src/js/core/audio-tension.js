/**
 * Audio tension mixin — surge, debuff, bomb, chain, darkness, overtime sounds.
 * Mixed into AudioManager.prototype via Object.assign.
 */
export const audioTension = {
  /** Surge start — dramatic low boom + ascending power chord */
  playSurgeStart() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    // Low boom
    const boom = ctx.createOscillator();
    const bGain = ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(60, now);
    boom.frequency.exponentialRampToValueAtTime(30, now + 0.4);
    bGain.gain.setValueAtTime(0.3, now);
    bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    boom.connect(bGain).connect(this.destination);
    boom.start(now);
    boom.stop(now + 0.5);
    // Power chord (ascending)
    [220, 330, 440].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      const t = now + i * 0.08;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.3);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(g).connect(this.destination);
      osc.start(now);
      osc.stop(t + 0.5);
    });
  },

  playSurgeEnd() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    [440, 330, 220].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + i * 0.1 + 0.3);
      g.gain.setValueAtTime(0.08, now + i * 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.4);
      osc.connect(g).connect(this.destination);
      osc.start(now);
      osc.stop(now + i * 0.1 + 0.5);
    });
  },

  playDebuffApply() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    // Dark dissonant tone
    [110, 116.5, 155.6].forEach(freq => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.08, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.connect(g).connect(this.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    });
  },

  playDebuffClear() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    // Bright resolution chord
    [262, 330, 392, 523].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.08, now + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(g).connect(this.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    });
  },

  playArenaClose() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    // Rumble
    const rumble = ctx.createOscillator();
    const rGain = ctx.createGain();
    rumble.type = 'sine';
    rumble.frequency.setValueAtTime(40, now);
    rumble.frequency.linearRampToValueAtTime(60, now + 0.3);
    rGain.gain.setValueAtTime(0.2, now);
    rGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    rumble.connect(rGain).connect(this.destination);
    rumble.start(now);
    rumble.stop(now + 0.5);
    // Metal clang
    const clang = ctx.createOscillator();
    const cGain = ctx.createGain();
    clang.type = 'square';
    clang.frequency.setValueAtTime(800, now + 0.05);
    clang.frequency.exponentialRampToValueAtTime(200, now + 0.15);
    cGain.gain.setValueAtTime(0.12, now + 0.05);
    cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    clang.connect(cGain).connect(this.destination);
    clang.start(now);
    clang.stop(now + 0.3);
  },

  playHeartbeat() {
    if (!this._ctx) return;
    let beat = 0;
    const interval = setInterval(() => {
      if (beat >= 10 || !this._ctx) { clearInterval(interval); return; }
      const now = this._ctx.currentTime;
      const osc = this._ctx.createOscillator();
      const gain = this._ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(50, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain).connect(this.destination);
      osc.start(now);
      osc.stop(now + 0.2);
      beat++;
    }, 1000);
  },

  playLastStandRecover() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    // Rising hopeful chord
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.08;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain).connect(this.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  },

  playBombTick(urgency = 0) {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const freq = 600 + urgency * 200;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain).connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  },

  playBombExplode() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    this._triggerDuck(0);
    const p0 = this._getDest(0);
    // Noise burst + low boom
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.08));
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    src.connect(gain).connect(p0);
    src.start(now);
    // Low boom
    const boom = ctx.createOscillator();
    const bGain = ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(80, now);
    boom.frequency.exponentialRampToValueAtTime(30, now + 0.25);
    bGain.gain.setValueAtTime(0.35, now);
    bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    boom.connect(bGain).connect(p0);
    boom.start(now);
    boom.stop(now + 0.3);
  },

  playBombDefuse() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    [880, 1047, 1319].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.05;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain).connect(this.destination);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  },

  playChainBreak() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain).connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  },

  playChainComplete() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    [784, 988, 1175, 1568].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.06;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain).connect(this.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  },

  playDarknessWarn() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(40, now);
    osc.frequency.linearRampToValueAtTime(60, now + 1.5);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 1.5);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2);
    osc.connect(gain).connect(this.destination);
    osc.start(now);
    osc.stop(now + 2);
  },

  playDarknessStart() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.15));
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.linearRampToValueAtTime(800, now + 0.3);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    src.connect(filter).connect(gain).connect(this.destination);
    src.start(now);
  },

  playOvertimeStart() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    this._triggerDuck(0);
    const p0 = this._getDest(0);
    // Ascending siren
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(900, now + 0.4);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain).connect(p0);
    osc.start(now);
    osc.stop(now + 0.5);
    // Second horn
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(440, now + 0.3);
    osc2.frequency.linearRampToValueAtTime(880, now + 0.6);
    gain2.gain.setValueAtTime(0.15, now + 0.3);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc2.connect(gain2).connect(p0);
    osc2.start(now + 0.3);
    osc2.stop(now + 0.7);
  },

  playOvertimeTick() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1000, now);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain).connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  },

  playComboLost(level = 1) {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    this._triggerDuck(0);
    const p0 = this._getDest(0);
    const intensity = Math.min(level / 20, 1);

    // Descending dissonant sweep
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc2.type = 'square';
    const baseFreq = 400 + intensity * 200;
    osc1.frequency.setValueAtTime(baseFreq, now);
    osc1.frequency.exponentialRampToValueAtTime(80, now + 0.3);
    osc2.frequency.setValueAtTime(baseFreq * 1.06, now);
    osc2.frequency.exponentialRampToValueAtTime(60, now + 0.35);
    const vol = 0.15 + intensity * 0.15;
    gain1.gain.setValueAtTime(vol, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    gain2.gain.setValueAtTime(vol * 0.6, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1).connect(p0);
    osc2.connect(gain2).connect(p0);
    osc1.start(now);
    osc1.stop(now + 0.3);
    osc2.start(now);
    osc2.stop(now + 0.35);

    // Sub-bass thump for high combos
    if (level >= 15) {
      const sub = ctx.createOscillator();
      const sGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(60, now);
      sub.frequency.exponentialRampToValueAtTime(25, now + 0.2);
      sGain.gain.setValueAtTime(0.3, now);
      sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      sub.connect(sGain).connect(p0);
      sub.start(now);
      sub.stop(now + 0.2);
    }
  },

  playBombWarning() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    this._triggerDuck(1);
    const p1 = this._getDest(1);

    // 3 rapid warning pulses over 800ms
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.2;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.setValueAtTime(440, t + 0.05);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain).connect(p1);
      osc.start(t);
      osc.stop(t + 0.12);
    }
    // Low rumble underneath
    const rumble = ctx.createOscillator();
    const rGain = ctx.createGain();
    rumble.type = 'sine';
    rumble.frequency.setValueAtTime(50, now);
    rGain.gain.setValueAtTime(0.15, now);
    rGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    rumble.connect(rGain).connect(p1);
    rumble.start(now);
    rumble.stop(now + 0.7);
  },
};
