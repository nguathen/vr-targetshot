/**
 * SaveLoad - LocalStorage persistence with versioning support
 * Usage: <script src="/framework/utils/save-load.js"></script>
 *
 * Basic usage:
 *   SaveLoad.save('progress', { level: 3, score: 1500 });
 *   var data = SaveLoad.load('progress');  // { version, data, timestamp }
 *   SaveLoad.exists('progress');           // true
 *   SaveLoad.delete('progress');
 *
 * Versioning:
 *   SaveLoad.setVersion(2);
 *   SaveLoad.save('progress', { level: 3 });
 *   var save = SaveLoad.load('progress');
 *   if (save.version < 2) { migrateData(save.data); }
 */
window.SaveLoad = (function() {
  'use strict';

  var PREFIX = 'vrgame_';
  var currentVersion = 1;

  var devMode = (function() {
    if (typeof window === 'undefined') return false;
    var host = window.location.hostname;
    return host === 'localhost' ||
           host === '127.0.0.1' ||
           host.startsWith('192.168.') ||
           window.SAVELOAD_DEV_MODE === true;
  })();

  /**
   * Get full storage key with prefix.
   * @param {string} key - User key
   * @returns {string} - Prefixed key
   */
  function getStorageKey(key) {
    return PREFIX + key;
  }

  /**
   * Check if localStorage is available.
   * @returns {boolean}
   */
  function isStorageAvailable() {
    try {
      var test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Save data to localStorage.
   * @param {string} key - Save slot identifier
   * @param {*} data - Data to save (must be JSON serializable)
   * @returns {boolean} - True if saved successfully
   */
  function save(key, data) {
    if (!key || typeof key !== 'string') {
      if (devMode) console.warn('[SaveLoad] Key must be a non-empty string');
      return false;
    }

    if (!isStorageAvailable()) {
      if (devMode) console.warn('[SaveLoad] localStorage not available');
      return false;
    }

    try {
      var saveData = {
        version: currentVersion,
        timestamp: Date.now(),
        data: data
      };

      var serialized = JSON.stringify(saveData);
      localStorage.setItem(getStorageKey(key), serialized);

      if (devMode) {
        console.log('[SaveLoad] Saved "' + key + '" (v' + currentVersion + ')', data);
      }

      return true;
    } catch (e) {
      if (devMode) {
        console.error('[SaveLoad] Save failed for "' + key + '":', e.message);
      }
      return false;
    }
  }

  /**
   * Load data from localStorage.
   * @param {string} key - Save slot identifier
   * @returns {Object|null} - { version, data, timestamp } or null if not found/corrupted
   */
  function load(key) {
    if (!key || typeof key !== 'string') {
      if (devMode) console.warn('[SaveLoad] Key must be a non-empty string');
      return null;
    }

    if (!isStorageAvailable()) {
      if (devMode) console.warn('[SaveLoad] localStorage not available');
      return null;
    }

    try {
      var raw = localStorage.getItem(getStorageKey(key));

      if (raw === null) {
        if (devMode) console.log('[SaveLoad] No save found for "' + key + '"');
        return null;
      }

      var parsed = JSON.parse(raw);

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid save format');
      }

      if (typeof parsed.version !== 'number' ||
          typeof parsed.timestamp !== 'number' ||
          !('data' in parsed)) {
        throw new Error('Missing required fields');
      }

      if (devMode) {
        console.log('[SaveLoad] Loaded "' + key + '" (v' + parsed.version + ')', parsed.data);
      }

      return {
        version: parsed.version,
        data: parsed.data,
        timestamp: parsed.timestamp
      };
    } catch (e) {
      if (devMode) {
        console.error('[SaveLoad] Corrupted save for "' + key + '":', e.message);
      }
      return null;
    }
  }

  /**
   * Check if a save exists for the given key.
   * @param {string} key - Save slot identifier
   * @returns {boolean}
   */
  function exists(key) {
    if (!key || typeof key !== 'string') {
      return false;
    }

    if (!isStorageAvailable()) {
      return false;
    }

    return localStorage.getItem(getStorageKey(key)) !== null;
  }

  /**
   * Delete a save from localStorage.
   * @param {string} key - Save slot identifier
   * @returns {boolean} - True if deleted (or didn't exist)
   */
  function deleteSave(key) {
    if (!key || typeof key !== 'string') {
      if (devMode) console.warn('[SaveLoad] Key must be a non-empty string');
      return false;
    }

    if (!isStorageAvailable()) {
      if (devMode) console.warn('[SaveLoad] localStorage not available');
      return false;
    }

    localStorage.removeItem(getStorageKey(key));

    if (devMode) {
      console.log('[SaveLoad] Deleted "' + key + '"');
    }

    return true;
  }

  /**
   * Get all save keys (without prefix).
   * @returns {Array<string>}
   */
  function getAllKeys() {
    if (!isStorageAvailable()) {
      return [];
    }

    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var fullKey = localStorage.key(i);
      if (fullKey && fullKey.startsWith(PREFIX)) {
        keys.push(fullKey.substring(PREFIX.length));
      }
    }
    return keys;
  }

  /**
   * Delete all saves with the game prefix.
   * @returns {number} - Number of saves deleted
   */
  function deleteAll() {
    var keys = getAllKeys();
    keys.forEach(function(key) {
      localStorage.removeItem(getStorageKey(key));
    });

    if (devMode) {
      console.log('[SaveLoad] Deleted all saves (' + keys.length + ')');
    }

    return keys.length;
  }

  /**
   * Set the current save version (for new saves).
   * @param {number} version
   */
  function setVersion(version) {
    if (typeof version !== 'number' || version < 1) {
      if (devMode) console.warn('[SaveLoad] Version must be a positive number');
      return;
    }
    currentVersion = version;
    if (devMode) {
      console.log('[SaveLoad] Version set to ' + version);
    }
  }

  /**
   * Get the current save version.
   * @returns {number}
   */
  function getVersion() {
    return currentVersion;
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
    console.log('[SaveLoad] Module loaded (dev mode)');
  }

  return {
    save: save,
    load: load,
    exists: exists,
    delete: deleteSave,
    getAllKeys: getAllKeys,
    deleteAll: deleteAll,
    setVersion: setVersion,
    getVersion: getVersion,
    isDevMode: isDevMode,
    setDevMode: setDevMode
  };
})();
