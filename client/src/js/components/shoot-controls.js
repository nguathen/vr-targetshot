/**
 * A-Frame component: shoot on trigger press.
 * Supports weapon system with spread, cooldown, and damage multiplier.
 *
 * Usage: <a-entity shoot-controls="hand: right">
 */

// V40 TASK-484: Cache Quest check to avoid repeated lookups
const _isQuest = typeof VRCore !== 'undefined' && VRCore.isQuest && VRCore.isQuest();

AFRAME.registerComponent('shoot-controls', {
  schema: {
    hand: { type: 'string', default: 'right' },
  },

  init() {
    this._onTrigger = this._onTrigger.bind(this);
    ['triggerdown', 'selectstart', 'gripdown', 'mousedown', 'click'].forEach(e => {
      this.el.addEventListener(e, this._onTrigger);
    });
    // Idle sway state
    this._swayTime = Math.random() * 1000;
    this._swayOffsetY = 0;
    this._swayOffsetX = 0;

    // V36 TASK-466: Pre-allocated vectors for GC-free shotgun hit detection
    this._shotgunOrigin = new THREE.Vector3();
    this._shotgunDirection = new THREE.Vector3();
    this._shotgunTargetPos = new THREE.Vector3();
    this._shotgunToTarget = new THREE.Vector3();

    // V40 TASK-483: Pre-allocated vectors for GC-free per-shot operations
    this._missOrigin = new THREE.Vector3();
    this._missDirection = new THREE.Vector3();
    this._missFarPoint = new THREE.Vector3();
    this._scratchVec = new THREE.Vector3(); // Scratch vector for multiplyScalar ops
    this._trailOrigin = new THREE.Vector3();
    this._trailDirection = new THREE.Vector3();
    this._trailEnd = new THREE.Vector3();
    this._trailMid = new THREE.Vector3();
    this._trailUp = new THREE.Vector3(0, 1, 0);
    this._trailQuat = new THREE.Quaternion();
    this._trailEuler = new THREE.Euler();
    this._muzzlePos = new THREE.Vector3();
    this._muzzleDir = new THREE.Vector3();
    this._shellPos = new THREE.Vector3();
    this._shellSparkPos = new THREE.Vector3();
    this._muzzleColor = new THREE.Color();
    this._smokeDir = new THREE.Vector3(); // For smoke puff setTimeout closure
  },

  remove() {
    ['triggerdown', 'selectstart', 'gripdown', 'mousedown', 'click'].forEach(e => {
      this.el.removeEventListener(e, this._onTrigger);
    });
    if (this._flashTimeout) clearTimeout(this._flashTimeout);
    // TASK-342: Clean up reusable muzzle light
    if (this._muzzleLight && this._muzzleLight.parent) {
      this._muzzleLight.parent.remove(this._muzzleLight);
      this._muzzleLight.dispose();
      this._muzzleLight = null;
    }
  },

  tick(time, delta) {
    if (!delta) return;

    // TASK-342: Fade muzzle light
    if (this._muzzleLight && this._muzzleLightFade > 0) {
      this._muzzleLightFade -= delta;
      if (this._muzzleLightFade <= 0) {
        this._muzzleLight.intensity = 0;
        this._muzzleLightFade = 0;
      } else {
        // Fade from 2.0 to 0 over 50ms
        this._muzzleLight.intensity = 2.0 * (this._muzzleLightFade / 50);
      }
    }

    if (this._recoiling) return;
    this._swayTime += delta * 0.001;
    const obj = this.el.object3D;
    if (!obj) return;

    // Undo previous offset
    obj.position.y -= this._swayOffsetY;
    obj.position.x -= this._swayOffsetX;

    // Subtle breathing sway
    const amp = 0.003;
    this._swayOffsetY = Math.sin(this._swayTime * 1.2) * amp;
    this._swayOffsetX = Math.sin(this._swayTime * 0.8 + 0.5) * amp * 0.6;

    obj.position.y += this._swayOffsetY;
    obj.position.x += this._swayOffsetX;
  },

  _getWeapon() {
    return window.__weaponSystem?.current || null;
  },

  _onTrigger() {
    const weapon = this._getWeapon();

    // Check fire rate cooldown
    if (weapon && window.__weaponSystem) {
      const fired = window.__weaponSystem.fire();
      if (!fired) return;
    }

    const raycaster = this.el.components.raycaster;
    if (!raycaster) return;

    raycaster.checkIntersections();
    const intersections = raycaster.intersections;

    if (weapon && weapon.projectiles > 1 && weapon.spread > 0) {
      this._shotgunHit(raycaster, weapon);
    } else {
      let hitTarget = false;
      if (intersections.length > 0) {
        const hit = intersections[0];
        let targetEl = hit.object.el;
        if (targetEl && !targetEl.classList.contains('target')) {
          targetEl = targetEl.closest('.target');
        }
        if (targetEl && targetEl.classList.contains('target')) {
          const damage = weapon?.damage || 1;
          targetEl.dispatchEvent(new CustomEvent('hit', {
            detail: { point: hit.point, damage },
          }));
          hitTarget = true;
        } else {
          // Hit environment — spawn ricochet at impact point
          this._spawnRicochet(hit.point);
        }
      } else {
        // V40 TASK-483: Total miss — ricochet at far end of ray (GC-free)
        this.el.object3D.getWorldPosition(this._missOrigin);
        this.el.object3D.getWorldDirection(this._missDirection);
        this._missDirection.negate();
        this._scratchVec.copy(this._missDirection).multiplyScalar(25);
        this._missFarPoint.copy(this._missOrigin).add(this._scratchVec);
        this._spawnRicochet(this._missFarPoint);
      }
      this._flashLaser(weapon);
    }

    // Notify shot fired (for accuracy tracking)
    document.dispatchEvent(new CustomEvent('shot-fired'));

    // Haptic feedback — weapon-specific patterns
    const hm = window.__hapticManager;
    if (hm) {
      const wId = weapon?.id;
      if (wId === 'shotgun') hm.fireShotgun();
      else if (wId === 'sniper') hm.fireSniper();
      else if (wId === 'smg') hm.fireSmg();
      else if (wId === 'railgun') hm.fireRailgun(weapon?.damage || 1);
      else hm.firePistol();
    }

    // Weapon recoil kick (snap back quickly)
    this._applyRecoil(weapon);

    // Shell casing eject (pistol, shotgun, smg — not sniper/railgun)
    if (!weapon || (weapon.id !== 'sniper' && weapon.id !== 'railgun')) {
      this._spawnShellCasing(weapon);
    }
  },

  _applyRecoil(weapon) {
    const el = this.el;
    const obj = el.object3D;
    if (!obj || this._recoiling) return;
    this._recoiling = true;

    const wId = weapon?.id;
    const kick = wId === 'shotgun' ? 0.06 : wId === 'sniper' ? 0.04 : wId === 'railgun' ? 0.08 : wId === 'smg' ? 0.015 : 0.025;
    const rotKick = wId === 'shotgun' ? 3 : wId === 'sniper' ? 2 : wId === 'railgun' ? 4 : wId === 'smg' ? 0.8 : 1.5;

    // Store original
    const origZ = obj.position.z;
    const origRotX = obj.rotation.x;

    // Kick back
    obj.position.z += kick;
    obj.rotation.x -= rotKick * (Math.PI / 180);

    // Snap back
    setTimeout(() => {
      obj.position.z = origZ;
      obj.rotation.x = origRotX;
      this._recoiling = false;
    }, 60);
  },

  _spawnShellCasing(weapon) {
    // V40 TASK-484: Skip visual-only effects on Quest
    if (_isQuest) return;

    const scene = this.el.sceneEl;
    if (!scene) return;

    // V40 TASK-483: Use pre-allocated vector
    this.el.object3D.getWorldPosition(this._shellPos);
    const pos = this._shellPos;

    const shell = document.createElement('a-cylinder');
    shell.setAttribute('radius', '0.005');
    shell.setAttribute('height', '0.02');
    shell.setAttribute('position', `${pos.x + 0.05} ${pos.y} ${pos.z}`);
    shell.setAttribute('material', 'shader: flat; color: #ffcc44; emissive: #ffaa00; emissiveIntensity: 0.5; metalness: 0.9');
    shell.setAttribute('shadow', 'cast: false; receive: false');

    // Eject to the right and down with tumble
    const rx = 90 + Math.random() * 180;
    const ry = Math.random() * 360;
    shell.setAttribute('animation__eject', {
      property: 'position',
      to: `${pos.x + 0.15 + Math.random() * 0.1} ${pos.y - 0.3 - Math.random() * 0.2} ${pos.z + (Math.random() - 0.5) * 0.1}`,
      dur: 400, easing: 'easeOutQuad',
    });
    shell.setAttribute('animation__spin', {
      property: 'rotation', to: `${rx} ${ry} 0`, dur: 400, easing: 'linear',
    });
    shell.setAttribute('animation__fade', {
      property: 'material.opacity', from: 1, to: 0, dur: 400, easing: 'easeInQuad',
    });

    scene.appendChild(shell);
    // TASK-365: Spark on shell casing floor hit
    setTimeout(() => {
      if (shell.parentNode) {
        // V40 TASK-483: Use pre-allocated vector
        shell.object3D.getWorldPosition(this._shellSparkPos);
        const sp = this._shellSparkPos;
        // Tiny spark burst at landing position
        const spark = document.createElement('a-sphere');
        spark.setAttribute('radius', '0.005');
        spark.setAttribute('position', `${sp.x} ${sp.y} ${sp.z}`);
        spark.setAttribute('material', 'shader: flat; color: #ffcc44; opacity: 0.9; transparent: true');
        spark.setAttribute('animation__fade', { property: 'material.opacity', to: 0, dur: 100 });
        scene.appendChild(spark);
        setTimeout(() => { if (spark.parentNode) spark.parentNode.removeChild(spark); }, 120);
        shell.parentNode.removeChild(shell);
      }
    }, 450);
  },

  _shotgunHit(raycaster, weapon) {
    // V36 TASK-466: Use cached targets and pre-allocated vectors for zero GC
    const targetCache = window.__targetCache;
    if (!targetCache) {
      // Fallback if cache not ready
      return;
    }

    this.el.object3D.getWorldPosition(this._shotgunOrigin);
    this.el.object3D.getWorldDirection(this._shotgunDirection);
    this._shotgunDirection.negate();

    targetCache.forEach(targetEl => {
      targetEl.object3D.getWorldPosition(this._shotgunTargetPos);

      // Reuse _shotgunToTarget vector
      this._shotgunToTarget.copy(this._shotgunTargetPos).sub(this._shotgunOrigin);
      const dist = this._shotgunToTarget.length();
      if (dist > 50) return;

      this._shotgunToTarget.normalize();
      const angle = this._shotgunToTarget.angleTo(this._shotgunDirection);

      if (angle < weapon.spread) {
        targetEl.dispatchEvent(new CustomEvent('hit', {
          detail: { point: this._shotgunTargetPos, damage: weapon.damage },
        }));
      }
    });

    this._flashLaser(weapon);
  },

  _flashLaser(weapon) {
    const color = weapon?.laserColor || '#ffffff';
    this.el.setAttribute('raycaster', 'lineColor', '#ffffff');
    if (this._flashTimeout) clearTimeout(this._flashTimeout);
    this._flashTimeout = setTimeout(() => {
      this._flashTimeout = null;
      this.el.setAttribute('raycaster', 'lineColor', color);
    }, 80);

    this._spawnLaserTrail(weapon);
    this._spawnMuzzleFlash(weapon);
  },

  _spawnLaserTrail(weapon) {
    // V40 TASK-484: Skip visual-only effects on Quest
    if (_isQuest) return;

    const scene = this.el.sceneEl;
    if (!scene) return;

    // V40 TASK-483: Use pre-allocated vectors
    this.el.object3D.getWorldPosition(this._trailOrigin);
    this.el.object3D.getWorldDirection(this._trailDirection);
    this._trailDirection.negate();

    // Determine trail endpoint: hit point or max distance
    const raycaster = this.el.components.raycaster;
    let dist = 30;
    if (raycaster?.intersections?.length > 0) {
      dist = raycaster.intersections[0].distance;
    }

    // V40 TASK-483: Reuse pre-allocated vectors instead of clone()
    this._scratchVec.copy(this._trailDirection).multiplyScalar(dist);
    this._trailEnd.copy(this._trailOrigin).add(this._scratchVec);
    this._trailMid.copy(this._trailOrigin).add(this._trailEnd).multiplyScalar(0.5);

    const origin = this._trailOrigin;
    const direction = this._trailDirection;
    const end = this._trailEnd;
    const mid = this._trailMid;

    const color = weapon?.laserColor || '#ff4444';
    const wId = weapon?.id;
    const trailRadius = wId === 'shotgun' ? 0.018 : wId === 'sniper' ? 0.005 : wId === 'railgun' ? 0.025 : wId === 'smg' ? 0.007 : 0.01;
    const trail = document.createElement('a-cylinder');
    trail.setAttribute('position', `${mid.x} ${mid.y} ${mid.z}`);
    trail.setAttribute('radius', String(trailRadius));
    trail.setAttribute('height', String(dist));
    trail.setAttribute('material', `shader: flat; color: ${color}; emissive: ${color}; emissiveIntensity: 1; opacity: 0.8; transparent: true`);
    trail.setAttribute('shadow', 'cast: false; receive: false');

    // V40 TASK-483: Orient cylinder using pre-allocated quaternion/euler
    this._trailQuat.setFromUnitVectors(this._trailUp, direction);
    this._trailEuler.setFromQuaternion(this._trailQuat);
    const deg = (r) => (r * 180) / Math.PI;
    trail.setAttribute('rotation', `${deg(this._trailEuler.x)} ${deg(this._trailEuler.y)} ${deg(this._trailEuler.z)}`);

    scene.appendChild(trail);

    // Fade out and remove
    trail.setAttribute('animation__fade', {
      property: 'material.opacity', from: 0.8, to: 0,
      dur: 150, easing: 'easeOutQuad',
    });
    setTimeout(() => {
      if (trail.parentNode) trail.parentNode.removeChild(trail);
    }, 180);
  },

  // TASK-342: Reusable muzzle light + rate limiter
  _muzzleLight: null,
  _muzzleLightFade: 0,
  _lastFlashTime: 0,

  _spawnMuzzleFlash(weapon) {
    const scene = this.el.sceneEl;
    if (!scene) return;

    // Check settings
    const settings = typeof window.__getSettings === 'function' ? window.__getSettings() : {};
    if (settings.muzzleFlash === false) return;

    // Rate limit: max 1 flash per 80ms (prevents strobe with SMG)
    const now = performance.now();
    if (now - this._lastFlashTime < 80) return;
    this._lastFlashTime = now;

    // V40 TASK-483: Use pre-allocated vectors
    this.el.object3D.getWorldPosition(this._muzzlePos);
    const pos = this._muzzlePos;
    const color = weapon?.laserColor || '#ffffff';

    // TASK-342: Enhanced GPU particle burst (more particles, cone spread)
    if (window.__spawnGPUBurst) {
      this.el.object3D.getWorldDirection(this._muzzleDir);
      this._muzzleDir.negate(); // forward direction
      window.__spawnGPUBurst(scene, pos, {
        count: 10, color, size: 0.03, speed: 4, lifetime: 80,
        spread: 0.3, direction: this._muzzleDir,
      });
      // TASK-365: Smoke puff after shot (delayed slightly, desktop only)
      if (!_isQuest) {
        this._smokeDir.copy(this._muzzleDir); // GC-free copy for setTimeout closure
        const smokeDir = this._smokeDir;
        setTimeout(() => {
          window.__spawnGPUBurst(scene, pos, {
            preset: 'smoke', count: 6, color: '#888888', color2: '#555555',
            size: 0.04, speed: 0.5, lifetime: 300, opacity: 0.25,
            spread: 0.2, direction: smokeDir,
          });
        }, 40);
      }
    }

    // V40 TASK-484: Visual flash sphere — skip on Quest, keep GPU particles
    if (!_isQuest) {
      const flashSize = weapon?.id === 'shotgun' ? 0.1 : weapon?.id === 'sniper' ? 0.06 : 0.07;
      const flash = document.createElement('a-sphere');
      flash.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
      flash.setAttribute('radius', String(flashSize));
      flash.setAttribute('material', `shader: flat; color: ${color}; emissive: ${color}; emissiveIntensity: 2; opacity: 0.9; transparent: true`);
      flash.setAttribute('shadow', 'cast: false; receive: false');
      scene.appendChild(flash);
      flash.setAttribute('animation__shrink', {
        property: 'scale', from: '1.2 1.2 1.2', to: '0 0 0',
        dur: 80, easing: 'easeOutQuad',
      });
      setTimeout(() => { if (flash.parentNode) flash.parentNode.removeChild(flash); }, 100);
    }

    // TASK-342: Reusable Three.js PointLight (no create/destroy per shot)
    if (!this._muzzleLight) {
      this._muzzleLight = new THREE.PointLight(0xffffff, 0, 3, 2);
      this._muzzleLight.castShadow = false;
      scene.object3D.add(this._muzzleLight);
    }
    // V40 TASK-483: Use pre-allocated color
    this._muzzleColor.set(color);
    this._muzzleLight.color.copy(this._muzzleColor);
    this._muzzleLight.intensity = 2.0;
    this._muzzleLight.position.set(pos.x, pos.y, pos.z);
    this._muzzleLightFade = 50; // ms remaining
  },

  _spawnRicochet(point) {
    const scene = this.el.sceneEl;
    if (!scene || !point) return;

    const px = point.x, py = point.y, pz = point.z;

    // V40 TASK-484: Skip visual effects on Quest, keep audio/haptic
    if (!_isQuest) {
      // Spark particles (4 small spheres)
      for (let i = 0; i < 4; i++) {
        const s = document.createElement('a-sphere');
        s.setAttribute('radius', '0.008');
        s.setAttribute('material', 'shader: flat; color: #ffcc44; opacity: 0.8');
        s.setAttribute('position', `${px} ${py} ${pz}`);
        const dx = (Math.random() - 0.5) * 1.2;
        const dy = Math.random() * 0.8 + 0.2;
        const dz = (Math.random() - 0.5) * 1.2;
        s.setAttribute('animation__burst', {
          property: 'position',
          to: `${px + dx} ${py + dy} ${pz + dz}`,
          dur: 200, easing: 'easeOutQuad',
        });
        s.setAttribute('animation__fade', {
          property: 'material.opacity', from: 0.8, to: 0,
          dur: 250, easing: 'easeOutQuad',
        });
        scene.appendChild(s);
        setTimeout(() => { if (s.parentNode) s.parentNode.removeChild(s); }, 300);
      }

      // Flash light at impact
      const fl = document.createElement('a-entity');
      fl.setAttribute('position', `${px} ${py} ${pz}`);
      fl.setAttribute('light', 'type: point; color: #ffcc44; intensity: 1; distance: 3; decay: 2');
      fl.setAttribute('animation__dim', {
        property: 'light.intensity', from: 1, to: 0, dur: 100, easing: 'easeOutQuad',
      });
      scene.appendChild(fl);
      setTimeout(() => { if (fl.parentNode) fl.parentNode.removeChild(fl); }, 120);

      // TASK-261: Destructible environment — burn mark + energy cracks
      this._spawnImpactMark(point);
    }

    // Spatial ricochet sound (always play, even on Quest)
    if (window.__audioManager) {
      window.__audioManager.playRicochet({ x: px, y: py, z: pz });
    }

    // Light haptic on miss (always trigger, even on Quest)
    const hm = window.__hapticManager;
    if (hm) hm.pulse(0.1, 20);
  },

  // TASK-261: Impact marks pool (max 20, FIFO)
  _impactMarks: [],

  _spawnImpactMark(point) {
    const scene = this.el.sceneEl;
    if (!scene || !point) return;
    const px = point.x, py = point.y, pz = point.z;

    // Skip if not near floor/barriers (only on arena surfaces)
    if (py > 8 || py < -0.5) return;

    // FIFO cleanup
    while (this._impactMarks.length >= 20) {
      const old = this._impactMarks.shift();
      if (old?.parentNode) old.parentNode.removeChild(old);
    }

    const container = document.createElement('a-entity');
    container.setAttribute('position', `${px} ${py} ${pz}`);

    // Burn mark circle
    const burn = document.createElement('a-circle');
    const burnR = 0.1 + Math.random() * 0.1;
    burn.setAttribute('radius', String(burnR));
    // Orient toward camera roughly
    if (Math.abs(py) < 0.2) {
      burn.setAttribute('rotation', '-90 0 0');
      burn.setAttribute('position', `0 0.02 0`);
    }
    burn.setAttribute('material', `shader: flat; color: #ff8800; emissive: #ff6600; emissiveIntensity: 1; opacity: 0.7; transparent: true`);
    burn.setAttribute('animation__fade', {
      property: 'material.opacity', from: 0.7, to: 0,
      dur: 5000, easing: 'easeInQuad',
    });
    container.appendChild(burn);

    // Energy crack lines (2-3 thin cylinders)
    const crackCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < crackCount; i++) {
      const crack = document.createElement('a-cylinder');
      const len = 0.15 + Math.random() * 0.2;
      const angle = Math.random() * 360;
      crack.setAttribute('radius', '0.004');
      crack.setAttribute('height', String(len));
      crack.setAttribute('position', `${Math.cos(angle) * len * 0.4} 0.01 ${Math.sin(angle) * len * 0.4}`);
      crack.setAttribute('rotation', `0 ${angle} 90`);
      crack.setAttribute('material', `shader: flat; color: #00d4ff; emissive: #00d4ff; emissiveIntensity: 2; opacity: 0.6; transparent: true`);
      crack.setAttribute('animation__fade', {
        property: 'material.opacity', from: 0.6, to: 0,
        dur: 3000, easing: 'easeInQuad',
      });
      container.appendChild(crack);
    }

    scene.appendChild(container);
    this._impactMarks.push(container);

    // Auto-remove after 5s
    setTimeout(() => {
      const idx = this._impactMarks.indexOf(container);
      if (idx >= 0) this._impactMarks.splice(idx, 1);
      if (container.parentNode) container.parentNode.removeChild(container);
    }, 5100);
  },
});
