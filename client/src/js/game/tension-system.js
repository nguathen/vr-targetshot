/**
 * V19 — Adrenaline Surge
 * TASK-310: Tension Vignette & Heartbeat
 * TASK-311: Sudden Surge Events
 * TASK-312: Power-Down Debuffs
 * TASK-313: Closing Arena Walls
 * V30 TASK-403: Hitstop integration for impact effects
 */
import audioManager from '../core/audio-manager.js';
import { getSettings } from './settings-util.js';

// TASK-431: Quest detection for disabling tension system
const _isQuest = typeof window !== 'undefined' &&
  (window.__isQuestDevice || /Quest|Android|Mobile/i.test(navigator.userAgent));

// ─── TASK-310: Tension Vignette & Heartbeat ───

const HEARTBEAT_INTERVAL_NORMAL = 800;
const HEARTBEAT_INTERVAL_CRITICAL = 500;

class TensionSystem {
  constructor() {
    this._vignetteEl = null;
    this._heartbeatTimer = null;
    this._heartbeatPhase = 0;
    this._dangerLevel = 0; // 0=none, 1=warning, 2=critical
    this._combo = 0;
    this._running = false;

    // TASK-311: Surge
    this._surgeCount = 0;
    this._surgeActive = false;
    this._surgeTimer = null;
    this._surgeGraceTimer = null;
    this._onSurgeStart = null;
    this._onSurgeEnd = null;

    // TASK-312: Debuffs
    this._activeDebuff = null;
    this._debuffTimer = null;
    this._debuffOverlay = null;
    this._onDebuffChange = null;

    // TASK-313: Arena walls
    this._arenaWalls = [];
    this._arenaScale = 1.0; // 1.0 = full, 0.5 = min
    this._arenaResetUsed = false;
  }

  start(sceneEl) {
    // TASK-431: Disable tension system on Quest for performance
    if (_isQuest) {
      console.log('[tension-system] Disabled on Quest for performance');
      this._running = false;
      return;
    }

    this._running = true;
    this._combo = 0;
    this._dangerLevel = 0;
    this._surgeCount = 0;
    this._surgeActive = false;
    this._activeDebuff = null;
    this._arenaScale = 1.0;
    this._arenaResetUsed = false;

    this._ensureVignette();
    this._ensureArenaWalls(sceneEl);
  }

  stop() {
    this._running = false;
    this._dangerLevel = 0;
    this._combo = 0;
    this._surgeActive = false;

    if (this._heartbeatTimer) { clearInterval(this._heartbeatTimer); this._heartbeatTimer = null; }
    if (this._surgeTimer) { clearTimeout(this._surgeTimer); this._surgeTimer = null; }
    if (this._surgeGraceTimer) { clearTimeout(this._surgeGraceTimer); this._surgeGraceTimer = null; }
    if (this._debuffTimer) { clearTimeout(this._debuffTimer); this._debuffTimer = null; }
    this._activeDebuff = null;
    this._onDebuffChange?.(null);

    // Hide vignette
    if (this._vignetteEl) {
      this._vignetteEl.classList.remove('tension-active', 'tension-critical', 'tension-golden', 'tension-white');
    }
    // Remove debuff overlay
    if (this._debuffOverlay) {
      this._debuffOverlay.classList.remove('debuff-fog-active');
    }
    // Reset arena walls
    this._arenaWalls.forEach(w => {
      if (w.el?.parentNode) w.el.parentNode.removeChild(w.el);
    });
    this._arenaWalls = [];
  }

  // ─── TASK-310: Danger level update ───

  updateDanger(lives, maxLives, timeLeft, duration) {
    if (!this._running) return;
    let level = 0;

    // Lives-based danger
    if (lives !== Infinity && lives <= 1) level = 2;
    else if (lives !== Infinity && lives <= 2 && maxLives > 3) level = 1;

    // Time-based danger (timeAttack)
    if (duration !== Infinity) {
      if (timeLeft <= 10) level = Math.max(level, 2);
      else if (timeLeft <= 15) level = Math.max(level, 1);
    }

    if (level !== this._dangerLevel) {
      this._dangerLevel = level;
      this._updateVignetteDanger();
    }
  }

  updateCombo(combo) {
    this._combo = combo;
    this._updateVignetteCombo();
  }

  _ensureVignette() {
    // TASK-442: Skip DOM creation on Quest - no element = no computation
    if (_isQuest) return;

    this._vignetteEl = document.getElementById('tension-vignette');
    if (!this._vignetteEl) {
      this._vignetteEl = document.createElement('div');
      this._vignetteEl.id = 'tension-vignette';
      this._vignetteEl.className = 'tension-vignette';
      document.body.appendChild(this._vignetteEl);
    }
    this._vignetteEl.classList.remove('tension-active', 'tension-critical', 'tension-golden', 'tension-white');

    // Debuff overlay
    this._debuffOverlay = document.getElementById('debuff-fog-overlay');
    if (!this._debuffOverlay) {
      this._debuffOverlay = document.createElement('div');
      this._debuffOverlay.id = 'debuff-fog-overlay';
      this._debuffOverlay.className = 'debuff-fog-overlay';
      document.body.appendChild(this._debuffOverlay);
    }
  }

  _updateVignetteDanger() {
    // TASK-443: Skip vignette updates on Quest
    if (_isQuest || !this._vignetteEl) return;
    this._vignetteEl.classList.remove('tension-active', 'tension-critical');

    if (this._dangerLevel >= 2) {
      this._vignetteEl.classList.add('tension-active', 'tension-critical');
      this._startHeartbeat(HEARTBEAT_INTERVAL_CRITICAL);
    } else if (this._dangerLevel >= 1) {
      this._vignetteEl.classList.add('tension-active');
      this._startHeartbeat(HEARTBEAT_INTERVAL_NORMAL);
    } else {
      this._stopHeartbeat();
      // Keep combo vignette if active
      if (this._combo < 15) {
        this._vignetteEl.classList.remove('tension-golden', 'tension-white');
      }
    }
  }

  _updateVignetteCombo() {
    // TASK-443: Skip vignette updates on Quest
    if (_isQuest || !this._vignetteEl) return;
    this._vignetteEl.classList.remove('tension-golden', 'tension-white');

    if (this._combo > 30) {
      this._vignetteEl.classList.add('tension-active', 'tension-white');
    } else if (this._combo > 15) {
      this._vignetteEl.classList.add('tension-active', 'tension-golden');
    }
  }

  _startHeartbeat(interval) {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._heartbeatPhase = 0;
    this._heartbeatTimer = setInterval(() => {
      if (!this._running) return;
      this._heartbeatPhase = (this._heartbeatPhase + 1) % 2;
      audioManager.playHeartbeat?.();
    }, interval);
  }

  _stopHeartbeat() {
    if (this._heartbeatTimer) { clearInterval(this._heartbeatTimer); this._heartbeatTimer = null; }
  }

  // TASK-350: Allow external heartbeat rate override
  setHeartbeatRate(interval) {
    if (this._heartbeatTimer) {
      this._startHeartbeat(interval);
    }
  }

  // ─── TASK-311: Surge Events ───

  set onSurgeStart(fn) { this._onSurgeStart = fn; }
  set onSurgeEnd(fn) { this._onSurgeEnd = fn; }

  /**
   * Called on wave transition. Returns true if surge triggered.
   */
  checkSurge(wave) {
    if (!this._running || this._surgeActive) return false;
    if (wave < 3 || this._surgeCount >= 2) return false;
    if (Math.random() >= 0.15) return false;

    this._triggerSurge();
    return true;
  }

  _triggerSurge() {
    this._surgeCount++;

    // 1s warning
    document.dispatchEvent(new CustomEvent('surge-warning'));

    this._surgeTimer = setTimeout(() => {
      if (!this._running) return;
      this._surgeActive = true;
      this._onSurgeStart?.();
      document.dispatchEvent(new CustomEvent('surge-start'));

      // Add visual class
      if (this._vignetteEl) this._vignetteEl.classList.add('surge-active');

      // End surge after 5s
      this._surgeTimer = setTimeout(() => {
        if (!this._running) return;
        this._surgeActive = false;
        this._onSurgeEnd?.();
        if (this._vignetteEl) this._vignetteEl.classList.remove('surge-active');
        document.dispatchEvent(new CustomEvent('surge-end'));

        // 2s grace period
        this._surgeGraceTimer = setTimeout(() => {
          document.dispatchEvent(new CustomEvent('surge-grace-end'));
        }, 2000);
      }, 5000);
    }, 1000);
  }

  get isSurgeActive() { return this._surgeActive; }

  // ─── TASK-312: Debuffs ───

  set onDebuffChange(fn) { this._onDebuffChange = fn; }
  get activeDebuff() { return this._activeDebuff; }
  get isJammed() { return this._activeDebuff?.type === 'weaponJam'; }
  get isReversed() { return this._activeDebuff?.type === 'reverseAim'; }

  activateDebuff() {
    if (this._activeDebuff || this._surgeActive) return null;

    const types = [
      { type: 'weaponJam', duration: 1500, label: 'JAMMED!', color: '#ff4444', icon: '🔧' },
      { type: 'fog', duration: 3000, label: 'FOG!', color: '#8888aa', icon: '🌫️' },
      { type: 'reverseAim', duration: 2000, label: 'REVERSED!', color: '#ff00ff', icon: '🔄' },
    ];
    const debuff = types[Math.floor(Math.random() * types.length)];
    this._activeDebuff = { ...debuff, startTime: Date.now() };
    this._onDebuffChange?.(this._activeDebuff);

    // Fog overlay
    if (debuff.type === 'fog' && this._debuffOverlay) {
      this._debuffOverlay.classList.add('debuff-fog-active');
    }

    audioManager.playMiss?.();
    window.__hapticManager?.pulse?.(1.0, 200);

    this._debuffTimer = setTimeout(() => {
      if (this._activeDebuff?.type === 'fog' && this._debuffOverlay) {
        this._debuffOverlay.classList.remove('debuff-fog-active');
      }
      this._activeDebuff = null;
      this._onDebuffChange?.(null);
    }, debuff.duration);

    return debuff;
  }

  // ─── TASK-313: Arena Walls ───

  _ensureArenaWalls(sceneEl) {
    if (!sceneEl) return;
    // Remove old walls
    this._arenaWalls.forEach(w => { if (w.el?.parentNode) w.el.parentNode.removeChild(w.el); });
    this._arenaWalls = [];

    const baseDistance = 14;
    const wallHeight = 8;
    const wallWidth = 30;
    const directions = [
      { id: 'front', pos: `0 ${wallHeight / 2} -${baseDistance}`, rot: '0 0 0' },
      { id: 'back', pos: `0 ${wallHeight / 2} ${baseDistance}`, rot: '0 180 0' },
      { id: 'left', pos: `-${baseDistance} ${wallHeight / 2} 0`, rot: '0 90 0' },
      { id: 'right', pos: `${baseDistance} ${wallHeight / 2} 0`, rot: '0 -90 0' },
    ];

    directions.forEach(d => {
      const el = document.createElement('a-plane');
      el.setAttribute('width', String(wallWidth));
      el.setAttribute('height', String(wallHeight));
      el.setAttribute('position', d.pos);
      el.setAttribute('rotation', d.rot);
      el.setAttribute('material', 'shader: flat; color: #00ffff; opacity: 0; transparent: true; wireframe: true');
      el.setAttribute('class', 'arena-wall');
      el.setAttribute('visible', 'false');
      sceneEl.appendChild(el);
      this._arenaWalls.push({ el, dir: d.id, baseDistance });
    });
  }

  /**
   * Called each wave. Shrinks arena every 3 waves.
   * Returns current spawn radius multiplier.
   */
  updateArenaForWave(wave) {
    if (!this._running) return 1.0;

    // Shrink every 3 waves
    if (wave > 0 && wave % 3 === 0 && this._arenaScale > 0.5) {
      this._arenaScale = Math.max(0.5, this._arenaScale - 0.1);
      this._animateWalls();
    }

    // Random arena reset (10% chance, wave 6+)
    if (wave >= 6 && !this._arenaResetUsed && this._arenaScale < 1.0 && Math.random() < 0.1) {
      this._arenaResetUsed = true;
      this._arenaScale = 1.0;
      this._animateWalls();
      document.dispatchEvent(new CustomEvent('arena-reset'));
    }

    return this._arenaScale;
  }

  get arenaScale() { return this._arenaScale; }

  _animateWalls() {
    const visible = this._arenaScale < 1.0;
    this._arenaWalls.forEach(w => {
      const dist = w.baseDistance * this._arenaScale;
      let newPos;
      switch (w.dir) {
        case 'front': newPos = `0 4 -${dist}`; break;
        case 'back': newPos = `0 4 ${dist}`; break;
        case 'left': newPos = `-${dist} 4 0`; break;
        case 'right': newPos = `${dist} 4 0`; break;
      }
      w.el.setAttribute('visible', String(visible));
      const opacity = visible ? Math.max(0.03, (1 - this._arenaScale) * 0.15) : 0;
      const wallColor = this._arenaScale <= 0.6 ? '#ff4444' : '#00ffff';
      w.el.setAttribute('material', `shader: flat; color: ${wallColor}; opacity: ${opacity}; transparent: true; wireframe: true`);
      w.el.setAttribute('animation__move', {
        property: 'position', to: newPos,
        dur: 2000, easing: 'easeInOutQuad',
      });
    });
  }

  // ─── V30 TASK-403: Hitstop Integration ───

  /**
   * Check if hitstop is enabled in settings.
   */
  _isHitstopEnabled() {
    const settings = getSettings();
    return settings.hitstop !== false && window.Hitstop;
  }

  /**
   * Trigger hitstop for boss kills (80ms freeze + zoom).
   */
  triggerBossKillHitstop() {
    if (!this._isHitstopEnabled()) return;
    window.Hitstop.heavy();
  }

  /**
   * Trigger hitstop for bomb explosions (50ms freeze).
   */
  triggerExplosionHitstop() {
    if (!this._isHitstopEnabled()) return;
    window.Hitstop.medium();
  }

  /**
   * Trigger hitstop for railgun/heavy weapon hits (30ms light freeze).
   */
  triggerHeavyHitHitstop() {
    if (!this._isHitstopEnabled()) return;
    window.Hitstop.light();
  }

  /**
   * Trigger hitstop for combo milestones (120ms slow-mo with zoom).
   * @param {number} combo - Current combo count
   */
  triggerComboMilestoneHitstop(combo) {
    if (!this._isHitstopEnabled()) return;
    // Trigger on combo 50, 100, 150, etc.
    if (combo > 0 && combo % 50 === 0) {
      window.Hitstop.critical();
    }
  }
}

const tensionSystem = new TensionSystem();
export default tensionSystem;
