/**
 * Settings Menu - In-game 3D settings panel for VR
 * Usage: <script src="/framework/ui/settings-menu.js"></script>
 *
 * Attach to scene or any entity:
 *   <a-entity settings-menu>
 *
 * Schema options:
 *   position: Panel position relative to camera (default: '0 0 -1.5')
 *   scale: Panel scale (default: 1)
 *   menuButton: Which button opens menu - 'menu', 'y', 'b' (default: 'menu')
 *
 * Global API:
 *   SettingsMenu.open()    - Open settings menu
 *   SettingsMenu.close()   - Close settings menu
 *   SettingsMenu.toggle()  - Toggle menu visibility
 *   SettingsMenu.isOpen()  - Check if menu is open
 *
 * Integrates with:
 *   - AudioManager: Volume sliders for Master, Action, Ambient, UI
 *   - SnapTurn: Angle selector (30, 45, 90)
 *   - Vignette: Enable/disable toggle
 *
 * Settings persist via localStorage.
 */
(function() {
  'use strict';

  // Guard against A-Frame not loaded
  if (typeof AFRAME === 'undefined') {
    console.error('[SettingsMenu] A-Frame not found. Load A-Frame before settings-menu.js');
    return;
  }

  var STORAGE_KEY = 'vr-game-settings';

  // Default settings
  var DEFAULT_SETTINGS = {
    volume: {
      master: 1.0,
      action: 1.0,
      ambient: 0.5,
      ui: 0.8
    },
    comfort: {
      snapTurnAngle: 45,
      vignetteEnabled: true
    }
  };

  // UI Colors
  var COLORS = {
    panelBg: '#0a0a1a',
    panelBorder: '#2244aa',
    headerBg: '#1a1a3a',
    text: '#ffffff',
    textMuted: '#aaaacc',
    sliderTrack: '#333355',
    sliderFill: '#4488ff',
    sliderHandle: '#6699ff',
    buttonBg: '#223366',
    buttonHover: '#3355aa',
    buttonActive: '#4477cc',
    toggleOn: '#44aa66',
    toggleOff: '#444466',
    closeBtn: '#aa3333'
  };

  // Dimensions
  var PANEL = {
    width: 0.8,
    height: 1.0,
    padding: 0.04,
    rowHeight: 0.08,
    sliderWidth: 0.3,
    sliderHeight: 0.03,
    buttonHeight: 0.06
  };

  AFRAME.registerComponent('settings-menu', {
    schema: {
      position: { type: 'vec3', default: { x: 0, y: 0, z: -1.5 } },
      scale: { type: 'number', default: 1 },
      menuButton: { type: 'string', default: 'menu' }
    },

    init: function() {
      this.menuEl = null;
      this.isMenuOpen = false;
      this.settings = this.loadSettings();
      this.sliders = {};
      this.activeSlider = null;
      this.leftController = null;
      this.rightController = null;

      // Bind handlers
      this.onMenuButtonPress = this.onMenuButtonPress.bind(this);
      this.onControllerMove = this.onControllerMove.bind(this);
      this.onTriggerDown = this.onTriggerDown.bind(this);
      this.onTriggerUp = this.onTriggerUp.bind(this);

      // Create menu after scene loads
      var self = this;
      if (this.el.sceneEl.hasLoaded) {
        this.setup();
      } else {
        this.el.sceneEl.addEventListener('loaded', function() {
          self.setup();
        });
      }

      console.log('[SettingsMenu] Component initialized');
    },

    setup: function() {
      this.createMenu();
      this.applySettings();
      this.setupControllers();
    },

    setupControllers: function() {
      this.leftController = document.getElementById('left-hand');
      this.rightController = document.getElementById('right-hand');

      // Menu button listeners
      var buttonEvent = this.getButtonEvent();
      if (this.leftController) {
        this.leftController.addEventListener(buttonEvent, this.onMenuButtonPress);
        this.leftController.addEventListener('triggerdown', this.onTriggerDown);
        this.leftController.addEventListener('triggerup', this.onTriggerUp);
      }
      if (this.rightController) {
        this.rightController.addEventListener(buttonEvent, this.onMenuButtonPress);
        this.rightController.addEventListener('triggerdown', this.onTriggerDown);
        this.rightController.addEventListener('triggerup', this.onTriggerUp);
      }
    },

    getButtonEvent: function() {
      switch (this.data.menuButton) {
        case 'y': return 'ybuttondown';
        case 'b': return 'bbuttondown';
        default: return 'menudown';
      }
    },

    onMenuButtonPress: function() {
      this.toggle();
    },

    createMenu: function() {
      // Create container that follows camera
      this.menuEl = document.createElement('a-entity');
      this.menuEl.setAttribute('id', 'settings-menu-container');
      this.menuEl.setAttribute('visible', false);

      // Position in front of camera
      var camera = document.querySelector('a-camera, [camera]');
      if (camera) {
        camera.appendChild(this.menuEl);
      } else {
        this.el.sceneEl.appendChild(this.menuEl);
      }

      // Set position and scale
      this.menuEl.setAttribute('position', this.data.position);
      this.menuEl.setAttribute('scale', {
        x: this.data.scale,
        y: this.data.scale,
        z: this.data.scale
      });

      // Create panel background
      this.createPanel();

      // Create header
      this.createHeader();

      // Create volume section
      this.createVolumeSection();

      // Create comfort section
      this.createComfortSection();

      // Create close button
      this.createCloseButton();
    },

    createPanel: function() {
      // Main panel background
      var panel = document.createElement('a-plane');
      panel.setAttribute('width', PANEL.width);
      panel.setAttribute('height', PANEL.height);
      panel.setAttribute('material', {
        color: COLORS.panelBg,
        shader: 'flat',
        opacity: 0.95,
        side: 'double'
      });
      panel.setAttribute('position', '0 0 0');
      this.menuEl.appendChild(panel);

      // Border frame
      var border = document.createElement('a-plane');
      border.setAttribute('width', PANEL.width + 0.01);
      border.setAttribute('height', PANEL.height + 0.01);
      border.setAttribute('material', {
        color: COLORS.panelBorder,
        shader: 'flat',
        opacity: 0.8,
        side: 'double'
      });
      border.setAttribute('position', '0 0 -0.001');
      this.menuEl.appendChild(border);
    },

    createHeader: function() {
      var yPos = (PANEL.height / 2) - PANEL.padding - 0.03;

      // Header background
      var headerBg = document.createElement('a-plane');
      headerBg.setAttribute('width', PANEL.width - PANEL.padding);
      headerBg.setAttribute('height', 0.08);
      headerBg.setAttribute('material', {
        color: COLORS.headerBg,
        shader: 'flat'
      });
      headerBg.setAttribute('position', { x: 0, y: yPos, z: 0.001 });
      this.menuEl.appendChild(headerBg);

      // Title text
      var title = document.createElement('a-text');
      title.setAttribute('value', 'SETTINGS');
      title.setAttribute('align', 'center');
      title.setAttribute('color', COLORS.text);
      title.setAttribute('width', 0.8);
      title.setAttribute('position', { x: 0, y: yPos, z: 0.002 });
      this.menuEl.appendChild(title);
    },

    createVolumeSection: function() {
      var startY = (PANEL.height / 2) - 0.16;
      var labelX = -PANEL.width / 2 + PANEL.padding + 0.08;
      var sliderX = 0.12;

      // Section header
      this.createSectionLabel('AUDIO', 0, startY);

      // Volume sliders
      var volumes = [
        { key: 'master', label: 'Master' },
        { key: 'action', label: 'Action' },
        { key: 'ambient', label: 'Ambient' },
        { key: 'ui', label: 'UI' }
      ];

      var self = this;
      volumes.forEach(function(vol, i) {
        var y = startY - 0.08 - (i * PANEL.rowHeight);
        self.createSliderRow(vol.key, vol.label, labelX, sliderX, y, self.settings.volume[vol.key]);
      });
    },

    createComfortSection: function() {
      var startY = (PANEL.height / 2) - 0.54;
      var labelX = -PANEL.width / 2 + PANEL.padding + 0.08;
      var controlX = 0.18;

      // Section header
      this.createSectionLabel('COMFORT', 0, startY);

      // Snap Turn angle selector
      var snapY = startY - 0.08;
      this.createLabel('Snap Turn', labelX, snapY);
      this.createAngleSelector(controlX, snapY);

      // Vignette toggle
      var vignetteY = snapY - PANEL.rowHeight;
      this.createLabel('Vignette', labelX, vignetteY);
      this.createToggle('vignette', controlX, vignetteY, this.settings.comfort.vignetteEnabled);
    },

    createSectionLabel: function(text, x, y) {
      var label = document.createElement('a-text');
      label.setAttribute('value', text);
      label.setAttribute('align', 'center');
      label.setAttribute('color', COLORS.textMuted);
      label.setAttribute('width', 0.5);
      label.setAttribute('position', { x: x, y: y, z: 0.002 });
      this.menuEl.appendChild(label);
    },

    createLabel: function(text, x, y) {
      var label = document.createElement('a-text');
      label.setAttribute('value', text);
      label.setAttribute('align', 'left');
      label.setAttribute('color', COLORS.text);
      label.setAttribute('width', 0.4);
      label.setAttribute('position', { x: x, y: y, z: 0.002 });
      this.menuEl.appendChild(label);
    },

    createSliderRow: function(key, label, labelX, sliderX, y, value) {
      // Label
      this.createLabel(label, labelX, y);

      // Slider track
      var track = document.createElement('a-plane');
      track.setAttribute('class', 'clickable settings-slider');
      track.setAttribute('data-slider', key);
      track.setAttribute('width', PANEL.sliderWidth);
      track.setAttribute('height', PANEL.sliderHeight);
      track.setAttribute('material', {
        color: COLORS.sliderTrack,
        shader: 'flat'
      });
      track.setAttribute('position', { x: sliderX, y: y, z: 0.002 });
      this.menuEl.appendChild(track);

      // Slider fill
      var fillWidth = PANEL.sliderWidth * value;
      var fill = document.createElement('a-plane');
      fill.setAttribute('width', fillWidth);
      fill.setAttribute('height', PANEL.sliderHeight - 0.005);
      fill.setAttribute('material', {
        color: COLORS.sliderFill,
        shader: 'flat'
      });
      fill.setAttribute('position', {
        x: -PANEL.sliderWidth / 2 + fillWidth / 2,
        y: 0,
        z: 0.001
      });
      track.appendChild(fill);

      // Slider handle
      var handle = document.createElement('a-circle');
      handle.setAttribute('radius', 0.02);
      handle.setAttribute('material', {
        color: COLORS.sliderHandle,
        shader: 'flat'
      });
      handle.setAttribute('position', {
        x: -PANEL.sliderWidth / 2 + fillWidth,
        y: 0,
        z: 0.002
      });
      track.appendChild(handle);

      // Value text
      var valueText = document.createElement('a-text');
      valueText.setAttribute('value', Math.round(value * 100) + '%');
      valueText.setAttribute('align', 'left');
      valueText.setAttribute('color', COLORS.text);
      valueText.setAttribute('width', 0.25);
      valueText.setAttribute('position', {
        x: sliderX + PANEL.sliderWidth / 2 + 0.03,
        y: y,
        z: 0.002
      });
      this.menuEl.appendChild(valueText);

      // Store slider references
      this.sliders[key] = {
        track: track,
        fill: fill,
        handle: handle,
        valueText: valueText,
        value: value
      };

      // Click handler for slider
      var self = this;
      track.addEventListener('click', function(evt) {
        self.handleSliderClick(key, evt);
      });
    },

    createAngleSelector: function(x, y) {
      var angles = [30, 45, 90];
      var currentAngle = this.settings.comfort.snapTurnAngle;
      var self = this;

      angles.forEach(function(angle, i) {
        var btnX = x + (i - 1) * 0.08;
        var isActive = angle === currentAngle;

        var btn = document.createElement('a-plane');
        btn.setAttribute('class', 'clickable settings-angle-btn');
        btn.setAttribute('data-angle', angle);
        btn.setAttribute('width', 0.06);
        btn.setAttribute('height', 0.05);
        btn.setAttribute('material', {
          color: isActive ? COLORS.buttonActive : COLORS.buttonBg,
          shader: 'flat'
        });
        btn.setAttribute('position', { x: btnX, y: y, z: 0.002 });

        var text = document.createElement('a-text');
        text.setAttribute('value', angle + '°');
        text.setAttribute('align', 'center');
        text.setAttribute('color', COLORS.text);
        text.setAttribute('width', 0.3);
        text.setAttribute('position', { x: 0, y: 0, z: 0.001 });
        btn.appendChild(text);

        btn.addEventListener('click', function() {
          self.setSnapTurnAngle(angle);
        });

        self.menuEl.appendChild(btn);
      });
    },

    createToggle: function(key, x, y, enabled) {
      var self = this;

      var toggle = document.createElement('a-plane');
      toggle.setAttribute('class', 'clickable settings-toggle');
      toggle.setAttribute('data-toggle', key);
      toggle.setAttribute('width', 0.1);
      toggle.setAttribute('height', 0.04);
      toggle.setAttribute('material', {
        color: enabled ? COLORS.toggleOn : COLORS.toggleOff,
        shader: 'flat'
      });
      toggle.setAttribute('position', { x: x, y: y, z: 0.002 });

      // Toggle indicator
      var indicator = document.createElement('a-circle');
      indicator.setAttribute('radius', 0.015);
      indicator.setAttribute('material', {
        color: COLORS.text,
        shader: 'flat'
      });
      indicator.setAttribute('position', {
        x: enabled ? 0.03 : -0.03,
        y: 0,
        z: 0.001
      });
      toggle.appendChild(indicator);

      // Label
      var label = document.createElement('a-text');
      label.setAttribute('value', enabled ? 'ON' : 'OFF');
      label.setAttribute('align', 'left');
      label.setAttribute('color', COLORS.text);
      label.setAttribute('width', 0.25);
      label.setAttribute('position', { x: 0.08, y: 0, z: 0 });
      toggle.appendChild(label);

      toggle.addEventListener('click', function() {
        self.toggleVignette();
      });

      this.vignetteToggle = {
        el: toggle,
        indicator: indicator,
        label: label
      };

      this.menuEl.appendChild(toggle);
    },

    createCloseButton: function() {
      var self = this;
      var y = -PANEL.height / 2 + PANEL.padding + 0.04;

      var btn = document.createElement('a-plane');
      btn.setAttribute('class', 'clickable');
      btn.setAttribute('width', 0.2);
      btn.setAttribute('height', PANEL.buttonHeight);
      btn.setAttribute('material', {
        color: COLORS.closeBtn,
        shader: 'flat'
      });
      btn.setAttribute('position', { x: 0, y: y, z: 0.002 });

      var text = document.createElement('a-text');
      text.setAttribute('value', 'CLOSE');
      text.setAttribute('align', 'center');
      text.setAttribute('color', COLORS.text);
      text.setAttribute('width', 0.5);
      text.setAttribute('position', { x: 0, y: 0, z: 0.001 });
      btn.appendChild(text);

      btn.addEventListener('click', function() {
        self.close();
      });

      this.menuEl.appendChild(btn);
    },

    handleSliderClick: function(key, evt) {
      var slider = this.sliders[key];
      if (!slider) return;

      // Calculate new value from click position
      var track = slider.track;
      var trackPos = track.object3D.getWorldPosition(new THREE.Vector3());
      var clickPos = evt.detail.intersection ? evt.detail.intersection.point : null;

      if (clickPos) {
        // Convert to local coordinates
        var localX = clickPos.x - trackPos.x;
        var normalizedValue = (localX + PANEL.sliderWidth / 2) / PANEL.sliderWidth;
        normalizedValue = Math.max(0, Math.min(1, normalizedValue));

        this.setVolume(key, normalizedValue);
      }
    },

    setVolume: function(key, value) {
      value = Math.max(0, Math.min(1, value));
      this.settings.volume[key] = value;

      // Update slider visuals
      var slider = this.sliders[key];
      if (slider) {
        var fillWidth = PANEL.sliderWidth * value;
        slider.fill.setAttribute('width', Math.max(0.001, fillWidth));
        slider.fill.setAttribute('position', {
          x: -PANEL.sliderWidth / 2 + fillWidth / 2,
          y: 0,
          z: 0.001
        });
        slider.handle.setAttribute('position', {
          x: -PANEL.sliderWidth / 2 + fillWidth,
          y: 0,
          z: 0.002
        });
        slider.valueText.setAttribute('value', Math.round(value * 100) + '%');
      }

      // Apply to AudioManager
      if (window.AudioManager) {
        if (key === 'master') {
          AudioManager.setMasterVolume(value);
        } else {
          AudioManager.setVolume(key, value);
        }
      }

      // Haptic feedback
      if (window.Haptics) {
        Haptics.light('right');
      }

      this.saveSettings();
      this.el.emit('settings-changed', { type: 'volume', key: key, value: value });
    },

    setSnapTurnAngle: function(angle) {
      this.settings.comfort.snapTurnAngle = angle;

      // Update button visuals
      var buttons = this.menuEl.querySelectorAll('.settings-angle-btn');
      buttons.forEach(function(btn) {
        var btnAngle = parseInt(btn.getAttribute('data-angle'));
        btn.setAttribute('material', 'color',
          btnAngle === angle ? COLORS.buttonActive : COLORS.buttonBg
        );
      });

      // Apply to SnapTurn
      if (window.SnapTurn) {
        SnapTurn.setAngle(angle);
      }

      // Haptic feedback
      if (window.Haptics) {
        Haptics.medium('right');
      }

      this.saveSettings();
      this.el.emit('settings-changed', { type: 'comfort', key: 'snapTurnAngle', value: angle });
    },

    toggleVignette: function() {
      var enabled = !this.settings.comfort.vignetteEnabled;
      this.settings.comfort.vignetteEnabled = enabled;

      // Update toggle visuals
      if (this.vignetteToggle) {
        this.vignetteToggle.el.setAttribute('material', 'color',
          enabled ? COLORS.toggleOn : COLORS.toggleOff
        );
        this.vignetteToggle.indicator.setAttribute('position', {
          x: enabled ? 0.03 : -0.03,
          y: 0,
          z: 0.001
        });
        this.vignetteToggle.label.setAttribute('value', enabled ? 'ON' : 'OFF');
      }

      // Apply to Vignette
      if (window.Vignette) {
        if (enabled) {
          Vignette.enable();
        } else {
          Vignette.disable();
        }
      }

      // Haptic feedback
      if (window.Haptics) {
        Haptics.medium('right');
      }

      this.saveSettings();
      this.el.emit('settings-changed', { type: 'comfort', key: 'vignetteEnabled', value: enabled });
    },

    onTriggerDown: function(evt) {
      // Could be used for slider dragging in future
    },

    onTriggerUp: function(evt) {
      this.activeSlider = null;
    },

    onControllerMove: function(evt) {
      // Could be used for slider dragging in future
    },

    open: function() {
      if (this.isMenuOpen) return;
      this.isMenuOpen = true;

      if (this.menuEl) {
        this.menuEl.setAttribute('visible', true);
      }

      // Haptic feedback
      if (window.Haptics) {
        Haptics.light('both');
      }

      this.el.emit('settings-menu-opened');
      console.log('[SettingsMenu] Opened');
    },

    close: function() {
      if (!this.isMenuOpen) return;
      this.isMenuOpen = false;

      if (this.menuEl) {
        this.menuEl.setAttribute('visible', false);
      }

      // Haptic feedback
      if (window.Haptics) {
        Haptics.light('both');
      }

      this.el.emit('settings-menu-closed');
      console.log('[SettingsMenu] Closed');
    },

    toggle: function() {
      if (this.isMenuOpen) {
        this.close();
      } else {
        this.open();
      }
    },

    loadSettings: function() {
      try {
        var stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          var parsed = JSON.parse(stored);
          // Merge with defaults to handle missing keys
          return {
            volume: Object.assign({}, DEFAULT_SETTINGS.volume, parsed.volume || {}),
            comfort: Object.assign({}, DEFAULT_SETTINGS.comfort, parsed.comfort || {})
          };
        }
      } catch (e) {
        console.warn('[SettingsMenu] Failed to load settings:', e.message);
      }
      return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    },

    saveSettings: function() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      } catch (e) {
        console.warn('[SettingsMenu] Failed to save settings:', e.message);
      }
    },

    applySettings: function() {
      // Apply volume settings
      if (window.AudioManager) {
        AudioManager.setMasterVolume(this.settings.volume.master);
        AudioManager.setVolume('action', this.settings.volume.action);
        AudioManager.setVolume('ambient', this.settings.volume.ambient);
        AudioManager.setVolume('ui', this.settings.volume.ui);
      }

      // Apply comfort settings
      if (window.SnapTurn) {
        SnapTurn.setAngle(this.settings.comfort.snapTurnAngle);
      }

      if (window.Vignette) {
        if (this.settings.comfort.vignetteEnabled) {
          Vignette.enable();
        } else {
          Vignette.disable();
        }
      }

      console.log('[SettingsMenu] Settings applied:', this.settings);
    },

    getSettings: function() {
      return JSON.parse(JSON.stringify(this.settings));
    },

    resetToDefaults: function() {
      this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      this.saveSettings();
      this.applySettings();

      // Update UI
      var self = this;
      Object.keys(this.sliders).forEach(function(key) {
        self.setVolume(key, DEFAULT_SETTINGS.volume[key]);
      });
      this.setSnapTurnAngle(DEFAULT_SETTINGS.comfort.snapTurnAngle);
      if (this.settings.comfort.vignetteEnabled !== DEFAULT_SETTINGS.comfort.vignetteEnabled) {
        this.toggleVignette();
      }

      this.el.emit('settings-reset');
      console.log('[SettingsMenu] Reset to defaults');
    },

    remove: function() {
      // Remove controller listeners
      var buttonEvent = this.getButtonEvent();
      if (this.leftController) {
        this.leftController.removeEventListener(buttonEvent, this.onMenuButtonPress);
        this.leftController.removeEventListener('triggerdown', this.onTriggerDown);
        this.leftController.removeEventListener('triggerup', this.onTriggerUp);
      }
      if (this.rightController) {
        this.rightController.removeEventListener(buttonEvent, this.onMenuButtonPress);
        this.rightController.removeEventListener('triggerdown', this.onTriggerDown);
        this.rightController.removeEventListener('triggerup', this.onTriggerUp);
      }

      // Remove menu element
      if (this.menuEl && this.menuEl.parentNode) {
        this.menuEl.parentNode.removeChild(this.menuEl);
      }

      this.menuEl = null;
      this.sliders = {};
    }
  });

  // Global SettingsMenu API
  window.SettingsMenu = {
    /**
     * Open the settings menu.
     */
    open: function() {
      var el = document.querySelector('[settings-menu]');
      if (el && el.components['settings-menu']) {
        el.components['settings-menu'].open();
      } else {
        console.warn('[SettingsMenu] No settings-menu component found');
      }
    },

    /**
     * Close the settings menu.
     */
    close: function() {
      var el = document.querySelector('[settings-menu]');
      if (el && el.components['settings-menu']) {
        el.components['settings-menu'].close();
      }
    },

    /**
     * Toggle the settings menu.
     */
    toggle: function() {
      var el = document.querySelector('[settings-menu]');
      if (el && el.components['settings-menu']) {
        el.components['settings-menu'].toggle();
      }
    },

    /**
     * Check if settings menu is open.
     * @returns {boolean}
     */
    isOpen: function() {
      var el = document.querySelector('[settings-menu]');
      if (el && el.components['settings-menu']) {
        return el.components['settings-menu'].isMenuOpen;
      }
      return false;
    },

    /**
     * Get current settings.
     * @returns {Object|null}
     */
    getSettings: function() {
      var el = document.querySelector('[settings-menu]');
      if (el && el.components['settings-menu']) {
        return el.components['settings-menu'].getSettings();
      }
      return null;
    },

    /**
     * Reset settings to defaults.
     */
    resetToDefaults: function() {
      var el = document.querySelector('[settings-menu]');
      if (el && el.components['settings-menu']) {
        el.components['settings-menu'].resetToDefaults();
      }
    }
  };

  console.log('[SettingsMenu] Module loaded');
})();
