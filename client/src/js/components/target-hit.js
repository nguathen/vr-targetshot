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

    // Notify crosshair of kill
    document.dispatchEvent(new CustomEvent('crosshair-kill'));

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

    // === 150ms: Dissolve or shrink ===
    const settings = typeof getSettings === 'function' ? getSettings() : {};
    const useDissolve = settings.dissolveEffect !== false;
    if (useDissolve && this.el.components && !this.el.components['dissolve-effect']) {
      // TASK-322: Apply dissolve shader instead of instant shrink
      try {
        this.el.setAttribute('dissolve-effect', `color: ${color}; duration: 400`);
      } catch (_e) {
        // Fallback to shrink if dissolve fails
        this.el.setAttribute('animation__shrink', {
          property: 'scale', to: '0 0 0', dur: 180, easing: 'easeInBack',
        });
      }
    } else {
      setTimeout(() => {
        this.el.setAttribute('animation__shrink', {
          property: 'scale', to: '0 0 0', dur: 180, easing: 'easeInBack',
        });
      }, 80);
    }

    // === Second shockwave (delayed, larger, fainter) ===
    setTimeout(() => {
      this._spawnShockwave(scene, pos, color, true);
    }, 80);

    // === Camera shake + FOV punch on kill ===
    const shakeIntensity = type === 'heavy' ? 0.018 : type === 'bonus' ? 0.014 : 0.01;
    const shakeDur = type === 'heavy' ? 180 : 120;
    document.dispatchEvent(new CustomEvent('camera-shake', {
      detail: { intensity: shakeIntensity, duration: shakeDur },
    }));
    document.dispatchEvent(new CustomEvent('camera-fov-punch'));

    const hm = window.__hapticManager;
    if (hm) {
      if (type === 'heavy') hm.hitHeavy();
      else if (type === 'bonus') hm.hitBonus();
      else if (type === 'decoy') hm.hitDecoy();
      else if (type === 'speed') hm.hitSpeed();
      else if (type === 'boss') hm.hitBoss();
      else hm.hitStandard();
    }

    // === Barrier & platform reactive pulse ===
    this._pulseEnvironment(color);

    // === 350ms: Cleanup ===
    setTimeout(() => {
      this.el.emit('destroyed', { damage, color, position: { x: pos.x, y: pos.y, z: pos.z } });
      if (this.el.parentNode) {
        this.el.parentNode.removeChild(this.el);
      }
    }, 350);
  },

  _spawnShockwave(scene, pos, color, isSecondary) {
    const ring = document.createElement('a-ring');
    ring.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    ring.setAttribute('radius-inner', '0.01');
    ring.setAttribute('radius-outer', '0.1');

    const opacity = isSecondary ? 0.4 : 0.8;
    const maxOuter = isSecondary ? 3.5 : 2.5;
    const maxInner = isSecondary ? 3.0 : 2.0;
    const dur = isSecondary ? 450 : 350;

    ring.setAttribute('material', `shader: flat; color: ${color}; opacity: ${opacity}; transparent: true; side: double`);
    ring.setAttribute('look-at', '[camera]');
    ring.setAttribute('shadow', 'cast: false; receive: false');

    ring.setAttribute('animation__expand', {
      property: 'geometry.radiusOuter',
      from: 0.1, to: maxOuter,
      dur, easing: 'easeOutQuad',
    });
    ring.setAttribute('animation__expandInner', {
      property: 'geometry.radiusInner',
      from: 0.01, to: maxInner,
      dur, easing: 'easeOutQuad',
    });
    ring.setAttribute('animation__fade', {
      property: 'material.opacity',
      from: opacity, to: 0,
      dur: dur - 50, easing: 'easeOutQuad',
    });

    scene.appendChild(ring);
    setTimeout(() => {
      if (ring.parentNode) ring.parentNode.removeChild(ring);
    }, dur);
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

  _pulseEnvironment(color) {
    const type = this.data.targetType;
    const isBoss = type === 'boss';

    // Pulse nearest barrier
    const barriers = document.querySelectorAll('.arena-barrier');
    barriers.forEach(b => {
      b.setAttribute('animation__pulse', {
        property: 'material.opacity', from: isBoss ? 0.25 : 0.12, to: 0.03,
        dur: isBoss ? 500 : 300, easing: 'easeOutQuad',
      });
    });
    // Pulse platform edge glow
    const edges = document.querySelectorAll('.platform-edge');
    edges.forEach(e => {
      e.setAttribute('animation__hitpulse', {
        property: 'material.opacity', from: isBoss ? 1.0 : 0.9, to: 0.3,
        dur: isBoss ? 600 : 400, easing: 'easeOutQuad',
      });
    });

    // Pulse scene lights — flash nearest ambient/point lights
    const scene = this.el.sceneEl;
    const lights = scene.querySelectorAll('[light]');
    const pulseColor = isBoss ? '#ffffff' : color;
    lights.forEach(l => {
      const lightData = l.getAttribute('light');
      if (!lightData) return;
      const origIntensity = lightData.intensity || 1;
      const boost = isBoss ? origIntensity + 2.5 : origIntensity + 1.0;
      l.setAttribute('animation__lightpulse', {
        property: 'light.intensity', from: boost, to: origIntensity,
        dur: isBoss ? 600 : 350, easing: 'easeOutQuad',
      });
      if (isBoss) {
        const origColor = lightData.color || '#ffffff';
        l.setAttribute('light', 'color', '#ffffff');
        setTimeout(() => { l.setAttribute('light', 'color', origColor); }, 400);
      }
    });

    // Platform glow intensify on kill
    const platformBase = scene.querySelector('.platform-base');
    if (platformBase) {
      platformBase.setAttribute('animation__killglow', {
        property: 'material.opacity', from: isBoss ? 0.5 : 0.3, to: 0.1,
        dur: isBoss ? 600 : 400, easing: 'easeOutQuad',
      });
    }
  },

  _spawnParticles(color, pos) {
    const type = this.data.targetType;
    const counts = { standard: 15, heavy: 25, bonus: 20, decoy: 8, speed: 18, powerup: 18 };
    const count = counts[type] || 15;
    const burstColor = type === 'bonus' ? '#ffd700' : type === 'decoy' ? '#661111' : color;

    // TASK-320: Use GPU particles when available, fallback to entity burst
    if (window.__spawnGPUBurst) {
      window.__spawnGPUBurst(this.el.sceneEl, pos, {
        count, color: burstColor, size: 0.04, speed: 4, lifetime: 500,
      });
    } else {
      const burst = document.createElement('a-entity');
      burst.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
      burst.setAttribute('particle-burst', `color: ${burstColor}; count: ${count}; size: 0.04; speed: 4; lifetime: 500`);
      this.el.sceneEl.appendChild(burst);
    }
  },
});
