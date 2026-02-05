/**
 * Target specials — melee/punch, rhythm, color-match, blink targets.
 * Extracted from target-system.js (V27 refactor, TASK-372).
 * Uses composition: receives parent TargetSystem reference via constructor.
 */
import audioManager from '../core/audio-manager.js';
import { getSettings, remapColor } from './settings-util.js';

// V42: Quest detection - skip torus decorations
const _isQuestTS = typeof window !== 'undefined' &&
  (window.__isQuestDevice || /Quest|Android|Mobile/i.test(navigator.userAgent));

// TASK-301: Color-match colors
const COLOR_MATCH_COLORS = [
  { id: 'red', color: '#ff4444', emoji: '🔴', shape: 'a-icosahedron' },
  { id: 'blue', color: '#4488ff', emoji: '🔵', shape: 'a-octahedron' },
  { id: 'green', color: '#44ff44', emoji: '🟢', shape: 'a-dodecahedron' },
];

export default class TargetSpecials {
  constructor(ts) {
    /** @type {import('./target-system.js').default} */
    this._ts = ts;
  }

  // ===================== Timers =====================

  /** Called from TargetSystem.start() to init all special target timers */
  startTimers() {
    const ts = this._ts;

    // Punch target detection tick (TASK-256)
    ts._lastControllerPos = { right: null, left: null };
    ts._controllerVelocity = { right: 0, left: 0 };
    ts._punchTick = setInterval(() => this._updatePunchDetection(), 30);

    // Rhythm beat tick (TASK-257)
    ts._rhythmMode = false;
    ts._lastBeatTime = Date.now();
    ts._beatTimer = setInterval(() => this._updateRhythmBeat(), 50);

    // TASK-301: Color-match system (active from wave 3+)
    ts._colorMatchActive = false;
    ts._colorMatchRequired = null;
    if (ts._colorMatchTimer) clearInterval(ts._colorMatchTimer);
    ts._colorMatchTimer = setInterval(() => this._updateColorMatch(), 1000);

    // TASK-303: Blink target tick
    if (ts._blinkTick) clearInterval(ts._blinkTick);
    ts._blinkTick = setInterval(() => this._updateBlinkTargets(), 100);
  }

  /** Called from TargetSystem.stop() to cleanup all special target timers */
  stopTimers() {
    const ts = this._ts;

    // Cleanup punch detection (TASK-256)
    if (ts._punchTick) { clearInterval(ts._punchTick); ts._punchTick = null; }

    // Cleanup rhythm (TASK-257)
    if (ts._beatTimer) { clearInterval(ts._beatTimer); ts._beatTimer = null; }
    ts._rhythmMode = false;

    // Cleanup color-match (TASK-301)
    if (ts._colorMatchTimer) { clearInterval(ts._colorMatchTimer); ts._colorMatchTimer = null; }
    ts._colorMatchActive = false;

    // Cleanup blink tick (TASK-303)
    if (ts._blinkTick) { clearInterval(ts._blinkTick); ts._blinkTick = null; }
  }

  // ===================== Melee/Punch Targets (TASK-256) =====================

  spawnMeleeTarget() {
    const ts = this._ts;
    const cam = document.getElementById('camera');
    if (!cam) return;
    const camPos = new THREE.Vector3();
    cam.object3D.getWorldPosition(camPos);
    const camDir = new THREE.Vector3();
    cam.object3D.getWorldDirection(camDir);

    // Spawn 1.0-1.5m in front of player
    const dist = 1.0 + Math.random() * 0.5;
    const angleOffset = (Math.random() - 0.5) * 0.8; // ±~23° spread
    const spawnDir = camDir.clone();
    spawnDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), angleOffset);

    const x = camPos.x + spawnDir.x * dist;
    const y = camPos.y + (Math.random() - 0.5) * 0.4; // near head height
    const z = camPos.z + spawnDir.z * dist;

    const scene = ts._container.sceneEl || ts._container.closest('a-scene');
    if (!scene) return;

    const el = document.createElement('a-entity');
    el.setAttribute('class', 'target');
    el.setAttribute('geometry', 'primitive: icosahedron; radius: 0.45');
    el.setAttribute('material', 'color: #ff8800; metalness: 0.8; roughness: 0.2; emissive: #ff6600; emissiveIntensity: 0.8');
    el.setAttribute('position', `${x} ${y} ${z}`);
    el.setAttribute('shadow', 'cast: true; receive: false');
    el.setAttribute('animation__spawn', {
      property: 'scale', from: '0 0 0', to: '1.5 1.5 1.5',
      dur: 300, easing: 'easeOutElastic',
    });
    el.setAttribute('animation__pulse', {
      property: 'material.emissiveIntensity', from: 0.5, to: 1.2,
      dur: 400, loop: true, dir: 'alternate', easing: 'easeInOutSine',
    });

    // Orange energy ring (V42: Skip on Quest)
    if (!_isQuestTS) {
      const ring = document.createElement('a-torus');
      ring.setAttribute('radius', '0.55');
      ring.setAttribute('radius-tubular', '0.02');
      ring.setAttribute('material', 'shader: flat; color: #ff8800; opacity: 0.5; transparent: true');
      ring.setAttribute('animation__spin', { property: 'rotation', to: '0 360 0', dur: 600, loop: true, easing: 'linear' });
      el.appendChild(ring);

      // Second ring perpendicular
      const ring2 = document.createElement('a-torus');
      ring2.setAttribute('radius', '0.5');
      ring2.setAttribute('radius-tubular', '0.015');
      ring2.setAttribute('rotation', '90 0 0');
      ring2.setAttribute('material', 'shader: flat; color: #ffaa44; opacity: 0.3; transparent: true');
      ring2.setAttribute('animation__spin', { property: 'rotation', from: '90 0 0', to: '90 360 0', dur: 800, loop: true, easing: 'linear' });
      el.appendChild(ring2);
    }

    el.setAttribute('target-hit', 'hp: 1; targetType: standard');
    el._targetType = 'standard';
    el._targetPoints = 20; // 2× base
    el._targetCoins = 0;
    el._isMelee = true;

    el.addEventListener('destroyed', (evt) => {
      // Melee targets ignore raycaster hits — this only fires from punch
      const damage = evt?.detail?.damage || 1;
      const hitPos = evt?.detail?.position || null;
      ts._onTargetHit(el, damage, hitPos);
    });

    const lifetime = 4000;
    const expireTimeout = setTimeout(() => {
      if (ts._targets.has(el)) ts._removeTarget(el, true);
    }, lifetime);
    el._expireTimeout = expireTimeout;

    ts._container.appendChild(el);
    ts._targets.add(el);
    audioManager.playSpawn({ x, y, z });
  }

  _updatePunchDetection() {
    const ts = this._ts;
    if (!ts._running) return;
    const dt = 0.03;

    // Track both controllers
    ['right', 'left'].forEach(hand => {
      const handEl = document.getElementById(`${hand}-hand`);
      if (!handEl?.object3D) return;

      const pos = new THREE.Vector3();
      handEl.object3D.getWorldPosition(pos);
      const prev = ts._lastControllerPos[hand];

      if (prev) {
        const velocity = pos.distanceTo(prev) / dt;
        ts._controllerVelocity[hand] = velocity;

        // Check for punch hit on melee targets
        if (velocity > 2.0) {
          ts._targets.forEach(el => {
            if (!el._isMelee || !el.parentNode || !el.object3D) return;
            const tPos = el.object3D.getWorldPosition(new THREE.Vector3());
            if (pos.distanceTo(tPos) < 0.5) {
              // Punch hit!
              this._onPunchHit(el, pos, hand);
            }
          });
        }
      }

      ts._lastControllerPos[hand] = pos.clone();
    });
  }

  _onPunchHit(el, hitPos, hand) {
    const ts = this._ts;
    const pos = { x: hitPos.x, y: hitPos.y, z: hitPos.z };
    audioManager.playPunchImpact(pos);
    window.__hapticManager?.pulse(0.9, 120);

    // Shatter particles
    const scene = ts._container.sceneEl || ts._container.closest('a-scene');
    if (scene) {
      for (let i = 0; i < 8; i++) {
        const s = document.createElement('a-icosahedron');
        s.setAttribute('radius', '0.02');
        s.setAttribute('material', 'shader: flat; color: #ff8800; opacity: 0.8');
        s.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
        const dx = (Math.random() - 0.5) * 2;
        const dy = (Math.random() - 0.5) * 2;
        const dz = (Math.random() - 0.5) * 2;
        s.setAttribute('animation__burst', {
          property: 'position', to: `${pos.x + dx} ${pos.y + dy} ${pos.z + dz}`,
          dur: 250, easing: 'easeOutQuad',
        });
        s.setAttribute('animation__fade', { property: 'material.opacity', from: 0.8, to: 0, dur: 300 });
        s.setAttribute('animation__spin', { property: 'rotation', to: `${Math.random()*360} ${Math.random()*360} 0`, dur: 300 });
        scene.appendChild(s);
        setTimeout(() => { if (s.parentNode) s.parentNode.removeChild(s); }, 350);
      }
    }

    // Camera shake
    document.dispatchEvent(new CustomEvent('camera-shake', { detail: { intensity: 0.02, duration: 100 } }));

    // Dispatch punch-hit event for score tracking
    document.dispatchEvent(new CustomEvent('punch-hit', { detail: { pos, points: 20 } }));

    // Trigger target destruction
    el.dispatchEvent(new CustomEvent('destroyed', { detail: { damage: 1, position: pos } }));
    if (el.parentNode) el.parentNode.removeChild(el);
  }

  // ===================== Rhythm Targets (TASK-257) =====================

  _updateRhythmBeat() {
    const ts = this._ts;
    if (!ts._running) return;

    // Activate rhythm mode at combo ≥ 10
    const shouldBeRhythm = ts._combo >= 10;
    if (shouldBeRhythm !== ts._rhythmMode) {
      ts._rhythmMode = shouldBeRhythm;
    }

    if (!ts._rhythmMode) return;

    // BPM scales with music intensity
    ts._bpm = ts._combo >= 15 ? 140 : 120;
    const beatDuration = 60000 / ts._bpm;
    const now = Date.now();

    if (now - ts._lastBeatTime >= beatDuration) {
      ts._lastBeatTime = now;
      ts._beatPhase = 0;
      document.dispatchEvent(new CustomEvent('music-beat'));
    } else {
      ts._beatPhase = (now - ts._lastBeatTime) / beatDuration;
    }
  }

  // ===================== Color-Match Targets (TASK-301) =====================

  _updateColorMatch() {
    const ts = this._ts;
    if (!ts._running || ts._bossMode || ts._reflexMode) return;
    if (ts._wave < 3) return;

    // Activate color-match system
    if (!ts._colorMatchActive) {
      ts._colorMatchActive = true;
      this._rotateColorMatch();
    }
  }

  _rotateColorMatch() {
    const ts = this._ts;
    if (!ts._running || !ts._colorMatchActive) return;
    const pick = COLOR_MATCH_COLORS[Math.floor(Math.random() * COLOR_MATCH_COLORS.length)];
    ts._colorMatchRequired = pick.id;
    // Update HUD
    document.dispatchEvent(new CustomEvent('color-match-change', {
      detail: { id: pick.id, emoji: pick.emoji, color: pick.color },
    }));
    // Rotate every 5-8s
    const delay = 5000 + Math.random() * 3000;
    setTimeout(() => { if (ts._running && ts._colorMatchActive) this._rotateColorMatch(); }, delay);
  }

  spawnColorMatchTarget() {
    const ts = this._ts;
    const pick = COLOR_MATCH_COLORS[Math.floor(Math.random() * COLOR_MATCH_COLORS.length)];
    const spawnPos = ts._pick360Position();

    ts._spawnTelegraph(spawnPos, 'standard');
    setTimeout(() => {
      if (!ts._running) return;

      const settings = getSettings();
      const el = document.createElement('a-entity');
      el.setAttribute('class', 'target');
      const geoPrimitive = pick.shape.replace('a-', '');
      el.setAttribute('geometry', `primitive: ${geoPrimitive}; radius: 0.3`);
      const color = remapColor(pick.color, settings);
      el.setAttribute('material', `color: ${color}; metalness: 0.7; roughness: 0.2; emissive: ${color}; emissiveIntensity: 0.6`);
      el.setAttribute('position', `${spawnPos.x} ${spawnPos.y} ${spawnPos.z}`);
      el.setAttribute('shadow', 'cast: true; receive: false');
      el.setAttribute('target-hit', 'hp: 1; targetType: standard');
      el.setAttribute('animation__spawn', { property: 'scale', from: '0 0 0', to: '1 1 1', dur: 300, easing: 'easeOutElastic' });

      // Pulsing glow ring (V42: Skip on Quest)
      if (!_isQuestTS) {
        const ring = document.createElement('a-torus');
        ring.setAttribute('radius', '0.4');
        ring.setAttribute('radius-tubular', '0.015');
        ring.setAttribute('material', `shader: flat; color: ${color}; opacity: 0.4; transparent: true`);
        ring.setAttribute('animation__pulse', {
          property: 'material.opacity', from: 0.2, to: 0.6,
          dur: 500, loop: true, dir: 'alternate', easing: 'easeInOutSine',
        });
        el.appendChild(ring);
      }

      el._targetType = 'standard';
      el._targetPoints = 30;
      el._targetCoins = 0;
      el._colorMatchColor = pick.id;
      el._spawnReadyTime = Date.now();

      el.addEventListener('destroyed', (evt) => {
        const damage = evt?.detail?.damage || 1;
        const hitPos = evt?.detail?.position || null;
        ts._onTargetHit(el, damage, hitPos);
      });

      const lifetime = ts._getEffectiveLifetime();
      el._expireTimeout = setTimeout(() => {
        if (ts._targets.has(el)) ts._removeTarget(el, true);
      }, lifetime);

      ts._container.appendChild(el);
      ts._targets.add(el);
      audioManager.playSpawn(spawnPos);
    }, 500);
  }

  // ===================== Blink Targets (TASK-303) =====================

  _updateBlinkTargets() {
    const ts = this._ts;
    if (!ts._running) return;
    const now = Date.now();
    ts._targets.forEach(el => {
      if (el._targetType !== 'blink') return;
      if (now - el._lastBlinkTime >= el._blinkInterval) {
        el._blinkVisible = !el._blinkVisible;
        el._lastBlinkTime = now;
        if (el._blinkVisible) {
          el.setAttribute('material', 'opacity', 1.0);
          el.setAttribute('material', 'emissiveIntensity', 0.8);
          // Remove wireframe overlay if exists
          const wire = el.querySelector('[data-blink-wire]');
          if (wire) wire.setAttribute('visible', 'false');
        } else {
          el.setAttribute('material', 'opacity', 0.2);
          el.setAttribute('material', 'emissiveIntensity', 0.1);
          // Show wireframe overlay for ghost state
          let wire = el.querySelector('[data-blink-wire]');
          if (!wire) {
            wire = document.createElement('a-sphere');
            wire.setAttribute('radius', '0.32');
            wire.setAttribute('material', 'color: #ff00ff; wireframe: true; opacity: 0.3; transparent: true');
            wire.setAttribute('data-blink-wire', '');
            el.appendChild(wire);
          }
          wire.setAttribute('visible', 'true');
        }
      }
    });
  }
}
