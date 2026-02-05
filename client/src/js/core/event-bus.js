/**
 * Event Bus - Global pub/sub event system for game communication
 *
 * API:
 *   EventBus.on('event-name', callback)      - Subscribe
 *   EventBus.off('event-name', callback)     - Unsubscribe
 *   EventBus.emit('event-name', data)        - Publish
 *   EventBus.once('event-name', callback)    - One-time listener
 *   EventBus.clear()                         - Remove all listeners
 *   EventBus.clear('event-name')             - Remove listeners for specific event
 *
 * Common events:
 *   - game-start, game-over, game-pause, game-resume
 *   - enemy-killed { id, score, position }
 *   - player-damage { amount, source }
 *   - score-change { score, delta }
 *   - wave-start { wave }, wave-complete { wave }
 */

// Event listeners storage: Map<eventName, Set<callback>>
const listeners = new Map();

// One-time listeners: Map<eventName, Set<callback>>
const onceListeners = new Map();

// Debug mode
let debugMode = false;

/**
 * Subscribe to an event.
 * @param {string} eventName - Event to listen for
 * @param {Function} callback - Handler function(data)
 * @returns {Function} Unsubscribe function
 */
export function on(eventName, callback) {
  if (typeof callback !== 'function') {
    console.warn('[EventBus] Callback must be a function');
    return () => {};
  }

  if (!listeners.has(eventName)) {
    listeners.set(eventName, new Set());
  }
  listeners.get(eventName).add(callback);

  if (debugMode) {
    console.log('[EventBus] Subscribed to:', eventName);
  }

  // Return unsubscribe function
  return () => off(eventName, callback);
}

/**
 * Unsubscribe from an event.
 * @param {string} eventName - Event name
 * @param {Function} callback - Handler to remove
 */
export function off(eventName, callback) {
  const eventListeners = listeners.get(eventName);
  if (eventListeners) {
    eventListeners.delete(callback);
    if (eventListeners.size === 0) {
      listeners.delete(eventName);
    }
  }

  // Also remove from once listeners
  const eventOnceListeners = onceListeners.get(eventName);
  if (eventOnceListeners) {
    eventOnceListeners.delete(callback);
    if (eventOnceListeners.size === 0) {
      onceListeners.delete(eventName);
    }
  }

  if (debugMode) {
    console.log('[EventBus] Unsubscribed from:', eventName);
  }
}

/**
 * Subscribe to an event for one-time only.
 * @param {string} eventName - Event to listen for
 * @param {Function} callback - Handler function(data)
 * @returns {Function} Unsubscribe function
 */
export function once(eventName, callback) {
  if (typeof callback !== 'function') {
    console.warn('[EventBus] Callback must be a function');
    return () => {};
  }

  if (!onceListeners.has(eventName)) {
    onceListeners.set(eventName, new Set());
  }
  onceListeners.get(eventName).add(callback);

  if (debugMode) {
    console.log('[EventBus] Subscribed once to:', eventName);
  }

  return () => off(eventName, callback);
}

/**
 * Emit an event to all subscribers.
 * @param {string} eventName - Event to emit
 * @param {*} data - Data to pass to handlers
 */
export function emit(eventName, data) {
  if (debugMode) {
    console.log('[EventBus] Emit:', eventName, data);
  }

  // Call regular listeners
  const eventListeners = listeners.get(eventName);
  if (eventListeners) {
    eventListeners.forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error('[EventBus] Error in listener for', eventName, ':', err);
      }
    });
  }

  // Call and remove once listeners
  const eventOnceListeners = onceListeners.get(eventName);
  if (eventOnceListeners) {
    eventOnceListeners.forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error('[EventBus] Error in once listener for', eventName, ':', err);
      }
    });
    onceListeners.delete(eventName);
  }
}

/**
 * Remove all listeners, or all listeners for a specific event.
 * @param {string} [eventName] - Optional event name to clear
 */
export function clear(eventName) {
  if (eventName) {
    listeners.delete(eventName);
    onceListeners.delete(eventName);
    if (debugMode) {
      console.log('[EventBus] Cleared listeners for:', eventName);
    }
  } else {
    listeners.clear();
    onceListeners.clear();
    if (debugMode) {
      console.log('[EventBus] Cleared all listeners');
    }
  }
}

/**
 * Get count of listeners for an event.
 * @param {string} eventName - Event name
 * @returns {number} Number of listeners
 */
export function listenerCount(eventName) {
  let count = 0;
  const eventListeners = listeners.get(eventName);
  const eventOnceListeners = onceListeners.get(eventName);
  if (eventListeners) count += eventListeners.size;
  if (eventOnceListeners) count += eventOnceListeners.size;
  return count;
}

/**
 * Enable/disable debug logging.
 * @param {boolean} enabled - True to enable debug mode
 */
export function setDebug(enabled) {
  debugMode = !!enabled;
  console.log('[EventBus] Debug mode:', debugMode ? 'enabled' : 'disabled');
}

// Default export as object for convenience
const EventBus = {
  on,
  off,
  once,
  emit,
  clear,
  listenerCount,
  setDebug
};

export default EventBus;
