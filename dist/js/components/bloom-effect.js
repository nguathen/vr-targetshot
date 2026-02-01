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
  },

  init() {
    this._ready = false;
    this._onResize = this._onResize.bind(this);
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

      // --- Composite shader (additive blend) ---
      this._compositeMat = new THREE.ShaderMaterial({
        uniforms: {
          tScene: { value: null },
          tBloom: { value: null },
          strength: { value: this.data.strength },
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
    } catch (e) {
      // Graceful fallback — bloom not supported
      console.warn('[bloom-effect] Setup failed, disabling:', e.message);
      this._ready = false;
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
varying vec2 vUv;
void main() {
  vec4 sceneColor = texture2D(tScene, vUv);
  vec4 bloomColor = texture2D(tBloom, vUv);
  gl_FragColor = sceneColor + bloomColor * strength;
}
`;
