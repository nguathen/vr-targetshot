/**
 * A-Frame component: shoot on trigger press.
 * Supports weapon system with spread, cooldown, and damage multiplier.
 *
 * Usage: <a-entity shoot-controls="hand: right">
 */
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
  },

  remove() {
    ['triggerdown', 'selectstart', 'gripdown', 'mousedown', 'click'].forEach(e => {
      this.el.removeEventListener(e, this._onTrigger);
    });
    if (this._flashTimeout) clearTimeout(this._flashTimeout);
  },

  tick(time, delta) {
    if (this._recoiling || !delta) return;
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
        // Total miss — ricochet at far end of ray
        const origin = new THREE.Vector3();
        const direction = new THREE.Vector3();
        this.el.object3D.getWorldPosition(origin);
        this.el.object3D.getWorldDirection(direction);
        direction.negate();
        const farPoint = origin.clone().add(direction.multiplyScalar(25));
        this._spawnRicochet(farPoint);
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
    const scene = this.el.sceneEl;
    if (!scene) return;

    const pos = new THREE.Vector3();
    this.el.object3D.getWorldPosition(pos);

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
    setTimeout(() => { if (shell.parentNode) shell.parentNode.removeChild(shell); }, 450);
  },

  _shotgunHit(raycaster, weapon) {
    const targets = document.querySelectorAll('.target');
    const origin = new THREE.Vector3();
    const direction = new THREE.Vector3();

    this.el.object3D.getWorldPosition(origin);
    this.el.object3D.getWorldDirection(direction);
    direction.negate();

    targets.forEach(targetEl => {
      const targetPos = new THREE.Vector3();
      targetEl.object3D.getWorldPosition(targetPos);

      const toTarget = targetPos.clone().sub(origin);
      const dist = toTarget.length();
      if (dist > 50) return;

      toTarget.normalize();
      const angle = toTarget.angleTo(direction);

      if (angle < weapon.spread) {
        targetEl.dispatchEvent(new CustomEvent('hit', {
          detail: { point: targetPos, damage: weapon.damage },
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
    const scene = this.el.sceneEl;
    if (!scene) return;

    const origin = new THREE.Vector3();
    const direction = new THREE.Vector3();
    this.el.object3D.getWorldPosition(origin);
    this.el.object3D.getWorldDirection(direction);
    direction.negate();

    // Determine trail endpoint: hit point or max distance
    const raycaster = this.el.components.raycaster;
    let dist = 30;
    if (raycaster?.intersections?.length > 0) {
      dist = raycaster.intersections[0].distance;
    }

    const end = origin.clone().add(direction.clone().multiplyScalar(dist));
    const mid = origin.clone().add(end).multiplyScalar(0.5);

    const color = weapon?.laserColor || '#ff4444';
    const wId = weapon?.id;
    const trailRadius = wId === 'shotgun' ? 0.018 : wId === 'sniper' ? 0.005 : wId === 'railgun' ? 0.025 : wId === 'smg' ? 0.007 : 0.01;
    const trail = document.createElement('a-cylinder');
    trail.setAttribute('position', `${mid.x} ${mid.y} ${mid.z}`);
    trail.setAttribute('radius', String(trailRadius));
    trail.setAttribute('height', String(dist));
    trail.setAttribute('material', `shader: flat; color: ${color}; emissive: ${color}; emissiveIntensity: 1; opacity: 0.8; transparent: true`);
    trail.setAttribute('shadow', 'cast: false; receive: false');

    // Orient cylinder along direction
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, direction);
    const euler = new THREE.Euler().setFromQuaternion(quat);
    const deg = (r) => (r * 180) / Math.PI;
    trail.setAttribute('rotation', `${deg(euler.x)} ${deg(euler.y)} ${deg(euler.z)}`);

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

  _spawnMuzzleFlash(weapon) {
    const scene = this.el.sceneEl;
    if (!scene) return;

    const pos = new THREE.Vector3();
    this.el.object3D.getWorldPosition(pos);

    const color = weapon?.laserColor || '#ffffff';

    // TASK-320: GPU particle muzzle flash
    if (window.__spawnGPUBurst) {
      window.__spawnGPUBurst(scene, pos, {
        count: 5, color, size: 0.03, speed: 3, lifetime: 100,
      });
    }

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
    setTimeout(() => {
      if (flash.parentNode) flash.parentNode.removeChild(flash);
    }, 100);

    // Muzzle point light (brief flash illumination)
    const mLight = document.createElement('a-entity');
    mLight.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    mLight.setAttribute('light', `type: point; color: ${color}; intensity: 2; distance: 4; decay: 2`);
    mLight.setAttribute('animation__dim', {
      property: 'light.intensity', from: 2, to: 0, dur: 100, easing: 'easeOutQuad',
    });
    scene.appendChild(mLight);
    setTimeout(() => { if (mLight.parentNode) mLight.parentNode.removeChild(mLight); }, 120);
  },

  _spawnRicochet(point) {
    const scene = this.el.sceneEl;
    if (!scene || !point) return;

    const px = point.x, py = point.y, pz = point.z;

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

    // Spatial ricochet sound
    if (window.__audioManager) {
      window.__audioManager.playRicochet({ x: px, y: py, z: pz });
    }

    // Light haptic on miss
    const hm = window.__hapticManager;
    if (hm) hm.pulse(0.1, 20);

    // TASK-261: Destructible environment — burn mark + energy cracks
    this._spawnImpactMark(point);
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
