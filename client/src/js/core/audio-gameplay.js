/**
 * Audio gameplay mixin — combo, spawn, boss, power-up, hazard sounds.
 * Mixed into AudioManager.prototype via Object.assign.
 */
export const audioGameplay = {
  playCombo(level) {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;

    // Higher pitch for higher combo
    const baseFreq = 660 + level * 110;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.08);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain).connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  },

  playComboSound(comboCount) {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const baseFreq = 440 + Math.min(comboCount, 10) * 80;

    for (let i = 0; i < Math.min(comboCount, 4); i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.06;
      osc.frequency.setValueAtTime(baseFreq + i * 110, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(gain).connect(this.destination);
      osc.start(t);
      osc.stop(t + 0.15);
    }
  },

  playSpawn(pos) {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const dest = pos ? this._createPanner(pos) : this.destination;

    // Soft "pop"
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.06);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain).connect(dest);
    osc.start(now);
    osc.stop(now + 0.1);
  },

  playSlowMoHit() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;

    // Deep reverb impact
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain).connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.5);

    // Shimmer overtone
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1200, now);
    osc2.frequency.exponentialRampToValueAtTime(600, now + 0.3);
    gain2.gain.setValueAtTime(0.06, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(gain2).connect(this.destination);
    osc2.start(now);
    osc2.stop(now + 0.35);
  },

  playPowerUp() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;

    // Bright ascending chime
    [880, 1100, 1320, 1760].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.06;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(gain).connect(this.destination);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  },

  playPowerUpEnd() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;

    // Subtle descending fade
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(330, now + 0.25);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain).connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  },

  playBossSpawn() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;

    // Deep rumble
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(60, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc.connect(gain).connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.6);
  },

  playBossHit() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;

    // Metallic clang: high + low
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(1400, now);
    osc1.frequency.exponentialRampToValueAtTime(800, now + 0.06);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc1.connect(gain1).connect(this.destination);
    osc1.start(now);
    osc1.stop(now + 0.1);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(200, now);
    gain2.gain.setValueAtTime(0.2, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc2.connect(gain2).connect(this.destination);
    osc2.start(now);
    osc2.stop(now + 0.12);
  },

  playBossKill() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    this._triggerDuck(0);
    const p0 = this._getDest(0);

    // Explosion: noise burst
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.25, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    noise.connect(nGain).connect(p0);
    noise.start(now);

    // Ascending chime
    [440, 660, 880, 1100].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + 0.1 + i * 0.08;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain).connect(p0);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  },

  playWaveClear() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;

    // Triumphant fanfare
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.1;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain).connect(this.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  },

  playTelegraph(pos, isBoss) {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const dest = pos ? this._createPanner(pos) : this.destination;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const baseFreq = isBoss ? 200 : 400;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 3, now + 0.4);
    gain.gain.setValueAtTime(isBoss ? 0.15 : 0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain).connect(dest);
    osc.start(now);
    osc.stop(now + 0.45);
  },

  /** Projectile charge-up warning sound (spatial) */
  playProjectileCharge(pos) {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const dest = pos ? this._createPanner(pos) : this.destination;

    // Rising alarm tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.6);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc.connect(gain).connect(dest);
    osc.start(now);
    osc.stop(now + 0.7);
  },

  /** Projectile hit player sound */
  playProjectileHit() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;

    // Heavy impact thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain).connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  },

  /** Shield block sound */
  playShieldBlock(pos) {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const dest = pos ? this._createPanner(pos) : this.destination;

    // Bright metallic deflection
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1600, now);
    osc.frequency.exponentialRampToValueAtTime(3200, now + 0.04);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.12);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain).connect(dest);
    osc.start(now);
    osc.stop(now + 0.15);
  },

  /** Charger approaching rumble (spatial) */
  playChargerRumble(pos) {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const dest = pos ? this._createPanner(pos) : this.destination;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 60;
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain).connect(dest);
    osc.start(now);
    osc.stop(now + 0.5);
  },

  /** Charger explosion on contact */
  playChargerExplode(pos) {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const dest = pos ? this._createPanner(pos) : this.destination;

    // Noise burst
    const bufSize = ctx.sampleRate * 0.12;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.3, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    noise.connect(nGain).connect(dest);
    noise.start(now);
  },

  /** Danger zone warning alarm */
  playDangerZoneWarn(pos) {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const dest = pos ? this._createPanner(pos) : this.destination;

    // Two-tone alarm
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      const t = now + i * 0.25;
      osc.frequency.setValueAtTime(i % 2 === 0 ? 600 : 400, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(gain).connect(dest);
      osc.start(t);
      osc.stop(t + 0.15);
    }
  },

  /** Danger zone damage tick */
  playDangerZoneTick() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain).connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  },

  /** Scare ball whoosh — fast white noise burst */
  playScareWhoosh(pos) {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const dest = pos ? this._createPanner(pos) : this.destination;

    // Fast rising noise burst
    const bufSize = Math.floor(ctx.sampleRate * 0.2);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.exponentialRampToValueAtTime(0.25, now + 0.08);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    noise.connect(nGain).connect(dest);
    noise.start(now);
  },

  /** Punch impact — bass thud + crunch */
  playPunchImpact(pos) {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const dest = pos ? this._createPanner(pos) : this.destination;

    // Deep bass thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain).connect(dest);
    osc.start(now);
    osc.stop(now + 0.2);

    // Crunch noise burst
    const bufSize = Math.floor(ctx.sampleRate * 0.08);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.2, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    noise.connect(nGain).connect(dest);
    noise.start(now);
  },

  /** Rhythm PERFECT hit chime */
  playRhythmPerfect(pos) {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const dest = pos ? this._createPanner(pos) : this.destination;

    // Bright chord: root + major third + fifth
    [880, 1100, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain).connect(dest);
      osc.start(now);
      osc.stop(now + 0.25);
    });
  },

  /** Laser sweep rising synth tone */
  playLaserSweep() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 2.0);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 1.5);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
    osc.connect(gain).connect(this.destination);
    osc.start(now);
    osc.stop(now + 2.5);
  },

  /** Laser sweep warning alarm */
  playLaserWarn() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;

    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      const t = now + i * 0.2;
      osc.frequency.setValueAtTime(800, t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.connect(gain).connect(this.destination);
      osc.start(t);
      osc.stop(t + 0.1);
    }
  },

  /** Laser hit zap */
  playLaserHit() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain).connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  },

  /** Height zone spawn cue */
  playHeightZoneCue(zone, pos) {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const dest = pos ? this._createPanner(pos) : this.destination;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    if (zone === 'floor') {
      // Low rumble
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    } else {
      // High chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(1800, now + 0.15);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    }
    osc.connect(gain).connect(dest);
    osc.start(now);
    osc.stop(now + 0.4);
  },
};
