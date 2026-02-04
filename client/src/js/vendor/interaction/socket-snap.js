/**
 * Socket Snap - Object attachment points for VR
 * Usage: <script src="/framework/utils/haptics.js"></script>
 *        <script src="/framework/interaction/grabbable.js"></script>
 *        <script src="/framework/interaction/socket-snap.js"></script>
 *
 * Mark sockets (attachment points):
 *   <a-entity socket="accepts: weapon; snapDistance: 0.3"></a-entity>
 *   <a-entity socket="accepts: any"></a-entity>
 *
 * Mark snappable objects:
 *   <a-box snappable="type: weapon" grabbable></a-box>
 *   <a-sphere snappable="type: orb" grabbable></a-sphere>
 *
 * Events on socket:
 *   - socket-attach: { object: Element }
 *   - socket-detach: { object: Element }
 *
 * Events on snappable object:
 *   - snapped: { socket: Element }
 *   - unsnapped: { socket: Element }
 *
 * Global API:
 *   Socket.getOccupied(socketEl);           // Get attached object or null
 *   Socket.snap(objectEl, socketEl);        // Force snap programmatically
 *   Socket.unsnap(socketEl);                // Force unsnap
 *   Socket.findNearestSocket(objectEl);     // Find compatible socket in range
 *   Socket.enable();                        // Enable system
 *   Socket.disable();                       // Disable system
 */
(function() {
  'use strict';

  // Animation timing
  var SNAP_DURATION = 100;  // ms for snap animation

  // Highlight pulse timing
  var HIGHLIGHT_PULSE_SPEED = 2;  // pulses per second

  // System state
  var systemEnabled = true;

  // Track all sockets and snappables
  var registeredSockets = new Set();
  var registeredSnappables = new Set();

  // Pre-allocated vectors for calculations
  var tempVec1 = new THREE.Vector3();
  var tempVec2 = new THREE.Vector3();
  var tempQuat = new THREE.Quaternion();

  /**
   * Socket component - marks attachment points
   */
  AFRAME.registerComponent('socket', {
    schema: {
      accepts: { type: 'string', default: 'any' },     // Type(s) accepted, comma-separated or 'any'
      snapDistance: { type: 'number', default: 0.3 },  // Detection radius
      occupied: { type: 'boolean', default: false },   // Read-only, tracks if occupied
      highlightColor: { type: 'color', default: '#00ff00' },  // Highlight when compatible nearby
      highlightIntensity: { type: 'number', default: 0.5 }    // Highlight intensity (0-1)
    },

    init: function() {
      this.occupiedBy = null;       // Reference to snapped object
      this.isHighlighted = false;   // Visual highlight state
      this.highlightProgress = 0;   // For pulse animation
      this.nearbyCompatible = null; // Nearby compatible object being tracked

      // Store original material for highlight
      this.originalEmissive = null;
      this.originalEmissiveIntensity = 0;
      this.materialsStored = false;

      // Register socket
      registeredSockets.add(this.el);

      console.log('[Socket] Registered socket accepting: ' + this.data.accepts);
    },

    remove: function() {
      // Unsnap if occupied
      if (this.occupiedBy) {
        this.detach();
      }

      // Restore original material
      this.restoreOriginalMaterial();

      // Unregister
      registeredSockets.delete(this.el);

      console.log('[Socket] Removed socket');
    },

    /**
     * Check if socket accepts a given type
     * @param {string} type - Object type to check
     * @returns {boolean}
     */
    acceptsType: function(type) {
      if (this.data.accepts === 'any') return true;

      var accepted = this.data.accepts.split(',').map(function(t) {
        return t.trim().toLowerCase();
      });

      return accepted.indexOf(type.toLowerCase()) !== -1;
    },

    /**
     * Check if an object is within snap distance
     * @param {Element} objectEl - Object to check
     * @returns {boolean}
     */
    isInRange: function(objectEl) {
      this.el.object3D.getWorldPosition(tempVec1);
      objectEl.object3D.getWorldPosition(tempVec2);

      return tempVec1.distanceTo(tempVec2) <= this.data.snapDistance;
    },

    /**
     * Get distance to an object
     * @param {Element} objectEl
     * @returns {number}
     */
    getDistance: function(objectEl) {
      this.el.object3D.getWorldPosition(tempVec1);
      objectEl.object3D.getWorldPosition(tempVec2);

      return tempVec1.distanceTo(tempVec2);
    },

    /**
     * Attach an object to this socket
     * @param {Element} objectEl - Object to attach
     */
    attach: function(objectEl) {
      if (this.occupiedBy) {
        console.warn('[Socket] Socket already occupied');
        return false;
      }

      var snappableComp = objectEl.components.snappable;
      if (!snappableComp) {
        console.warn('[Socket] Object does not have snappable component');
        return false;
      }

      // Check type compatibility
      if (!this.acceptsType(snappableComp.data.type)) {
        console.warn('[Socket] Incompatible type: ' + snappableComp.data.type);
        return false;
      }

      this.occupiedBy = objectEl;
      this.el.setAttribute('socket', 'occupied', true);

      // Update snappable state
      snappableComp.attachToSocket(this.el);

      // Emit events
      this.el.emit('socket-attach', { object: objectEl });

      // Clear highlight
      this.setHighlight(false);

      // Haptic feedback
      if (window.Haptics) {
        Haptics.medium('right');
        Haptics.medium('left');
      }

      console.log('[Socket] Object attached');
      return true;
    },

    /**
     * Detach the currently attached object
     * @returns {Element|null} The detached object
     */
    detach: function() {
      if (!this.occupiedBy) return null;

      var objectEl = this.occupiedBy;
      var snappableComp = objectEl.components.snappable;

      this.occupiedBy = null;
      this.el.setAttribute('socket', 'occupied', false);

      // Update snappable state
      if (snappableComp) {
        snappableComp.detachFromSocket(this.el);
      }

      // Emit event
      this.el.emit('socket-detach', { object: objectEl });

      console.log('[Socket] Object detached');
      return objectEl;
    },

    /**
     * Store original material properties for highlight
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
     * Restore original material properties
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
    },

    /**
     * Set highlight state
     * @param {boolean} highlighted
     */
    setHighlight: function(highlighted) {
      this.isHighlighted = highlighted;

      if (!highlighted) {
        this.restoreOriginalMaterial();
        this.highlightProgress = 0;
      } else {
        this.storeOriginalMaterial();
      }
    },

    /**
     * Update highlight pulse animation
     */
    updateHighlight: function(delta) {
      if (!this.isHighlighted) return;

      var mesh = this.el.getObject3D('mesh');
      if (!mesh || !mesh.material || !mesh.material.emissive) return;

      // Pulse animation
      this.highlightProgress += (delta / 1000) * HIGHLIGHT_PULSE_SPEED * Math.PI * 2;
      var pulse = (Math.sin(this.highlightProgress) + 1) / 2;  // 0-1 range

      var material = mesh.material;
      var highlightColor = new THREE.Color(this.data.highlightColor);

      // Blend emissive
      var baseIntensity = this.originalEmissiveIntensity || 0;
      var targetIntensity = baseIntensity + this.data.highlightIntensity * pulse;

      if (this.originalEmissive) {
        material.emissive.copy(this.originalEmissive);
        material.emissive.lerp(highlightColor, pulse * 0.5);
      } else {
        material.emissive.set(0, 0, 0);
        material.emissive.lerp(highlightColor, pulse * 0.5);
      }

      material.emissiveIntensity = targetIntensity;
    },

    tick: function(time, delta) {
      if (!systemEnabled) return;

      // Update highlight animation
      this.updateHighlight(delta);

      // Check for nearby compatible objects (only when not occupied)
      if (!this.occupiedBy) {
        this.checkNearbyCompatible();
      }
    },

    /**
     * Check for nearby compatible objects and highlight if found
     */
    checkNearbyCompatible: function() {
      var nearest = null;
      var nearestDist = this.data.snapDistance;

      registeredSnappables.forEach(function(snappableEl) {
        var snappableComp = snappableEl.components.snappable;
        if (!snappableComp) return;

        // Skip if already snapped or not being held
        if (snappableComp.isSnapped) return;
        if (!snappableComp.isHeld) return;

        // Check type compatibility
        if (!this.acceptsType(snappableComp.data.type)) return;

        // Check distance
        var dist = this.getDistance(snappableEl);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = snappableEl;
        }
      }.bind(this));

      // Update highlight state
      if (nearest !== this.nearbyCompatible) {
        this.nearbyCompatible = nearest;
        this.setHighlight(nearest !== null);
      }
    }
  });

  /**
   * Snappable component - marks objects that can snap to sockets
   */
  AFRAME.registerComponent('snappable', {
    schema: {
      type: { type: 'string', default: 'default' }  // Object type for socket matching
    },

    init: function() {
      this.isSnapped = false;       // Currently snapped to a socket
      this.snappedSocket = null;    // Reference to socket element
      this.isHeld = false;          // Currently being held by hand

      // Animation state
      this.isAnimating = false;
      this.animStartTime = 0;
      this.animStartPos = new THREE.Vector3();
      this.animStartQuat = new THREE.Quaternion();
      this.animTargetPos = new THREE.Vector3();
      this.animTargetQuat = new THREE.Quaternion();

      // Bind methods
      this.onGrabStart = this.onGrabStart.bind(this);
      this.onGrabEnd = this.onGrabEnd.bind(this);

      // Listen for grab events from grabbable component
      this.el.addEventListener('grab-start', this.onGrabStart);
      this.el.addEventListener('grab-end', this.onGrabEnd);
      this.el.addEventListener('thrown', this.onGrabEnd);  // Also handle throw

      // Register snappable
      registeredSnappables.add(this.el);

      console.log('[Snappable] Registered snappable type: ' + this.data.type);
    },

    remove: function() {
      // Unsnap if snapped
      if (this.isSnapped && this.snappedSocket) {
        var socketComp = this.snappedSocket.components.socket;
        if (socketComp) {
          socketComp.detach();
        }
      }

      // Remove listeners
      this.el.removeEventListener('grab-start', this.onGrabStart);
      this.el.removeEventListener('grab-end', this.onGrabEnd);
      this.el.removeEventListener('thrown', this.onGrabEnd);

      // Unregister
      registeredSnappables.delete(this.el);

      console.log('[Snappable] Removed snappable');
    },

    /**
     * Handle grab start - detach from socket if snapped
     */
    onGrabStart: function(evt) {
      this.isHeld = true;

      // If snapped, detach from socket
      if (this.isSnapped && this.snappedSocket) {
        var socketComp = this.snappedSocket.components.socket;
        if (socketComp) {
          socketComp.detach();
        }
      }
    },

    /**
     * Handle grab end - check for nearby socket to snap to
     */
    onGrabEnd: function(evt) {
      if (!systemEnabled) {
        this.isHeld = false;
        return;
      }

      // Small delay to let physics settle
      var self = this;
      setTimeout(function() {
        self.isHeld = false;
        self.trySnapToNearestSocket();
      }, 50);
    },

    /**
     * Find and snap to nearest compatible socket
     */
    trySnapToNearestSocket: function() {
      if (this.isSnapped) return;

      var nearest = findNearestCompatibleSocket(this.el);
      if (nearest) {
        this.snapTo(nearest);
      }
    },

    /**
     * Snap this object to a socket with animation
     * @param {Element} socketEl - Socket element to snap to
     */
    snapTo: function(socketEl) {
      var socketComp = socketEl.components.socket;
      if (!socketComp) return;

      // Store current transform for animation
      this.el.object3D.getWorldPosition(this.animStartPos);
      this.el.object3D.getWorldQuaternion(this.animStartQuat);

      // Get target transform (socket position/rotation)
      socketEl.object3D.getWorldPosition(this.animTargetPos);
      socketEl.object3D.getWorldQuaternion(this.animTargetQuat);

      // Start animation
      this.isAnimating = true;
      this.animStartTime = performance.now();

      // Will complete attachment when animation finishes
      this.pendingSocket = socketEl;

      console.log('[Snappable] Starting snap animation');
    },

    /**
     * Called by socket when attachment completes
     * @param {Element} socketEl
     */
    attachToSocket: function(socketEl) {
      this.isSnapped = true;
      this.snappedSocket = socketEl;

      // Emit event
      this.el.emit('snapped', { socket: socketEl });

      console.log('[Snappable] Snapped to socket');
    },

    /**
     * Called by socket when detachment completes
     * @param {Element} socketEl
     */
    detachFromSocket: function(socketEl) {
      var prevSocket = this.snappedSocket;

      this.isSnapped = false;
      this.snappedSocket = null;

      // Emit event
      this.el.emit('unsnapped', { socket: prevSocket });

      console.log('[Snappable] Unsnapped from socket');
    },

    tick: function(time, delta) {
      if (!this.isAnimating) return;

      // Calculate animation progress
      var elapsed = performance.now() - this.animStartTime;
      var t = Math.min(1, elapsed / SNAP_DURATION);

      // Ease out cubic
      var eased = 1 - Math.pow(1 - t, 3);

      // Interpolate position
      tempVec1.copy(this.animStartPos);
      tempVec1.lerp(this.animTargetPos, eased);
      this.el.object3D.position.copy(tempVec1);

      // Convert to local space if parented
      if (this.el.object3D.parent && this.el.object3D.parent !== this.el.sceneEl.object3D) {
        this.el.object3D.parent.worldToLocal(this.el.object3D.position);
      }

      // Interpolate rotation
      tempQuat.copy(this.animStartQuat);
      tempQuat.slerp(this.animTargetQuat, eased);
      this.el.object3D.quaternion.copy(tempQuat);

      // Animation complete
      if (t >= 1) {
        this.isAnimating = false;

        // Complete the attachment
        if (this.pendingSocket) {
          var socketComp = this.pendingSocket.components.socket;
          if (socketComp && !socketComp.occupiedBy) {
            socketComp.attach(this.el);
          }
          this.pendingSocket = null;
        }
      }
    }
  });

  /**
   * Find nearest compatible socket for an object
   * @param {Element} objectEl - Snappable object
   * @returns {Element|null} Nearest compatible socket or null
   */
  function findNearestCompatibleSocket(objectEl) {
    var snappableComp = objectEl.components.snappable;
    if (!snappableComp) return null;

    var objectType = snappableComp.data.type;
    var nearest = null;
    var nearestDist = Infinity;

    registeredSockets.forEach(function(socketEl) {
      var socketComp = socketEl.components.socket;
      if (!socketComp) return;

      // Skip occupied sockets
      if (socketComp.occupiedBy) return;

      // Check type compatibility
      if (!socketComp.acceptsType(objectType)) return;

      // Check distance
      if (!socketComp.isInRange(objectEl)) return;

      var dist = socketComp.getDistance(objectEl);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = socketEl;
      }
    });

    return nearest;
  }

  /**
   * Global Socket API
   */
  window.Socket = {
    /**
     * Enable the socket system.
     */
    enable: function() {
      systemEnabled = true;
      console.log('[Socket] System enabled');
    },

    /**
     * Disable the socket system.
     */
    disable: function() {
      systemEnabled = false;
      console.log('[Socket] System disabled');
    },

    /**
     * Check if system is enabled.
     * @returns {boolean}
     */
    isEnabled: function() {
      return systemEnabled;
    },

    /**
     * Get the object currently attached to a socket.
     * @param {Element|string} socketEl - Socket element or selector
     * @returns {Element|null}
     */
    getOccupied: function(socketEl) {
      if (typeof socketEl === 'string') {
        socketEl = document.querySelector(socketEl);
      }

      if (!socketEl || !socketEl.components || !socketEl.components.socket) {
        return null;
      }

      return socketEl.components.socket.occupiedBy;
    },

    /**
     * Force snap an object to a socket programmatically.
     * @param {Element|string} objectEl - Snappable object or selector
     * @param {Element|string} socketEl - Socket element or selector
     * @returns {boolean} Success
     */
    snap: function(objectEl, socketEl) {
      if (typeof objectEl === 'string') {
        objectEl = document.querySelector(objectEl);
      }
      if (typeof socketEl === 'string') {
        socketEl = document.querySelector(socketEl);
      }

      if (!objectEl || !socketEl) {
        console.warn('[Socket] Invalid elements for snap');
        return false;
      }

      var snappableComp = objectEl.components.snappable;
      if (!snappableComp) {
        console.warn('[Socket] Object does not have snappable component');
        return false;
      }

      var socketComp = socketEl.components.socket;
      if (!socketComp) {
        console.warn('[Socket] Element does not have socket component');
        return false;
      }

      // Release from hand if held
      var grabbableComp = objectEl.components.grabbable;
      if (grabbableComp && grabbableComp.isHeld) {
        grabbableComp.release(false);
      }

      // Detach from current socket if snapped
      if (snappableComp.isSnapped && snappableComp.snappedSocket) {
        var prevSocketComp = snappableComp.snappedSocket.components.socket;
        if (prevSocketComp) {
          prevSocketComp.detach();
        }
      }

      // Snap with animation
      snappableComp.snapTo(socketEl);

      return true;
    },

    /**
     * Force unsnap from a socket.
     * @param {Element|string} socketEl - Socket element or selector
     * @returns {Element|null} The detached object
     */
    unsnap: function(socketEl) {
      if (typeof socketEl === 'string') {
        socketEl = document.querySelector(socketEl);
      }

      if (!socketEl || !socketEl.components || !socketEl.components.socket) {
        return null;
      }

      return socketEl.components.socket.detach();
    },

    /**
     * Find the nearest compatible socket for an object.
     * @param {Element|string} objectEl - Snappable object or selector
     * @returns {Element|null}
     */
    findNearestSocket: function(objectEl) {
      if (typeof objectEl === 'string') {
        objectEl = document.querySelector(objectEl);
      }

      return findNearestCompatibleSocket(objectEl);
    },

    /**
     * Get all registered sockets.
     * @returns {Element[]}
     */
    getAllSockets: function() {
      return Array.from(registeredSockets);
    },

    /**
     * Get all registered snappable objects.
     * @returns {Element[]}
     */
    getAllSnappables: function() {
      return Array.from(registeredSnappables);
    },

    /**
     * Get all occupied sockets.
     * @returns {Element[]}
     */
    getOccupiedSockets: function() {
      return Array.from(registeredSockets).filter(function(socketEl) {
        var comp = socketEl.components.socket;
        return comp && comp.occupiedBy;
      });
    },

    /**
     * Get all empty sockets.
     * @returns {Element[]}
     */
    getEmptySockets: function() {
      return Array.from(registeredSockets).filter(function(socketEl) {
        var comp = socketEl.components.socket;
        return comp && !comp.occupiedBy;
      });
    },

    /**
     * Unsnap all sockets.
     */
    unsnapAll: function() {
      registeredSockets.forEach(function(socketEl) {
        var comp = socketEl.components.socket;
        if (comp && comp.occupiedBy) {
          comp.detach();
        }
      });
    }
  };

  console.log('[Socket] Module loaded');
})();
