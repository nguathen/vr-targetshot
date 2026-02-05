/**
 * Hand Tracking Shoot Controls (TASK-323)
 * Enables shooting via hand pinch gestures when VR hand tracking is active.
 * Automatically detects hand tracking vs controllers and switches accordingly.
 *
 * Usage: <a-entity hand-tracking-controls="hand: right" hand-shoot>
 */
AFRAME.registerComponent('hand-shoot', {
  schema: {
    enabled: { type: 'boolean', default: true },
    aimAssistMultiplier: { type: 'number', default: 1.5 },
  },

  init() {
    this._isPinching = false;
    this._lastPinchTime = 0;
    this._raycasterLine = null;
    this._cooldown = 200; // ms between shots
    this._inputMode = 'unknown'; // 'hand' | 'controller' | 'unknown'

    // Listen for pinch events from hand-tracking-controls
    this.el.addEventListener('pinchstarted', this._onPinchStart.bind(this));
    this.el.addEventListener('pinchended', this._onPinchEnd.bind(this));

    // Listen for controller connection to switch modes
    this.el.sceneEl.addEventListener('controllerconnected', this._onControllerConnected.bind(this));
    this.el.sceneEl.addEventListener('controllerdisconnected', this._onControllerDisconnected.bind(this));

    // Create raycaster for hand
    this._setupRaycaster();

    // Detect initial input mode
    this._detectInputMode();
  },

  _detectInputMode() {
    // Check if hand tracking is supported
    if (!navigator.xr) {
      this._inputMode = 'controller';
      return;
    }

    // Will be set properly when XR session starts
    const scene = this.el.sceneEl;
    scene.addEventListener('enter-vr', () => {
      const session = scene.xrSession;
      if (!session) return;

      // Check for hand input sources
      const checkInputs = () => {
        if (!session.inputSources) return;
        for (const source of session.inputSources) {
          if (source.hand) {
            this._setInputMode('hand');
            return;
          }
        }
        // No hand sources found, likely controllers
        this._setInputMode('controller');
      };

      session.addEventListener('inputsourceschange', checkInputs);
      // Check after a short delay for initial sources
      setTimeout(checkInputs, 1000);
    });
  },

  _setInputMode(mode) {
    if (this._inputMode === mode) return;
    this._inputMode = mode;

    // Dispatch mode change event
    document.dispatchEvent(new CustomEvent('input-mode-change', {
      detail: { mode },
    }));

    // Show HUD indicator
    this._showModeIndicator(mode);

    // Adjust target hitboxes for hand tracking (TASK-390: use cached targets)
    const targets = window.getTargetCache ? window.getTargetCache() : document.querySelectorAll('.target');
    if (mode === 'hand') {
      targets.forEach((t) => {
        const scale = t.object3D.scale;
        t.dataset.origScale = `${scale.x},${scale.y},${scale.z}`;
        scale.multiplyScalar(this.data.aimAssistMultiplier);
      });
    } else {
      // Restore original scales
      targets.forEach((t) => {
        if (t.dataset.origScale) {
          const [x, y, z] = t.dataset.origScale.split(',').map(Number);
          t.object3D.scale.set(x, y, z);
          delete t.dataset.origScale;
        }
      });
    }
  },

  _showModeIndicator(mode) {
    const icon = mode === 'hand' ? '🤚 Hand Mode' : '🎮 Controller Mode';
    const scene = this.el.sceneEl;
    if (!scene) return;

    // Create temporary HUD text
    const indicator = document.createElement('a-text');
    indicator.setAttribute('value', icon);
    indicator.setAttribute('position', '0 -0.35 -1');
    indicator.setAttribute('scale', '0.25 0.25 0.25');
    indicator.setAttribute('color', '#00ff88');
    indicator.setAttribute('font', 'mozillavr');
    indicator.setAttribute('align', 'center');

    const cam = document.getElementById('camera');
    if (cam) {
      cam.appendChild(indicator);
      // Fade out after 3s
      setTimeout(() => {
        indicator.setAttribute('animation__fade', {
          property: 'material.opacity', from: 1, to: 0,
          dur: 500, easing: 'easeOutQuad',
        });
        setTimeout(() => {
          if (indicator.parentNode) indicator.parentNode.removeChild(indicator);
        }, 600);
      }, 3000);
    }
  },

  _setupRaycaster() {
    // The hand entity will get a raycaster for aiming
    if (!this.el.getAttribute('raycaster')) {
      this.el.setAttribute('raycaster', {
        objects: '.target, .clickable',
        far: 100,
        lineColor: '#ff4444',
        lineOpacity: 0,  // Hidden until pinch
      });
    }
  },

  _onPinchStart(evt) {
    if (!this.data.enabled || this._inputMode !== 'hand') return;

    const now = performance.now();
    if (now - this._lastPinchTime < this._cooldown) return;
    this._lastPinchTime = now;
    this._isPinching = true;

    // Show laser line during pinch
    this.el.setAttribute('raycaster', 'lineOpacity', 0.7);

    // Fire raycaster
    this._fireShot();
  },

  _onPinchEnd() {
    this._isPinching = false;
    // Hide laser line
    this.el.setAttribute('raycaster', 'lineOpacity', 0);
  },

  _fireShot() {
    const raycaster = this.el.components.raycaster;
    if (!raycaster) return;

    raycaster.checkIntersections();
    const intersections = raycaster.intersections;

    if (intersections.length > 0) {
      const hit = intersections[0];
      let targetEl = hit.object.el;
      if (targetEl && !targetEl.classList.contains('target')) {
        targetEl = targetEl.closest('.target');
      }
      if (targetEl && targetEl.classList.contains('target')) {
        const weapon = window.__weaponSystem?.current;
        const damage = weapon?.damage || 1;
        targetEl.dispatchEvent(new CustomEvent('hit', {
          detail: { point: hit.point, damage },
        }));
      }
    }

    // Fire audio
    const am = window.__audioManager;
    if (am) am.playShoot?.();

    // Notify shot fired
    document.dispatchEvent(new CustomEvent('shot-fired'));
  },

  _onControllerConnected() {
    this._setInputMode('controller');
  },

  _onControllerDisconnected() {
    // Check if hand tracking is available
    setTimeout(() => this._detectInputMode(), 500);
  },

  tick() {
    if (!this.data.enabled || this._inputMode !== 'hand') return;

    // Update raycaster direction from index finger tip
    const hand = this.el.components['hand-tracking-controls'];
    if (!hand || !hand.bones) return;

    // The raycaster origin/direction is handled by the hand entity's transform
    // which follows the hand tracking position automatically
  },

  remove() {
    this.el.removeEventListener('pinchstarted', this._onPinchStart);
    this.el.removeEventListener('pinchended', this._onPinchEnd);
  },
});

/**
 * Hand Pause Gesture Detector
 * Detects both hands open palm facing camera for 1s to toggle pause.
 *
 * Usage: <a-scene hand-pause-gesture>
 */
AFRAME.registerComponent('hand-pause-gesture', {
  init() {
    this._leftOpen = false;
    this._rightOpen = false;
    this._openTimer = null;
    this._paused = false;

    // Listen for hand events
    const scene = this.el;
    scene.addEventListener('hand-tracking-extras-ready', () => {
      // Hand gesture detection is available
    });
  },

  tick() {
    // Check both hands for open palm gesture
    const leftHand = document.getElementById('left-hand-tracking');
    const rightHand = document.getElementById('right-hand-tracking');

    if (!leftHand || !rightHand) return;

    const leftCtrl = leftHand.components['hand-tracking-controls'];
    const rightCtrl = rightHand.components['hand-tracking-controls'];

    if (!leftCtrl || !rightCtrl) return;

    // Gesture detection is built into A-Frame hand-tracking-controls
    // We rely on the 'gesture' property
    const leftGesture = leftCtrl.gesture;
    const rightGesture = rightCtrl.gesture;

    const bothOpen = leftGesture === 'point' && rightGesture === 'point';

    if (bothOpen && !this._openTimer) {
      this._openTimer = setTimeout(() => {
        // Toggle pause
        this._paused = !this._paused;
        document.dispatchEvent(new CustomEvent('hand-pause-toggle', {
          detail: { paused: this._paused },
        }));
        this._openTimer = null;
      }, 1000);
    } else if (!bothOpen && this._openTimer) {
      clearTimeout(this._openTimer);
      this._openTimer = null;
    }
  },
});
