/**
 * Spawner - Entity spawner utility with ObjectPool integration
 * Usage: <script src="/framework/utils/spawner.js"></script>
 * Requires: object-pool.js
 *
 * Basic usage:
 *   var spawner = Spawner.create(function() {
 *     var el = document.createElement('a-sphere');
 *     el.setAttribute('radius', '0.3');
 *     el.setAttribute('material', 'color: #ff4444');
 *     return el;
 *   }, 20);
 *
 *   var enemy = spawner.spawn({ x: 0, y: 1, z: -5 });
 *   spawner.despawn(enemy);
 *   spawner.despawnAll();
 *
 * Wave spawning:
 *   spawner.spawnWave(5, 500, [
 *     { x: -2, y: 1, z: -5 },
 *     { x: 0, y: 1, z: -5 },
 *     { x: 2, y: 1, z: -5 }
 *   ]);
 *
 * Events:
 *   spawner.on('spawned', function(entity, position) { ... });
 *   spawner.on('despawned', function(entity) { ... });
 *   spawner.on('wave-complete', function(count) { ... });
 */
window.Spawner = (function() {
  'use strict';

  // Check for ObjectPool dependency
  if (typeof window.ObjectPool === 'undefined') {
    console.error('[Spawner] ObjectPool is required. Include object-pool.js first.');
  }

  /**
   * Create a new spawner instance.
   * @param {Function} factory - Function that creates new entities
   * @param {number} poolSize - Initial pool size
   * @param {Object} opts - { maxSize: number, parent: Element }
   * @returns {Object} Spawner instance
   */
  function create(factory, poolSize, opts) {
    if (typeof factory !== 'function') {
      throw new Error('[Spawner] Factory must be a function');
    }

    opts = opts || {};
    poolSize = poolSize || 10;

    var pool = ObjectPool.create(factory, poolSize, { maxSize: opts.maxSize || 100 });
    var spawned = new Set();
    var parent = opts.parent || null;
    var listeners = {
      'spawned': [],
      'despawned': [],
      'wave-complete': []
    };
    var waveTimers = [];

    console.log('[Spawner] Created with pool size ' + poolSize);

    /**
     * Emit event to listeners.
     */
    function emit(event, data1, data2) {
      var handlers = listeners[event];
      if (handlers) {
        for (var i = 0; i < handlers.length; i++) {
          handlers[i](data1, data2);
        }
      }
    }

    /**
     * Spawn an entity at position.
     * @param {Object} position - { x, y, z }
     * @param {Object} config - Optional config { rotation, scale, data }
     * @returns {Element|null} Spawned entity or null if pool exhausted
     */
    function spawn(position, config) {
      var entity = pool.get();
      if (!entity) {
        console.warn('[Spawner] Pool exhausted, cannot spawn');
        return null;
      }

      position = position || { x: 0, y: 0, z: 0 };
      config = config || {};

      // Set position
      if (entity.object3D) {
        entity.object3D.position.set(
          position.x || 0,
          position.y || 0,
          position.z || 0
        );
      } else if (typeof entity.setAttribute === 'function') {
        entity.setAttribute('position', position);
      }

      // Set rotation if provided
      if (config.rotation) {
        if (entity.object3D) {
          entity.object3D.rotation.set(
            (config.rotation.x || 0) * Math.PI / 180,
            (config.rotation.y || 0) * Math.PI / 180,
            (config.rotation.z || 0) * Math.PI / 180
          );
        } else if (typeof entity.setAttribute === 'function') {
          entity.setAttribute('rotation', config.rotation);
        }
      }

      // Set scale if provided
      if (config.scale) {
        if (entity.object3D) {
          var s = typeof config.scale === 'number' ? config.scale : 1;
          var sx = config.scale.x !== undefined ? config.scale.x : s;
          var sy = config.scale.y !== undefined ? config.scale.y : s;
          var sz = config.scale.z !== undefined ? config.scale.z : s;
          entity.object3D.scale.set(sx, sy, sz);
        } else if (typeof entity.setAttribute === 'function') {
          entity.setAttribute('scale', config.scale);
        }
      }

      // Store custom data on entity
      if (config.data) {
        entity._spawnerData = config.data;
      }

      // Add to parent if not already attached
      if (parent && !entity.parentNode) {
        parent.appendChild(entity);
      } else if (!entity.parentNode) {
        var scene = document.querySelector('a-scene');
        if (scene) {
          scene.appendChild(entity);
        }
      }

      spawned.add(entity);
      emit('spawned', entity, position);

      return entity;
    }

    /**
     * Despawn an entity and return to pool.
     * @param {Element} entity - Entity to despawn
     * @returns {boolean} True if despawned successfully
     */
    function despawn(entity) {
      if (!spawned.has(entity)) {
        console.warn('[Spawner] Entity not from this spawner');
        return false;
      }

      spawned.delete(entity);
      delete entity._spawnerData;
      pool.release(entity);
      emit('despawned', entity);

      return true;
    }

    /**
     * Despawn all spawned entities.
     */
    function despawnAll() {
      spawned.forEach(function(entity) {
        delete entity._spawnerData;
        pool.release(entity);
        emit('despawned', entity);
      });
      spawned.clear();
    }

    /**
     * Spawn a wave of entities with interval.
     * @param {number} count - Number of entities to spawn
     * @param {number} interval - Milliseconds between spawns
     * @param {Array|Function} positions - Array of positions or function(index) returning position
     * @param {Object} config - Optional config applied to all spawned entities
     * @returns {Object} Wave controller { cancel }
     */
    function spawnWave(count, interval, positions, config) {
      if (count <= 0) {
        emit('wave-complete', 0);
        return { cancel: function() {} };
      }

      interval = interval || 500;
      config = config || {};

      var spawnedCount = 0;
      var cancelled = false;
      var timerIds = [];

      function getPosition(index) {
        if (typeof positions === 'function') {
          return positions(index);
        }
        if (Array.isArray(positions) && positions.length > 0) {
          return positions[index % positions.length];
        }
        return { x: 0, y: 0, z: 0 };
      }

      function spawnNext(index) {
        if (cancelled || index >= count) {
          return;
        }

        var pos = getPosition(index);
        var entity = spawn(pos, config);

        if (entity) {
          spawnedCount++;
        }

        if (index + 1 < count) {
          var timerId = setTimeout(function() {
            spawnNext(index + 1);
          }, interval);
          timerIds.push(timerId);
          waveTimers.push(timerId);
        } else {
          emit('wave-complete', spawnedCount);
        }
      }

      // Start spawning
      spawnNext(0);

      return {
        cancel: function() {
          cancelled = true;
          timerIds.forEach(function(id) {
            clearTimeout(id);
            var idx = waveTimers.indexOf(id);
            if (idx !== -1) {
              waveTimers.splice(idx, 1);
            }
          });
        }
      };
    }

    /**
     * Register event listener.
     * @param {string} event - Event name: 'spawned', 'despawned', 'wave-complete'
     * @param {Function} callback - Event handler
     */
    function on(event, callback) {
      if (listeners[event] && typeof callback === 'function') {
        listeners[event].push(callback);
      }
    }

    /**
     * Remove event listener.
     * @param {string} event - Event name
     * @param {Function} callback - Handler to remove
     */
    function off(event, callback) {
      if (listeners[event]) {
        var idx = listeners[event].indexOf(callback);
        if (idx !== -1) {
          listeners[event].splice(idx, 1);
        }
      }
    }

    /**
     * Get all currently spawned entities.
     * @returns {Array} Array of spawned entities
     */
    function getSpawned() {
      return Array.from(spawned);
    }

    /**
     * Get spawner statistics.
     * @returns {Object} { spawned, poolStats }
     */
    function stats() {
      return {
        spawned: spawned.size,
        poolStats: pool.stats()
      };
    }

    /**
     * Clear all entities and cancel waves.
     */
    function clear() {
      // Cancel all wave timers
      waveTimers.forEach(function(id) {
        clearTimeout(id);
      });
      waveTimers.length = 0;

      // Despawn all entities
      despawnAll();

      // Clear the pool
      pool.clear();

      console.log('[Spawner] Cleared');
    }

    return {
      spawn: spawn,
      despawn: despawn,
      despawnAll: despawnAll,
      spawnWave: spawnWave,
      on: on,
      off: off,
      getSpawned: getSpawned,
      stats: stats,
      clear: clear
    };
  }

  return {
    create: create
  };
})();
