/**
 * Object Pool - Reusable object management to prevent GC spikes
 * Usage: <script src="/framework/utils/object-pool.js"></script>
 *
 * @example
 * // Generic objects:
 * var pool = ObjectPool.create(function() { return { x: 0, y: 0 }; }, 10);
 * var obj = pool.get();
 * pool.release(obj);
 *
 * @example
 * // A-Frame entities:
 * var pool = ObjectPool.create(function() {
 *   var el = document.createElement('a-entity');
 *   el.setAttribute('geometry', 'primitive: sphere');
 *   return el;
 * }, 20);
 * var entity = pool.get();  // Automatically made visible
 * pool.release(entity);     // Hidden and reset
 */

/**
 * Factory function that creates new pool objects.
 * @callback PoolFactory
 * @returns {*} A new object instance
 */

/**
 * Callback invoked when an object is retrieved from the pool.
 * @callback OnGetCallback
 * @param {*} obj - The object being retrieved
 * @returns {void}
 */

/**
 * Callback invoked when an object is returned to the pool.
 * @callback OnReleaseCallback
 * @param {*} obj - The object being returned
 * @returns {void}
 */

/**
 * @typedef {Object} PoolOptions
 * @property {OnGetCallback} [onGet] - Callback when object is retrieved
 * @property {OnReleaseCallback} [onRelease] - Callback when object is returned
 * @property {number} [maxSize=Infinity] - Maximum pool size
 */

/**
 * @typedef {Object} PoolStats
 * @property {number} available - Objects ready to use
 * @property {number} inUse - Objects currently in use
 * @property {number} total - Total objects in pool
 */

/**
 * @typedef {Object} PoolInstance
 * @property {function(): *} get - Get an object from the pool
 * @property {function(*): boolean} release - Return an object to the pool
 * @property {function(): void} releaseAll - Release all objects in use
 * @property {function(): void} clear - Dispose all objects
 * @property {function(): PoolStats} stats - Get pool statistics
 * @property {function(number): void} prewarm - Pre-allocate more objects
 */

window.ObjectPool = (function() {
  'use strict';

  /** @type {{x: number, y: number, z: number}} */
  var RESET_POSITION = { x: 0, y: -1000, z: 0 };

  /**
   * Create a new object pool.
   * @param {PoolFactory} factory - Function that creates new objects
   * @param {number} [initialSize=0] - Number of objects to pre-allocate
   * @param {PoolOptions} [opts] - Pool configuration options
   * @returns {PoolInstance} Pool instance with get/release methods
   * @throws {Error} If factory is not a function
   */
  function create(factory, initialSize, opts) {
    if (typeof factory !== 'function') {
      throw new Error('[ObjectPool] Factory must be a function');
    }

    opts = opts || {};
    initialSize = initialSize || 0;

    var available = [];
    var inUse = new Set();
    var maxSize = opts.maxSize || Infinity;
    var onGet = opts.onGet || null;
    var onRelease = opts.onRelease || null;

    // Pre-allocate initial objects
    for (var i = 0; i < initialSize; i++) {
      var obj = factory();
      prepareForPool(obj);
      available.push(obj);
    }

    console.log('[ObjectPool] Created with ' + initialSize + ' objects');

    /**
     * Get an object from the pool.
     * @returns {*|null} Object from pool or newly created, null if max size reached
     */
    function get() {
      var obj;

      if (available.length > 0) {
        obj = available.pop();
      } else if (inUse.size < maxSize) {
        obj = factory();
        console.log('[ObjectPool] Expanded pool, total: ' + (inUse.size + available.length + 1));
      } else {
        console.warn('[ObjectPool] Max size reached: ' + maxSize);
        return null;
      }

      inUse.add(obj);
      activateObject(obj);

      if (onGet) {
        onGet(obj);
      }

      return obj;
    }

    /**
     * Return an object to the pool.
     * @param {*} obj - Object to release
     * @returns {boolean} True if released successfully
     */
    function release(obj) {
      if (!inUse.has(obj)) {
        console.warn('[ObjectPool] Object not from this pool');
        return false;
      }

      inUse.delete(obj);

      if (onRelease) {
        onRelease(obj);
      }

      deactivateObject(obj);
      available.push(obj);

      return true;
    }

    /**
     * Release all objects currently in use.
     * @returns {void}
     */
    function releaseAll() {
      inUse.forEach(function(obj) {
        if (onRelease) {
          onRelease(obj);
        }
        deactivateObject(obj);
        available.push(obj);
      });
      inUse.clear();
    }

    /**
     * Clear all objects and dispose resources.
     * @returns {void}
     */
    function clear() {
      // Dispose in-use objects
      inUse.forEach(function(obj) {
        disposeObject(obj);
      });
      inUse.clear();

      // Dispose available objects
      available.forEach(function(obj) {
        disposeObject(obj);
      });
      available.length = 0;

      console.log('[ObjectPool] Cleared');
    }

    /**
     * Get pool statistics.
     * @returns {PoolStats} Pool statistics object
     */
    function stats() {
      return {
        available: available.length,
        inUse: inUse.size,
        total: available.length + inUse.size
      };
    }

    /**
     * Prewarm pool by creating more objects.
     * @param {number} count - Number of objects to add
     * @returns {void}
     */
    function prewarm(count) {
      var toCreate = Math.min(count, maxSize - available.length - inUse.size);
      for (var i = 0; i < toCreate; i++) {
        var obj = factory();
        prepareForPool(obj);
        available.push(obj);
      }
      console.log('[ObjectPool] Prewarmed +' + toCreate + ', total: ' + (available.length + inUse.size));
    }

    return {
      get: get,
      release: release,
      releaseAll: releaseAll,
      clear: clear,
      stats: stats,
      prewarm: prewarm
    };
  }

  /**
   * Prepare object for pool storage (initial setup).
   * @param {*} obj - Object to prepare
   * @returns {void}
   */
  function prepareForPool(obj) {
    if (isAFrameEntity(obj)) {
      obj.setAttribute('visible', false);
      obj.object3D.position.set(RESET_POSITION.x, RESET_POSITION.y, RESET_POSITION.z);
    }
  }

  /**
   * Activate object when retrieved from pool.
   * @param {*} obj - Object to activate
   * @returns {void}
   */
  function activateObject(obj) {
    if (isAFrameEntity(obj)) {
      obj.setAttribute('visible', true);
    }
  }

  /**
   * Deactivate object when returned to pool.
   * @param {*} obj - Object to deactivate
   * @returns {void}
   */
  function deactivateObject(obj) {
    if (isAFrameEntity(obj)) {
      obj.setAttribute('visible', false);
      obj.object3D.position.set(RESET_POSITION.x, RESET_POSITION.y, RESET_POSITION.z);
      obj.object3D.rotation.set(0, 0, 0);
      obj.object3D.scale.set(1, 1, 1);
    }
  }

  /**
   * Dispose object and clean up resources.
   * @param {*} obj - Object to dispose
   * @returns {void}
   */
  function disposeObject(obj) {
    if (isAFrameEntity(obj)) {
      if (obj.parentNode) {
        obj.parentNode.removeChild(obj);
      }
    }
    // For Three.js objects with dispose method
    if (obj && typeof obj.dispose === 'function') {
      obj.dispose();
    }
  }

  /**
   * Check if object is an A-Frame entity.
   * @param {*} obj - Object to check
   * @returns {boolean} True if object is an A-Frame entity
   */
  function isAFrameEntity(obj) {
    return obj && obj.object3D && typeof obj.setAttribute === 'function';
  }

  return {
    create: create
  };
})();
