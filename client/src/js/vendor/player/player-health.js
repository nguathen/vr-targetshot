/**
 * Player Health System - HP tracking, damage, healing, death/respawn for VR games
 * Usage: <script src="/framework/player/player-health.js"></script>
 *
 * Attach to player rig or camera:
 *   <a-entity id="player-rig" player-health="maxHp: 100; lowHpThreshold: 0.25">
 *
 * Global API:
 *   PlayerHealth.getHp();           // Get current HP
 *   PlayerHealth.getMaxHp();        // Get max HP
 *   PlayerHealth.damage(25);        // Take 25 damage
 *   PlayerHealth.heal(10);          // Heal 10 HP
 *   PlayerHealth.kill();            // Force death
 *   PlayerHealth.respawn();         // Respawn at spawn point
 *   PlayerHealth.setSpawnPoint(pos, rot);  // Set respawn location
 *   PlayerHealth.isAlive();         // Check if player is alive
 *   PlayerHealth.disable();         // Disable damage (god mode)
 *   PlayerHealth.enable();          // Enable damage
 *
 * Events (emitted on component element):
 *   player-damage { amount, currentHp, maxHp, source }
 *   player-heal { amount, currentHp, maxHp }
 *   player-death { source }
 *   player-respawn { hp, position }
 *   player-low-hp { currentHp, threshold }
 *   player-hp-recovered { currentHp }
 *
 * Integrates with:
 *   - DamageVignette: Red flash on damage, pulse on low HP
 *   - Haptics: Strong pulse on damage, pattern on low HP
 *   - HUD: Updates 'hp' element if registered
 *   - AudioManager: Plays heartbeat on low HP (if loaded)
 */
(function() {
  'use strict';

  var activeComponent = null;
  var heartbeatInterval = null;
  var lowHpPulseInterval = null;

  /**
   * @typedef {Object} SpawnPoint
   * @property {Object} position - {x, y, z}
   * @property {Object} rotation - {x, y, z}
   */

  /**
   * Default spawn point (origin).
   * @type {SpawnPoint}
   */
  var defaultSpawnPoint = {
    position: { x: 0, y: 1.6, z: 0 },
    rotation: { x: 0, y: 0, z: 0 }
  };

  AFRAME.registerComponent('player-health', {
    schema: {
      maxHp: { type: 'number', default: 100 },
      currentHp: { type: 'number', default: -1 },
      invincibilityTime: { type: 'number', default: 500 },
      lowHpThreshold: { type: 'number', default: 0.25 },
      autoRespawn: { type: 'boolean', default: false },
      respawnDelay: { type: 'number', default: 3000 },
      enabled: { type: 'boolean', default: true },
      hudKey: { type: 'string', default: 'hp' },
      heartbeatSoundId: { type: 'string', default: 'heartbeat' },
      damageSoundId: { type: 'string', default: 'player-damage' }
    },

    init: function() {
      // Set current HP to max if not specified
      if (this.data.currentHp < 0) {
        this.data.currentHp = this.data.maxHp;
      }

      this.hp = this.data.currentHp;
      this.maxHp = this.data.maxHp;
      this.isInvincible = false;
      this.invincibilityTimer = null;
      this.alive = true;
      this.respawnTimer = null;
      this.isLowHp = false;

      // Spawn point - capture initial position
      var pos = this.el.getAttribute('position') || { x: 0, y: 1.6, z: 0 };
      var rot = this.el.getAttribute('rotation') || { x: 0, y: 0, z: 0 };
      this.spawnPoint = {
        position: { x: pos.x, y: pos.y, z: pos.z },
        rotation: { x: rot.x, y: rot.y, z: rot.z }
      };

      activeComponent = this;
      this.updateHud();

      console.log('[PlayerHealth] Initialized - HP: ' + this.hp + '/' + this.maxHp);
    },

    /**
     * Take damage with invincibility frames.
     * @param {number} amount - Damage amount
     * @param {string} [source] - Damage source identifier
     * @returns {boolean} True if damage was applied
     */
    takeDamage: function(amount, source) {
      if (!this.data.enabled || !this.alive || this.isInvincible) {
        return false;
      }

      amount = Math.max(0, amount);
      var previousHp = this.hp;
      this.hp = Math.max(0, this.hp - amount);

      // Start invincibility frames
      this.startInvincibility();

      // Visual feedback
      this.triggerDamageFeedback(amount);

      // Emit damage event
      this.el.emit('player-damage', {
        amount: amount,
        currentHp: this.hp,
        maxHp: this.maxHp,
        source: source || 'unknown'
      });

      this.updateHud();

      // Check for low HP
      this.checkLowHp();

      // Check for death
      if (this.hp <= 0) {
        this.die(source);
      }

      console.log('[PlayerHealth] Damage: ' + amount + ' (HP: ' + this.hp + '/' + this.maxHp + ')');
      return true;
    },

    /**
     * Heal HP (capped at max).
     * @param {number} amount - Heal amount
     * @returns {number} Actual amount healed
     */
    heal: function(amount) {
      if (!this.alive) return 0;

      amount = Math.max(0, amount);
      var previousHp = this.hp;
      this.hp = Math.min(this.maxHp, this.hp + amount);
      var actualHeal = this.hp - previousHp;

      if (actualHeal > 0) {
        this.el.emit('player-heal', {
          amount: actualHeal,
          currentHp: this.hp,
          maxHp: this.maxHp
        });

        this.updateHud();
        this.checkLowHp();

        console.log('[PlayerHealth] Heal: ' + actualHeal + ' (HP: ' + this.hp + '/' + this.maxHp + ')');
      }

      return actualHeal;
    },

    /**
     * Set HP directly.
     * @param {number} value - New HP value
     */
    setHp: function(value) {
      var wasLowHp = this.isLowHp;
      this.hp = Math.max(0, Math.min(this.maxHp, value));
      this.updateHud();
      this.checkLowHp();

      if (this.hp <= 0 && this.alive) {
        this.die('setHp');
      }
    },

    /**
     * Set max HP.
     * @param {number} value - New max HP value
     * @param {boolean} [healToMax] - Whether to heal to new max
     */
    setMaxHp: function(value, healToMax) {
      this.maxHp = Math.max(1, value);
      if (healToMax) {
        this.hp = this.maxHp;
      } else {
        this.hp = Math.min(this.hp, this.maxHp);
      }
      this.updateHud();
      this.checkLowHp();
    },

    /**
     * Start invincibility frames.
     */
    startInvincibility: function() {
      var self = this;
      this.isInvincible = true;

      if (this.invincibilityTimer) {
        clearTimeout(this.invincibilityTimer);
      }

      this.invincibilityTimer = setTimeout(function() {
        self.isInvincible = false;
        self.invincibilityTimer = null;
      }, this.data.invincibilityTime);
    },

    /**
     * Trigger damage visual/audio/haptic feedback.
     * @param {number} amount - Damage amount
     */
    triggerDamageFeedback: function(amount) {
      // Intensity scales with damage (10 damage = 0.3, 50+ = 1.0)
      var intensity = Math.min(1.0, 0.3 + (amount / 70));

      // Damage vignette flash
      if (typeof DamageVignette !== 'undefined') {
        DamageVignette.flash(intensity);
      }

      // Haptic feedback - strong pulse on both hands
      if (typeof Haptics !== 'undefined') {
        Haptics.heavy('both');
      }

      // Damage sound
      if (typeof AudioManager !== 'undefined' && this.data.damageSoundId) {
        AudioManager.play(this.data.damageSoundId);
      }
    },

    /**
     * Check and handle low HP state.
     */
    checkLowHp: function() {
      var threshold = this.data.lowHpThreshold * this.maxHp;
      var wasLowHp = this.isLowHp;
      this.isLowHp = this.hp > 0 && this.hp <= threshold;

      if (this.isLowHp && !wasLowHp) {
        // Entered low HP state
        this.startLowHpWarning();
        this.el.emit('player-low-hp', {
          currentHp: this.hp,
          threshold: threshold
        });
        console.log('[PlayerHealth] Low HP warning!');
      } else if (!this.isLowHp && wasLowHp) {
        // Recovered from low HP
        this.stopLowHpWarning();
        this.el.emit('player-hp-recovered', {
          currentHp: this.hp
        });
        console.log('[PlayerHealth] HP recovered');
      }
    },

    /**
     * Start low HP warning effects (vignette pulse + heartbeat).
     */
    startLowHpWarning: function() {
      var self = this;

      // Stop any existing warnings
      this.stopLowHpWarning();

      // Vignette pulse every 800ms
      lowHpPulseInterval = setInterval(function() {
        if (!self.isLowHp || !self.alive) {
          self.stopLowHpWarning();
          return;
        }

        // Pulse intensity increases as HP decreases
        var hpRatio = self.hp / self.maxHp;
        var pulseIntensity = 0.3 + (0.4 * (1 - hpRatio / self.data.lowHpThreshold));

        if (typeof DamageVignette !== 'undefined') {
          DamageVignette.flash(pulseIntensity, 400);
        }

        // Haptic pattern
        if (typeof Haptics !== 'undefined') {
          Haptics.pattern('both', [
            { intensity: 0.4, duration: 100 },
            { intensity: 0.1, duration: 50 },
            { intensity: 0.3, duration: 80 }
          ]);
        }
      }, 800);

      // Heartbeat sound loop
      if (typeof AudioManager !== 'undefined' && this.data.heartbeatSoundId) {
        heartbeatInterval = setInterval(function() {
          if (!self.isLowHp || !self.alive) {
            self.stopLowHpWarning();
            return;
          }
          AudioManager.play(self.data.heartbeatSoundId);
        }, 800);
      }
    },

    /**
     * Stop low HP warning effects.
     */
    stopLowHpWarning: function() {
      if (lowHpPulseInterval) {
        clearInterval(lowHpPulseInterval);
        lowHpPulseInterval = null;
      }
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    },

    /**
     * Handle player death.
     * @param {string} [source] - Death source
     */
    die: function(source) {
      if (!this.alive) return;

      this.alive = false;
      this.hp = 0;
      this.stopLowHpWarning();

      // Death feedback
      if (typeof DamageVignette !== 'undefined') {
        DamageVignette.flash(1.0, 1000);
      }

      if (typeof Haptics !== 'undefined') {
        Haptics.pattern('both', [
          { intensity: 1.0, duration: 200 },
          { intensity: 0.5, duration: 100 },
          { intensity: 0.8, duration: 150 },
          { intensity: 0.3, duration: 100 }
        ]);
      }

      this.el.emit('player-death', {
        source: source || 'unknown'
      });

      this.updateHud();

      console.log('[PlayerHealth] Player died (source: ' + (source || 'unknown') + ')');

      // Auto-respawn if enabled
      if (this.data.autoRespawn) {
        var self = this;
        this.respawnTimer = setTimeout(function() {
          self.respawn();
        }, this.data.respawnDelay);
      }
    },

    /**
     * Force kill the player.
     */
    kill: function() {
      this.hp = 0;
      this.die('kill');
    },

    /**
     * Respawn the player.
     */
    respawn: function() {
      if (this.respawnTimer) {
        clearTimeout(this.respawnTimer);
        this.respawnTimer = null;
      }

      this.alive = true;
      this.hp = this.maxHp;
      this.isInvincible = false;
      this.isLowHp = false;
      this.stopLowHpWarning();

      // Reset position to spawn point
      this.el.setAttribute('position', this.spawnPoint.position);
      this.el.setAttribute('rotation', this.spawnPoint.rotation);

      this.el.emit('player-respawn', {
        hp: this.hp,
        position: this.spawnPoint.position
      });

      this.updateHud();

      console.log('[PlayerHealth] Player respawned at', this.spawnPoint.position);
    },

    /**
     * Set spawn point.
     * @param {Object} position - {x, y, z}
     * @param {Object} [rotation] - {x, y, z}
     */
    setSpawnPoint: function(position, rotation) {
      this.spawnPoint.position = {
        x: position.x || 0,
        y: position.y || 1.6,
        z: position.z || 0
      };
      if (rotation) {
        this.spawnPoint.rotation = {
          x: rotation.x || 0,
          y: rotation.y || 0,
          z: rotation.z || 0
        };
      }
    },

    /**
     * Update HUD display.
     */
    updateHud: function() {
      if (typeof HUD !== 'undefined' && this.data.hudKey) {
        HUD.update(this.data.hudKey, this.hp + '/' + this.maxHp);
      }
    },

    /**
     * Enable damage (disable god mode).
     */
    enable: function() {
      this.el.setAttribute('player-health', 'enabled', true);
    },

    /**
     * Disable damage (god mode).
     */
    disable: function() {
      this.el.setAttribute('player-health', 'enabled', false);
    },

    /**
     * Get current HP.
     * @returns {number}
     */
    getHp: function() {
      return this.hp;
    },

    /**
     * Get max HP.
     * @returns {number}
     */
    getMaxHp: function() {
      return this.maxHp;
    },

    /**
     * Check if player is alive.
     * @returns {boolean}
     */
    isPlayerAlive: function() {
      return this.alive;
    },

    /**
     * Get HP ratio (0-1).
     * @returns {number}
     */
    getHpRatio: function() {
      return this.hp / this.maxHp;
    },

    remove: function() {
      this.stopLowHpWarning();

      if (this.invincibilityTimer) {
        clearTimeout(this.invincibilityTimer);
      }
      if (this.respawnTimer) {
        clearTimeout(this.respawnTimer);
      }

      if (activeComponent === this) {
        activeComponent = null;
      }
    }
  });

  /**
   * Global PlayerHealth API.
   * @namespace PlayerHealth
   */
  window.PlayerHealth = {
    /**
     * Get current HP.
     * @returns {number}
     */
    getHp: function() {
      if (activeComponent) {
        return activeComponent.getHp();
      }
      var comp = findComponent();
      return comp ? comp.getHp() : 0;
    },

    /**
     * Get max HP.
     * @returns {number}
     */
    getMaxHp: function() {
      if (activeComponent) {
        return activeComponent.getMaxHp();
      }
      var comp = findComponent();
      return comp ? comp.getMaxHp() : 0;
    },

    /**
     * Get HP ratio (0-1).
     * @returns {number}
     */
    getHpRatio: function() {
      if (activeComponent) {
        return activeComponent.getHpRatio();
      }
      var comp = findComponent();
      return comp ? comp.getHpRatio() : 0;
    },

    /**
     * Take damage.
     * @param {number} amount - Damage amount
     * @param {string} [source] - Damage source
     * @returns {boolean} True if damage applied
     */
    damage: function(amount, source) {
      if (activeComponent) {
        return activeComponent.takeDamage(amount, source);
      }
      var comp = findComponent();
      return comp ? comp.takeDamage(amount, source) : false;
    },

    /**
     * Heal HP.
     * @param {number} amount - Heal amount
     * @returns {number} Actual amount healed
     */
    heal: function(amount) {
      if (activeComponent) {
        return activeComponent.heal(amount);
      }
      var comp = findComponent();
      return comp ? comp.heal(amount) : 0;
    },

    /**
     * Set HP directly.
     * @param {number} value - New HP value
     */
    setHp: function(value) {
      if (activeComponent) {
        activeComponent.setHp(value);
        return;
      }
      var comp = findComponent();
      if (comp) comp.setHp(value);
    },

    /**
     * Set max HP.
     * @param {number} value - New max HP
     * @param {boolean} [healToMax] - Heal to new max
     */
    setMaxHp: function(value, healToMax) {
      if (activeComponent) {
        activeComponent.setMaxHp(value, healToMax);
        return;
      }
      var comp = findComponent();
      if (comp) comp.setMaxHp(value, healToMax);
    },

    /**
     * Kill the player.
     */
    kill: function() {
      if (activeComponent) {
        activeComponent.kill();
        return;
      }
      var comp = findComponent();
      if (comp) comp.kill();
    },

    /**
     * Respawn the player.
     */
    respawn: function() {
      if (activeComponent) {
        activeComponent.respawn();
        return;
      }
      var comp = findComponent();
      if (comp) comp.respawn();
    },

    /**
     * Set spawn point.
     * @param {Object} position - {x, y, z}
     * @param {Object} [rotation] - {x, y, z}
     */
    setSpawnPoint: function(position, rotation) {
      if (activeComponent) {
        activeComponent.setSpawnPoint(position, rotation);
        return;
      }
      var comp = findComponent();
      if (comp) comp.setSpawnPoint(position, rotation);
    },

    /**
     * Check if player is alive.
     * @returns {boolean}
     */
    isAlive: function() {
      if (activeComponent) {
        return activeComponent.isPlayerAlive();
      }
      var comp = findComponent();
      return comp ? comp.isPlayerAlive() : false;
    },

    /**
     * Enable damage system.
     */
    enable: function() {
      if (activeComponent) {
        activeComponent.enable();
        return;
      }
      var comp = findComponent();
      if (comp) comp.enable();
    },

    /**
     * Disable damage system (god mode).
     */
    disable: function() {
      if (activeComponent) {
        activeComponent.disable();
        return;
      }
      var comp = findComponent();
      if (comp) comp.disable();
    },

    /**
     * Get the active component instance.
     * @returns {Object|null}
     */
    getComponent: function() {
      return activeComponent || findComponent();
    }
  };

  /**
   * Find player-health component in scene.
   * @returns {Object|null}
   */
  function findComponent() {
    var el = document.querySelector('[player-health]');
    if (el && el.components && el.components['player-health']) {
      return el.components['player-health'];
    }
    return null;
  }

  console.log('[PlayerHealth] Module loaded');
})();
