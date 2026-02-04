/**
 * Movement Vignette - Comfort overlay for VR locomotion
 * Usage: <script src="/framework/locomotion/vignette.js"></script>
 *
 * Attach to camera entity:
 *   <a-camera movement-vignette="intensity: 0.8; radius: 0.4">
 *
 * Schema options:
 *   intensity: Darkness of vignette edge (0-1, default: 0.7)
 *   radius: Size of clear center area (0-1, default: 0.4). Lower = more coverage
 *   fadeTime: Fade in/out duration in ms (default: 100)
 *   enabled: Enable/disable component (default: true)
 *
 * To trigger vignette during movement:
 *   Vignette.show()   - Fade in vignette
 *   Vignette.hide()   - Fade out vignette
 *
 * Global API:
 *   Vignette.enable()       - Enable vignette system
 *   Vignette.disable()      - Disable vignette system (accessibility)
 *   Vignette.show()         - Show vignette with fade-in
 *   Vignette.hide()         - Hide vignette with fade-out
 *   Vignette.isEnabled()    - Check if enabled
 *   Vignette.isVisible()    - Check if currently showing
 *   Vignette.setIntensity() - Change intensity (0-1)
 *   Vignette.setRadius()    - Change radius (0-1)
 */
(function() {
  'use strict';

  // Guard against A-Frame not loaded
  if (typeof AFRAME === 'undefined') {
    console.error('[Vignette] A-Frame not found. Load A-Frame before vignette.js');
    return;
  }

  var DEFAULTS = {
    intensity: 0.7,
    radius: 0.4,
    fadeTime: 100
  };

  AFRAME.registerComponent('movement-vignette', {
    schema: {
      intensity: { type: 'number', default: DEFAULTS.intensity },
      radius: { type: 'number', default: DEFAULTS.radius },
      fadeTime: { type: 'number', default: DEFAULTS.fadeTime },
      enabled: { type: 'boolean', default: true }
    },

    init: function() {
      this.overlayEl = null;
      this.isShowing = false;
      this.fadeAnimation = null;
      this.currentOpacity = 0;

      this.createOverlay();
      console.log('[Vignette] Component initialized');
    },

    createOverlay: function() {
      // Create HUD plane for vignette overlay
      this.overlayEl = document.createElement('a-entity');
      this.overlayEl.setAttribute('id', 'vignette-overlay');

      // Position in front of camera as HUD element
      this.overlayEl.setAttribute('position', '0 0 -0.5');

      // Create geometry - plane that fills FOV
      this.overlayEl.setAttribute('geometry', {
        primitive: 'plane',
        width: 2,
        height: 2
      });

      // Create custom shader material for radial gradient
      this.overlayEl.setAttribute('material', {
        shader: 'flat',
        color: '#000000',
        transparent: true,
        opacity: 0,
        side: 'double',
        depthTest: false
      });

      // Apply custom vignette shader after entity loads
      var self = this;
      this.overlayEl.addEventListener('loaded', function() {
        self.applyVignetteShader();
      });

      // Append to camera
      this.el.appendChild(this.overlayEl);
    },

    applyVignetteShader: function() {
      var mesh = this.overlayEl.getObject3D('mesh');
      if (!mesh) return;

      // Custom shader for radial vignette gradient
      var vertexShader = [
        'varying vec2 vUv;',
        'void main() {',
        '  vUv = uv;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n');

      var fragmentShader = [
        'uniform float intensity;',
        'uniform float radius;',
        'uniform float opacity;',
        'varying vec2 vUv;',
        'void main() {',
        '  vec2 center = vec2(0.5, 0.5);',
        '  float dist = distance(vUv, center);',
        '  float vignette = smoothstep(radius, 1.0, dist * 2.0);',
        '  float alpha = vignette * intensity * opacity;',
        '  gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);',
        '}'
      ].join('\n');

      this.vignetteMaterial = new THREE.ShaderMaterial({
        uniforms: {
          intensity: { value: this.data.intensity },
          radius: { value: this.data.radius },
          opacity: { value: 0 }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        transparent: true,
        depthTest: false,
        depthWrite: false
      });

      mesh.material = this.vignetteMaterial;
      mesh.renderOrder = 9999; // Render on top
    },

    update: function(oldData) {
      if (!this.vignetteMaterial) return;

      // Update shader uniforms
      if (oldData.intensity !== this.data.intensity) {
        this.vignetteMaterial.uniforms.intensity.value = this.clamp(this.data.intensity, 0, 1);
      }

      if (oldData.radius !== this.data.radius) {
        this.vignetteMaterial.uniforms.radius.value = this.clamp(this.data.radius, 0, 1);
      }
    },

    /**
     * Show vignette with fade-in animation.
     */
    show: function() {
      if (!this.data.enabled) return;
      if (this.isShowing) return;

      this.isShowing = true;
      this.startFade(1);

      this.el.emit('vignette-show', {
        intensity: this.data.intensity,
        radius: this.data.radius
      });
    },

    /**
     * Hide vignette with fade-out animation.
     */
    hide: function() {
      if (!this.isShowing) return;

      this.isShowing = false;
      this.startFade(0);

      this.el.emit('vignette-hide');
    },

    startFade: function(targetOpacity) {
      // Cancel any existing animation
      if (this.fadeAnimation) {
        cancelAnimationFrame(this.fadeAnimation);
        this.fadeAnimation = null;
      }

      var self = this;
      var startOpacity = this.currentOpacity;
      var startTime = performance.now();
      var duration = this.data.fadeTime;

      function animate(currentTime) {
        var elapsed = currentTime - startTime;
        var progress = Math.min(elapsed / duration, 1);

        // Ease-out curve for smooth fade
        var eased = 1 - Math.pow(1 - progress, 2);

        self.currentOpacity = startOpacity + (targetOpacity - startOpacity) * eased;

        if (self.vignetteMaterial) {
          self.vignetteMaterial.uniforms.opacity.value = self.currentOpacity;
        }

        if (progress < 1) {
          self.fadeAnimation = requestAnimationFrame(animate);
        } else {
          self.fadeAnimation = null;
        }
      }

      this.fadeAnimation = requestAnimationFrame(animate);
    },

    /**
     * Set intensity (0-1).
     * @param {number} value
     */
    setIntensity: function(value) {
      this.el.setAttribute('movement-vignette', 'intensity', this.clamp(value, 0, 1));
    },

    /**
     * Set radius (0-1). Lower values = more vignette coverage.
     * @param {number} value
     */
    setRadius: function(value) {
      this.el.setAttribute('movement-vignette', 'radius', this.clamp(value, 0, 1));
    },

    /**
     * Enable vignette system.
     */
    enable: function() {
      this.el.setAttribute('movement-vignette', 'enabled', true);
    },

    /**
     * Disable vignette system (accessibility).
     */
    disable: function() {
      this.el.setAttribute('movement-vignette', 'enabled', false);

      // Hide immediately if showing
      if (this.isShowing) {
        this.isShowing = false;
        if (this.fadeAnimation) {
          cancelAnimationFrame(this.fadeAnimation);
          this.fadeAnimation = null;
        }
        this.currentOpacity = 0;
        if (this.vignetteMaterial) {
          this.vignetteMaterial.uniforms.opacity.value = 0;
        }
      }
    },

    /**
     * Check if currently visible.
     * @returns {boolean}
     */
    isVisible: function() {
      return this.isShowing;
    },

    clamp: function(value, min, max) {
      return Math.max(min, Math.min(max, value));
    },

    remove: function() {
      if (this.fadeAnimation) {
        cancelAnimationFrame(this.fadeAnimation);
        this.fadeAnimation = null;
      }

      if (this.overlayEl && this.overlayEl.parentNode) {
        this.overlayEl.parentNode.removeChild(this.overlayEl);
      }

      this.vignetteMaterial = null;
      this.overlayEl = null;
    }
  });

  // Global Vignette API
  window.Vignette = {
    /**
     * Enable vignette on all components.
     */
    enable: function() {
      var els = document.querySelectorAll('[movement-vignette]');
      els.forEach(function(el) {
        var comp = el.components['movement-vignette'];
        if (comp) comp.enable();
      });
    },

    /**
     * Disable vignette on all components (accessibility).
     */
    disable: function() {
      var els = document.querySelectorAll('[movement-vignette]');
      els.forEach(function(el) {
        var comp = el.components['movement-vignette'];
        if (comp) comp.disable();
      });
    },

    /**
     * Show vignette with fade-in.
     */
    show: function() {
      var els = document.querySelectorAll('[movement-vignette]');
      els.forEach(function(el) {
        var comp = el.components['movement-vignette'];
        if (comp) comp.show();
      });
    },

    /**
     * Hide vignette with fade-out.
     */
    hide: function() {
      var els = document.querySelectorAll('[movement-vignette]');
      els.forEach(function(el) {
        var comp = el.components['movement-vignette'];
        if (comp) comp.hide();
      });
    },

    /**
     * Check if vignette is enabled.
     * @returns {boolean}
     */
    isEnabled: function() {
      var els = document.querySelectorAll('[movement-vignette]');
      for (var i = 0; i < els.length; i++) {
        var comp = els[i].components['movement-vignette'];
        if (comp && comp.data.enabled) return true;
      }
      return false;
    },

    /**
     * Check if vignette is currently visible.
     * @returns {boolean}
     */
    isVisible: function() {
      var els = document.querySelectorAll('[movement-vignette]');
      for (var i = 0; i < els.length; i++) {
        var comp = els[i].components['movement-vignette'];
        if (comp && comp.isVisible()) return true;
      }
      return false;
    },

    /**
     * Set intensity for all vignette components.
     * @param {number} value - 0-1
     */
    setIntensity: function(value) {
      if (typeof value !== 'number') {
        console.error('[Vignette] setIntensity requires a number');
        return;
      }

      var els = document.querySelectorAll('[movement-vignette]');
      els.forEach(function(el) {
        var comp = el.components['movement-vignette'];
        if (comp) comp.setIntensity(value);
      });
    },

    /**
     * Set radius for all vignette components.
     * @param {number} value - 0-1 (lower = more coverage)
     */
    setRadius: function(value) {
      if (typeof value !== 'number') {
        console.error('[Vignette] setRadius requires a number');
        return;
      }

      var els = document.querySelectorAll('[movement-vignette]');
      els.forEach(function(el) {
        var comp = el.components['movement-vignette'];
        if (comp) comp.setRadius(value);
      });
    }
  };

  console.log('[Vignette] Module loaded');
})();
