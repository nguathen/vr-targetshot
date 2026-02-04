/**
 * Analytics - Simple telemetry logger for gameplay metrics
 * Usage: <script src="/framework/utils/analytics.js"></script>
 *
 * Basic usage:
 *   Analytics.log('level_complete', { level: 1, time: 120 });
 *   Analytics.log('enemy_killed', { type: 'boss', weapon: 'laser' });
 *
 * Session data:
 *   Analytics.getSession();   // Returns array of all events
 *   Analytics.export();       // Returns JSON string for analysis
 *   Analytics.clear();        // Clear session data
 */
window.Analytics = (function() {
  'use strict';

  var sessionEvents = [];
  var sessionId = generateSessionId();
  var sessionStart = Date.now();

  // Detect dev mode: localhost, 127.0.0.1, or explicit flag
  var devMode = (function() {
    if (typeof window === 'undefined') return false;
    var host = window.location.hostname;
    return host === 'localhost' ||
           host === '127.0.0.1' ||
           host.startsWith('192.168.') ||
           window.ANALYTICS_DEV_MODE === true;
  })();

  /**
   * Generate unique session ID.
   * @returns {string}
   */
  function generateSessionId() {
    return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Log an analytics event.
   * @param {string} event - Event name (e.g., 'level_complete', 'enemy_killed')
   * @param {Object} data - Event data object
   * @returns {Object} - The logged event
   */
  function log(event, data) {
    if (!event || typeof event !== 'string') {
      if (devMode) console.warn('[Analytics] Event name required');
      return null;
    }

    var entry = {
      event: event,
      data: data || {},
      timestamp: Date.now(),
      sessionTime: Date.now() - sessionStart
    };

    sessionEvents.push(entry);

    if (devMode) {
      console.log('[Analytics] ' + event, data || {});
    }

    return entry;
  }

  /**
   * Get all events from current session.
   * @returns {Array} - Array of event objects
   */
  function getSession() {
    return sessionEvents.slice();
  }

  /**
   * Export session data as JSON string.
   * @returns {string} - JSON string of session data
   */
  function exportData() {
    return JSON.stringify({
      sessionId: sessionId,
      sessionStart: sessionStart,
      sessionDuration: Date.now() - sessionStart,
      eventCount: sessionEvents.length,
      events: sessionEvents
    }, null, 2);
  }

  /**
   * Get session metadata without events.
   * @returns {Object} - Session metadata
   */
  function getSessionInfo() {
    return {
      sessionId: sessionId,
      sessionStart: sessionStart,
      sessionDuration: Date.now() - sessionStart,
      eventCount: sessionEvents.length
    };
  }

  /**
   * Clear all session events.
   */
  function clear() {
    sessionEvents = [];
    if (devMode) console.log('[Analytics] Session cleared');
  }

  /**
   * Start a new session (resets session ID and events).
   * @returns {string} - New session ID
   */
  function newSession() {
    sessionEvents = [];
    sessionId = generateSessionId();
    sessionStart = Date.now();
    if (devMode) console.log('[Analytics] New session: ' + sessionId);
    return sessionId;
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
    console.log('[Analytics] Module loaded (dev mode)');
  }

  return {
    log: log,
    getSession: getSession,
    export: exportData,
    getSessionInfo: getSessionInfo,
    clear: clear,
    newSession: newSession,
    isDevMode: isDevMode,
    setDevMode: setDevMode
  };
})();
