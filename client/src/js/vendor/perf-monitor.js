/**
 * Performance Monitor Overlay - FPS, draw calls, and memory stats for Quest debugging
 * Usage: <script src="/framework/debug/perf-monitor.js"></script>
 *
 * Attach to camera: <a-camera perf-monitor>
 * Or with options: <a-camera perf-monitor="visible: true; warnThreshold: 30">
 *
 * Global API:
 *   PerfMonitor.show()
 *   PerfMonitor.hide()
 *   PerfMonitor.toggle()
 */
AFRAME.registerComponent('perf-monitor', {
  schema: {
    visible: { type: 'boolean', default: true },
    warnThreshold: { type: 'number', default: 30 },
    position: { type: 'vec3', default: { x: -0.3, y: 0.2, z: -0.5 } },
    updateInterval: { type: 'number', default: 250 }
  },

  init: function() {
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.lastUpdate = 0;
    this.fps = 0;
    this.frameTime = 0;
    this.drawCalls = 0;
    this.triangles = 0;
    this.warned = false;

    this.createOverlay();
    this.bindKeyToggle();
  },

  createOverlay: function() {
    var container = document.createElement('a-entity');
    container.setAttribute('id', 'perf-monitor-overlay');
    container.setAttribute('position', this.data.position);
    container.setAttribute('visible', this.data.visible);

    var bg = document.createElement('a-plane');
    bg.setAttribute('width', 0.22);
    bg.setAttribute('height', 0.12);
    bg.setAttribute('color', '#111');
    bg.setAttribute('opacity', 0.8);
    bg.setAttribute('position', '0 0 0.001');
    container.appendChild(bg);

    this.fpsText = this.createText('FPS: --', 0.04, '#0f0');
    this.frameTimeText = this.createText('Frame: -- ms', 0.015, '#fff');
    this.drawCallsText = this.createText('Draws: --', -0.01, '#fff');
    this.trianglesText = this.createText('Tris: --', -0.035, '#fff');

    container.appendChild(this.fpsText);
    container.appendChild(this.frameTimeText);
    container.appendChild(this.drawCallsText);
    container.appendChild(this.trianglesText);

    this.overlay = container;
    this.el.appendChild(container);
  },

  createText: function(value, yPos, color) {
    var text = document.createElement('a-text');
    text.setAttribute('value', value);
    text.setAttribute('align', 'center');
    text.setAttribute('width', 0.4);
    text.setAttribute('color', color);
    text.setAttribute('position', '0 ' + yPos + ' 0.002');
    return text;
  },

  bindKeyToggle: function() {
    var self = this;
    document.addEventListener('keydown', function(e) {
      if (e.key === 'p' && e.ctrlKey) {
        e.preventDefault();
        self.toggle();
      }
    });
  },

  tick: function(time, delta) {
    this.frameCount++;
    var now = performance.now();

    if (now - this.lastUpdate < this.data.updateInterval) return;

    var elapsed = now - this.lastTime;
    this.fps = Math.round((this.frameCount / elapsed) * 1000);
    this.frameTime = (elapsed / this.frameCount).toFixed(1);
    this.frameCount = 0;
    this.lastTime = now;
    this.lastUpdate = now;

    this.updateRendererStats();
    this.updateDisplay();
    this.checkWarning();
  },

  updateRendererStats: function() {
    var scene = this.el.sceneEl;
    if (!scene || !scene.renderer) return;

    var info = scene.renderer.info;
    if (info && info.render) {
      this.drawCalls = info.render.calls || 0;
      this.triangles = info.render.triangles || 0;
    }
  },

  updateDisplay: function() {
    var fpsColor = this.getFpsColor(this.fps);

    this.fpsText.setAttribute('value', 'FPS: ' + this.fps);
    this.fpsText.setAttribute('color', fpsColor);
    this.frameTimeText.setAttribute('value', 'Frame: ' + this.frameTime + ' ms');
    this.drawCallsText.setAttribute('value', 'Draws: ' + this.drawCalls);
    this.trianglesText.setAttribute('value', 'Tris: ' + this.formatNumber(this.triangles));
  },

  getFpsColor: function(fps) {
    if (fps >= 60) return '#0f0';
    if (fps >= 30) return '#ff0';
    return '#f00';
  },

  formatNumber: function(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  },

  checkWarning: function() {
    if (this.fps > 0 && this.fps < this.data.warnThreshold) {
      if (!this.warned) {
        this.warned = true;
        console.warn('[PerfMonitor] Low FPS detected:', this.fps);
        this.el.emit('perf-warning', { fps: this.fps, threshold: this.data.warnThreshold });
      }
    } else {
      this.warned = false;
    }
  },

  show: function() {
    this.overlay.setAttribute('visible', true);
    this.data.visible = true;
  },

  hide: function() {
    this.overlay.setAttribute('visible', false);
    this.data.visible = false;
  },

  toggle: function() {
    if (this.data.visible) {
      this.hide();
    } else {
      this.show();
    }
  },

  getStats: function() {
    return {
      fps: this.fps,
      frameTime: parseFloat(this.frameTime),
      drawCalls: this.drawCalls,
      triangles: this.triangles
    };
  }
});

window.PerfMonitor = {
  show: function() {
    var camera = document.querySelector('[perf-monitor]');
    if (camera && camera.components['perf-monitor']) {
      camera.components['perf-monitor'].show();
    }
  },

  hide: function() {
    var camera = document.querySelector('[perf-monitor]');
    if (camera && camera.components['perf-monitor']) {
      camera.components['perf-monitor'].hide();
    }
  },

  toggle: function() {
    var camera = document.querySelector('[perf-monitor]');
    if (camera && camera.components['perf-monitor']) {
      camera.components['perf-monitor'].toggle();
    }
  },

  getStats: function() {
    var camera = document.querySelector('[perf-monitor]');
    if (camera && camera.components['perf-monitor']) {
      return camera.components['perf-monitor'].getStats();
    }
    return null;
  }
};
