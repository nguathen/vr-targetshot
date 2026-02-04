/**
 * Projectile System - Shooting/throwing projectiles for VR combat
 * Usage: <script src="/framework/utils/object-pool.js"></script>
 *        <script src="/framework/utils/haptics.js"></script>
 *        <script src="/framework/audio/audio-manager.js"></script>
 *        <script src="/framework/vfx/particles.js"></script> (optional)
 *        <script src="/framework/combat/projectile.js"></script>
 *
 * Emitter setup:
 *   <a-entity id="right-hand" projectile-emitter="type: raycast; damage: 10"></a-entity>
 *   <a-entity id="weapon" projectile-emitter="type: physics; speed: 20; prefab: #bullet-template"></a-entity>
 *
 * Projectile entity (for physics mode):
 *   <a-entity projectile="speed: 20; damage: 10; lifetime: 3000"></a-entity>
 *
 * Target marking:
 *   <a-box hittable></a-box>
 *   <a-box destructible="hp: 100" hittable></a-box>
 *
 * Events:
 *   - projectile-fire: { hand, direction, type, damage }
 *   - projectile-hit: { target, point, normal, damage, type }
 *   - projectile-expire: { }
 *
 * Global API:
 *   Projectile.fire('right', { type: 'raycast', damage: 25 });
 *   Projectile.fire('left', { type: 'physics', speed: 15, prefab: '#arrow' });
 *   Projectile.setEnabled(false);  // Disable firing
 */
(function() {
  'use strict';

  // Configuration
  var POOL_SIZE = 20;
  var MAX_POOL_SIZE = 50;
  var DEFAULT_LIFETIME = 3000;  // ms
  var DEFAULT_SPEED = 20;       // m/s
  var DEFAULT_DAMAGE = 10;
  var RAYCAST_RANGE = 100;      // meters
  var TRACER_DURATION = 100;    // ms
  var MIN_FIRE_INTERVAL = 100;  // ms between shots (rate limiting)
  var GRAVITY = -9.81;          // m/s^2

  // Module state
  var systemEnabled = true;
  var projectilePool = null;
  var activeProjectiles = new Set();

  // Pre-allocated vectors for calculations
  var _tempVec3 = new THREE.Vector3();
  var _tempVec3B = new THREE.Vector3();
  var _tempDir = new THREE.Vector3();
  var _tempRay = null;
  var _tempMatrix = new THREE.Matrix4();

  /**
   * Initialize the projectile pool.
   */
  function initPool() {
    if (projectilePool) return;
    if (!window.ObjectPool) {
      console.warn('[Projectile] ObjectPool not found, pooling disabled');
      return;
    }

    projectilePool = ObjectPool.create(createProjectileEntity, POOL_SIZE, {
      maxSize: MAX_POOL_SIZE,
      onGet: function(el) {
        el.setAttribute('visible', true);
      },
      onRelease: function(el) {
        el.setAttribute('visible', false);
        el.object3D.position.set(0, -1000, 0);
        // Reset projectile component state
        var comp = el.components.projectile;
        if (comp) {
          comp.reset();
        }
      }
    });

    console.log('[Projectile] Pool initialized with ' + POOL_SIZE + ' projectiles');
  }

  /**
   * Create a new projectile entity for the pool.
   * @returns {HTMLElement}
   */
  function createProjectileEntity() {
    var el = document.createElement('a-entity');
    el.setAttribute('geometry', 'primitive: sphere; radius: 0.02');
    el.setAttribute('material', 'color: #ffcc00; emissive: #ff8800; emissiveIntensity: 0.5; shader: flat');
    el.setAttribute('projectile', '');
    el.classList.add('projectile-entity');
    return el;
  }

  /**
   * Get a projectile from pool or create new.
   * @returns {HTMLElement}
   */
  function getProjectile() {
    if (projectilePool) {
      return projectilePool.get();
    }
    return createProjectileEntity();
  }

  /**
   * Release projectile back to pool.
   * @param {HTMLElement} el
   */
  function releaseProjectile(el) {
    activeProjectiles.delete(el);
    if (projectilePool) {
      projectilePool.release(el);
    } else if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  /**
   * Projectile emitter component - attaches to hand or weapon.
   */
  AFRAME.registerComponent('projectile-emitter', {
    schema: {
      type: { type: 'string', default: 'raycast' },  // 'raycast' or 'physics'
      damage: { type: 'number', default: DEFAULT_DAMAGE },
      speed: { type: 'number', default: DEFAULT_SPEED },
      lifetime: { type: 'number', default: DEFAULT_LIFETIME },
      fireRate: { type: 'number', default: 10 },  // shots per second
      prefab: { type: 'selector', default: null },
      fireSound: { type: 'string', default: '' },
      impactSound: { type: 'string', default: '' },
      muzzleFlash: { type: 'boolean', default: true },
      hapticIntensity: { type: 'number', default: 0.5 },
      offset: { type: 'vec3', default: { x: 0, y: 0, z: -0.1 } }  // spawn offset
    },

    init: function() {
      this.lastFireTime = 0;
      this.hand = this.detectHand();

      // Bind methods
      this.onTriggerDown = this.onTriggerDown.bind(this);

      // Setup event listeners
      this.el.addEventListener('triggerdown', this.onTriggerDown);

      // Initialize pool on first emitter
      initPool();

      console.log('[Projectile] Emitter initialized on ' + (this.hand || 'entity'));
    },

    remove: function() {
      this.el.removeEventListener('triggerdown', this.onTriggerDown);
    },

    detectHand: function() {
      var id = this.el.id;
      if (id === 'left-hand') return 'left';
      if (id === 'right-hand') return 'right';

      // Check parent
      var parent = this.el.parentElement;
      if (parent) {
        if (parent.id === 'left-hand') return 'left';
        if (parent.id === 'right-hand') return 'right';
      }

      return null;
    },

    onTriggerDown: function() {
      this.fire();
    },

    /**
     * Fire a projectile.
     * @param {Object} [options] - Override options
     */
    fire: function(options) {
      if (!systemEnabled) return;

      // Rate limiting
      var now = performance.now();
      var minInterval = 1000 / this.data.fireRate;
      if (now - this.lastFireTime < minInterval) return;
      this.lastFireTime = now;

      options = options || {};
      var type = options.type || this.data.type;
      var damage = options.damage !== undefined ? options.damage : this.data.damage;
      var speed = options.speed !== undefined ? options.speed : this.data.speed;
      var lifetime = options.lifetime !== undefined ? options.lifetime : this.data.lifetime;

      // Get fire position and direction
      var firePos = this.getFirePosition();
      var fireDir = this.getFireDirection();

      // Haptic feedback
      if (this.hand && window.Haptics) {
        Haptics.pulse(this.hand, this.data.hapticIntensity, 50);
      }

      // Fire sound
      if (this.data.fireSound && window.AudioManager) {
        AudioManager.play(this.data.fireSound);
      }

      // Muzzle flash VFX
      if (this.data.muzzleFlash && window.Particles) {
        Particles.emit('hit', firePos, {
          color: '#ffaa00',
          count: 8,
          speed: 3,
          lifetime: 100
        });
      }

      // Emit fire event
      this.el.emit('projectile-fire', {
        hand: this.hand,
        direction: fireDir.clone(),
        type: type,
        damage: damage
      });

      // Execute fire based on type
      if (type === 'raycast') {
        this.fireRaycast(firePos, fireDir, damage);
      } else {
        this.firePhysics(firePos, fireDir, speed, damage, lifetime);
      }
    },

    getFirePosition: function() {
      var worldPos = new THREE.Vector3();
      this.el.object3D.getWorldPosition(worldPos);

      // Apply offset in local space
      var offset = this.data.offset;
      var localOffset = new THREE.Vector3(offset.x, offset.y, offset.z);
      localOffset.applyQuaternion(this.el.object3D.quaternion);
      worldPos.add(localOffset);

      return worldPos;
    },

    getFireDirection: function() {
      var direction = new THREE.Vector3(0, 0, -1);
      this.el.object3D.getWorldQuaternion(_tempMatrix);
      direction.applyQuaternion(this.el.object3D.quaternion);
      direction.normalize();
      return direction;
    },

    /**
     * Raycast instant-hit mode.
     */
    fireRaycast: function(origin, direction, damage) {
      if (!_tempRay) {
        _tempRay = new THREE.Raycaster();
      }

      _tempRay.set(origin, direction);
      _tempRay.far = RAYCAST_RANGE;

      // Find hittable targets
      var hittables = document.querySelectorAll('[hittable], [destructible]');
      var meshes = [];
      hittables.forEach(function(el) {
        var mesh = el.getObject3D('mesh');
        if (mesh) {
          mesh.userData.element = el;
          meshes.push(mesh);
        }
      });

      // Raycast
      var intersects = _tempRay.intersectObjects(meshes, true);

      // Visual tracer
      this.createTracer(origin, direction, RAYCAST_RANGE);

      if (intersects.length > 0) {
        var hit = intersects[0];
        var targetMesh = hit.object;

        // Find the A-Frame entity
        var targetEl = null;
        var current = targetMesh;
        while (current) {
          if (current.userData && current.userData.element) {
            targetEl = current.userData.element;
            break;
          }
          current = current.parent;
        }

        if (targetEl) {
          this.onHit(targetEl, hit.point, hit.face ? hit.face.normal : direction.clone().negate(), damage, 'raycast');
        }
      }
    },

    /**
     * Physics-based projectile mode.
     */
    firePhysics: function(origin, direction, speed, damage, lifetime) {
      var scene = this.el.sceneEl;
      var projectileEl;

      // Use prefab if specified
      if (this.data.prefab) {
        projectileEl = this.data.prefab.cloneNode(true);
        projectileEl.removeAttribute('id');
      } else {
        projectileEl = getProjectile();
      }

      // Position at fire point
      projectileEl.object3D.position.copy(origin);

      // Set projectile properties
      var velocity = direction.clone().multiplyScalar(speed);
      projectileEl.setAttribute('projectile', {
        velocity: velocity.x + ' ' + velocity.y + ' ' + velocity.z,
        damage: damage,
        lifetime: lifetime,
        active: true,
        emitter: this.el
      });

      // Add to scene if not already
      if (!projectileEl.parentNode) {
        scene.appendChild(projectileEl);
      }

      activeProjectiles.add(projectileEl);

      // Store impact sound for later
      if (this.data.impactSound) {
        projectileEl.setAttribute('data-impact-sound', this.data.impactSound);
      }
    },

    /**
     * Create visual tracer line.
     */
    createTracer: function(origin, direction, distance) {
      var scene = this.el.sceneEl;
      var endPoint = origin.clone().add(direction.clone().multiplyScalar(distance));

      var tracer = document.createElement('a-entity');
      tracer.setAttribute('line', {
        start: origin.x + ' ' + origin.y + ' ' + origin.z,
        end: endPoint.x + ' ' + endPoint.y + ' ' + endPoint.z,
        color: '#ffcc00',
        opacity: 0.8
      });
      scene.appendChild(tracer);

      // Remove after short duration
      setTimeout(function() {
        if (tracer.parentNode) {
          tracer.parentNode.removeChild(tracer);
        }
      }, TRACER_DURATION);
    },

    /**
     * Handle projectile hit.
     */
    onHit: function(targetEl, point, normal, damage, type) {
      // Emit hit event on emitter
      this.el.emit('projectile-hit', {
        target: targetEl,
        point: point.clone(),
        normal: normal.clone(),
        damage: damage,
        type: type
      });

      // Emit hit event on target
      targetEl.emit('projectile-hit', {
        source: this.el,
        point: point.clone(),
        normal: normal.clone(),
        damage: damage,
        type: type
      });

      // Apply damage if destructible
      if (targetEl.components.destructible) {
        targetEl.components.destructible.takeDamage(damage, this.el);
      }

      // Impact VFX
      if (window.Particles) {
        Particles.emit('hit', point, { color: '#ff4400' });
      }

      // Impact sound
      if (this.data.impactSound && window.AudioManager) {
        AudioManager.play(this.data.impactSound);
      }
    }
  });

  /**
   * Projectile component - attached to flying projectile entities.
   */
  AFRAME.registerComponent('projectile', {
    schema: {
      velocity: { type: 'vec3', default: { x: 0, y: 0, z: -20 } },
      damage: { type: 'number', default: DEFAULT_DAMAGE },
      lifetime: { type: 'number', default: DEFAULT_LIFETIME },
      gravity: { type: 'boolean', default: true },
      active: { type: 'boolean', default: false },
      emitter: { type: 'selector', default: null },
      trail: { type: 'boolean', default: true },
      trailColor: { type: 'color', default: '#ffaa00' }
    },

    init: function() {
      this.velocity = new THREE.Vector3();
      this.startTime = 0;
      this.trailEmitter = null;
      this.hasHit = false;

      // Pre-allocate vectors
      this._tempPos = new THREE.Vector3();
      this._tempDir = new THREE.Vector3();
    },

    update: function(oldData) {
      if (this.data.active && !oldData.active) {
        // Just activated
        this.velocity.set(
          this.data.velocity.x,
          this.data.velocity.y,
          this.data.velocity.z
        );
        this.startTime = performance.now();
        this.hasHit = false;

        // Start trail
        if (this.data.trail) {
          this.startTrail();
        }
      }
    },

    tick: function(time, delta) {
      if (!this.data.active || this.hasHit) return;
      if (delta <= 0) return;

      var dt = delta / 1000;

      // Check lifetime
      var elapsed = performance.now() - this.startTime;
      if (elapsed > this.data.lifetime) {
        this.expire();
        return;
      }

      // Apply gravity
      if (this.data.gravity) {
        this.velocity.y += GRAVITY * dt;
      }

      // Store previous position for collision
      this._tempPos.copy(this.el.object3D.position);

      // Move
      this.el.object3D.position.x += this.velocity.x * dt;
      this.el.object3D.position.y += this.velocity.y * dt;
      this.el.object3D.position.z += this.velocity.z * dt;

      // Orient along velocity
      if (this.velocity.lengthSq() > 0.01) {
        this._tempDir.copy(this.velocity).normalize();
        this.el.object3D.lookAt(
          this.el.object3D.position.x + this._tempDir.x,
          this.el.object3D.position.y + this._tempDir.y,
          this.el.object3D.position.z + this._tempDir.z
        );
      }

      // Collision detection
      this.checkCollision(this._tempPos, this.el.object3D.position);

      // Update trail position
      if (this.trailEmitter) {
        this.trailEmitter.object3D.position.copy(this.el.object3D.position);
      }
    },

    checkCollision: function(prevPos, currentPos) {
      // Raycast from previous to current position
      if (!_tempRay) {
        _tempRay = new THREE.Raycaster();
      }

      var direction = _tempVec3.subVectors(currentPos, prevPos);
      var distance = direction.length();

      if (distance < 0.001) return;

      direction.normalize();
      _tempRay.set(prevPos, direction);
      _tempRay.far = distance + 0.1;

      // Find hittable targets
      var hittables = document.querySelectorAll('[hittable], [destructible]');
      var meshes = [];
      var self = this;

      hittables.forEach(function(el) {
        if (el === self.el) return;  // Skip self
        var mesh = el.getObject3D('mesh');
        if (mesh) {
          mesh.userData.element = el;
          meshes.push(mesh);
        }
      });

      var intersects = _tempRay.intersectObjects(meshes, true);

      if (intersects.length > 0) {
        var hit = intersects[0];

        // Find A-Frame entity
        var targetEl = null;
        var current = hit.object;
        while (current) {
          if (current.userData && current.userData.element) {
            targetEl = current.userData.element;
            break;
          }
          current = current.parent;
        }

        if (targetEl) {
          this.onHit(targetEl, hit.point, hit.face ? hit.face.normal : direction.clone().negate());
        }
      }

      // Ground collision (y < 0)
      if (currentPos.y < 0) {
        this.onHit(null, currentPos.clone().setY(0), new THREE.Vector3(0, 1, 0));
      }
    },

    onHit: function(targetEl, point, normal) {
      if (this.hasHit) return;
      this.hasHit = true;

      // Stop movement
      this.velocity.set(0, 0, 0);
      this.el.object3D.position.copy(point);

      // Emit events
      if (targetEl) {
        this.el.emit('projectile-hit', {
          target: targetEl,
          point: point.clone(),
          normal: normal.clone(),
          damage: this.data.damage,
          type: 'physics'
        });

        targetEl.emit('projectile-hit', {
          source: this.el,
          point: point.clone(),
          normal: normal.clone(),
          damage: this.data.damage,
          type: 'physics'
        });

        // Apply damage if destructible
        if (targetEl.components && targetEl.components.destructible) {
          targetEl.components.destructible.takeDamage(this.data.damage, this.el);
        }
      }

      // Impact VFX
      if (window.Particles) {
        Particles.emit('hit', point, { color: '#ff4400' });
      }

      // Impact sound
      var impactSound = this.el.getAttribute('data-impact-sound');
      if (impactSound && window.AudioManager) {
        AudioManager.play(impactSound);
      }

      // Stop trail
      this.stopTrail();

      // Release after short delay
      var self = this;
      setTimeout(function() {
        self.release();
      }, 50);
    },

    expire: function() {
      this.el.emit('projectile-expire', {});
      this.stopTrail();
      this.release();
    },

    startTrail: function() {
      if (!window.Particles) return;

      this.trailEmitter = Particles.createContinuous('dust', this.el.object3D.position, {
        color: this.data.trailColor,
        count: 3,
        size: 0.01,
        speed: 0.5,
        lifetime: 200,
        interval: 30
      });
    },

    stopTrail: function() {
      if (this.trailEmitter && window.Particles) {
        Particles.stop(this.trailEmitter);
        this.trailEmitter = null;
      }
    },

    reset: function() {
      this.velocity.set(0, 0, 0);
      this.startTime = 0;
      this.hasHit = false;
      this.stopTrail();
      this.el.setAttribute('projectile', 'active', false);
    },

    release: function() {
      this.reset();
      releaseProjectile(this.el);
    }
  });

  /**
   * Hittable component - marks entities as projectile targets.
   */
  AFRAME.registerComponent('hittable', {
    schema: {
      onHit: { type: 'string', default: '' }  // Optional callback function name
    },

    init: function() {
      this.hitHandler = this.onHit.bind(this);
      this.el.addEventListener('projectile-hit', this.hitHandler);
    },

    remove: function() {
      this.el.removeEventListener('projectile-hit', this.hitHandler);
    },

    onHit: function(evt) {
      // Call custom handler if specified
      if (this.data.onHit && window[this.data.onHit]) {
        window[this.data.onHit](evt.detail);
      }
    }
  });

  /**
   * Global Projectile API
   */
  window.Projectile = {
    /**
     * Fire a projectile from a hand or entity.
     * @param {string|Element} source - 'left', 'right', or an element with projectile-emitter
     * @param {Object} [options] - { type, damage, speed, lifetime }
     * @returns {boolean} True if fired successfully
     */
    fire: function(source, options) {
      var emitterEl;

      if (typeof source === 'string') {
        emitterEl = document.getElementById(source + '-hand');
      } else {
        emitterEl = source;
      }

      if (!emitterEl) {
        console.warn('[Projectile] Source not found: ' + source);
        return false;
      }

      var emitter = emitterEl.components['projectile-emitter'];
      if (!emitter) {
        console.warn('[Projectile] No projectile-emitter on source');
        return false;
      }

      emitter.fire(options);
      return true;
    },

    /**
     * Enable/disable projectile system.
     * @param {boolean} enabled
     */
    setEnabled: function(enabled) {
      systemEnabled = enabled;
      console.log('[Projectile] System ' + (enabled ? 'enabled' : 'disabled'));
    },

    /**
     * Check if system is enabled.
     * @returns {boolean}
     */
    isEnabled: function() {
      return systemEnabled;
    },

    /**
     * Get count of active projectiles.
     * @returns {number}
     */
    activeCount: function() {
      return activeProjectiles.size;
    },

    /**
     * Clear all active projectiles.
     */
    clearAll: function() {
      activeProjectiles.forEach(function(el) {
        if (el.components.projectile) {
          el.components.projectile.release();
        }
      });
      activeProjectiles.clear();
    },

    /**
     * Get pool statistics.
     * @returns {Object|null}
     */
    poolStats: function() {
      return projectilePool ? projectilePool.stats() : null;
    },

    /**
     * Register a custom projectile prefab.
     * @param {string} name - Prefab name
     * @param {Object} config - { geometry, material, damage, speed, etc. }
     */
    registerPrefab: function(name, config) {
      // Store prefab config for later use
      if (!this._prefabs) this._prefabs = {};
      this._prefabs[name] = config;
      console.log('[Projectile] Registered prefab: ' + name);
    }
  };

  console.log('[Projectile] Module loaded');
})();
