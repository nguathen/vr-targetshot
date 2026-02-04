/**
 * Snap Turn - Incremental rotation for VR comfort locomotion
 * Usage: <script src="/framework/locomotion/snap-turn.js"></script>
 *
 * Attach to player-rig entity:
 *   <a-entity id="player-rig" snap-turn="angle: 45">
 *
 * Schema options:
 *   angle: Rotation angle in degrees (default: 45). Common values: 30, 45, 90
 *   hand: Which controller to use - 'right', 'left', or 'both' (default: 'right')
 *   debounceTime: Minimum time between turns in ms (default: 300)
 *   enabled: Enable/disable component (default: true)
 *
 * Global API:
 *   SnapTurn.setAngle(degrees)  - Change angle for all snap-turn components
 *   SnapTurn.enable()           - Enable snap turn
 *   SnapTurn.disable()          - Disable snap turn
 *   SnapTurn.getAngle()         - Get current angle setting
 */
(function() {
  'use strict';

  // Guard against A-Frame not loaded
  if (typeof AFRAME === 'undefined') {
    console.error('[SnapTurn] A-Frame not found. Load A-Frame before snap-turn.js');
    return;
  }

  // Valid angle presets
  var VALID_ANGLES = [30, 45, 90];
  var DEFAULT_ANGLE = 45;
  var THUMBSTICK_THRESHOLD = 0.7;

  AFRAME.registerComponent('snap-turn', {
    schema: {
      angle: { type: 'number', default: DEFAULT_ANGLE },
      hand: { type: 'string', default: 'right' },
      debounceTime: { type: 'number', default: 300 },
      enabled: { type: 'boolean', default: true }
    },

    init: function() {
      this.canTurn = true;
      this.debounceTimer = null;
      this.leftController = null;
      this.rightController = null;

      // Bind handlers
      this.onThumbstickMoved = this.onThumbstickMoved.bind(this);

      // Find controllers after scene loads
      var self = this;
      if (this.el.sceneEl.hasLoaded) {
        this.setupControllers();
      } else {
        this.el.sceneEl.addEventListener('loaded', function() {
          self.setupControllers();
        });
      }

      console.log('[SnapTurn] Component initialized with angle:', this.data.angle);
    },

    setupControllers: function() {
      this.leftController = document.getElementById('left-hand');
      this.rightController = document.getElementById('right-hand');

      this.addControllerListeners();
    },

    addControllerListeners: function() {
      var hand = this.data.hand;

      if (hand === 'left' || hand === 'both') {
        if (this.leftController) {
          this.leftController.addEventListener('thumbstickmoved', this.onThumbstickMoved);
        }
      }

      if (hand === 'right' || hand === 'both') {
        if (this.rightController) {
          this.rightController.addEventListener('thumbstickmoved', this.onThumbstickMoved);
        }
      }
    },

    removeControllerListeners: function() {
      if (this.leftController) {
        this.leftController.removeEventListener('thumbstickmoved', this.onThumbstickMoved);
      }
      if (this.rightController) {
        this.rightController.removeEventListener('thumbstickmoved', this.onThumbstickMoved);
      }
    },

    onThumbstickMoved: function(evt) {
      if (!this.data.enabled || !this.canTurn) return;

      var x = evt.detail.x;

      // Check if thumbstick is pushed past threshold
      if (Math.abs(x) < THUMBSTICK_THRESHOLD) return;

      // Determine turn direction
      var direction = x > 0 ? -1 : 1; // Right = clockwise (negative), Left = counter-clockwise (positive)

      this.executeTurn(direction);
    },

    executeTurn: function(direction) {
      var angle = this.data.angle * direction;
      var currentRotation = this.el.getAttribute('rotation');

      // Apply rotation around Y axis
      var newY = currentRotation.y + angle;

      this.el.setAttribute('rotation', {
        x: currentRotation.x,
        y: newY,
        z: currentRotation.z
      });

      // Haptic feedback
      if (window.Haptics) {
        var hand = this.data.hand === 'both' ? 'both' : this.data.hand;
        Haptics.light(hand);
      }

      // Emit event
      this.el.emit('snap-turn', {
        direction: direction > 0 ? 'left' : 'right',
        angle: angle,
        newRotationY: newY
      });

      // Start debounce
      this.startDebounce();

      console.log('[SnapTurn] Turned', direction > 0 ? 'left' : 'right', 'by', Math.abs(angle), 'degrees');
    },

    startDebounce: function() {
      var self = this;
      this.canTurn = false;

      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(function() {
        self.canTurn = true;
        self.debounceTimer = null;
      }, this.data.debounceTime);
    },

    update: function(oldData) {
      // Handle hand change
      if (oldData.hand !== this.data.hand) {
        this.removeControllerListeners();
        this.addControllerListeners();
      }

      // Validate angle
      if (VALID_ANGLES.indexOf(this.data.angle) === -1) {
        console.warn('[SnapTurn] Non-standard angle:', this.data.angle, '- recommended:', VALID_ANGLES.join(', '));
      }
    },

    /**
     * Set rotation angle.
     * @param {number} degrees - Angle in degrees (30, 45, or 90)
     */
    setAngle: function(degrees) {
      this.el.setAttribute('snap-turn', 'angle', degrees);
    },

    /**
     * Enable snap turn.
     */
    enable: function() {
      this.el.setAttribute('snap-turn', 'enabled', true);
    },

    /**
     * Disable snap turn.
     */
    disable: function() {
      this.el.setAttribute('snap-turn', 'enabled', false);
      this.canTurn = true;
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
    },

    remove: function() {
      this.removeControllerListeners();

      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
    }
  });

  // Global SnapTurn API
  window.SnapTurn = {
    /**
     * Set angle for all snap-turn components.
     * @param {number} degrees - Angle in degrees (recommended: 30, 45, 90)
     */
    setAngle: function(degrees) {
      if (typeof degrees !== 'number' || degrees <= 0) {
        console.error('[SnapTurn] setAngle requires a positive number');
        return;
      }

      if (VALID_ANGLES.indexOf(degrees) === -1) {
        console.warn('[SnapTurn] Non-standard angle:', degrees, '- recommended:', VALID_ANGLES.join(', '));
      }

      var els = document.querySelectorAll('[snap-turn]');
      els.forEach(function(el) {
        var comp = el.components['snap-turn'];
        if (comp) comp.setAngle(degrees);
      });
    },

    /**
     * Enable snap turn on all components.
     */
    enable: function() {
      var els = document.querySelectorAll('[snap-turn]');
      els.forEach(function(el) {
        var comp = el.components['snap-turn'];
        if (comp) comp.enable();
      });
    },

    /**
     * Disable snap turn on all components.
     */
    disable: function() {
      var els = document.querySelectorAll('[snap-turn]');
      els.forEach(function(el) {
        var comp = el.components['snap-turn'];
        if (comp) comp.disable();
      });
    },

    /**
     * Get current angle setting from first snap-turn component.
     * @returns {number|null}
     */
    getAngle: function() {
      var el = document.querySelector('[snap-turn]');
      if (el && el.components['snap-turn']) {
        return el.components['snap-turn'].data.angle;
      }
      return null;
    },

    /**
     * Check if snap turn is enabled on any component.
     * @returns {boolean}
     */
    isEnabled: function() {
      var els = document.querySelectorAll('[snap-turn]');
      for (var i = 0; i < els.length; i++) {
        var comp = els[i].components['snap-turn'];
        if (comp && comp.data.enabled) return true;
      }
      return false;
    }
  };

  console.log('[SnapTurn] Module loaded');
})();
