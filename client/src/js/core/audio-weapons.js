/**
 * Audio weapons mixin — weapon fire, hit, miss, ricochet sounds.
 * Mixed into AudioManager.prototype via Object.assign.
 */
export const audioWeapons = {
  playHit(pos) {
    if (!this._enabled) return;
    if (!this._canPlay()) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const pv = this._pitchVar();
    const dest = pos ? this._createPanner(pos) : this.destination;

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
    osc.onended = () => this._soundDone();
  },

  playMiss() {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;

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
  },

  playWeaponFire(type) {
    if (!this._enabled) return;
    if (!this._canPlay()) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const pv = this._pitchVar();
    const done = () => this._soundDone();

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
      noise.onended = done;
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
      osc.onended = done;
    } else if (type === 'smg') {
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
      osc.onended = done;
    } else if (type === 'railgun') {
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
      osc.onended = done;
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
      osc.onended = done;
    }
  },

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
  },

  playRicochet(pos) {
    if (!this._enabled) return;
    if (!this._canPlay()) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const dest = pos ? this._createPanner(pos, 2) : this._getDest(2);
    const pv = this._pitchVar();

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
    osc.onended = () => this._soundDone();
  },
};
