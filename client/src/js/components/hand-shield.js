/**
 * A-Frame component: hand-held energy shield for blocking projectiles.
 * Attach to left controller. Shield activates when hand is raised
 * above shoulder height. 2s cooldown after blocking.
 *
 * Usage: <a-entity hand-shield>
 */
AFRAME.registerComponent('hand-shield', {
  init() {
    this._active = false;
    this._cooldownUntil = 0;
    this._shieldEl = null;
    this._rechargeEl = null;

    // Create shield visual (hidden by default)
    const shield = document.createElement('a-sphere');
    shield.setAttribute('radius', '0.25');
    shield.setAttribute('scale', '1 1 0.3');
    shield.setAttribute('position', '0 0 -0.15');
    shield.setAttribute('material', 'shader: flat; color: #4488ff; opacity: 0; transparent: true; side: double');
    shield.setAttribute('shadow', 'cast: false; receive: false');
    this._shieldEl = shield;
    this.el.appendChild(shield);

    // Recharge indicator ring
    const ring = document.createElement('a-ring');
    ring.setAttribute('radius-inner', '0.08');
    ring.setAttribute('radius-outer', '0.1');
    ring.setAttribute('position', '0 0 -0.1');
    ring.setAttribute('material', 'shader: flat; color: #4488ff; opacity: 0; transparent: true');
    this._rechargeEl = ring;
    this.el.appendChild(ring);

    // Listen for shield-block events to trigger cooldown
    this._onBlock = this._onBlock.bind(this);
    document.addEventListener('shield-block', this._onBlock);
  },

  remove() {
    document.removeEventListener('shield-block', this._onBlock);
    if (this._shieldEl?.parentNode) this._shieldEl.parentNode.removeChild(this._shieldEl);
    if (this._rechargeEl?.parentNode) this._rechargeEl.parentNode.removeChild(this._rechargeEl);
  },

  tick() {
    const cam = document.getElementById('camera');
    if (!cam?.object3D || !this.el.object3D) return;

    const camY = cam.object3D.getWorldPosition(new THREE.Vector3()).y;
    const handY = this.el.object3D.getWorldPosition(new THREE.Vector3()).y;
    const now = Date.now();
    const onCooldown = now < this._cooldownUntil;

    // Shield active when hand is near or above shoulder level
    const shouldBeActive = !onCooldown && (handY > camY - 0.15);

    if (shouldBeActive !== this._active) {
      this._active = shouldBeActive;
      this.el._shieldActive = shouldBeActive;

      if (shouldBeActive) {
        this._shieldEl.setAttribute('material', 'opacity', 0.25);
        this._shieldEl.setAttribute('animation__shimmer', {
          property: 'material.opacity', from: 0.15, to: 0.3,
          dur: 400, loop: true, dir: 'alternate', easing: 'easeInOutSine',
        });
      } else {
        this._shieldEl.removeAttribute('animation__shimmer');
        this._shieldEl.setAttribute('material', 'opacity', 0);
      }
    }

    // Recharge indicator
    if (onCooldown) {
      const remaining = (this._cooldownUntil - now) / 2000;
      this._rechargeEl.setAttribute('material', 'opacity', 0.3);
      this._rechargeEl.setAttribute('material', 'color', '#ff4444');
    } else if (this._rechargeEl.getAttribute('material')?.opacity > 0) {
      this._rechargeEl.setAttribute('material', 'opacity', 0);
    }
  },

  _onBlock() {
    // Start cooldown
    this._cooldownUntil = Date.now() + 2000;
    this._active = false;
    this.el._shieldActive = false;

    // Flash shield bright then hide
    this._shieldEl.setAttribute('material', 'opacity', 0.8);
    this._shieldEl.setAttribute('material', 'color', '#88ccff');
    setTimeout(() => {
      this._shieldEl.setAttribute('material', 'opacity', 0);
      this._shieldEl.setAttribute('material', 'color', '#4488ff');
    }, 150);

    // Recharge animation
    this._rechargeEl.setAttribute('material', 'opacity', 0.4);
    this._rechargeEl.setAttribute('material', 'color', '#ff4444');
    setTimeout(() => {
      this._rechargeEl.setAttribute('material', 'color', '#44ff44');
      setTimeout(() => {
        this._rechargeEl.setAttribute('material', 'opacity', 0);
      }, 300);
    }, 1800);
  },
});
