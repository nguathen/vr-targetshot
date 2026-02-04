/**
 * ScoreManager - Centralized score system with combo multipliers and leaderboard
 * Usage: <script src="/framework/gameplay/score-manager.js"></script>
 * Requires: save-load.js (for leaderboard persistence)
 *
 * Basic usage:
 *   ScoreManager.add(100);             // +100 points
 *   ScoreManager.add(100, 2);          // +200 points (with multiplier)
 *   ScoreManager.combo(3);             // Apply 3-hit combo multiplier
 *   ScoreManager.get();                // Current total
 *   ScoreManager.reset();              // Reset for new game
 *
 * Leaderboard:
 *   ScoreManager.saveScore('Player1'); // Save current score
 *   ScoreManager.getLeaderboard(10);   // Get top 10 scores
 *
 * Events:
 *   window.addEventListener('score-changed', function(e) {
 *     console.log('Score:', e.detail.score, 'Added:', e.detail.added);
 *   });
 *   window.addEventListener('combo-changed', function(e) {
 *     console.log('Combo:', e.detail.combo, 'Multiplier:', e.detail.multiplier);
 *   });
 */
window.ScoreManager = (function() {
  'use strict';

  var LEADERBOARD_KEY = 'leaderboard';
  var MAX_LEADERBOARD_SIZE = 100;

  var score = 0;
  var comboCount = 0;
  var comboMultiplier = 1;
  var comboTimeout = null;
  var comboDecayMs = 2000;

  var callbacks = {
    'score-changed': [],
    'combo-changed': [],
    'leaderboard-updated': []
  };

  var devMode = (function() {
    if (typeof window === 'undefined') return false;
    var host = window.location.hostname;
    return host === 'localhost' ||
           host === '127.0.0.1' ||
           host.startsWith('192.168.') ||
           window.SCOREMANAGER_DEV_MODE === true;
  })();

  /**
   * Calculate combo multiplier from hit count.
   * @param {number} hits - Number of consecutive hits
   * @returns {number} - Multiplier value
   */
  function calculateComboMultiplier(hits) {
    if (hits < 2) return 1;
    if (hits < 5) return 1.5;
    if (hits < 10) return 2;
    if (hits < 20) return 2.5;
    if (hits < 50) return 3;
    return 4;
  }

  /**
   * Add points to the score.
   * @param {number} points - Base points to add
   * @param {number} multiplier - Optional additional multiplier (default: 1)
   * @returns {number} - Actual points added (after multipliers)
   */
  function add(points, multiplier) {
    if (typeof points !== 'number' || isNaN(points) || points < 0) {
      if (devMode) console.warn('[ScoreManager] Invalid points value:', points);
      return 0;
    }

    var mult = typeof multiplier === 'number' && multiplier > 0 ? multiplier : 1;
    var totalMultiplier = mult * comboMultiplier;
    var added = Math.floor(points * totalMultiplier);

    score += added;

    if (devMode) {
      console.log('[ScoreManager] +' + added + ' (base: ' + points +
                  ', mult: ' + totalMultiplier.toFixed(1) + ') Total: ' + score);
    }

    emitEvent('score-changed', {
      score: score,
      added: added,
      basePoints: points,
      multiplier: totalMultiplier
    });

    triggerCallbacks('score-changed', {
      score: score,
      added: added,
      basePoints: points,
      multiplier: totalMultiplier
    });

    return added;
  }

  /**
   * Apply combo from consecutive hits. Resets after decay timeout.
   * @param {number} hitCount - Number of consecutive hits (or increment by 1 if not provided)
   * @returns {number} - Current combo multiplier
   */
  function combo(hitCount) {
    if (comboTimeout) {
      clearTimeout(comboTimeout);
    }

    if (typeof hitCount === 'number' && hitCount >= 0) {
      comboCount = hitCount;
    } else {
      comboCount++;
    }

    comboMultiplier = calculateComboMultiplier(comboCount);

    if (devMode) {
      console.log('[ScoreManager] Combo: ' + comboCount + 'x (multiplier: ' + comboMultiplier + ')');
    }

    emitEvent('combo-changed', {
      combo: comboCount,
      multiplier: comboMultiplier
    });

    triggerCallbacks('combo-changed', {
      combo: comboCount,
      multiplier: comboMultiplier
    });

    comboTimeout = setTimeout(function() {
      resetCombo();
    }, comboDecayMs);

    return comboMultiplier;
  }

  /**
   * Reset combo count and multiplier.
   */
  function resetCombo() {
    if (comboTimeout) {
      clearTimeout(comboTimeout);
      comboTimeout = null;
    }

    var hadCombo = comboCount > 0;
    comboCount = 0;
    comboMultiplier = 1;

    if (hadCombo) {
      if (devMode) console.log('[ScoreManager] Combo reset');

      emitEvent('combo-changed', {
        combo: 0,
        multiplier: 1
      });

      triggerCallbacks('combo-changed', {
        combo: 0,
        multiplier: 1
      });
    }
  }

  /**
   * Get current score.
   * @returns {number}
   */
  function get() {
    return score;
  }

  /**
   * Get current combo count.
   * @returns {number}
   */
  function getCombo() {
    return comboCount;
  }

  /**
   * Get current combo multiplier.
   * @returns {number}
   */
  function getMultiplier() {
    return comboMultiplier;
  }

  /**
   * Reset score and combo for new game.
   */
  function reset() {
    score = 0;
    resetCombo();

    if (devMode) console.log('[ScoreManager] Reset');

    emitEvent('score-changed', {
      score: 0,
      added: 0,
      basePoints: 0,
      multiplier: 1
    });

    triggerCallbacks('score-changed', {
      score: 0,
      added: 0,
      basePoints: 0,
      multiplier: 1
    });
  }

  /**
   * Set combo decay time (how long before combo resets).
   * @param {number} ms - Milliseconds before combo decays
   */
  function setComboDecay(ms) {
    if (typeof ms === 'number' && ms > 0) {
      comboDecayMs = ms;
      if (devMode) console.log('[ScoreManager] Combo decay set to ' + ms + 'ms');
    }
  }

  /**
   * Save current score to leaderboard.
   * @param {string} name - Player name
   * @returns {Object|null} - Saved entry { name, score, rank, date } or null on failure
   */
  function saveScore(name) {
    if (!name || typeof name !== 'string') {
      if (devMode) console.warn('[ScoreManager] Name required for leaderboard');
      return null;
    }

    if (typeof SaveLoad === 'undefined') {
      if (devMode) console.warn('[ScoreManager] SaveLoad module required for leaderboard');
      return null;
    }

    var trimmedName = name.trim().substring(0, 20);
    if (trimmedName.length === 0) {
      if (devMode) console.warn('[ScoreManager] Name cannot be empty');
      return null;
    }

    var leaderboard = loadLeaderboard();

    var entry = {
      name: trimmedName,
      score: score,
      date: Date.now()
    };

    leaderboard.push(entry);

    leaderboard.sort(function(a, b) {
      return b.score - a.score;
    });

    if (leaderboard.length > MAX_LEADERBOARD_SIZE) {
      leaderboard = leaderboard.slice(0, MAX_LEADERBOARD_SIZE);
    }

    SaveLoad.save(LEADERBOARD_KEY, leaderboard);

    var rank = leaderboard.findIndex(function(e) {
      return e.date === entry.date && e.name === entry.name && e.score === entry.score;
    }) + 1;

    if (devMode) {
      console.log('[ScoreManager] Saved score: ' + score + ' for "' + trimmedName + '" (Rank #' + rank + ')');
    }

    var result = {
      name: trimmedName,
      score: score,
      rank: rank,
      date: entry.date
    };

    emitEvent('leaderboard-updated', {
      entry: result,
      leaderboard: leaderboard.slice(0, 10)
    });

    triggerCallbacks('leaderboard-updated', {
      entry: result,
      leaderboard: leaderboard.slice(0, 10)
    });

    return result;
  }

  /**
   * Load leaderboard from storage.
   * @returns {Array}
   */
  function loadLeaderboard() {
    if (typeof SaveLoad === 'undefined') {
      return [];
    }

    var saved = SaveLoad.load(LEADERBOARD_KEY);
    if (saved && Array.isArray(saved.data)) {
      return saved.data;
    }
    return [];
  }

  /**
   * Get top scores from leaderboard.
   * @param {number} limit - Number of entries to return (default: 10)
   * @returns {Array} - Array of { name, score, date, rank }
   */
  function getLeaderboard(limit) {
    var count = typeof limit === 'number' && limit > 0 ? limit : 10;
    var leaderboard = loadLeaderboard();

    return leaderboard.slice(0, count).map(function(entry, index) {
      return {
        rank: index + 1,
        name: entry.name,
        score: entry.score,
        date: entry.date
      };
    });
  }

  /**
   * Check if current score qualifies for leaderboard.
   * @returns {boolean}
   */
  function isHighScore() {
    var leaderboard = loadLeaderboard();
    if (leaderboard.length < MAX_LEADERBOARD_SIZE) {
      return score > 0;
    }
    var lowestScore = leaderboard[leaderboard.length - 1].score;
    return score > lowestScore;
  }

  /**
   * Get current rank position (without saving).
   * @returns {number} - Rank position (1-indexed), or 0 if wouldn't rank
   */
  function getCurrentRank() {
    if (score <= 0) return 0;

    var leaderboard = loadLeaderboard();

    for (var i = 0; i < leaderboard.length; i++) {
      if (score > leaderboard[i].score) {
        return i + 1;
      }
    }

    if (leaderboard.length < MAX_LEADERBOARD_SIZE) {
      return leaderboard.length + 1;
    }

    return 0;
  }

  /**
   * Clear leaderboard (for testing/debug).
   * @returns {boolean}
   */
  function clearLeaderboard() {
    if (typeof SaveLoad === 'undefined') {
      return false;
    }

    SaveLoad.delete(LEADERBOARD_KEY);

    if (devMode) console.log('[ScoreManager] Leaderboard cleared');

    emitEvent('leaderboard-updated', {
      entry: null,
      leaderboard: []
    });

    triggerCallbacks('leaderboard-updated', {
      entry: null,
      leaderboard: []
    });

    return true;
  }

  /**
   * Get score manager statistics.
   * @returns {Object}
   */
  function stats() {
    return {
      score: score,
      combo: comboCount,
      multiplier: comboMultiplier,
      comboDecayMs: comboDecayMs,
      isHighScore: isHighScore(),
      currentRank: getCurrentRank()
    };
  }

  /**
   * Register callback for score events.
   * @param {string} event - Event name
   * @param {Function} callback - Handler function
   */
  function on(event, callback) {
    if (callbacks[event] && typeof callback === 'function') {
      callbacks[event].push(callback);
    }
  }

  /**
   * Remove callback for score events.
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
        console.error('[ScoreManager] Callback error:', err);
      }
    });
  }

  /**
   * Check if running in dev mode.
   * @returns {boolean}
   */
  function isDevMode() {
    return devMode;
  }

  /**
   * Set dev mode explicitly.
   * @param {boolean} enabled
   */
  function setDevMode(enabled) {
    devMode = !!enabled;
  }

  if (devMode) {
    console.log('[ScoreManager] Module loaded (dev mode)');
  }

  return {
    add: add,
    combo: combo,
    get: get,
    reset: reset,
    getCombo: getCombo,
    getMultiplier: getMultiplier,
    setComboDecay: setComboDecay,
    saveScore: saveScore,
    getLeaderboard: getLeaderboard,
    isHighScore: isHighScore,
    getCurrentRank: getCurrentRank,
    clearLeaderboard: clearLeaderboard,
    stats: stats,
    on: on,
    off: off,
    isDevMode: isDevMode,
    setDevMode: setDevMode
  };
})();
