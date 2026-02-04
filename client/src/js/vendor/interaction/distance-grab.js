/**
 * Distance Grab - Remote object grabbing for VR
 * Usage: <script src="/framework/utils/haptics.js"></script>
 *        <script src="/framework/interaction/grabbable.js"></script>
 *        <script src="/framework/interaction/distance-grab.js"></script>
 *
 * Mark objects as distance-grabbable:
 *   <a-box distance-grabbable></a-box>
 *   <a-sphere distance-grabbable="maxDistance: 15; pullSpeed: 10"></a-sphere>
 *
 * Schema options:
 *   - maxDistance: Maximum grab distance in meters (default: 10)
 *   - pullSpeed: Speed at which object flies toward hand (default: 8 m/s)
 *   - pullCurve: Easing curve for pull ('linear', 'easeOut', 'easeInOut') (default: 'easeOut')
 *   - catchDistance: Distance at which object attaches to hand (default: 0.2m)
 *   - arcHeight: Height of arc during pull (default: 0.3m)
 *   - glowColor: Highlight color during pull (default: '#00ffff')
 *   - glowIntensity: Emissive intensity during pull (default: 0.5)
 *
 * Events emitted on entity:
 *   - pull-start: { hand: 'left'|'right', handEl: entity }
 *   - pull-complete: { hand: 'left'|'right', handEl: entity }
 *   - pull-cancel: { hand: 'left'|'right', velocity: THREE.Vector3 }
 *
 * Global API:
 *   DistanceGrab.enable();           // Enable distance grab system
 *   DistanceGrab.disable();          // Disable distance grab system
 *   DistanceGrab.isEnabled();        // Check if system is enabled
 *   DistanceGrab.getPulling(hand);   // Get entity being pulled by hand
 *   DistanceGrab.cancelPull(hand);   // Cancel active pull for hand
 */
(function() {
  'use strict';

  // System state
  var systemEnabled = true;

  // Track what each hand is pulling
  var pullingObjects = {
    left: null,
    right: null
  };

  // Pre-allocated vectors for calculations
  var _tempVec3A = new THREE.Vector3();
  var _tempVec3B = new THREE.Vector3();
  var _tempVec3C = new THREE.Vector3();
  var _tempVec3D = new THREE.Vector3();  // Bezier output
  var _tempMatrix4 = new THREE.Matrix4(); // For world-to-local conversion

  // Easing functions
  var EASING = {
    linear: function(t) { return t; },
    easeOut: function(t) { return 1 - Math.pow(1 - t, 3); },
    easeInOut: function(t) {
      return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
  };

  /**
   * Distance Grabbable component - attach to entities for remote grabbing
   */
  AFRAME.registerComponent('distance-grabbable', {
    schema: {
      maxDistance: { type: 'number', default: 10 },
      pullSpeed: { type: 'number', default: 8 },
      pullCurve: { type: 'string', default: 'easeOut' },
      catchDistance: { type: 'number', default: 0.2 },
      arcHeight: { type: 'number', default: 0.3 },
      glowColor: { type: 'color', default: '#00ffff' },
      glowIntensity: { type: 'number', default: 0.5 },
      enabled: { type: 'boolean', default: true }
    },

    init: function() {
      this.isPulling = false;
      this.pullingHand = null;
      this.pullingHandEl = null;

      // Pull animation state
      this.pullProgress = 0;
      this.pullStartPosition = new THREE.Vector3();
      this.pullStartTime = 0;
      this.pullDuration = 0;
      this.controlPoint = new THREE.Vector3();

      // Store original material state for glow
      this.originalEmissive = null;
      this.originalEmissiveIntensity = 0;
      this.materialsStored = false;

      // Velocity tracking for cancel drop
      this.lastPosition = new THREE.Vector3();
      this.currentVelocity = new THREE.Vector3();

      // Bind methods
      this.onGripDown = this.onGripDown.bind(this);
      this.onGripUp = this.onGripUp.bind(this);
      this.onRaycasterIntersection = this.onRaycasterIntersection.bind(this);
      this.onRaycasterIntersectionCleared = this.onRaycasterIntersectionCleared.bind(this);

      // Track if laser is pointing at this object
      this.isTargeted = false;
      this.targetingHand = null;
      this.targetingHandEl = null;

      // Setup controller listeners
      this.setupControllers();

      console.log('[DistanceGrab] Component initialized');
    },

    setupControllers: function() {
      var self = this;
      var scene = this.el.sceneEl;

      var setupListeners = function() {
        var leftHand = document.getElementById('left-hand');
        var rightHand = document.getElementById('right-hand');

        if (leftHand) {
          leftHand.addEventListener('gripdown', self.onGripDown);
          leftHand.addEventListener('gripup', self.onGripUp);
          leftHand.addEventListener('raycaster-intersection', self.onRaycasterIntersection);
          leftHand.addEventListener('raycaster-intersection-cleared', self.onRaycasterIntersectionCleared);
        }

        if (rightHand) {
          rightHand.addEventListener('gripdown', self.onGripDown);
          rightHand.addEventListener('gripup', self.onGripUp);
          rightHand.addEventListener('raycaster-intersection', self.onRaycasterIntersection);
          rightHand.addEventListener('raycaster-intersection-cleared', self.onRaycasterIntersectionCleared);
        }
      };

      if (scene.hasLoaded) {
        setupListeners();
      } else {
        scene.addEventListener('loaded', setupListeners);
      }
    },

    remove: function() {
      var leftHand = document.getElementById('left-hand');
      var rightHand = document.getElementById('right-hand');

      if (leftHand) {
        leftHand.removeEventListener('gripdown', this.onGripDown);
        leftHand.removeEventListener('gripup', this.onGripUp);
        leftHand.removeEventListener('raycaster-intersection', this.onRaycasterIntersection);
        leftHand.removeEventListener('raycaster-intersection-cleared', this.onRaycasterIntersectionCleared);
      }

      if (rightHand) {
        rightHand.removeEventListener('gripdown', this.onGripDown);
        rightHand.removeEventListener('gripup', this.onGripUp);
        rightHand.removeEventListener('raycaster-intersection', this.onRaycasterIntersection);
        rightHand.removeEventListener('raycaster-intersection-cleared', this.onRaycasterIntersectionCleared);
      }

      // Cancel pull if active
      if (this.isPulling) {
        this.cancelPull();
      }

      // Restore material
      this.restoreOriginalMaterial();
    },

    /**
     * Handle raycaster intersection (laser pointing at object)
     */
    onRaycasterIntersection: function(evt) {
      if (!systemEnabled || !this.data.enabled) return;
      if (this.isPulling) return;

      // Check if this entity is in the intersection list
      var els = evt.detail.els;
      var found = false;

      for (var i = 0; i < els.length; i++) {
        if (els[i] === this.el) {
          found = true;
          break;
        }
      }

      if (!found) return;

      var handEl = evt.target;
      var hand = this.getHandedness(handEl);
      if (!hand) return;

      // Check distance
      var distance = this.getDistanceToHand(handEl);
      if (distance > this.data.maxDistance) return;

      // Don't target if too close (let regular grabbable handle it)
      var grabbable = this.el.components.grabbable;
      if (grabbable && distance <= grabbable.data.grabDistance) return;

      this.isTargeted = true;
      this.targetingHand = hand;
      this.targetingHandEl = handEl;
    },

    /**
     * Handle raycaster intersection cleared
     */
    onRaycasterIntersectionCleared: function(evt) {
      var handEl = evt.target;
      var hand = this.getHandedness(handEl);

      // Only clear if this was the targeting hand
      if (hand === this.targetingHand) {
        this.isTargeted = false;
        this.targetingHand = null;
        this.targetingHandEl = null;
      }
    },

    /**
     * Handle grip button press
     */
    onGripDown: function(evt) {
      if (!systemEnabled || !this.data.enabled) return;
      if (this.isPulling) return;

      var handEl = evt.target;
      var hand = this.getHandedness(handEl);
      if (!hand) return;

      // Check if this hand is already pulling something
      if (pullingObjects[hand]) return;

      // Check if this entity is being targeted by this hand
      if (!this.isTargeted || this.targetingHand !== hand) return;

      // Check if regular grabbable would handle this (too close)
      var grabbable = this.el.components.grabbable;
      if (grabbable) {
        var distance = this.getDistanceToHand(handEl);
        if (distance <= grabbable.data.grabDistance) return;
        if (grabbable.isHeld) return;
      }

      // Find the closest distance-grabbable to this hand's laser
      var closest = findClosestTargeted(hand);
      if (closest !== this.el) return;

      this.startPull(hand, handEl);
    },

    /**
     * Handle grip button release
     */
    onGripUp: function(evt) {
      if (!this.isPulling) return;

      var handEl = evt.target;
      var hand = this.getHandedness(handEl);

      // Only cancel if this is the hand that's pulling
      if (hand !== this.pullingHand) return;

      this.cancelPull();
    },

    /**
     * Start pulling the object toward the hand
     */
    startPull: function(hand, handEl) {
      this.isPulling = true;
      this.pullingHand = hand;
      this.pullingHandEl = handEl;
      pullingObjects[hand] = this.el;

      // Store start position
      this.el.object3D.getWorldPosition(this.pullStartPosition);
      this.pullStartTime = performance.now();
      this.pullProgress = 0;

      // Calculate pull duration based on distance and speed
      var handPos = _tempVec3A;
      handEl.object3D.getWorldPosition(handPos);
      var distance = this.pullStartPosition.distanceTo(handPos);
      this.pullDuration = (distance / this.data.pullSpeed) * 1000;

      // Calculate control point for arc (midpoint raised up)
      this.controlPoint.lerpVectors(this.pullStartPosition, handPos, 0.5);
      this.controlPoint.y += this.data.arcHeight;

      // Initialize velocity tracking
      this.lastPosition.copy(this.pullStartPosition);

      // Disable physics while pulling
      if (this.el.hasAttribute('dynamic-body')) {
        this.el.removeAttribute('dynamic-body');
      }
      if (this.el.components['simple-body']) {
        window.SimplePhysics && SimplePhysics.stopPhysics(this.el);
      }

      // Store and apply glow
      this.storeOriginalMaterial();
      this.applyGlow(1);

      // Haptic feedback
      if (window.Haptics) {
        Haptics.light(hand);
      }

      // Emit event
      this.el.emit('pull-start', {
        hand: hand,
        handEl: handEl
      });

      console.log('[DistanceGrab] Pull started by ' + hand + ' hand');
    },

    /**
     * Complete the pull - attach object to hand
     */
    completePull: function() {
      var hand = this.pullingHand;
      var handEl = this.pullingHandEl;

      // Clear pull state
      this.isPulling = false;
      pullingObjects[hand] = null;
      this.pullingHand = null;
      this.pullingHandEl = null;
      this.pullProgress = 0;

      // Restore material
      this.restoreOriginalMaterial();

      // Strong haptic on catch
      if (window.Haptics) {
        Haptics.heavy(hand);
      }

      // Emit event
      this.el.emit('pull-complete', {
        hand: hand,
        handEl: handEl
      });

      // Trigger grab on the grabbable component
      var grabbable = this.el.components.grabbable;
      if (grabbable && !grabbable.isHeld) {
        grabbable.grab(hand, handEl);
      }

      console.log('[DistanceGrab] Pull complete, attached to ' + hand + ' hand');
    },

    /**
     * Cancel the pull - drop object with physics
     */
    cancelPull: function() {
      var hand = this.pullingHand;
      var handEl = this.pullingHandEl;
      var velocity = this.currentVelocity.clone();

      // Clear pull state
      this.isPulling = false;
      if (hand) {
        pullingObjects[hand] = null;
      }
      this.pullingHand = null;
      this.pullingHandEl = null;
      this.pullProgress = 0;

      // Restore material
      this.restoreOriginalMaterial();

      // Light haptic on cancel
      if (window.Haptics && hand) {
        Haptics.light(hand);
      }

      // Apply physics to dropped object
      if (window.SimplePhysics) {
        SimplePhysics.applyThrow(this.el, velocity, {
          bounciness: 0.4,
          drag: 0.02
        });
      }

      // Emit event
      this.el.emit('pull-cancel', {
        hand: hand,
        velocity: velocity
      });

      console.log('[DistanceGrab] Pull cancelled');
    },

    /**
     * Animation tick - update pull position
     */
    tick: function(time, delta) {
      if (!this.isPulling || !this.pullingHandEl) return;

      // Update pull progress
      var elapsed = performance.now() - this.pullStartTime;
      var t = Math.min(1, elapsed / this.pullDuration);

      // Apply easing
      var easing = EASING[this.data.pullCurve] || EASING.easeOut;
      this.pullProgress = easing(t);

      // Get current hand position (world space)
      var handPos = _tempVec3A;
      this.pullingHandEl.object3D.getWorldPosition(handPos);

      // Calculate position along quadratic bezier curve (world space)
      var newWorldPos = this.quadraticBezier(
        this.pullStartPosition,
        this.controlPoint,
        handPos,
        this.pullProgress,
        _tempVec3D
      );

      // Track velocity for cancel drop (in world space)
      if (delta > 0) {
        var dt = delta / 1000;
        this.currentVelocity.subVectors(newWorldPos, this.lastPosition).divideScalar(dt);
        this.lastPosition.copy(newWorldPos);
      }

      // Convert world position to local position for the entity's parent
      var parent = this.el.object3D.parent;
      if (parent) {
        // Get parent's world matrix inverse to convert world -> local
        _tempMatrix4.copy(parent.matrixWorld).invert();
        _tempVec3B.copy(newWorldPos).applyMatrix4(_tempMatrix4);
        this.el.object3D.position.copy(_tempVec3B);
      } else {
        // No parent (or scene root), world = local
        this.el.object3D.position.copy(newWorldPos);
      }

      // Pulse haptic during pull
      if (window.Haptics && Math.random() < 0.1) {
        Haptics.pulse(this.pullingHand, 0.1, 30);
      }

      // Check if close enough to catch
      var distanceToHand = newWorldPos.distanceTo(handPos);
      if (distanceToHand <= this.data.catchDistance) {
        this.completePull();
        return;
      }

      // Update glow intensity based on progress (pulse effect)
      var glowPulse = 0.7 + 0.3 * Math.sin(time * 0.01);
      this.applyGlow(glowPulse);
    },

    /**
     * Calculate point on quadratic bezier curve
     * @param {THREE.Vector3} p0 - Start point
     * @param {THREE.Vector3} p1 - Control point
     * @param {THREE.Vector3} p2 - End point
     * @param {number} t - Progress (0-1)
     * @param {THREE.Vector3} out - Output vector (reused to avoid allocation)
     * @returns {THREE.Vector3} The output vector
     */
    quadraticBezier: function(p0, p1, p2, t, out) {
      var oneMinusT = 1 - t;

      // B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
      out.set(0, 0, 0);

      // (1-t)^2 * P0
      _tempVec3C.copy(p0).multiplyScalar(oneMinusT * oneMinusT);
      out.add(_tempVec3C);

      // 2(1-t)t * P1
      _tempVec3C.copy(p1).multiplyScalar(2 * oneMinusT * t);
      out.add(_tempVec3C);

      // t^2 * P2
      _tempVec3C.copy(p2).multiplyScalar(t * t);
      out.add(_tempVec3C);

      return out;
    },

    /**
     * Store original material properties
     */
    storeOriginalMaterial: function() {
      if (this.materialsStored) return;

      var mesh = this.el.getObject3D('mesh');
      if (!mesh || !mesh.material) return;

      var material = mesh.material;

      if (material.emissive) {
        this.originalEmissive = material.emissive.clone();
        this.originalEmissiveIntensity = material.emissiveIntensity || 0;
      }

      this.materialsStored = true;
    },

    /**
     * Apply glow effect
     */
    applyGlow: function(intensity) {
      var mesh = this.el.getObject3D('mesh');
      if (!mesh || !mesh.material) return;

      var material = mesh.material;
      if (!material.emissive) return;

      material.emissive.set(this.data.glowColor);
      material.emissiveIntensity = this.data.glowIntensity * intensity;
    },

    /**
     * Restore original material
     */
    restoreOriginalMaterial: function() {
      if (!this.materialsStored) return;

      var mesh = this.el.getObject3D('mesh');
      if (!mesh || !mesh.material) return;

      var material = mesh.material;

      if (this.originalEmissive && material.emissive) {
        material.emissive.copy(this.originalEmissive);
        material.emissiveIntensity = this.originalEmissiveIntensity;
      }

      this.materialsStored = false;
    },

    /**
     * Get distance to hand
     */
    getDistanceToHand: function(handEl) {
      var handPos = _tempVec3A;
      var objPos = _tempVec3B;

      handEl.object3D.getWorldPosition(handPos);
      this.el.object3D.getWorldPosition(objPos);

      return handPos.distanceTo(objPos);
    },

    /**
     * Get handedness from hand element
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
    }
  });

  /**
   * Find the closest distance-grabbable being targeted by a hand
   */
  function findClosestTargeted(hand) {
    var grabbables = document.querySelectorAll('[distance-grabbable]');
    var closest = null;
    var closestDist = Infinity;

    for (var i = 0; i < grabbables.length; i++) {
      var el = grabbables[i];
      var comp = el.components['distance-grabbable'];

      if (!comp || !comp.isTargeted) continue;
      if (comp.targetingHand !== hand) continue;
      if (comp.isPulling) continue;

      var handEl = comp.targetingHandEl;
      if (!handEl) continue;

      var dist = comp.getDistanceToHand(handEl);
      if (dist < closestDist) {
        closestDist = dist;
        closest = el;
      }
    }

    return closest;
  }

  /**
   * Global DistanceGrab API
   */
  window.DistanceGrab = {
    /**
     * Enable the distance grab system.
     */
    enable: function() {
      systemEnabled = true;
      console.log('[DistanceGrab] System enabled');
    },

    /**
     * Disable the distance grab system.
     */
    disable: function() {
      systemEnabled = false;
      console.log('[DistanceGrab] System disabled');
    },

    /**
     * Check if system is enabled.
     * @returns {boolean}
     */
    isEnabled: function() {
      return systemEnabled;
    },

    /**
     * Get the entity currently being pulled by a hand.
     * @param {string} hand - 'left' or 'right'
     * @returns {Element|null}
     */
    getPulling: function(hand) {
      return pullingObjects[hand] || null;
    },

    /**
     * Cancel active pull for a hand.
     * @param {string} hand - 'left' or 'right'
     */
    cancelPull: function(hand) {
      var el = pullingObjects[hand];
      if (el && el.components['distance-grabbable']) {
        el.components['distance-grabbable'].cancelPull();
      }
    },

    /**
     * Cancel all active pulls.
     */
    cancelAll: function() {
      this.cancelPull('left');
      this.cancelPull('right');
    },

    /**
     * Check if a hand is currently pulling something.
     * @param {string} hand - 'left' or 'right'
     * @returns {boolean}
     */
    isPulling: function(hand) {
      return pullingObjects[hand] !== null;
    }
  };

  console.log('[DistanceGrab] Module loaded');
})();
