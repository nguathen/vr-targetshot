/**
 * Particle Emitter Component - Reusable particle effects for VR games
 * Usage: <script src="/framework/vfx/particles.js"></script>
 *
 * As component:
 *   <a-entity particle-emitter="preset: explosion"></a-entity>
 *   <a-entity particle-emitter="preset: hit; color: #ff0000"></a-entity>
 *
 * Global API (preferred for one-shot effects):
 *   Particles.emit('explosion', { x: 0, y: 1, z: -3 });
 *   Particles.emit('hit', entity.object3D.position);
 */

(function() {
  'use strict';

  var PRESETS = {
    hit: {
      count: 12,
      size: 0.03,
      color: '#ffaa00',
      speed: 2,
      spread: 0.8,
      lifetime: 300,
      gravity: -2,
      fadeOut: true
    },
    explosion: {
      count: 30,
      size: 0.08,
      color: '#ff4400',
      speed: 4,
      spread: 1.0,
      lifetime: 600,
      gravity: -1,
      fadeOut: true
    },
    pickup: {
      count: 15,
      size: 0.04,
      color: '#44ff88',
      speed: 1.5,
      spread: 0.5,
      lifetime: 800,
      gravity: 2,
      fadeOut: true
    },
    dust: {
      count: 8,
      size: 0.05,
      color: '#aa9977',
      speed: 0.5,
      spread: 0.6,
      lifetime: 1000,
      gravity: 0.2,
      fadeOut: true
    }
  };

  var MAX_PARTICLES = 200;
  var activeEmitters = [];
  var particleContainer = null;

  function getParticleContainer() {
    if (particleContainer) return particleContainer;

    var scene = document.querySelector('a-scene');
    if (!scene) return null;

    particleContainer = document.createElement('a-entity');
    particleContainer.setAttribute('id', 'particle-container');
    scene.appendChild(particleContainer);

    return particleContainer;
  }

  function createParticleSystem(config) {
    var count = Math.min(config.count, MAX_PARTICLES);

    var positions = new Float32Array(count * 3);
    var velocities = new Float32Array(count * 3);
    var colors = new Float32Array(count * 3);
    var sizes = new Float32Array(count);
    var lifetimes = new Float32Array(count);

    var baseColor = new THREE.Color(config.color);

    for (var i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;

      var theta = Math.random() * Math.PI * 2;
      var phi = Math.acos(2 * Math.random() - 1);
      var spreadFactor = config.spread * Math.random();

      velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * config.speed * spreadFactor;
      velocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * config.speed * spreadFactor;
      velocities[i * 3 + 2] = Math.cos(phi) * config.speed * spreadFactor;

      var colorVariation = 0.8 + Math.random() * 0.4;
      colors[i * 3] = baseColor.r * colorVariation;
      colors[i * 3 + 1] = baseColor.g * colorVariation;
      colors[i * 3 + 2] = baseColor.b * colorVariation;

      sizes[i] = config.size * (0.5 + Math.random() * 0.5);
      lifetimes[i] = config.lifetime * (0.7 + Math.random() * 0.3);
    }

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    var material = new THREE.PointsMaterial({
      size: config.size,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    var points = new THREE.Points(geometry, material);

    return {
      points: points,
      geometry: geometry,
      material: material,
      velocities: velocities,
      lifetimes: lifetimes,
      config: config,
      startTime: performance.now(),
      maxLifetime: config.lifetime,
      disposed: false
    };
  }

  function updateParticleSystem(system, delta) {
    if (system.disposed) return true;

    var elapsed = performance.now() - system.startTime;
    var progress = elapsed / system.maxLifetime;

    if (progress >= 1.5) {
      return true;
    }

    var positions = system.geometry.attributes.position.array;
    var velocities = system.velocities;
    var lifetimes = system.lifetimes;
    var gravity = system.config.gravity;
    var deltaSeconds = delta / 1000;

    var count = positions.length / 3;
    for (var i = 0; i < count; i++) {
      if (elapsed < lifetimes[i]) {
        positions[i * 3] += velocities[i * 3] * deltaSeconds;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * deltaSeconds;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * deltaSeconds;

        velocities[i * 3 + 1] += gravity * deltaSeconds;
      }
    }

    system.geometry.attributes.position.needsUpdate = true;

    if (system.config.fadeOut) {
      system.material.opacity = Math.max(0, 1 - (progress * 0.8));
    }

    return false;
  }

  function disposeParticleSystem(system) {
    if (system.disposed) return;

    system.disposed = true;

    if (system.points.parent) {
      system.points.parent.remove(system.points);
    }

    system.geometry.dispose();
    system.material.dispose();
  }

  AFRAME.registerComponent('particle-emitter', {
    schema: {
      preset: { type: 'string', default: 'hit' },
      color: { type: 'color', default: '' },
      count: { type: 'number', default: 0 },
      size: { type: 'number', default: 0 },
      speed: { type: 'number', default: 0 },
      spread: { type: 'number', default: 0 },
      lifetime: { type: 'number', default: 0 },
      gravity: { type: 'number', default: 0 },
      continuous: { type: 'boolean', default: false },
      interval: { type: 'number', default: 100 },
      autoStart: { type: 'boolean', default: true },
      autoDispose: { type: 'boolean', default: true }
    },

    init: function() {
      this.systems = [];
      this.lastEmitTime = 0;
      this.isEmitting = false;

      if (this.data.autoStart) {
        if (this.data.continuous) {
          this.startContinuous();
        } else {
          this.emit();
        }
      }
    },

    getConfig: function() {
      var preset = PRESETS[this.data.preset] || PRESETS.hit;
      var config = Object.assign({}, preset);

      if (this.data.color) config.color = this.data.color;
      if (this.data.count > 0) config.count = this.data.count;
      if (this.data.size > 0) config.size = this.data.size;
      if (this.data.speed > 0) config.speed = this.data.speed;
      if (this.data.spread > 0) config.spread = this.data.spread;
      if (this.data.lifetime > 0) config.lifetime = this.data.lifetime;
      if (this.data.gravity !== 0) config.gravity = this.data.gravity;

      return config;
    },

    emit: function() {
      var config = this.getConfig();
      var system = createParticleSystem(config);

      var worldPos = new THREE.Vector3();
      this.el.object3D.getWorldPosition(worldPos);
      system.points.position.copy(worldPos);

      var scene = this.el.sceneEl.object3D;
      scene.add(system.points);

      this.systems.push(system);
      activeEmitters.push(this);

      this.el.emit('particles-started', { preset: this.data.preset });
    },

    startContinuous: function() {
      this.isEmitting = true;
      this.emit();
    },

    stopContinuous: function() {
      this.isEmitting = false;
    },

    tick: function(time, delta) {
      if (this.isEmitting && this.data.continuous) {
        if (time - this.lastEmitTime > this.data.interval) {
          this.emit();
          this.lastEmitTime = time;
        }
      }

      var completedCount = 0;
      for (var i = this.systems.length - 1; i >= 0; i--) {
        var completed = updateParticleSystem(this.systems[i], delta);
        if (completed) {
          disposeParticleSystem(this.systems[i]);
          this.systems.splice(i, 1);
          completedCount++;
        }
      }

      if (completedCount > 0 && this.systems.length === 0 && !this.isEmitting) {
        this.el.emit('particles-ended', { preset: this.data.preset });

        if (this.data.autoDispose) {
          var self = this;
          setTimeout(function() {
            if (self.el && self.el.parentNode) {
              self.el.parentNode.removeChild(self.el);
            }
          }, 0);
        }
      }
    },

    remove: function() {
      this.stopContinuous();

      for (var i = 0; i < this.systems.length; i++) {
        disposeParticleSystem(this.systems[i]);
      }
      this.systems = [];

      var idx = activeEmitters.indexOf(this);
      if (idx !== -1) {
        activeEmitters.splice(idx, 1);
      }
    }
  });

  window.Particles = {
    /**
     * Emit a one-shot particle effect at a position.
     * @param {string} preset - Preset name: 'hit', 'explosion', 'pickup', 'dust'
     * @param {Object} position - { x, y, z } world position
     * @param {Object} [options] - Override preset options
     * @returns {HTMLElement} The particle entity (auto-disposes)
     */
    emit: function(preset, position, options) {
      var container = getParticleContainer();
      if (!container) {
        console.warn('[Particles] No A-Frame scene found');
        return null;
      }

      var el = document.createElement('a-entity');

      var pos = position || { x: 0, y: 0, z: 0 };
      if (position && position.isVector3) {
        pos = { x: position.x, y: position.y, z: position.z };
      }
      el.setAttribute('position', pos.x + ' ' + pos.y + ' ' + pos.z);

      var attrs = 'preset: ' + (preset || 'hit') + '; autoDispose: true';
      if (options) {
        if (options.color) attrs += '; color: ' + options.color;
        if (options.count) attrs += '; count: ' + options.count;
        if (options.size) attrs += '; size: ' + options.size;
        if (options.speed) attrs += '; speed: ' + options.speed;
        if (options.spread) attrs += '; spread: ' + options.spread;
        if (options.lifetime) attrs += '; lifetime: ' + options.lifetime;
        if (options.gravity !== undefined) attrs += '; gravity: ' + options.gravity;
      }

      el.setAttribute('particle-emitter', attrs);
      container.appendChild(el);

      return el;
    },

    /**
     * Create a continuous particle emitter at a position.
     * @param {string} preset - Preset name
     * @param {Object} position - { x, y, z } world position
     * @param {Object} [options] - Override options including 'interval' (ms)
     * @returns {HTMLElement} The particle entity (call Particles.stop() to end)
     */
    createContinuous: function(preset, position, options) {
      var container = getParticleContainer();
      if (!container) {
        console.warn('[Particles] No A-Frame scene found');
        return null;
      }

      var el = document.createElement('a-entity');

      var pos = position || { x: 0, y: 0, z: 0 };
      if (position && position.isVector3) {
        pos = { x: position.x, y: position.y, z: position.z };
      }
      el.setAttribute('position', pos.x + ' ' + pos.y + ' ' + pos.z);

      var interval = (options && options.interval) || 100;
      var attrs = 'preset: ' + (preset || 'hit') + '; continuous: true; interval: ' + interval + '; autoDispose: false';
      if (options) {
        if (options.color) attrs += '; color: ' + options.color;
        if (options.count) attrs += '; count: ' + options.count;
        if (options.size) attrs += '; size: ' + options.size;
        if (options.speed) attrs += '; speed: ' + options.speed;
        if (options.spread) attrs += '; spread: ' + options.spread;
        if (options.lifetime) attrs += '; lifetime: ' + options.lifetime;
        if (options.gravity !== undefined) attrs += '; gravity: ' + options.gravity;
      }

      el.setAttribute('particle-emitter', attrs);
      container.appendChild(el);

      return el;
    },

    /**
     * Stop a continuous emitter and remove it.
     * @param {HTMLElement} emitterEl - The emitter entity from createContinuous
     */
    stop: function(emitterEl) {
      if (!emitterEl) return;

      var component = emitterEl.components['particle-emitter'];
      if (component) {
        component.stopContinuous();
      }

      setTimeout(function() {
        if (emitterEl.parentNode) {
          emitterEl.parentNode.removeChild(emitterEl);
        }
      }, 100);
    },

    /**
     * Get available preset names.
     * @returns {string[]} Array of preset names
     */
    getPresets: function() {
      return Object.keys(PRESETS);
    },

    /**
     * Add or override a preset configuration.
     * @param {string} name - Preset name
     * @param {Object} config - Preset configuration
     */
    registerPreset: function(name, config) {
      PRESETS[name] = Object.assign({
        count: 12,
        size: 0.05,
        color: '#ffffff',
        speed: 2,
        spread: 0.5,
        lifetime: 500,
        gravity: 0,
        fadeOut: true
      }, config);
      console.log('[Particles] Registered preset: ' + name);
    },

    /**
     * Get count of active particle systems.
     * @returns {number} Number of active emitters
     */
    activeCount: function() {
      return activeEmitters.length;
    }
  };

  console.log('[Particles] Loaded with presets:', Object.keys(PRESETS).join(', '));
})();
