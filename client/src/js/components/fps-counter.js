/**
 * FPS Counter Component - V41
 * Displays real-time FPS on HUD and logs to console for Quest debugging
 *
 * Usage: Add to camera or any entity: fps-counter="logInterval: 5"
 */
AFRAME.registerComponent('fps-counter', {
  schema: {
    logInterval: { type: 'number', default: 5 }, // Log to console every N seconds
    showOnScreen: { type: 'boolean', default: true }
  },

  init: function() {
    // Pre-allocate for GC-free tick
    this._frameCount = 0;
    this._lastTime = performance.now();
    this._fps = 0;
    this._minFps = 999;
    this._maxFps = 0;
    this._avgFps = 0;
    this._fpsHistory = [];
    this._historySize = 60; // Track last 60 samples
    this._lastLogTime = performance.now();
    this._lastDisplayTime = 0;

    // Create HUD display if enabled
    if (this.data.showOnScreen) {
      this._createDisplay();
    }

    console.log('[V41] FPS Counter initialized - logging every ' + this.data.logInterval + 's');
  },

  _createDisplay: function() {
    // Find camera to attach HUD
    var camera = document.getElementById('camera');
    if (!camera) {
      camera = document.querySelector('a-camera');
    }
    if (!camera) {
      console.warn('[FPS] No camera found, attaching to self');
      camera = this.el;
    }

    // Create FPS text element
    this._fpsText = document.createElement('a-text');
    this._fpsText.setAttribute('id', 'hud-fps');
    this._fpsText.setAttribute('value', 'FPS: --');
    this._fpsText.setAttribute('position', '0.45 0.35 -1');
    this._fpsText.setAttribute('scale', '0.25 0.25 0.25');
    this._fpsText.setAttribute('color', '#00ffff');
    this._fpsText.setAttribute('font', 'mozillavr');
    this._fpsText.setAttribute('align', 'right');
    camera.appendChild(this._fpsText);

    // Create min/max/avg display below FPS
    this._statsText = document.createElement('a-text');
    this._statsText.setAttribute('id', 'hud-fps-stats');
    this._statsText.setAttribute('value', 'min/avg/max: --');
    this._statsText.setAttribute('position', '0.45 0.40 -1');
    this._statsText.setAttribute('scale', '0.15 0.15 0.15');
    this._statsText.setAttribute('color', '#888888');
    this._statsText.setAttribute('font', 'mozillavr');
    this._statsText.setAttribute('align', 'right');
    camera.appendChild(this._statsText);
  },

  tick: function(time, delta) {
    this._frameCount++;

    var now = performance.now();
    var elapsed = now - this._lastTime;

    // Update FPS calculation every 500ms
    if (elapsed >= 500) {
      this._fps = Math.round((this._frameCount * 1000) / elapsed);
      this._frameCount = 0;
      this._lastTime = now;

      // Track min/max
      if (this._fps > 0 && this._fps < 200) { // Filter outliers
        if (this._fps < this._minFps) this._minFps = this._fps;
        if (this._fps > this._maxFps) this._maxFps = this._fps;

        // Rolling average
        this._fpsHistory.push(this._fps);
        if (this._fpsHistory.length > this._historySize) {
          this._fpsHistory.shift();
        }
        var sum = 0;
        for (var i = 0; i < this._fpsHistory.length; i++) {
          sum += this._fpsHistory[i];
        }
        this._avgFps = Math.round(sum / this._fpsHistory.length);
      }

      // Update display
      if (this._fpsText && now - this._lastDisplayTime > 200) {
        this._lastDisplayTime = now;
        var color = this._fps >= 72 ? '#00ff00' : (this._fps >= 60 ? '#ffff00' : '#ff0000');
        this._fpsText.setAttribute('value', 'FPS: ' + this._fps);
        this._fpsText.setAttribute('color', color);
        this._statsText.setAttribute('value', 'min/avg/max: ' + this._minFps + '/' + this._avgFps + '/' + this._maxFps);
      }
    }

    // Log to console at interval
    var logInterval = this.data.logInterval * 1000;
    if (now - this._lastLogTime >= logInterval) {
      this._lastLogTime = now;
      console.log('[FPS] Current: ' + this._fps + ' | Min: ' + this._minFps + ' | Avg: ' + this._avgFps + ' | Max: ' + this._maxFps);
    }
  },

  remove: function() {
    if (this._fpsText && this._fpsText.parentNode) {
      this._fpsText.parentNode.removeChild(this._fpsText);
    }
    if (this._statsText && this._statsText.parentNode) {
      this._statsText.parentNode.removeChild(this._statsText);
    }
  }
});
