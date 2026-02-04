/**
 * WaveManager - Wave/level progression manager
 * Usage: <script src="/framework/gameplay/wave-manager.js"></script>
 * Requires: spawner.js (optional, for auto-spawning)
 *
 * Basic usage:
 *   WaveManager.init({
 *     waves: [
 *       { enemies: 5, spawnDelay: 1000 },
 *       { enemies: 8, spawnDelay: 800 },
 *       { enemies: 12, spawnDelay: 600 }
 *     ],
 *     spawner: enemySpawner,
 *     spawnPositions: [{ x: -3, y: 1, z: -8 }, { x: 3, y: 1, z: -8 }]
 *   });
 *
 *   WaveManager.startWave(1);
 *   WaveManager.onEnemyDefeated(entity);
 *
 * Events:
 *   window.addEventListener('wave-start', function(e) {
 *     console.log('Wave', e.detail.wave, 'started');
 *   });
 *   window.addEventListener('wave-complete', function(e) {
 *     console.log('Wave', e.detail.wave, 'complete');
 *   });
 *   window.addEventListener('all-waves-complete', function(e) {
 *     console.log('Victory! Total kills:', e.detail.totalKills);
 *   });
 */
window.WaveManager = (function() {
  'use strict';

  var config = null;
  var currentWave = 0;
  var enemiesRemaining = 0;
  var enemiesSpawned = 0;
  var totalKills = 0;
  var activeEnemies = new Set();
  var waveInProgress = false;
  var spawnController = null;
  var callbacks = {
    'wave-start': [],
    'wave-complete': [],
    'all-waves-complete': [],
    'enemy-spawned': [],
    'enemy-defeated': []
  };

  /**
   * Initialize wave manager with configuration.
   * @param {Object} opts - Configuration object
   * @param {Array} opts.waves - Array of wave configs { enemies, spawnDelay, data }
   * @param {Object} opts.spawner - Spawner instance for auto-spawning (optional)
   * @param {Array|Function} opts.spawnPositions - Positions or function(index) for spawning
   * @param {boolean} opts.autoProgress - Auto-start next wave (default: true)
   * @param {number} opts.progressDelay - Delay before next wave in ms (default: 2000)
   * @returns {boolean} True if initialized successfully
   */
  function init(opts) {
    if (!opts || !opts.waves || !Array.isArray(opts.waves)) {
      console.error('[WaveManager] waves array required');
      return false;
    }

    if (opts.waves.length === 0) {
      console.error('[WaveManager] waves array cannot be empty');
      return false;
    }

    config = {
      waves: opts.waves,
      spawner: opts.spawner || null,
      spawnPositions: opts.spawnPositions || [{ x: 0, y: 1, z: -5 }],
      autoProgress: opts.autoProgress !== false,
      progressDelay: opts.progressDelay || 2000
    };

    currentWave = 0;
    enemiesRemaining = 0;
    enemiesSpawned = 0;
    totalKills = 0;
    activeEnemies.clear();
    waveInProgress = false;

    console.log('[WaveManager] Initialized with', config.waves.length, 'waves');
    return true;
  }

  /**
   * Start a specific wave.
   * @param {number} waveNumber - Wave number (1-indexed)
   * @returns {boolean} True if wave started successfully
   */
  function startWave(waveNumber) {
    if (!config) {
      console.error('[WaveManager] Not initialized. Call init() first');
      return false;
    }

    if (waveInProgress) {
      console.warn('[WaveManager] Wave already in progress');
      return false;
    }

    if (waveNumber < 1 || waveNumber > config.waves.length) {
      console.error('[WaveManager] Invalid wave number:', waveNumber);
      return false;
    }

    currentWave = waveNumber;
    var waveConfig = config.waves[waveNumber - 1];
    enemiesRemaining = waveConfig.enemies;
    enemiesSpawned = 0;
    waveInProgress = true;

    console.log('[WaveManager] Starting wave', waveNumber, '- Enemies:', waveConfig.enemies);

    emitEvent('wave-start', {
      wave: waveNumber,
      enemies: waveConfig.enemies,
      totalWaves: config.waves.length
    });

    triggerCallbacks('wave-start', {
      wave: waveNumber,
      enemies: waveConfig.enemies
    });

    if (config.spawner) {
      spawnWaveEnemies(waveConfig);
    }

    return true;
  }

  /**
   * Spawn enemies for current wave using configured spawner.
   * @param {Object} waveConfig - Wave configuration
   */
  function spawnWaveEnemies(waveConfig) {
    var delay = waveConfig.spawnDelay || 500;
    var spawnData = waveConfig.data || {};

    spawnController = config.spawner.spawnWave(
      waveConfig.enemies,
      delay,
      config.spawnPositions,
      { data: spawnData }
    );

    config.spawner.on('spawned', onEnemySpawned);
  }

  /**
   * Handle enemy spawned event from spawner.
   * @param {Element} entity - Spawned entity
   */
  function onEnemySpawned(entity) {
    activeEnemies.add(entity);
    enemiesSpawned++;

    triggerCallbacks('enemy-spawned', {
      entity: entity,
      wave: currentWave,
      spawned: enemiesSpawned,
      total: config.waves[currentWave - 1].enemies
    });
  }

  /**
   * Report an enemy as defeated.
   * @param {Element} entity - Defeated enemy entity
   * @returns {boolean} True if enemy was tracked
   */
  function onEnemyDefeated(entity) {
    if (!waveInProgress) {
      console.warn('[WaveManager] No wave in progress');
      return false;
    }

    if (entity && activeEnemies.has(entity)) {
      activeEnemies.delete(entity);

      if (config.spawner) {
        config.spawner.despawn(entity);
      }
    }

    enemiesRemaining--;
    totalKills++;

    triggerCallbacks('enemy-defeated', {
      entity: entity,
      remaining: enemiesRemaining,
      totalKills: totalKills
    });

    console.log('[WaveManager] Enemy defeated. Remaining:', enemiesRemaining);

    if (enemiesRemaining <= 0) {
      completeWave();
    }

    return true;
  }

  /**
   * Complete the current wave.
   */
  function completeWave() {
    waveInProgress = false;

    if (spawnController) {
      spawnController.cancel();
      spawnController = null;
    }

    if (config.spawner) {
      config.spawner.off('spawned', onEnemySpawned);
    }

    console.log('[WaveManager] Wave', currentWave, 'complete!');

    emitEvent('wave-complete', {
      wave: currentWave,
      totalKills: totalKills,
      totalWaves: config.waves.length
    });

    triggerCallbacks('wave-complete', {
      wave: currentWave,
      totalKills: totalKills
    });

    if (currentWave >= config.waves.length) {
      completeAllWaves();
    } else if (config.autoProgress) {
      setTimeout(function() {
        startWave(currentWave + 1);
      }, config.progressDelay);
    }
  }

  /**
   * Handle completion of all waves.
   */
  function completeAllWaves() {
    console.log('[WaveManager] All waves complete! Total kills:', totalKills);

    emitEvent('all-waves-complete', {
      totalWaves: config.waves.length,
      totalKills: totalKills
    });

    triggerCallbacks('all-waves-complete', {
      totalWaves: config.waves.length,
      totalKills: totalKills
    });
  }

  /**
   * Check if current wave is complete.
   * @returns {boolean} True if wave is complete
   */
  function isWaveComplete() {
    return !waveInProgress && currentWave > 0;
  }

  /**
   * Get current wave number.
   * @returns {number} Current wave (0 if not started)
   */
  function getCurrentWave() {
    return currentWave;
  }

  /**
   * Get enemies remaining in current wave.
   * @returns {number} Enemies remaining
   */
  function getEnemiesRemaining() {
    return enemiesRemaining;
  }

  /**
   * Get total kills across all waves.
   * @returns {number} Total kills
   */
  function getTotalKills() {
    return totalKills;
  }

  /**
   * Get wave manager statistics.
   * @returns {Object} Stats object
   */
  function stats() {
    return {
      currentWave: currentWave,
      totalWaves: config ? config.waves.length : 0,
      enemiesRemaining: enemiesRemaining,
      enemiesSpawned: enemiesSpawned,
      totalKills: totalKills,
      activeEnemies: activeEnemies.size,
      waveInProgress: waveInProgress
    };
  }

  /**
   * Skip to next wave (for testing/debugging).
   * @returns {boolean} True if skipped successfully
   */
  function skipWave() {
    if (!config) return false;

    if (waveInProgress) {
      activeEnemies.forEach(function(entity) {
        if (config.spawner) {
          config.spawner.despawn(entity);
        }
      });
      activeEnemies.clear();
      enemiesRemaining = 0;
      completeWave();
    }

    return true;
  }

  /**
   * Reset wave manager to initial state.
   */
  function reset() {
    if (spawnController) {
      spawnController.cancel();
      spawnController = null;
    }

    if (config && config.spawner) {
      config.spawner.off('spawned', onEnemySpawned);
      config.spawner.despawnAll();
    }

    currentWave = 0;
    enemiesRemaining = 0;
    enemiesSpawned = 0;
    totalKills = 0;
    activeEnemies.clear();
    waveInProgress = false;

    console.log('[WaveManager] Reset');
  }

  /**
   * Register callback for wave events.
   * @param {string} event - Event name
   * @param {Function} callback - Handler function
   */
  function on(event, callback) {
    if (callbacks[event] && typeof callback === 'function') {
      callbacks[event].push(callback);
    }
  }

  /**
   * Remove callback for wave events.
   * @param {string} event - Event name
   * @param {Function} callback - Handler to remove
   */
  function off(event, callback) {
    if (callbacks[event]) {
      var idx = callbacks[event].indexOf(callback);
      if (idx !== -1) {
        callbacks[event].splice(idx, 1);
      }
    }
  }

  /**
   * Emit DOM custom event.
   * @param {string} name - Event name
   * @param {Object} detail - Event detail data
   */
  function emitEvent(name, detail) {
    if (typeof window === 'undefined') return;

    var event = new CustomEvent(name, { detail: detail });
    window.dispatchEvent(event);
  }

  /**
   * Trigger registered callbacks.
   * @param {string} event - Event name
   * @param {Object} data - Data to pass to callbacks
   */
  function triggerCallbacks(event, data) {
    var handlers = callbacks[event];
    if (!handlers) return;

    handlers.forEach(function(cb) {
      try {
        cb(data);
      } catch (err) {
        console.error('[WaveManager] Callback error:', err);
      }
    });
  }

  console.log('[WaveManager] Module loaded');

  return {
    init: init,
    startWave: startWave,
    onEnemyDefeated: onEnemyDefeated,
    isWaveComplete: isWaveComplete,
    getCurrentWave: getCurrentWave,
    getEnemiesRemaining: getEnemiesRemaining,
    getTotalKills: getTotalKills,
    stats: stats,
    skipWave: skipWave,
    reset: reset,
    on: on,
    off: off
  };
})();
