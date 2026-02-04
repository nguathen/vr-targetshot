/**
 * Hit Feedback System - Hit markers and floating damage numbers for VR combat
 * Usage: <script src="/framework/vfx/hit-feedback.js"></script>
 *
 * Hit markers flash at screen center on successful hits.
 * Damage numbers float up from hit point in 3D space.
 *
 * @example
 * // Manual triggering
 * HitFeedback.showMarker('normal');           // White crosshair flash
 * HitFeedback.showMarker('critical');         // Red/yellow flash
 * HitFeedback.showMarker('headshot');         // Special marker
 * HitFeedback.showDamage(25, position, false); // Normal damage number
 * HitFeedback.showDamage(50, position, true);  // Critical (larger, different color)
 *
 * @example
 * // Auto-listens to combat events when component is attached
 * <a-camera hit-feedback>
 */
(function() {
  'use strict';

  // Configuration defaults
  var DEFAULT_MARKER_CONFIG = {
    color: '#ffffff',
    critColor: '#ff4444',
    headshotColor: '#ffdd00',
    size: 30,
    duration: 100
  };

  var DEFAULT_NUMBER_CONFIG = {
    fontSize: 0.15,
    color: '#ffffff',
    critColor: '#ffdd00',
    critPrefix: 'CRIT! ',
    font: 'monoid',
    lifetime: 1000,
    floatSpeed: 1.5,
    poolSize: 20
  };

  // State
  var markerCanvas = null;
  var markerCtx = null;
  var markerTimer = null;
  var markersEnabled = true;
  var numbersEnabled = true;
  var numberPool = null;
  var sceneEl = null;
  var activeNumbers = [];
  var config = {
    marker: Object.assign({}, DEFAULT_MARKER_CONFIG),
    number: Object.assign({}, DEFAULT_NUMBER_CONFIG)
  };

  /**
   * Create the hit marker canvas overlay.
   * @returns {HTMLCanvasElement} Canvas element
   */
  function createMarkerOverlay() {
    if (markerCanvas) return markerCanvas;

    markerCanvas = document.createElement('canvas');
    markerCanvas.id = 'hit-marker-overlay';
    markerCanvas.width = 128;
    markerCanvas.height = 128;
    markerCanvas.style.cssText =
      'position: fixed; top: 50%; left: 50%; ' +
      'transform: translate(-50%, -50%); ' +
      'pointer-events: none; z-index: 9998; opacity: 0;';

    document.body.appendChild(markerCanvas);
    markerCtx = markerCanvas.getContext('2d');

    return markerCanvas;
  }

  /**
   * Draw hit marker on canvas.
   * @param {string} type - Marker type: normal, critical, headshot
   */
  function drawMarker(type) {
    if (!markerCtx) return;

    var size = config.marker.size;
    var cx = 64;
    var cy = 64;
    var color;

    switch (type) {
      case 'critical':
        color = config.marker.critColor;
        break;
      case 'headshot':
        color = config.marker.headshotColor;
        break;
      default:
        color = config.marker.color;
    }

    markerCtx.clearRect(0, 0, 128, 128);
    markerCtx.strokeStyle = color;
    markerCtx.lineWidth = 3;
    markerCtx.lineCap = 'round';

    // Draw X marker (4 lines from center)
    var innerRadius = size * 0.2;
    var outerRadius = size * 0.5;

    // Top-left to center
    markerCtx.beginPath();
    markerCtx.moveTo(cx - outerRadius, cy - outerRadius);
    markerCtx.lineTo(cx - innerRadius, cy - innerRadius);
    markerCtx.stroke();

    // Top-right to center
    markerCtx.beginPath();
    markerCtx.moveTo(cx + outerRadius, cy - outerRadius);
    markerCtx.lineTo(cx + innerRadius, cy - innerRadius);
    markerCtx.stroke();

    // Bottom-left to center
    markerCtx.beginPath();
    markerCtx.moveTo(cx - outerRadius, cy + outerRadius);
    markerCtx.lineTo(cx - innerRadius, cy + innerRadius);
    markerCtx.stroke();

    // Bottom-right to center
    markerCtx.beginPath();
    markerCtx.moveTo(cx + outerRadius, cy + outerRadius);
    markerCtx.lineTo(cx + innerRadius, cy + innerRadius);
    markerCtx.stroke();

    // Headshot gets extra ring
    if (type === 'headshot') {
      markerCtx.beginPath();
      markerCtx.arc(cx, cy, outerRadius * 0.8, 0, Math.PI * 2);
      markerCtx.stroke();
    }
  }

  /**
   * Show hit marker at screen center.
   * @param {string} [type='normal'] - Marker type: normal, critical, headshot
   */
  function showMarker(type) {
    if (!markersEnabled) return;

    type = type || 'normal';

    if (!markerCanvas) {
      createMarkerOverlay();
    }

    if (markerTimer) {
      clearTimeout(markerTimer);
    }

    drawMarker(type);
    markerCanvas.style.opacity = '1';

    markerTimer = setTimeout(function() {
      markerCanvas.style.opacity = '0';
    }, config.marker.duration);
  }

  /**
   * Create a damage number entity.
   * @returns {Element} A-Frame text entity
   */
  function createDamageNumberEntity() {
    var el = document.createElement('a-text');
    el.setAttribute('align', 'center');
    el.setAttribute('baseline', 'center');
    el.setAttribute('font', config.number.font);
    el.setAttribute('shader', 'msdf');
    el.setAttribute('anchor', 'center');
    el.setAttribute('visible', false);
    el.setAttribute('look-at', '[camera]');
    return el;
  }

  /**
   * Initialize damage number pool.
   */
  function initNumberPool() {
    if (numberPool) return;
    if (!window.ObjectPool) {
      console.warn('[HitFeedback] ObjectPool not loaded, damage numbers disabled');
      return;
    }

    sceneEl = document.querySelector('a-scene');
    if (!sceneEl) {
      console.warn('[HitFeedback] No a-scene found');
      return;
    }

    numberPool = ObjectPool.create(
      createDamageNumberEntity,
      config.number.poolSize,
      {
        maxSize: config.number.poolSize * 2,
        onGet: function(el) {
          if (!el.parentNode) {
            sceneEl.appendChild(el);
          }
        }
      }
    );

    console.log('[HitFeedback] Damage number pool initialized');
  }

  /**
   * Show floating damage number at position.
   * @param {number} amount - Damage amount to display
   * @param {Object|THREE.Vector3} position - World position {x, y, z}
   * @param {boolean} [isCritical=false] - Show as critical hit
   */
  function showDamage(amount, position, isCritical) {
    if (!numbersEnabled) return;

    if (!numberPool) {
      initNumberPool();
      if (!numberPool) return;
    }

    var el = numberPool.get();
    if (!el) return;

    // Set text content
    var text = isCritical
      ? config.number.critPrefix + Math.round(amount)
      : String(Math.round(amount));

    el.setAttribute('value', text);

    // Set color and size
    var color = isCritical ? config.number.critColor : config.number.color;
    var fontSize = isCritical
      ? config.number.fontSize * 1.5
      : config.number.fontSize;

    el.setAttribute('color', color);
    el.setAttribute('width', fontSize * 10);

    // Position at hit point
    var pos = position;
    if (position.x === undefined) {
      pos = { x: position[0], y: position[1], z: position[2] };
    }

    el.object3D.position.set(pos.x, pos.y, pos.z);
    el.setAttribute('visible', true);
    el.setAttribute('opacity', 1);

    // Track for animation
    var numberData = {
      el: el,
      startTime: performance.now(),
      startY: pos.y,
      lifetime: config.number.lifetime
    };

    activeNumbers.push(numberData);
  }

  /**
   * Update active damage numbers (called each frame).
   */
  function updateNumbers() {
    if (activeNumbers.length === 0) return;

    var now = performance.now();
    var toRemove = [];

    for (var i = 0; i < activeNumbers.length; i++) {
      var data = activeNumbers[i];
      var elapsed = now - data.startTime;
      var progress = elapsed / data.lifetime;

      if (progress >= 1) {
        // Return to pool
        data.el.setAttribute('visible', false);
        numberPool.release(data.el);
        toRemove.push(i);
        continue;
      }

      // Float upward
      var floatOffset = elapsed * 0.001 * config.number.floatSpeed;
      data.el.object3D.position.y = data.startY + floatOffset;

      // Fade out in last 30%
      if (progress > 0.7) {
        var fadeProgress = (progress - 0.7) / 0.3;
        data.el.setAttribute('opacity', 1 - fadeProgress);
      }
    }

    // Remove completed numbers (reverse order to preserve indices)
    for (var j = toRemove.length - 1; j >= 0; j--) {
      activeNumbers.splice(toRemove[j], 1);
    }
  }

  /**
   * Handle combat hit events.
   * @param {CustomEvent} evt - Hit event with detail
   */
  function handleHitEvent(evt) {
    var detail = evt.detail || {};
    var damage = detail.damage || 0;
    var point = detail.point || detail.position;
    var isCritical = detail.critical || detail.isCritical || false;
    var isHeadshot = detail.headshot || detail.isHeadshot || false;

    // Show marker
    if (isHeadshot) {
      showMarker('headshot');
    } else if (isCritical) {
      showMarker('critical');
    } else {
      showMarker('normal');
    }

    // Show damage number if position provided
    if (point && damage > 0) {
      showDamage(damage, point, isCritical || isHeadshot);
    }
  }

  // A-Frame component
  AFRAME.registerComponent('hit-feedback', {
    schema: {
      // Marker settings
      markerColor: { type: 'color', default: '#ffffff' },
      markerCritColor: { type: 'color', default: '#ff4444' },
      markerHeadshotColor: { type: 'color', default: '#ffdd00' },
      markerSize: { type: 'number', default: 30 },
      markerDuration: { type: 'number', default: 100 },

      // Damage number settings
      numberFontSize: { type: 'number', default: 0.15 },
      numberColor: { type: 'color', default: '#ffffff' },
      numberCritColor: { type: 'color', default: '#ffdd00' },
      numberLifetime: { type: 'number', default: 1000 },
      numberFloatSpeed: { type: 'number', default: 1.5 },
      numberPoolSize: { type: 'number', default: 20 },

      // Enable/disable
      markersEnabled: { type: 'boolean', default: true },
      numbersEnabled: { type: 'boolean', default: true }
    },

    init: function() {
      // Apply schema to config
      config.marker.color = this.data.markerColor;
      config.marker.critColor = this.data.markerCritColor;
      config.marker.headshotColor = this.data.markerHeadshotColor;
      config.marker.size = this.data.markerSize;
      config.marker.duration = this.data.markerDuration;

      config.number.fontSize = this.data.numberFontSize;
      config.number.color = this.data.numberColor;
      config.number.critColor = this.data.numberCritColor;
      config.number.lifetime = this.data.numberLifetime;
      config.number.floatSpeed = this.data.numberFloatSpeed;
      config.number.poolSize = this.data.numberPoolSize;

      markersEnabled = this.data.markersEnabled;
      numbersEnabled = this.data.numbersEnabled;

      // Create overlay
      createMarkerOverlay();

      // Initialize pool
      initNumberPool();

      // Bind event handlers
      this.onProjectileHit = handleHitEvent.bind(this);
      this.onMeleeHit = handleHitEvent.bind(this);

      // Listen for combat events on scene
      this.el.sceneEl.addEventListener('projectile-hit', this.onProjectileHit);
      this.el.sceneEl.addEventListener('melee-hit', this.onMeleeHit);

      console.log('[HitFeedback] Initialized');
    },

    tick: function() {
      updateNumbers();
    },

    remove: function() {
      // Remove event listeners
      if (this.el.sceneEl) {
        this.el.sceneEl.removeEventListener('projectile-hit', this.onProjectileHit);
        this.el.sceneEl.removeEventListener('melee-hit', this.onMeleeHit);
      }

      // Clean up marker overlay
      if (markerCanvas && markerCanvas.parentNode) {
        markerCanvas.parentNode.removeChild(markerCanvas);
        markerCanvas = null;
        markerCtx = null;
      }

      // Release all active numbers
      for (var i = 0; i < activeNumbers.length; i++) {
        if (numberPool) {
          numberPool.release(activeNumbers[i].el);
        }
      }
      activeNumbers = [];

      // Clear pool
      if (numberPool) {
        numberPool.clear();
        numberPool = null;
      }
    }
  });

  // Global API
  window.HitFeedback = {
    /**
     * Show hit marker at screen center.
     * @param {string} [type='normal'] - Type: normal, critical, headshot
     */
    showMarker: showMarker,

    /**
     * Show floating damage number at world position.
     * @param {number} amount - Damage amount
     * @param {Object} position - World position {x, y, z}
     * @param {boolean} [isCritical=false] - Show as critical hit
     */
    showDamage: showDamage,

    /**
     * Enable hit markers.
     */
    enableMarkers: function() {
      markersEnabled = true;
    },

    /**
     * Disable hit markers (accessibility).
     */
    disableMarkers: function() {
      markersEnabled = false;
      if (markerCanvas) {
        markerCanvas.style.opacity = '0';
      }
    },

    /**
     * Enable damage numbers.
     */
    enableNumbers: function() {
      numbersEnabled = true;
    },

    /**
     * Disable damage numbers (accessibility).
     */
    disableNumbers: function() {
      numbersEnabled = false;
      // Hide all active numbers
      for (var i = 0; i < activeNumbers.length; i++) {
        activeNumbers[i].el.setAttribute('visible', false);
        if (numberPool) {
          numberPool.release(activeNumbers[i].el);
        }
      }
      activeNumbers = [];
    },

    /**
     * Configure hit feedback settings.
     * @param {Object} opts - Configuration options
     * @param {Object} [opts.marker] - Marker config: color, critColor, headshotColor, size, duration
     * @param {Object} [opts.number] - Number config: fontSize, color, critColor, critPrefix, lifetime, floatSpeed
     */
    configure: function(opts) {
      if (opts.marker) {
        Object.assign(config.marker, opts.marker);
      }
      if (opts.number) {
        Object.assign(config.number, opts.number);
      }
    },

    /**
     * Get current configuration.
     * @returns {Object} Current config
     */
    getConfig: function() {
      return {
        marker: Object.assign({}, config.marker),
        number: Object.assign({}, config.number),
        markersEnabled: markersEnabled,
        numbersEnabled: numbersEnabled
      };
    }
  };

  console.log('[HitFeedback] Loaded');
})();
