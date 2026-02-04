/**
 * Tutorial System - Contextual hints and tutorials for VR
 * Usage: <script src="/framework/ui/tutorial.js"></script>
 *
 * API:
 *   Tutorial.show(message, options)        - Display hint at default position
 *   Tutorial.showAt(message, position)     - Display hint at world position
 *   Tutorial.sequence(steps[])             - Multi-step tutorial
 *   Tutorial.dismiss()                     - Hide current hint
 *
 * Options:
 *   duration: number     - Auto-dismiss after ms (default: 3000, 0 = permanent)
 *   id: string           - Unique ID for tracking (won't repeat if already shown)
 *   position: vec3       - Override default position
 *   color: string        - Text color (default: '#ffffff')
 *   bgColor: string      - Background color (default: '#0a0a1a')
 *   width: number        - Panel width (default: 0.8)
 *
 * Sequence steps:
 *   { message: string, duration: number, position?: vec3, id?: string }
 *
 * Events:
 *   tutorial-show    - { message, id }
 *   tutorial-dismiss - { message, id }
 *   sequence-start   - { steps }
 *   sequence-step    - { step, index, total }
 *   sequence-end     - {}
 */
(function() {
  'use strict';

  if (typeof AFRAME === 'undefined') {
    console.error('[Tutorial] A-Frame not found. Load A-Frame before tutorial.js');
    return;
  }

  var STORAGE_KEY = 'vr-tutorial-shown';

  var DEFAULTS = {
    duration: 3000,
    color: '#ffffff',
    bgColor: '#0a0a1a',
    borderColor: '#4488ff',
    width: 0.8,
    padding: 0.04,
    fontSize: 0.06,
    position: { x: 0, y: -0.3, z: -1 }
  };

  var state = {
    hintEl: null,
    textEl: null,
    bgEl: null,
    borderEl: null,
    dismissTimer: null,
    currentMessage: '',
    currentId: null,
    shownHints: {},
    sequenceActive: false,
    sequenceSteps: [],
    sequenceIndex: 0,
    camera: null,
    worldHintEl: null,
    isWorldHint: false
  };

  function loadShownHints() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        state.shownHints = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[Tutorial] Failed to load shown hints:', e.message);
    }
  }

  function saveShownHints() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.shownHints));
    } catch (e) {
      console.warn('[Tutorial] Failed to save shown hints:', e.message);
    }
  }

  function markAsShown(id) {
    if (id) {
      state.shownHints[id] = Date.now();
      saveShownHints();
    }
  }

  function hasBeenShown(id) {
    return id && state.shownHints[id] !== undefined;
  }

  function getCamera() {
    if (!state.camera) {
      state.camera = document.querySelector('a-camera, [camera]');
    }
    return state.camera;
  }

  function createHintPanel(parent, isWorld) {
    var container = document.createElement('a-entity');
    container.setAttribute('id', isWorld ? 'tutorial-world-hint' : 'tutorial-hint');
    container.setAttribute('visible', false);

    var border = document.createElement('a-plane');
    border.setAttribute('width', DEFAULTS.width + 0.02);
    border.setAttribute('height', 0.15);
    border.setAttribute('material', {
      color: DEFAULTS.borderColor,
      shader: 'flat',
      opacity: 0.9,
      side: 'double'
    });
    border.setAttribute('position', '0 0 -0.002');
    container.appendChild(border);

    var bg = document.createElement('a-plane');
    bg.setAttribute('width', DEFAULTS.width);
    bg.setAttribute('height', 0.13);
    bg.setAttribute('material', {
      color: DEFAULTS.bgColor,
      shader: 'flat',
      opacity: 0.95,
      side: 'double'
    });
    bg.setAttribute('position', '0 0 -0.001');
    container.appendChild(bg);

    var text = document.createElement('a-text');
    text.setAttribute('value', '');
    text.setAttribute('align', 'center');
    text.setAttribute('color', DEFAULTS.color);
    text.setAttribute('width', DEFAULTS.width - DEFAULTS.padding * 2);
    text.setAttribute('wrap-count', 30);
    text.setAttribute('position', '0 0 0.001');
    container.appendChild(text);

    parent.appendChild(container);

    return {
      container: container,
      border: border,
      bg: bg,
      text: text
    };
  }

  function setupHintElements() {
    if (state.hintEl) return;

    var camera = getCamera();
    if (!camera) {
      console.warn('[Tutorial] No camera found. Will retry on first show.');
      return false;
    }

    var elements = createHintPanel(camera, false);
    state.hintEl = elements.container;
    state.borderEl = elements.border;
    state.bgEl = elements.bg;
    state.textEl = elements.text;

    state.hintEl.setAttribute('position', DEFAULTS.position);
    return true;
  }

  function setupWorldHint() {
    if (state.worldHintEl) return;

    var scene = document.querySelector('a-scene');
    if (!scene) return;

    var elements = createHintPanel(scene, true);
    state.worldHintEl = elements.container;
    state.worldBorderEl = elements.border;
    state.worldBgEl = elements.bg;
    state.worldTextEl = elements.text;
  }

  function updatePanelSize(text, options, isWorld) {
    var textEl = isWorld ? state.worldTextEl : state.textEl;
    var bgEl = isWorld ? state.worldBgEl : state.bgEl;
    var borderEl = isWorld ? state.worldBorderEl : state.borderEl;

    var width = options.width || DEFAULTS.width;
    var lines = Math.ceil(text.length / 25);
    var height = Math.max(0.1, 0.06 + lines * 0.04);

    bgEl.setAttribute('width', width);
    bgEl.setAttribute('height', height);
    borderEl.setAttribute('width', width + 0.02);
    borderEl.setAttribute('height', height + 0.02);
    textEl.setAttribute('width', width - DEFAULTS.padding * 2);
  }

  function show(message, options) {
    options = options || {};

    if (options.id && hasBeenShown(options.id)) {
      return false;
    }

    if (!setupHintElements()) {
      var self = this;
      setTimeout(function() { show(message, options); }, 100);
      return true;
    }

    clearDismissTimer();

    if (state.isWorldHint && state.worldHintEl) {
      state.worldHintEl.setAttribute('visible', false);
      state.isWorldHint = false;
    }

    state.currentMessage = message;
    state.currentId = options.id || null;

    updatePanelSize(message, options, false);

    state.textEl.setAttribute('value', message);
    state.textEl.setAttribute('color', options.color || DEFAULTS.color);
    state.bgEl.setAttribute('material', 'color', options.bgColor || DEFAULTS.bgColor);

    if (options.position) {
      state.hintEl.setAttribute('position', options.position);
    } else {
      state.hintEl.setAttribute('position', DEFAULTS.position);
    }

    state.hintEl.setAttribute('visible', true);

    if (options.id) {
      markAsShown(options.id);
    }

    var duration = options.duration !== undefined ? options.duration : DEFAULTS.duration;
    if (duration > 0) {
      state.dismissTimer = setTimeout(function() {
        dismiss();
      }, duration);
    }

    emitEvent('tutorial-show', { message: message, id: options.id });

    if (window.Haptics) {
      Haptics.light('both');
    }

    console.log('[Tutorial] Showing:', message);
    return true;
  }

  function showAt(message, position, options) {
    options = options || {};

    if (options.id && hasBeenShown(options.id)) {
      return false;
    }

    setupWorldHint();

    if (!state.worldHintEl) {
      console.warn('[Tutorial] Could not create world hint element');
      return false;
    }

    clearDismissTimer();

    if (state.hintEl) {
      state.hintEl.setAttribute('visible', false);
    }

    state.isWorldHint = true;
    state.currentMessage = message;
    state.currentId = options.id || null;

    updatePanelSize(message, options, true);

    state.worldTextEl.setAttribute('value', message);
    state.worldTextEl.setAttribute('color', options.color || DEFAULTS.color);
    state.worldBgEl.setAttribute('material', 'color', options.bgColor || DEFAULTS.bgColor);

    var pos = position;
    if (position && position.x !== undefined) {
      pos = position;
    } else if (position && position.object3D) {
      var worldPos = new THREE.Vector3();
      position.object3D.getWorldPosition(worldPos);
      pos = { x: worldPos.x, y: worldPos.y + 0.5, z: worldPos.z };
    }

    state.worldHintEl.setAttribute('position', pos);
    state.worldHintEl.setAttribute('look-at', '[camera]');
    state.worldHintEl.setAttribute('visible', true);

    if (options.id) {
      markAsShown(options.id);
    }

    var duration = options.duration !== undefined ? options.duration : DEFAULTS.duration;
    if (duration > 0) {
      state.dismissTimer = setTimeout(function() {
        dismiss();
      }, duration);
    }

    emitEvent('tutorial-show', { message: message, id: options.id, position: pos });

    if (window.Haptics) {
      Haptics.light('both');
    }

    console.log('[Tutorial] Showing at position:', message, pos);
    return true;
  }

  function dismiss() {
    clearDismissTimer();

    var wasVisible = false;
    var message = state.currentMessage;
    var id = state.currentId;

    if (state.hintEl && state.hintEl.getAttribute('visible')) {
      state.hintEl.setAttribute('visible', false);
      wasVisible = true;
    }

    if (state.worldHintEl && state.worldHintEl.getAttribute('visible')) {
      state.worldHintEl.setAttribute('visible', false);
      wasVisible = true;
    }

    state.currentMessage = '';
    state.currentId = null;
    state.isWorldHint = false;

    if (wasVisible) {
      emitEvent('tutorial-dismiss', { message: message, id: id });
      console.log('[Tutorial] Dismissed');
    }

    if (state.sequenceActive) {
      advanceSequence();
    }
  }

  function clearDismissTimer() {
    if (state.dismissTimer) {
      clearTimeout(state.dismissTimer);
      state.dismissTimer = null;
    }
  }

  function sequence(steps) {
    if (!steps || steps.length === 0) {
      console.warn('[Tutorial] Empty sequence provided');
      return;
    }

    state.sequenceActive = true;
    state.sequenceSteps = steps;
    state.sequenceIndex = 0;

    emitEvent('sequence-start', { steps: steps });
    console.log('[Tutorial] Starting sequence with', steps.length, 'steps');

    showSequenceStep(0);
  }

  function showSequenceStep(index) {
    if (index >= state.sequenceSteps.length) {
      endSequence();
      return;
    }

    var step = state.sequenceSteps[index];
    state.sequenceIndex = index;

    emitEvent('sequence-step', {
      step: step,
      index: index,
      total: state.sequenceSteps.length
    });

    var options = {
      duration: step.duration || DEFAULTS.duration,
      id: step.id,
      color: step.color,
      bgColor: step.bgColor,
      width: step.width
    };

    if (step.position) {
      showAt(step.message, step.position, options);
    } else {
      show(step.message, options);
    }
  }

  function advanceSequence() {
    if (!state.sequenceActive) return;

    var nextIndex = state.sequenceIndex + 1;
    if (nextIndex < state.sequenceSteps.length) {
      showSequenceStep(nextIndex);
    } else {
      endSequence();
    }
  }

  function endSequence() {
    state.sequenceActive = false;
    state.sequenceSteps = [];
    state.sequenceIndex = 0;

    emitEvent('sequence-end', {});
    console.log('[Tutorial] Sequence ended');
  }

  function skipSequence() {
    if (!state.sequenceActive) return;

    clearDismissTimer();
    state.sequenceActive = false;
    state.sequenceSteps = [];
    state.sequenceIndex = 0;

    if (state.hintEl) {
      state.hintEl.setAttribute('visible', false);
    }
    if (state.worldHintEl) {
      state.worldHintEl.setAttribute('visible', false);
    }

    emitEvent('sequence-end', { skipped: true });
    console.log('[Tutorial] Sequence skipped');
  }

  function resetShownHints() {
    state.shownHints = {};
    saveShownHints();
    console.log('[Tutorial] Reset shown hints');
  }

  function hasShown(id) {
    return hasBeenShown(id);
  }

  function emitEvent(name, detail) {
    var scene = document.querySelector('a-scene');
    if (scene) {
      scene.emit(name, detail);
    }
  }

  loadShownHints();

  window.Tutorial = {
    /**
     * Show a hint at the default position (in front of camera).
     * @param {string} message - The hint text
     * @param {Object} options - { duration, id, position, color, bgColor, width }
     * @returns {boolean} - Whether hint was shown (false if already shown by id)
     */
    show: show,

    /**
     * Show a hint at a world position.
     * @param {string} message - The hint text
     * @param {Object|Entity} position - { x, y, z } or A-Frame entity
     * @param {Object} options - { duration, id, color, bgColor, width }
     * @returns {boolean} - Whether hint was shown
     */
    showAt: showAt,

    /**
     * Run a multi-step tutorial sequence.
     * @param {Array} steps - [{ message, duration?, position?, id?, color?, bgColor? }]
     */
    sequence: sequence,

    /**
     * Dismiss the current hint.
     */
    dismiss: dismiss,

    /**
     * Skip the current sequence entirely.
     */
    skipSequence: skipSequence,

    /**
     * Check if a hint has been shown.
     * @param {string} id - Hint ID
     * @returns {boolean}
     */
    hasShown: hasShown,

    /**
     * Reset all shown hints tracking.
     */
    resetShownHints: resetShownHints,

    /**
     * Check if a sequence is currently active.
     * @returns {boolean}
     */
    isSequenceActive: function() {
      return state.sequenceActive;
    },

    /**
     * Check if any hint is currently visible.
     * @returns {boolean}
     */
    isVisible: function() {
      var hintVisible = state.hintEl && state.hintEl.getAttribute('visible');
      var worldVisible = state.worldHintEl && state.worldHintEl.getAttribute('visible');
      return hintVisible || worldVisible;
    }
  };

  console.log('[Tutorial] Module loaded');
})();
