/**
 * Grabbable - VR object interaction for Quest controllers
 * Usage: <script src="/framework/utils/haptics.js"></script>
 *        <script src="/framework/interaction/hand-model.js"></script> (optional)
 *        <script src="/framework/interaction/grabbable.js"></script>
 *
 * Mark objects as grabbable:
 *   <a-box grabbable></a-box>
 *   <a-sphere grabbable="grabDistance: 0.3; throwMultiplier: 1.5"></a-sphere>
 *
 * Events emitted on grabbable entity:
 *   - grab-start: { hand: 'left'|'right', handEl: entity }
 *   - grab-end:   { hand: 'left'|'right', handEl: entity }
 *   - thrown:     { hand: 'left'|'right', velocity: THREE.Vector3, speed: number }
 *
 * Integration:
 *   - If hand-model.js is loaded, grab/release will trigger hand animations
 *   - HandModel.grip(hand) called BEFORE object attaches (visual feedback)
 *   - HandModel.release(hand) called AFTER object detaches
 *
 * Global API:
 *   Grabbable.enable();    // Enable grab system (default)
 *   Grabbable.disable();   // Disable grab system
 *   Grabbable.getHeld('left');  // Get entity held by left hand (or null)
 */
(function() {
  'use strict';

  // Velocity tracking for throw detection
  var VELOCITY_SAMPLES = 5;
  var THROW_THRESHOLD = 0.5;  // m/s minimum for throw vs drop

  // Track what each hand is holding
  var heldObjects = {
    left: null,
    right: null
  };

  // System enabled state
  var systemEnabled = true;

  /**
   * Grabbable component - attach to entities that can be picked up
   */
  AFRAME.registerComponent('grabbable', {
    schema: {
      grabDistance: { type: 'number', default: 0.2 },    // Max distance to grab
      throwMultiplier: { type: 'number', default: 1.0 }, // Velocity multiplier for throws
      kinematic: { type: 'boolean', default: false }     // If true, doesn't restore physics
    },

    init: function() {
      this.isHeld = false;
      this.holdingHand = null;
      this.holdingHandEl = null;
      this.originalParent = this.el.parentNode;

      // Velocity tracking for throw detection - pre-allocated circular buffer
      this.positionHistory = [];
      for (var i = 0; i < VELOCITY_SAMPLES; i++) {
        this.positionHistory.push({
          position: new THREE.Vector3(),
          time: 0
        });
      }
      this.historyIndex = 0;      // Current write index in circular buffer
      this.historyCount = 0;      // Number of valid samples (0 to VELOCITY_SAMPLES)
      this.lastPosition = new THREE.Vector3();
      this.currentVelocity = new THREE.Vector3();
      this.tempPosition = new THREE.Vector3();  // Pre-allocated for tick()

      // Store original physics state if present
      this.hadDynamicBody = this.el.hasAttribute('dynamic-body');

      // Bind methods
      this.onGripDown = this.onGripDown.bind(this);
      this.onGripUp = this.onGripUp.bind(this);

      // Setup controller listeners
      this.setupControllers();
    },

    setupControllers: function() {
      var self = this;

      // Wait for scene to be ready
      var scene = this.el.sceneEl;
      if (!scene.hasLoaded) {
        scene.addEventListener('loaded', function() {
          self.attachControllerListeners();
        });
      } else {
        this.attachControllerListeners();
      }
    },

    attachControllerListeners: function() {
      var leftHand = document.getElementById('left-hand');
      var rightHand = document.getElementById('right-hand');

      if (leftHand) {
        leftHand.addEventListener('gripdown', this.onGripDown);
        leftHand.addEventListener('gripup', this.onGripUp);
      }

      if (rightHand) {
        rightHand.addEventListener('gripdown', this.onGripDown);
        rightHand.addEventListener('gripup', this.onGripUp);
      }
    },

    remove: function() {
      var leftHand = document.getElementById('left-hand');
      var rightHand = document.getElementById('right-hand');

      if (leftHand) {
        leftHand.removeEventListener('gripdown', this.onGripDown);
        leftHand.removeEventListener('gripup', this.onGripUp);
      }

      if (rightHand) {
        rightHand.removeEventListener('gripdown', this.onGripDown);
        rightHand.removeEventListener('gripup', this.onGripUp);
      }

      // Release if held
      if (this.isHeld) {
        this.release(false);
      }
    },

    onGripDown: function(evt) {
      if (!systemEnabled || this.isHeld) return;

      var handEl = evt.target;
      var hand = this.getHandedness(handEl);
      if (!hand) return;

      // Check if this hand is already holding something
      if (heldObjects[hand]) return;

      // Check distance to hand
      var distance = this.getDistanceToHand(handEl);
      if (distance > this.data.grabDistance) return;

      // Find the closest grabbable to this hand
      var closest = findClosestGrabbable(handEl, this.data.grabDistance);
      if (closest !== this.el) return;

      this.grab(hand, handEl);
    },

    onGripUp: function(evt) {
      if (!this.isHeld) return;

      var handEl = evt.target;
      var hand = this.getHandedness(handEl);

      // Only release if this is the hand holding the object
      if (hand !== this.holdingHand) return;

      this.release(true);
    },

    grab: function(hand, handEl) {
      this.isHeld = true;
      this.holdingHand = hand;
      this.holdingHandEl = handEl;
      heldObjects[hand] = this.el;

      // Trigger hand grip animation BEFORE attaching object (visual feedback)
      if (window.HandModel) {
        HandModel.grip(hand);
      }

      // Disable physics while held
      if (this.el.hasAttribute('dynamic-body')) {
        this.el.removeAttribute('dynamic-body');
      }

      // Reparent to hand
      var worldPos = new THREE.Vector3();
      var worldQuat = new THREE.Quaternion();
      this.el.object3D.getWorldPosition(worldPos);
      this.el.object3D.getWorldQuaternion(worldQuat);

      // Move to hand's coordinate space
      handEl.object3D.attach(this.el.object3D);

      // Reset velocity tracking (reuse buffer, just reset indices)
      this.historyIndex = 0;
      this.historyCount = 0;
      this.lastPosition.copy(worldPos);

      // Haptic feedback
      if (window.Haptics) {
        Haptics.medium(hand);
      }

      // Emit event
      this.el.emit('grab-start', {
        hand: hand,
        handEl: handEl
      });

      console.log('[Grabbable] Grabbed by ' + hand + ' hand');
    },

    release: function(calculateThrow) {
      var hand = this.holdingHand;
      var handEl = this.holdingHandEl;

      // Get world transform before detaching
      var worldPos = new THREE.Vector3();
      var worldQuat = new THREE.Quaternion();
      this.el.object3D.getWorldPosition(worldPos);
      this.el.object3D.getWorldQuaternion(worldQuat);

      // Calculate velocity before detaching
      var velocity = this.currentVelocity.clone();
      var speed = velocity.length();

      // Reparent back to original parent (or scene)
      var parent = this.originalParent || this.el.sceneEl;
      parent.object3D.attach(this.el.object3D);

      // Clear held state
      this.isHeld = false;
      heldObjects[hand] = null;
      this.holdingHand = null;
      this.holdingHandEl = null;

      // Trigger hand release animation AFTER detaching object
      if (window.HandModel) {
        HandModel.release(hand);
      }

      // Restore physics if originally had it
      if (this.hadDynamicBody && !this.data.kinematic) {
        this.el.setAttribute('dynamic-body', '');
      }

      // Emit appropriate event
      var isThrow = calculateThrow && speed > THROW_THRESHOLD;

      if (isThrow) {
        // Apply throw velocity multiplier
        velocity.multiplyScalar(this.data.throwMultiplier);

        this.el.emit('thrown', {
          hand: hand,
          velocity: velocity,
          speed: speed * this.data.throwMultiplier
        });

        // Strong haptic for throw
        if (window.Haptics) {
          Haptics.heavy(hand);
        }

        console.log('[Grabbable] Thrown at ' + speed.toFixed(2) + ' m/s');
      } else {
        this.el.emit('grab-end', {
          hand: hand,
          handEl: handEl
        });

        // Light haptic for drop
        if (window.Haptics) {
          Haptics.light(hand);
        }

        console.log('[Grabbable] Released (dropped)');
      }
    },

    tick: function(time, delta) {
      if (!this.isHeld) return;

      // Track velocity for throw detection
      this.trackVelocity(delta);
    },

    trackVelocity: function(delta) {
      if (delta <= 0) return;

      var currentPos = this.tempPosition;
      this.el.object3D.getWorldPosition(currentPos);

      // Calculate instantaneous velocity (m/s)
      var deltaSeconds = delta / 1000;
      this.currentVelocity.subVectors(currentPos, this.lastPosition);
      this.currentVelocity.divideScalar(deltaSeconds);

      // Store in circular buffer (no allocations - reuse pre-allocated objects)
      var entry = this.positionHistory[this.historyIndex];
      entry.position.copy(currentPos);
      entry.time = performance.now();

      // Advance circular buffer index
      this.historyIndex = (this.historyIndex + 1) % VELOCITY_SAMPLES;
      if (this.historyCount < VELOCITY_SAMPLES) {
        this.historyCount++;
      }

      // Smooth velocity using history (need at least 2 samples)
      if (this.historyCount >= 2) {
        // Oldest entry is at current historyIndex (next to be overwritten)
        // Newest entry is at (historyIndex - 1 + VELOCITY_SAMPLES) % VELOCITY_SAMPLES
        var oldestIdx = this.historyCount < VELOCITY_SAMPLES ? 0 : this.historyIndex;
        var newestIdx = (this.historyIndex - 1 + VELOCITY_SAMPLES) % VELOCITY_SAMPLES;

        var oldest = this.positionHistory[oldestIdx];
        var newest = this.positionHistory[newestIdx];
        var timeDiff = (newest.time - oldest.time) / 1000;

        if (timeDiff > 0) {
          this.currentVelocity.subVectors(newest.position, oldest.position);
          this.currentVelocity.divideScalar(timeDiff);
        }
      }

      this.lastPosition.copy(currentPos);
    },

    getDistanceToHand: function(handEl) {
      var handPos = new THREE.Vector3();
      var objPos = new THREE.Vector3();

      handEl.object3D.getWorldPosition(handPos);
      this.el.object3D.getWorldPosition(objPos);

      return handPos.distanceTo(objPos);
    },

    getHandedness: function(handEl) {
      if (!handEl) return null;

      // Check by ID
      if (handEl.id === 'left-hand') return 'left';
      if (handEl.id === 'right-hand') return 'right';

      // Check by tracked-controls component
      var trackedControls = handEl.getAttribute('tracked-controls');
      if (trackedControls && trackedControls.hand) {
        return trackedControls.hand;
      }

      // Check by laser-controls component
      var laserControls = handEl.getAttribute('laser-controls');
      if (laserControls && laserControls.hand) {
        return laserControls.hand;
      }

      return null;
    }
  });

  /**
   * Find the closest grabbable entity to a hand within range.
   * @param {Element} handEl - Hand entity
   * @param {number} maxDistance - Maximum grab distance
   * @returns {Element|null} Closest grabbable or null
   */
  function findClosestGrabbable(handEl, maxDistance) {
    var handPos = new THREE.Vector3();
    handEl.object3D.getWorldPosition(handPos);

    var grabbables = document.querySelectorAll('[grabbable]');
    var closest = null;
    var closestDist = maxDistance;

    for (var i = 0; i < grabbables.length; i++) {
      var el = grabbables[i];
      var comp = el.components.grabbable;

      // Skip if already held
      if (comp && comp.isHeld) continue;

      var objPos = new THREE.Vector3();
      el.object3D.getWorldPosition(objPos);
      var dist = handPos.distanceTo(objPos);

      if (dist < closestDist) {
        closestDist = dist;
        closest = el;
      }
    }

    return closest;
  }

  /**
   * Global Grabbable API
   */
  window.Grabbable = {
    /**
     * Enable the grab system (default state).
     */
    enable: function() {
      systemEnabled = true;
      console.log('[Grabbable] System enabled');
    },

    /**
     * Disable the grab system.
     */
    disable: function() {
      systemEnabled = false;
      console.log('[Grabbable] System disabled');
    },

    /**
     * Check if system is enabled.
     * @returns {boolean}
     */
    isEnabled: function() {
      return systemEnabled;
    },

    /**
     * Get the entity currently held by a hand.
     * @param {string} hand - 'left' or 'right'
     * @returns {Element|null}
     */
    getHeld: function(hand) {
      return heldObjects[hand] || null;
    },

    /**
     * Force release object from a hand.
     * @param {string} hand - 'left' or 'right'
     */
    forceRelease: function(hand) {
      var el = heldObjects[hand];
      if (el && el.components.grabbable) {
        el.components.grabbable.release(false);
      }
    },

    /**
     * Force release all held objects.
     */
    releaseAll: function() {
      this.forceRelease('left');
      this.forceRelease('right');
    }
  };

  console.log('[Grabbable] Module loaded');
})();
