/**
 * Hand Model - 3D hand display with grip animation for Quest VR
 * Workaround for Quest 2/3 animation bug - manually controls hand pose
 *
 * Usage: <script src="/framework/utils/haptics.js"></script>
 *        <script src="/framework/interaction/hand-model.js"></script>
 *
 * Attach to hand entities:
 *   <a-entity id="left-hand" hand-model="hand: left"></a-entity>
 *   <a-entity id="right-hand" hand-model="hand: right; color: #ffcccc"></a-entity>
 *
 * Schema options:
 *   - hand: 'left' or 'right' (required)
 *   - color: Hand color (default: #ffd5c8 - skin tone)
 *   - modelStyle: 'lowPoly' (default), 'highPoly', or 'toon'
 *
 * Events (emitted on component entity):
 *   - hand-grip-start: { hand: 'left'|'right' }
 *   - hand-grip-end: { hand: 'left'|'right' }
 *
 * Global API:
 *   HandModel.grip('left');       // Animate to fist
 *   HandModel.release('left');    // Animate to open
 *   HandModel.setStyle('toon');   // Change model style globally
 *   HandModel.getHand('left');    // Get hand entity
 */
(function() {
  'use strict';

  // Animation timing
  var GRIP_DURATION = 100;  // ms for grip/release transition

  // Track registered hands
  var registeredHands = {
    left: null,
    right: null
  };

  // Default model style
  var globalModelStyle = 'lowPoly';

  // Hand model configurations
  var MODEL_CONFIGS = {
    lowPoly: {
      fingers: 5,
      segments: 2,
      detail: 'low'
    },
    highPoly: {
      fingers: 5,
      segments: 3,
      detail: 'high'
    },
    toon: {
      fingers: 4,
      segments: 2,
      detail: 'low',
      flatShading: true
    }
  };

  // Finger bone names for animation
  var FINGER_NAMES = ['thumb', 'index', 'middle', 'ring', 'pinky'];

  // Grip rotation targets (in radians)
  var GRIP_ROTATIONS = {
    thumb: { x: 0, y: 0, z: Math.PI * 0.4 },
    index: { x: Math.PI * 0.5, y: 0, z: 0 },
    middle: { x: Math.PI * 0.55, y: 0, z: 0 },
    ring: { x: Math.PI * 0.55, y: 0, z: 0 },
    pinky: { x: Math.PI * 0.5, y: 0, z: 0 }
  };

  /**
   * Hand Model component - displays 3D hand with grip animation
   */
  AFRAME.registerComponent('hand-model', {
    schema: {
      hand: { type: 'string', default: 'right', oneOf: ['left', 'right'] },
      color: { type: 'color', default: '#ffd5c8' },
      modelStyle: { type: 'string', default: 'lowPoly', oneOf: ['lowPoly', 'highPoly', 'toon'] }
    },

    init: function() {
      this.isGripping = false;
      this.gripProgress = 0;  // 0 = open, 1 = fist
      this.targetGripProgress = 0;
      this.animationStartTime = 0;
      this.animationStartProgress = 0;

      // Store finger bone references
      this.fingerBones = {};

      // Bind methods
      this.onGripDown = this.onGripDown.bind(this);
      this.onGripUp = this.onGripUp.bind(this);

      // Register this hand
      registeredHands[this.data.hand] = this.el;

      // Build hand model
      this.buildHandModel();

      // Setup controller event listeners
      this.setupControllerListeners();

      console.log('[HandModel] Initialized ' + this.data.hand + ' hand');
    },

    update: function(oldData) {
      // Handle color change
      if (oldData.color !== this.data.color) {
        this.updateHandColor();
      }

      // Handle model style change
      if (oldData.modelStyle !== this.data.modelStyle) {
        this.rebuildHandModel();
      }

      // Handle hand change (rare but possible)
      if (oldData.hand !== this.data.hand) {
        // Unregister old hand
        if (oldData.hand) {
          registeredHands[oldData.hand] = null;
        }
        // Register new hand
        registeredHands[this.data.hand] = this.el;
        this.rebuildHandModel();
      }
    },

    remove: function() {
      // Cleanup controller listeners
      this.removeControllerListeners();

      // Unregister hand
      if (registeredHands[this.data.hand] === this.el) {
        registeredHands[this.data.hand] = null;
      }

      // Remove hand mesh
      var handMesh = this.el.getObject3D('hand-mesh');
      if (handMesh) {
        this.el.removeObject3D('hand-mesh');
      }

      console.log('[HandModel] Removed ' + this.data.hand + ' hand');
    },

    /**
     * Build the 3D hand model geometry
     */
    buildHandModel: function() {
      var self = this;
      var isLeft = this.data.hand === 'left';
      var config = MODEL_CONFIGS[this.data.modelStyle] || MODEL_CONFIGS.lowPoly;

      // Create hand group
      var handGroup = new THREE.Group();
      handGroup.name = 'hand-' + this.data.hand;

      // Create material
      var materialOptions = {
        color: new THREE.Color(this.data.color),
        roughness: 0.7,
        metalness: 0.1
      };

      if (config.flatShading) {
        materialOptions.flatShading = true;
      }

      var material = new THREE.MeshStandardMaterial(materialOptions);
      this.handMaterial = material;

      // Palm dimensions
      var palmWidth = 0.08;
      var palmHeight = 0.02;
      var palmDepth = 0.1;

      // Create palm
      var palmGeometry = new THREE.BoxGeometry(palmWidth, palmHeight, palmDepth);
      var palm = new THREE.Mesh(palmGeometry, material);
      palm.name = 'palm';
      palm.position.set(0, 0, 0);
      handGroup.add(palm);

      // Create wrist attachment point
      var wristGeometry = new THREE.CylinderGeometry(0.015, 0.02, 0.03, 8);
      var wrist = new THREE.Mesh(wristGeometry, material);
      wrist.name = 'wrist';
      wrist.position.set(0, 0, palmDepth / 2 + 0.01);
      wrist.rotation.x = Math.PI / 2;
      handGroup.add(wrist);

      // Create fingers
      var fingerSpacing = palmWidth / (config.fingers === 4 ? 3 : 4);
      var fingerStartX = isLeft ? palmWidth / 2 - fingerSpacing / 2 : -palmWidth / 2 + fingerSpacing / 2;
      var fingerDirection = isLeft ? -1 : 1;

      var fingerNames = config.fingers === 4
        ? ['index', 'middle', 'ring', 'pinky']
        : FINGER_NAMES;

      fingerNames.forEach(function(fingerName, i) {
        var fingerGroup = self.createFinger(fingerName, material, config, isLeft);

        // Position finger
        var xOffset;
        if (fingerName === 'thumb') {
          // Thumb positioned on side of palm
          xOffset = isLeft ? palmWidth / 2 + 0.01 : -palmWidth / 2 - 0.01;
          fingerGroup.position.set(xOffset, 0, palmDepth / 4);
          fingerGroup.rotation.z = isLeft ? -Math.PI * 0.3 : Math.PI * 0.3;
          fingerGroup.rotation.y = isLeft ? Math.PI * 0.2 : -Math.PI * 0.2;
        } else {
          var fingerIndex = fingerName === 'index' ? 0 :
                           fingerName === 'middle' ? 1 :
                           fingerName === 'ring' ? 2 : 3;
          if (config.fingers === 4) {
            fingerIndex = i;
          }
          xOffset = fingerStartX + fingerDirection * fingerIndex * fingerSpacing;
          fingerGroup.position.set(xOffset, 0, -palmDepth / 2 + 0.01);
        }

        handGroup.add(fingerGroup);
        self.fingerBones[fingerName] = fingerGroup;
      });

      // Mirror for left hand
      if (isLeft) {
        handGroup.scale.x = -1;
      }

      // Position hand relative to controller
      handGroup.position.set(0, -0.02, -0.05);
      handGroup.rotation.set(-Math.PI * 0.1, 0, 0);

      // Add to entity
      this.el.setObject3D('hand-mesh', handGroup);
      this.handGroup = handGroup;
    },

    /**
     * Create a single finger with segments
     */
    createFinger: function(name, material, config, isLeft) {
      var fingerGroup = new THREE.Group();
      fingerGroup.name = name;

      // Finger dimensions vary by type
      var isThumb = name === 'thumb';
      var baseRadius = isThumb ? 0.012 : 0.008;
      var segmentLength = isThumb ? 0.025 : 0.022;
      var segments = isThumb ? 2 : config.segments;

      // Finger length multipliers
      var lengthMultipliers = {
        thumb: [1.0, 0.9],
        index: [1.0, 0.9, 0.7],
        middle: [1.1, 1.0, 0.8],
        ring: [1.0, 0.9, 0.7],
        pinky: [0.8, 0.7, 0.5]
      };

      var multipliers = lengthMultipliers[name] || [1.0, 0.9, 0.7];
      var currentGroup = fingerGroup;

      for (var i = 0; i < segments; i++) {
        // Create segment group (for rotation pivot)
        var segmentGroup = new THREE.Group();
        segmentGroup.name = name + '-segment-' + i;

        // Calculate segment size
        var radius = baseRadius * (1 - i * 0.15);
        var length = segmentLength * (multipliers[i] || 0.7);

        // Create segment mesh
        var segmentGeometry;
        if (config.detail === 'high') {
          segmentGeometry = new THREE.CapsuleGeometry(radius, length, 4, 8);
        } else {
          segmentGeometry = new THREE.CylinderGeometry(radius * 0.9, radius, length, 6);
        }

        var segment = new THREE.Mesh(segmentGeometry, material);
        segment.position.y = -length / 2;
        segment.name = name + '-bone-' + i;

        segmentGroup.add(segment);

        // Position at end of previous segment
        if (i === 0) {
          segmentGroup.position.y = 0;
        } else {
          var prevLength = segmentLength * (multipliers[i - 1] || 1.0);
          segmentGroup.position.y = -prevLength;
        }

        // Add knuckle sphere for high poly
        if (config.detail === 'high' && i > 0) {
          var knuckle = new THREE.Mesh(
            new THREE.SphereGeometry(radius * 1.1, 8, 8),
            material
          );
          knuckle.position.y = 0;
          segmentGroup.add(knuckle);
        }

        currentGroup.add(segmentGroup);
        currentGroup = segmentGroup;
      }

      // Store reference to first segment for rotation
      fingerGroup.userData.segments = [];
      this.collectSegments(fingerGroup, fingerGroup.userData.segments);

      return fingerGroup;
    },

    /**
     * Recursively collect segment groups for animation
     */
    collectSegments: function(group, segments) {
      var self = this;
      group.children.forEach(function(child) {
        if (child.name && child.name.includes('-segment-')) {
          segments.push(child);
          self.collectSegments(child, segments);
        }
      });
    },

    /**
     * Setup controller event listeners
     */
    setupControllerListeners: function() {
      // Listen on this entity (the hand)
      this.el.addEventListener('gripdown', this.onGripDown);
      this.el.addEventListener('gripup', this.onGripUp);

      // Also listen for trigger as alternative grip
      this.el.addEventListener('triggerdown', this.onGripDown);
      this.el.addEventListener('triggerup', this.onGripUp);
    },

    /**
     * Remove controller event listeners
     */
    removeControllerListeners: function() {
      this.el.removeEventListener('gripdown', this.onGripDown);
      this.el.removeEventListener('gripup', this.onGripUp);
      this.el.removeEventListener('triggerdown', this.onGripDown);
      this.el.removeEventListener('triggerup', this.onGripUp);
    },

    /**
     * Handle grip down event
     */
    onGripDown: function(evt) {
      if (this.isGripping) return;

      this.grip();
    },

    /**
     * Handle grip up event
     */
    onGripUp: function(evt) {
      if (!this.isGripping) return;

      this.release();
    },

    /**
     * Animate hand to fist pose
     */
    grip: function() {
      this.isGripping = true;
      this.targetGripProgress = 1;
      this.animationStartTime = performance.now();
      this.animationStartProgress = this.gripProgress;

      // Haptic feedback
      if (window.Haptics) {
        Haptics.light(this.data.hand);
      }

      // Emit event
      this.el.emit('hand-grip-start', { hand: this.data.hand });

      console.log('[HandModel] Grip ' + this.data.hand);
    },

    /**
     * Animate hand to open pose
     */
    release: function() {
      this.isGripping = false;
      this.targetGripProgress = 0;
      this.animationStartTime = performance.now();
      this.animationStartProgress = this.gripProgress;

      // Haptic feedback
      if (window.Haptics) {
        Haptics.light(this.data.hand);
      }

      // Emit event
      this.el.emit('hand-grip-end', { hand: this.data.hand });

      console.log('[HandModel] Release ' + this.data.hand);
    },

    /**
     * Animation tick
     */
    tick: function(time, delta) {
      // Skip if no animation needed
      if (this.gripProgress === this.targetGripProgress) return;

      // Calculate animation progress
      var elapsed = performance.now() - this.animationStartTime;
      var t = Math.min(1, elapsed / GRIP_DURATION);

      // Ease out cubic
      t = 1 - Math.pow(1 - t, 3);

      // Interpolate grip progress
      this.gripProgress = this.animationStartProgress +
        (this.targetGripProgress - this.animationStartProgress) * t;

      // Clamp
      if (t >= 1) {
        this.gripProgress = this.targetGripProgress;
      }

      // Apply finger rotations
      this.applyFingerRotations(this.gripProgress);
    },

    /**
     * Apply finger rotations based on grip progress
     */
    applyFingerRotations: function(progress) {
      var self = this;
      var isLeft = this.data.hand === 'left';

      Object.keys(this.fingerBones).forEach(function(fingerName) {
        var fingerGroup = self.fingerBones[fingerName];
        if (!fingerGroup || !fingerGroup.userData.segments) return;

        var targetRotation = GRIP_ROTATIONS[fingerName] || GRIP_ROTATIONS.index;
        var segments = fingerGroup.userData.segments;

        segments.forEach(function(segment, i) {
          // Each segment rotates progressively
          var segmentProgress = progress * (1 - i * 0.1);

          // Apply rotation (primarily around X for curl)
          segment.rotation.x = targetRotation.x * segmentProgress;

          // Thumb has special Y and Z rotation
          if (fingerName === 'thumb' && i === 0) {
            segment.rotation.y = targetRotation.y * segmentProgress;
            segment.rotation.z = targetRotation.z * segmentProgress;
          }
        });
      });
    },

    /**
     * Update hand material color
     */
    updateHandColor: function() {
      if (this.handMaterial) {
        this.handMaterial.color.set(this.data.color);
      }
    },

    /**
     * Rebuild hand model (for style changes)
     */
    rebuildHandModel: function() {
      // Remove old mesh
      var oldMesh = this.el.getObject3D('hand-mesh');
      if (oldMesh) {
        this.el.removeObject3D('hand-mesh');
      }

      // Reset state
      this.fingerBones = {};
      this.gripProgress = 0;
      this.targetGripProgress = 0;
      this.isGripping = false;

      // Rebuild
      this.buildHandModel();

      console.log('[HandModel] Rebuilt ' + this.data.hand + ' hand with style: ' + this.data.modelStyle);
    },

    /**
     * Get current grip progress (0-1)
     */
    getGripProgress: function() {
      return this.gripProgress;
    },

    /**
     * Check if hand is gripping
     */
    isGripped: function() {
      return this.isGripping;
    }
  });

  /**
   * Global HandModel API
   */
  window.HandModel = {
    /**
     * Animate specified hand to fist pose.
     * @param {string} hand - 'left' or 'right'
     */
    grip: function(hand) {
      var el = registeredHands[hand];
      if (el && el.components['hand-model']) {
        el.components['hand-model'].grip();
      }
    },

    /**
     * Animate specified hand to open pose.
     * @param {string} hand - 'left' or 'right'
     */
    release: function(hand) {
      var el = registeredHands[hand];
      if (el && el.components['hand-model']) {
        el.components['hand-model'].release();
      }
    },

    /**
     * Set model style globally for new hands.
     * Does not affect existing hands (use component update).
     * @param {string} style - 'lowPoly', 'highPoly', or 'toon'
     */
    setStyle: function(style) {
      if (['lowPoly', 'highPoly', 'toon'].indexOf(style) !== -1) {
        globalModelStyle = style;
        console.log('[HandModel] Global style set to: ' + style);
      }
    },

    /**
     * Get the current global model style.
     * @returns {string}
     */
    getStyle: function() {
      return globalModelStyle;
    },

    /**
     * Get a registered hand entity.
     * @param {string} hand - 'left' or 'right'
     * @returns {Element|null}
     */
    getHand: function(hand) {
      return registeredHands[hand] || null;
    },

    /**
     * Get grip progress for a hand.
     * @param {string} hand - 'left' or 'right'
     * @returns {number} 0-1 (0 = open, 1 = fist)
     */
    getGripProgress: function(hand) {
      var el = registeredHands[hand];
      if (el && el.components['hand-model']) {
        return el.components['hand-model'].getGripProgress();
      }
      return 0;
    },

    /**
     * Check if a hand is currently gripping.
     * @param {string} hand - 'left' or 'right'
     * @returns {boolean}
     */
    isGripping: function(hand) {
      var el = registeredHands[hand];
      if (el && el.components['hand-model']) {
        return el.components['hand-model'].isGripped();
      }
      return false;
    },

    /**
     * Grip both hands.
     */
    gripBoth: function() {
      this.grip('left');
      this.grip('right');
    },

    /**
     * Release both hands.
     */
    releaseBoth: function() {
      this.release('left');
      this.release('right');
    }
  };

  console.log('[HandModel] Module loaded');
})();
