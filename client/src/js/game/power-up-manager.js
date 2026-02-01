import audioManager from '../core/audio-manager.js';

const POWER_UPS = {
  doublePoints: { duration: 10000, color: '#00ff88', icon: '2X', label: 'DOUBLE POINTS!' },
  freezeTime:   { duration: 5000,  color: '#00d4ff', icon: '\u2744', label: 'TIME FREEZE!' },
  multiShot:    { duration: 10000, color: '#ff44aa', icon: '\u00d73', label: 'MULTI-SHOT!' },
  shield:       { duration: 15000, color: '#4488ff', icon: '🛡️', label: 'SHIELD!' },
  magnet:       { duration: 5000,  color: '#ff88ff', icon: '🧲', label: 'MAGNET!' },
  slowField:    { duration: 8000,  color: '#88ff88', icon: '🐌', label: 'SLOW FIELD!' },
};

const POWER_UP_KEYS = Object.keys(POWER_UPS);

class PowerUpManager {
  constructor() {
    this._active = new Map();
    this._hudInterval = null;
    this._onUpdate = null;
    this._onDeactivate = null;
  }

  set onUpdate(fn) { this._onUpdate = fn; }
  set onDeactivate(fn) { this._onDeactivate = fn; }

  activate(type) {
    const config = POWER_UPS[type];
    if (!config) return;

    // If same type already active, clear old timeout and restart
    if (this._active.has(type)) {
      clearTimeout(this._active.get(type).timeout);
    }

    const startTime = Date.now();
    const timeout = setTimeout(() => this.deactivate(type), config.duration);
    this._active.set(type, { timeout, startTime, config });

    audioManager.playPowerUp();
    document.dispatchEvent(new CustomEvent('powerup-activate', { detail: { type, config } }));

    this._startHudUpdates();
  }

  deactivate(type) {
    const entry = this._active.get(type);
    if (!entry) return;

    clearTimeout(entry.timeout);
    this._active.delete(type);

    audioManager.playPowerUpEnd();
    this._onDeactivate?.(type);
    document.dispatchEvent(new CustomEvent('powerup-deactivate', { detail: { type } }));

    if (this._active.size === 0) {
      this._stopHudUpdates();
    }
  }

  isActive(type) {
    return this._active.has(type);
  }

  getMultiplier() {
    return this._active.has('doublePoints') ? 2 : 1;
  }

  getProjectileMultiplier() {
    return this._active.has('multiShot') ? 3 : 1;
  }

  isTimeFrozen() {
    return this._active.has('freezeTime');
  }

  hasShield() {
    return this._active.has('shield');
  }

  consumeShield() {
    if (!this._active.has('shield')) return false;
    this.deactivate('shield');
    return true;
  }

  hasMagnet() {
    return this._active.has('magnet');
  }

  hasSlowField() {
    return this._active.has('slowField');
  }

  getSpeedMultiplier() {
    return this._active.has('slowField') ? 0.5 : 1.0;
  }

  activateRandom() {
    const type = POWER_UP_KEYS[Math.floor(Math.random() * POWER_UP_KEYS.length)];
    this.activate(type);
    return { type, config: POWER_UPS[type] };
  }

  getActiveDisplay() {
    if (this._active.size === 0) return null;

    // Show the most recently activated power-up with remaining time
    let latest = null;
    let latestTime = 0;
    for (const [type, entry] of this._active) {
      if (entry.startTime >= latestTime) {
        latestTime = entry.startTime;
        const remaining = Math.max(0, entry.config.duration - (Date.now() - entry.startTime));
        latest = { type, label: entry.config.label, color: entry.config.color, remaining };
      }
    }
    return latest;
  }

  reset() {
    for (const [, entry] of this._active) {
      clearTimeout(entry.timeout);
    }
    this._active.clear();
    this._stopHudUpdates();
  }

  _startHudUpdates() {
    if (this._hudInterval) return;
    this._hudInterval = setInterval(() => {
      const display = this.getActiveDisplay();
      this._onUpdate?.(display);
    }, 100);
  }

  _stopHudUpdates() {
    if (this._hudInterval) {
      clearInterval(this._hudInterval);
      this._hudInterval = null;
    }
    this._onUpdate?.(null);
  }
}

const powerUpManager = new PowerUpManager();
export { powerUpManager, POWER_UPS };
export default powerUpManager;
