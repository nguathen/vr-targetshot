/**
 * A-Frame component: smooth VR locomotion via thumbstick.
 * Attach to the player rig entity. Moves rig based on left thumbstick input,
 * oriented relative to the camera (head) direction.
 *
 * Usage: <a-entity smooth-locomotion="speed: 3; camera: #camera">
 */
AFRAME.registerComponent('smooth-locomotion', {
  schema: {
    speed: { type: 'number', default: 3 },
    camera: { type: 'selector', default: '#camera' },
  },

  init() {
    this._axes = [0, 0];
    this._handleAxes = this._handleAxes.bind(this);

    // Pre-allocate vectors for GC-free tick() (Quest performance)
    this._dir = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);

    // Listen for thumbstick input from controllers
    this.el.sceneEl.addEventListener('thumbstickmoved', this._handleAxes);
  },

  remove() {
    this.el.sceneEl.removeEventListener('thumbstickmoved', this._handleAxes);
  },

  _handleAxes(evt) {
    // Only use left hand thumbstick for movement
    const hand = evt.target.getAttribute('oculus-touch-controls')?.hand
      || evt.target.getAttribute('laser-controls')?.hand;
    if (hand === 'left') {
      this._axes[0] = evt.detail.x;
      this._axes[1] = evt.detail.y;
    }
  },

  tick(_time, delta) {
    if (Math.abs(this._axes[0]) < 0.1 && Math.abs(this._axes[1]) < 0.1) return;

    const dt = delta / 1000;
    const cam = this.data.camera;
    if (!cam) return;

    // Get camera forward/right on XZ plane (GC-free: reuse pre-allocated vectors)
    const camObj = cam.object3D;
    camObj.getWorldDirection(this._dir);
    this._dir.y = 0;
    this._dir.normalize();

    this._right.crossVectors(this._dir, this._up).normalize();

    // Move rig
    const pos = this.el.object3D.position;
    pos.x += (this._right.x * this._axes[0] + this._dir.x * -this._axes[1]) * this.data.speed * dt;
    pos.z += (this._right.z * this._axes[0] + this._dir.z * -this._axes[1]) * this.data.speed * dt;

    // Clamp to arena
    pos.x = THREE.MathUtils.clamp(pos.x, -14, 14);
    pos.z = THREE.MathUtils.clamp(pos.z, -14, 14);
  },
});
