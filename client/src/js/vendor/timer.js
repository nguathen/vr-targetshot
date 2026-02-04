/**
 * Timer - Countdown timer utility with pause/resume and GameState integration
 * Usage: <script src="/framework/utils/timer.js"></script>
 *
 * Basic usage:
 *   Timer.start(60000, function() { gameOver(); });  // 60 seconds
 *   Timer.onTick(function(remaining) { HUD.update('timer', formatTime(remaining)); });
 *   Timer.pause();
 *   Timer.resume();
 *   Timer.stop();
 *
 * Multiple timers:
 *   var combatTimer = Timer.create(30000, onCombatEnd);
 *   combatTimer.start();
 *   combatTimer.pause();
 *
 * GameState integration:
 *   Timer.setAutoIntegration(true);  // Auto-pause when GameState enters 'paused'
 */
window.Timer = (function() {
  'use strict';

  // Default timer instance
  var defaultTimer = null;

  /**
   * Create a new timer instance.
   * @param {number} duration - Duration in milliseconds
   * @param {Function} onComplete - Callback when timer finishes
   * @returns {Object} - Timer instance
   */
  function create(duration, onComplete) {
    var instance = {
      duration: duration || 0,
      remaining: duration || 0,
      onComplete: onComplete || null,
      tickCallback: null,
      tickInterval: 1000,
      running: false,
      paused: false,
      lastTick: 0,
      intervalId: null,
      autoIntegration: false,
      stateListener: null
    };

    /**
     * Start the timer.
     * @param {number} newDuration - Optional new duration
     * @param {Function} newCallback - Optional new completion callback
     * @returns {Object} - Timer instance for chaining
     */
    instance.start = function(newDuration, newCallback) {
      if (newDuration !== undefined) {
        instance.duration = newDuration;
        instance.remaining = newDuration;
      }
      if (newCallback !== undefined) {
        instance.onComplete = newCallback;
      }

      if (instance.duration <= 0) {
        console.warn('[Timer] Duration must be greater than 0');
        return instance;
      }

      instance.remaining = instance.duration;
      instance.running = true;
      instance.paused = false;
      instance.lastTick = Date.now();

      clearInterval(instance.intervalId);
      instance.intervalId = setInterval(function() {
        tick(instance);
      }, instance.tickInterval);

      if (instance.autoIntegration) {
        setupStateIntegration(instance);
      }

      console.log('[Timer] Started:', instance.duration + 'ms');
      return instance;
    };

    /**
     * Pause the timer.
     * @returns {Object} - Timer instance for chaining
     */
    instance.pause = function() {
      if (!instance.running || instance.paused) return instance;

      instance.paused = true;
      var elapsed = Date.now() - instance.lastTick;
      instance.remaining = Math.max(0, instance.remaining - elapsed);

      console.log('[Timer] Paused, remaining:', instance.remaining + 'ms');
      return instance;
    };

    /**
     * Resume the timer.
     * @returns {Object} - Timer instance for chaining
     */
    instance.resume = function() {
      if (!instance.running || !instance.paused) return instance;

      instance.paused = false;
      instance.lastTick = Date.now();

      console.log('[Timer] Resumed, remaining:', instance.remaining + 'ms');
      return instance;
    };

    /**
     * Stop and reset the timer.
     * @returns {Object} - Timer instance for chaining
     */
    instance.stop = function() {
      clearInterval(instance.intervalId);
      instance.intervalId = null;
      instance.running = false;
      instance.paused = false;
      instance.remaining = instance.duration;

      removeStateIntegration(instance);

      console.log('[Timer] Stopped');
      return instance;
    };

    /**
     * Get remaining time in milliseconds.
     * @returns {number} - Remaining time in ms
     */
    instance.getRemaining = function() {
      if (!instance.running) return instance.remaining;
      if (instance.paused) return instance.remaining;

      var elapsed = Date.now() - instance.lastTick;
      return Math.max(0, instance.remaining - elapsed);
    };

    /**
     * Register tick callback (called every tickInterval).
     * @param {Function} callback - Function receiving remaining ms
     * @param {number} interval - Optional tick interval (default 1000ms)
     * @returns {Object} - Timer instance for chaining
     */
    instance.onTick = function(callback, interval) {
      instance.tickCallback = callback;
      if (interval !== undefined) {
        instance.tickInterval = Math.max(16, interval);
      }
      return instance;
    };

    /**
     * Set auto-integration with GameState.
     * @param {boolean} enabled - Enable/disable auto-pause on GameState 'paused'
     * @returns {Object} - Timer instance for chaining
     */
    instance.setAutoIntegration = function(enabled) {
      instance.autoIntegration = !!enabled;

      if (enabled && instance.running) {
        setupStateIntegration(instance);
      } else if (!enabled) {
        removeStateIntegration(instance);
      }

      return instance;
    };

    /**
     * Check if timer is running.
     * @returns {boolean}
     */
    instance.isRunning = function() {
      return instance.running;
    };

    /**
     * Check if timer is paused.
     * @returns {boolean}
     */
    instance.isPaused = function() {
      return instance.paused;
    };

    /**
     * Get progress as percentage (0-1).
     * @returns {number}
     */
    instance.getProgress = function() {
      if (instance.duration <= 0) return 0;
      return 1 - (instance.getRemaining() / instance.duration);
    };

    /**
     * Destroy the timer and clean up.
     */
    instance.destroy = function() {
      instance.stop();
      instance.onComplete = null;
      instance.tickCallback = null;
    };

    return instance;
  }

  /**
   * Internal tick handler.
   * @param {Object} instance - Timer instance
   */
  function tick(instance) {
    if (!instance.running || instance.paused) return;

    var now = Date.now();
    var elapsed = now - instance.lastTick;
    instance.remaining = Math.max(0, instance.remaining - elapsed);
    instance.lastTick = now;

    // Call tick callback
    if (instance.tickCallback) {
      try {
        instance.tickCallback(instance.remaining);
      } catch (err) {
        console.error('[Timer] Tick callback error:', err);
      }
    }

    // Check completion
    if (instance.remaining <= 0) {
      complete(instance);
    }
  }

  /**
   * Internal completion handler.
   * @param {Object} instance - Timer instance
   */
  function complete(instance) {
    clearInterval(instance.intervalId);
    instance.intervalId = null;
    instance.running = false;
    instance.remaining = 0;

    removeStateIntegration(instance);

    console.log('[Timer] Completed');

    if (instance.onComplete) {
      try {
        instance.onComplete();
      } catch (err) {
        console.error('[Timer] Completion callback error:', err);
      }
    }
  }

  /**
   * Setup GameState integration for auto-pause.
   * @param {Object} instance - Timer instance
   */
  function setupStateIntegration(instance) {
    if (instance.stateListener) return;
    if (typeof window === 'undefined') return;

    instance.stateListener = function(e) {
      var state = e.detail.to;
      if (state === 'paused' && instance.running && !instance.paused) {
        instance.pause();
        console.log('[Timer] Auto-paused via GameState');
      } else if (e.detail.from === 'paused' && instance.running && instance.paused) {
        instance.resume();
        console.log('[Timer] Auto-resumed via GameState');
      }
    };

    window.addEventListener('state-change', instance.stateListener);
  }

  /**
   * Remove GameState integration.
   * @param {Object} instance - Timer instance
   */
  function removeStateIntegration(instance) {
    if (!instance.stateListener) return;
    if (typeof window === 'undefined') return;

    window.removeEventListener('state-change', instance.stateListener);
    instance.stateListener = null;
  }

  /**
   * Get or create the default timer instance.
   * @returns {Object} - Default timer instance
   */
  function getDefault() {
    if (!defaultTimer) {
      defaultTimer = create(0, null);
    }
    return defaultTimer;
  }

  // Public API - delegates to default timer for simple usage
  console.log('[Timer] Module loaded');

  return {
    // Factory method for multiple timers
    create: create,

    // Default timer methods
    start: function(duration, callback) {
      return getDefault().start(duration, callback);
    },
    pause: function() {
      return getDefault().pause();
    },
    resume: function() {
      return getDefault().resume();
    },
    stop: function() {
      return getDefault().stop();
    },
    getRemaining: function() {
      return getDefault().getRemaining();
    },
    onTick: function(callback, interval) {
      return getDefault().onTick(callback, interval);
    },
    setAutoIntegration: function(enabled) {
      return getDefault().setAutoIntegration(enabled);
    },
    isRunning: function() {
      return getDefault().isRunning();
    },
    isPaused: function() {
      return getDefault().isPaused();
    },
    getProgress: function() {
      return getDefault().getProgress();
    },
    destroy: function() {
      if (defaultTimer) {
        defaultTimer.destroy();
        defaultTimer = null;
      }
    }
  };
})();
