/**
 * A-Frame component: shows directional arrows on HUD for targets outside field of view.
 * Attach to camera entity. Draws small arrows at screen edge pointing toward off-screen targets.
 *
 * Usage: <a-camera target-indicator>
 *
 * Performance: V36 TASK-465 - GC-free tick() via target cache and reusable vectors
 */

// Module-level target cache (maintained by target-system.js)
const _targetCache = new Set();

AFRAME.registerComponent('target-indicator', {
  init() {
    this._arrows = [];
    this._pool = [];
    this._camWorldPos = new THREE.Vector3();
    this._camDir = new THREE.Vector3();
    this._camUp = new THREE.Vector3();
    this._targetPos = new THREE.Vector3();

    // V36 TASK-465: Pre-allocated vectors for zero-alloc tick()
    this._tempToTarget = new THREE.Vector3();
    this._tempForward = new THREE.Vector3();
    this._tempRight = new THREE.Vector3();
    this._tempUpVec = new THREE.Vector3(0, 1, 0);

    this._audioMgr = null;
    // Lazy-load audioManager (ES module)
    import('../core/audio-manager.js').then(m => { this._audioMgr = m.default; }).catch(() => {});
  },

  remove() {
    this._pool.forEach(a => { if (a.parentNode) a.parentNode.removeChild(a); });
  },

  tick() {
    const cam = this.el.object3D;
    if (!cam) return;

    cam.getWorldPosition(this._camWorldPos);
    cam.getWorldDirection(this._camDir);

    // Update spatial audio listener position
    if (this._audioMgr) {
      cam.getWorldDirection(this._camDir);
      this._camUp.set(0, 1, 0).applyQuaternion(cam.quaternion);
      this._audioMgr.updateListener(this._camWorldPos, this._camDir, this._camUp);
    }

    // V36 TASK-465: Use cached targets instead of querySelectorAll
    let idx = 0;

    _targetCache.forEach(t => {
      if (!t.object3D) return;
      t.object3D.getWorldPosition(this._targetPos);

      // Vector from camera to target (reuse _tempToTarget)
      this._tempToTarget.copy(this._targetPos).sub(this._camWorldPos);
      this._tempToTarget.y = 0; // project to XZ plane

      // Forward vector (reuse _tempForward)
      this._tempForward.copy(this._camDir);
      this._tempForward.y = 0;
      this._tempForward.normalize();

      if (this._tempToTarget.length() < 0.5) return;
      this._tempToTarget.normalize();

      // Dot product: how much in front
      const dot = this._tempForward.dot(this._tempToTarget);

      // Only show arrow for targets behind or far to the side (dot < 0.3 = ~73° off center)
      if (dot > 0.3) return;

      // Get angle relative to forward on XZ plane (reuse _tempRight and _tempUpVec)
      this._tempRight.crossVectors(this._tempForward, this._tempUpVec).normalize();
      const angleX = this._tempRight.dot(this._tempToTarget);  // positive = right
      const angleY = this._tempForward.dot(this._tempToTarget); // positive = front

      // Position arrow on a circle at edge of HUD
      const hudRadius = 0.18;
      const ang = Math.atan2(angleX, angleY);
      const ax = Math.sin(ang) * hudRadius;
      const ay = Math.cos(ang) * hudRadius * 0.5; // squash vertically

      const arrow = this._getArrow(idx);
      arrow.setAttribute('position', `${ax} ${ay} -1`);

      // Rotate arrow to point outward
      const rotDeg = -ang * (180 / Math.PI);
      arrow.setAttribute('rotation', `0 0 ${rotDeg}`);

      // Fade based on angle (more visible when further off-screen)
      const opacity = Math.min(1, (1 - dot) * 0.8);
      arrow.setAttribute('material', 'opacity', opacity);
      arrow.setAttribute('visible', 'true');

      idx++;
    });

    // Hide unused arrows
    for (let i = idx; i < this._pool.length; i++) {
      this._pool[i].setAttribute('visible', 'false');
    }
  },

  _getArrow(idx) {
    if (this._pool[idx]) return this._pool[idx];

    // Create triangle arrow using a-triangle (or a-plane rotated)
    const arrow = document.createElement('a-entity');
    arrow.setAttribute('geometry', 'primitive: triangle; vertexA: 0 0.015 0; vertexB: -0.008 -0.008 0; vertexC: 0.008 -0.008 0');
    arrow.setAttribute('material', 'shader: flat; color: #ff4444; opacity: 0.6; transparent: true; side: double');
    arrow.setAttribute('scale', '1 1 1');
    this.el.appendChild(arrow);
    this._pool.push(arrow);
    return arrow;
  },
});

// V36 TASK-465: Expose target cache for target-system.js to maintain
window.__targetCache = _targetCache;
