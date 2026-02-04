/**
 * Damage Vignette Component - Screen-edge red flash for VR damage feedback
 * Usage: <script src="/framework/vfx/damage-vignette.js"></script>
 *
 * Attach to camera: <a-camera damage-vignette>
 * Trigger flash: document.getElementById('camera').components['damage-vignette'].flash(0.8)
 *
 * Or use global API:
 *   DamageVignette.flash(0.5);      // Flash at 50% intensity
 *   DamageVignette.flash(1.0);      // Full intensity (heavy damage)
 *   DamageVignette.disable();       // Accessibility toggle
 */
(function() {
  'use strict';

  var vignetteOverlay = null;
  var vignetteCtx = null;
  var activeComponent = null;

  function createOverlay() {
    if (vignetteOverlay) return vignetteOverlay;

    vignetteOverlay = document.createElement('canvas');
    vignetteOverlay.id = 'damage-vignette-overlay';
    vignetteOverlay.style.cssText =
      'position: fixed; top: 0; left: 0; width: 100%; height: 100%; ' +
      'pointer-events: none; z-index: 9999; opacity: 0;';

    document.body.appendChild(vignetteOverlay);
    vignetteCtx = vignetteOverlay.getContext('2d');

    resizeOverlay();
    window.addEventListener('resize', resizeOverlay);

    return vignetteOverlay;
  }

  function resizeOverlay() {
    if (!vignetteOverlay) return;

    vignetteOverlay.width = window.innerWidth;
    vignetteOverlay.height = window.innerHeight;
  }

  function drawVignette(intensity) {
    if (!vignetteCtx) return;

    var w = vignetteOverlay.width;
    var h = vignetteOverlay.height;
    var cx = w / 2;
    var cy = h / 2;

    vignetteCtx.clearRect(0, 0, w, h);

    var innerRadius = Math.min(w, h) * 0.3;
    var outerRadius = Math.max(w, h) * 0.9;

    var gradient = vignetteCtx.createRadialGradient(cx, cy, innerRadius, cx, cy, outerRadius);

    gradient.addColorStop(0, 'rgba(180, 0, 0, 0)');
    gradient.addColorStop(0.5, 'rgba(180, 0, 0, ' + (intensity * 0.3) + ')');
    gradient.addColorStop(0.8, 'rgba(120, 0, 0, ' + (intensity * 0.6) + ')');
    gradient.addColorStop(1, 'rgba(80, 0, 0, ' + (intensity * 0.8) + ')');

    vignetteCtx.fillStyle = gradient;
    vignetteCtx.fillRect(0, 0, w, h);
  }

  AFRAME.registerComponent('damage-vignette', {
    schema: {
      duration: { type: 'number', default: 500 },
      color: { type: 'color', default: '#b40000' },
      enabled: { type: 'boolean', default: true }
    },

    init: function() {
      this.overlay = createOverlay();
      this.isFlashing = false;
      this.flashStartTime = 0;
      this.currentIntensity = 0;
      this.currentDuration = 0;

      activeComponent = this;
      console.log('[DamageVignette] Initialized');
    },

    /**
     * Trigger a damage vignette flash.
     * @param {number} [intensity] - Flash intensity (0-1), default 0.5
     * @param {number} [duration] - Override duration (ms)
     */
    flash: function(intensity, duration) {
      if (!this.data.enabled) return;

      this.currentIntensity = typeof intensity === 'number' ? intensity : 0.5;
      this.currentDuration = typeof duration === 'number' ? duration : this.data.duration;

      this.currentIntensity = Math.max(0, Math.min(1, this.currentIntensity));

      drawVignette(this.currentIntensity);
      this.overlay.style.opacity = '1';

      this.flashStartTime = performance.now();
      this.isFlashing = true;
    },

    tick: function() {
      if (!this.isFlashing) return;

      var elapsed = performance.now() - this.flashStartTime;
      var progress = elapsed / this.currentDuration;

      if (progress >= 1) {
        this.overlay.style.opacity = '0';
        this.isFlashing = false;
        return;
      }

      var easedProgress = 1 - Math.pow(1 - progress, 2);
      var currentOpacity = 1 - easedProgress;

      this.overlay.style.opacity = String(currentOpacity);
    },

    /**
     * Enable damage vignette effects.
     */
    enable: function() {
      this.el.setAttribute('damage-vignette', 'enabled', true);
    },

    /**
     * Disable damage vignette effects (accessibility).
     */
    disable: function() {
      this.el.setAttribute('damage-vignette', 'enabled', false);
      if (this.isFlashing) {
        this.overlay.style.opacity = '0';
        this.isFlashing = false;
      }
    },

    remove: function() {
      if (activeComponent === this) {
        activeComponent = null;
      }

      if (vignetteOverlay && vignetteOverlay.parentNode) {
        window.removeEventListener('resize', resizeOverlay);
        vignetteOverlay.parentNode.removeChild(vignetteOverlay);
        vignetteOverlay = null;
        vignetteCtx = null;
      }
    }
  });

  window.DamageVignette = {
    /**
     * Trigger damage vignette flash on the camera.
     * @param {number} [intensity] - 0-1 scale (default 0.5)
     * @param {number} [duration] - Override duration in ms (default 500)
     */
    flash: function(intensity, duration) {
      if (activeComponent) {
        activeComponent.flash(intensity, duration);
        return;
      }

      var camera = document.querySelector('[damage-vignette]') ||
                   document.getElementById('camera');

      if (camera && camera.components && camera.components['damage-vignette']) {
        camera.components['damage-vignette'].flash(intensity, duration);
      } else {
        console.warn('[DamageVignette] No damage-vignette component found. Add to camera: <a-camera damage-vignette>');
      }
    },

    /**
     * Enable damage vignette (accessibility).
     */
    enable: function() {
      if (activeComponent) {
        activeComponent.enable();
        return;
      }

      var camera = document.querySelector('[damage-vignette]');
      if (camera && camera.components['damage-vignette']) {
        camera.components['damage-vignette'].enable();
      }
    },

    /**
     * Disable damage vignette (accessibility).
     */
    disable: function() {
      if (activeComponent) {
        activeComponent.disable();
        return;
      }

      var camera = document.querySelector('[damage-vignette]');
      if (camera && camera.components['damage-vignette']) {
        camera.components['damage-vignette'].disable();
      }
    }
  };

  console.log('[DamageVignette] Loaded');
})();
