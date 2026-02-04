/**
 * Teleport Controls - Point-and-teleport locomotion for VR
 * Usage: <script src="/framework/locomotion/teleport.js"></script>
 *
 * Attach to hand entity:
 *   <a-entity id="right-hand" teleport-controls="teleportable: .floor">
 *
 * Schema options:
 *   teleportable: CSS selector for valid teleport surfaces (default: '.teleportable')
 *   button: Controller button to activate (default: 'trigger')
 *   cursorColor: Valid destination color (default: '#00ff88')
 *   cursorInvalidColor: Invalid destination color (default: '#ff4444')
 *   landingMaxAngle: Max floor angle in degrees (default: 45)
 *   fadeDuration: Fade transition duration in ms (default: 150)
 *
 * Global API:
 *   Teleport.enable()   - Enable teleport on all hands
 *   Teleport.disable()  - Disable teleport on all hands
 */
(function() {
  'use strict';

  // Guard against A-Frame not loaded
  if (typeof AFRAME === 'undefined') {
    console.error('[Teleport] A-Frame not found. Load A-Frame before teleport.js');
    return;
  }

  // Reusable vectors (avoid GC)
  var _startPos = new THREE.Vector3();
  var _worldQuat = new THREE.Quaternion();
  var _direction = new THREE.Vector3();
  var _velocity = new THREE.Vector3();
  var _pos = new THREE.Vector3();
  var _vel = new THREE.Vector3();
  var _from = new THREE.Vector3();
  var _to = new THREE.Vector3();
  var _dir = new THREE.Vector3();
  var _upVec = new THREE.Vector3(0, 1, 0);

  var GRAVITY = new THREE.Vector3(0, -9.8, 0);

  AFRAME.registerComponent('teleport-controls', {
    schema: {
      teleportable: { type: 'string', default: '.teleportable' },
      button: { type: 'string', default: 'trigger' },
      cursorColor: { type: 'color', default: '#00ff88' },
      cursorInvalidColor: { type: 'color', default: '#ff4444' },
      landingMaxAngle: { type: 'number', default: 45 },
      fadeDuration: { type: 'number', default: 150 },
      enabled: { type: 'boolean', default: true }
    },

    init: function() {
      this.isAiming = false;
      this.hitPoint = new THREE.Vector3();
      this.hitNormal = new THREE.Vector3();
      this.isValidTarget = false;
      this.playerRig = null;
      this.arcPoints = [];

      // Reusable raycaster
      this.raycaster = new THREE.Raycaster();

      // Bind event handlers
      this.onButtonDown = this.onButtonDown.bind(this);
      this.onButtonUp = this.onButtonUp.bind(this);

      // Find player rig
      this.playerRig = document.getElementById('player-rig');
      if (!this.playerRig) {
        console.warn('[Teleport] No #player-rig found');
      }

      // Create visuals after scene ready
      var self = this;
      if (this.el.sceneEl.hasLoaded) {
        this.createVisuals();
      } else {
        this.el.sceneEl.addEventListener('loaded', function() {
          self.createVisuals();
        });
      }

      this.setupEvents();
      console.log('[Teleport] Component initialized on', this.el.id);
    },

    createVisuals: function() {
      this.createCursor();
      this.createArcLine();
      this.createFadeOverlay();
    },

    createCursor: function() {
      // Landing indicator ring
      this.cursor = document.createElement('a-entity');
      this.cursor.setAttribute('geometry', {
        primitive: 'ring',
        radiusInner: 0.3,
        radiusOuter: 0.4
      });
      this.cursor.setAttribute('material', {
        color: this.data.cursorColor,
        shader: 'flat',
        opacity: 0.8,
        side: 'double'
      });
      this.cursor.setAttribute('rotation', '-90 0 0');
      this.cursor.setAttribute('visible', false);
      this.cursor.classList.add('teleport-cursor');

      // Inner dot
      var dot = document.createElement('a-entity');
      dot.setAttribute('geometry', {
        primitive: 'circle',
        radius: 0.1
      });
      dot.setAttribute('material', {
        color: this.data.cursorColor,
        shader: 'flat',
        opacity: 0.6,
        side: 'double'
      });
      dot.setAttribute('position', '0 0.01 0');
      this.cursor.appendChild(dot);

      this.cursorDot = dot;
      this.el.sceneEl.appendChild(this.cursor);
    },

    createArcLine: function() {
      // Create arc line with THREE.js
      this.arcGeometry = new THREE.BufferGeometry();
      this.arcMaterial = new THREE.LineBasicMaterial({
        color: new THREE.Color(this.data.cursorColor),
        linewidth: 2,
        transparent: true,
        opacity: 0.7
      });

      // Pre-allocate arc points (max 30 segments)
      var positions = new Float32Array(30 * 3);
      this.arcGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      this.arcGeometry.setDrawRange(0, 0);

      this.arcLine = new THREE.Line(this.arcGeometry, this.arcMaterial);
      this.arcLine.frustumCulled = false;
      this.arcLine.visible = false;

      this.el.sceneEl.object3D.add(this.arcLine);
    },

    createFadeOverlay: function() {
      // Full-screen fade overlay for teleport transition
      var existing = document.getElementById('teleport-fade');
      if (existing) {
        this.fadeOverlay = existing;
        return;
      }

      this.fadeOverlay = document.createElement('a-plane');
      this.fadeOverlay.id = 'teleport-fade';
      this.fadeOverlay.setAttribute('position', '0 0 -0.3');
      this.fadeOverlay.setAttribute('width', 3);
      this.fadeOverlay.setAttribute('height', 3);
      this.fadeOverlay.setAttribute('material', {
        color: '#000000',
        shader: 'flat',
        transparent: true,
        opacity: 0,
        depthTest: false
      });
      this.fadeOverlay.setAttribute('visible', false);

      // Attach to camera
      var cameraEl = this.el.sceneEl.querySelector('[camera]');
      if (cameraEl) {
        cameraEl.appendChild(this.fadeOverlay);
      } else {
        console.warn('[Teleport] No camera found for fade overlay');
      }
    },

    setupEvents: function() {
      var el = this.el;
      var button = this.data.button;

      if (button === 'trigger') {
        el.addEventListener('triggerdown', this.onButtonDown);
        el.addEventListener('triggerup', this.onButtonUp);
      } else if (button === 'grip') {
        el.addEventListener('gripdown', this.onButtonDown);
        el.addEventListener('gripup', this.onButtonUp);
      } else if (button === 'thumbstick') {
        el.addEventListener('thumbstickdown', this.onButtonDown);
        el.addEventListener('thumbstickup', this.onButtonUp);
      }

      // Also handle trackpad for Vive controllers
      el.addEventListener('trackpaddown', this.onButtonDown);
      el.addEventListener('trackpadup', this.onButtonUp);
    },

    removeEvents: function() {
      var el = this.el;
      el.removeEventListener('triggerdown', this.onButtonDown);
      el.removeEventListener('triggerup', this.onButtonUp);
      el.removeEventListener('gripdown', this.onButtonDown);
      el.removeEventListener('gripup', this.onButtonUp);
      el.removeEventListener('thumbstickdown', this.onButtonDown);
      el.removeEventListener('thumbstickup', this.onButtonUp);
      el.removeEventListener('trackpaddown', this.onButtonDown);
      el.removeEventListener('trackpadup', this.onButtonUp);
    },

    onButtonDown: function() {
      if (!this.data.enabled) return;
      this.isAiming = true;
      if (this.cursor) this.cursor.setAttribute('visible', true);
      if (this.arcLine) this.arcLine.visible = true;
    },

    onButtonUp: function() {
      if (!this.data.enabled) return;
      if (!this.isAiming) return;

      this.isAiming = false;
      if (this.cursor) this.cursor.setAttribute('visible', false);
      if (this.arcLine) this.arcLine.visible = false;

      // Execute teleport if valid target
      if (this.isValidTarget && this.playerRig) {
        this.executeTeleport();
      }
    },

    executeTeleport: function() {
      var self = this;
      var rig = this.playerRig;
      var destination = this.hitPoint.clone();

      // Calculate offset from camera to rig (for standing position)
      var camera = document.querySelector('[camera]');
      var cameraWorldPos = new THREE.Vector3();
      var rigWorldPos = new THREE.Vector3();

      if (camera && camera.object3D) {
        camera.object3D.getWorldPosition(cameraWorldPos);
      }
      rig.object3D.getWorldPosition(rigWorldPos);

      // Horizontal offset (XZ only) between camera and rig
      var offsetX = cameraWorldPos.x - rigWorldPos.x;
      var offsetZ = cameraWorldPos.z - rigWorldPos.z;

      // Adjust destination for camera offset
      destination.x -= offsetX;
      destination.z -= offsetZ;

      // Emit pre-teleport event
      this.el.emit('teleport-start', { destination: destination });

      // Fade out then move
      this.fade(1, function() {
        rig.setAttribute('position', {
          x: destination.x,
          y: destination.y,
          z: destination.z
        });

        // Haptic feedback
        if (window.Haptics) {
          var hand = self.el.id.includes('left') ? 'left' : 'right';
          Haptics.medium(hand);
        }

        // Fade in
        self.fade(0, function() {
          self.el.emit('teleport-end', { destination: destination });
        });
      });
    },

    fade: function(targetOpacity, callback) {
      if (!this.fadeOverlay) {
        if (callback) callback();
        return;
      }

      var overlay = this.fadeOverlay;
      var duration = this.data.fadeDuration;
      var material = overlay.getAttribute('material');
      var startOpacity = material ? (material.opacity || 0) : 0;
      var startTime = performance.now();

      overlay.setAttribute('visible', true);

      function animate() {
        var elapsed = performance.now() - startTime;
        var progress = Math.min(elapsed / duration, 1);

        // Ease in-out
        var eased = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        var currentOpacity = startOpacity + (targetOpacity - startOpacity) * eased;
        overlay.setAttribute('material', 'opacity', currentOpacity);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          if (targetOpacity === 0) {
            overlay.setAttribute('visible', false);
          }
          if (callback) callback();
        }
      }

      requestAnimationFrame(animate);
    },

    tick: function() {
      if (!this.isAiming || !this.data.enabled) return;

      this.updateArc();
      this.checkIntersection();
      this.updateVisuals();
    },

    updateArc: function() {
      var object3D = this.el.object3D;

      // Get controller world position and direction
      object3D.getWorldPosition(_startPos);
      object3D.getWorldQuaternion(_worldQuat);

      // Direction controller is pointing (negative Z in local space)
      _direction.set(0, 0, -1).applyQuaternion(_worldQuat);

      // Initial velocity
      var strength = 6;
      _velocity.copy(_direction).multiplyScalar(strength);

      // Calculate arc points
      this.arcPoints.length = 0;
      _pos.copy(_startPos);
      _vel.copy(_velocity);
      var dt = 0.05;
      var maxSteps = 30;

      for (var i = 0; i < maxSteps; i++) {
        this.arcPoints.push(_pos.clone());

        // Simple projectile physics
        _vel.addScaledVector(GRAVITY, dt);
        _pos.addScaledVector(_vel, dt);

        // Stop if below ground level
        if (_pos.y < -1) break;
      }
    },

    checkIntersection: function() {
      this.isValidTarget = false;

      if (this.arcPoints.length < 2) return;

      var teleportableEls = document.querySelectorAll(this.data.teleportable);
      if (teleportableEls.length === 0) return;

      // Get Three.js mesh objects for raycasting
      var teleportObjects = [];
      teleportableEls.forEach(function(el) {
        if (el.object3D) {
          el.object3D.traverse(function(child) {
            if (child.isMesh) {
              teleportObjects.push(child);
            }
          });
        }
      });

      if (teleportObjects.length === 0) return;

      var raycaster = this.raycaster;

      // Check each arc segment for intersection
      for (var i = 0; i < this.arcPoints.length - 1; i++) {
        _from.copy(this.arcPoints[i]);
        _to.copy(this.arcPoints[i + 1]);
        _dir.subVectors(_to, _from);
        var length = _dir.length();
        _dir.normalize();

        raycaster.set(_from, _dir);
        raycaster.far = length;

        var intersects = raycaster.intersectObjects(teleportObjects, false);

        if (intersects.length > 0) {
          var hit = intersects[0];
          this.hitPoint.copy(hit.point);

          if (hit.face && hit.face.normal) {
            this.hitNormal.copy(hit.face.normal);

            // Check if surface angle is acceptable
            var angle = THREE.MathUtils.radToDeg(this.hitNormal.angleTo(_upVec));

            if (angle <= this.data.landingMaxAngle) {
              this.isValidTarget = true;
              // Trim arc to intersection point
              this.arcPoints.length = i + 1;
              this.arcPoints.push(this.hitPoint.clone());
            }
          } else {
            // No face normal, assume flat floor
            this.hitNormal.set(0, 1, 0);
            this.isValidTarget = true;
            this.arcPoints.length = i + 1;
            this.arcPoints.push(this.hitPoint.clone());
          }
          break;
        }
      }
    },

    updateVisuals: function() {
      var color = this.isValidTarget ? this.data.cursorColor : this.data.cursorInvalidColor;

      // Update cursor
      if (this.cursor) {
        if (this.isValidTarget) {
          this.cursor.setAttribute('position', this.hitPoint);
          this.cursor.setAttribute('visible', true);
        } else {
          this.cursor.setAttribute('visible', false);
        }

        this.cursor.setAttribute('material', 'color', color);
      }

      if (this.cursorDot) {
        this.cursorDot.setAttribute('material', 'color', color);
      }

      // Update arc line
      this.updateArcLine(color);
    },

    updateArcLine: function(color) {
      if (!this.arcLine || this.arcPoints.length < 2) {
        if (this.arcLine) this.arcLine.visible = false;
        return;
      }

      var positions = this.arcGeometry.attributes.position.array;
      var count = Math.min(this.arcPoints.length, 30);

      for (var i = 0; i < count; i++) {
        var p = this.arcPoints[i];
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;
      }

      this.arcGeometry.attributes.position.needsUpdate = true;
      this.arcGeometry.setDrawRange(0, count);

      // Update color
      this.arcMaterial.color.setStyle(color);
      this.arcLine.visible = true;
    },

    enable: function() {
      this.el.setAttribute('teleport-controls', 'enabled', true);
    },

    disable: function() {
      this.el.setAttribute('teleport-controls', 'enabled', false);
      this.isAiming = false;
      if (this.cursor) this.cursor.setAttribute('visible', false);
      if (this.arcLine) this.arcLine.visible = false;
    },

    remove: function() {
      this.removeEvents();

      // Clean up Three.js objects
      if (this.arcLine) {
        this.el.sceneEl.object3D.remove(this.arcLine);
        this.arcGeometry.dispose();
        this.arcMaterial.dispose();
      }

      // Remove cursor
      if (this.cursor && this.cursor.parentNode) {
        this.cursor.parentNode.removeChild(this.cursor);
      }

      // Remove fade overlay only if we created it
      if (this.fadeOverlay && this.fadeOverlay.id === 'teleport-fade') {
        var existing = document.getElementById('teleport-fade');
        if (existing && existing.parentNode) {
          existing.parentNode.removeChild(existing);
        }
      }
    }
  });

  // Global Teleport API
  window.Teleport = {
    /**
     * Enable teleport on all hands with teleport-controls.
     */
    enable: function() {
      var els = document.querySelectorAll('[teleport-controls]');
      els.forEach(function(el) {
        var comp = el.components['teleport-controls'];
        if (comp) comp.enable();
      });
    },

    /**
     * Disable teleport on all hands with teleport-controls.
     */
    disable: function() {
      var els = document.querySelectorAll('[teleport-controls]');
      els.forEach(function(el) {
        var comp = el.components['teleport-controls'];
        if (comp) comp.disable();
      });
    },

    /**
     * Check if teleport is enabled on any hand.
     * @returns {boolean}
     */
    isEnabled: function() {
      var els = document.querySelectorAll('[teleport-controls]');
      for (var i = 0; i < els.length; i++) {
        var comp = els[i].components['teleport-controls'];
        if (comp && comp.data.enabled) return true;
      }
      return false;
    }
  };

  console.log('[Teleport] Module loaded');
})();
