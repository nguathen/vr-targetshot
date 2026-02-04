/**
 * Melee Combat System - Hand/weapon collision attacks for VR combat
 * Usage: <script src="/framework/utils/haptics.js"></script>
 *        <script src="/framework/audio/audio-manager.js"></script>
 *        <script src="/framework/vfx/particles.js"></script> (optional)
 *        <script src="/framework/combat/melee.js"></script>
 *
 * Weapon setup (attach to hand or grabbable weapon):
 *   <a-entity id="right-hand" melee-weapon="damage: 25; minVelocity: 2"></a-entity>
 *   <a-entity grabbable melee-weapon="damage: 50; hitRadius: 0.4">
 *     <a-box scale="0.1 0.1 0.8"></a-box>
 *   </a-entity>
 *
 * Target marking:
 *   <a-box hittable></a-box>
 *   <a-box hittable="onHit: myHitHandler"></a-box>
 *
 * Events:
 *   - melee-swing: { hand, velocity, speed } - Emitted when velocity threshold met
 *   - melee-hit: { target, velocity, damage, point, hand } - Emitted on hit
 *
 * Global API:
 *   Melee.setEnabled(false);        // Disable melee system
 *   Melee.isEnabled();              // Check if enabled
 *   Melee.setDamageMultiplier(1.5); // Global damage multiplier
 *   Melee.getDamageMultiplier();    // Get current multiplier
 */
(function() {
  'use strict';

  // Configuration
  var DEFAULT_DAMAGE = 25;
  var DEFAULT_MIN_VELOCITY = 2.0;     // m/s threshold for hit detection
  var DEFAULT_COOLDOWN = 300;         // ms between hits on same target
  var DEFAULT_HIT_RADIUS = 0.2;       // meters for sphere overlap test
  var VELOCITY_SAMPLES = 5;           // Samples for velocity smoothing
  var SWING_COOLDOWN = 100;           // ms between swing events
  var DAMAGE_VELOCITY_SCALE = 0.1;    // Extra damage per m/s above threshold

  // Module state
  var systemEnabled = true;
  var globalDamageMultiplier = 1.0;

  // Cached hittable elements (avoid querySelectorAll per frame)
  var _hittableCache = new Set();

  // Pre-allocated vectors for calculations
  var _tempVec3 = new THREE.Vector3();
  var _tempVec3B = new THREE.Vector3();

  /**
   * Melee weapon component - attaches to hand or grabbable weapon.
   */
  AFRAME.registerComponent('melee-weapon', {
    schema: {
      damage: { type: 'number', default: DEFAULT_DAMAGE },
      minVelocity: { type: 'number', default: DEFAULT_MIN_VELOCITY },
      cooldown: { type: 'number', default: DEFAULT_COOLDOWN },
      hitRadius: { type: 'number', default: DEFAULT_HIT_RADIUS },
      damageScaling: { type: 'boolean', default: true },      // Higher velocity = more damage
      swingSound: { type: 'string', default: '' },            // Sound ID for whoosh
      hitSound: { type: 'string', default: '' },              // Sound ID for impact
      hapticOnSwing: { type: 'boolean', default: true },
      hapticOnHit: { type: 'boolean', default: true },
      vfxOnHit: { type: 'boolean', default: true },
      vfxColor: { type: 'color', default: '#ff8800' }
    },

    init: function() {
      this.hand = this.detectHand();
      this.isSwinging = false;
      this.lastSwingTime = 0;

      // Velocity tracking - pre-allocated circular buffer to avoid GC
      this.positionHistory = [];
      for (var i = 0; i < VELOCITY_SAMPLES; i++) {
        this.positionHistory.push({
          position: new THREE.Vector3(),
          time: 0
        });
      }
      this.historyIndex = 0;      // Current write index (circular)
      this.historyCount = 0;      // Number of valid samples (0 to VELOCITY_SAMPLES)

      this.lastPosition = new THREE.Vector3();
      this.currentVelocity = new THREE.Vector3();
      this.currentSpeed = 0;
      this.tempPosition = new THREE.Vector3();

      // Cooldown tracking per target (Map: element -> lastHitTime)
      this.targetCooldowns = new Map();

      // Initialize position
      this.el.object3D.getWorldPosition(this.lastPosition);

      console.log('[Melee] Weapon initialized on ' + (this.hand || 'entity'));
    },

    remove: function() {
      this.targetCooldowns.clear();
    },

    /**
     * Detect which hand this weapon is attached to.
     * @returns {string|null} 'left', 'right', or null
     */
    detectHand: function() {
      var id = this.el.id;
      if (id === 'left-hand') return 'left';
      if (id === 'right-hand') return 'right';

      // Check parent (for weapons attached to hands)
      var parent = this.el.parentElement;
      if (parent) {
        if (parent.id === 'left-hand') return 'left';
        if (parent.id === 'right-hand') return 'right';
      }

      // Check if held by a hand via grabbable
      var grabbable = this.el.components.grabbable;
      if (grabbable && grabbable.isHeld) {
        return grabbable.holdingHand;
      }

      return null;
    },

    tick: function(time, delta) {
      if (!systemEnabled) return;
      if (delta <= 0) return;

      // Track velocity
      this.trackVelocity(delta);

      // Update hand detection for grabbed weapons
      if (this.el.components.grabbable) {
        this.hand = this.detectHand();
      }

      // Check for swing (velocity above threshold)
      var now = performance.now();
      var wasSwinging = this.isSwinging;
      this.isSwinging = this.currentSpeed >= this.data.minVelocity;

      // Emit swing event on transition to swinging state
      if (this.isSwinging && !wasSwinging && now - this.lastSwingTime > SWING_COOLDOWN) {
        this.lastSwingTime = now;
        this.onSwing();
      }

      // Check for hits while swinging
      if (this.isSwinging) {
        this.checkHits();
      }

      // Clean up old cooldowns
      this.cleanupCooldowns(now);
    },

    /**
     * Track weapon velocity using position history.
     * Uses pre-allocated circular buffer to avoid GC allocations.
     */
    trackVelocity: function(delta) {
      var currentPos = this.tempPosition;
      this.el.object3D.getWorldPosition(currentPos);

      // Store in circular buffer - reuse existing object
      var entry = this.positionHistory[this.historyIndex];
      entry.position.copy(currentPos);
      entry.time = performance.now();

      // Advance circular index
      this.historyIndex = (this.historyIndex + 1) % VELOCITY_SAMPLES;

      // Track how many valid samples we have
      if (this.historyCount < VELOCITY_SAMPLES) {
        this.historyCount++;
      }

      // Calculate smoothed velocity using history
      if (this.historyCount >= 2) {
        // Oldest is at current historyIndex (just got overwritten on next cycle)
        // or at index 0 if buffer not full yet
        var oldestIndex = this.historyCount < VELOCITY_SAMPLES ? 0 : this.historyIndex;
        // Newest is at previous index (just written)
        var newestIndex = (this.historyIndex - 1 + VELOCITY_SAMPLES) % VELOCITY_SAMPLES;

        var oldest = this.positionHistory[oldestIndex];
        var newest = this.positionHistory[newestIndex];
        var timeDiff = (newest.time - oldest.time) / 1000;

        if (timeDiff > 0) {
          this.currentVelocity.subVectors(newest.position, oldest.position);
          this.currentVelocity.divideScalar(timeDiff);
          this.currentSpeed = this.currentVelocity.length();
        }
      }

      this.lastPosition.copy(currentPos);
    },

    /**
     * Handle swing detection.
     */
    onSwing: function() {
      // Emit swing event
      this.el.emit('melee-swing', {
        hand: this.hand,
        velocity: this.currentVelocity.clone(),
        speed: this.currentSpeed
      });

      // Swing sound (whoosh)
      if (this.data.swingSound && window.AudioManager) {
        AudioManager.play(this.data.swingSound);
      }

      // Light haptic on swing
      if (this.data.hapticOnSwing && this.hand && window.Haptics) {
        Haptics.light(this.hand);
      }
    },

    /**
     * Check for hits with hittable targets.
     * Uses cached hittable set for O(1) lookup instead of querySelectorAll per frame.
     */
    checkHits: function() {
      var weaponPos = _tempVec3;
      this.el.object3D.getWorldPosition(weaponPos);

      var hitRadius = this.data.hitRadius;
      var now = performance.now();
      var self = this;

      // Use cached hittable set (no DOM query per frame)
      _hittableCache.forEach(function(targetEl) {
        // Skip if on cooldown for this target
        var lastHit = self.targetCooldowns.get(targetEl);
        if (lastHit && now - lastHit < self.data.cooldown) {
          return;  // continue in forEach
        }

        // Sphere overlap test
        var targetPos = _tempVec3B;
        targetEl.object3D.getWorldPosition(targetPos);
        var distance = weaponPos.distanceTo(targetPos);

        // Get target's bounding radius (approximate)
        var targetRadius = self.getTargetRadius(targetEl);
        var combinedRadius = hitRadius + targetRadius;

        if (distance <= combinedRadius) {
          self.onHit(targetEl, weaponPos, now);
        }
      });
    },

    /**
     * Get approximate radius of target for collision.
     * @param {Element} targetEl
     * @returns {number}
     */
    getTargetRadius: function(targetEl) {
      // Try to get from geometry
      var geometry = targetEl.getAttribute('geometry');
      if (geometry) {
        // Simple approximation based on geometry type
        if (geometry.primitive === 'sphere') {
          return geometry.radius || 0.5;
        }
        if (geometry.primitive === 'box') {
          var w = geometry.width || 1;
          var h = geometry.height || 1;
          var d = geometry.depth || 1;
          return Math.max(w, h, d) / 2;
        }
      }

      // Check scale
      var scale = targetEl.object3D.scale;
      var maxScale = Math.max(scale.x, scale.y, scale.z);

      // Default radius
      return 0.5 * maxScale;
    },

    /**
     * Handle a successful hit on a target.
     */
    onHit: function(targetEl, hitPoint, now) {
      // Set cooldown for this target
      this.targetCooldowns.set(targetEl, now);

      // Calculate damage with velocity scaling
      var damage = this.data.damage;
      if (this.data.damageScaling) {
        var velocityBonus = (this.currentSpeed - this.data.minVelocity) * DAMAGE_VELOCITY_SCALE;
        damage += damage * velocityBonus;
      }
      damage *= globalDamageMultiplier;
      damage = Math.round(damage);

      var hitDetail = {
        target: targetEl,
        velocity: this.currentVelocity.clone(),
        speed: this.currentSpeed,
        damage: damage,
        point: hitPoint.clone(),
        hand: this.hand,
        weapon: this.el
      };

      // Emit hit event on weapon
      this.el.emit('melee-hit', hitDetail);

      // Emit hit event on target
      targetEl.emit('melee-hit', hitDetail);

      // Apply damage if target has destructible component
      if (targetEl.components.destructible) {
        targetEl.components.destructible.takeDamage(damage, this.el);
      }

      // Call hittable's onHit callback if specified
      var hittableComp = targetEl.components.hittable;
      if (hittableComp && hittableComp.data.onHit && window[hittableComp.data.onHit]) {
        window[hittableComp.data.onHit](hitDetail);
      }

      // Hit sound
      if (this.data.hitSound && window.AudioManager) {
        AudioManager.play(this.data.hitSound);
      }

      // Strong haptic on hit
      if (this.data.hapticOnHit && this.hand && window.Haptics) {
        Haptics.heavy(this.hand);
      }

      // Hit VFX (spark at contact point)
      if (this.data.vfxOnHit && window.Particles) {
        Particles.emit('hit', hitPoint, {
          color: this.data.vfxColor,
          count: 15,
          speed: 3,
          spread: 0.8,
          lifetime: 300
        });
      }

      console.log('[Melee] Hit ' + (targetEl.id || 'target') + ' for ' + damage + ' damage at ' +
        this.currentSpeed.toFixed(2) + ' m/s');
    },

    /**
     * Clean up expired cooldowns to prevent memory leaks.
     */
    cleanupCooldowns: function(now) {
      // Only clean up occasionally
      if (this.targetCooldowns.size > 50) {
        var cooldown = this.data.cooldown;
        var toDelete = [];

        this.targetCooldowns.forEach(function(lastHit, target) {
          if (now - lastHit > cooldown * 2) {
            toDelete.push(target);
          }
        });

        var self = this;
        toDelete.forEach(function(target) {
          self.targetCooldowns.delete(target);
        });
      }
    }
  });

  /**
   * Hittable component - marks entities that can receive melee damage.
   * Note: This extends the hittable component from projectile.js if already registered.
   */
  if (!AFRAME.components.hittable) {
    AFRAME.registerComponent('hittable', {
      schema: {
        onHit: { type: 'string', default: '' }  // Optional callback function name
      },

      init: function() {
        this.hitHandler = this.onHit.bind(this);
        this.el.addEventListener('melee-hit', this.hitHandler);
        this.el.addEventListener('projectile-hit', this.hitHandler);

        // Add to cache for fast lookup in checkHits()
        _hittableCache.add(this.el);
      },

      remove: function() {
        this.el.removeEventListener('melee-hit', this.hitHandler);
        this.el.removeEventListener('projectile-hit', this.hitHandler);

        // Remove from cache
        _hittableCache.delete(this.el);
      },

      onHit: function(evt) {
        // Call custom handler if specified
        if (this.data.onHit && window[this.data.onHit]) {
          window[this.data.onHit](evt.detail);
        }
      }
    });
  } else {
    // Extend existing hittable to also listen for melee-hit
    var originalInit = AFRAME.components.hittable.Component.prototype.init;
    var originalRemove = AFRAME.components.hittable.Component.prototype.remove;

    AFRAME.components.hittable.Component.prototype.init = function() {
      if (originalInit) originalInit.call(this);

      this.meleeHitHandler = this.onMeleeHit.bind(this);
      this.el.addEventListener('melee-hit', this.meleeHitHandler);

      // Add to cache for fast lookup in checkHits()
      _hittableCache.add(this.el);
    };

    AFRAME.components.hittable.Component.prototype.remove = function() {
      if (originalRemove) originalRemove.call(this);

      this.el.removeEventListener('melee-hit', this.meleeHitHandler);

      // Remove from cache
      _hittableCache.delete(this.el);
    };

    AFRAME.components.hittable.Component.prototype.onMeleeHit = function(evt) {
      if (this.data.onHit && window[this.data.onHit]) {
        window[this.data.onHit](evt.detail);
      }
    };
  }

  /**
   * Global Melee API
   */
  window.Melee = {
    /**
     * Enable/disable the melee system.
     * @param {boolean} enabled
     */
    setEnabled: function(enabled) {
      systemEnabled = enabled;
      console.log('[Melee] System ' + (enabled ? 'enabled' : 'disabled'));
    },

    /**
     * Check if melee system is enabled.
     * @returns {boolean}
     */
    isEnabled: function() {
      return systemEnabled;
    },

    /**
     * Set global damage multiplier.
     * @param {number} multiplier - Damage multiplier (1.0 = normal)
     */
    setDamageMultiplier: function(multiplier) {
      globalDamageMultiplier = Math.max(0, multiplier);
      console.log('[Melee] Damage multiplier set to ' + globalDamageMultiplier);
    },

    /**
     * Get global damage multiplier.
     * @returns {number}
     */
    getDamageMultiplier: function() {
      return globalDamageMultiplier;
    },

    /**
     * Reset all weapon cooldowns.
     */
    resetCooldowns: function() {
      var weapons = document.querySelectorAll('[melee-weapon]');
      weapons.forEach(function(el) {
        var comp = el.components['melee-weapon'];
        if (comp) {
          comp.targetCooldowns.clear();
        }
      });
      console.log('[Melee] All cooldowns reset');
    },

    /**
     * Get statistics for all melee weapons.
     * @returns {Object} { weaponCount, activeWeapons }
     */
    getStats: function() {
      var weapons = document.querySelectorAll('[melee-weapon]');
      var active = 0;

      weapons.forEach(function(el) {
        var comp = el.components['melee-weapon'];
        if (comp && comp.isSwinging) {
          active++;
        }
      });

      return {
        weaponCount: weapons.length,
        activeWeapons: active,
        hittableCount: _hittableCache.size
      };
    },

    /**
     * Get count of cached hittable elements.
     * @returns {number}
     */
    getHittableCount: function() {
      return _hittableCache.size;
    }
  };

  console.log('[Melee] Module loaded (hittable cache enabled)');
})();
