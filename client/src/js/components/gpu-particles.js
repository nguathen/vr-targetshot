/**
 * GPU Particle System (TASK-320)
 * High-performance particle rendering using Three.js Points + BufferGeometry.
 * Replaces entity-spawning approach with GPU-accelerated particles.
 *
 * Usage:
 *   <a-entity gpu-particles="preset: rain; count: 2000; color: #00d4ff">
 *   <a-entity gpu-particles="preset: burst; count: 15; color: #ff4444; oneShot: true">
 */

// TASK-437: Quest detection for disabling GPU particles entirely
const _isQuestGP = typeof window !== 'undefined' &&
  (window.__isQuestGPDevice || /Quest|Android|Mobile/i.test(navigator.userAgent));

AFRAME.registerComponent('gpu-particles', {
  schema: {
    preset: { type: 'string', default: 'ambient' }, // ambient, rain, dust, bubbles, starfield, burst, muzzle, powerup, explosion, smoke, trail
    count: { type: 'int', default: 200 }, // TASK-407: Reduced from 500 for Quest performance
    color: { type: 'color', default: '#ffffff' },
    color2: { type: 'color', default: '' },
    size: { type: 'number', default: 0.03 },
    sizeVariance: { type: 'number', default: 0.5 },
    speed: { type: 'number', default: 1.0 },
    area: { type: 'number', default: 20 },
    height: { type: 'number', default: 10 },
    lifetime: { type: 'number', default: 5000 },
    oneShot: { type: 'boolean', default: false },
    direction: { type: 'vec3', default: { x: 0, y: -1, z: 0 } },
    spread: { type: 'number', default: 0.5 },
    opacity: { type: 'number', default: 0.6 },
    enabled: { type: 'boolean', default: true },
  },

  init() {
    this._clock = 0;
    this._dead = false;
    this._oneShotDone = false;

    // TASK-437: Disable GPU particles entirely on Quest for performance
    if (_isQuestGP) {
      console.log('[gpu-particles] Disabled on Quest for performance');
      return;
    }

    if (!this.data.enabled) return;
    this._build();
  },

  _build() {
    const data = this.data;
    // TASK-407: Cap particle count on Quest/mobile GPU
    const isMobileGPU = /Quest|Android|Mobile/i.test(navigator.userAgent);
    const maxMobileCount = 100;
    const count = isMobileGPU ? Math.min(data.count, maxMobileCount) : data.count;

    // Attributes
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const lifetimes = new Float32Array(count);   // current age
    const maxLifetimes = new Float32Array(count); // max age
    const sizes = new Float32Array(count);
    const opacities = new Float32Array(count);

    const preset = this._getPreset(data);

    for (let i = 0; i < count; i++) {
      const p = preset.initParticle(i, count);
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      velocities[i * 3] = p.vx;
      velocities[i * 3 + 1] = p.vy;
      velocities[i * 3 + 2] = p.vz;
      lifetimes[i] = data.oneShot ? 0 : Math.random() * p.maxLife;
      maxLifetimes[i] = p.maxLife;
      sizes[i] = p.size;
      opacities[i] = data.oneShot ? data.opacity : Math.random() * data.opacity;
    }

    this._velocities = velocities;
    this._lifetimes = lifetimes;
    this._maxLifetimes = maxLifetimes;
    this._preset = preset;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));

    // Parse colors
    const c1 = new THREE.Color(data.color);
    const c2 = data.color2 ? new THREE.Color(data.color2) : c1;

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor1: { value: c1 },
        uColor2: { value: c2 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: `
        attribute float aSize;
        attribute float aOpacity;
        varying float vOpacity;
        varying float vMix;
        uniform float uPixelRatio;
        void main() {
          vOpacity = aOpacity;
          vMix = position.y * 0.1 + 0.5;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixelRatio * (300.0 / -mvPos.z);
          gl_PointSize = clamp(gl_PointSize, 1.0, 64.0);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        varying float vOpacity;
        varying float vMix;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float alpha = vOpacity * smoothstep(0.5, 0.2, d);
          vec3 color = mix(uColor1, uColor2, clamp(vMix, 0.0, 1.0));
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this._points = new THREE.Points(geometry, material);
    this._points.frustumCulled = false;
    this.el.object3D.add(this._points);
    this._geometry = geometry;
  },

  _getPreset(data) {
    const area = data.area;
    const height = data.height;
    const speed = data.speed;
    const size = data.size;
    const sizeVar = data.sizeVariance;
    const lifetime = data.lifetime;
    const dir = data.direction;
    const spread = data.spread;

    const presets = {
      ambient: {
        initParticle: (i, n) => ({
          x: (Math.random() - 0.5) * area,
          y: Math.random() * height + 0.5,
          z: (Math.random() - 0.5) * area,
          vx: (Math.random() - 0.5) * speed * 0.3,
          vy: (Math.random() - 0.5) * speed * 0.2,
          vz: (Math.random() - 0.5) * speed * 0.3,
          size: size * (1 - sizeVar + Math.random() * sizeVar * 2),
          maxLife: lifetime * (0.5 + Math.random()),
        }),
        update: (p, v, lt, mlt, i, dt) => {
          // Slow drift with slight wave
          p[i * 3] += v[i * 3] * dt;
          p[i * 3 + 1] += v[i * 3 + 1] * dt + Math.sin(lt[i] * 0.002 + i) * 0.001;
          p[i * 3 + 2] += v[i * 3 + 2] * dt;
        },
        respawn: (p, v, i) => {
          p[i * 3] = (Math.random() - 0.5) * area;
          p[i * 3 + 1] = Math.random() * height + 0.5;
          p[i * 3 + 2] = (Math.random() - 0.5) * area;
          v[i * 3] = (Math.random() - 0.5) * speed * 0.3;
          v[i * 3 + 1] = (Math.random() - 0.5) * speed * 0.2;
          v[i * 3 + 2] = (Math.random() - 0.5) * speed * 0.3;
        },
      },
      rain: {
        initParticle: (i) => ({
          x: (Math.random() - 0.5) * area,
          y: Math.random() * height + 5,
          z: (Math.random() - 0.5) * area,
          vx: (Math.random() - 0.5) * 0.3,
          vy: -(speed * (3 + Math.random() * 2)),
          vz: (Math.random() - 0.5) * 0.3,
          size: size * (0.5 + Math.random()),
          maxLife: lifetime * (0.3 + Math.random() * 0.7),
        }),
        update: (p, v, lt, mlt, i, dt) => {
          p[i * 3] += v[i * 3] * dt + (Math.random() - 0.5) * 0.005;
          p[i * 3 + 1] += v[i * 3 + 1] * dt;
          p[i * 3 + 2] += v[i * 3 + 2] * dt;
        },
        respawn: (p, v, i) => {
          p[i * 3] = (Math.random() - 0.5) * area;
          p[i * 3 + 1] = height + 5 + Math.random() * 3;
          p[i * 3 + 2] = (Math.random() - 0.5) * area;
          v[i * 3 + 1] = -(speed * (3 + Math.random() * 2));
        },
      },
      dust: {
        initParticle: (i) => ({
          x: (Math.random() - 0.5) * area,
          y: Math.random() * height,
          z: (Math.random() - 0.5) * area,
          vx: (Math.random() - 0.5) * speed * 0.4,
          vy: (Math.random() - 0.5) * speed * 0.15,
          vz: (Math.random() - 0.5) * speed * 0.4,
          size: size * (0.6 + Math.random() * 0.8),
          maxLife: lifetime * (0.5 + Math.random()),
        }),
        update: (p, v, lt, mlt, i, dt) => {
          p[i * 3] += v[i * 3] * dt;
          p[i * 3 + 1] += v[i * 3 + 1] * dt + Math.sin(lt[i] * 0.001 + i * 0.5) * 0.0005;
          p[i * 3 + 2] += v[i * 3 + 2] * dt;
        },
        respawn: (p, v, i) => {
          p[i * 3] = (Math.random() - 0.5) * area;
          p[i * 3 + 1] = Math.random() * height;
          p[i * 3 + 2] = (Math.random() - 0.5) * area;
        },
      },
      bubbles: {
        initParticle: (i) => ({
          x: (Math.random() - 0.5) * area,
          y: -1 + Math.random() * (height + 2),
          z: (Math.random() - 0.5) * area,
          vx: (Math.random() - 0.5) * 0.2,
          vy: speed * (0.5 + Math.random() * 0.8),
          vz: (Math.random() - 0.5) * 0.2,
          size: size * (0.8 + Math.random() * 1.5),
          maxLife: lifetime * (0.4 + Math.random() * 0.6),
        }),
        update: (p, v, lt, mlt, i, dt) => {
          p[i * 3] += v[i * 3] * dt + Math.sin(lt[i] * 0.003 + i) * 0.002;
          p[i * 3 + 1] += v[i * 3 + 1] * dt;
          p[i * 3 + 2] += v[i * 3 + 2] * dt + Math.cos(lt[i] * 0.002 + i) * 0.002;
        },
        respawn: (p, v, i) => {
          p[i * 3] = (Math.random() - 0.5) * area;
          p[i * 3 + 1] = -1;
          p[i * 3 + 2] = (Math.random() - 0.5) * area;
          v[i * 3 + 1] = speed * (0.5 + Math.random() * 0.8);
        },
      },
      starfield: {
        initParticle: (i) => ({
          x: (Math.random() - 0.5) * area * 2,
          y: Math.random() * height * 2,
          z: (Math.random() - 0.5) * area * 2,
          vx: (Math.random() - 0.5) * speed * 0.05,
          vy: (Math.random() - 0.5) * speed * 0.05,
          vz: (Math.random() - 0.5) * speed * 0.05,
          size: size * (0.3 + Math.random() * 1.2),
          maxLife: lifetime * (0.8 + Math.random() * 0.4),
        }),
        update: (p, v, lt, mlt, i, dt) => {
          // Twinkle via opacity handled in tick
          p[i * 3] += v[i * 3] * dt;
          p[i * 3 + 1] += v[i * 3 + 1] * dt;
          p[i * 3 + 2] += v[i * 3 + 2] * dt;
        },
        respawn: (p, v, i) => {
          p[i * 3] = (Math.random() - 0.5) * area * 2;
          p[i * 3 + 1] = Math.random() * height * 2;
          p[i * 3 + 2] = (Math.random() - 0.5) * area * 2;
        },
      },
      burst: {
        initParticle: (i) => {
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          const spd = speed * (1 + Math.random() * 1.5);
          return {
            x: 0, y: 0, z: 0,
            vx: Math.sin(phi) * Math.cos(theta) * spd,
            vy: Math.sin(phi) * Math.sin(theta) * spd * 0.8 + speed * 0.5,
            vz: Math.cos(phi) * spd,
            size: size * (0.5 + Math.random()),
            maxLife: lifetime,
          };
        },
        update: (p, v, lt, mlt, i, dt) => {
          v[i * 3 + 1] -= 2.0 * dt; // gravity
          p[i * 3] += v[i * 3] * dt;
          p[i * 3 + 1] += v[i * 3 + 1] * dt;
          p[i * 3 + 2] += v[i * 3 + 2] * dt;
        },
        respawn: null, // one-shot: don't respawn
      },
      muzzle: {
        initParticle: (i) => {
          const ang = Math.random() * Math.PI * 2;
          const r = Math.random() * spread;
          return {
            x: 0, y: 0, z: 0,
            vx: Math.cos(ang) * r * speed,
            vy: Math.sin(ang) * r * speed,
            vz: dir.z * speed * (2 + Math.random()),
            size: size * (0.3 + Math.random() * 0.7),
            maxLife: lifetime,
          };
        },
        update: (p, v, lt, mlt, i, dt) => {
          p[i * 3] += v[i * 3] * dt;
          p[i * 3 + 1] += v[i * 3 + 1] * dt;
          p[i * 3 + 2] += v[i * 3 + 2] * dt;
        },
        respawn: null,
      },
      powerup: {
        initParticle: (i, n) => {
          const theta = (i / n) * Math.PI * 2;
          return {
            x: 0, y: 0, z: 0,
            vx: Math.cos(theta) * speed * 1.5,
            vy: (Math.random() - 0.3) * speed * 2,
            vz: Math.sin(theta) * speed * 1.5,
            size: size * (0.6 + Math.random() * 0.8),
            maxLife: lifetime,
          };
        },
        update: (p, v, lt, mlt, i, dt) => {
          v[i * 3 + 1] -= 1.0 * dt;
          p[i * 3] += v[i * 3] * dt;
          p[i * 3 + 1] += v[i * 3 + 1] * dt;
          p[i * 3 + 2] += v[i * 3 + 2] * dt;
        },
        respawn: null,
      },
      // TASK-363: Multi-layer explosion — core flash + fire + shrapnel + smoke
      explosion: {
        initParticle: (i, n) => {
          const layer = i / n; // 0..1 — determines particle role
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          if (layer < 0.15) {
            // Core flash — large bright particles, slow outward
            return {
              x: 0, y: 0, z: 0,
              vx: Math.sin(phi) * Math.cos(theta) * speed * 0.5,
              vy: Math.sin(phi) * Math.sin(theta) * speed * 0.5 + speed * 0.3,
              vz: Math.cos(phi) * speed * 0.5,
              size: size * (2.5 + Math.random() * 1.5),
              maxLife: lifetime * 0.4,
            };
          } else if (layer < 0.55) {
            // Fire — medium speed outward with upward bias
            const spd = speed * (1.5 + Math.random() * 2);
            return {
              x: 0, y: 0, z: 0,
              vx: Math.sin(phi) * Math.cos(theta) * spd,
              vy: Math.abs(Math.sin(phi) * Math.sin(theta)) * spd * 0.6 + speed * 1.0,
              vz: Math.cos(phi) * spd,
              size: size * (1.0 + Math.random() * 1.0),
              maxLife: lifetime * (0.5 + Math.random() * 0.3),
            };
          } else if (layer < 0.8) {
            // Shrapnel — fast, gravity-affected
            const spd = speed * (3 + Math.random() * 3);
            return {
              x: 0, y: 0, z: 0,
              vx: Math.sin(phi) * Math.cos(theta) * spd,
              vy: Math.sin(phi) * Math.sin(theta) * spd * 0.5 + speed * 2,
              vz: Math.cos(phi) * spd,
              size: size * (0.3 + Math.random() * 0.4),
              maxLife: lifetime * (0.6 + Math.random() * 0.4),
            };
          } else {
            // Smoke — slow rise, large
            return {
              x: (Math.random() - 0.5) * 0.3,
              y: Math.random() * 0.2,
              z: (Math.random() - 0.5) * 0.3,
              vx: (Math.random() - 0.5) * speed * 0.4,
              vy: speed * (0.3 + Math.random() * 0.5),
              vz: (Math.random() - 0.5) * speed * 0.4,
              size: size * (1.5 + Math.random() * 2.0),
              maxLife: lifetime * (0.8 + Math.random() * 0.4),
            };
          }
        },
        update: (p, v, lt, mlt, i, dt) => {
          v[i * 3 + 1] -= 3.0 * dt; // gravity
          // Air drag
          v[i * 3] *= (1 - 0.5 * dt);
          v[i * 3 + 1] *= (1 - 0.3 * dt);
          v[i * 3 + 2] *= (1 - 0.5 * dt);
          p[i * 3] += v[i * 3] * dt;
          p[i * 3 + 1] += v[i * 3 + 1] * dt;
          p[i * 3 + 2] += v[i * 3 + 2] * dt;
        },
        respawn: null,
      },
      // TASK-365: Smoke puff — slow rising, expanding particles
      smoke: {
        initParticle: (i) => {
          const ang = Math.random() * Math.PI * 2;
          const r = Math.random() * spread * 0.5;
          return {
            x: 0, y: 0, z: 0,
            vx: Math.cos(ang) * r * speed * 0.3 + (Math.random() - 0.5) * 0.2,
            vy: speed * (0.3 + Math.random() * 0.4),
            vz: Math.sin(ang) * r * speed * 0.3 + dir.z * speed * 0.5,
            size: size * (0.8 + Math.random() * 1.2),
            maxLife: lifetime,
          };
        },
        update: (p, v, lt, mlt, i, dt) => {
          v[i * 3] *= (1 - 2.0 * dt); // heavy drag
          v[i * 3 + 2] *= (1 - 2.0 * dt);
          p[i * 3] += v[i * 3] * dt;
          p[i * 3 + 1] += v[i * 3 + 1] * dt;
          p[i * 3 + 2] += v[i * 3 + 2] * dt;
        },
        respawn: null,
      },
      // TASK-364: Projectile trail — continuous emission along direction
      trail: {
        initParticle: (i) => ({
          x: (Math.random() - 0.5) * 0.05,
          y: (Math.random() - 0.5) * 0.05,
          z: (Math.random() - 0.5) * 0.05,
          vx: (Math.random() - 0.5) * speed * 0.3,
          vy: (Math.random() - 0.5) * speed * 0.3,
          vz: (Math.random() - 0.5) * speed * 0.3,
          size: size * (0.5 + Math.random() * 0.8),
          maxLife: lifetime * (0.3 + Math.random() * 0.7),
        }),
        update: (p, v, lt, mlt, i, dt) => {
          v[i * 3] *= (1 - 3.0 * dt);
          v[i * 3 + 1] *= (1 - 3.0 * dt);
          v[i * 3 + 2] *= (1 - 3.0 * dt);
          p[i * 3] += v[i * 3] * dt;
          p[i * 3 + 1] += v[i * 3 + 1] * dt;
          p[i * 3 + 2] += v[i * 3 + 2] * dt;
        },
        respawn: (p, v, i) => {
          p[i * 3] = (Math.random() - 0.5) * 0.05;
          p[i * 3 + 1] = (Math.random() - 0.5) * 0.05;
          p[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
          v[i * 3] = (Math.random() - 0.5) * speed * 0.3;
          v[i * 3 + 1] = (Math.random() - 0.5) * speed * 0.3;
          v[i * 3 + 2] = (Math.random() - 0.5) * speed * 0.3;
        },
      },
    };

    return presets[data.preset] || presets.ambient;
  },

  tick(time, delta) {
    if (!this._geometry || !this._points || this._dead || !this.data.enabled) return;
    if (this._oneShotDone) return;

    // TASK-390: Throttle particle updates to 30fps max (every 33ms)
    // This halves GPU particle overhead while maintaining visual quality
    this._tickAccum = (this._tickAccum || 0) + delta;
    if (this._tickAccum < 33) return;
    const actualDelta = this._tickAccum;
    this._tickAccum = 0;

    const dt = Math.min(actualDelta * 0.001, 0.1); // cap at 100ms
    const positions = this._geometry.attributes.position.array;
    const opacities = this._geometry.attributes.aOpacity.array;
    const lt = this._lifetimes;
    const mlt = this._maxLifetimes;
    const v = this._velocities;
    const count = this.data.count;
    const preset = this._preset;
    const isOneShot = this.data.oneShot;
    const baseOpacity = this.data.opacity;
    let allDead = true;

    for (let i = 0; i < count; i++) {
      lt[i] += actualDelta;

      if (lt[i] >= mlt[i]) {
        if (isOneShot || !preset.respawn) {
          opacities[i] = 0;
          continue;
        }
        // Respawn
        lt[i] = 0;
        preset.respawn(positions, v, i);
        opacities[i] = baseOpacity;
      } else {
        allDead = false;
      }

      // Fade out near end of life
      const lifeRatio = lt[i] / mlt[i];
      if (lifeRatio > 0.7) {
        opacities[i] = baseOpacity * (1 - (lifeRatio - 0.7) / 0.3);
      } else if (lifeRatio < 0.1 && isOneShot) {
        opacities[i] = baseOpacity * (lifeRatio / 0.1);
      }

      preset.update(positions, v, lt, mlt, i, dt);
    }

    this._geometry.attributes.position.needsUpdate = true;
    this._geometry.attributes.aOpacity.needsUpdate = true;

    // One-shot cleanup
    if (isOneShot && allDead) {
      this._oneShotDone = true;
      setTimeout(() => {
        if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
      }, 50);
    }
  },

  remove() {
    this._dead = true;
    if (this._points) {
      this._points.geometry.dispose();
      this._points.material.dispose();
      this.el.object3D.remove(this._points);
      this._points = null;
    }
  },

  update(oldData) {
    if (oldData.enabled !== undefined && oldData.enabled !== this.data.enabled) {
      if (this.data.enabled && !this._points) {
        this._build();
      } else if (!this.data.enabled && this._points) {
        this._points.visible = false;
      } else if (this.data.enabled && this._points) {
        this._points.visible = true;
      }
    }
  },
});

/**
 * Helper: spawn a one-shot GPU particle burst at a world position.
 * Returns the created entity for optional reference.
 */
window.__spawnGPUBurst = function (scene, pos, opts = {}) {
  // TASK-437: Skip on Quest for performance
  if (_isQuestGP) return null;

  const el = document.createElement('a-entity');
  el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
  el.setAttribute('gpu-particles', {
    preset: opts.preset || 'burst',
    count: opts.count || 15,
    color: opts.color || '#ffffff',
    color2: opts.color2 || opts.color || '#ffffff',
    size: opts.size || 0.04,
    speed: opts.speed || 4,
    lifetime: opts.lifetime || 500,
    oneShot: true,
    opacity: opts.opacity || 0.8,
  });
  scene.appendChild(el);
  return el;
};
