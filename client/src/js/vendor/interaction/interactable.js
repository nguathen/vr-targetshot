/**
 * Interactable - Interactive environment objects for VR (buttons, levers, switches)
 * Usage: <script src="/framework/utils/haptics.js"></script>
 *        <script src="/framework/interaction/interactable.js"></script>
 *
 * Button (press down, auto-returns):
 *   <a-box interactable="type: button; pressDepth: 0.05; returnDelay: 200"></a-box>
 *
 * Lever (drag along axis, stays at position):
 *   <a-entity interactable="type: lever; axis: x; range: -45 45"></a-entity>
 *
 * Switch (toggle on/off):
 *   <a-cylinder interactable="type: switch"></a-cylinder>
 *
 * Events emitted on interactable entity:
 *   - interact-start: Interaction began
 *   - interact-end:   Interaction ended
 *   - state-change:   { value } - Value changed (button: 0/1, lever: 0.0-1.0, switch: true/false)
 *
 * Global API:
 *   Interactable.getValue(el);          // Get current value
 *   Interactable.setValue(el, value);   // Set value programmatically
 *   Interactable.enable();              // Enable system
 *   Interactable.disable();             // Disable system
 */
(function() {
  'use strict';

  // System state
  var systemEnabled = true;

  // Track all registered interactables
  var registeredInteractables = new Set();

  // Pre-allocated vectors for calculations
  var tempVec1 = new THREE.Vector3();
  var tempVec2 = new THREE.Vector3();

  /**
   * Interactable component - marks objects that respond to player input
   */
  AFRAME.registerComponent('interactable', {
    schema: {
      type: { type: 'string', default: 'button', oneOf: ['button', 'lever', 'switch'] },
      // Button-specific
      pressDepth: { type: 'number', default: 0.05 },      // How far button moves down
      returnDelay: { type: 'number', default: 200 },      // Ms before button returns
      // Lever-specific
      axis: { type: 'string', default: 'x', oneOf: ['x', 'y', 'z'] },  // Rotation axis
      range: { type: 'vec2', default: { x: -45, y: 45 } },             // Min/max rotation degrees
      // General
      interactDistance: { type: 'number', default: 0.3 }, // Max distance to interact
      disabled: { type: 'boolean', default: false }       // Disable interaction
    },

    init: function() {
      // Current value (type-dependent)
      // Button: 0 (up) or 1 (pressed)
      // Lever: 0.0 to 1.0 (position in range)
      // Switch: true/false
      this.value = this.data.type === 'switch' ? false : 0;

      // Interaction state
      this.isInteracting = false;
      this.interactingHand = null;
      this.interactingHandEl = null;

      // Store original transform for animation
      this.originalPosition = this.el.object3D.position.clone();
      this.originalRotation = this.el.object3D.rotation.clone();

      // Button return timer
      this.returnTimer = null;

      // Lever drag state
      this.dragStartRotation = 0;
      this.dragStartHandAngle = 0;

      // Bind methods
      this.onTriggerDown = this.onTriggerDown.bind(this);
      this.onTriggerUp = this.onTriggerUp.bind(this);
      this.onClick = this.onClick.bind(this);

      // Setup event listeners
      this.setupListeners();

      // Register interactable
      registeredInteractables.add(this.el);

      console.log('[Interactable] Registered ' + this.data.type);
    },

    setupListeners: function() {
      var self = this;
      var scene = this.el.sceneEl;

      if (!scene.hasLoaded) {
        scene.addEventListener('loaded', function() {
          self.attachControllerListeners();
        });
      } else {
        this.attachControllerListeners();
      }

      // Click event for cursor/mouse interaction
      this.el.addEventListener('click', this.onClick);
    },

    attachControllerListeners: function() {
      var leftHand = document.getElementById('left-hand');
      var rightHand = document.getElementById('right-hand');

      if (leftHand) {
        leftHand.addEventListener('triggerdown', this.onTriggerDown);
        leftHand.addEventListener('triggerup', this.onTriggerUp);
      }

      if (rightHand) {
        rightHand.addEventListener('triggerdown', this.onTriggerDown);
        rightHand.addEventListener('triggerup', this.onTriggerUp);
      }
    },

    remove: function() {
      var leftHand = document.getElementById('left-hand');
      var rightHand = document.getElementById('right-hand');

      if (leftHand) {
        leftHand.removeEventListener('triggerdown', this.onTriggerDown);
        leftHand.removeEventListener('triggerup', this.onTriggerUp);
      }

      if (rightHand) {
        rightHand.removeEventListener('triggerdown', this.onTriggerDown);
        rightHand.removeEventListener('triggerup', this.onTriggerUp);
      }

      this.el.removeEventListener('click', this.onClick);

      // Clear any pending timers
      if (this.returnTimer) {
        clearTimeout(this.returnTimer);
      }

      // Unregister
      registeredInteractables.delete(this.el);

      console.log('[Interactable] Removed ' + this.data.type);
    },

    /**
     * Handle click event (cursor/mouse)
     */
    onClick: function(evt) {
      if (!systemEnabled || this.data.disabled) return;

      // For switch and button, trigger interaction on click
      if (this.data.type === 'switch') {
        this.toggleSwitch();
      } else if (this.data.type === 'button') {
        this.pressButton();
      }
      // Lever requires drag, so click does nothing
    },

    /**
     * Handle trigger down from controller
     */
    onTriggerDown: function(evt) {
      if (!systemEnabled || this.data.disabled || this.isInteracting) return;

      var handEl = evt.target;
      var hand = this.getHandedness(handEl);
      if (!hand) return;

      // Check distance to hand
      var distance = this.getDistanceToHand(handEl);
      if (distance > this.data.interactDistance) return;

      // Find closest interactable to this hand
      var closest = findClosestInteractable(handEl, this.data.interactDistance);
      if (closest !== this.el) return;

      this.startInteraction(hand, handEl);
    },

    /**
     * Handle trigger up from controller
     */
    onTriggerUp: function(evt) {
      if (!this.isInteracting) return;

      var handEl = evt.target;
      var hand = this.getHandedness(handEl);

      // Only end if same hand
      if (hand !== this.interactingHand) return;

      this.endInteraction();
    },

    /**
     * Start interaction with this object
     */
    startInteraction: function(hand, handEl) {
      this.isInteracting = true;
      this.interactingHand = hand;
      this.interactingHandEl = handEl;

      // Emit interact-start event
      this.el.emit('interact-start', { hand: hand, type: this.data.type });

      // Type-specific start behavior
      switch (this.data.type) {
        case 'button':
          this.pressButton();
          break;
        case 'lever':
          this.startLeverDrag(handEl);
          break;
        case 'switch':
          this.toggleSwitch();
          this.endInteraction();  // Switch is instant
          break;
      }

      console.log('[Interactable] Interaction started: ' + this.data.type);
    },

    /**
     * End interaction with this object
     */
    endInteraction: function() {
      if (!this.isInteracting) return;

      var hand = this.interactingHand;

      // Type-specific end behavior
      switch (this.data.type) {
        case 'lever':
          this.endLeverDrag();
          break;
        // Button handles its own return via timer
        // Switch is instant (no end behavior)
      }

      this.isInteracting = false;
      this.interactingHand = null;
      this.interactingHandEl = null;

      // Emit interact-end event
      this.el.emit('interact-end', { hand: hand, type: this.data.type });

      console.log('[Interactable] Interaction ended: ' + this.data.type);
    },

    // ========== BUTTON BEHAVIOR ==========

    /**
     * Press the button down
     */
    pressButton: function() {
      if (this.value === 1) return;  // Already pressed

      var oldValue = this.value;
      this.value = 1;

      // Animate down
      var pos = this.el.object3D.position;
      pos.y = this.originalPosition.y - this.data.pressDepth;

      // Haptic feedback
      this.triggerHaptic('medium');

      // Emit state change
      if (oldValue !== this.value) {
        this.el.emit('state-change', { value: this.value, type: 'button' });
      }

      // Schedule return
      this.scheduleButtonReturn();
    },

    /**
     * Schedule button to return to up position
     */
    scheduleButtonReturn: function() {
      var self = this;

      // Clear existing timer
      if (this.returnTimer) {
        clearTimeout(this.returnTimer);
      }

      this.returnTimer = setTimeout(function() {
        self.releaseButton();
      }, this.data.returnDelay);
    },

    /**
     * Return button to up position
     */
    releaseButton: function() {
      if (this.value === 0) return;  // Already up

      var oldValue = this.value;
      this.value = 0;

      // Animate up
      var pos = this.el.object3D.position;
      pos.y = this.originalPosition.y;

      // Light haptic on release
      this.triggerHaptic('light');

      // Emit state change
      if (oldValue !== this.value) {
        this.el.emit('state-change', { value: this.value, type: 'button' });
      }

      this.returnTimer = null;
    },

    // ========== LEVER BEHAVIOR ==========

    /**
     * Start dragging lever
     */
    startLeverDrag: function(handEl) {
      // Store starting rotation
      this.dragStartRotation = this.getCurrentLeverRotation();

      // Calculate initial hand angle relative to lever
      this.dragStartHandAngle = this.getHandAngle(handEl);
    },

    /**
     * Update lever position during drag (called in tick)
     */
    updateLeverDrag: function() {
      if (!this.interactingHandEl) return;

      // Get current hand angle
      var currentHandAngle = this.getHandAngle(this.interactingHandEl);
      var angleDelta = currentHandAngle - this.dragStartHandAngle;

      // Apply rotation delta to lever
      var newRotation = this.dragStartRotation + angleDelta;

      // Clamp to range
      var minAngle = this.data.range.x;
      var maxAngle = this.data.range.y;
      newRotation = Math.max(minAngle, Math.min(maxAngle, newRotation));

      // Apply rotation on specified axis
      this.setLeverRotation(newRotation);

      // Calculate normalized value (0.0 to 1.0)
      var range = maxAngle - minAngle;
      var newValue = range !== 0 ? (newRotation - minAngle) / range : 0;

      // Check for value change (with threshold to avoid spam)
      if (Math.abs(newValue - this.value) > 0.01) {
        this.value = newValue;
        this.el.emit('state-change', { value: this.value, type: 'lever' });
      }
    },

    /**
     * End lever drag
     */
    endLeverDrag: function() {
      // Lever stays at current position (no snap back)
      // Light haptic feedback
      this.triggerHaptic('light');
    },

    /**
     * Get current lever rotation on the configured axis (degrees)
     */
    getCurrentLeverRotation: function() {
      var rot = this.el.object3D.rotation;
      switch (this.data.axis) {
        case 'x': return THREE.MathUtils.radToDeg(rot.x);
        case 'y': return THREE.MathUtils.radToDeg(rot.y);
        case 'z': return THREE.MathUtils.radToDeg(rot.z);
        default: return 0;
      }
    },

    /**
     * Set lever rotation on the configured axis
     */
    setLeverRotation: function(degrees) {
      var rot = this.el.object3D.rotation;
      var rad = THREE.MathUtils.degToRad(degrees);

      switch (this.data.axis) {
        case 'x': rot.x = rad; break;
        case 'y': rot.y = rad; break;
        case 'z': rot.z = rad; break;
      }
    },

    /**
     * Calculate hand angle relative to lever center (for drag tracking)
     */
    getHandAngle: function(handEl) {
      // Get positions
      this.el.object3D.getWorldPosition(tempVec1);
      handEl.object3D.getWorldPosition(tempVec2);

      // Calculate angle based on lever axis
      var dx = tempVec2.x - tempVec1.x;
      var dy = tempVec2.y - tempVec1.y;
      var dz = tempVec2.z - tempVec1.z;

      // Return angle in degrees based on axis
      switch (this.data.axis) {
        case 'x':
          return Math.atan2(dy, dz) * THREE.MathUtils.RAD2DEG;
        case 'y':
          return Math.atan2(dx, dz) * THREE.MathUtils.RAD2DEG;
        case 'z':
          return Math.atan2(dy, dx) * THREE.MathUtils.RAD2DEG;
        default:
          return 0;
      }
    },

    // ========== SWITCH BEHAVIOR ==========

    /**
     * Toggle switch state
     */
    toggleSwitch: function() {
      var oldValue = this.value;
      this.value = !this.value;

      // Visual feedback: rotate switch
      var rot = this.el.object3D.rotation;
      rot.x = this.value
        ? this.originalRotation.x + THREE.MathUtils.degToRad(30)
        : this.originalRotation.x;

      // Haptic feedback
      this.triggerHaptic('medium');

      // Emit state change
      this.el.emit('state-change', { value: this.value, type: 'switch' });

      console.log('[Interactable] Switch toggled: ' + this.value);
    },

    // ========== UTILITY METHODS ==========

    /**
     * Trigger haptic feedback on interacting hand
     */
    triggerHaptic: function(preset) {
      if (!window.Haptics) return;

      var hand = this.interactingHand || 'right';
      switch (preset) {
        case 'light':
          Haptics.light(hand);
          break;
        case 'medium':
          Haptics.medium(hand);
          break;
        case 'heavy':
          Haptics.heavy(hand);
          break;
      }
    },

    /**
     * Get distance from this element to a hand
     */
    getDistanceToHand: function(handEl) {
      this.el.object3D.getWorldPosition(tempVec1);
      handEl.object3D.getWorldPosition(tempVec2);
      return tempVec1.distanceTo(tempVec2);
    },

    /**
     * Determine hand side from element
     */
    getHandedness: function(handEl) {
      if (!handEl) return null;

      if (handEl.id === 'left-hand') return 'left';
      if (handEl.id === 'right-hand') return 'right';

      var trackedControls = handEl.getAttribute('tracked-controls');
      if (trackedControls && trackedControls.hand) {
        return trackedControls.hand;
      }

      var laserControls = handEl.getAttribute('laser-controls');
      if (laserControls && laserControls.hand) {
        return laserControls.hand;
      }

      return null;
    },

    /**
     * Get current value
     */
    getValue: function() {
      return this.value;
    },

    /**
     * Set value programmatically
     */
    setValue: function(newValue) {
      var oldValue = this.value;

      switch (this.data.type) {
        case 'button':
          // Clamp to 0 or 1
          newValue = newValue ? 1 : 0;
          if (newValue === 1) {
            this.pressButton();
          } else {
            this.releaseButton();
          }
          break;

        case 'lever':
          // Clamp to 0.0-1.0
          newValue = Math.max(0, Math.min(1, newValue));
          this.value = newValue;

          // Calculate rotation from normalized value
          var minAngle = this.data.range.x;
          var maxAngle = this.data.range.y;
          var rotation = minAngle + (newValue * (maxAngle - minAngle));
          this.setLeverRotation(rotation);

          // Emit state change if different
          if (Math.abs(oldValue - newValue) > 0.001) {
            this.el.emit('state-change', { value: this.value, type: 'lever' });
          }
          break;

        case 'switch':
          // Convert to boolean
          newValue = !!newValue;
          if (newValue !== this.value) {
            this.toggleSwitch();
          }
          break;
      }
    },

    tick: function(time, delta) {
      if (!systemEnabled) return;

      // Update lever drag if active
      if (this.isInteracting && this.data.type === 'lever') {
        this.updateLeverDrag();
      }
    }
  });

  /**
   * Find closest interactable to a hand within range
   */
  function findClosestInteractable(handEl, maxDistance) {
    var handPos = new THREE.Vector3();
    handEl.object3D.getWorldPosition(handPos);

    var closest = null;
    var closestDist = maxDistance;

    registeredInteractables.forEach(function(el) {
      var comp = el.components.interactable;
      if (!comp || comp.data.disabled) return;

      // Skip if already being interacted with
      if (comp.isInteracting) return;

      var objPos = new THREE.Vector3();
      el.object3D.getWorldPosition(objPos);
      var dist = handPos.distanceTo(objPos);

      if (dist < closestDist) {
        closestDist = dist;
        closest = el;
      }
    });

    return closest;
  }

  /**
   * Global Interactable API
   */
  window.Interactable = {
    /**
     * Enable the interactable system.
     */
    enable: function() {
      systemEnabled = true;
      console.log('[Interactable] System enabled');
    },

    /**
     * Disable the interactable system.
     */
    disable: function() {
      systemEnabled = false;
      console.log('[Interactable] System disabled');
    },

    /**
     * Check if system is enabled.
     * @returns {boolean}
     */
    isEnabled: function() {
      return systemEnabled;
    },

    /**
     * Get the current value of an interactable element.
     * @param {Element|string} el - Element or selector
     * @returns {number|boolean|null} Value (button: 0/1, lever: 0-1, switch: true/false)
     */
    getValue: function(el) {
      if (typeof el === 'string') {
        el = document.querySelector(el);
      }

      if (!el || !el.components || !el.components.interactable) {
        return null;
      }

      return el.components.interactable.getValue();
    },

    /**
     * Set the value of an interactable element programmatically.
     * @param {Element|string} el - Element or selector
     * @param {number|boolean} value - New value
     */
    setValue: function(el, value) {
      if (typeof el === 'string') {
        el = document.querySelector(el);
      }

      if (!el || !el.components || !el.components.interactable) {
        console.warn('[Interactable] Element does not have interactable component');
        return;
      }

      el.components.interactable.setValue(value);
    },

    /**
     * Get all registered interactable elements.
     * @returns {Element[]}
     */
    getAll: function() {
      return Array.from(registeredInteractables);
    },

    /**
     * Get all interactables of a specific type.
     * @param {string} type - 'button', 'lever', or 'switch'
     * @returns {Element[]}
     */
    getByType: function(type) {
      return Array.from(registeredInteractables).filter(function(el) {
        var comp = el.components.interactable;
        return comp && comp.data.type === type;
      });
    }
  };

  console.log('[Interactable] Module loaded');
})();
