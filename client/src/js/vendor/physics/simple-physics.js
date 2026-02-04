/**
 * Simple Physics - Lightweight physics for thrown objects
 * Usage: <script src="/framework/physics/simple-physics.js"></script>
 *
 * Manual usage:
 *   var velocity = { x: 0, y: 0, z: -5 };
 *   SimplePhysics.applyGravity(entity, velocity);
 *   SimplePhysics.move(entity, velocity, deltaTime);
 *   var hit = SimplePhysics.checkCollision(entity, targets);
 *   if (hit) velocity = SimplePhysics.bounce(velocity, hit.normal, 0.6);
 *
 * Component usage (auto-update):
 *   <a-box simple-body="velocity: 0 5 -3; gravity: true; bounciness: 0.6"
 *          collision-targets=".floor, .wall"></a-box>
 *
 * Events emitted on entity:
 *   - collision: { entity, target, point, normal }
 */
(function() {
  'use strict';

  // Physics constants
  var GRAVITY = -9.81;  // m/s^2
  var MIN_VELOCITY = 0.01;  // Below this, consider stopped

  // Pre-allocated vectors for calculations (avoid GC)
  var _tempVec3 = new THREE.Vector3();
  var _tempBox3A = new THREE.Box3();
  var _tempBox3B = new THREE.Box3();
  var _tempNormal = new THREE.Vector3();
  // Additional pre-allocated for collision detection (GC optimization)
  var _tempBox3Intersect = new THREE.Box3();
  var _tempCollisionPoint = new THREE.Vector3();
  var _tempEntityCenter = new THREE.Vector3();
  var _tempTargetCenter = new THREE.Vector3();
  var _tempEntitySize = new THREE.Vector3();
  var _tempTargetSize = new THREE.Vector3();

  /**
   * Apply gravity to a velocity object.
   * @param {Object|THREE.Vector3} velocity - { x, y, z } or THREE.Vector3
   * @param {number} [gravity] - Custom gravity value (default: -9.81)
   * @param {number} [dt] - Delta time in seconds (default: 1/60)
   * @returns {Object|THREE.Vector3} Modified velocity (same reference)
   */
  function applyGravity(velocity, gravity, dt) {
    gravity = typeof gravity === 'number' ? gravity : GRAVITY;
    dt = typeof dt === 'number' ? dt : 1 / 60;

    velocity.y += gravity * dt;
    return velocity;
  }

  /**
   * Move an entity by velocity over delta time.
   * @param {Element} entity - A-Frame entity
   * @param {Object|THREE.Vector3} velocity - { x, y, z } or THREE.Vector3
   * @param {number} dt - Delta time in seconds
   * @returns {boolean} True if entity moved significantly
   */
  function move(entity, velocity, dt) {
    if (!entity || !entity.object3D) {
      console.warn('[SimplePhysics] Invalid entity for move');
      return false;
    }

    var pos = entity.object3D.position;

    // Apply velocity * dt
    pos.x += velocity.x * dt;
    pos.y += velocity.y * dt;
    pos.z += velocity.z * dt;

    // Check if velocity is significant
    var speed = Math.sqrt(
      velocity.x * velocity.x +
      velocity.y * velocity.y +
      velocity.z * velocity.z
    );

    return speed > MIN_VELOCITY;
  }

  /**
   * Check AABB collision between an entity and targets.
   * @param {Element} entity - A-Frame entity to check
   * @param {NodeList|Array|string} targets - Target elements, array, or selector
   * @returns {Object|null} { entity, target, point, normal } or null
   */
  function checkCollision(entity, targets) {
    if (!entity || !entity.object3D) return null;

    // Resolve targets
    var targetList = resolveTargets(targets);
    if (!targetList || targetList.length === 0) return null;

    // Get entity bounding box
    var entityBox = getAABB(entity, _tempBox3A);
    if (!entityBox) return null;

    // Check against each target
    for (var i = 0; i < targetList.length; i++) {
      var target = targetList[i];
      if (target === entity) continue;  // Skip self

      var targetBox = getAABB(target, _tempBox3B);
      if (!targetBox) continue;

      // AABB intersection test
      if (entityBox.intersectsBox(targetBox)) {
        // Calculate collision point (center of intersection) - using pre-allocated
        _tempBox3Intersect.copy(entityBox).intersect(targetBox);
        _tempCollisionPoint.set(0, 0, 0);
        _tempBox3Intersect.getCenter(_tempCollisionPoint);

        // Calculate collision normal (from target to entity)
        var normal = calculateCollisionNormal(entityBox, targetBox);

        return {
          entity: entity,
          target: target,
          point: _tempCollisionPoint.clone(),  // Clone only on collision (not per-frame)
          normal: normal
        };
      }
    }

    return null;
  }

  /**
   * Check collision against multiple targets, returning all hits.
   * @param {Element} entity - A-Frame entity to check
   * @param {NodeList|Array|string} targets - Target elements
   * @returns {Array} Array of collision objects
   */
  function checkCollisionAll(entity, targets) {
    if (!entity || !entity.object3D) return [];

    var targetList = resolveTargets(targets);
    if (!targetList || targetList.length === 0) return [];

    var entityBox = getAABB(entity, _tempBox3A);
    if (!entityBox) return [];

    var collisions = [];

    for (var i = 0; i < targetList.length; i++) {
      var target = targetList[i];
      if (target === entity) continue;

      var targetBox = getAABB(target, _tempBox3B);
      if (!targetBox) continue;

      if (entityBox.intersectsBox(targetBox)) {
        // Calculate collision point using pre-allocated vectors
        _tempBox3Intersect.copy(entityBox).intersect(targetBox);
        _tempCollisionPoint.set(0, 0, 0);
        _tempBox3Intersect.getCenter(_tempCollisionPoint);
        var normal = calculateCollisionNormal(entityBox, targetBox);

        collisions.push({
          entity: entity,
          target: target,
          point: _tempCollisionPoint.clone(),  // Clone only on collision (not per-frame)
          normal: normal
        });
      }
    }

    return collisions;
  }

  /**
   * Calculate bounce reflection of velocity off a surface.
   * @param {Object|THREE.Vector3} velocity - Current velocity
   * @param {Object|THREE.Vector3} normal - Surface normal (should be normalized)
   * @param {number} [bounciness] - Coefficient of restitution (0-1, default: 0.5)
   * @returns {Object} New velocity object { x, y, z }
   */
  function bounce(velocity, normal, bounciness) {
    bounciness = typeof bounciness === 'number' ? bounciness : 0.5;
    bounciness = Math.max(0, Math.min(1, bounciness));

    // Ensure normal is normalized
    _tempNormal.set(normal.x, normal.y, normal.z).normalize();

    // Calculate reflection: v' = v - 2(v.n)n
    var dot = velocity.x * _tempNormal.x +
              velocity.y * _tempNormal.y +
              velocity.z * _tempNormal.z;

    // Apply reflection with bounciness
    var factor = 2 * dot * (1 + bounciness) / 2;

    return {
      x: (velocity.x - factor * _tempNormal.x) * bounciness,
      y: (velocity.y - factor * _tempNormal.y) * bounciness,
      z: (velocity.z - factor * _tempNormal.z) * bounciness
    };
  }

  /**
   * Stop velocity if below threshold.
   * @param {Object|THREE.Vector3} velocity - Velocity to check
   * @param {number} [threshold] - Minimum speed (default: MIN_VELOCITY)
   * @returns {Object} Zeroed velocity if below threshold, else unchanged
   */
  function dampVelocity(velocity, threshold) {
    threshold = typeof threshold === 'number' ? threshold : MIN_VELOCITY;

    var speed = Math.sqrt(
      velocity.x * velocity.x +
      velocity.y * velocity.y +
      velocity.z * velocity.z
    );

    if (speed < threshold) {
      velocity.x = 0;
      velocity.y = 0;
      velocity.z = 0;
    }

    return velocity;
  }

  /**
   * Apply linear drag to velocity.
   * @param {Object|THREE.Vector3} velocity - Velocity to dampen
   * @param {number} drag - Drag coefficient (0-1, applied per second)
   * @param {number} dt - Delta time in seconds
   * @returns {Object} Modified velocity
   */
  function applyDrag(velocity, drag, dt) {
    var factor = Math.pow(1 - drag, dt);
    velocity.x *= factor;
    velocity.y *= factor;
    velocity.z *= factor;
    return velocity;
  }

  /**
   * Get AABB bounding box for an entity.
   * @param {Element} entity - A-Frame entity
   * @param {THREE.Box3} [target] - Optional pre-allocated Box3
   * @returns {THREE.Box3|null}
   */
  function getAABB(entity, target) {
    if (!entity || !entity.object3D) return null;

    var box = target || new THREE.Box3();

    // Try to get mesh for accurate bounds
    var mesh = entity.getObject3D('mesh');
    if (mesh) {
      box.setFromObject(mesh);
    } else {
      // Fallback: use object3D with estimated size
      box.setFromObject(entity.object3D);

      // If box is empty (no geometry), estimate from scale
      if (box.isEmpty()) {
        var pos = entity.object3D.position;
        var scale = entity.object3D.scale;
        var halfSize = 0.5;  // Default half-size

        box.set(
          new THREE.Vector3(
            pos.x - halfSize * scale.x,
            pos.y - halfSize * scale.y,
            pos.z - halfSize * scale.z
          ),
          new THREE.Vector3(
            pos.x + halfSize * scale.x,
            pos.y + halfSize * scale.y,
            pos.z + halfSize * scale.z
          )
        );
      }
    }

    return box;
  }

  /**
   * Calculate collision normal from AABB intersection.
   * Uses pre-allocated vectors to avoid GC allocations.
   * @param {THREE.Box3} entityBox - Moving entity's box
   * @param {THREE.Box3} targetBox - Target's box
   * @returns {THREE.Vector3} Cloned collision normal (safe to store)
   */
  function calculateCollisionNormal(entityBox, targetBox) {
    // Use pre-allocated vectors for calculations
    entityBox.getCenter(_tempEntityCenter);
    targetBox.getCenter(_tempTargetCenter);

    // Calculate overlap on each axis
    var dx = _tempEntityCenter.x - _tempTargetCenter.x;
    var dy = _tempEntityCenter.y - _tempTargetCenter.y;
    var dz = _tempEntityCenter.z - _tempTargetCenter.z;

    entityBox.getSize(_tempEntitySize);
    targetBox.getSize(_tempTargetSize);

    var overlapX = (_tempEntitySize.x + _tempTargetSize.x) / 2 - Math.abs(dx);
    var overlapY = (_tempEntitySize.y + _tempTargetSize.y) / 2 - Math.abs(dy);
    var overlapZ = (_tempEntitySize.z + _tempTargetSize.z) / 2 - Math.abs(dz);

    // Normal points along axis with minimum overlap
    // Use _tempNormal then clone for return (collision events are infrequent)
    _tempNormal.set(0, 0, 0);

    if (overlapX <= overlapY && overlapX <= overlapZ) {
      _tempNormal.x = dx > 0 ? 1 : -1;
    } else if (overlapY <= overlapX && overlapY <= overlapZ) {
      _tempNormal.y = dy > 0 ? 1 : -1;
    } else {
      _tempNormal.z = dz > 0 ? 1 : -1;
    }

    return _tempNormal.clone();  // Clone only on collision (not per-frame check)
  }

  /**
   * Resolve targets to an array of elements.
   * @param {NodeList|Array|string|Element} targets
   * @returns {Array}
   */
  function resolveTargets(targets) {
    if (!targets) return [];

    // String selector
    if (typeof targets === 'string') {
      return Array.prototype.slice.call(document.querySelectorAll(targets));
    }

    // NodeList or array-like
    if (targets.length !== undefined) {
      return Array.prototype.slice.call(targets);
    }

    // Single element
    if (targets.object3D) {
      return [targets];
    }

    return [];
  }

  /**
   * A-Frame component for automatic physics simulation.
   * Attach to entities that need physics behavior.
   */
  AFRAME.registerComponent('simple-body', {
    schema: {
      velocity: { type: 'vec3', default: { x: 0, y: 0, z: 0 } },
      gravity: { type: 'boolean', default: true },
      gravityValue: { type: 'number', default: GRAVITY },
      bounciness: { type: 'number', default: 0.5 },
      drag: { type: 'number', default: 0.01 },
      collisionTargets: { type: 'string', default: '' },
      active: { type: 'boolean', default: true },
      stopOnGround: { type: 'boolean', default: true },
      groundY: { type: 'number', default: 0 }
    },

    init: function() {
      // Working velocity (clone from schema)
      this.velocity = new THREE.Vector3(
        this.data.velocity.x,
        this.data.velocity.y,
        this.data.velocity.z
      );

      // Bind collision handler
      this.onCollision = this.onCollision.bind(this);
    },

    update: function(oldData) {
      // Update velocity if changed externally
      if (oldData.velocity &&
          (this.data.velocity.x !== oldData.velocity.x ||
           this.data.velocity.y !== oldData.velocity.y ||
           this.data.velocity.z !== oldData.velocity.z)) {
        this.velocity.set(
          this.data.velocity.x,
          this.data.velocity.y,
          this.data.velocity.z
        );
      }
    },

    tick: function(time, delta) {
      if (!this.data.active) return;
      if (delta <= 0) return;

      var dt = delta / 1000;  // Convert to seconds

      // Apply gravity
      if (this.data.gravity) {
        applyGravity(this.velocity, this.data.gravityValue, dt);
      }

      // Apply drag
      if (this.data.drag > 0) {
        applyDrag(this.velocity, this.data.drag, dt);
      }

      // Move entity
      var moved = move(this.el, this.velocity, dt);

      // Ground check
      if (this.data.stopOnGround) {
        var pos = this.el.object3D.position;
        if (pos.y <= this.data.groundY && this.velocity.y < 0) {
          pos.y = this.data.groundY;
          this.velocity.y = -this.velocity.y * this.data.bounciness;

          // Stop if velocity too low
          if (Math.abs(this.velocity.y) < 0.1) {
            this.velocity.y = 0;
          }

          // Emit ground collision
          this.el.emit('collision', {
            entity: this.el,
            target: null,
            point: { x: pos.x, y: this.data.groundY, z: pos.z },
            normal: { x: 0, y: 1, z: 0 },
            isGround: true
          });
        }
      }

      // Collision detection
      if (this.data.collisionTargets) {
        var hit = checkCollision(this.el, this.data.collisionTargets);
        if (hit) {
          this.onCollision(hit);
        }
      }

      // Dampen small velocities
      dampVelocity(this.velocity, MIN_VELOCITY);

      // Deactivate if stopped
      if (!moved && !this.data.gravity) {
        this.el.setAttribute('simple-body', 'active', false);
      }
    },

    onCollision: function(hit) {
      // Apply bounce
      var newVelocity = bounce(this.velocity, hit.normal, this.data.bounciness);
      this.velocity.set(newVelocity.x, newVelocity.y, newVelocity.z);

      // Emit collision event
      this.el.emit('collision', {
        entity: hit.entity,
        target: hit.target,
        point: hit.point,
        normal: hit.normal,
        isGround: false
      });
    },

    /**
     * Set velocity directly.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    setVelocity: function(x, y, z) {
      this.velocity.set(x, y, z);
      this.el.setAttribute('simple-body', 'active', true);
    },

    /**
     * Add impulse to current velocity.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    addImpulse: function(x, y, z) {
      this.velocity.x += x;
      this.velocity.y += y;
      this.velocity.z += z;
      this.el.setAttribute('simple-body', 'active', true);
    },

    /**
     * Stop all movement.
     */
    stop: function() {
      this.velocity.set(0, 0, 0);
    },

    /**
     * Get current velocity.
     * @returns {THREE.Vector3}
     */
    getVelocity: function() {
      return this.velocity.clone();
    }
  });

  /**
   * Global SimplePhysics API
   */
  window.SimplePhysics = {
    // Constants
    GRAVITY: GRAVITY,
    MIN_VELOCITY: MIN_VELOCITY,

    // Core functions
    applyGravity: applyGravity,
    move: move,
    checkCollision: checkCollision,
    checkCollisionAll: checkCollisionAll,
    bounce: bounce,

    // Utility functions
    dampVelocity: dampVelocity,
    applyDrag: applyDrag,
    getAABB: getAABB,

    /**
     * Apply physics to a thrown object from grabbable.
     * Convenience method for common use case.
     * @param {Element} entity - Thrown entity
     * @param {THREE.Vector3|Object} velocity - Initial throw velocity
     * @param {Object} [opts] - { bounciness, drag, collisionTargets, groundY }
     */
    applyThrow: function(entity, velocity, opts) {
      opts = opts || {};

      entity.setAttribute('simple-body', {
        velocity: velocity.x + ' ' + velocity.y + ' ' + velocity.z,
        gravity: true,
        bounciness: opts.bounciness !== undefined ? opts.bounciness : 0.5,
        drag: opts.drag !== undefined ? opts.drag : 0.01,
        collisionTargets: opts.collisionTargets || '',
        active: true,
        stopOnGround: opts.stopOnGround !== undefined ? opts.stopOnGround : true,
        groundY: opts.groundY !== undefined ? opts.groundY : 0
      });
    },

    /**
     * Stop physics simulation on an entity.
     * @param {Element} entity
     */
    stopPhysics: function(entity) {
      if (entity.components['simple-body']) {
        entity.components['simple-body'].stop();
        entity.setAttribute('simple-body', 'active', false);
      }
    }
  };

  console.log('[SimplePhysics] Module loaded');
})();
