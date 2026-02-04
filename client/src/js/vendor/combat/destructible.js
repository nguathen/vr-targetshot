/**
 * Destructible System - Breakable objects with HP, damage states, and debris
 * Usage: <script src="/framework/utils/haptics.js"></script>
 *        <script src="/framework/audio/audio-manager.js"></script>
 *        <script src="/framework/vfx/particles.js"></script> (optional)
 *        <script src="/framework/combat/destructible.js"></script>
 *
 * Basic setup:
 *   <a-box destructible="hp: 100"></a-box>
 *   <a-box destructible="hp: 50; breakEffect: fragments" hittable></a-box>
 *
 * With damage states (visual changes at HP thresholds):
 *   <a-box destructible="hp: 100; damageStates: 75 50 25"></a-box>
 *
 * Events (on destructible element):
 *   - damage-taken: { amount, currentHp, maxHp, source }
 *   - destroyed: { source }
 *
 * Global API:
 *   Destructible.damage(el, 25);         // Deal 25 damage
 *   Destructible.damage(el, 25, source); // Deal 25 damage with attacker ref
 *   Destructible.destroy(el);            // Force destroy
 *   Destructible.repair(el);             // Restore to full HP
 *   Destructible.repair(el, 50);         // Heal 50 HP
 *   Destructible.getHp(el);              // Get current HP
 *   Destructible.isDestroyed(el);        // Check if destroyed
 *   Destructible.setEnabled(false);      // Disable system
 */
(function() {
  'use strict';

  // Configuration
  var DEFAULT_HP = 100;
  var DEBRIS_COUNT = 6;
  var DEBRIS_LIFETIME = 3000;       // ms before debris fades
  var DEBRIS_SPREAD = 2;            // velocity spread factor
  var DEBRIS_GRAVITY = -9.81;       // m/s^2

  // Module state
  var systemEnabled = true;
  var registeredDestructibles = new Set();

  // Pre-allocated vectors
  var _tempVec3 = new THREE.Vector3();

  /**
   * Destructible component - marks objects that can be damaged and destroyed.
   */
  AFRAME.registerComponent('destructible', {
    schema: {
      hp: { type: 'number', default: DEFAULT_HP },
      currentHp: { type: 'number', default: -1 },  // -1 means use hp value
      damageStates: { type: 'array', default: [] }, // HP thresholds for visual changes (e.g., [75, 50, 25])
      breakEffect: { type: 'string', default: 'particles' }, // 'particles', 'fragments', 'none'
      damageSound: { type: 'string', default: '' },
      destroySound: { type: 'string', default: '' },
      hapticOnHit: { type: 'boolean', default: true },
      invincible: { type: 'boolean', default: false },
      autoDestroy: { type: 'boolean', default: true },  // Hide and emit event when HP <= 0
      debrisColor: { type: 'color', default: '' },      // Use original color if empty
      debrisScale: { type: 'number', default: 0.15 }    // Scale of debris pieces
    },

    init: function() {
      // Initialize current HP
      if (this.data.currentHp < 0) {
        this.currentHp = this.data.hp;
      } else {
        this.currentHp = this.data.currentHp;
      }

      this.maxHp = this.data.hp;
      this.isDestroyed = false;
      this.currentDamageState = -1;  // Index of current damage state
      this.originalMaterial = null;
      this.originalColor = null;
      this.debrisEntities = [];

      // Store original material for damage states
      this.storeOriginalMaterial();

      // Parse damage states (sorted descending)
      this.damageThresholds = this.parseDamageStates();

      // Bind event handlers
      this.onProjectileHit = this.onProjectileHit.bind(this);
      this.onMeleeHit = this.onMeleeHit.bind(this);

      // Listen for damage events from projectile and melee systems
      this.el.addEventListener('projectile-hit', this.onProjectileHit);
      this.el.addEventListener('melee-hit', this.onMeleeHit);

      // Register
      registeredDestructibles.add(this.el);

      console.log('[Destructible] Initialized with ' + this.currentHp + '/' + this.maxHp + ' HP');
    },

    remove: function() {
      this.el.removeEventListener('projectile-hit', this.onProjectileHit);
      this.el.removeEventListener('melee-hit', this.onMeleeHit);
      registeredDestructibles.delete(this.el);
      this.cleanupDebris();
    },

    update: function(oldData) {
      // Handle hp change
      if (oldData.hp !== undefined && oldData.hp !== this.data.hp) {
        this.maxHp = this.data.hp;
        if (this.currentHp > this.maxHp) {
          this.currentHp = this.maxHp;
        }
      }

      // Handle currentHp change from attribute
      if (oldData.currentHp !== undefined && oldData.currentHp !== this.data.currentHp) {
        if (this.data.currentHp >= 0) {
          this.currentHp = this.data.currentHp;
          this.updateDamageState();
        }
      }

      // Re-parse damage states if changed
      if (oldData.damageStates !== undefined) {
        this.damageThresholds = this.parseDamageStates();
        this.updateDamageState();
      }
    },

    /**
     * Store original material for damage state restoration.
     */
    storeOriginalMaterial: function() {
      var material = this.el.getAttribute('material');
      if (material) {
        this.originalColor = material.color || '#ffffff';
        this.originalMaterial = Object.assign({}, material);
      } else {
        this.originalColor = '#ffffff';
      }
    },

    /**
     * Parse damage states from schema array.
     * @returns {Array<{threshold: number, index: number}>}
     */
    parseDamageStates: function() {
      var states = this.data.damageStates;
      if (!states || states.length === 0) {
        return [];
      }

      var thresholds = [];
      for (var i = 0; i < states.length; i++) {
        var value = parseFloat(states[i]);
        if (!isNaN(value)) {
          thresholds.push({ threshold: value, index: i });
        }
      }

      // Sort descending (highest threshold first)
      thresholds.sort(function(a, b) { return b.threshold - a.threshold; });

      return thresholds;
    },

    /**
     * Handle projectile-hit event.
     */
    onProjectileHit: function(evt) {
      if (!systemEnabled || this.isDestroyed) return;

      var damage = evt.detail.damage || 0;
      var source = evt.detail.source || null;

      this.takeDamage(damage, source);
    },

    /**
     * Handle melee-hit event.
     */
    onMeleeHit: function(evt) {
      if (!systemEnabled || this.isDestroyed) return;

      var damage = evt.detail.damage || 0;
      var source = evt.detail.weapon || evt.detail.hand || null;

      this.takeDamage(damage, source);
    },

    /**
     * Take damage and handle destruction.
     * @param {number} amount - Damage amount
     * @param {Element|null} source - Source entity (attacker)
     */
    takeDamage: function(amount, source) {
      if (!systemEnabled || this.isDestroyed || this.data.invincible) return;
      if (amount <= 0) return;

      var previousHp = this.currentHp;
      this.currentHp = Math.max(0, this.currentHp - amount);

      // Emit damage event
      this.el.emit('damage-taken', {
        amount: amount,
        currentHp: this.currentHp,
        maxHp: this.maxHp,
        source: source
      });

      // Play damage sound
      if (this.data.damageSound && window.AudioManager) {
        AudioManager.play(this.data.damageSound);
      }

      // Haptic feedback to attacker
      if (this.data.hapticOnHit && source) {
        this.triggerAttackerHaptic(source);
      }

      // Update visual damage state
      this.updateDamageState();

      console.log('[Destructible] ' + (this.el.id || 'entity') + ' took ' + amount +
        ' damage (' + this.currentHp + '/' + this.maxHp + ')');

      // Check for destruction
      if (this.currentHp <= 0 && this.data.autoDestroy) {
        this.destroy(source);
      }
    },

    /**
     * Trigger haptic feedback on the attacker's hand.
     * @param {Element} source - Source entity
     */
    triggerAttackerHaptic: function(source) {
      if (!window.Haptics) return;

      // Try to determine which hand dealt the damage
      var hand = null;

      if (source) {
        var sourceId = source.id || '';
        if (sourceId.indexOf('left') !== -1) {
          hand = 'left';
        } else if (sourceId.indexOf('right') !== -1) {
          hand = 'right';
        }

        // Check parent if not found
        if (!hand && source.parentElement) {
          var parentId = source.parentElement.id || '';
          if (parentId.indexOf('left') !== -1) {
            hand = 'left';
          } else if (parentId.indexOf('right') !== -1) {
            hand = 'right';
          }
        }
      }

      if (hand) {
        Haptics.medium(hand);
      }
    },

    /**
     * Update visual state based on current HP.
     */
    updateDamageState: function() {
      if (this.damageThresholds.length === 0) return;

      var hpPercent = (this.currentHp / this.maxHp) * 100;
      var newStateIndex = -1;

      // Find which damage state we're in
      for (var i = 0; i < this.damageThresholds.length; i++) {
        if (hpPercent <= this.damageThresholds[i].threshold) {
          newStateIndex = this.damageThresholds[i].index;
        } else {
          break;
        }
      }

      // Apply visual change if state changed
      if (newStateIndex !== this.currentDamageState) {
        this.currentDamageState = newStateIndex;
        this.applyDamageStateVisual(newStateIndex);
      }
    },

    /**
     * Apply visual changes for damage state.
     * @param {number} stateIndex - Damage state index (-1 for full health)
     */
    applyDamageStateVisual: function(stateIndex) {
      if (stateIndex < 0) {
        // Restore original
        if (this.originalMaterial) {
          this.el.setAttribute('material', 'color', this.originalColor);
        }
        return;
      }

      // Progressive damage coloring (darken toward black/red)
      var damageColors = ['#ccaa77', '#aa6644', '#772222'];
      var colorIndex = Math.min(stateIndex, damageColors.length - 1);
      var damageColor = damageColors[colorIndex];

      // Apply damage color
      this.el.setAttribute('material', 'color', damageColor);

      // Emit particles at each damage state transition
      if (window.Particles) {
        var worldPos = new THREE.Vector3();
        this.el.object3D.getWorldPosition(worldPos);
        Particles.emit('dust', worldPos, {
          color: damageColor,
          count: 5,
          speed: 1
        });
      }
    },

    /**
     * Force destroy this object.
     * @param {Element|null} source - Source entity (attacker)
     */
    destroy: function(source) {
      if (this.isDestroyed) return;

      this.isDestroyed = true;
      this.currentHp = 0;

      // Emit destroyed event
      this.el.emit('destroyed', { source: source });

      // Play destroy sound
      if (this.data.destroySound && window.AudioManager) {
        AudioManager.play(this.data.destroySound);
      }

      // Create break effect
      this.createBreakEffect();

      // Hide original object
      this.el.setAttribute('visible', false);

      // Disable physics/collision if present
      if (this.el.body) {
        this.el.body.type = 0;  // Static
      }

      console.log('[Destructible] ' + (this.el.id || 'entity') + ' destroyed');
    },

    /**
     * Create destruction visual effect.
     */
    createBreakEffect: function() {
      var worldPos = new THREE.Vector3();
      this.el.object3D.getWorldPosition(worldPos);

      var breakEffect = this.data.breakEffect;

      if (breakEffect === 'particles') {
        this.createParticleEffect(worldPos);
      } else if (breakEffect === 'fragments') {
        this.createDebrisFragments(worldPos);
      }
      // 'none' = no effect
    },

    /**
     * Create particle explosion effect.
     * @param {THREE.Vector3} position
     */
    createParticleEffect: function(position) {
      if (!window.Particles) return;

      var color = this.data.debrisColor || this.originalColor || '#aa8866';

      Particles.emit('explosion', position, {
        color: color,
        count: 25,
        speed: 3,
        spread: 1.0,
        lifetime: 500
      });
    },

    /**
     * Create debris fragment entities.
     * @param {THREE.Vector3} position
     */
    createDebrisFragments: function(position) {
      var scene = this.el.sceneEl;
      if (!scene) return;

      var debrisColor = this.data.debrisColor || this.originalColor || '#aa8866';
      var debrisScale = this.data.debrisScale;

      for (var i = 0; i < DEBRIS_COUNT; i++) {
        var debris = this.createDebrisPiece(debrisColor, debrisScale);

        // Position at center with slight random offset
        var offset = {
          x: (Math.random() - 0.5) * 0.2,
          y: (Math.random() - 0.5) * 0.2,
          z: (Math.random() - 0.5) * 0.2
        };
        debris.el.object3D.position.set(
          position.x + offset.x,
          position.y + offset.y,
          position.z + offset.z
        );

        // Random velocity
        debris.velocity.set(
          (Math.random() - 0.5) * DEBRIS_SPREAD,
          Math.random() * DEBRIS_SPREAD * 0.5 + 1,  // Upward bias
          (Math.random() - 0.5) * DEBRIS_SPREAD
        );

        // Random rotation
        debris.el.object3D.rotation.set(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2
        );

        // Random angular velocity
        debris.angularVelocity.set(
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 5
        );

        scene.appendChild(debris.el);
        this.debrisEntities.push(debris);
      }

      // Also emit some particles for extra effect
      if (window.Particles) {
        Particles.emit('hit', position, {
          color: debrisColor,
          count: 15,
          speed: 2
        });
      }

      // Start debris animation
      this.animateDebris();
    },

    /**
     * Create a single debris piece.
     * @param {string} color
     * @param {number} scale
     * @returns {{el: Element, velocity: THREE.Vector3, angularVelocity: THREE.Vector3}}
     */
    createDebrisPiece: function(color, scale) {
      var el = document.createElement('a-entity');

      // Random shape (box or simple geometry)
      var shapes = ['box', 'tetrahedron'];
      var shape = shapes[Math.floor(Math.random() * shapes.length)];

      var scaleVariation = scale * (0.5 + Math.random() * 1.0);

      if (shape === 'box') {
        el.setAttribute('geometry', {
          primitive: 'box',
          width: scaleVariation,
          height: scaleVariation * (0.5 + Math.random()),
          depth: scaleVariation * (0.5 + Math.random())
        });
      } else {
        el.setAttribute('geometry', {
          primitive: 'tetrahedron',
          radius: scaleVariation
        });
      }

      el.setAttribute('material', {
        color: color,
        shader: 'flat'
      });

      return {
        el: el,
        velocity: new THREE.Vector3(),
        angularVelocity: new THREE.Vector3(),
        startTime: performance.now()
      };
    },

    /**
     * Animate debris pieces.
     */
    animateDebris: function() {
      var self = this;
      var lastTime = performance.now();

      function update() {
        var now = performance.now();
        var delta = (now - lastTime) / 1000;
        lastTime = now;

        var allExpired = true;

        for (var i = 0; i < self.debrisEntities.length; i++) {
          var debris = self.debrisEntities[i];
          var elapsed = now - debris.startTime;

          if (elapsed < DEBRIS_LIFETIME) {
            allExpired = false;

            // Apply gravity
            debris.velocity.y += DEBRIS_GRAVITY * delta;

            // Move
            debris.el.object3D.position.x += debris.velocity.x * delta;
            debris.el.object3D.position.y += debris.velocity.y * delta;
            debris.el.object3D.position.z += debris.velocity.z * delta;

            // Floor collision (simple bounce)
            if (debris.el.object3D.position.y < 0) {
              debris.el.object3D.position.y = 0;
              debris.velocity.y *= -0.3;  // Damped bounce
              debris.velocity.x *= 0.8;
              debris.velocity.z *= 0.8;
              debris.angularVelocity.multiplyScalar(0.5);
            }

            // Rotate
            debris.el.object3D.rotation.x += debris.angularVelocity.x * delta;
            debris.el.object3D.rotation.y += debris.angularVelocity.y * delta;
            debris.el.object3D.rotation.z += debris.angularVelocity.z * delta;

            // Fade out in last portion of lifetime
            var fadeStart = DEBRIS_LIFETIME * 0.7;
            if (elapsed > fadeStart) {
              var fadeProgress = (elapsed - fadeStart) / (DEBRIS_LIFETIME - fadeStart);
              debris.el.setAttribute('material', 'opacity', 1 - fadeProgress);
            }
          } else {
            // Hide expired debris
            debris.el.setAttribute('visible', false);
          }
        }

        if (!allExpired) {
          requestAnimationFrame(update);
        } else {
          // Cleanup all debris
          self.cleanupDebris();
        }
      }

      requestAnimationFrame(update);
    },

    /**
     * Clean up debris entities.
     */
    cleanupDebris: function() {
      for (var i = 0; i < this.debrisEntities.length; i++) {
        var debris = this.debrisEntities[i];
        if (debris.el.parentNode) {
          debris.el.parentNode.removeChild(debris.el);
        }
      }
      this.debrisEntities = [];
    },

    /**
     * Repair this object (restore HP).
     * @param {number} [amount] - HP to restore (undefined = full heal)
     */
    repair: function(amount) {
      if (amount === undefined) {
        this.currentHp = this.maxHp;
      } else {
        this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
      }

      // Reset destroyed state if fully repaired
      if (this.currentHp > 0 && this.isDestroyed) {
        this.isDestroyed = false;
        this.el.setAttribute('visible', true);
      }

      // Update visual state
      this.updateDamageState();

      console.log('[Destructible] ' + (this.el.id || 'entity') + ' repaired to ' +
        this.currentHp + '/' + this.maxHp);
    },

    /**
     * Get current HP.
     * @returns {number}
     */
    getHp: function() {
      return this.currentHp;
    },

    /**
     * Get max HP.
     * @returns {number}
     */
    getMaxHp: function() {
      return this.maxHp;
    }
  });

  /**
   * Global Destructible API
   */
  window.Destructible = {
    /**
     * Deal damage to a destructible element.
     * @param {Element} el - Target element with destructible component
     * @param {number} amount - Damage amount
     * @param {Element} [source] - Source/attacker element
     * @returns {boolean} True if damage was applied
     */
    damage: function(el, amount, source) {
      if (!el || !el.components || !el.components.destructible) {
        console.warn('[Destructible] Element does not have destructible component');
        return false;
      }

      el.components.destructible.takeDamage(amount, source || null);
      return true;
    },

    /**
     * Force destroy a destructible element.
     * @param {Element} el - Target element
     * @param {Element} [source] - Source/attacker element
     * @returns {boolean} True if destroyed
     */
    destroy: function(el, source) {
      if (!el || !el.components || !el.components.destructible) {
        console.warn('[Destructible] Element does not have destructible component');
        return false;
      }

      el.components.destructible.destroy(source || null);
      return true;
    },

    /**
     * Repair a destructible element.
     * @param {Element} el - Target element
     * @param {number} [amount] - HP to restore (undefined = full heal)
     * @returns {boolean} True if repaired
     */
    repair: function(el, amount) {
      if (!el || !el.components || !el.components.destructible) {
        console.warn('[Destructible] Element does not have destructible component');
        return false;
      }

      el.components.destructible.repair(amount);
      return true;
    },

    /**
     * Get current HP of a destructible element.
     * @param {Element} el - Target element
     * @returns {number|null} Current HP or null if not destructible
     */
    getHp: function(el) {
      if (!el || !el.components || !el.components.destructible) {
        return null;
      }
      return el.components.destructible.getHp();
    },

    /**
     * Get max HP of a destructible element.
     * @param {Element} el - Target element
     * @returns {number|null} Max HP or null if not destructible
     */
    getMaxHp: function(el) {
      if (!el || !el.components || !el.components.destructible) {
        return null;
      }
      return el.components.destructible.getMaxHp();
    },

    /**
     * Check if a destructible element is destroyed.
     * @param {Element} el - Target element
     * @returns {boolean|null} True if destroyed, null if not destructible
     */
    isDestroyed: function(el) {
      if (!el || !el.components || !el.components.destructible) {
        return null;
      }
      return el.components.destructible.isDestroyed;
    },

    /**
     * Enable or disable the destructible system.
     * @param {boolean} enabled
     */
    setEnabled: function(enabled) {
      systemEnabled = enabled;
      console.log('[Destructible] System ' + (enabled ? 'enabled' : 'disabled'));
    },

    /**
     * Check if system is enabled.
     * @returns {boolean}
     */
    isEnabled: function() {
      return systemEnabled;
    },

    /**
     * Get all registered destructible elements.
     * @returns {Element[]}
     */
    getAll: function() {
      return Array.from(registeredDestructibles);
    },

    /**
     * Get all undestroyed destructible elements.
     * @returns {Element[]}
     */
    getAlive: function() {
      return Array.from(registeredDestructibles).filter(function(el) {
        return el.components.destructible && !el.components.destructible.isDestroyed;
      });
    },

    /**
     * Get all destroyed destructible elements.
     * @returns {Element[]}
     */
    getDestroyed: function() {
      return Array.from(registeredDestructibles).filter(function(el) {
        return el.components.destructible && el.components.destructible.isDestroyed;
      });
    },

    /**
     * Repair all destructible elements.
     */
    repairAll: function() {
      registeredDestructibles.forEach(function(el) {
        if (el.components.destructible) {
          el.components.destructible.repair();
        }
      });
      console.log('[Destructible] All objects repaired');
    },

    /**
     * Destroy all destructible elements.
     */
    destroyAll: function() {
      registeredDestructibles.forEach(function(el) {
        if (el.components.destructible && !el.components.destructible.isDestroyed) {
          el.components.destructible.destroy(null);
        }
      });
      console.log('[Destructible] All objects destroyed');
    },

    /**
     * Get statistics.
     * @returns {{total: number, alive: number, destroyed: number}}
     */
    getStats: function() {
      var alive = 0;
      var destroyed = 0;

      registeredDestructibles.forEach(function(el) {
        if (el.components.destructible) {
          if (el.components.destructible.isDestroyed) {
            destroyed++;
          } else {
            alive++;
          }
        }
      });

      return {
        total: registeredDestructibles.size,
        alive: alive,
        destroyed: destroyed
      };
    }
  };

  console.log('[Destructible] Module loaded');
})();
