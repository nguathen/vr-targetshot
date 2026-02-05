/**
 * Weather System (TASK-260)
 * Procedural weather particles per theme with object pooling.
 * - Cyber: neon rain with splash
 * - Space: cosmic dust + meteor streaks
 * - Underwater: rising bubbles + jellyfish
 */

// V39: Quest detection for disabling weather
const _isQuest = typeof window !== 'undefined' &&
  (window.__isQuestDevice || /Quest|Android|Mobile/i.test(navigator.userAgent));

const WEATHER_CONFIGS = {
  cyber: {
    type: 'rain',
    count: 40,
    colors: ['#00d4ff', '#ff44aa', '#4466ff', '#00ffaa'],
    sizeMin: 0.015, sizeMax: 0.04,
    speedMin: 8, speedMax: 12,
    spawnY: 15, despawnY: -1,
    geometry: 'cylinder',  // elongated raindrop
    splash: true,
    meteor: false,
  },
  space: {
    type: 'dust',
    count: 30,
    colors: ['#ffffff', '#aaccff', '#8899cc', '#ffddaa'],
    sizeMin: 0.008, sizeMax: 0.025,
    speedMin: 0.5, speedMax: 2,
    spawnY: 12, despawnY: -5,
    geometry: 'sphere',
    splash: false,
    meteor: true,
    meteorChance: 0.05,
    meteorInterval: 3000,
  },
  underwater: {
    type: 'bubbles',
    count: 25,
    colors: ['#88ddff', '#aaeeff', '#66ccee', '#ffffff'],
    sizeMin: 0.02, sizeMax: 0.06,
    speedMin: 0.8, speedMax: 2.5,
    spawnY: -1, despawnY: 12,
    geometry: 'sphere',
    splash: false,
    meteor: false,
    direction: 'up',
  },
};

class WeatherSystem {
  constructor() {
    this._particles = [];
    this._pool = [];
    this._container = null;
    this._config = null;
    this._themeId = null;
    this._running = false;
    this._tick = null;
    this._meteorTimer = null;
    this._enabled = true;
  }

  init(sceneEl) {
    // V39: Disable weather entirely on Quest
    if (_isQuest) {
      console.log('[V39] weather-system: Disabled on Quest');
      this._enabled = false;
      return;
    }
    this._scene = sceneEl;
    // Create dedicated container
    let container = sceneEl.querySelector('#weather-container');
    if (!container) {
      container = document.createElement('a-entity');
      container.id = 'weather-container';
      sceneEl.appendChild(container);
    }
    this._container = container;
  }

  setTheme(themeId) {
    this.stop();
    this._themeId = themeId;
    this._config = WEATHER_CONFIGS[themeId] || null;
    if (this._config && this._enabled) {
      this.start();
    }
  }

  setEnabled(enabled) {
    this._enabled = enabled;
    if (!enabled) this.stop();
    else if (this._config) this.start();
  }

  start() {
    if (this._running || !this._config || !this._container) return;

    // TASK-421: Disable weather on Quest for performance (100-200 particles/frame too expensive)
    if (window.__isQuestDevice || /Quest|Android|Mobile/i.test(navigator.userAgent)) {
      console.log('[weather] Disabled on Quest for performance');
      return;
    }

    this._running = true;

    const cfg = this._config;

    // TASK-320: Try GPU particles first, fallback to entity-based
    if (typeof AFRAME !== 'undefined' && AFRAME.components['gpu-particles']) {
      this._useGPU = true;
      this._startGPU(cfg);
    } else {
      this._useGPU = false;
      this._startLegacy(cfg);
    }
  }

  _startGPU(cfg) {
    const presetMap = { rain: 'rain', dust: 'dust', bubbles: 'bubbles' };
    const preset = presetMap[cfg.type] || 'dust';
    const gpuEl = document.createElement('a-entity');
    gpuEl.id = 'weather-gpu-particles';
    gpuEl.setAttribute('gpu-particles', {
      preset,
      count: cfg.count * 30, // GPU can handle many more
      color: cfg.colors[0],
      color2: cfg.colors[1] || cfg.colors[0],
      size: cfg.sizeMax,
      speed: (cfg.speedMin + cfg.speedMax) / 2,
      area: 30,
      height: cfg.spawnY,
      lifetime: 6000,
      opacity: 0.5,
    });
    this._container.appendChild(gpuEl);
    this._gpuEl = gpuEl;

    // Meteor timer for space theme (keep entity-based, it's only occasional)
    if (cfg.meteor) {
      this._meteorTimer = setInterval(() => {
        if (this._running && Math.random() < cfg.meteorChance) {
          this._spawnMeteor();
        }
      }, cfg.meteorInterval);
    }
  }

  _startLegacy(cfg) {
    // Pre-populate particles
    for (let i = 0; i < cfg.count; i++) {
      this._spawnParticle(true);
    }

    // Update tick (60fps-ish)
    this._tick = setInterval(() => this._update(), 33);

    // Meteor timer for space theme
    if (cfg.meteor) {
      this._meteorTimer = setInterval(() => {
        if (this._running && Math.random() < cfg.meteorChance) {
          this._spawnMeteor();
        }
      }, cfg.meteorInterval);
    }
  }

  stop() {
    this._running = false;
    if (this._tick) { clearInterval(this._tick); this._tick = null; }
    if (this._meteorTimer) { clearInterval(this._meteorTimer); this._meteorTimer = null; }

    // Clean GPU particle element
    if (this._gpuEl && this._gpuEl.parentNode) {
      this._gpuEl.parentNode.removeChild(this._gpuEl);
      this._gpuEl = null;
    }

    // Return all to pool
    this._particles.forEach(p => {
      if (p.el?.parentNode) p.el.parentNode.removeChild(p.el);
    });
    this._particles = [];
    this._pool = [];

    // Clear container
    if (this._container) {
      while (this._container.firstChild) this._container.firstChild.remove();
    }
  }

  _spawnParticle(randomizeY = false) {
    const cfg = this._config;
    if (!cfg || !this._container) return;

    const el = this._pool.pop() || this._createElement(cfg);
    const color = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
    const size = cfg.sizeMin + Math.random() * (cfg.sizeMax - cfg.sizeMin);
    const speed = cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin);

    // Random position in cylinder around origin
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 20;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const y = randomizeY
      ? (cfg.direction === 'up'
        ? cfg.spawnY + Math.random() * (cfg.despawnY - cfg.spawnY)
        : cfg.despawnY + Math.random() * (cfg.spawnY - cfg.despawnY))
      : cfg.spawnY;

    if (cfg.geometry === 'cylinder') {
      // Rain: thin tall cylinder
      el.setAttribute('geometry', `primitive: cylinder; radius: ${size * 0.3}; height: ${size * 3}`);
    } else {
      el.setAttribute('geometry', `primitive: sphere; radius: ${size}`);
    }
    el.setAttribute('material', `shader: flat; color: ${color}; emissive: ${color}; emissiveIntensity: 0.5; opacity: ${0.3 + Math.random() * 0.4}; transparent: true`);
    el.setAttribute('position', `${x} ${y} ${z}`);
    el.removeAttribute('animation__twinkle');

    // Dust twinkle for space
    if (cfg.type === 'dust') {
      el.setAttribute('animation__twinkle', {
        property: 'material.opacity', from: 0.1, to: 0.5 + Math.random() * 0.3,
        dur: 800 + Math.random() * 1200,
        loop: true, dir: 'alternate', easing: 'easeInOutSine',
      });
    }

    // Bubble wobble for underwater
    if (cfg.type === 'bubbles') {
      el.setAttribute('animation__wobble', {
        property: 'position',
        to: `${x + (Math.random() - 0.5) * 0.5} ${y} ${z + (Math.random() - 0.5) * 0.5}`,
        dur: 1500 + Math.random() * 1000,
        loop: true, dir: 'alternate', easing: 'easeInOutSine',
      });
    }

    this._container.appendChild(el);
    this._particles.push({ el, x, y, z, speed, size });
  }

  _createElement() {
    const el = document.createElement('a-entity');
    el.setAttribute('shadow', 'cast: false; receive: false');
    return el;
  }

  _update() {
    if (!this._running) return;
    const cfg = this._config;
    const dt = 0.033;
    const goingUp = cfg.direction === 'up';

    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];

      if (goingUp) {
        p.y += p.speed * dt;
      } else {
        p.y -= p.speed * dt;
        // Slight horizontal drift for rain
        if (cfg.type === 'rain') {
          p.x += (Math.random() - 0.5) * 0.02;
        }
      }

      p.el.object3D.position.set(p.x, p.y, p.z);

      // Check bounds
      const outOfBounds = goingUp ? p.y > cfg.despawnY : p.y < cfg.despawnY;
      if (outOfBounds) {
        // Splash effect for rain
        if (cfg.splash && !goingUp) {
          this._spawnSplash(p.x, cfg.despawnY + 0.05, p.z);
        }

        // Recycle: reset to spawn
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 20;
        p.x = Math.cos(angle) * dist;
        p.z = Math.sin(angle) * dist;
        p.y = cfg.spawnY + (Math.random() - 0.5) * 2;
        p.speed = cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin);
      }
    }
  }

  _spawnSplash(x, y, z) {
    if (!this._container) return;
    // Tiny ring burst at floor level
    const splash = document.createElement('a-ring');
    splash.setAttribute('position', `${x} ${y} ${z}`);
    splash.setAttribute('rotation', '-90 0 0');
    splash.setAttribute('radius-inner', '0.01');
    splash.setAttribute('radius-outer', '0.02');
    splash.setAttribute('material', 'shader: flat; color: #00d4ff; opacity: 0.4; transparent: true');
    splash.setAttribute('animation__expand', {
      property: 'radius-outer', from: 0.02, to: 0.08,
      dur: 200, easing: 'easeOutQuad',
    });
    splash.setAttribute('animation__fade', {
      property: 'material.opacity', from: 0.4, to: 0,
      dur: 200, easing: 'easeOutQuad',
    });
    this._container.appendChild(splash);
    setTimeout(() => { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 250);
  }

  _spawnMeteor() {
    if (!this._container) return;
    const scene = this._scene;
    if (!scene) return;

    // Random start position high up
    const sx = (Math.random() - 0.5) * 30;
    const sy = 12 + Math.random() * 5;
    const sz = -20 - Math.random() * 20;

    const colors = ['#ffffff', '#ffddaa', '#aaccff'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const meteor = document.createElement('a-entity');

    // Head
    const head = document.createElement('a-sphere');
    head.setAttribute('radius', '0.04');
    head.setAttribute('material', `shader: flat; color: ${color}; emissive: ${color}; emissiveIntensity: 2; opacity: 0.9`);
    meteor.appendChild(head);

    // Trail (3 fading spheres)
    for (let i = 1; i <= 3; i++) {
      const t = document.createElement('a-sphere');
      t.setAttribute('radius', String(0.04 - i * 0.01));
      t.setAttribute('position', `${i * 0.15} ${i * 0.1} 0`);
      t.setAttribute('material', `shader: flat; color: ${color}; opacity: ${0.5 - i * 0.12}; transparent: true`);
      meteor.appendChild(t);
    }

    // Light
    const light = document.createElement('a-entity');
    light.setAttribute('light', `type: point; color: ${color}; intensity: 0.8; distance: 5; decay: 2`);
    meteor.appendChild(light);

    meteor.setAttribute('position', `${sx} ${sy} ${sz}`);

    // Diagonal streak animation
    const ex = sx + (Math.random() - 0.5) * 10 + 5;
    const ey = sy - 10 - Math.random() * 5;
    const ez = sz + 15 + Math.random() * 10;
    const dur = 800 + Math.random() * 400;

    meteor.setAttribute('animation__streak', {
      property: 'position',
      to: `${ex} ${ey} ${ez}`,
      dur, easing: 'linear',
    });
    meteor.setAttribute('animation__fade', {
      property: 'scale', from: '1 1 1', to: '0.2 0.2 0.2',
      dur, easing: 'easeInQuad',
    });

    this._container.appendChild(meteor);
    setTimeout(() => { if (meteor.parentNode) meteor.parentNode.removeChild(meteor); }, dur + 50);
  }
}

const weatherSystem = new WeatherSystem();
export { weatherSystem, WEATHER_CONFIGS };
export default weatherSystem;
