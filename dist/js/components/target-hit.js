/**
 * A-Frame component: handles target being hit.
 * Supports HP (multi-hit), damage numbers, and juicy explosion effects.
 *
 * Usage: <a-entity target-hit="hp: 2; targetType: heavy">
 */
AFRAME.registerComponent('target-hit', {
  schema: {
    hp: { type: 'int', default: 1 },
    targetType: { type: 'string', default: 'standard' },
  },

  init() {
    this._onHit = this._onHit.bind(this);
    this._onClick = this._onClick.bind(this);

    this.el.addEventListener('hit', this._onHit);
    this.el.addEventListener('click', this._onClick);
    this._destroyed = false;
    this._hp = this.data.hp;
  },

  remove() {
    this.el.removeEventListener('hit', this._onHit);
    this.el.removeEventListener('click', this._onClick);
  },

  /** Get the core geometry child (first child with a material) or fallback to el */
  _core() {
    const first = this.el.firstElementChild;
    return (first && first.hasAttribute && first.getAttribute('material')) ? first : this.el;
  },

  _onClick() {
    this._onHit({ detail: { damage: 1 } });
  },

  _onHit(evt) {
    if (this._destroyed) return;

    const damage = evt?.detail?.damage || 1;
    this._hp -= damage;
    const core = this._core();

    if (this._hp > 0) {
      // Flash on hit but don't destroy
      const origColor = core.getAttribute('material')?.color || '#ffffff';
      core.setAttribute('material', 'color', '#ffffff');
      setTimeout(() => {
        if (!this._destroyed) {
          core.setAttribute('material', 'color', origColor);
        }
      }, 80);
      // Notify boss health update
      document.dispatchEvent(new CustomEvent('boss-damaged', {
        detail: { hp: this._hp, maxHp: this.data.hp, el: this.el },
      }));
      return;
    }

    this._destroyed = true;
    const color = core.getAttribute('material')?.color || '#ffffff';
    const emissive = core.getAttribute('material')?.emissive || color;
    const pos = this.el.object3D.position;
    const type = this.data.targetType;
    const scene = this.el.sceneEl;

    // === 0ms: Simultaneous impact layers ===

    // 1) Core white flash
    this.el.removeAttribute('animation__float');
    this.el.removeAttribute('animation__move');
    this.el.removeAttribute('animation__rotate');
    core.setAttribute('material', 'color', '#ffffff');
    core.setAttribute('material', 'emissive', '#ffffff');
    core.setAttribute('material', 'emissiveIntensity', '1.5');

    // 2) Shockwave ring
    this._spawnShockwave(scene, pos, color);

    // 3) Flash point light
    this._spawnFlashLight(scene, pos, color);

    // 4) Core flash sphere (bright orb)
    this._spawnCoreFlash(scene, pos, color);

    // === 50ms: Particle burst (sparks + debris) ===
    setTimeout(() => {
      this._spawnParticles(color, pos);
    }, 40);

    // === 80ms: Scale punch (bigger = punchier) ===
    const punchScale = type === 'heavy' ? '2.0 2.0 2.0' : type === 'bonus' ? '1.8 1.8 1.8' : '1.7 1.7 1.7';
    this.el.setAttribute('animation__explode', {
      property: 'scale',
      to: punchScale,
      dur: 80,
      easing: 'easeOutQuad',
    });

    // === 150ms: Shrink to nothing ===
    setTimeout(() => {
      this.el.setAttribute('animation__shrink', {
        property: 'scale',
        to: '0 0 0',
        dur: 180,
        easing: 'easeInBack',
      });
    }, 80);

    // === Camera shake + Haptic on kill ===
    const shakeIntensity = type === 'heavy' ? 0.015 : type === 'bonus' ? 0.012 : 0.008;
    const shakeDur = type === 'heavy' ? 150 : 100;
    document.dispatchEvent(new CustomEvent('camera-shake', {
      detail: { intensity: shakeIntensity, duration: shakeDur },
    }));

    const hm = window.__hapticManager;
    if (hm) {
      const hapticI = type === 'heavy' ? 0.6 : 0.4;
      const hapticD = type === 'heavy' ? 120 : 80;
      hm.pulse(hapticI, hapticD);
    }

    // === 350ms: Cleanup ===
    setTimeout(() => {
      this.el.emit('destroyed', { damage, color, position: { x: pos.x, y: pos.y, z: pos.z } });
      if (this.el.parentNode) {
        this.el.parentNode.removeChild(this.el);
      }
    }, 350);
  },

  _spawnShockwave(scene, pos, color) {
    const ring = document.createElement('a-ring');
    ring.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    ring.setAttribute('radius-inner', '0.01');
    ring.setAttribute('radius-outer', '0.1');
    ring.setAttribute('material', `shader: flat; color: ${color}; opacity: 0.8; transparent: true; side: double`);
    ring.setAttribute('look-at', '[camera]');
    ring.setAttribute('shadow', 'cast: false; receive: false');

    ring.setAttribute('animation__expand', {
      property: 'geometry.radiusOuter',
      from: 0.1, to: 1.8,
      dur: 300, easing: 'easeOutQuad',
    });
    ring.setAttribute('animation__expandInner', {
      property: 'geometry.radiusInner',
      from: 0.01, to: 1.5,
      dur: 300, easing: 'easeOutQuad',
    });
    ring.setAttribute('animation__fade', {
      property: 'material.opacity',
      from: 0.8, to: 0,
      dur: 300, easing: 'easeOutQuad',
    });

    scene.appendChild(ring);
    setTimeout(() => {
      if (ring.parentNode) ring.parentNode.removeChild(ring);
    }, 350);
  },

  _spawnFlashLight(scene, pos, color) {
    const light = document.createElement('a-entity');
    light.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    light.setAttribute('light', `type: point; color: ${color}; intensity: 3; distance: 6; decay: 2`);

    light.setAttribute('animation__dim', {
      property: 'light.intensity',
      from: 3, to: 0,
      dur: 250, easing: 'easeOutQuad',
    });

    scene.appendChild(light);
    setTimeout(() => {
      if (light.parentNode) light.parentNode.removeChild(light);
    }, 300);
  },

  _spawnCoreFlash(scene, pos, color) {
    const orb = document.createElement('a-sphere');
    orb.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    orb.setAttribute('radius', '0.05');
    orb.setAttribute('material', `shader: flat; color: #ffffff; emissive: ${color}; emissiveIntensity: 2; opacity: 0.9; transparent: true`);
    orb.setAttribute('shadow', 'cast: false; receive: false');

    orb.setAttribute('animation__grow', {
      property: 'scale',
      from: '0.5 0.5 0.5', to: '6 6 6',
      dur: 150, easing: 'easeOutQuad',
    });
    orb.setAttribute('animation__fade', {
      property: 'material.opacity',
      from: 0.9, to: 0,
      dur: 150, easing: 'easeInQuad',
    });

    scene.appendChild(orb);
    setTimeout(() => {
      if (orb.parentNode) orb.parentNode.removeChild(orb);
    }, 200);
  },

  _spawnParticles(color, pos) {
    const type = this.data.targetType;
    const counts = { standard: 15, heavy: 25, bonus: 20, decoy: 8, speed: 18, powerup: 18 };
    const count = counts[type] || 15;

    const burstColor = type === 'bonus' ? '#ffd700' : type === 'decoy' ? '#661111' : color;

    const burst = document.createElement('a-entity');
    burst.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    burst.setAttribute('particle-burst', `color: ${burstColor}; count: ${count}; size: 0.04; speed: 4; lifetime: 500`);
    this.el.sceneEl.appendChild(burst);
  },
});
