/**
 * A-Frame component: screen shake, FOV punch, and impact zoom.
 * Attach to <a-camera>. Keeps amplitudes small for VR comfort.
 *
 * Usage: <a-camera camera-effects="shakeLevel: medium">
 *
 * Trigger via: document.dispatchEvent(new CustomEvent('camera-shake', { detail: { intensity, duration } }))
 *              document.dispatchEvent(new CustomEvent('camera-fov-punch'))
 *              document.dispatchEvent(new CustomEvent('camera-impact-zoom', { detail: { duration } }))
 */
/* global AFRAME */
AFRAME.registerComponent('camera-effects', {
  schema: {
    shakeLevel: { type: 'string', default: 'medium' }, // off, low, medium, high
  },

  init() {
    this._shaking = false;
    this._origPos = { x: 0, y: 0, z: 0 };

    this._onShake = this._onShake.bind(this);
    this._onFovPunch = this._onFovPunch.bind(this);
    this._onImpactZoom = this._onImpactZoom.bind(this);

    document.addEventListener('camera-shake', this._onShake);
    document.addEventListener('camera-fov-punch', this._onFovPunch);
    document.addEventListener('camera-impact-zoom', this._onImpactZoom);
  },

  remove() {
    document.removeEventListener('camera-shake', this._onShake);
    document.removeEventListener('camera-fov-punch', this._onFovPunch);
    document.removeEventListener('camera-impact-zoom', this._onImpactZoom);
  },

  _getScale() {
    const levels = { off: 0, low: 0.4, medium: 1.0, high: 1.6 };
    return levels[this.data.shakeLevel] || 1.0;
  },

  _onShake(evt) {
    const scale = this._getScale();
    if (scale === 0) return;

    const intensity = (evt.detail?.intensity || 0.01) * scale;
    const duration = evt.detail?.duration || 100;
    const el = this.el;

    if (this._shaking) return;
    this._shaking = true;

    const steps = Math.max(3, Math.floor(duration / 30));
    const stepDur = duration / steps;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      if (step >= steps) {
        clearInterval(interval);
        // Reset to neutral offset
        el.object3D.position.x -= this._origPos.x;
        el.object3D.position.z -= this._origPos.z;
        this._origPos.x = 0;
        this._origPos.z = 0;
        this._shaking = false;
        return;
      }
      // Decay intensity over time
      const decay = 1 - (step / steps);
      const amp = intensity * decay;
      const dx = (Math.random() - 0.5) * 2 * amp;
      const dz = (Math.random() - 0.5) * 2 * amp;

      // Undo previous offset, apply new
      el.object3D.position.x += dx - this._origPos.x;
      el.object3D.position.z += dz - this._origPos.z;
      this._origPos.x = dx;
      this._origPos.z = dz;
    }, stepDur);
  },

  _onFovPunch() {
    const scale = this._getScale();
    if (scale === 0) return;

    const camera = this.el.getObject3D('camera');
    if (!camera) return;

    const origFov = camera.fov;
    const punch = 2 * scale;
    camera.fov = origFov + punch;
    camera.updateProjectionMatrix();

    setTimeout(() => {
      camera.fov = origFov;
      camera.updateProjectionMatrix();
    }, 80);
  },

  _onImpactZoom(evt) {
    const scale = this._getScale();
    if (scale === 0) return;

    const camera = this.el.getObject3D('camera');
    if (!camera) return;

    const duration = evt.detail?.duration || 200;
    const origFov = camera.fov;
    const zoom = 1.5 * scale;

    camera.fov = origFov - zoom;
    camera.updateProjectionMatrix();

    setTimeout(() => {
      camera.fov = origFov;
      camera.updateProjectionMatrix();
    }, duration);
  },
});
