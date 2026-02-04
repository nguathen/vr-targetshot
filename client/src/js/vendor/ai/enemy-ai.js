/**
 * Enemy AI Component - Behavior state machine for VR enemies
 * Usage: <script src="/framework/ai/enemy-ai.js"></script>
 *
 * Attach to enemy entities:
 *   <a-entity enemy-ai></a-entity>
 *   <a-entity enemy-ai="behavior: patrol; speed: 2; detectRange: 8; attackRange: 1.5"></a-entity>
 *
 * Waypoints for patrol:
 *   <a-entity enemy-ai="behavior: patrol; waypoints: #wp1, #wp2, #wp3"></a-entity>
 *   <a-entity id="wp1" position="0 0 -5"></a-entity>
 *   <a-entity id="wp2" position="5 0 0"></a-entity>
 *
 * Events emitted:
 *   - ai-state-change: { from: string, to: string }
 *   - ai-spotted-player: { distance: number }
 *   - ai-attack: { distance: number }
 *   - ai-lost-player: {}
 *
 * Global API:
 *   EnemyAI.setPlayerRig('#player-rig');  // Set custom player target
 *   EnemyAI.enable();   // Enable all AI
 *   EnemyAI.disable();  // Disable all AI
 */
(function() {
  'use strict';

  // Valid AI states
  var STATES = ['idle', 'patrol', 'chase', 'attack', 'flee'];

  // Global config
  var config = {
    enabled: true,
    playerRigSelector: '#player-rig',
    debugDraw: false
  };

  // Pre-allocated vectors for performance
  var tempVec = new THREE.Vector3();
  var tempVec2 = new THREE.Vector3();
  var tempDir = new THREE.Vector3();
  var raycaster = new THREE.Raycaster();

  /**
   * Get player world position
   * @returns {THREE.Vector3|null}
   */
  function getPlayerPosition() {
    var playerRig = document.querySelector(config.playerRigSelector);
    if (!playerRig) return null;

    var camera = playerRig.querySelector('a-camera, [camera]');
    var target = camera || playerRig;

    tempVec.set(0, 0, 0);
    target.object3D.getWorldPosition(tempVec);
    return tempVec;
  }

  /**
   * Enemy AI Component
   */
  AFRAME.registerComponent('enemy-ai', {
    schema: {
      behavior: { type: 'string', default: 'idle' },  // Initial behavior
      speed: { type: 'number', default: 2 },          // Movement speed (m/s)
      rotationSpeed: { type: 'number', default: 4 },  // Rotation speed (rad/s)
      detectRange: { type: 'number', default: 10 },   // Player detection range
      attackRange: { type: 'number', default: 1.5 },  // Attack trigger range
      fleeRange: { type: 'number', default: 15 },     // Distance to flee to
      loseRange: { type: 'number', default: 15 },     // Distance to lose player
      attackCooldown: { type: 'number', default: 1000 }, // ms between attacks
      waypoints: { type: 'string', default: '' },     // Comma-separated selectors
      patrolRadius: { type: 'number', default: 5 },   // Random patrol radius
      idleDuration: { type: 'number', default: 2000 }, // ms to idle between patrols
      lineOfSight: { type: 'boolean', default: true }, // Require LOS for detection
      losLayers: { type: 'string', default: '' }      // Objects that block LOS
    },

    init: function() {
      // State machine
      this.currentState = this.data.behavior;
      this.previousState = null;
      this.stateStartTime = 0;

      // Movement
      this.targetPosition = new THREE.Vector3();
      this.hasTarget = false;
      this.startPosition = new THREE.Vector3();
      this.el.object3D.getWorldPosition(this.startPosition);

      // Patrol
      this.waypointEntities = [];
      this.currentWaypointIndex = 0;
      this.parseWaypoints();

      // Combat
      this.lastAttackTime = 0;
      this.playerSpotted = false;
      this.lastKnownPlayerPos = new THREE.Vector3();

      // Timers
      this.idleTimer = 0;
      this.nextPatrolTime = 0;

      console.log('[EnemyAI] Initialized with behavior:', this.currentState);
    },

    parseWaypoints: function() {
      if (!this.data.waypoints) return;

      var selectors = this.data.waypoints.split(',').map(function(s) {
        return s.trim();
      });

      var self = this;
      selectors.forEach(function(sel) {
        if (!sel) return;
        var el = document.querySelector(sel);
        if (el) {
          self.waypointEntities.push(el);
        } else {
          console.warn('[EnemyAI] Waypoint not found:', sel);
        }
      });
    },

    update: function(oldData) {
      // Handle behavior change via attribute update
      if (oldData.behavior !== this.data.behavior) {
        this.transition(this.data.behavior);
      }
    },

    /**
     * Transition to a new state
     * @param {string} newState - Target state
     * @returns {boolean} Success
     */
    transition: function(newState) {
      if (STATES.indexOf(newState) === -1) {
        console.error('[EnemyAI] Invalid state:', newState);
        return false;
      }

      if (newState === this.currentState) return false;

      var oldState = this.currentState;
      this.previousState = oldState;
      this.currentState = newState;
      this.stateStartTime = performance.now();

      // Reset state-specific data
      this.onStateEnter(newState, oldState);

      // Emit event
      this.el.emit('ai-state-change', {
        from: oldState,
        to: newState
      });

      console.log('[EnemyAI] State:', oldState, '->', newState);
      return true;
    },

    /**
     * Called when entering a new state
     */
    onStateEnter: function(state, fromState) {
      switch (state) {
        case 'idle':
          this.hasTarget = false;
          this.idleTimer = performance.now();
          break;

        case 'patrol':
          this.setNextPatrolTarget();
          break;

        case 'chase':
          // Keep last known player position
          break;

        case 'attack':
          // Attack immediately on entry
          this.lastAttackTime = 0;
          break;

        case 'flee':
          this.setFleeTarget();
          break;
      }
    },

    tick: function(time, delta) {
      if (!config.enabled) return;
      if (!delta || delta <= 0) return;

      var deltaSeconds = delta / 1000;

      // Check for player
      this.checkPlayer();

      // Execute current behavior
      switch (this.currentState) {
        case 'idle':
          this.tickIdle(deltaSeconds);
          break;
        case 'patrol':
          this.tickPatrol(deltaSeconds);
          break;
        case 'chase':
          this.tickChase(deltaSeconds);
          break;
        case 'attack':
          this.tickAttack(deltaSeconds);
          break;
        case 'flee':
          this.tickFlee(deltaSeconds);
          break;
      }
    },

    /**
     * Check for player and update spotted state
     */
    checkPlayer: function() {
      var playerPos = getPlayerPosition();
      if (!playerPos) return;

      var myPos = tempVec2;
      this.el.object3D.getWorldPosition(myPos);

      var distance = myPos.distanceTo(playerPos);
      var wasSpotted = this.playerSpotted;

      // Detection check
      if (distance <= this.data.detectRange) {
        // Line of sight check
        var hasLOS = !this.data.lineOfSight || this.checkLineOfSight(myPos, playerPos);

        if (hasLOS) {
          if (!this.playerSpotted) {
            this.playerSpotted = true;
            this.el.emit('ai-spotted-player', { distance: distance });
            console.log('[EnemyAI] Spotted player at distance:', distance.toFixed(2));
          }
          this.lastKnownPlayerPos.copy(playerPos);
        }
      }

      // Lose player check (only if previously spotted)
      if (this.playerSpotted && distance > this.data.loseRange) {
        this.playerSpotted = false;
        this.el.emit('ai-lost-player', {});
        console.log('[EnemyAI] Lost player');
      }

      // State transitions based on player
      if (this.playerSpotted) {
        if (distance <= this.data.attackRange) {
          if (this.currentState !== 'attack' && this.currentState !== 'flee') {
            this.transition('attack');
          }
        } else if (this.currentState !== 'chase' && this.currentState !== 'attack' && this.currentState !== 'flee') {
          this.transition('chase');
        }
      } else if (wasSpotted && !this.playerSpotted) {
        // Lost player, return to patrol or idle
        if (this.waypointEntities.length > 0 || this.data.patrolRadius > 0) {
          this.transition('patrol');
        } else {
          this.transition('idle');
        }
      }
    },

    /**
     * Check line of sight to player
     * @param {THREE.Vector3} from - Start position
     * @param {THREE.Vector3} to - Target position
     * @returns {boolean} Has clear line of sight
     */
    checkLineOfSight: function(from, to) {
      tempDir.subVectors(to, from);
      var distance = tempDir.length();
      tempDir.normalize();

      raycaster.set(from, tempDir);
      raycaster.far = distance;

      // Get blocking objects
      var blockers = [];
      if (this.data.losLayers) {
        var selectors = this.data.losLayers.split(',').map(function(s) {
          return s.trim();
        });
        selectors.forEach(function(sel) {
          var els = document.querySelectorAll(sel);
          els.forEach(function(el) {
            if (el.object3D) {
              blockers.push(el.object3D);
            }
          });
        });
      }

      // If no blockers specified, use scene children excluding player and self
      if (blockers.length === 0) {
        var scene = this.el.sceneEl.object3D;
        scene.children.forEach(function(child) {
          // Skip non-mesh objects
          if (!child.isMesh && child.children.length === 0) return;
          blockers.push(child);
        });
      }

      // Perform raycast
      var intersects = raycaster.intersectObjects(blockers, true);

      // Filter out self and player
      var self = this;
      var playerRig = document.querySelector(config.playerRigSelector);

      for (var i = 0; i < intersects.length; i++) {
        var obj = intersects[i].object;

        // Traverse up to find A-Frame entity
        var current = obj;
        while (current) {
          if (current.el) {
            // Skip self
            if (current.el === self.el) break;
            // Skip player
            if (playerRig && (current.el === playerRig || playerRig.contains(current.el))) break;
            // Hit something else - blocked
            return false;
          }
          current = current.parent;
        }
      }

      return true;
    },

    /**
     * Idle behavior - wait then patrol
     */
    tickIdle: function(deltaSeconds) {
      var elapsed = performance.now() - this.idleTimer;
      if (elapsed >= this.data.idleDuration) {
        // Check if we have waypoints or patrol radius
        if (this.waypointEntities.length > 0 || this.data.patrolRadius > 0) {
          this.transition('patrol');
        } else {
          // Reset idle timer to continue idling
          this.idleTimer = performance.now();
        }
      }
    },

    /**
     * Patrol behavior - follow waypoints or random movement
     */
    tickPatrol: function(deltaSeconds) {
      if (!this.hasTarget) {
        this.setNextPatrolTarget();
      }

      if (this.hasTarget) {
        var arrived = this.moveToward(this.targetPosition, deltaSeconds);
        if (arrived) {
          this.hasTarget = false;
          this.transition('idle');
        }
      }
    },

    /**
     * Set the next patrol target position
     */
    setNextPatrolTarget: function() {
      if (this.waypointEntities.length > 0) {
        // Use waypoints
        var waypoint = this.waypointEntities[this.currentWaypointIndex];
        waypoint.object3D.getWorldPosition(this.targetPosition);
        this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypointEntities.length;
      } else if (this.data.patrolRadius > 0) {
        // Random position within patrol radius
        var angle = Math.random() * Math.PI * 2;
        var radius = Math.random() * this.data.patrolRadius;
        this.targetPosition.set(
          this.startPosition.x + Math.cos(angle) * radius,
          this.startPosition.y,
          this.startPosition.z + Math.sin(angle) * radius
        );
      } else {
        return;
      }

      this.hasTarget = true;
    },

    /**
     * Chase behavior - move toward player
     */
    tickChase: function(deltaSeconds) {
      if (!this.playerSpotted) {
        // Move to last known position
        this.targetPosition.copy(this.lastKnownPlayerPos);
      } else {
        // Update target to current player position
        var playerPos = getPlayerPosition();
        if (playerPos) {
          this.targetPosition.copy(playerPos);
        }
      }

      this.hasTarget = true;
      this.moveToward(this.targetPosition, deltaSeconds);

      // Check if in attack range
      var myPos = tempVec2;
      this.el.object3D.getWorldPosition(myPos);
      var distance = myPos.distanceTo(this.targetPosition);

      if (this.playerSpotted && distance <= this.data.attackRange) {
        this.transition('attack');
      }
    },

    /**
     * Attack behavior - attack when ready
     */
    tickAttack: function(deltaSeconds) {
      var now = performance.now();
      var playerPos = getPlayerPosition();

      if (!playerPos || !this.playerSpotted) {
        this.transition('chase');
        return;
      }

      // Face player
      this.faceTarget(playerPos, deltaSeconds);

      // Check if player moved out of range
      var myPos = tempVec2;
      this.el.object3D.getWorldPosition(myPos);
      var distance = myPos.distanceTo(playerPos);

      if (distance > this.data.attackRange * 1.2) {
        // Player escaped, chase
        this.transition('chase');
        return;
      }

      // Attack on cooldown
      if (now - this.lastAttackTime >= this.data.attackCooldown) {
        this.lastAttackTime = now;
        this.el.emit('ai-attack', { distance: distance });
        console.log('[EnemyAI] Attack!');
      }
    },

    /**
     * Flee behavior - run away from player
     */
    tickFlee: function(deltaSeconds) {
      if (!this.hasTarget) {
        this.setFleeTarget();
      }

      var arrived = this.moveToward(this.targetPosition, deltaSeconds);
      if (arrived) {
        // Check if far enough from player
        var playerPos = getPlayerPosition();
        if (playerPos) {
          var myPos = tempVec2;
          this.el.object3D.getWorldPosition(myPos);
          var distance = myPos.distanceTo(playerPos);

          if (distance >= this.data.fleeRange) {
            // Safe distance, go idle
            this.playerSpotted = false;
            this.transition('idle');
          } else {
            // Keep fleeing
            this.setFleeTarget();
          }
        } else {
          this.transition('idle');
        }
      }
    },

    /**
     * Set flee target position (away from player)
     */
    setFleeTarget: function() {
      var playerPos = getPlayerPosition();
      if (!playerPos) return;

      var myPos = tempVec2;
      this.el.object3D.getWorldPosition(myPos);

      // Direction away from player
      tempDir.subVectors(myPos, playerPos).normalize();

      // Target position
      this.targetPosition.copy(myPos).addScaledVector(tempDir, this.data.fleeRange);
      this.hasTarget = true;
    },

    /**
     * Move toward a target position
     * @param {THREE.Vector3} target - Target position
     * @param {number} deltaSeconds - Frame delta
     * @returns {boolean} Arrived at target
     */
    moveToward: function(target, deltaSeconds) {
      var myPos = tempVec2;
      this.el.object3D.getWorldPosition(myPos);

      tempDir.subVectors(target, myPos);
      tempDir.y = 0;  // Keep movement horizontal
      var distance = tempDir.length();

      // Arrival threshold
      if (distance < 0.1) {
        return true;
      }

      tempDir.normalize();

      // Face movement direction
      this.faceDirection(tempDir, deltaSeconds);

      // Move
      var moveDistance = Math.min(this.data.speed * deltaSeconds, distance);
      this.el.object3D.position.x += tempDir.x * moveDistance;
      this.el.object3D.position.z += tempDir.z * moveDistance;

      return false;
    },

    /**
     * Face a target position
     */
    faceTarget: function(target, deltaSeconds) {
      var myPos = tempVec2;
      this.el.object3D.getWorldPosition(myPos);

      tempDir.subVectors(target, myPos);
      tempDir.y = 0;

      if (tempDir.length() > 0.01) {
        this.faceDirection(tempDir.normalize(), deltaSeconds);
      }
    },

    /**
     * Face a direction with smooth rotation
     */
    faceDirection: function(direction, deltaSeconds) {
      var targetAngle = Math.atan2(direction.x, direction.z);
      var currentAngle = this.el.object3D.rotation.y;

      // Shortest rotation path
      var diff = targetAngle - currentAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      // Smooth rotation
      var rotateAmount = this.data.rotationSpeed * deltaSeconds;
      if (Math.abs(diff) < rotateAmount) {
        this.el.object3D.rotation.y = targetAngle;
      } else {
        this.el.object3D.rotation.y += Math.sign(diff) * rotateAmount;
      }
    },

    /**
     * Force transition to flee state
     */
    flee: function() {
      this.transition('flee');
    },

    /**
     * Get current state
     * @returns {string}
     */
    getState: function() {
      return this.currentState;
    },

    /**
     * Check if player is spotted
     * @returns {boolean}
     */
    isPlayerSpotted: function() {
      return this.playerSpotted;
    }
  });

  /**
   * Global EnemyAI API
   */
  window.EnemyAI = {
    /**
     * Set custom player rig selector
     * @param {string} selector - CSS selector for player rig
     */
    setPlayerRig: function(selector) {
      config.playerRigSelector = selector;
      console.log('[EnemyAI] Player rig set to:', selector);
    },

    /**
     * Enable all enemy AI
     */
    enable: function() {
      config.enabled = true;
      console.log('[EnemyAI] System enabled');
    },

    /**
     * Disable all enemy AI
     */
    disable: function() {
      config.enabled = false;
      console.log('[EnemyAI] System disabled');
    },

    /**
     * Check if system is enabled
     * @returns {boolean}
     */
    isEnabled: function() {
      return config.enabled;
    },

    /**
     * Get all enemy AI entities
     * @returns {NodeList}
     */
    getAll: function() {
      return document.querySelectorAll('[enemy-ai]');
    },

    /**
     * Transition all enemies to a state
     * @param {string} state - Target state
     */
    transitionAll: function(state) {
      var enemies = this.getAll();
      enemies.forEach(function(el) {
        if (el.components['enemy-ai']) {
          el.components['enemy-ai'].transition(state);
        }
      });
    },

    /**
     * Make all enemies flee
     */
    fleeAll: function() {
      this.transitionAll('flee');
    },

    /**
     * Reset all enemies to idle
     */
    resetAll: function() {
      this.transitionAll('idle');
    }
  };

  console.log('[EnemyAI] Module loaded');
})();
