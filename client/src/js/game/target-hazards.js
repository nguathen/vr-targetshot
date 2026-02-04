/**
 * Target hazards — projectiles, chargers, danger zones, scare balls, laser sweeps.
 * Extracted from target-system.js (V27 refactor).
 * Uses composition: receives parent TargetSystem reference via constructor.
 */
import scoreManager from './score-manager.js';
import audioManager from '../core/audio-manager.js';

// V41 TASK-486: Cache Quest check to skip rapid animations
const _isQuest = typeof VRCore !== 'undefined' && VRCore.isQuest && VRCore.isQuest();

export default class TargetHazards {
  constructor(ts) {
    /** @type {import('./target-system.js').default} */
    this._ts = ts;

    // V37 TASK-472: Pre-allocate vectors for projectile collision (GC-free)
    this._projCamPos = new THREE.Vector3();
    this._projShieldPos = new THREE.Vector3();

    // V37 TASK-473: Pre-allocate vectors for scareball collision (GC-free)
    this._scareCamPos = new THREE.Vector3();
    this._scareToCam = new THREE.Vector3();

    // V37 TASK-474: Pre-allocate vectors for charger collision (GC-free)
    this._chargerCamPos = new THREE.Vector3();
    this._chargerDir = new THREE.Vector3();
    this._chargerTargetPos = new THREE.Vector3();

    // V37 TASK-475: Pre-allocate vectors for laser sweep collision (GC-free)
    this._laserCamPos = new THREE.Vector3();
    this._laserDir = new THREE.Vector3();

    // V46 TASK-501: Pre-allocate vectors for scare ball launch (GC-free)
    this._launchCamPos = new THREE.Vector3();
    this._launchDir = new THREE.Vector3();

    // V37 TASK-472-475: Cache element refs (avoid getElementById every 30-50ms)
    this._cameraEl = null;
    this._leftHandEl = null;
    this._playerRigEl = null;
  }

  // ===================== Timers =====================

  /** Called from TargetSystem.start() to init all hazard timers */
  startTimers() {
    const ts = this._ts;

    // V37 TASK-472-475: Cache element refs once (avoid 850+ getElementById/sec)
    this._cameraEl = document.getElementById('camera');
    this._leftHandEl = document.getElementById('left-hand');
    this._playerRigEl = document.getElementById('player-rig');

    // Projectile collision tick (TASK-250)
    ts._projectileTick = setInterval(() => this._updateProjectiles(), 50);
    ts._lastProjectileTime = Date.now();

    // Charger spawn timer (TASK-251)
    const chargerInterval = ts._bossMode ? 12000 : 18000;
    ts._chargerTimer = setInterval(() => this._trySpawnCharger(), chargerInterval);
    ts._chargerTick = setInterval(() => this._updateChargers(), 50);

    // Danger zone timer (TASK-253)
    ts._lastDangerZoneTime = Date.now();
    ts._dangerZoneTimer = setInterval(() => this._trySpawnDangerZone(), 1000);
    ts._dangerZoneTick = setInterval(() => this._updateDangerZones(), 500);

    // Scare ball timer (TASK-255)
    ts._lastScareBallTime = Date.now() + 10000; // grace period at start
    ts._scareBallTimer = setInterval(() => this._tryLaunchScareBall(), 1000);
    // V46 TASK-502: Increase tick interval 30ms→50ms (40% fewer updates)
    ts._scareBallTick = setInterval(() => this._updateScareBalls(), 50);

    // Laser sweep timer (TASK-258)
    ts._lastLaserSweepTime = Date.now() + 15000; // grace period
    ts._laserSweepTimer = setInterval(() => this._tryLaunchLaserSweep(), 1000);
    ts._laserSweepTick = setInterval(() => this._updateLaserSweeps(), 30);
  }

  /** Called from TargetSystem.stop() to cleanup all hazard timers + entities */
  stopTimers() {
    const ts = this._ts;

    // Cleanup projectiles (TASK-250)
    if (ts._projectileTick) { clearInterval(ts._projectileTick); ts._projectileTick = null; }
    ts._projectiles.forEach(p => { if (p.el?.parentNode) p.el.parentNode.removeChild(p.el); });
    ts._projectiles.clear();

    // Cleanup chargers (TASK-251)
    if (ts._chargerTimer) { clearInterval(ts._chargerTimer); ts._chargerTimer = null; }
    if (ts._chargerTick) { clearInterval(ts._chargerTick); ts._chargerTick = null; }
    ts._chargers.forEach(c => {
      if (c.hum) c.hum.stop();
      if (c.el?.parentNode) c.el.parentNode.removeChild(c.el);
    });
    ts._chargers.clear();

    // Cleanup danger zones (TASK-253)
    if (ts._dangerZoneTimer) { clearInterval(ts._dangerZoneTimer); ts._dangerZoneTimer = null; }
    if (ts._dangerZoneTick) { clearInterval(ts._dangerZoneTick); ts._dangerZoneTick = null; }
    ts._dangerZones.forEach(z => { if (z.el?.parentNode) z.el.parentNode.removeChild(z.el); });
    ts._dangerZones.clear();

    // Cleanup scare balls (TASK-255)
    if (ts._scareBallTimer) { clearInterval(ts._scareBallTimer); ts._scareBallTimer = null; }
    if (ts._scareBallTick) { clearInterval(ts._scareBallTick); ts._scareBallTick = null; }
    ts._scareBalls.forEach(b => { if (b.el?.parentNode) b.el.parentNode.removeChild(b.el); });
    ts._scareBalls.clear();

    // Cleanup laser sweeps (TASK-258)
    if (ts._laserSweepTimer) { clearInterval(ts._laserSweepTimer); ts._laserSweepTimer = null; }
    if (ts._laserSweepTick) { clearInterval(ts._laserSweepTick); ts._laserSweepTick = null; }
    ts._laserSweeps.forEach(s => { if (s.el?.parentNode) s.el.parentNode.removeChild(s.el); });
    ts._laserSweeps.clear();
  }

  // ===================== Projectiles (TASK-250) =====================

  _tryFireProjectile(targetEl) {
    const ts = this._ts;
    if (!ts._running) return;
    const now = Date.now();
    if (now - ts._lastProjectileTime < 3000) return;
    ts._lastProjectileTime = now;

    const scene = ts._container.sceneEl || ts._container.closest('a-scene');
    if (!scene) return;

    const tPos = targetEl.object3D.position;
    const pos = { x: tPos.x, y: tPos.y, z: tPos.z };

    audioManager.playProjectileCharge(pos);
    targetEl.setAttribute('animation__charge', {
      property: 'material.emissiveIntensity', from: 0.5, to: 2.0,
      dur: 700, easing: 'easeInQuad',
    });

    // Warning telegraph ring
    if (scene) {
      const ring = document.createElement('a-ring');
      ring.setAttribute('radius-inner', '0.01');
      ring.setAttribute('radius-outer', '0.05');
      ring.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
      ring.setAttribute('material', 'shader: flat; color: #ff2222; opacity: 0.8; transparent: true; side: double');
      ring.setAttribute('look-at', '[camera]');
      ring.setAttribute('animation__grow', {
        property: 'geometry.radiusOuter', from: 0.05, to: 0.5,
        dur: 700, easing: 'easeOutQuad',
      });
      ring.setAttribute('animation__fade', {
        property: 'material.opacity', from: 0.8, to: 0,
        dur: 700, easing: 'easeInQuad',
      });
      scene.appendChild(ring);
      setTimeout(() => { if (ring.parentNode) ring.parentNode.removeChild(ring); }, 750);
    }

    setTimeout(() => {
      if (!ts._running || !targetEl.parentNode) return;
      targetEl.removeAttribute('animation__charge');
      this._launchProjectile(pos);
    }, 800);
  }

  _launchProjectile(origin) {
    const ts = this._ts;
    const scene = ts._container.sceneEl || ts._container.closest('a-scene');
    if (!scene) return;

    const cam = document.getElementById('camera');
    if (!cam) return;
    const camPos = new THREE.Vector3();
    cam.object3D.getWorldPosition(camPos);

    const dir = new THREE.Vector3(camPos.x - origin.x, camPos.y - origin.y, camPos.z - origin.z).normalize();

    const el = document.createElement('a-sphere');
    el.setAttribute('radius', '0.15');
    el.setAttribute('position', `${origin.x} ${origin.y} ${origin.z}`);
    el.setAttribute('material', 'shader: flat; color: #ff2222; emissive: #ff0000; emissiveIntensity: 2; opacity: 0.9; transparent: true');
    // V43 TASK-488: Skip rapid pulse animation on Quest (200ms loop → static)
    if (!_isQuest) {
      el.setAttribute('animation__pulse', { property: 'material.emissiveIntensity', from: 1.5, to: 3, dur: 200, loop: true, dir: 'alternate' });
    }
    el.setAttribute('shadow', 'cast: false; receive: false');

    // V43 TASK-488: Skip spinning ring on Quest (300ms loop → omit entirely)
    if (!_isQuest) {
      const ring = document.createElement('a-ring');
      ring.setAttribute('radius-inner', '0.02');
      ring.setAttribute('radius-outer', '0.06');
      ring.setAttribute('material', 'shader: flat; color: #ff4400; opacity: 0.4; transparent: true');
      ring.setAttribute('animation__spin', { property: 'rotation', to: '0 0 360', dur: 300, loop: true, easing: 'linear' });
      el.appendChild(ring);
    }

    el.setAttribute('gpu-particles', {
      preset: 'trail', count: 30, color: '#ff4400', color2: '#ff0000',
      size: 0.04, speed: 1.5, lifetime: 300, opacity: 0.6,
    });

    scene.appendChild(el);

    const projectile = {
      el,
      pos: new THREE.Vector3(origin.x, origin.y, origin.z),
      dir,
      speed: 4,
      spawnTime: Date.now(),
      playerPosAtLaunch: camPos.clone(),
    };
    ts._projectiles.add(projectile);
  }

  _updateProjectiles() {
    const ts = this._ts;
    if (!ts._running) return;

    // V37 TASK-472: Use cached camera element (no getElementById per tick)
    if (!this._cameraEl) return;
    this._cameraEl.object3D.getWorldPosition(this._projCamPos);

    // V37 TASK-472: Use cached hand element and pre-allocated vector
    const shieldActive = this._leftHandEl?._shieldActive || false;
    if (this._leftHandEl?.object3D) {
      this._leftHandEl.object3D.getWorldPosition(this._projShieldPos);
    }

    const dt = 0.05;
    const toRemove = [];

    ts._projectiles.forEach(p => {
      p.pos.x += p.dir.x * p.speed * dt;
      p.pos.y += p.dir.y * p.speed * dt;
      p.pos.z += p.dir.z * p.speed * dt;
      p.el.setAttribute('position', `${p.pos.x} ${p.pos.y} ${p.pos.z}`);

      // V37 TASK-472: Use pre-allocated vectors
      if (shieldActive && p.pos.distanceTo(this._projShieldPos) < 0.6) {
        toRemove.push(p);
        this._onShieldBlock(p);
        return;
      }

      if (p.pos.distanceTo(this._projCamPos) < 0.5) {
        toRemove.push(p);
        if (p.playerPosAtLaunch && this._projCamPos.distanceTo(p.playerPosAtLaunch) > 0.4) {
          this._onProjectileDodged(p);
        } else {
          this._onProjectileHit(p);
        }
        return;
      }

      if (Date.now() - p.spawnTime > 5000) {
        toRemove.push(p);
        if (p.playerPosAtLaunch && this._projCamPos.distanceTo(p.playerPosAtLaunch) > 0.4) {
          this._onProjectileDodged(p);
        }
      }
    });

    toRemove.forEach(p => {
      ts._projectiles.delete(p);
      if (p.el?.parentNode) {
        const scene = p.el.sceneEl || p.el.closest('a-scene');
        if (scene && window.__spawnGPUBurst) {
          window.__spawnGPUBurst(scene, p.pos, {
            preset: 'burst', count: 12, color: '#ff4400', color2: '#ffaa00',
            size: 0.04, speed: 3, lifetime: 300, opacity: 0.7,
          });
        }
        p.el.setAttribute('animation__fade', { property: 'material.opacity', to: 0, dur: 150 });
        setTimeout(() => { if (p.el.parentNode) p.el.parentNode.removeChild(p.el); }, 200);
      }
    });
  }

  _onProjectileHit(p) {
    const ts = this._ts;
    audioManager.playProjectileHit();
    window.__hapticManager?.damageTaken();
    ts._flashScreen('miss');
    ts._onPlayerDamage?.('projectile');

    const cam = document.getElementById('camera');
    if (cam) {
      const cp = new THREE.Vector3();
      cam.object3D.getWorldPosition(cp);
      const scene = ts._container.sceneEl || ts._container.closest('a-scene');
      if (scene) {
        for (let i = 0; i < 4; i++) {
          const s = document.createElement('a-sphere');
          s.setAttribute('radius', '0.015');
          s.setAttribute('material', 'shader: flat; color: #ff2222; opacity: 0.7');
          s.setAttribute('position', `${cp.x} ${cp.y} ${cp.z}`);
          const dx = (Math.random() - 0.5) * 1.5;
          const dy = (Math.random() - 0.5) * 1.5;
          const dz = (Math.random() - 0.5) * 1.5;
          s.setAttribute('animation__burst', {
            property: 'position', to: `${cp.x + dx} ${cp.y + dy} ${cp.z + dz}`,
            dur: 200, easing: 'easeOutQuad',
          });
          s.setAttribute('animation__fade', { property: 'material.opacity', from: 0.7, to: 0, dur: 250 });
          scene.appendChild(s);
          setTimeout(() => { if (s.parentNode) s.parentNode.removeChild(s); }, 300);
        }
      }
    }
  }

  _onProjectileDodged(p) {
    const ts = this._ts;
    scoreManager.add(50);
    const pos = { x: p.pos.x, y: p.pos.y, z: p.pos.z };
    ts._spawnDamageNumber(pos, 50, '#00ff88', 'DODGED!');
    audioManager.playHit(pos);
    window.__hapticManager?.pulse(0.6, 80);
    document.dispatchEvent(new CustomEvent('crosshair-hit'));
  }

  _onShieldBlock(p) {
    const ts = this._ts;
    const pos = { x: p.pos.x, y: p.pos.y, z: p.pos.z };
    audioManager.playShieldBlock(pos);
    document.dispatchEvent(new CustomEvent('shield-block', { detail: { pos, points: 5 } }));

    const scene = ts._container.sceneEl || ts._container.closest('a-scene');
    if (scene) {
      for (let i = 0; i < 5; i++) {
        const s = document.createElement('a-sphere');
        s.setAttribute('radius', '0.012');
        s.setAttribute('material', 'shader: flat; color: #4488ff; opacity: 0.8');
        s.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
        const dx = (Math.random() - 0.5) * 1.5;
        const dy = (Math.random() - 0.5) * 1.5;
        const dz = (Math.random() - 0.5) * 1.5;
        s.setAttribute('animation__burst', {
          property: 'position', to: `${pos.x + dx} ${pos.y + dy} ${pos.z + dz}`,
          dur: 200, easing: 'easeOutQuad',
        });
        s.setAttribute('animation__fade', { property: 'material.opacity', from: 0.8, to: 0, dur: 250 });
        scene.appendChild(s);
        setTimeout(() => { if (s.parentNode) s.parentNode.removeChild(s); }, 300);
      }
    }

    const leftHand = document.getElementById('left-hand');
    if (leftHand?.components?.['oculus-touch-controls']) {
      window.__hapticManager?.pulse(0.6, 80);
    }
  }

  /** Called from _onTargetHit — heavy/boss targets fire projectiles */
  checkProjectileFiring() {
    const ts = this._ts;
    if (!ts._running || ts._projectiles.size >= 3) return;
    const now = Date.now();
    const minInterval = Math.max(6000, 12000 - ts._wave * 100);
    if (now - ts._lastProjectileTime < minInterval) return;

    for (const el of ts._targets) {
      if (el._targetType === 'heavy' || ts._bossMode) {
        if (el.parentNode && el.object3D) {
          this._tryFireProjectile(el);
          break;
        }
      }
    }
  }

  // ===================== Chargers (TASK-251) =====================

  _trySpawnCharger() {
    const ts = this._ts;
    if (!ts._running || ts._chargers.size >= 2) return;

    const scene = ts._container.sceneEl || ts._container.closest('a-scene');
    if (!scene) return;

    const cam = document.getElementById('camera');
    if (!cam) return;
    const camPos = new THREE.Vector3();
    cam.object3D.getWorldPosition(camPos);
    const camDir = new THREE.Vector3();
    cam.object3D.getWorldDirection(camDir);
    camDir.y = 0;
    camDir.normalize();

    const baseAngle = Math.atan2(-camDir.x, -camDir.z);
    const offset = (Math.random() - 0.5) * Math.PI * 0.8;
    const angle = baseAngle + offset;
    const dist = 12 + Math.random() * 2;

    const x = THREE.MathUtils.clamp(Math.sin(angle) * dist, -13, 13);
    const z = THREE.MathUtils.clamp(-Math.cos(angle) * dist, -13, 13);
    const y = 0.5;

    const telegraph = document.createElement('a-circle');
    telegraph.setAttribute('rotation', '-90 0 0');
    telegraph.setAttribute('position', `${x} 0.06 ${z}`);
    telegraph.setAttribute('radius', '0.8');
    telegraph.setAttribute('material', 'shader: flat; color: #ff4400; opacity: 0; transparent: true');
    telegraph.setAttribute('animation__warn', {
      property: 'material.opacity', from: 0, to: 0.4,
      dur: 800, easing: 'easeInQuad',
    });
    scene.appendChild(telegraph);
    audioManager.playChargerRumble({ x, y, z });

    setTimeout(() => {
      if (telegraph.parentNode) telegraph.parentNode.removeChild(telegraph);
      if (!ts._running) return;
      this._spawnCharger(x, y, z);
    }, 1000);
  }

  _spawnCharger(x, y, z) {
    const ts = this._ts;
    const scene = ts._container.sceneEl || ts._container.closest('a-scene');
    if (!scene) return;

    const el = document.createElement('a-entity');
    el.setAttribute('class', 'target');
    el.setAttribute('geometry', 'primitive: cylinder; radius: 0.3; height: 0.6; segmentsRadial: 8');
    el.setAttribute('material', 'color: #ff4400; metalness: 0.8; roughness: 0.2; emissive: #ff2200; emissiveIntensity: 0.8');
    el.setAttribute('position', `${x} ${y} ${z}`);
    el.setAttribute('shadow', 'cast: true; receive: false');

    // V41 TASK-486: Skip rapid pulse animation on Quest (300ms loop → static)
    if (!_isQuest) {
      el.setAttribute('animation__pulse', {
        property: 'material.emissiveIntensity', from: 0.5, to: 1.2,
        dur: 300, loop: true, dir: 'alternate', easing: 'easeInOutSine',
      });
    }

    el.setAttribute('animation__spawn', {
      property: 'scale', from: '0 0 0', to: '1 1 1',
      dur: 300, easing: 'easeOutElastic',
    });

    // V41 TASK-486: Skip spinning ring on Quest (500ms loop → omit entirely)
    if (!_isQuest) {
      const ring = document.createElement('a-torus');
      ring.setAttribute('radius', '0.45');
      ring.setAttribute('radius-tubular', '0.02');
      ring.setAttribute('material', 'shader: flat; color: #ff6600; opacity: 0.5');
      ring.setAttribute('rotation', '90 0 0');
      ring.setAttribute('animation__spin', { property: 'rotation', from: '90 0 0', to: '90 360 0', dur: 500, loop: true, easing: 'linear' });
      el.appendChild(ring);
    }

    el.setAttribute('target-hit', 'hp: 1; targetType: charger');
    el._targetType = 'charger';
    el._targetPoints = 15;
    el._targetCoins = 0;

    el.addEventListener('destroyed', (evt) => {
      const damage = evt?.detail?.damage || 1;
      const hitPos = evt?.detail?.position || null;
      this._onChargerKill(el);
      ts._onTargetHit(el, damage, hitPos);
    });

    ts._container.appendChild(el);
    ts._targets.add(el);

    const hum = audioManager.createTargetHum({ x, y, z }, 'charger');

    const charger = {
      el,
      pos: new THREE.Vector3(x, y, z),
      speed: 4,
      hum,
      spawnTime: Date.now(),
    };
    ts._chargers.add(charger);
    audioManager.playSpawn({ x, y, z });
  }

  _updateChargers() {
    const ts = this._ts;
    if (!ts._running) return;

    // V37 TASK-474: Use cached camera element (no getElementById per tick)
    if (!this._cameraEl) return;
    this._cameraEl.object3D.getWorldPosition(this._chargerCamPos);
    this._chargerCamPos.y = 0.5;

    const dt = 0.05;
    const toRemove = [];

    ts._chargers.forEach(c => {
      if (!c.el.parentNode) { toRemove.push(c); return; }

      // V37 TASK-474: Use pre-allocated direction vector (no allocation)
      this._chargerDir.subVectors(this._chargerCamPos, c.pos).normalize();
      c.pos.x += this._chargerDir.x * c.speed * dt;
      c.pos.z += this._chargerDir.z * c.speed * dt;
      c.el.setAttribute('position', `${c.pos.x} ${c.pos.y} ${c.pos.z}`);

      if (c.hum) {
        const dist = c.pos.distanceTo(this._chargerCamPos);
        const vol = Math.min(0.15, 0.02 + (1 - dist / 14) * 0.13);
        c.hum.update({ x: c.pos.x, y: c.pos.y, z: c.pos.z }, vol);
      }

      // V37 TASK-474: DUPLICATE getWorldPosition removed - reuse _chargerCamPos from above
      // Use pre-allocated target position vector
      this._chargerTargetPos.set(this._chargerCamPos.x, 0.5, this._chargerCamPos.z);
      if (c.pos.distanceTo(this._chargerTargetPos) < 1.0) {
        toRemove.push(c);
        this._onChargerContact(c);
      }

      if (Date.now() - c.spawnTime > 8000) {
        toRemove.push(c);
      }
    });

    toRemove.forEach(c => {
      ts._chargers.delete(c);
      if (c.hum) c.hum.stop();
      ts._targets.delete(c.el);
      if (c.el._expireTimeout) clearTimeout(c.el._expireTimeout);
      const hum = ts._targetHums.get(c.el);
      if (hum) { hum.stop(); ts._targetHums.delete(c.el); }
      if (c.el?.parentNode) {
        c.el.setAttribute('animation__fade', { property: 'material.opacity', to: 0, dur: 200 });
        setTimeout(() => { if (c.el.parentNode) c.el.parentNode.removeChild(c.el); }, 250);
      }
    });
  }

  _onChargerContact(charger) {
    const ts = this._ts;
    const pos = { x: charger.pos.x, y: charger.pos.y, z: charger.pos.z };
    audioManager.playChargerExplode(pos);
    window.__hapticManager?.damageTaken();
    ts._flashScreen('miss');
    ts._onPlayerDamage?.('charger');

    const scene = ts._container.sceneEl || ts._container.closest('a-scene');
    // V39 TASK-482: Skip charger explosion particles on Quest (7 DOM + timers → 0)
    // V42: Use cached _isQuest for consistency
    if (scene && !_isQuest) {
      for (let i = 0; i < 6; i++) {
        const s = document.createElement('a-sphere');
        s.setAttribute('radius', '0.02');
        s.setAttribute('material', 'shader: flat; color: #ff4400; opacity: 0.8');
        s.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
        const dx = (Math.random() - 0.5) * 2;
        const dy = Math.random() * 1.5;
        const dz = (Math.random() - 0.5) * 2;
        s.setAttribute('animation__burst', {
          property: 'position', to: `${pos.x + dx} ${pos.y + dy} ${pos.z + dz}`,
          dur: 300, easing: 'easeOutQuad',
        });
        s.setAttribute('animation__fade', { property: 'material.opacity', from: 0.8, to: 0, dur: 350 });
        scene.appendChild(s);
        setTimeout(() => { if (s.parentNode) s.parentNode.removeChild(s); }, 400);
      }

      const fl = document.createElement('a-entity');
      fl.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
      fl.setAttribute('light', 'type: point; color: #ff4400; intensity: 2; distance: 5; decay: 2');
      fl.setAttribute('animation__dim', { property: 'light.intensity', from: 2, to: 0, dur: 200, easing: 'easeOutQuad' });
      scene.appendChild(fl);
      setTimeout(() => { if (fl.parentNode) fl.parentNode.removeChild(fl); }, 250);
    }
  }

  _onChargerKill(el) {
    const ts = this._ts;
    ts._chargers.forEach(c => {
      if (c.el === el) {
        if (c.hum) c.hum.stop();
        ts._chargers.delete(c);
      }
    });
  }

  // ===================== Danger Zones (TASK-253) =====================

  _trySpawnDangerZone() {
    const ts = this._ts;
    if (!ts._running) return;
    const now = Date.now();
    const interval = ts._bossMode ? 18000 : 25000;
    if (now - ts._lastDangerZoneTime < interval) return;
    if (ts._dangerZones.size >= 2) return;

    ts._lastDangerZoneTime = now;
    this._spawnDangerZone();
  }

  _spawnDangerZone() {
    const ts = this._ts;
    const scene = ts._container.sceneEl || ts._container.closest('a-scene');
    if (!scene) return;

    const x = (Math.random() - 0.5) * 20;
    const z = (Math.random() - 0.5) * 20;
    const radius = 3 + Math.random() * 2;

    const el = document.createElement('a-entity');
    el.setAttribute('position', `${x} 0.07 ${z}`);

    const outline = document.createElement('a-ring');
    outline.setAttribute('rotation', '-90 0 0');
    outline.setAttribute('radius-inner', String(radius - 0.1));
    outline.setAttribute('radius-outer', String(radius));
    outline.setAttribute('material', 'shader: flat; color: #ff2222; opacity: 0; transparent: true');
    outline.setAttribute('animation__warn', {
      property: 'material.opacity', from: 0, to: 0.6,
      dur: 1500, easing: 'easeInQuad',
    });
    el.appendChild(outline);

    const fill = document.createElement('a-circle');
    fill.setAttribute('rotation', '-90 0 0');
    fill.setAttribute('radius', String(radius));
    fill.setAttribute('material', 'shader: flat; color: #ff0000; opacity: 0; transparent: true');
    fill._activatable = true;
    el.appendChild(fill);

    scene.appendChild(el);
    audioManager.playDangerZoneWarn({ x, y: 0.1, z });

    const zone = {
      el, x, z, radius, fill,
      active: false,
      activateTime: Date.now() + 2000,
      expireTime: Date.now() + 2000 + 9000,
      lastDamageTick: 0,
    };
    ts._dangerZones.add(zone);

    setTimeout(() => {
      if (!ts._running || !el.parentNode) return;
      zone.active = true;
      // V42 TASK-487: Skip pulse animation on Quest (800ms loop → static)
      if (_isQuest) {
        // Static opacity on Quest - no animation overhead
        fill.setAttribute('material', 'opacity', 0.15);
      } else {
        fill.setAttribute('animation__activate', {
          property: 'material.opacity', from: 0, to: 0.15,
          dur: 300, easing: 'easeOutQuad',
        });
        fill.setAttribute('animation__pulse', {
          property: 'material.opacity', from: 0.08, to: 0.2,
          dur: 800, loop: true, dir: 'alternate', easing: 'easeInOutSine',
        });
      }
      this._spawnDangerEmbers(scene, x, z, radius, zone);
    }, 2000);
  }

  _spawnDangerEmbers(scene, cx, cz, radius, zone) {
    // V38 TASK-476: Skip ember particles on Quest (25 allocs/sec → 0)
    // V42: Use cached _isQuest for consistency
    if (_isQuest) return;

    const ts = this._ts;
    const emberInterval = setInterval(() => {
      if (!ts._running || !zone.active || !zone.el.parentNode) {
        clearInterval(emberInterval);
        return;
      }
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius;
      const ex = cx + Math.cos(angle) * dist;
      const ez = cz + Math.sin(angle) * dist;
      const ember = document.createElement('a-sphere');
      ember.setAttribute('radius', '0.01');
      ember.setAttribute('material', 'shader: flat; color: #ff4400; opacity: 0.6');
      ember.setAttribute('position', `${ex} 0.1 ${ez}`);
      ember.setAttribute('animation__rise', {
        property: 'position', to: `${ex} ${0.5 + Math.random() * 0.5} ${ez}`,
        dur: 600, easing: 'easeOutQuad',
      });
      ember.setAttribute('animation__fade', {
        property: 'material.opacity', from: 0.6, to: 0, dur: 600,
      });
      scene.appendChild(ember);
      setTimeout(() => { if (ember.parentNode) ember.parentNode.removeChild(ember); }, 650);
    }, 200);
    zone._emberInterval = emberInterval;
  }

  _updateDangerZones() {
    const ts = this._ts;
    if (!ts._running) return;

    const rig = document.getElementById('player-rig');
    if (!rig) return;
    const rigPos = rig.object3D.position;
    const now = Date.now();

    const toRemove = [];

    ts._dangerZones.forEach(zone => {
      if (now > zone.expireTime) {
        toRemove.push(zone);
        return;
      }

      if (!zone.active) return;

      const dx = rigPos.x - zone.x;
      const dz = rigPos.z - zone.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < zone.radius && now - zone.lastDamageTick > 1000) {
        zone.lastDamageTick = now;
        audioManager.playDangerZoneTick();
        window.__hapticManager?.pulse(0.3, 50);
        ts._onPlayerDamage?.('dangerZone');
        ts._flashScreen('miss');
      }
    });

    toRemove.forEach(zone => {
      ts._dangerZones.delete(zone);
      if (zone._emberInterval) clearInterval(zone._emberInterval);
      if (zone.el?.parentNode) {
        zone.el.setAttribute('animation__fadeout', {
          property: 'scale', to: '0 0 0', dur: 500, easing: 'easeInQuad',
        });
        setTimeout(() => { if (zone.el.parentNode) zone.el.parentNode.removeChild(zone.el); }, 550);
      }
    });
  }

  // ===================== Scare Balls (TASK-255) =====================

  _tryLaunchScareBall() {
    const ts = this._ts;
    if (!ts._running) return;
    const now = Date.now();
    const combo = ts._combo;
    const minInterval = combo >= 15 ? 12000 : 15000;
    const maxInterval = combo >= 15 ? 18000 : 25000;
    const interval = ts._scareBallInterval || (minInterval + Math.random() * (maxInterval - minInterval));
    if (now - ts._lastScareBallTime < interval) return;
    if (ts._scareBalls.size >= 2) return;

    ts._lastScareBallTime = now;
    ts._scareBallInterval = minInterval + Math.random() * (maxInterval - minInterval);
    this._launchScareBall();
  }

  _launchScareBall() {
    const ts = this._ts;
    const scene = ts._container.sceneEl || ts._container.closest('a-scene');
    if (!scene) return;
    const cam = document.getElementById('camera');
    if (!cam) return;

    // V46 TASK-501: Reuse pre-allocated vector instead of `new THREE.Vector3()`
    cam.object3D.getWorldPosition(this._launchCamPos);
    const camPos = this._launchCamPos;

    const edge = Math.floor(Math.random() * 4);
    let sx, sz;
    switch (edge) {
      case 0: sx = -14; sz = (Math.random() - 0.5) * 26; break;
      case 1: sx = 14;  sz = (Math.random() - 0.5) * 26; break;
      case 2: sx = (Math.random() - 0.5) * 26; sz = -14; break;
      default: sx = (Math.random() - 0.5) * 26; sz = 14; break;
    }
    const sy = camPos.y + 0.1;

    // V46 TASK-501: Reuse pre-allocated vector instead of `new THREE.Vector3(...)`
    const dir = this._launchDir.set(camPos.x - sx, camPos.y + 0.1 - sy, camPos.z - sz).normalize();
    const speed = 8 + Math.random() * 2;
    const radius = 0.15 + Math.random() * 0.1;

    const neonColors = ['#00ffff', '#ff00ff', '#ffff00', '#00ff88', '#ff4488'];
    const color = neonColors[Math.floor(Math.random() * neonColors.length)];

    audioManager.playScareWhoosh({ x: sx, y: sy, z: sz });

    setTimeout(() => {
      if (!ts._running) return;

      const el = document.createElement('a-sphere');
      el.setAttribute('radius', String(radius));
      el.setAttribute('position', `${sx} ${sy} ${sz}`);
      el.setAttribute('material', `shader: flat; color: ${color}; opacity: 0.9; transparent: true`);
      el.setAttribute('shadow', 'cast: false; receive: false');

      // V44 TASK-494: Skip point light on Quest (exceeds 2-light budget → FPS drop)
      if (!_isQuest) {
        const light = document.createElement('a-entity');
        light.setAttribute('light', `type: point; color: ${color}; intensity: 1.5; distance: 3; decay: 2`);
        el.appendChild(light);
      }

      // V46 TASK-503: Skip tail spheres entirely on Quest (0 draw calls instead of 1)
      const tailCount = _isQuest ? 0 : 3;
      for (let i = 1; i <= tailCount; i++) {
        const tail = document.createElement('a-sphere');
        tail.setAttribute('radius', String(radius * (1 - i * 0.25)));
        tail.setAttribute('material', `shader: flat; color: ${color}; opacity: ${0.5 - i * 0.12}; transparent: true`);
        tail.setAttribute('position', `${-dir.x * i * 0.25} ${-dir.y * i * 0.25} ${-dir.z * i * 0.25}`);
        el.appendChild(tail);
      }

      scene.appendChild(el);

      const ball = {
        el,
        pos: new THREE.Vector3(sx, sy, sz),
        dir: dir.clone(),  // Clone to avoid sharing vector reference (ISSUE-029)
        speed,
        spawnTime: Date.now(),
        nearMissTriggered: false,
      };
      ts._scareBalls.add(ball);
    }, 300);
  }

  _updateScareBalls() {
    const ts = this._ts;
    if (!ts._running) return;

    // V37 TASK-473: Use cached camera element (no getElementById per tick)
    if (!this._cameraEl) return;
    this._cameraEl.object3D.getWorldPosition(this._scareCamPos);

    // V46 TASK-502: Increase dt 0.03→0.05 to match 50ms tick interval
    const dt = 0.05;
    const toRemove = [];

    ts._scareBalls.forEach(b => {
      b.pos.x += b.dir.x * b.speed * dt;
      b.pos.y += b.dir.y * b.speed * dt;
      b.pos.z += b.dir.z * b.speed * dt;
      // V46 TASK-500: Use object3D.position.set() instead of setAttribute (avoids string parsing)
      b.el.object3D.position.set(b.pos.x, b.pos.y, b.pos.z);

      // V37 TASK-473: Use pre-allocated vector
      const dist = b.pos.distanceTo(this._scareCamPos);

      if (dist < 0.3) {
        toRemove.push(b);
        this._onScareBallHit(b);
        return;
      }

      if (!b.nearMissTriggered && dist < 0.5) {
        // V37 TASK-473: Use pre-allocated temp vector (no allocation)
        this._scareToCam.subVectors(this._scareCamPos, b.pos);
        if (this._scareToCam.dot(b.dir) < 0) {
          b.nearMissTriggered = true;
          this._onScareBallDodge(b);
        }
      }

      if (Date.now() - b.spawnTime > 2000 || dist > 20) {
        toRemove.push(b);
      }
    });

    toRemove.forEach(b => {
      ts._scareBalls.delete(b);
      if (b.el?.parentNode) {
        b.el.setAttribute('animation__fade', { property: 'material.opacity', to: 0, dur: 100 });
        setTimeout(() => { if (b.el.parentNode) b.el.parentNode.removeChild(b.el); }, 150);
      }
    });
  }

  _onScareBallHit(ball) {
    const overlay = document.getElementById('transition');
    if (overlay) {
      overlay.style.background = 'rgba(255,255,255,0.6)';
      overlay.style.opacity = '1';
      overlay.style.pointerEvents = 'none';
      setTimeout(() => { overlay.style.opacity = '0'; }, 150);
      setTimeout(() => { overlay.style.background = ''; }, 300);
    }
    window.__hapticManager?.pulse(0.8, 100);
    document.dispatchEvent(new CustomEvent('camera-shake', { detail: { intensity: 0.015, duration: 150 } }));
  }

  _onScareBallDodge(ball) {
    const pos = { x: ball.pos.x, y: ball.pos.y, z: ball.pos.z };
    document.dispatchEvent(new CustomEvent('scare-dodge', { detail: { pos, points: 3 } }));
    window.__hapticManager?.pulse(0.3, 40);
  }

  // ===================== Laser Sweeps (TASK-258) =====================

  _tryLaunchLaserSweep() {
    const ts = this._ts;
    if (!ts._running) return;
    const now = Date.now();
    const interval = ts._bossMode ? 18000 : (25000 - Math.min(ts._wave, 20) * 250);
    if (now - ts._lastLaserSweepTime < interval) return;
    if (ts._laserSweeps.size >= 1) return;

    ts._lastLaserSweepTime = now;
    this._launchLaserSweep();
  }

  _launchLaserSweep() {
    const ts = this._ts;
    const scene = ts._container.sceneEl || ts._container.closest('a-scene');
    if (!scene) return;

    const isHeadHeight = Math.random() < 0.5;
    const laserY = isHeadHeight
      ? 1.4 + Math.random() * 0.3
      : 0.8 + Math.random() * 0.3;

    const sweepDuration = 2500 + Math.random() * 500;
    const startX = -15;
    const endX = 15;

    const warnEl = document.createElement('a-box');
    warnEl.setAttribute('width', '30');
    warnEl.setAttribute('height', '0.02');
    warnEl.setAttribute('depth', '0.02');
    warnEl.setAttribute('position', `0 ${laserY} 0`);
    warnEl.setAttribute('material', 'shader: flat; color: #ff2222; opacity: 0; transparent: true');
    warnEl.setAttribute('animation__warn', {
      property: 'material.opacity', from: 0, to: 0.3,
      dur: 1500, loop: true, dir: 'alternate', easing: 'easeInOutSine',
    });
    scene.appendChild(warnEl);
    audioManager.playLaserWarn();

    setTimeout(() => {
      if (warnEl.parentNode) warnEl.parentNode.removeChild(warnEl);
      if (!ts._running) return;

      const el = document.createElement('a-box');
      el.setAttribute('width', '30');
      el.setAttribute('height', '0.05');
      el.setAttribute('depth', '0.05');
      el.setAttribute('position', `${startX} ${laserY} 0`);
      el.setAttribute('material', 'shader: flat; color: #ff0000; opacity: 0.8; transparent: true; emissive: #ff0000; emissiveIntensity: 2');
      el.setAttribute('shadow', 'cast: false; receive: false');

      const light = document.createElement('a-entity');
      light.setAttribute('light', 'type: point; color: #ff0000; intensity: 1.5; distance: 4; decay: 2');
      el.appendChild(light);

      el.setAttribute('animation__sweep', {
        property: 'position',
        from: `${startX} ${laserY} 0`,
        to: `${endX} ${laserY} 0`,
        dur: sweepDuration,
        easing: 'linear',
      });

      scene.appendChild(el);
      audioManager.playLaserSweep();

      const sweep = {
        el,
        laserY,
        isHeadHeight,
        startX,
        endX,
        startTime: Date.now(),
        duration: sweepDuration,
        hit: false,
        dodged: false,
      };
      ts._laserSweeps.add(sweep);

      setTimeout(() => {
        ts._laserSweeps.delete(sweep);
        if (el.parentNode) el.parentNode.removeChild(el);
      }, sweepDuration + 200);
    }, 2000);
  }

  _updateLaserSweeps() {
    const ts = this._ts;
    if (!ts._running) return;

    // V37 TASK-475: Use cached camera element (no getElementById per tick)
    if (!this._cameraEl) return;
    this._cameraEl.object3D.getWorldPosition(this._laserCamPos);

    ts._laserSweeps.forEach(sweep => {
      if (sweep.hit || sweep.dodged) return;

      const elapsed = Date.now() - sweep.startTime;
      const progress = elapsed / sweep.duration;
      if (progress > 1) return;

      const laserX = sweep.startX + (sweep.endX - sweep.startX) * progress;
      if (Math.abs(laserX - this._laserCamPos.x) > 1.5) return;

      if (sweep.isHeadHeight) {
        if (this._laserCamPos.y < sweep.laserY - 0.3) {
          sweep.dodged = true;
          this._onLaserDodge(sweep);
        } else if (Math.abs(this._laserCamPos.y - sweep.laserY) < 0.3) {
          sweep.hit = true;
          this._onLaserHit(sweep);
        }
      } else {
        // V37 TASK-475: Use cached player rig element
        const rigX = this._playerRigEl ? this._playerRigEl.object3D.position.x : 0;
        const lean = Math.abs(this._laserCamPos.x - rigX);
        if (lean > 0.4) {
          sweep.dodged = true;
          this._onLaserDodge(sweep);
        } else if (this._laserCamPos.y < sweep.laserY - 0.3) {
          sweep.dodged = true;
          this._onLaserDodge(sweep);
        } else if (Math.abs(this._laserCamPos.y - sweep.laserY) < 0.3 && lean < 0.3) {
          sweep.hit = true;
          this._onLaserHit(sweep);
        }
      }
    });
  }

  _onLaserHit(sweep) {
    const ts = this._ts;
    audioManager.playLaserHit();
    window.__hapticManager?.damageTaken();
    ts._flashScreen('miss');
    ts._onPlayerDamage?.('laser');
    document.dispatchEvent(new CustomEvent('camera-shake', { detail: { intensity: 0.02, duration: 200 } }));
  }

  _onLaserDodge(sweep) {
    const pos = { x: 0, y: sweep.laserY, z: -2 };
    document.dispatchEvent(new CustomEvent('laser-dodge', { detail: { pos, points: 5 } }));
    window.__hapticManager?.pulse(0.3, 40);

    document.dispatchEvent(new CustomEvent('slow-motion', { detail: { active: true } }));
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('slow-motion', { detail: { active: false } }));
    }, 200);
  }
}
