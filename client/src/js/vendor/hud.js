/**
 * HUD System - Generic A-Frame HUD for VR games
 * Usage: <script src="/framework/hud.js"></script>
 *
 * Expects a-text elements as children of the camera entity.
 * Call HUD.init({ wave: 'hud-wave', gold: 'hud-gold' }) with element IDs.
 */
window.HUD = (function() {
  'use strict';

  var elements = {};
  var messageTimer = null;

  /**
   * Initialize HUD with element ID map.
   * @param {Object} idMap - { key: 'element-id', ... }
   */
  function init(idMap) {
    elements = {};
    for (var key in idMap) {
      elements[key] = document.getElementById(idMap[key]);
    }
  }

  /**
   * Update a HUD element's text value.
   * @param {string} key - Key from init map
   * @param {string} value - Text to display
   */
  function update(key, value) {
    if (elements[key]) {
      elements[key].setAttribute('value', value);
    }
  }

  /**
   * Show all HUD elements.
   */
  function show() {
    for (var key in elements) {
      if (elements[key]) elements[key].setAttribute('visible', true);
    }
  }

  /**
   * Hide all HUD elements.
   */
  function hide() {
    for (var key in elements) {
      if (elements[key]) elements[key].setAttribute('visible', false);
    }
  }

  /**
   * Show a temporary message on the 'message' HUD element.
   * @param {string} text - Message text
   * @param {number} duration - Duration in ms (0 = permanent)
   */
  function message(text, duration) {
    if (!elements.message) return;
    if (messageTimer) clearTimeout(messageTimer);
    elements.message.setAttribute('visible', true);
    elements.message.setAttribute('value', text);
    if (duration) {
      messageTimer = setTimeout(function() {
        elements.message.setAttribute('visible', false);
      }, duration);
    }
  }

  /**
   * Hide the message element.
   */
  function hideMessage() {
    if (elements.message) elements.message.setAttribute('visible', false);
    if (messageTimer) clearTimeout(messageTimer);
  }

  return {
    init: init,
    update: update,
    show: show,
    hide: hide,
    message: message,
    hideMessage: hideMessage
  };
})();
