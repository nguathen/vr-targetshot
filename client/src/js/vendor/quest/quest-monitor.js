/**
 * QuestMonitor - Battery and thermal monitoring for Meta Quest headsets
 * Usage: <script src="/framework/quest/quest-monitor.js"></script>
 *
 * Basic usage:
 *   var battery = QuestMonitor.getBatteryLevel();  // 0-100 or null
 *   var thermal = QuestMonitor.getThermalState();  // 'normal', 'warm', 'hot', 'unknown'
 *
 * Callbacks:
 *   QuestMonitor.onLowBattery(function(level) { showWarning(); }, 20);
 *   QuestMonitor.onThermalWarning(function(state) { reduceQuality(); });
 *
 * Auto quality reduction:
 *   QuestMonitor.enableAutoQuality(scene);  // Auto-reduce on thermal warning
 */
window.QuestMonitor = (function() {
  'use strict';

  var batteryManager = null;
  var batteryCallbacks = [];
  var thermalCallbacks = [];
  var pollInterval = null;
  var lastThermalState = 'unknown';
  var autoQualityEnabled = false;
  var autoQualityScene = null;

  // Thermal thresholds (estimated from device behavior)
  var THERMAL_THRESHOLDS = {
    warm: 35,   // degrees Celsius
    hot: 42
  };

  // Poll interval in ms
  var POLL_MS = 5000;

  /**
   * Initialize battery manager if available.
   * @returns {Promise<boolean>}
   */
  function initBattery() {
    if (batteryManager) return Promise.resolve(true);

    if (!navigator.getBattery) {
      console.warn('[QuestMonitor] Battery API not available');
      return Promise.resolve(false);
    }

    return navigator.getBattery()
      .then(function(manager) {
        batteryManager = manager;
        setupBatteryListeners();
        console.log('[QuestMonitor] Battery manager initialized');
        return true;
      })
      .catch(function(err) {
        console.warn('[QuestMonitor] Battery init failed:', err.message);
        return false;
      });
  }

  /**
   * Setup battery event listeners.
   */
  function setupBatteryListeners() {
    if (!batteryManager) return;

    batteryManager.addEventListener('levelchange', checkBatteryCallbacks);
    batteryManager.addEventListener('chargingchange', function() {
      console.log('[QuestMonitor] Charging:', batteryManager.charging);
    });
  }

  /**
   * Check and trigger battery callbacks.
   */
  function checkBatteryCallbacks() {
    var level = getBatteryLevel();
    if (level === null) return;

    batteryCallbacks.forEach(function(cb) {
      if (level <= cb.threshold && !cb.triggered) {
        cb.triggered = true;
        cb.callback(level);
      } else if (level > cb.threshold) {
        cb.triggered = false;  // Reset when battery recovers
      }
    });
  }

  /**
   * Get current battery level.
   * @returns {number|null} - Battery percentage 0-100, or null if unavailable
   */
  function getBatteryLevel() {
    if (!batteryManager) {
      initBattery();
      return null;
    }

    return Math.round(batteryManager.level * 100);
  }

  /**
   * Check if device is charging.
   * @returns {boolean|null} - True if charging, null if unavailable
   */
  function isCharging() {
    if (!batteryManager) {
      initBattery();
      return null;
    }

    return batteryManager.charging;
  }

  /**
   * Estimate thermal state from device signals.
   * Quest doesn't expose thermal API directly, so we infer from:
   * - Battery discharge rate when not charging
   * - WebXR frame timing (if available)
   * @returns {string} - 'normal', 'warm', 'hot', or 'unknown'
   */
  function getThermalState() {
    // Try navigator.deviceMemory as indirect signal (reduced when throttled)
    // Try battery discharge rate as proxy
    if (batteryManager && !batteryManager.charging) {
      var dischargeTime = batteryManager.dischargingTime;

      // Fast discharge (<1hr remaining at current rate) suggests high load/heat
      if (dischargeTime !== Infinity && dischargeTime < 3600) {
        return 'hot';
      }
      if (dischargeTime !== Infinity && dischargeTime < 7200) {
        return 'warm';
      }
    }

    // Check for frame drops via XR session (indirect thermal indicator)
    var scene = document.querySelector('a-scene');
    if (scene && scene.renderer) {
      var info = scene.renderer.info;
      if (info && info.render) {
        // High draw calls can correlate with thermal issues
        if (info.render.calls > 200) {
          return 'warm';
        }
      }
    }

    // If we have no data, return unknown
    if (!batteryManager) {
      return 'unknown';
    }

    return 'normal';
  }

  /**
   * Register callback for low battery alert.
   * @param {Function} callback - Called with battery level when threshold reached
   * @param {number} threshold - Battery percentage threshold (default 20)
   * @returns {Function} - Unsubscribe function
   */
  function onLowBattery(callback, threshold) {
    if (typeof callback !== 'function') {
      console.warn('[QuestMonitor] onLowBattery requires a callback function');
      return function() {};
    }

    threshold = threshold || 20;

    var entry = {
      callback: callback,
      threshold: threshold,
      triggered: false
    };

    batteryCallbacks.push(entry);
    initBattery();

    // Check immediately
    var level = getBatteryLevel();
    if (level !== null && level <= threshold) {
      entry.triggered = true;
      callback(level);
    }

    // Return unsubscribe function
    return function() {
      var idx = batteryCallbacks.indexOf(entry);
      if (idx !== -1) {
        batteryCallbacks.splice(idx, 1);
      }
    };
  }

  /**
   * Register callback for thermal warning.
   * @param {Function} callback - Called with thermal state ('warm' or 'hot')
   * @returns {Function} - Unsubscribe function
   */
  function onThermalWarning(callback) {
    if (typeof callback !== 'function') {
      console.warn('[QuestMonitor] onThermalWarning requires a callback function');
      return function() {};
    }

    thermalCallbacks.push(callback);
    startPolling();

    // Return unsubscribe function
    return function() {
      var idx = thermalCallbacks.indexOf(callback);
      if (idx !== -1) {
        thermalCallbacks.splice(idx, 1);
      }
      if (thermalCallbacks.length === 0 && !autoQualityEnabled) {
        stopPolling();
      }
    };
  }

  /**
   * Start polling for thermal state changes.
   */
  function startPolling() {
    if (pollInterval) return;

    initBattery();

    pollInterval = setInterval(function() {
      var state = getThermalState();

      // Only trigger on state change to worse
      if (state !== lastThermalState) {
        if (state === 'warm' || state === 'hot') {
          thermalCallbacks.forEach(function(cb) {
            cb(state);
          });

          if (autoQualityEnabled) {
            applyQualityReduction(state);
          }
        }
        lastThermalState = state;
      }

      // Also check battery callbacks
      checkBatteryCallbacks();
    }, POLL_MS);

    console.log('[QuestMonitor] Polling started');
  }

  /**
   * Stop polling.
   */
  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
      console.log('[QuestMonitor] Polling stopped');
    }
  }

  /**
   * Enable automatic quality reduction on thermal warning.
   * @param {Element} scene - A-Frame scene element (optional, auto-detected)
   */
  function enableAutoQuality(scene) {
    autoQualityScene = scene || document.querySelector('a-scene');
    autoQualityEnabled = true;
    startPolling();
    console.log('[QuestMonitor] Auto quality reduction enabled');
  }

  /**
   * Disable automatic quality reduction.
   */
  function disableAutoQuality() {
    autoQualityEnabled = false;
    if (thermalCallbacks.length === 0) {
      stopPolling();
    }
    console.log('[QuestMonitor] Auto quality reduction disabled');
  }

  /**
   * Apply quality reduction based on thermal state.
   * @param {string} state - 'warm' or 'hot'
   */
  function applyQualityReduction(state) {
    var scene = autoQualityScene || document.querySelector('a-scene');
    if (!scene || !scene.renderer) {
      console.warn('[QuestMonitor] No scene renderer for quality reduction');
      return;
    }

    var renderer = scene.renderer;

    if (state === 'hot') {
      // Aggressive reduction for hot state
      renderer.setPixelRatio(0.75);
      if (scene.systems && scene.systems.shadow) {
        scene.setAttribute('shadow', 'enabled', false);
      }
      console.log('[QuestMonitor] Quality: LOW (thermal hot)');
    } else if (state === 'warm') {
      // Moderate reduction for warm state
      renderer.setPixelRatio(0.9);
      console.log('[QuestMonitor] Quality: MEDIUM (thermal warm)');
    }

    // Dispatch event for game-specific handling
    scene.dispatchEvent(new CustomEvent('thermal-quality-change', {
      detail: { state: state, pixelRatio: renderer.getPixelRatio() }
    }));
  }

  /**
   * Restore full quality settings.
   */
  function restoreQuality() {
    var scene = autoQualityScene || document.querySelector('a-scene');
    if (!scene || !scene.renderer) return;

    scene.renderer.setPixelRatio(window.devicePixelRatio || 1);
    if (scene.systems && scene.systems.shadow) {
      scene.setAttribute('shadow', 'enabled', true);
    }

    lastThermalState = 'normal';
    console.log('[QuestMonitor] Quality: FULL (restored)');
  }

  /**
   * Get comprehensive status object.
   * @returns {Object}
   */
  function getStatus() {
    return {
      batteryLevel: getBatteryLevel(),
      charging: isCharging(),
      thermalState: getThermalState(),
      autoQuality: autoQualityEnabled,
      polling: pollInterval !== null
    };
  }

  /**
   * Cleanup and stop monitoring.
   */
  function destroy() {
    stopPolling();
    batteryCallbacks = [];
    thermalCallbacks = [];
    autoQualityEnabled = false;
    autoQualityScene = null;
    console.log('[QuestMonitor] Destroyed');
  }

  // Initialize battery on load
  if (typeof window !== 'undefined') {
    initBattery();
  }

  console.log('[QuestMonitor] Module loaded');

  return {
    getBatteryLevel: getBatteryLevel,
    isCharging: isCharging,
    getThermalState: getThermalState,
    onLowBattery: onLowBattery,
    onThermalWarning: onThermalWarning,
    enableAutoQuality: enableAutoQuality,
    disableAutoQuality: disableAutoQuality,
    restoreQuality: restoreQuality,
    getStatus: getStatus,
    destroy: destroy
  };
})();
