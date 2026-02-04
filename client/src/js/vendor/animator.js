/**
 * Animator - Entity animation utility for A-Frame
 * Usage: <script src="/framework/utils/animator.js"></script>
 *
 * Basic tween:
 *   await Animator.to(entity, { position: '0 2 0', scale: '1.5 1.5 1.5' }, 500, 'easeOut');
 *
 * Sequence:
 *   Animator.sequence(entity, [
 *     { position: '0 1 0', duration: 200 },
 *     { scale: '2 2 2', duration: 300, easing: 'bounce' }
 *   ]);
 *
 * Loop:
 *   Animator.loop(entity, { rotation: '0 360 0', duration: 1000 }, Infinity);
 *
 * Stop:
 *   Animator.stop(entity);
 */
window.Animator = (function() {
  'use strict';

  // Track active animations by entity
  var activeAnimations = new WeakMap();

  // Easing functions
  var EASINGS = {
    linear: function(t) {
      return t;
    },
    easeIn: function(t) {
      return t * t;
    },
    easeOut: function(t) {
      return t * (2 - t);
    },
    easeInOut: function(t) {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    },
    bounce: function(t) {
      if (t < 1 / 2.75) {
        return 7.5625 * t * t;
      } else if (t < 2 / 2.75) {
        t -= 1.5 / 2.75;
        return 7.5625 * t * t + 0.75;
      } else if (t < 2.5 / 2.75) {
        t -= 2.25 / 2.75;
        return 7.5625 * t * t + 0.9375;
      } else {
        t -= 2.625 / 2.75;
        return 7.5625 * t * t + 0.984375;
      }
    }
  };

  /**
   * Parse A-Frame vector string to object.
   * @param {string|Object} value - '1 2 3' or {x: 1, y: 2, z: 3}
   * @returns {Object} {x, y, z}
   */
  function parseVector(value) {
    if (typeof value === 'object') {
      return { x: value.x || 0, y: value.y || 0, z: value.z || 0 };
    }
    var parts = String(value).trim().split(/\s+/);
    return {
      x: parseFloat(parts[0]) || 0,
      y: parseFloat(parts[1]) || 0,
      z: parseFloat(parts[2]) || 0
    };
  }

  /**
   * Get current property value from entity.
   * @param {Element} entity - A-Frame entity
   * @param {string} prop - Property name (position, rotation, scale, opacity)
   * @returns {Object|number} Current value
   */
  function getCurrentValue(entity, prop) {
    if (prop === 'opacity') {
      var material = entity.getAttribute('material');
      return material && typeof material.opacity === 'number' ? material.opacity : 1;
    }
    var obj3D = entity.object3D;
    if (prop === 'position') {
      return { x: obj3D.position.x, y: obj3D.position.y, z: obj3D.position.z };
    }
    if (prop === 'rotation') {
      return {
        x: THREE.MathUtils.radToDeg(obj3D.rotation.x),
        y: THREE.MathUtils.radToDeg(obj3D.rotation.y),
        z: THREE.MathUtils.radToDeg(obj3D.rotation.z)
      };
    }
    if (prop === 'scale') {
      return { x: obj3D.scale.x, y: obj3D.scale.y, z: obj3D.scale.z };
    }
    return null;
  }

  /**
   * Apply property value to entity.
   * @param {Element} entity - A-Frame entity
   * @param {string} prop - Property name
   * @param {Object|number} value - Value to apply
   */
  function applyValue(entity, prop, value) {
    if (prop === 'opacity') {
      entity.setAttribute('material', 'opacity', value);
      return;
    }
    var obj3D = entity.object3D;
    if (prop === 'position') {
      obj3D.position.set(value.x, value.y, value.z);
    } else if (prop === 'rotation') {
      obj3D.rotation.set(
        THREE.MathUtils.degToRad(value.x),
        THREE.MathUtils.degToRad(value.y),
        THREE.MathUtils.degToRad(value.z)
      );
    } else if (prop === 'scale') {
      obj3D.scale.set(value.x, value.y, value.z);
    }
  }

  /**
   * Interpolate between two values.
   * @param {Object|number} from - Start value
   * @param {Object|number} to - End value
   * @param {number} t - Progress (0-1)
   * @returns {Object|number} Interpolated value
   */
  function lerp(from, to, t) {
    if (typeof from === 'number') {
      return from + (to - from) * t;
    }
    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
      z: from.z + (to.z - from.z) * t
    };
  }

  /**
   * Get or create animation state for entity.
   * @param {Element} entity
   * @returns {Object} Animation state
   */
  function getAnimationState(entity) {
    if (!activeAnimations.has(entity)) {
      activeAnimations.set(entity, {
        active: false,
        cancelled: false,
        rafId: null
      });
    }
    return activeAnimations.get(entity);
  }

  /**
   * Animate entity properties over time.
   * @param {Element} entity - A-Frame entity
   * @param {Object} properties - Target properties { position, rotation, scale, opacity }
   * @param {number} duration - Duration in milliseconds
   * @param {string} [easing='linear'] - Easing function name
   * @returns {Promise} Resolves when animation completes
   */
  function to(entity, properties, duration, easing) {
    if (!entity || !entity.object3D) {
      return Promise.reject(new Error('[Animator] Invalid entity'));
    }

    duration = duration || 300;
    easing = easing || 'linear';
    var easingFn = EASINGS[easing] || EASINGS.linear;

    // Cancel existing animation
    stop(entity);

    var state = getAnimationState(entity);
    state.active = true;
    state.cancelled = false;

    // Capture start values
    var startValues = {};
    var targetValues = {};
    var props = Object.keys(properties);

    props.forEach(function(prop) {
      startValues[prop] = getCurrentValue(entity, prop);
      if (prop === 'opacity') {
        targetValues[prop] = parseFloat(properties[prop]);
      } else {
        targetValues[prop] = parseVector(properties[prop]);
      }
    });

    return new Promise(function(resolve) {
      var startTime = performance.now();

      function animate() {
        if (state.cancelled) {
          state.active = false;
          resolve();
          return;
        }

        var elapsed = performance.now() - startTime;
        var progress = Math.min(elapsed / duration, 1);
        var easedProgress = easingFn(progress);

        // Update all properties
        props.forEach(function(prop) {
          var value = lerp(startValues[prop], targetValues[prop], easedProgress);
          applyValue(entity, prop, value);
        });

        if (progress < 1) {
          state.rafId = requestAnimationFrame(animate);
        } else {
          state.active = false;
          resolve();
        }
      }

      state.rafId = requestAnimationFrame(animate);
    });
  }

  /**
   * Run a sequence of animations.
   * @param {Element} entity - A-Frame entity
   * @param {Array} animations - Array of animation configs
   *   Each config: { position?, rotation?, scale?, opacity?, duration, easing? }
   * @returns {Promise} Resolves when all animations complete
   */
  function sequence(entity, animations) {
    if (!entity || !entity.object3D) {
      return Promise.reject(new Error('[Animator] Invalid entity'));
    }
    if (!Array.isArray(animations) || animations.length === 0) {
      return Promise.resolve();
    }

    var state = getAnimationState(entity);

    return animations.reduce(function(promise, anim) {
      return promise.then(function() {
        if (state.cancelled) {
          return Promise.resolve();
        }
        var props = {};
        if (anim.position !== undefined) props.position = anim.position;
        if (anim.rotation !== undefined) props.rotation = anim.rotation;
        if (anim.scale !== undefined) props.scale = anim.scale;
        if (anim.opacity !== undefined) props.opacity = anim.opacity;
        return to(entity, props, anim.duration, anim.easing);
      });
    }, Promise.resolve());
  }

  /**
   * Loop an animation.
   * @param {Element} entity - A-Frame entity
   * @param {Object} animation - Animation config { position?, rotation?, scale?, opacity?, duration, easing? }
   * @param {number} count - Number of iterations (Infinity for endless)
   * @returns {Promise} Resolves when all iterations complete (never for Infinity)
   */
  function loop(entity, animation, count) {
    if (!entity || !entity.object3D) {
      return Promise.reject(new Error('[Animator] Invalid entity'));
    }

    count = count || 1;
    var state = getAnimationState(entity);
    var iteration = 0;

    // Capture initial values to reset each loop
    var initialValues = {};
    var props = ['position', 'rotation', 'scale', 'opacity'];
    props.forEach(function(prop) {
      if (animation[prop] !== undefined) {
        initialValues[prop] = getCurrentValue(entity, prop);
      }
    });

    function runIteration() {
      if (state.cancelled || (count !== Infinity && iteration >= count)) {
        return Promise.resolve();
      }

      iteration++;

      // Reset to initial values before each iteration
      Object.keys(initialValues).forEach(function(prop) {
        applyValue(entity, prop, initialValues[prop]);
      });

      var animProps = {};
      if (animation.position !== undefined) animProps.position = animation.position;
      if (animation.rotation !== undefined) animProps.rotation = animation.rotation;
      if (animation.scale !== undefined) animProps.scale = animation.scale;
      if (animation.opacity !== undefined) animProps.opacity = animation.opacity;

      return to(entity, animProps, animation.duration, animation.easing)
        .then(runIteration);
    }

    return runIteration();
  }

  /**
   * Stop all animations on an entity.
   * @param {Element} entity - A-Frame entity
   */
  function stop(entity) {
    if (!entity) return;

    var state = activeAnimations.get(entity);
    if (state) {
      state.cancelled = true;
      if (state.rafId) {
        cancelAnimationFrame(state.rafId);
        state.rafId = null;
      }
      state.active = false;
    }
  }

  /**
   * Check if entity has active animation.
   * @param {Element} entity - A-Frame entity
   * @returns {boolean}
   */
  function isAnimating(entity) {
    var state = activeAnimations.get(entity);
    return state ? state.active : false;
  }

  /**
   * Get available easing function names.
   * @returns {string[]}
   */
  function getEasings() {
    return Object.keys(EASINGS);
  }

  console.log('[Animator] Module loaded');

  return {
    to: to,
    sequence: sequence,
    loop: loop,
    stop: stop,
    isAnimating: isAnimating,
    getEasings: getEasings
  };
})();
