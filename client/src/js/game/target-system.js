import scoreManager from './score-manager.js';
import audioManager from '../core/audio-manager.js';
import authManager from '../core/auth-manager.js';
import powerUpManager from './power-up-manager.js';
import tensionSystem from './tension-system.js';
import TargetHazards from './target-hazards.js';
import TargetSpecials from './target-specials.js';
import TargetSpawner from './target-spawner.js';
import TargetFeedback from './target-feedback.js';

const BASE_POINTS = 10;

class TargetSystem {
  constructor(containerEl, config = {}) {
    this._container = containerEl;
    this._targets = new Set();
    this._spawnTimer = null;
    this._running = false;
    this._combo = 0;
    this._comboTimer = null;
    this._onComboChange = null;
    this._onMiss = null;
    this._targetsHit = 0;
    this._bestCombo = 0;

    // Configurable per game mode
    this._spawnInterval = config.spawnInterval || 1500;
    this._maxTargets = config.maxTargets || 8;
    this._targetLifetime = config.targetLifetime || 5000;
    this._bossMode = config.bossMode || false;
    this._challengeMods = config.challengeModifiers || {};
    this._wave = 0;
    this._coinsEarned = 0;
    this._slowMoActive = false;
    this._slowMoTimeout = null;

    // Boss mode tracking
    this._bossWave = 0;
    this._bossWaveKills = 0;
    this._bossSpawnPaused = false;
    this._currentBoss = null;
    this._currentBossHp = 0;
    this._currentBossMaxHp = 0;

    // Spatial audio hums for targets (max 8 concurrent)
    this._targetHums = new Map();
    this._humTick = null;

    // Projectile system (TASK-250)
    this._projectiles = new Set();
    this._projectileTick = null;
    this._lastProjectileTime = 0;

    // Charger targets (TASK-251)
    this._chargerTimer = null;
    this._chargerTick = null;
    this._chargers = new Set();

    // Danger zones (TASK-253)
    this._dangerZones = new Set();
    this._dangerZoneTimer = null;
    this._dangerZoneTick = null;
    this._lastDangerZoneTime = 0;

    // Callback for damage events
    this._onPlayerDamage = null;

    // Scare balls (TASK-255)
    this._scareBalls = new Set();
    this._scareBallTimer = null;
    this._scareBallTick = null;
    this._lastScareBallTime = 0;

    // Punch targets (TASK-256)
    this._punchTick = null;
    this._lastControllerPos = { right: null, left: null };
    this._controllerVelocity = { right: 0, left: 0 };

    // Rhythm targets (TASK-257)
    this._rhythmMode = false;
    this._beatPhase = 0;
    this._beatTimer = null;
    this._lastBeatTime = 0;
    this._bpm = 120;

    // TASK-290: Multiplier zones
    this._multiplierZones = new Set();
    this._lastZoneSpawnTime = 0;

    // Laser sweeps (TASK-258)
    this._laserSweeps = new Set();
    this._laserSweepTimer = null;
    this._laserSweepTick = null;
    this._lastLaserSweepTime = 0;

    // TASK-300: Reaction time tracking
    this._reactionTimes = [];

    // TASK-301: Color-match system
    this._colorMatchActive = false;
    this._colorMatchRequired = null;
    this._colorMatchTimer = null;

    // TASK-302: Reflex Rush mode
    this._reflexMode = false;
    this._reflexLifetime = 2000;
    this._reflexHitsCount = 0;

    // TASK-303: Blink target tick
    this._blinkTick = null;

    // TASK-304: Peripheral vision tracker
    this._peripheralHits = 0;

    // TASK-351: Bomb targets
    this._bombActive = false;
    this._bombSpawnCounter = 0;
    this._bombSpawnThreshold = 8 + Math.floor(Math.random() * 5); // 8-12

    // TASK-352: Chain targets
    this._chainTargets = [];
    this._chainNextIndex = 0;
    this._chainActive = false;
    this._lastChainTime = 0;

    // V27: Hazard subsystem (projectiles, chargers, danger zones, scare balls, lasers)
    this._hazards = new TargetHazards(this);

    // V27: Special targets (melee/punch, rhythm, color-match, blink)
    this._specials = new TargetSpecials(this);

    // V27: Spawner (target creation, telegraph, movement patterns, positioning)
    this._spawner = new TargetSpawner(this);

    // V27: Feedback (combo lost, wave events, slow-mo, damage numbers, screen flash, multiplier zones)
    this._feedback = new TargetFeedback(this);
  }

  set onComboChange(fn) { this._onComboChange = fn; }
  set onMiss(fn) { this._onMiss = fn; }
  set onPlayerDamage(fn) { this._onPlayerDamage = fn; }

  // TASK-291: Allow dynamic spawn rate changes
  setSpawnRate(intervalMs) {
    this._spawnInterval = intervalMs;
    if (this._spawnTimer) {
      clearInterval(this._spawnTimer);
      this._spawnTimer = setInterval(() => this._trySpawn(), intervalMs);
    }
  }
  get targetsHit() { return this._targetsHit; }
  get bestCombo() { return this._bestCombo; }

  get coinsEarned() { return this._coinsEarned; }
  get reactionTimes() { return this._reactionTimes; }
  get peripheralHits() { return this._peripheralHits; }
  get avgReactionTime() {
    if (this._reactionTimes.length === 0) return 0;
    return Math.round(this._reactionTimes.reduce((a, b) => a + b, 0) / this._reactionTimes.length);
  }
  get bestReactionTime() {
    if (this._reactionTimes.length === 0) return 0;
    return Math.min(...this._reactionTimes);
  }

  configure(config) {
    this._spawnInterval = config.spawnInterval || this._spawnInterval;
    this._maxTargets = config.maxTargets || this._maxTargets;
    this._targetLifetime = config.targetLifetime || this._targetLifetime;
    this._bossMode = config.bossMode || false;
    this._challengeMods = config.challengeModifiers || {};
    this._reflexMode = config.reflexMode || false;
    this._wave = 0;
    this._coinsEarned = 0;
  }

  start() {
    this._running = true;
    this._combo = 0;
    this._targetsHit = 0;
    this._bestCombo = 0;
    this._coinsEarned = 0;
    this._wave = 0;
    this._bossWave = 0;
    this._bossWaveKills = 0;
    this._bossSpawnPaused = false;
    this._currentBoss = null;
    this._clearAll();
    this._spawnTimer = setInterval(() => this._trySpawn(), this._spawnInterval);
    // Stagger initial spawns slightly for telegraph effect
    for (let i = 0; i < 3; i++) {
      setTimeout(() => { if (this._running) this._spawner.spawnTarget(); }, i * 200);
    }
    // Spatial audio tick: update target hum positions + urgency volume
    this._humTick = setInterval(() => this._updateHums(), 200);

    // V27: Hazard timers (projectiles, chargers, danger zones, scare balls, lasers)
    this._hazards.startTimers();

    // V27: Special target timers (punch, rhythm, color-match, blink)
    this._specials.startTimers();

    // TASK-300: Reaction time tracking
    this._reactionTimes = [];

    // TASK-302: Reflex Rush mode
    this._reflexLifetime = 2000;
    this._reflexHitsCount = 0;

    // TASK-304: Peripheral hits tracking
    this._peripheralHits = 0;
  }

  stop() {
    this._running = false;
    if (this._spawnTimer) {
      clearInterval(this._spawnTimer);
      this._spawnTimer = null;
    }
    if (this._humTick) {
      clearInterval(this._humTick);
      this._humTick = null;
    }
    if (this._slowMoTimeout) {
      clearTimeout(this._slowMoTimeout);
      this._slowMoTimeout = null;
      this._slowMoActive = false;
    }
    // Stop all target hums
    this._targetHums.forEach(h => h.stop());
    this._targetHums.clear();

    // V27: Cleanup all hazards
    this._hazards.stopTimers();

    // V27: Cleanup all special targets
    this._specials.stopTimers();

    // Cleanup multiplier zones (TASK-290)
    this._multiplierZones.forEach(z => { if (z.el?.parentNode) z.el.parentNode.removeChild(z.el); });
    this._multiplierZones.clear();

    // TASK-351: Reset bomb state
    this._bombActive = false;
    this._bombSpawnCounter = 0;
    // TASK-352: Reset chain state
    this._chainTargets = [];
    this._chainNextIndex = 0;
    this._chainActive = false;

    this._clearAll();
  }

  _trySpawn() {
    if (!this._running || this._bossSpawnPaused) return;

    // TASK-302: Reflex Rush — only 1 target at a time
    if (this._reflexMode) {
      if (this._targets.size >= 1) return;
      this._spawner.spawnTarget();
      return;
    }

    // Progressive difficulty: scale with wave count
    const waveScale = Math.min(this._wave / 50, 1); // 0→1 over 50 waves
    const effectiveMax = this._maxTargets + Math.floor(waveScale * 4); // up to +4 targets
    if (this._targets.size >= effectiveMax) return;

    this._spawner.spawnTarget();
  }

  _onTargetHit(el, damage = 1, hitPos = null) {
    if (!this._running) return;

    const basePoints = el._targetPoints !== undefined ? el._targetPoints : BASE_POINTS;
    const isDecoy = el._targetType === 'decoy';
    const pos = hitPos || { x: 0, y: 2, z: -5 };

    // TASK-312: Debuff target — activate debuff on hit
    if (el._targetType === 'debuff') {
      const debuff = tensionSystem.activateDebuff();
      if (debuff) {
        this._feedback.spawnDamageNumber(pos, 0, debuff.color, ` ${debuff.icon} ${debuff.label}`);
        this._feedback.flashScreen('miss');
      }
      this._removeTarget(el, false);
      return;
    }

    // TASK-303: Blink target — if ghost state, penalize
    if (el._targetType === 'blink' && !el._blinkVisible) {
      scoreManager.add(-10);
      // TASK-367: Combo lost feedback
      const prevCombo = this._combo;
      this._combo = 0;
      this._onComboChange?.(0);
      if (prevCombo >= 10) this._feedback.triggerComboLost(prevCombo, pos);
      audioManager.playMiss();
      this._feedback.spawnDamageNumber(pos, -10, '#ff4444', ' GHOST!');
      this._feedback.flashScreen('miss');
      this._removeTarget(el, false);
      return;
    }

    // TASK-301: Color-match wrong color — penalize
    if (el._colorMatchColor && this._colorMatchRequired && el._colorMatchColor !== this._colorMatchRequired) {
      scoreManager.add(-15);
      // TASK-367: Combo lost feedback
      const prevCombo = this._combo;
      this._combo = 0;
      this._onComboChange?.(0);
      if (prevCombo >= 10) this._feedback.triggerComboLost(prevCombo, pos);
      audioManager.playMiss();
      window.__hapticManager?.miss?.();
      this._feedback.spawnDamageNumber(pos, -15, '#ff4444', ' WRONG!');
      this._feedback.flashScreen('miss');
      this._removeTarget(el, false);
      return;
    }

    // TASK-351: Bomb defuse — rewarding hit
    if (el._targetType === 'bomb') {
      this._bombActive = false;
      if (el._bombTickTimer) clearInterval(el._bombTickTimer);
      scoreManager.add(40);
      this._combo++;
      this._targetsHit++;
      this._wave++;
      if (this._combo > this._bestCombo) this._bestCombo = this._combo;
      if (this._comboTimer) clearTimeout(this._comboTimer);
      this._comboTimer = setTimeout(() => {
        const prevCombo = this._combo;
        this._combo = 0;
        this._onComboChange?.(0);
        if (prevCombo >= 10) this._feedback.triggerComboLost(prevCombo);
      }, 2000);
      this._onComboChange?.(this._combo);
      audioManager.playBombDefuse();
      window.__hapticManager?.hit();
      this._feedback.spawnDamageNumber(pos, 40, '#44ff44', ' DEFUSED!');
      this._feedback.flashScreen('hit');
      document.dispatchEvent(new CustomEvent('crosshair-hit'));
      // Check chain explosion: if decoy was hit near a bomb, explode bomb
      this._targets.delete(el);
      if (el._expireTimeout) clearTimeout(el._expireTimeout);
      if (el.parentNode) el.parentNode.removeChild(el);
      return;
    }

    // TASK-351: Chain explosion — hitting decoy near active bomb triggers bomb
    if (isDecoy) {
      for (const t of this._targets) {
        if (t._targetType === 'bomb' && t.object3D) {
          const bp = t.object3D.position;
          const dp = el.object3D ? el.object3D.position : pos;
          const dx = bp.x - dp.x, dy = bp.y - dp.y, dz = bp.z - dp.z;
          if (Math.sqrt(dx * dx + dy * dy + dz * dz) < 2) {
            // Trigger bomb explosion early
            this._removeTarget(t, true);
            break;
          }
        }
      }
    }

    // TASK-300: Track reaction time
    let reactionTime = 0;
    if (el._spawnReadyTime) {
      reactionTime = Date.now() - el._spawnReadyTime;
      this._reactionTimes.push(reactionTime);
      document.dispatchEvent(new CustomEvent('reaction-time', { detail: { ms: reactionTime, avg: this.avgReactionTime } }));
    }

    if (isDecoy) {
      scoreManager.add(basePoints); // negative points
      // TASK-367: Combo lost feedback
      const prevCombo = this._combo;
      this._combo = 0;
      this._onComboChange?.(0);
      if (prevCombo >= 10) this._feedback.triggerComboLost(prevCombo, pos);
      audioManager.playMiss();
      document.dispatchEvent(new CustomEvent('crosshair-miss'));
      this._feedback.spawnDamageNumber(pos, basePoints, '#ff4444', '');
      this._feedback.flashScreen('miss');
    } else {
      this._combo++;
      this._targetsHit++;
      this._wave++;
      // TASK-288: Check for wave event every 4-6 waves
      if (this._wave >= 4 && this._wave % 5 === 0 && Math.random() < 0.4) {
        this._feedback.triggerWaveEvent();
      }
      if (this._combo > this._bestCombo) this._bestCombo = this._combo;

      if (this._comboTimer) clearTimeout(this._comboTimer);
      this._comboTimer = setTimeout(() => {
        // TASK-367: Combo lost feedback on timeout
        const prevCombo = this._combo;
        this._combo = 0;
        this._onComboChange?.(0);
        if (prevCombo >= 10) this._feedback.triggerComboLost(prevCombo);
      }, 2000);

      const comboCap = this._challengeMods.comboCapOverride || 5;
      const comboMultiplier = Math.min(this._combo, comboCap);
      const powerUpMultiplier = powerUpManager.getMultiplier();

      // TASK-257: Rhythm timing bonus
      let rhythmMultiplier = 1;
      let rhythmGrade = '';
      if (el._rhythmTarget && el._beatSpawnTime) {
        const beatDuration = 60000 / this._bpm;
        const elapsed = Date.now() - el._beatSpawnTime;
        const beatError = Math.abs((elapsed / beatDuration) - 1);
        if (beatError < 0.1) {
          rhythmMultiplier = 3;
          rhythmGrade = 'PERFECT';
          audioManager.playRhythmPerfect(pos);
        } else if (beatError < 0.25) {
          rhythmMultiplier = 2;
          rhythmGrade = 'GOOD';
        } else {
          rhythmGrade = 'OK';
        }
      }

      // TASK-302: Reflex Rush speed bonus
      let reflexMultiplier = 1;
      let reflexLabel = '';
      if (this._reflexMode && reactionTime > 0) {
        if (reactionTime < 200) { reflexMultiplier = 3; reflexLabel = ' BLAZING!'; }
        else if (reactionTime < 400) { reflexMultiplier = 2; reflexLabel = ' FAST!'; }
        else if (reactionTime < 600) { reflexMultiplier = 1.5; reflexLabel = ' QUICK'; }
        // Decrease lifetime for next target
        this._reflexHitsCount++;
        this._reflexLifetime = Math.max(500, 2000 - this._reflexHitsCount * 50);
      }

      // TASK-304: Peripheral hit tracking
      if (el._targetType === 'peripheral') {
        this._peripheralHits++;
      }

      const zoneMul = this._feedback.getZoneMultiplier(pos);
      // TASK-311: Surge double points
      const surgeMul = tensionSystem.isSurgeActive ? 2 : 1;
      // TASK-353: Darkness wave double points
      const darknessMul = window.__darknessActive ? 2 : 1;
      const points = Math.round(basePoints * comboMultiplier * damage * powerUpMultiplier * rhythmMultiplier * zoneMul * reflexMultiplier * surgeMul * darknessMul);
      scoreManager.add(points);
      this._onComboChange?.(this._combo);

      audioManager.playHit(pos);
      window.__hapticManager?.hit();
      document.dispatchEvent(new CustomEvent('crosshair-hit'));
      if (this._combo >= 2) {
        audioManager.playCombo(this._combo);
        window.__hapticManager?.combo(this._combo);
      }

      // Slow-motion at combo 10+
      if (this._combo >= 10) {
        this._feedback.triggerSlowMotion();
      }

      // Power-up target: activate random power-up
      if (el._targetType === 'powerup') {
        const pu = powerUpManager.activateRandom();
        this._feedback.spawnDamageNumber(pos, 0, pu.config.color, pu.config.label);
        window.__hapticManager?.powerUp();
      }

      // Damage number with reaction time
      const comboText = comboMultiplier > 1 ? ` x${comboMultiplier}` : '';
      const puText = powerUpMultiplier > 1 ? ' 2X' : '';
      const rhythmText = rhythmGrade ? ` ${rhythmGrade}` : '';
      const rtText = reactionTime > 0 ? ` ${reactionTime}ms` : '';
      const rtColor = reactionTime > 0 ? (reactionTime < 200 ? '#44ff44' : reactionTime < 400 ? '#ffff00' : '#ff4444') : null;
      const color = rtColor || (reflexLabel ? '#00ffff' : rhythmGrade === 'PERFECT' ? '#ffff00' : el._targetType === 'bonus' ? '#ffd700' : el._targetType === 'powerup' ? '#00ffaa' : el._isMelee ? '#ff8800' : el._targetType === 'peripheral' ? '#ff8800' : comboMultiplier > 1 ? '#00d4ff' : '#ffffff');
      this._feedback.spawnDamageNumber(pos, points, color, comboText + puText + rhythmText + reflexLabel + rtText);
      this._feedback.flashScreen('hit');

      // Bonus coins
      if (el._targetCoins > 0) {
        this._coinsEarned += el._targetCoins;
        const profile = authManager.profile;
        if (profile) {
          authManager.saveProfile({ coins: (profile.coins || 0) + el._targetCoins });
        }
      }

      // Boss mode: track kills, wave clears, boss events
      if (this._bossMode) {
        if (el === this._currentBoss) {
          audioManager.playBossKill();
          window.__hapticManager?.bossKill();
          this._currentBoss = null;
          document.dispatchEvent(new CustomEvent('boss-killed'));
        }

        this._bossWaveKills++;
        if (this._bossWaveKills >= 5) {
          this._bossWaveKills = 0;
          this._bossWave++;
          audioManager.playWaveClear();
          document.dispatchEvent(new CustomEvent('boss-wave-clear', {
            detail: { wave: this._bossWave },
          }));

          // Dramatic pause between waves
          this._bossSpawnPaused = true;
          setTimeout(() => { this._bossSpawnPaused = false; }, 1500);
        }
      }
    }

    this._targets.delete(el);
    if (el._expireTimeout) clearTimeout(el._expireTimeout);
    // Stop spatial hum
    const hum = this._targetHums.get(el);
    if (hum) { hum.stop(); this._targetHums.delete(el); }
    // TASK-252: cleanup height indicator
    if (el._heightIndicator?.parentNode) el._heightIndicator.parentNode.removeChild(el._heightIndicator);

    // TASK-252: Height-zone streak tracking
    if (!isDecoy && (el._heightZone === 'floor' || el._heightZone === 'overhead')) {
      this._heightStreak = this._heightStreak || { zone: null, count: 0 };
      if (this._heightStreak.zone === el._heightZone) {
        this._heightStreak.count++;
      } else {
        this._heightStreak = { zone: el._heightZone, count: 1 };
      }
      if (this._heightStreak.count >= 3) {
        const label = el._heightZone === 'floor' ? 'FLOOR SWEEP!' : 'SKY SHOT!';
        const bonus = 15;
        scoreManager.add(bonus);
        this._feedback.spawnDamageNumber(pos, bonus, el._heightZone === 'floor' ? '#ff6600' : '#44aaff', ` ${label}`);
        document.dispatchEvent(new CustomEvent('combo-milestone', { detail: { combo: this._combo, label } }));
        this._heightStreak.count = 0;
      }
    } else {
      this._heightStreak = { zone: null, count: 0 };
    }
  }

  _updateHums() {
    this._targetHums.forEach((hum, el) => {
      if (!el.parentNode || !el.object3D) {
        hum.stop(); this._targetHums.delete(el); return;
      }
      const pos = el.object3D.position;
      const elapsed = Date.now() - (el._spawnTime || 0);
      const lifetime = el._lifetime || this._targetLifetime;
      const progress = Math.min(elapsed / lifetime, 1);
      // Volume ramps from 0.02 to 0.08 as target nears expiry
      const vol = 0.02 + progress * 0.06;
      hum.update({ x: pos.x, y: pos.y, z: pos.z }, vol);
    });

    // Magnet power-up: auto-hit targets within 3m of player
    if (powerUpManager.hasMagnet()) {
      const cam = document.getElementById('camera');
      if (cam) {
        const camPos = new THREE.Vector3();
        cam.object3D.getWorldPosition(camPos);
        for (const el of this._targets) {
          if (!el.object3D || el._targetType === 'decoy') continue;
          const tPos = el.object3D.position;
          const dist = camPos.distanceTo(tPos);
          if (dist < 3) {
            el.dispatchEvent(new CustomEvent('destroyed', { detail: { damage: 1, position: { x: tPos.x, y: tPos.y, z: tPos.z } } }));
            this._removeTarget(el);
          }
        }
      }
    }

    // Check if heavy/boss targets should fire projectiles (TASK-250)
    this._hazards.checkProjectileFiring();

    // TASK-290: Spawn multiplier zones periodically
    const now = Date.now();
    if (this._wave >= 3 && this._multiplierZones.size < 2 && now - this._lastZoneSpawnTime > 15000) {
      if (Math.random() < 0.3) this._feedback.spawnMultiplierZone();
      this._lastZoneSpawnTime = now;
    }
    // Expire old zones
    this._multiplierZones.forEach(z => {
      if (now - z.spawnTime > 8000) {
        z.el.setAttribute('animation__fadeOut', { property: 'material.opacity', to: 0, dur: 500 });
        setTimeout(() => { if (z.el.parentNode) z.el.parentNode.removeChild(z.el); }, 600);
        this._multiplierZones.delete(z);
      }
    });
  }

  _removeTarget(el, expired = false) {
    this._targets.delete(el);

    // V36 TASK-465: Remove from target cache for GC-free target-indicator.js
    if (window.__targetCache) {
      window.__targetCache.delete(el);
    }

    if (el._expireTimeout) clearTimeout(el._expireTimeout);
    if (el._teleportInterval) clearInterval(el._teleportInterval);
    if (el._bombTickTimer) clearInterval(el._bombTickTimer);
    const hum = this._targetHums.get(el);
    if (hum) { hum.stop(); this._targetHums.delete(el); }
    // TASK-252: cleanup height indicator
    if (el._heightIndicator?.parentNode) el._heightIndicator.parentNode.removeChild(el._heightIndicator);
    // TASK-287: cleanup orbit wrapper
    if (el._orbitWrapper?.parentNode) el._orbitWrapper.parentNode.removeChild(el._orbitWrapper);
    // TASK-351: Bomb cleanup
    if (el._targetType === 'bomb') this._bombActive = false;

    if (expired) {
      // TASK-351: Bomb explosion on expire
      if (el._targetType === 'bomb') {
        audioManager.playBombExplode();
        document.dispatchEvent(new CustomEvent('camera-shake', { detail: { intensity: 0.04, duration: 300 } }));
        this._onPlayerDamage?.('bomb');
        // TASK-363: Multi-layer explosion VFX — clone pos before entity removal
        const obj3d = el.object3D;
        const pos = obj3d ? { x: obj3d.position.x, y: obj3d.position.y, z: obj3d.position.z } : { x: 0, y: 2, z: -5 };
        const scene = this._container.sceneEl || this._container.closest('a-scene');
        if (scene && window.__spawnGPUBurst) {
          // Fire core burst
          window.__spawnGPUBurst(scene, pos, {
            preset: 'explosion', count: 40, color: '#ff4400', color2: '#ffaa00',
            size: 0.08, speed: 5, lifetime: 600, opacity: 0.9,
          });
          // Smoke layer (delayed)
          setTimeout(() => {
            window.__spawnGPUBurst(scene, pos, {
              preset: 'smoke', count: 15, color: '#444444', color2: '#222222',
              size: 0.12, speed: 1, lifetime: 800, opacity: 0.4,
            });
          }, 100);
          // Ground scorch mark
          const scorch = document.createElement('a-circle');
          scorch.setAttribute('radius', '0.6');
          scorch.setAttribute('position', `${pos.x} 0.02 ${pos.z}`);
          scorch.setAttribute('rotation', '-90 0 0');
          scorch.setAttribute('material', 'shader: flat; color: #111111; opacity: 0.5; transparent: true');
          scorch.setAttribute('shadow', 'cast: false; receive: false');
          scorch.setAttribute('animation__fade', { property: 'material.opacity', from: 0.5, to: 0, dur: 3000, easing: 'easeInQuad' });
          scene.appendChild(scorch);
          setTimeout(() => { if (scorch.parentNode) scorch.parentNode.removeChild(scorch); }, 3200);
          // Flash point light
          const fl = document.createElement('a-entity');
          fl.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
          fl.setAttribute('light', 'type: point; color: #ff6600; intensity: 3; distance: 8; decay: 2');
          fl.setAttribute('animation__dim', { property: 'light.intensity', from: 3, to: 0, dur: 300, easing: 'easeOutQuad' });
          scene.appendChild(fl);
          setTimeout(() => { if (fl.parentNode) fl.parentNode.removeChild(fl); }, 350);
        }
        if (el.parentNode) el.parentNode.removeChild(el);
        return;
      }

      // TASK-367: Combo lost feedback on target expire
      const prevCombo = this._combo;
      this._combo = 0;
      this._onComboChange?.(0);
      if (prevCombo >= 10) this._feedback.triggerComboLost(prevCombo);
      audioManager.playMiss();
      this._onMiss?.();

      el.setAttribute('animation__fade', {
        property: 'material.opacity', to: 0, dur: 200,
      });
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 250);
    } else {
      if (el.parentNode) el.parentNode.removeChild(el);
    }
  }

  _clearAll() {
    this._targets.forEach(el => {
      if (el._expireTimeout) clearTimeout(el._expireTimeout);
      if (el._bombTickTimer) clearInterval(el._bombTickTimer);
      if (el._teleportInterval) clearInterval(el._teleportInterval);
      if (el._orbitWrapper?.parentNode) el._orbitWrapper.parentNode.removeChild(el._orbitWrapper);
      if (el._heightIndicator?.parentNode) el._heightIndicator.parentNode.removeChild(el._heightIndicator);
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    this._targets.clear();
    this._targetHums.forEach(h => h.stop());
    this._targetHums.clear();
  }
}

export { TargetSystem };
export default TargetSystem;
