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
  },

  remove() {
    ['triggerdown', 'selectstart', 'gripdown', 'mousedown', 'click'].forEach(e => {
      this.el.removeEventListener(e, this._onTrigger);
    });
    if (this._flashTimeout) clearTimeout(this._flashTimeout);
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
          this._flashLaser(weapon);
        }
      }
    }

    // Notify shot fired (for accuracy tracking)
    document.dispatchEvent(new CustomEvent('shot-fired'));

    // Haptic feedback (centralized via HapticManager)
    const hm = window.__hapticManager;
    if (hm) {
      hm.pulse(weapon?.hapticIntensity || 0.3, weapon?.hapticDuration || 50);
    }
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
    const trail = document.createElement('a-cylinder');
    trail.setAttribute('position', `${mid.x} ${mid.y} ${mid.z}`);
    trail.setAttribute('radius', '0.008');
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
    const flash = document.createElement('a-sphere');
    flash.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    flash.setAttribute('radius', '0.04');
    flash.setAttribute('material', `shader: flat; color: ${color}; emissive: ${color}; emissiveIntensity: 2; opacity: 0.9; transparent: true`);
    flash.setAttribute('shadow', 'cast: false; receive: false');

    scene.appendChild(flash);

    flash.setAttribute('animation__shrink', {
      property: 'scale', from: '1 1 1', to: '0 0 0',
      dur: 60, easing: 'easeOutQuad',
    });
    setTimeout(() => {
      if (flash.parentNode) flash.parentNode.removeChild(flash);
    }, 80);
  },
});
