/**
 * A-Frame component: shows directional arrows on HUD for targets outside field of view.
 * Attach to camera entity. Draws small arrows at screen edge pointing toward off-screen targets.
 *
 * Usage: <a-camera target-indicator>
 */
AFRAME.registerComponent('target-indicator', {
  init() {
    this._arrows = [];
    this._pool = [];
    this._camWorldPos = new THREE.Vector3();
    this._camDir = new THREE.Vector3();
    this._camUp = new THREE.Vector3();
    this._targetPos = new THREE.Vector3();
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

    const targets = document.querySelectorAll('.target');
    let idx = 0;

    targets.forEach(t => {
      if (!t.object3D) return;
      t.object3D.getWorldPosition(this._targetPos);

      // Vector from camera to target
      const toTarget = this._targetPos.clone().sub(this._camWorldPos);
      toTarget.y = 0; // project to XZ plane

      const forward = this._camDir.clone();
      forward.y = 0;
      forward.normalize();

      if (toTarget.length() < 0.5) return;
      toTarget.normalize();

      // Dot product: how much in front
      const dot = forward.dot(toTarget);

      // Only show arrow for targets behind or far to the side (dot < 0.3 = ~73° off center)
      if (dot > 0.3) return;

      // Get angle relative to forward on XZ plane
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
      const angleX = right.dot(toTarget);  // positive = right
      const angleY = forward.dot(toTarget); // positive = front

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
