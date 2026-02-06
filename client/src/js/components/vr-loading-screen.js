/**
 * A-Frame component: VR Loading Screen
 * Displays a head-tracked 3D loading indicator in VR immediately when scene initializes.
 * Required for Meta Quest Store VRC.Quest.Performance.3 compliance:
 * "App must display head-tracked graphics within 4 seconds of launch or provide a loading indicator in VR."
 *
 * Usage: <a-scene vr-loading-screen>
 *
 * Dismiss: scene.emit('vr-loading-screen:dismiss')
 */
/* global AFRAME, THREE */
AFRAME.registerComponent('vr-loading-screen', {
  schema: {
    title: { type: 'string', default: 'VR QUEST' },
    subtitle: { type: 'string', default: 'Loading...' },
    titleColor: { type: 'color', default: '#00ff88' },
    spinnerColor: { type: 'color', default: '#00ff88' },
    subtitleColor: { type: 'color', default: '#aaaaaa' },
    backgroundColor: { type: 'color', default: '#0a0a1a' }
  },

  init() {
    this._dismissed = false;
    this._spinAngle = 0;
    this._container = null;
    this._spinner = null;

    this._onDismiss = this._dismiss.bind(this);
    this.el.addEventListener('vr-loading-screen:dismiss', this._onDismiss);

    // Safety timeout: auto-dismiss after 15s if dismiss event never fires
    this._timeout = setTimeout(this._onDismiss, 15000);

    // Wait for camera to be available, then create loading entities
    this._waitForCamera();

    console.log('[vr-loading-screen] Initialized — waiting for camera');
  },

  _waitForCamera() {
    const camera = this.el.querySelector('[camera]');
    if (camera && camera.object3D) {
      this._createLoadingScene(camera);
    } else {
      // Camera not ready yet, wait for scene loaded
      this.el.addEventListener('loaded', () => {
        const cam = this.el.querySelector('[camera]');
        if (cam) this._createLoadingScene(cam);
      }, { once: true });
    }
  },

  _createLoadingScene(cameraEl) {
    if (this._dismissed || this._container) return;

    const d = this.data;

    // Ensure existing scene sky is dark during loading (both HTMLs already have a-sky)
    var existingSky = this.el.querySelector('a-sky');
    if (existingSky) {
      existingSky.setAttribute('color', d.backgroundColor);
    }

    // Container parented to camera for head-tracking
    this._container = document.createElement('a-entity');
    this._container.classList.add('vr-loading-entity');
    this._container.setAttribute('position', '0 0 0');
    cameraEl.appendChild(this._container);

    // Title text
    var title = document.createElement('a-text');
    title.setAttribute('value', d.title);
    title.setAttribute('position', '0 0.25 -2');
    title.setAttribute('align', 'center');
    title.setAttribute('color', d.titleColor);
    title.setAttribute('scale', '0.5 0.5 0.5');
    title.setAttribute('font', 'mozillavr');
    title.setAttribute('material', 'shader: flat');
    this._container.appendChild(title);

    // Spinner ring
    this._spinner = document.createElement('a-torus');
    this._spinner.setAttribute('position', '0 0 -2');
    this._spinner.setAttribute('radius', '0.12');
    this._spinner.setAttribute('radius-tubular', '0.008');
    this._spinner.setAttribute('segments-radial', '6');
    this._spinner.setAttribute('segments-tubular', '16');
    this._spinner.setAttribute('material', 'shader: flat; color: ' + d.spinnerColor + '; emissive: ' + d.spinnerColor + '; emissiveIntensity: 0.6');
    // Arc effect: use theta-length to make it a partial ring
    this._spinner.setAttribute('theta-length', '270');
    this._container.appendChild(this._spinner);

    // Subtitle text
    var subtitle = document.createElement('a-text');
    subtitle.setAttribute('value', d.subtitle);
    subtitle.setAttribute('position', '0 -0.2 -2');
    subtitle.setAttribute('align', 'center');
    subtitle.setAttribute('color', d.subtitleColor);
    subtitle.setAttribute('scale', '0.3 0.3 0.3');
    subtitle.setAttribute('font', 'mozillavr');
    subtitle.setAttribute('material', 'shader: flat');
    this._container.appendChild(subtitle);

    console.log('[vr-loading-screen] Loading scene created — head-tracked indicator active');
  },

  tick(time, delta) {
    if (this._dismissed || !this._spinner) return;

    // Rotate spinner — GC-free (mutate object3D directly)
    this._spinAngle += (delta || 16) * 0.003;
    var obj = this._spinner.object3D;
    if (obj) {
      obj.rotation.z = this._spinAngle;
    }
  },

  _dismiss() {
    if (this._dismissed) return;
    this._dismissed = true;
    if (this._timeout) clearTimeout(this._timeout);

    console.log('[vr-loading-screen] Dismissing loading screen');

    // Remove loading entities from camera
    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }

    this._container = null;
    this._spinner = null;
  },

  remove() {
    this._dismiss();
    this.el.removeEventListener('vr-loading-screen:dismiss', this._onDismiss);
  }
});
