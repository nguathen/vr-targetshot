/**
 * A-Frame component: Bloom / Glow post-processing effect.
 * Uses Three.js EffectComposer pipeline built from scratch
 * (A-Frame 1.6 bundles Three.js r169 but not the examples/addons).
 *
 * Usage: <a-scene bloom-effect="strength: 0.6; radius: 0.4; threshold: 0.7">
 */
/* global AFRAME, THREE */
AFRAME.registerComponent('bloom-effect', {
  schema: {
    strength: { type: 'number', default: 0.6 },
    radius: { type: 'number', default: 0.4 },
    threshold: { type: 'number', default: 0.7 },
    enabled: { type: 'boolean', default: true },
    // TASK-332: Vignette & damage flash
    vignette: { type: 'boolean', default: true },
    vignetteIntensity: { type: 'number', default: 0.3 },
    // TASK-333: Color grading & tone mapping
    colorGrading: { type: 'boolean', default: true },
    exposure: { type: 'number', default: 1.0 },
  },

  init() {
    this._ready = false;
    this._onResize = this._onResize.bind(this);
    // TASK-332: Dynamic effect state
    this._damageFlash = 0;
    this._killFlash = 0;
    this._lowHpPulse = false;
    this._lowHpPhase = 0;
    // TASK-333: Per-theme color grading
    this._colorTemp = 0;
    this._saturation = 1.0;
    this._contrast = 1.0;
    this._brightness = 0;
    this._targetColorTemp = 0;
    this._targetSaturation = 1.0;
    this._targetContrast = 1.0;
    this._targetBrightness = 0;

    // TASK-360: VR mode state
    this._vrActive = false;
    this._vrVignetteEl = null;
    this._vrDamageEl = null;

    // TASK-332: Event listeners
    this._onDamage = () => { this._damageFlash = 0.4; };
    this._onKill = () => { this._killFlash = 0.15; };
    this._onHpUpdate = (e) => { this._lowHpPulse = (e.detail?.hp || 99) <= 1; };
    this._onThemeChanged = (e) => { this._applyThemeGrading(e.detail?.theme); };
    document.addEventListener('player-damage', this._onDamage);
    document.addEventListener('crosshair-kill', this._onKill);
    document.addEventListener('hp-update', this._onHpUpdate);
    document.addEventListener('theme-changed', this._onThemeChanged);

    // Wait for scene to fully load before hooking renderer
    if (this.el.hasLoaded) {
      this._setup();
    } else {
      this.el.addEventListener('loaded', () => this._setup(), { once: true });
    }
  },

  _setup() {
    try {
      const renderer = this.el.renderer;
      const scene = this.el.object3D;
      const camera = this.el.camera;
      if (!renderer || !scene || !camera) return;

      const size = renderer.getSize(new THREE.Vector2());
      const pixelRatio = renderer.getPixelRatio();

      // --- Render targets ---
      const rtParams = {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
      };
      this._rtScene = new THREE.WebGLRenderTarget(
        size.x * pixelRatio, size.y * pixelRatio, rtParams,
      );
      this._rtBright = new THREE.WebGLRenderTarget(
        size.x * pixelRatio / 2, size.y * pixelRatio / 2, rtParams,
      );
      this._rtBlurH = new THREE.WebGLRenderTarget(
        size.x * pixelRatio / 2, size.y * pixelRatio / 2, rtParams,
      );
      this._rtBlurV = new THREE.WebGLRenderTarget(
        size.x * pixelRatio / 2, size.y * pixelRatio / 2, rtParams,
      );

      // --- Full-screen quad helper ---
      this._quadGeo = new THREE.PlaneGeometry(2, 2);

      // --- Brightness extract shader ---
      this._brightMat = new THREE.ShaderMaterial({
        uniforms: {
          tDiffuse: { value: null },
          threshold: { value: this.data.threshold },
        },
        vertexShader: VERT,
        fragmentShader: FRAG_BRIGHT,
        depthTest: false, depthWrite: false,
      });

      // --- Gaussian blur shader (two-pass: H + V) ---
      this._blurHMat = new THREE.ShaderMaterial({
        uniforms: {
          tDiffuse: { value: null },
          resolution: { value: new THREE.Vector2(size.x * pixelRatio / 2, size.y * pixelRatio / 2) },
          direction: { value: new THREE.Vector2(1, 0) },
          radius: { value: this.data.radius },
        },
        vertexShader: VERT,
        fragmentShader: FRAG_BLUR,
        depthTest: false, depthWrite: false,
      });
      this._blurVMat = new THREE.ShaderMaterial({
        uniforms: {
          tDiffuse: { value: null },
          resolution: { value: new THREE.Vector2(size.x * pixelRatio / 2, size.y * pixelRatio / 2) },
          direction: { value: new THREE.Vector2(0, 1) },
          radius: { value: this.data.radius },
        },
        vertexShader: VERT,
        fragmentShader: FRAG_BLUR,
        depthTest: false, depthWrite: false,
      });

      // --- Composite shader (additive blend + vignette + grading) ---
      this._compositeMat = new THREE.ShaderMaterial({
        uniforms: {
          tScene: { value: null },
          tBloom: { value: null },
          strength: { value: this.data.strength },
          // TASK-332: Vignette & flash
          uVignetteIntensity: { value: this.data.vignetteIntensity },
          uVignetteEnabled: { value: this.data.vignette ? 1.0 : 0.0 },
          uDamageFlash: { value: 0.0 },
          uKillFlash: { value: 0.0 },
          // TASK-333: Color grading & tone mapping
          uExposure: { value: this.data.exposure },
          uColorTemp: { value: 0.0 },
          uSaturation: { value: 1.0 },
          uContrast: { value: 1.0 },
          uBrightness: { value: 0.0 },
          uGradingEnabled: { value: this.data.colorGrading ? 1.0 : 0.0 },
        },
        vertexShader: VERT,
        fragmentShader: FRAG_COMPOSITE,
        depthTest: false, depthWrite: false,
      });

      // Scenes for full-screen passes
      this._quadScene = new THREE.Scene();
      this._quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this._quadMesh = new THREE.Mesh(this._quadGeo, this._brightMat);
      this._quadScene.add(this._quadMesh);

      // Override A-Frame's render loop
      this._origRender = this.el.renderer.render.bind(this.el.renderer);
      const self = this;
      const origRenderFunc = renderer.render;
      this.el.renderer.render = function (s, c) {
        // Skip bloom in VR/XR mode — post-processing breaks stereo rendering
        const xrSession = renderer.xr && renderer.xr.isPresenting;
        if (!self.data.enabled || !self._ready || xrSession) {
          origRenderFunc.call(renderer, s, c);
          return;
        }
        self._renderBloom(renderer, s, c);
      };
      this._origRenderFunc = origRenderFunc;

      window.addEventListener('resize', this._onResize);
      this._ready = true;

      // TASK-360: Setup VR session listeners for tone mapping fallback
      this._setupVRFallback(renderer);
    } catch (e) {
      // Graceful fallback — bloom not supported
      console.warn('[bloom-effect] Setup failed, disabling:', e.message);
      this._ready = false;
    }
  },

  // TASK-360: VR-compatible post-processing via built-in tone mapping + overlay entities
  _setupVRFallback(renderer) {
    // Per-theme exposure values for VR built-in tone mapping
    this._vrExposurePresets = {
      cyber: 1.1,
      sunset: 1.3,
      space: 0.9,
      underwater: 0.85,
      neon: 1.2,
      day: 1.4,
    };
    this._vrTargetExposure = 1.1;

    const onSessionStart = () => {
      this._vrActive = true;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = this._vrTargetExposure;
      // Create VR overlay entities
      this._createVROverlays();
      console.log('[bloom-effect] VR mode: built-in ACES tone mapping enabled');
    };
    const onSessionEnd = () => {
      this._vrActive = false;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.toneMappingExposure = 1.0;
      // Remove VR overlays
      this._removeVROverlays();
      console.log('[bloom-effect] VR mode ended: custom pipeline restored');
    };

    this._onSessionStart = onSessionStart;
    this._onSessionEnd = onSessionEnd;
    renderer.xr.addEventListener('sessionstart', onSessionStart);
    renderer.xr.addEventListener('sessionend', onSessionEnd);
  },

  _createVROverlays() {
    const cameraEl = document.getElementById('camera');
    if (!cameraEl) return;

    // VR vignette overlay — semi-transparent black plane with radial gradient texture
    if (!this._vrVignetteEl) {
      const vig = document.createElement('a-plane');
      vig.setAttribute('id', 'vr-vignette');
      vig.setAttribute('width', '2');
      vig.setAttribute('height', '2');
      vig.setAttribute('position', '0 0 -0.5');
      vig.setAttribute('material', {
        shader: 'flat',
        color: '#000000',
        opacity: 0.0,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      vig.setAttribute('visible', 'true');
      cameraEl.appendChild(vig);
      this._vrVignetteEl = vig;

      // Generate radial vignette via canvas texture once the mesh is ready
      vig.addEventListener('loaded', () => {
        const mesh = vig.getObject3D('mesh');
        if (!mesh) return;
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(128, 128, 40, 128, 128, 128);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.6, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);
        const tex = new THREE.CanvasTexture(canvas);
        mesh.material = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: this.data.vignetteIntensity,
          depthTest: false,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        mesh.renderOrder = 9998;
        this._vrVignetteTex = tex;
        this._vrVignetteMat = mesh.material;
      }, { once: true });
    }

    // VR damage flash overlay — red plane
    if (!this._vrDamageEl) {
      const flash = document.createElement('a-plane');
      flash.setAttribute('id', 'vr-damage-flash');
      flash.setAttribute('width', '2');
      flash.setAttribute('height', '2');
      flash.setAttribute('position', '0 0 -0.5');
      flash.setAttribute('material', {
        shader: 'flat',
        color: '#cc1a0d',
        opacity: 0.0,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      flash.setAttribute('visible', 'true');
      cameraEl.appendChild(flash);
      this._vrDamageEl = flash;

      flash.addEventListener('loaded', () => {
        const mesh = flash.getObject3D('mesh');
        if (!mesh) return;
        mesh.material.depthTest = false;
        mesh.material.depthWrite = false;
        mesh.renderOrder = 9999;
        this._vrDamageMat = mesh.material;
      }, { once: true });
    }
  },

  _removeVROverlays() {
    if (this._vrVignetteEl) {
      this._vrVignetteEl.parentNode?.removeChild(this._vrVignetteEl);
      if (this._vrVignetteTex) { this._vrVignetteTex.dispose(); this._vrVignetteTex = null; }
      if (this._vrVignetteMat) { this._vrVignetteMat.dispose(); this._vrVignetteMat = null; }
      this._vrVignetteEl = null;
    }
    if (this._vrDamageEl) {
      this._vrDamageEl.parentNode?.removeChild(this._vrDamageEl);
      if (this._vrDamageMat) { this._vrDamageMat.dispose(); this._vrDamageMat = null; }
      this._vrDamageEl = null;
    }
  },

  _renderBloom(renderer, scene, camera) {
    const origRT = renderer.getRenderTarget();
    const origToneMapping = renderer.toneMapping;
    renderer.toneMapping = THREE.NoToneMapping;

    // 1) Render scene to texture
    renderer.setRenderTarget(this._rtScene);
    this._origRenderFunc.call(renderer, scene, camera);

    // 2) Extract bright areas
    this._quadMesh.material = this._brightMat;
    this._brightMat.uniforms.tDiffuse.value = this._rtScene.texture;
    renderer.setRenderTarget(this._rtBright);
    this._origRenderFunc.call(renderer, this._quadScene, this._quadCamera);

    // 3) Blur H
    this._quadMesh.material = this._blurHMat;
    this._blurHMat.uniforms.tDiffuse.value = this._rtBright.texture;
    renderer.setRenderTarget(this._rtBlurH);
    this._origRenderFunc.call(renderer, this._quadScene, this._quadCamera);

    // 4) Blur V
    this._quadMesh.material = this._blurVMat;
    this._blurVMat.uniforms.tDiffuse.value = this._rtBlurH.texture;
    renderer.setRenderTarget(this._rtBlurV);
    this._origRenderFunc.call(renderer, this._quadScene, this._quadCamera);

    // 5) Composite: scene + bloom → screen
    this._quadMesh.material = this._compositeMat;
    this._compositeMat.uniforms.tScene.value = this._rtScene.texture;
    this._compositeMat.uniforms.tBloom.value = this._rtBlurV.texture;
    renderer.setRenderTarget(origRT);
    renderer.toneMapping = origToneMapping;
    this._origRenderFunc.call(renderer, this._quadScene, this._quadCamera);
  },

  // TASK-333: Per-theme color grading presets
  _applyThemeGrading(theme) {
    const presets = {
      cyber:      { temp: -0.10, sat: 1.1, contrast: 1.1, bright: 0 },
      sunset:     { temp:  0.15, sat: 1.2, contrast: 1.0, bright: 0.02 },
      space:      { temp: -0.05, sat: 0.8, contrast: 1.15, bright: -0.02 },
      underwater: { temp: -0.15, sat: 0.9, contrast: 0.95, bright: -0.03 },
      neon:       { temp:  0.0,  sat: 1.4, contrast: 1.2, bright: 0.01 },
      day:        { temp:  0.05, sat: 1.0, contrast: 1.0, bright: 0.02 },
    };
    const p = presets[theme] || presets.cyber;
    this._targetColorTemp = p.temp;
    this._targetSaturation = p.sat;
    this._targetContrast = p.contrast;
    this._targetBrightness = p.bright;
    // TASK-360: Update VR exposure target
    if (this._vrExposurePresets) {
      this._vrTargetExposure = this._vrExposurePresets[theme] || 1.1;
    }
  },

  tick(time, delta) {
    if (!this._ready) return;
    const dt = Math.min(delta * 0.001, 0.05);

    // TASK-360: VR mode — update overlays instead of shader uniforms
    if (this._vrActive) {
      this._tickVR(dt);
      return;
    }

    if (!this._compositeMat) return;
    const u = this._compositeMat.uniforms;

    // TASK-332: Decay damage flash
    if (this._damageFlash > 0) {
      this._damageFlash = Math.max(0, this._damageFlash - dt * 1.3);
      u.uDamageFlash.value = this._damageFlash;
    }
    // Decay kill flash
    if (this._killFlash > 0) {
      this._killFlash = Math.max(0, this._killFlash - dt * 1.5);
      u.uKillFlash.value = this._killFlash;
    }
    // Low-HP vignette pulse
    if (this._lowHpPulse) {
      this._lowHpPhase += dt * Math.PI * 2; // 1Hz oscillation
      const pulse = 0.3 + Math.sin(this._lowHpPhase) * 0.15;
      u.uVignetteIntensity.value = pulse;
    } else if (u.uVignetteIntensity.value !== this.data.vignetteIntensity) {
      u.uVignetteIntensity.value = this.data.vignetteIntensity;
    }

    // TASK-333: Lerp color grading uniforms
    const lerpSpeed = dt * 1.0; // 1s transition
    this._colorTemp += (this._targetColorTemp - this._colorTemp) * lerpSpeed;
    this._saturation += (this._targetSaturation - this._saturation) * lerpSpeed;
    this._contrast += (this._targetContrast - this._contrast) * lerpSpeed;
    this._brightness += (this._targetBrightness - this._brightness) * lerpSpeed;
    u.uColorTemp.value = this._colorTemp;
    u.uSaturation.value = this._saturation;
    u.uContrast.value = this._contrast;
    u.uBrightness.value = this._brightness;
  },

  // TASK-360: VR tick — animate overlays + adjust tone mapping exposure per theme
  _tickVR(dt) {
    const renderer = this.el.renderer;

    // Lerp tone mapping exposure toward theme target
    const currExp = renderer.toneMappingExposure;
    const diff = this._vrTargetExposure - currExp;
    if (Math.abs(diff) > 0.001) {
      renderer.toneMappingExposure = currExp + diff * dt * 1.0;
    }

    // Decay damage flash
    if (this._damageFlash > 0) {
      this._damageFlash = Math.max(0, this._damageFlash - dt * 1.3);
      if (this._vrDamageMat) {
        this._vrDamageMat.opacity = this._damageFlash;
      }
    }
    // Decay kill flash (white additive on damage overlay)
    if (this._killFlash > 0) {
      this._killFlash = Math.max(0, this._killFlash - dt * 1.5);
      if (this._vrDamageMat) {
        // Blend kill flash as white over damage red
        if (this._killFlash > this._damageFlash) {
          this._vrDamageMat.color.setHex(0xffffff);
          this._vrDamageMat.opacity = this._killFlash;
        } else {
          this._vrDamageMat.color.setHex(0xcc1a0d);
        }
      }
    } else if (this._vrDamageMat && this._damageFlash > 0) {
      this._vrDamageMat.color.setHex(0xcc1a0d);
    }

    // Low-HP vignette pulse
    if (this._vrVignetteMat) {
      if (this._lowHpPulse) {
        this._lowHpPhase += dt * Math.PI * 2;
        this._vrVignetteMat.opacity = 0.3 + Math.sin(this._lowHpPhase) * 0.15;
      } else {
        this._vrVignetteMat.opacity = this.data.vignetteIntensity;
      }
    }
  },

  update(oldData) {
    if (!this._ready) return;
    if (this.data.threshold !== oldData.threshold) {
      this._brightMat.uniforms.threshold.value = this.data.threshold;
    }
    if (this.data.strength !== oldData.strength) {
      this._compositeMat.uniforms.strength.value = this.data.strength;
    }
    if (this.data.radius !== oldData.radius) {
      this._blurHMat.uniforms.radius.value = this.data.radius;
      this._blurVMat.uniforms.radius.value = this.data.radius;
    }
    if (this._compositeMat) {
      if (this.data.vignette !== oldData.vignette) {
        this._compositeMat.uniforms.uVignetteEnabled.value = this.data.vignette ? 1.0 : 0.0;
      }
      if (this.data.vignetteIntensity !== oldData.vignetteIntensity) {
        this._compositeMat.uniforms.uVignetteIntensity.value = this.data.vignetteIntensity;
      }
      if (this.data.exposure !== oldData.exposure) {
        this._compositeMat.uniforms.uExposure.value = this.data.exposure;
      }
      if (this.data.colorGrading !== oldData.colorGrading) {
        this._compositeMat.uniforms.uGradingEnabled.value = this.data.colorGrading ? 1.0 : 0.0;
      }
    }
  },

  _onResize() {
    if (!this._ready) return;
    const renderer = this.el.renderer;
    const size = renderer.getSize(new THREE.Vector2());
    const pr = renderer.getPixelRatio();
    const w = size.x * pr;
    const h = size.y * pr;

    this._rtScene.setSize(w, h);
    this._rtBright.setSize(w / 2, h / 2);
    this._rtBlurH.setSize(w / 2, h / 2);
    this._rtBlurV.setSize(w / 2, h / 2);

    const halfRes = new THREE.Vector2(w / 2, h / 2);
    this._blurHMat.uniforms.resolution.value.copy(halfRes);
    this._blurVMat.uniforms.resolution.value.copy(halfRes);
  },

  remove() {
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('player-damage', this._onDamage);
    document.removeEventListener('crosshair-kill', this._onKill);
    document.removeEventListener('hp-update', this._onHpUpdate);
    document.removeEventListener('theme-changed', this._onThemeChanged);
    // TASK-360: Cleanup VR listeners and overlays
    if (this._onSessionStart && this.el.renderer?.xr) {
      this.el.renderer.xr.removeEventListener('sessionstart', this._onSessionStart);
      this.el.renderer.xr.removeEventListener('sessionend', this._onSessionEnd);
    }
    this._removeVROverlays();
    if (this._origRenderFunc) {
      this.el.renderer.render = this._origRenderFunc;
    }
    [this._rtScene, this._rtBright, this._rtBlurH, this._rtBlurV].forEach(rt => {
      if (rt) rt.dispose();
    });
    [this._brightMat, this._blurHMat, this._blurVMat, this._compositeMat].forEach(m => {
      if (m) m.dispose();
    });
    if (this._quadGeo) this._quadGeo.dispose();
  },
});

// ---- GLSL Shaders ----

const VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG_BRIGHT = /* glsl */`
uniform sampler2D tDiffuse;
uniform float threshold;
varying vec2 vUv;
void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  if (brightness > threshold) {
    gl_FragColor = color;
  } else {
    gl_FragColor = vec4(0.0);
  }
}
`;

const FRAG_BLUR = /* glsl */`
uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform vec2 direction;
uniform float radius;
varying vec2 vUv;
void main() {
  vec2 texel = direction / resolution * radius;
  vec4 result = vec4(0.0);
  result += texture2D(tDiffuse, vUv - 4.0 * texel) * 0.0162;
  result += texture2D(tDiffuse, vUv - 3.0 * texel) * 0.0540;
  result += texture2D(tDiffuse, vUv - 2.0 * texel) * 0.1216;
  result += texture2D(tDiffuse, vUv - 1.0 * texel) * 0.1945;
  result += texture2D(tDiffuse, vUv)                * 0.2270;
  result += texture2D(tDiffuse, vUv + 1.0 * texel) * 0.1945;
  result += texture2D(tDiffuse, vUv + 2.0 * texel) * 0.1216;
  result += texture2D(tDiffuse, vUv + 3.0 * texel) * 0.0540;
  result += texture2D(tDiffuse, vUv + 4.0 * texel) * 0.0162;
  gl_FragColor = result;
}
`;

const FRAG_COMPOSITE = /* glsl */`
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float strength;
// TASK-332: Vignette & flash
uniform float uVignetteIntensity;
uniform float uVignetteEnabled;
uniform float uDamageFlash;
uniform float uKillFlash;
// TASK-333: Color grading & tone mapping
uniform float uExposure;
uniform float uColorTemp;
uniform float uSaturation;
uniform float uContrast;
uniform float uBrightness;
uniform float uGradingEnabled;
varying vec2 vUv;

// TASK-333: ACES Filmic tone mapping
vec3 ACESFilm(vec3 x) {
  float a = 2.51;
  float b = 0.03;
  float c = 2.43;
  float d = 0.59;
  float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec4 sceneColor = texture2D(tScene, vUv);
  vec4 bloomColor = texture2D(tBloom, vUv);

  // Bloom additive blend
  vec3 color = sceneColor.rgb + bloomColor.rgb * strength;

  // TASK-333: Exposure + tone mapping + color grading
  if (uGradingEnabled > 0.5) {
    // Exposure
    color *= uExposure;

    // ACES tone mapping
    color = ACESFilm(color);

    // Color temperature shift (warm = +R -B, cool = -R +B)
    color.r += uColorTemp * 0.1;
    color.b -= uColorTemp * 0.1;

    // Saturation
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(vec3(luma), color, uSaturation);

    // Contrast (pivot at 0.5)
    color = (color - 0.5) * uContrast + 0.5;

    // Brightness
    color += uBrightness;
  }

  // TASK-332: Damage flash (red tint)
  color = mix(color, vec3(0.8, 0.1, 0.05), uDamageFlash);

  // Kill flash (bright additive)
  color += vec3(uKillFlash);

  // TASK-332: Vignette
  if (uVignetteEnabled > 0.5) {
    float dist = distance(vUv, vec2(0.5));
    float vig = smoothstep(0.75, 0.35, dist);
    color *= mix(1.0, vig, uVignetteIntensity);
  }

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;
