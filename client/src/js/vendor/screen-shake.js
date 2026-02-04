/**
 * Screen Shake Component - Impact feedback for VR games
 * Usage: <script src="/framework/vfx/screen-shake.js"></script>
 *
 * Attach to player rig: <a-entity id="player-rig" screen-shake>
 * Trigger shake: document.getElementById('player-rig').components['screen-shake'].shake()
 *
 * Or use with custom settings:
 * <a-entity id="player-rig" screen-shake="intensity: 0.5; duration: 300">
 */
AFRAME.registerComponent('screen-shake', {
  schema: {
    intensity: { type: 'number', default: 0.1 },  // 0-1 scale, affects displacement
    duration: { type: 'number', default: 200 },   // ms
    enabled: { type: 'boolean', default: true }   // accessibility toggle
  },

  init: function() {
    this.originalPosition = new THREE.Vector3();
    this.isShaking = false;
    this.shakeStartTime = 0;
    this.currentIntensity = 0;
    this.currentDuration = 0;
  },

  /**
   * Trigger a screen shake effect.
   * @param {number} [intensity] - Override intensity (0-1)
   * @param {number} [duration] - Override duration (ms)
   */
  shake: function(intensity, duration) {
    if (!this.data.enabled) return;
    if (this.isShaking) return;

    this.currentIntensity = typeof intensity === 'number' ? intensity : this.data.intensity;
    this.currentDuration = typeof duration === 'number' ? duration : this.data.duration;

    // Clamp intensity to 0-1 range
    this.currentIntensity = Math.max(0, Math.min(1, this.currentIntensity));

    // Store original position
    this.originalPosition.copy(this.el.object3D.position);
    this.shakeStartTime = performance.now();
    this.isShaking = true;
  },

  tick: function(time, delta) {
    if (!this.isShaking) return;

    var elapsed = performance.now() - this.shakeStartTime;
    var progress = elapsed / this.currentDuration;

    if (progress >= 1) {
      // Shake complete - restore exact original position
      this.el.object3D.position.copy(this.originalPosition);
      this.isShaking = false;
      return;
    }

    // Decay factor for smooth fade-out
    var decay = 1 - progress;

    // Oscillation frequency (higher = more rapid shake)
    var frequency = 30;
    var oscillation = Math.sin(elapsed * frequency * 0.001 * Math.PI * 2);

    // Calculate displacement (scaled by intensity and decay)
    var maxDisplacement = this.currentIntensity * 0.15;  // Max 0.15 units at intensity=1
    var displacement = oscillation * maxDisplacement * decay;

    // Apply shake offset from original position
    this.el.object3D.position.x = this.originalPosition.x + displacement;
    this.el.object3D.position.y = this.originalPosition.y + (displacement * 0.5);  // Less vertical
  },

  /**
   * Enable screen shake effects.
   */
  enable: function() {
    this.el.setAttribute('screen-shake', 'enabled', true);
  },

  /**
   * Disable screen shake effects (accessibility).
   */
  disable: function() {
    this.el.setAttribute('screen-shake', 'enabled', false);
    // If currently shaking, restore position immediately
    if (this.isShaking) {
      this.el.object3D.position.copy(this.originalPosition);
      this.isShaking = false;
    }
  }
});

// Expose global helper for easy triggering
window.ScreenShake = {
  /**
   * Trigger shake on the player rig.
   * @param {number} [intensity] - 0-1 scale
   * @param {number} [duration] - ms
   */
  trigger: function(intensity, duration) {
    var rig = document.getElementById('player-rig');
    if (rig && rig.components['screen-shake']) {
      rig.components['screen-shake'].shake(intensity, duration);
    }
  },

  /**
   * Enable screen shake (accessibility).
   */
  enable: function() {
    var rig = document.getElementById('player-rig');
    if (rig && rig.components['screen-shake']) {
      rig.components['screen-shake'].enable();
    }
  },

  /**
   * Disable screen shake (accessibility).
   */
  disable: function() {
    var rig = document.getElementById('player-rig');
    if (rig && rig.components['screen-shake']) {
      rig.components['screen-shake'].disable();
    }
  }
};
