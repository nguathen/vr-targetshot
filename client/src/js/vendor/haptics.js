/**
 * Haptics - VR controller vibration feedback for Quest
 * Usage: <script src="/framework/utils/haptics.js"></script>
 *
 * Basic usage:
 *   Haptics.pulse('right', 0.5, 100);   // Right hand, 50% intensity, 100ms
 *   Haptics.pulse('both', 1.0, 200);    // Both hands, full intensity, 200ms
 *
 * Preset patterns:
 *   Haptics.light('right');    // Subtle feedback (UI hover, pickup)
 *   Haptics.medium('left');    // Standard feedback (hit confirm)
 *   Haptics.heavy('both');     // Strong feedback (explosion, damage)
 */
window.Haptics = (function() {
  'use strict';

  var xrSession = null;
  var inputSources = null;

  // Preset configurations
  var PRESETS = {
    light:  { intensity: 0.2, duration: 50 },
    medium: { intensity: 0.5, duration: 100 },
    heavy:  { intensity: 1.0, duration: 200 }
  };

  /**
   * Get the current XR session from A-Frame scene.
   * @returns {XRSession|null}
   */
  function getSession() {
    if (xrSession) return xrSession;

    var scene = document.querySelector('a-scene');
    if (scene && scene.xrSession) {
      xrSession = scene.xrSession;
      return xrSession;
    }

    // Try navigator.xr if available
    if (navigator.xr && navigator.xr.session) {
      xrSession = navigator.xr.session;
      return xrSession;
    }

    return null;
  }

  /**
   * Get XR input sources (controllers).
   * @returns {XRInputSourceArray|null}
   */
  function getInputSources() {
    var session = getSession();
    if (session && session.inputSources) {
      return session.inputSources;
    }
    return null;
  }

  /**
   * Find gamepad for specified hand.
   * @param {string} hand - 'left' or 'right'
   * @returns {Gamepad|null}
   */
  function getGamepad(hand) {
    var sources = getInputSources();
    if (!sources) return null;

    for (var i = 0; i < sources.length; i++) {
      var source = sources[i];
      if (source.handedness === hand && source.gamepad) {
        return source.gamepad;
      }
    }

    return null;
  }

  /**
   * Check if haptics are available.
   * @returns {boolean}
   */
  function isAvailable() {
    var sources = getInputSources();
    if (!sources || sources.length === 0) return false;

    for (var i = 0; i < sources.length; i++) {
      var gamepad = sources[i].gamepad;
      if (gamepad && gamepad.hapticActuators && gamepad.hapticActuators.length > 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Trigger haptic pulse on specified hand(s).
   * @param {string} hand - 'left', 'right', or 'both'
   * @param {number} intensity - Vibration intensity (0.0 to 1.0)
   * @param {number} duration - Duration in milliseconds
   * @returns {boolean} - True if pulse was triggered
   */
  function pulse(hand, intensity, duration) {
    hand = hand || 'right';
    intensity = Math.max(0, Math.min(1, intensity || 0.5));
    duration = duration || 100;

    var triggered = false;

    if (hand === 'both') {
      triggered = triggerPulse('left', intensity, duration) || triggered;
      triggered = triggerPulse('right', intensity, duration) || triggered;
    } else {
      triggered = triggerPulse(hand, intensity, duration);
    }

    return triggered;
  }

  /**
   * Internal: Trigger pulse on single hand.
   * @param {string} hand - 'left' or 'right'
   * @param {number} intensity
   * @param {number} duration
   * @returns {boolean}
   */
  function triggerPulse(hand, intensity, duration) {
    var gamepad = getGamepad(hand);
    if (!gamepad) return false;

    // WebXR Gamepad hapticActuators API
    if (gamepad.hapticActuators && gamepad.hapticActuators.length > 0) {
      var actuator = gamepad.hapticActuators[0];
      if (actuator && typeof actuator.pulse === 'function') {
        actuator.pulse(intensity, duration);
        return true;
      }
    }

    // Fallback: vibrationActuator (some browsers)
    if (gamepad.vibrationActuator && typeof gamepad.vibrationActuator.playEffect === 'function') {
      gamepad.vibrationActuator.playEffect('dual-rumble', {
        duration: duration,
        strongMagnitude: intensity,
        weakMagnitude: intensity * 0.5
      });
      return true;
    }

    return false;
  }

  /**
   * Light haptic feedback - subtle touch/hover.
   * @param {string} hand - 'left', 'right', or 'both'
   * @returns {boolean}
   */
  function light(hand) {
    return pulse(hand, PRESETS.light.intensity, PRESETS.light.duration);
  }

  /**
   * Medium haptic feedback - standard interaction.
   * @param {string} hand - 'left', 'right', or 'both'
   * @returns {boolean}
   */
  function medium(hand) {
    return pulse(hand, PRESETS.medium.intensity, PRESETS.medium.duration);
  }

  /**
   * Heavy haptic feedback - impact/explosion.
   * @param {string} hand - 'left', 'right', or 'both'
   * @returns {boolean}
   */
  function heavy(hand) {
    return pulse(hand, PRESETS.heavy.intensity, PRESETS.heavy.duration);
  }

  /**
   * Custom pattern - sequence of pulses.
   * @param {string} hand - 'left', 'right', or 'both'
   * @param {Array} pattern - Array of {intensity, duration, pause} objects
   * @returns {boolean}
   */
  function pattern(hand, patternArray) {
    if (!patternArray || patternArray.length === 0) return false;

    var delay = 0;
    var triggered = false;

    patternArray.forEach(function(step) {
      setTimeout(function() {
        if (pulse(hand, step.intensity, step.duration)) {
          triggered = true;
        }
      }, delay);
      delay += (step.duration || 100) + (step.pause || 50);
    });

    return triggered;
  }

  /**
   * Clear cached session (call when XR session ends).
   */
  function reset() {
    xrSession = null;
    inputSources = null;
  }

  // Auto-reset when session ends
  if (typeof window !== 'undefined') {
    window.addEventListener('vr-session-end', reset);
  }

  console.log('[Haptics] Module loaded');

  return {
    pulse: pulse,
    light: light,
    medium: medium,
    heavy: heavy,
    pattern: pattern,
    isAvailable: isAvailable,
    reset: reset
  };
})();
