/**
 * Hitstop Effect - Impact freeze for satisfying combat feedback
 * Usage: <script src="/framework/vfx/hitstop.js"></script>
 *
 * Trigger hitstop:
 *   Hitstop.trigger(50);                    // 50ms full freeze
 *   Hitstop.trigger(100, { scale: 0.1 });   // 100ms slow-mo (10% speed)
 *   Hitstop.trigger(80, { zoom: true });    // With camera zoom punch
 *   Hitstop.trigger(60, { targets: [el] }); // Only freeze specific entities
 *
 * Accessibility:
 *   Hitstop.disable();   // Disable for motion-sensitive users
 *   Hitstop.enable();    // Re-enable
 *
 * Events (on scene):
 *   hitstop-start: { duration, scale, zoom }
 *   hitstop-end: { totalDuration }
 *
 * Integration with melee.js:
 *   el.addEventListener('melee-hit', (e) => {
 *     if (e.detail.speed > 5) Hitstop.trigger(80);  // Heavy hit
 *   });
 */
(function() {
  'use strict';

  // Configuration
  var DEFAULT_DURATION = 50;     // ms
  var DEFAULT_SCALE = 0;         // 0 = full stop, 0.1 = 10% speed
  var ZOOM_AMOUNT = 1.05;        // Camera FOV multiplier during hitstop

  // Module state
  var enabled = true;
  var isActive = false;
  var startTime = 0;
  var currentDuration = 0;
  var currentScale = 0;
  var currentZoom = false;
  var currentTargets = null;     // null = all, array = specific entities
  var resumeTimeout = null;

  // Stored animation state
  var frozenAnimations = [];     // { mixer, timeScale }
  var frozenComponents = [];     // { el, component, wasPlaying }
  var originalFOV = null;
  var cameraEl = null;

  /**
   * Find all animation mixers in the scene.
   * @returns {Array} Array of { mixer, timeScale }
   */
  function findAnimationMixers() {
    var mixers = [];
    var scene = document.querySelector('a-scene');
    if (!scene || !scene.object3D) return mixers;

    scene.object3D.traverse(function(obj) {
      if (obj.userData && obj.userData.mixer) {
        mixers.push({
          mixer: obj.userData.mixer,
          timeScale: obj.userData.mixer.timeScale
        });
      }
    });

    return mixers;
  }

  /**
   * Find all A-Frame animation components.
   * @param {Array|null} targets - Specific elements or null for all
   * @returns {Array}
   */
  function findAnimationComponents(targets) {
    var components = [];
    var elements = targets || document.querySelectorAll('[animation], [animation-mixer]');

    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];

      // A-Frame animation component
      if (el.components && el.components.animation) {
        var anim = el.components.animation;
        if (anim.animationIsPlaying) {
          components.push({
            el: el,
            component: anim,
            wasPlaying: true,
            type: 'animation'
          });
        }
      }

      // Animation mixer component (for GLTF models)
      if (el.components && el.components['animation-mixer']) {
        var mixer = el.components['animation-mixer'];
        components.push({
          el: el,
          component: mixer,
          wasPlaying: true,
          type: 'animation-mixer'
        });
      }
    }

    return components;
  }

  /**
   * Freeze all animations.
   * @param {number} scale - Time scale (0 = stop, 0.1 = 10% speed)
   */
  function freezeAnimations(scale) {
    // Freeze Three.js animation mixers
    frozenAnimations = findAnimationMixers();
    for (var i = 0; i < frozenAnimations.length; i++) {
      frozenAnimations[i].mixer.timeScale = scale;
    }

    // Freeze A-Frame animation components
    frozenComponents = findAnimationComponents(currentTargets);
    for (var j = 0; j < frozenComponents.length; j++) {
      var item = frozenComponents[j];
      if (item.type === 'animation') {
        item.component.pauseAnimation();
      } else if (item.type === 'animation-mixer' && item.component.mixer) {
        item.originalTimeScale = item.component.mixer.timeScale;
        item.component.mixer.timeScale = scale;
      }
    }
  }

  /**
   * Resume all frozen animations.
   */
  function resumeAnimations() {
    // Resume Three.js mixers
    for (var i = 0; i < frozenAnimations.length; i++) {
      var item = frozenAnimations[i];
      item.mixer.timeScale = item.timeScale;
    }
    frozenAnimations = [];

    // Resume A-Frame components
    for (var j = 0; j < frozenComponents.length; j++) {
      var comp = frozenComponents[j];
      if (comp.type === 'animation' && comp.wasPlaying) {
        comp.component.resumeAnimation();
      } else if (comp.type === 'animation-mixer' && comp.component.mixer) {
        comp.component.mixer.timeScale = comp.originalTimeScale || 1;
      }
    }
    frozenComponents = [];
  }

  /**
   * Apply camera zoom punch effect.
   */
  function applyZoom() {
    cameraEl = document.querySelector('a-camera, [camera]');
    if (!cameraEl) return;

    var camera = cameraEl.getObject3D('camera');
    if (!camera) return;

    originalFOV = camera.fov;
    camera.fov = originalFOV / ZOOM_AMOUNT;  // Zoom in = lower FOV
    camera.updateProjectionMatrix();
  }

  /**
   * Remove camera zoom effect.
   */
  function removeZoom() {
    if (!cameraEl || originalFOV === null) return;

    var camera = cameraEl.getObject3D('camera');
    if (!camera) return;

    camera.fov = originalFOV;
    camera.updateProjectionMatrix();

    originalFOV = null;
    cameraEl = null;
  }

  /**
   * Start the hitstop effect.
   * @param {number} duration - Duration in ms
   * @param {Object} options - { scale, zoom, targets }
   */
  function startHitstop(duration, options) {
    options = options || {};

    // If already active, extend duration instead of stacking
    if (isActive) {
      var elapsed = performance.now() - startTime;
      var remaining = currentDuration - elapsed;
      var newRemaining = Math.max(remaining, duration);

      // Extend the timeout
      if (resumeTimeout) {
        clearTimeout(resumeTimeout);
      }
      currentDuration = elapsed + newRemaining;
      resumeTimeout = setTimeout(endHitstop, newRemaining);

      console.log('[Hitstop] Extended to ' + Math.round(newRemaining) + 'ms remaining');
      return;
    }

    currentDuration = duration;
    currentScale = typeof options.scale === 'number' ? options.scale : DEFAULT_SCALE;
    currentZoom = options.zoom === true;
    currentTargets = options.targets || null;

    isActive = true;
    startTime = performance.now();

    // Freeze animations
    freezeAnimations(currentScale);

    // Apply zoom if requested
    if (currentZoom) {
      applyZoom();
    }

    // Emit start event
    var scene = document.querySelector('a-scene');
    if (scene) {
      scene.emit('hitstop-start', {
        duration: duration,
        scale: currentScale,
        zoom: currentZoom
      });
    }

    // Schedule end
    resumeTimeout = setTimeout(endHitstop, duration);

    console.log('[Hitstop] Started: ' + duration + 'ms, scale=' + currentScale);
  }

  /**
   * End the hitstop effect.
   */
  function endHitstop() {
    if (!isActive) return;

    var totalDuration = performance.now() - startTime;

    // Resume animations
    resumeAnimations();

    // Remove zoom
    if (currentZoom) {
      removeZoom();
    }

    // Clear state
    isActive = false;
    currentDuration = 0;
    currentScale = 0;
    currentZoom = false;
    currentTargets = null;
    resumeTimeout = null;

    // Emit end event
    var scene = document.querySelector('a-scene');
    if (scene) {
      scene.emit('hitstop-end', {
        totalDuration: totalDuration
      });
    }

    console.log('[Hitstop] Ended after ' + Math.round(totalDuration) + 'ms');
  }

  /**
   * Global Hitstop API
   */
  window.Hitstop = {
    /**
     * Trigger a hitstop effect.
     * @param {number} [duration=50] - Duration in milliseconds
     * @param {Object} [options] - Configuration options
     * @param {number} [options.scale=0] - Time scale (0 = full stop, 0.1 = 10% speed)
     * @param {boolean} [options.zoom=false] - Apply camera zoom punch
     * @param {Array<Element>} [options.targets=null] - Specific entities to freeze (null = all)
     */
    trigger: function(duration, options) {
      if (!enabled) {
        console.log('[Hitstop] Disabled, skipping trigger');
        return;
      }

      duration = typeof duration === 'number' ? duration : DEFAULT_DURATION;
      duration = Math.max(0, Math.min(duration, 1000));  // Clamp to 0-1000ms

      startHitstop(duration, options);
    },

    /**
     * Manually end the current hitstop (if any).
     */
    cancel: function() {
      if (resumeTimeout) {
        clearTimeout(resumeTimeout);
      }
      endHitstop();
    },

    /**
     * Enable hitstop effects.
     */
    enable: function() {
      enabled = true;
      console.log('[Hitstop] Enabled');
    },

    /**
     * Disable hitstop effects (accessibility).
     * Also cancels any active hitstop.
     */
    disable: function() {
      enabled = false;
      if (isActive) {
        this.cancel();
      }
      console.log('[Hitstop] Disabled (accessibility)');
    },

    /**
     * Check if hitstop is enabled.
     * @returns {boolean}
     */
    isEnabled: function() {
      return enabled;
    },

    /**
     * Check if hitstop is currently active.
     * @returns {boolean}
     */
    isActive: function() {
      return isActive;
    },

    /**
     * Get current hitstop state.
     * @returns {Object} { active, remaining, scale, zoom }
     */
    getState: function() {
      var remaining = 0;
      if (isActive) {
        remaining = Math.max(0, currentDuration - (performance.now() - startTime));
      }

      return {
        active: isActive,
        remaining: Math.round(remaining),
        scale: currentScale,
        zoom: currentZoom,
        enabled: enabled
      };
    },

    /**
     * Preset: Light hitstop for minor impacts.
     * 30ms, full stop.
     */
    light: function() {
      this.trigger(30, { scale: 0 });
    },

    /**
     * Preset: Medium hitstop for standard hits.
     * 50ms, full stop.
     */
    medium: function() {
      this.trigger(50, { scale: 0 });
    },

    /**
     * Preset: Heavy hitstop for powerful impacts.
     * 80ms, full stop with zoom.
     */
    heavy: function() {
      this.trigger(80, { scale: 0, zoom: true });
    },

    /**
     * Preset: Critical hitstop for devastating hits.
     * 120ms slow-mo with zoom.
     */
    critical: function() {
      this.trigger(120, { scale: 0.1, zoom: true });
    }
  };

  console.log('[Hitstop] Module loaded');
})();
