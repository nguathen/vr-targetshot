/**
 * GameState - Simple state machine for game flow management
 * Usage: <script src="/framework/utils/state-machine.js"></script>
 *
 * Basic usage:
 *   GameState.init(['menu', 'playing', 'paused', 'gameover']);
 *   GameState.on('playing', function() { startGame(); });
 *   GameState.on('gameover', function() { showScore(); });
 *   GameState.transition('playing');
 *
 * State change events:
 *   window.addEventListener('state-change', function(e) {
 *     console.log('From:', e.detail.from, 'To:', e.detail.to);
 *   });
 */

/**
 * State transition detail object passed to callbacks and events.
 * @typedef {Object} StateTransitionDetail
 * @property {string} from - The previous state name
 * @property {string} to - The new state name
 */

/**
 * Callback function invoked on state entry.
 * @callback StateCallback
 * @param {StateTransitionDetail} detail - Transition details
 * @returns {void}
 */
window.GameState = (function() {
  'use strict';

  var validStates = [];
  var currentState = null;
  var callbacks = {};
  var initialized = false;

  /**
   * Initialize state machine with valid states.
   * @param {Array<string>} states - Array of valid state names
   * @param {string} [initialState] - Optional initial state (defaults to first)
   * @returns {boolean} True if initialized successfully
   */
  function init(states, initialState) {
    if (!states || !Array.isArray(states) || states.length === 0) {
      console.error('[GameState] States array required');
      return false;
    }

    validStates = states.slice();
    callbacks = {};
    currentState = initialState || states[0];

    if (!isValidState(currentState)) {
      console.error('[GameState] Initial state not in valid states:', currentState);
      return false;
    }

    initialized = true;
    console.log('[GameState] Initialized with states:', validStates.join(', '));
    console.log('[GameState] Current state:', currentState);

    return true;
  }

  /**
   * Check if a state is valid.
   * @param {string} state - State name to check
   * @returns {boolean} True if state is in valid states list
   */
  function isValidState(state) {
    return validStates.indexOf(state) !== -1;
  }

  /**
   * Transition to a new state.
   * @param {string} newState - State to transition to
   * @returns {boolean} True if transition succeeded
   */
  function transition(newState) {
    if (!initialized) {
      console.error('[GameState] Not initialized. Call init() first');
      return false;
    }

    if (!isValidState(newState)) {
      console.error('[GameState] Invalid state:', newState);
      console.error('[GameState] Valid states:', validStates.join(', '));
      return false;
    }

    if (newState === currentState) {
      console.warn('[GameState] Already in state:', newState);
      return false;
    }

    var previousState = currentState;
    currentState = newState;

    console.log('[GameState] Transition:', previousState, '->', newState);

    // Emit state-change event
    emitStateChange(previousState, newState);

    // Call registered callbacks for new state
    triggerCallbacks(newState, previousState);

    return true;
  }

  /**
   * Register callback for state entry.
   * @param {string} state - State to listen for
   * @param {StateCallback} callback - Function to call on state entry
   * @returns {boolean} True if registered successfully
   */
  function on(state, callback) {
    if (!initialized) {
      console.error('[GameState] Not initialized. Call init() first');
      return false;
    }

    if (!isValidState(state)) {
      console.error('[GameState] Invalid state:', state);
      return false;
    }

    if (typeof callback !== 'function') {
      console.error('[GameState] Callback must be a function');
      return false;
    }

    if (!callbacks[state]) {
      callbacks[state] = [];
    }

    callbacks[state].push(callback);
    return true;
  }

  /**
   * Remove callback for state entry.
   * @param {string} state - State the callback was registered for
   * @param {StateCallback} callback - Function to remove
   * @returns {boolean} True if removed successfully
   */
  function off(state, callback) {
    if (!callbacks[state]) return false;

    var index = callbacks[state].indexOf(callback);
    if (index !== -1) {
      callbacks[state].splice(index, 1);
      return true;
    }

    return false;
  }

  /**
   * Get current state.
   * @returns {string|null} - Current state name or null if not initialized
   */
  function current() {
    return currentState;
  }

  /**
   * Get all valid states.
   * @returns {Array<string>} Array of valid state names
   */
  function getStates() {
    return validStates.slice();
  }

  /**
   * Check if state machine is initialized.
   * @returns {boolean} True if init() has been called successfully
   */
  function isInitialized() {
    return initialized;
  }

  /**
   * Reset state machine to uninitialized state.
   * @returns {void}
   */
  function reset() {
    validStates = [];
    currentState = null;
    callbacks = {};
    initialized = false;
    console.log('[GameState] Reset');
  }

  /**
   * Emit state-change custom event.
   * @param {string} from - Previous state
   * @param {string} to - New state
   * @returns {void}
   * @fires CustomEvent#state-change
   */
  function emitStateChange(from, to) {
    if (typeof window === 'undefined') return;

    var event = new CustomEvent('state-change', {
      detail: { from: from, to: to }
    });
    window.dispatchEvent(event);
  }

  /**
   * Trigger all callbacks registered for a state.
   * @param {string} state - State whose callbacks to trigger
   * @param {string} previousState - Previous state for context
   * @returns {void}
   */
  function triggerCallbacks(state, previousState) {
    var stateCallbacks = callbacks[state];
    if (!stateCallbacks || stateCallbacks.length === 0) return;

    stateCallbacks.forEach(function(cb) {
      try {
        cb({ from: previousState, to: state });
      } catch (err) {
        console.error('[GameState] Callback error for state', state + ':', err);
      }
    });
  }

  console.log('[GameState] Module loaded');

  return {
    init: init,
    transition: transition,
    on: on,
    off: off,
    current: current,
    getStates: getStates,
    isInitialized: isInitialized,
    reset: reset
  };
})();
