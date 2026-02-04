/**
 * Audio manager using Web Audio API.
 * Generates procedural sound effects (no external files needed).
 *
 * V27: Facade — play methods extracted into mixin modules:
 *   audio-weapons.js  — weapon fire, hit, miss, ricochet
 *   audio-gameplay.js — combo, spawn, boss, power-up, hazard sounds
 *   audio-tension.js  — surge, debuff, bomb, chain, darkness, overtime
 *   audio-ui.js       — menu, HUD, countdown, achievement, dissolve
 */
import { audioWeapons } from './audio-weapons.js';
import { audioGameplay } from './audio-gameplay.js';
import { audioTension } from './audio-tension.js';
import { audioUI } from './audio-ui.js';

class AudioManager {
  constructor() {
    this._ctx = null;
    this._enabled = true;
    this._volume = 0.8;
    // V30 TASK-405: Category volume levels (0-1)
    this._categoryVolumes = {
      ambient: 0.7,
      action: 1.0,
      ui: 0.8,
      voice: 1.0,
    };
    this._categoryBuses = null;
  }

  loadSettings() {
    try {
      const raw = localStorage.getItem('vr_quest_player_v2');
      if (raw) {
        const profile = JSON.parse(raw);
        const s = profile.settings || {};
        this._enabled = s.sfx !== false;
        this._volume = (s.volume !== undefined ? s.volume : 80) / 100;
        // V30 TASK-405: Load category volumes from settings
        if (s.audioCategories) {
          for (const [cat, level] of Object.entries(s.audioCategories)) {
            if (this._categoryVolumes.hasOwnProperty(cat)) {
              this._categoryVolumes[cat] = Math.max(0, Math.min(1, level));
            }
          }
        }
      }
    } catch (e) { /* ignore */ }
  }

  _getCtx() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._masterGain = this._ctx.createGain();
      this._masterGain.connect(this._ctx.destination);
      this._masterGain.gain.value = this._volume;
      this._setupReverb();
      this._setupPriorityBuses();
    }
    if (this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
    this._masterGain.gain.value = this._volume;
    return this._ctx;
  }

  _setupReverb() {
    try {
      const ctx = this._ctx;
      const sampleRate = ctx.sampleRate;
      const length = sampleRate * 1.5;
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
      this._reverbGain.gain.value = 0.15;
      this._convolver.connect(this._reverbGain);
      this._reverbGain.connect(this._masterGain);
      this._reverbReady = true;
    } catch (_e) {
      this._reverbReady = false;
    }
  }

  get reverbSend() {
    return this._reverbReady ? this._convolver : null;
  }

  setReverbAmount(amount) {
    if (this._reverbGain) {
      this._reverbGain.gain.value = Math.max(0, Math.min(1, amount));
    }
  }

  get destination() {
    return this._busP1 || this._masterGain || this._ctx?.destination;
  }

  _setupPriorityBuses() {
    const ctx = this._ctx;
    this._busP0 = ctx.createGain();
    this._busP0.gain.value = 1.0;
    this._busP0.connect(this._masterGain);
    this._busP1 = ctx.createGain();
    this._busP1.gain.value = 1.0;
    this._busP1.connect(this._masterGain);
    this._busP2 = ctx.createGain();
    this._busP2.gain.value = 1.0;
    this._busP2.connect(this._masterGain);
    this._activeSounds = 0;
    this._maxConcurrent = 8;
    // V30 TASK-405: Setup category buses
    this._setupCategoryBuses();
  }

  // ─── V30 TASK-405: Category-based Volume Control ───────────────────────────
  /**
   * Setup category buses for independent volume control.
   * Architecture: sounds → category bus → priority bus → master → destination
   */
  _setupCategoryBuses() {
    const ctx = this._ctx;
    this._categoryBuses = {
      ambient: ctx.createGain(),
      action: ctx.createGain(),
      ui: ctx.createGain(),
      voice: ctx.createGain(),
    };
    // Set initial volumes and connect to default priority bus (P1)
    for (const [cat, bus] of Object.entries(this._categoryBuses)) {
      bus.gain.value = this._categoryVolumes[cat];
      bus.connect(this._busP1);
    }
  }

  /**
   * Get destination node for a specific category and priority.
   * @param {string} category - 'ambient', 'action', 'ui', 'voice'
   * @param {number} priority - 0 (critical), 1 (high), 2 (low)
   * @returns {GainNode}
   */
  getCategoryDest(category, priority = 1) {
    if (!this._categoryBuses) return this._getDest(priority);
    const bus = this._categoryBuses[category];
    if (!bus) return this._getDest(priority);
    // Reconnect to correct priority bus if needed
    const priBus = this._getDest(priority);
    if (bus._connectedTo !== priBus) {
      try { bus.disconnect(); } catch (_e) { /* ignore */ }
      bus.connect(priBus);
      bus._connectedTo = priBus;
    }
    return bus;
  }

  /**
   * Set volume for a specific audio category.
   * @param {string} category - 'ambient', 'action', 'ui', 'voice'
   * @param {number} level - Volume level 0-1
   */
  setCategoryVolume(category, level) {
    const vol = Math.max(0, Math.min(1, level));
    this._categoryVolumes[category] = vol;
    if (this._categoryBuses && this._categoryBuses[category]) {
      const ctx = this._ctx;
      const bus = this._categoryBuses[category];
      bus.gain.cancelScheduledValues(ctx.currentTime);
      bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
      bus.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.05);
    }
  }

  /**
   * Get current volume for a category.
   * @param {string} category
   * @returns {number} Volume level 0-1
   */
  getCategoryVolume(category) {
    return this._categoryVolumes[category] ?? 1.0;
  }

  /**
   * Set all category volumes at once.
   * @param {Object} volumes - { ambient, action, ui, voice }
   */
  setCategoryVolumes(volumes) {
    for (const [cat, level] of Object.entries(volumes)) {
      if (this._categoryVolumes.hasOwnProperty(cat)) {
        this.setCategoryVolume(cat, level);
      }
    }
  }

  /**
   * Map audio type to category.
   * @param {string} type - Sound type (weapon, hit, ui, ambient, etc.)
   * @returns {string} Category name
   */
  _mapTypeToCategory(type) {
    const mapping = {
      // Action sounds
      weapon: 'action', hit: 'action', miss: 'action', explosion: 'action',
      combo: 'action', spawn: 'action', boss: 'action', hazard: 'action',
      surge: 'action', bomb: 'action', chain: 'action',
      // UI sounds
      menu: 'ui', countdown: 'ui', achievement: 'ui', dissolve: 'ui',
      notification: 'ui', button: 'ui',
      // Ambient sounds
      ambient: 'ambient', hum: 'ambient', weather: 'ambient', music: 'ambient',
      // Voice/announcer
      voice: 'voice', announcer: 'voice',
    };
    return mapping[type] || 'action';
  }
  // ─── End V30 TASK-405 ──────────────────────────────────────────────────────

  _getDest(priority = 2) {
    if (!this._busP0) return this.destination;
    if (priority === 0) return this._busP0;
    if (priority === 1) return this._busP1;
    return this._busP2;
  }

  _triggerDuck(priority) {
    if (!this._busP0) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const duckIn = 0.02;
    const duckOut = 0.2;
    if (priority === 0) {
      this._busP1.gain.cancelScheduledValues(now);
      this._busP1.gain.setValueAtTime(this._busP1.gain.value, now);
      this._busP1.gain.linearRampToValueAtTime(0.3, now + duckIn);
      this._busP1.gain.linearRampToValueAtTime(1.0, now + duckOut + 0.3);
      this._busP2.gain.cancelScheduledValues(now);
      this._busP2.gain.setValueAtTime(this._busP2.gain.value, now);
      this._busP2.gain.linearRampToValueAtTime(0.1, now + duckIn);
      this._busP2.gain.linearRampToValueAtTime(1.0, now + duckOut + 0.3);
    } else if (priority === 1) {
      this._busP2.gain.cancelScheduledValues(now);
      this._busP2.gain.setValueAtTime(this._busP2.gain.value, now);
      this._busP2.gain.linearRampToValueAtTime(0.4, now + duckIn);
      this._busP2.gain.linearRampToValueAtTime(1.0, now + duckOut + 0.15);
    }
  }

  _canPlay() {
    if (this._activeSounds >= this._maxConcurrent) return false;
    this._activeSounds++;
    return true;
  }

  _soundDone() {
    this._activeSounds = Math.max(0, this._activeSounds - 1);
  }

  _pitchVar() {
    return 0.9 + Math.random() * 0.2;
  }

  _createPanner(pos, priority = 2) {
    const ctx = this._getCtx();
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 2;
    panner.maxDistance = 30;
    panner.rolloffFactor = 1.5;
    panner.setPosition(pos.x || 0, pos.y || 0, pos.z || 0);
    panner.connect(this._getDest(priority));
    return panner;
  }

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

  /** Spatial target ambient hum (V30: routes through ambient category) */
  createTargetHum(pos, type) {
    if (!this._enabled) return null;
    const ctx = this._getCtx();
    // V30 TASK-405: Route through ambient category bus
    const panner = this._createPanner(pos, 2); // Low priority
    if (this._categoryBuses?.ambient) {
      try { panner.disconnect(); } catch (_e) { /* ignore */ }
      panner.connect(this._categoryBuses.ambient);
    }

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
}

// Wire mixin modules onto prototype
Object.assign(AudioManager.prototype, audioWeapons, audioGameplay, audioTension, audioUI);

const audioManager = new AudioManager();
export { audioManager };
export default audioManager;
