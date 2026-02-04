/**
 * Pointer Highlight - Visual feedback for VR hover interactions
 * Usage: <script src="/framework/utils/haptics.js"></script>
 *        <script src="/framework/interaction/pointer-highlight.js"></script>
 *
 * Mark entities for highlight:
 *   <a-box highlightable></a-box>
 *   <a-sphere highlightable="effect: glow; intensity: 0.3"></a-sphere>
 *
 * Effect options:
 *   - scale (default): Grows entity on hover
 *   - glow: Adds emissive glow
 *   - outline: Changes color to highlight color
 *
 * Global API:
 *   PointerHighlight.enable();      // Enable system
 *   PointerHighlight.disable();     // Disable system
 *   PointerHighlight.setEffect('glow');  // Change default effect
 */
(function() {
  'use strict';

  // Transition timing
  var TRANSITION_MS = 100;

  // System state
  var systemEnabled = true;
  var defaultEffect = 'scale';

  /**
   * Highlightable component - attach to entities for hover feedback
   */
  AFRAME.registerComponent('highlightable', {
    schema: {
      effect: { type: 'string', default: 'scale' },      // scale, glow, outline
      scale: { type: 'number', default: 1.1 },           // Scale multiplier for 'scale' effect
      glowColor: { type: 'color', default: '#ffffff' },  // Emissive color for 'glow' effect
      glowIntensity: { type: 'number', default: 0.3 },   // Emissive intensity (0-1)
      outlineColor: { type: 'color', default: '#ffff00' }, // Color for 'outline' effect
      haptics: { type: 'boolean', default: true },       // Trigger haptic on hover
      enabled: { type: 'boolean', default: true }        // Per-entity toggle
    },

    init: function() {
      this.isHovered = false;
      this.hoverProgress = 0;  // 0 = not hovered, 1 = fully hovered
      this.hoverHand = null;

      // Store original values for restoration
      this.originalScale = new THREE.Vector3();
      this.originalScale.copy(this.el.object3D.scale);
      this.originalEmissive = null;
      this.originalEmissiveIntensity = 0;
      this.originalColor = null;

      // Pre-allocate temp vectors
      this.targetScale = new THREE.Vector3();
      this.tempColor = new THREE.Color();

      // Bind methods
      this.onMouseEnter = this.onMouseEnter.bind(this);
      this.onMouseLeave = this.onMouseLeave.bind(this);

      // Setup event listeners
      this.el.addEventListener('mouseenter', this.onMouseEnter);
      this.el.addEventListener('mouseleave', this.onMouseLeave);

      // Store original material properties on first hover
      this.materialsStored = false;
    },

    remove: function() {
      this.el.removeEventListener('mouseenter', this.onMouseEnter);
      this.el.removeEventListener('mouseleave', this.onMouseLeave);

      // Restore original state if hovered
      if (this.isHovered) {
        this.restoreOriginal();
      }
    },

    storeOriginalMaterial: function() {
      if (this.materialsStored) return;

      var mesh = this.el.getObject3D('mesh');
      if (!mesh || !mesh.material) return;

      var material = mesh.material;

      // Store emissive properties
      if (material.emissive) {
        this.originalEmissive = material.emissive.clone();
        this.originalEmissiveIntensity = material.emissiveIntensity || 0;
      }

      // Store color
      if (material.color) {
        this.originalColor = material.color.clone();
      }

      this.materialsStored = true;
    },

    onMouseEnter: function(evt) {
      if (!systemEnabled || !this.data.enabled) return;
      if (this.isHovered) return;

      this.isHovered = true;
      this.hoverHand = this.detectHand(evt);

      // Store material properties on first hover
      this.storeOriginalMaterial();

      // Haptic feedback
      if (this.data.haptics && window.Haptics) {
        Haptics.light(this.hoverHand || 'right');
      }

      this.el.emit('highlight-start', {
        hand: this.hoverHand,
        effect: this.data.effect
      });
    },

    onMouseLeave: function(evt) {
      if (!this.isHovered) return;

      this.isHovered = false;

      this.el.emit('highlight-end', {
        hand: this.hoverHand,
        effect: this.data.effect
      });

      this.hoverHand = null;
    },

    detectHand: function(evt) {
      // Try to determine which hand triggered the event
      if (evt.detail && evt.detail.cursorEl) {
        var cursorEl = evt.detail.cursorEl;
        if (cursorEl.id === 'left-hand') return 'left';
        if (cursorEl.id === 'right-hand') return 'right';

        // Check laser-controls
        var laserControls = cursorEl.getAttribute('laser-controls');
        if (laserControls && laserControls.hand) {
          return laserControls.hand;
        }
      }

      // Default to right hand for cursor
      return 'right';
    },

    tick: function(time, delta) {
      if (!systemEnabled || !this.data.enabled) return;

      // Update hover progress with smooth transition
      var targetProgress = this.isHovered ? 1 : 0;
      var step = (delta / TRANSITION_MS);

      if (this.hoverProgress < targetProgress) {
        this.hoverProgress = Math.min(targetProgress, this.hoverProgress + step);
      } else if (this.hoverProgress > targetProgress) {
        this.hoverProgress = Math.max(targetProgress, this.hoverProgress - step);
      }

      // Apply effect based on progress
      if (this.hoverProgress > 0 || this.isHovered) {
        this.applyEffect(this.hoverProgress);
      }
    },

    applyEffect: function(progress) {
      var effect = this.data.effect || defaultEffect;

      switch (effect) {
        case 'scale':
          this.applyScaleEffect(progress);
          break;
        case 'glow':
          this.applyGlowEffect(progress);
          break;
        case 'outline':
          this.applyOutlineEffect(progress);
          break;
        default:
          this.applyScaleEffect(progress);
      }
    },

    applyScaleEffect: function(progress) {
      var scaleFactor = 1 + (this.data.scale - 1) * progress;

      this.targetScale.set(
        this.originalScale.x * scaleFactor,
        this.originalScale.y * scaleFactor,
        this.originalScale.z * scaleFactor
      );

      this.el.object3D.scale.copy(this.targetScale);
    },

    applyGlowEffect: function(progress) {
      var mesh = this.el.getObject3D('mesh');
      if (!mesh || !mesh.material) return;

      var material = mesh.material;
      if (!material.emissive) return;

      // Lerp emissive color
      this.tempColor.set(this.data.glowColor);
      var targetIntensity = this.data.glowIntensity * progress;

      if (this.originalEmissive) {
        material.emissive.copy(this.originalEmissive);
        material.emissive.lerp(this.tempColor, progress);
      } else {
        material.emissive.set(0, 0, 0);
        material.emissive.lerp(this.tempColor, progress);
      }

      material.emissiveIntensity = this.originalEmissiveIntensity +
        (targetIntensity - this.originalEmissiveIntensity) * progress;
    },

    applyOutlineEffect: function(progress) {
      var mesh = this.el.getObject3D('mesh');
      if (!mesh || !mesh.material) return;

      var material = mesh.material;
      if (!material.color || !this.originalColor) return;

      // Lerp to outline color
      this.tempColor.set(this.data.outlineColor);
      material.color.copy(this.originalColor);
      material.color.lerp(this.tempColor, progress * 0.5);  // 50% blend max
    },

    restoreOriginal: function() {
      // Restore scale
      this.el.object3D.scale.copy(this.originalScale);

      // Restore material
      var mesh = this.el.getObject3D('mesh');
      if (mesh && mesh.material) {
        var material = mesh.material;

        if (this.originalEmissive && material.emissive) {
          material.emissive.copy(this.originalEmissive);
          material.emissiveIntensity = this.originalEmissiveIntensity;
        }

        if (this.originalColor && material.color) {
          material.color.copy(this.originalColor);
        }
      }

      this.hoverProgress = 0;
    },

    /**
     * Force highlight on (for programmatic control).
     */
    highlight: function() {
      if (!this.isHovered) {
        this.isHovered = true;
        this.storeOriginalMaterial();
        this.el.emit('highlight-start', { effect: this.data.effect });
      }
    },

    /**
     * Force highlight off (for programmatic control).
     */
    unhighlight: function() {
      if (this.isHovered) {
        this.isHovered = false;
        this.el.emit('highlight-end', { effect: this.data.effect });
      }
    }
  });

  /**
   * Global PointerHighlight API
   */
  window.PointerHighlight = {
    /**
     * Enable the highlight system.
     */
    enable: function() {
      systemEnabled = true;
      console.log('[PointerHighlight] System enabled');
    },

    /**
     * Disable the highlight system.
     */
    disable: function() {
      systemEnabled = false;
      console.log('[PointerHighlight] System disabled');
    },

    /**
     * Check if system is enabled.
     * @returns {boolean}
     */
    isEnabled: function() {
      return systemEnabled;
    },

    /**
     * Set default effect for all highlightable entities.
     * @param {string} effect - 'scale', 'glow', or 'outline'
     */
    setEffect: function(effect) {
      if (['scale', 'glow', 'outline'].indexOf(effect) !== -1) {
        defaultEffect = effect;
        console.log('[PointerHighlight] Default effect set to: ' + effect);
      }
    },

    /**
     * Get the current default effect.
     * @returns {string}
     */
    getEffect: function() {
      return defaultEffect;
    },

    /**
     * Highlight a specific entity programmatically.
     * @param {Element|string} el - Entity or selector
     */
    highlight: function(el) {
      if (typeof el === 'string') {
        el = document.querySelector(el);
      }
      if (el && el.components && el.components.highlightable) {
        el.components.highlightable.highlight();
      }
    },

    /**
     * Remove highlight from a specific entity.
     * @param {Element|string} el - Entity or selector
     */
    unhighlight: function(el) {
      if (typeof el === 'string') {
        el = document.querySelector(el);
      }
      if (el && el.components && el.components.highlightable) {
        el.components.highlightable.unhighlight();
      }
    },

    /**
     * Remove all active highlights.
     */
    unhighlightAll: function() {
      var highlighted = document.querySelectorAll('[highlightable]');
      for (var i = 0; i < highlighted.length; i++) {
        var comp = highlighted[i].components.highlightable;
        if (comp && comp.isHovered) {
          comp.unhighlight();
        }
      }
    }
  };

  console.log('[PointerHighlight] Module loaded');
})();
