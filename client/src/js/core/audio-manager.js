/**
 * Audio manager using Web Audio API.
 * Generates procedural sound effects (no external files needed).
 */
class AudioManager {
  constructor() {
    this._ctx = null;
    this._enabled = true;
    this._volume = 0.8;
  }

  loadSettings() {
    try {
      const raw = localStorage.getItem('vr_quest_player_v2');
      if (raw) {
        const profile = JSON.parse(raw);
        const s = profile.settings || {};
        this._enabled = s.sfx !== false;
        this._volume = (s.volume !== undefined ? s.volume : 80) / 100;
      }
    } catch (e) { /* ignore */ }
  }

  _getCtx() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._masterGain = this._ctx.createGain();
      this._masterGain.connect(this._ctx.destination);
      this._masterGain.gain.value = this._volume;
      // TASK-331: Reverb send
      this._setupReverb();
    }
    if (this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
    this._masterGain.gain.value = this._volume;
    return this._ctx;
  }

  // TASK-331: Procedural convolution reverb
  _setupReverb() {
    try {
      const ctx = this._ctx;
      const sampleRate = ctx.sampleRate;
      const length = sampleRate * 1.5; // 1.5s decay
      const impulse = ctx.createBuffer(2, length, sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        for (let i = 0; i < length; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.4));
        }
      }
      this._convolver = ctx.createConvolver();
      this._convolver.buffer = impulse;
      this._reverbGain = ctx.createGain();
      this._reverbGain.gain.value = 0.15; // default reverb send
      this._convolver.connect(this._reverbGain);
      this._reverbGain.connect(this._masterGain);
      this._reverbReady = true;
    } catch (_e) {
      this._reverbReady = false;
    }
  }

  /** Get reverb send node (for spatial depth on SFX) */
  get reverbSend() {
    return this._reverbReady ? this._convolver : null;
  }

  setReverbAmount(amount) {
    if (this._reverbGain) {
      this._reverbGain.gain.value = Math.max(0, Math.min(1, amount));
    }
  }

  get destination() {
    return this._masterGain || this._ctx?.destination;
  }

  _pitchVar() {
    return 0.9 + Math.random() * 0.2;
  }

  /**
   * Create a PannerNode for 3D positional audio.
   * @param {{x:number,y:number,z:number}} pos - world position
   */
  _createPanner(pos) {
    const ctx = this._getCtx();
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 2;
    panner.maxDistance = 30;
    panner.rolloffFactor = 1.5;
    panner.setPosition(pos.x || 0, pos.y || 0, pos.z || 0);
    panner.connect(this.destination);
    return panner;
  }

  /** Update listener position from camera. Call from game tick. */
  updateListener(pos, fwd, up) {
    const ctx = this._getCtx();
    const l = ctx.listener;
    if (l.positionX) {
      l.positionX.value = pos.x;
      l.positionY.value = pos.y;
      l.positionZ.value = pos.z;
      l.forwardX.value = fwd.x;
      l.forwardY.value = fwd.y;
      l.forwardZ.value = fwd.z;
      l.upX.value = up.x;
      l.upY.value = up.y;
      l.upZ.value = up.z;
    } else {
      l.setPosition(pos.x, pos.y, pos.z);
      l.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
    }
  }

  playHit(pos) {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const pv = this._pitchVar();
    const dest = pos ? this._createPanner(pos) : this.destination;

    // Short bright "ping"
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880 * pv, now);
    osc.frequency.exponentialRampToValueAtTime(1760 * pv, now + 0.05);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain).connect(dest);
    osc.start(now);
    osc.stop(now + 0.15);
  }

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
  }

  playMiss() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;

    // Low "bwop" for miss/expire
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain).connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

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
  }

  playGameOver() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;

    // Descending tones
    [440, 370, 330, 262].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.2;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain).connect(this.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

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
  }

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
  }

  playWeaponFire(type) {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const pv = this._pitchVar();

    if (type === 'shotgun') {
      const bufferSize = ctx.sampleRate * 0.08;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      noise.connect(gain).connect(this.destination);
      noise.start(now);
    } else if (type === 'sniper') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1200 * pv, now);
      osc.frequency.exponentialRampToValueAtTime(200 * pv, now + 0.15);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain).connect(this.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'smg') {
      // Short sharp burst beep
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(800 * pv, now);
      osc.frequency.exponentialRampToValueAtTime(400 * pv, now + 0.03);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain).connect(this.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'railgun') {
      // Discharge crack — high freq noise burst + low sine thump
      const bufferSize = ctx.sampleRate * 0.06;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.35, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      noise.connect(ng).connect(this.destination);
      noise.start(now);
      // Low thump
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain).connect(this.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(600 * pv, now);
      osc.frequency.exponentialRampToValueAtTime(200 * pv, now + 0.06);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain).connect(this.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    }
  }

  /** TASK-270: Railgun charge whine — rising frequency while charging */
  playRailgunCharge(level) {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const freq = 200 + level * 400;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.05 + level * 0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain).connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

  playBossKill() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;

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
    noise.connect(nGain).connect(this.destination);
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
      osc.connect(gain).connect(this.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

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
  }

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
  }

  playRicochet(pos) {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const dest = pos ? this._createPanner(pos) : this.destination;
    const pv = this._pitchVar();

    // Short metallic ping
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2000 * pv, now);
    osc.frequency.exponentialRampToValueAtTime(800 * pv, now + 0.08);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain).connect(dest);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /** Spatial target ambient hum */
  createTargetHum(pos, type) {
    if (!this._enabled) return null;
    const ctx = this._getCtx();
    const panner = this._createPanner(pos);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const freqMap = { standard: 120, speed: 280, heavy: 60, bonus: 440, decoy: 90, powerup: 350, charger: 80 };
    osc.type = (type === 'heavy' || type === 'charger') ? 'sawtooth' : type === 'bonus' ? 'sine' : 'triangle';
    osc.frequency.value = freqMap[type] || 120;
    gain.gain.value = 0.02;
    osc.connect(gain).connect(panner);
    osc.start();

    return { osc, gain, panner, update(p, vol) {
      panner.setPosition(p.x || 0, p.y || 0, p.z || 0);
      gain.gain.setTargetAtTime(vol, ctx.currentTime, 0.05);
    }, stop() {
      try { osc.stop(); } catch(e) {}
      try { gain.disconnect(); panner.disconnect(); } catch(e) {}
    }};
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

  /** Scare ball whoosh — fast white noise burst (TASK-255) */
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
  }

  /** Punch impact — bass thud + crunch (TASK-256) */
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
  }

  /** Rhythm PERFECT hit chime (TASK-257) */
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
  }

  /** Laser sweep rising synth tone (TASK-258) */
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
  }

  /** Laser sweep warning alarm (TASK-258) */
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
  }

  /** Laser hit zap (TASK-258) */
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
  }

  /** TASK-252: Height zone spawn cue */
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
  }

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
    osc.connect(gain).connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }
  // === TASK-331: UI Sounds ===

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
    osc.connect(gain).connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.02);
  }

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
    osc.connect(gain).connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.03);
  }

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
    osc.connect(gain).connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

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
    osc.connect(gain).connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

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
    osc.connect(gain).connect(this.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // === TASK-331: Missing SFX ===

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

  // TASK-291: Heartbeat thump for final rush
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
    }, 1000); // 60 BPM
  }
}

const audioManager = new AudioManager();
export { audioManager };
export default audioManager;
