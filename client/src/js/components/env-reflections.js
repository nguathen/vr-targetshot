/**
 * A-Frame component: Environment Map Reflections (TASK-340)
 * Generates procedural cubemap per theme using PMREMGenerator.
 * Applies to scene.environment so all PBR materials receive reflections.
 *
 * Also generates procedural floor normal maps per theme (TASK-341).
 *
 * Usage: <a-scene env-reflections>
 */
/* global AFRAME, THREE */
AFRAME.registerComponent('env-reflections', {
  schema: {
    enabled: { type: 'boolean', default: true },
    floorDetail: { type: 'boolean', default: true },
  },

  init() {
    this._envCache = {};
    this._normalCache = {};
    this._currentTheme = 'cyber';
    // TASK-381: Async initialization flags
    this._pmremReady = false;
    this._pendingTheme = null;

    this._onThemeChanged = (e) => {
      const theme = e.detail?.theme || 'cyber';
      if (theme !== this._currentTheme) {
        this._currentTheme = theme;
        // TASK-381: Defer env map generation to next frame
        this._scheduleEnvMapGeneration(theme);
        // TASK-381: Defer normal map to frame after that
        if (this.data.floorDetail) {
          setTimeout(() => this._applyFloorNormal(theme), 32);
        }
      }
    };
    document.addEventListener('theme-changed', this._onThemeChanged);

    if (this.el.hasLoaded) {
      this._setup();
    } else {
      this.el.addEventListener('loaded', () => this._setup(), { once: true });
    }
  },

  _setup() {
    const renderer = this.el.renderer;
    if (!renderer) return;

    // TASK-381: Only create PMREMGenerator here — defer shader compilation
    this._pmrem = new THREE.PMREMGenerator(renderer);
    // DON'T call compileCubemapShader() here — let it compile lazily on first use
    this._pmremReady = true;

    // Check settings
    const settings = typeof window.__getSettings === 'function' ? window.__getSettings() : {};
    if (settings.reflections === false) return;

    // TASK-381: Defer initial env map generation to next frame (after scene render)
    setTimeout(() => {
      this._applyEnvMap(this._currentTheme);
      if (this.data.floorDetail && settings.floorDetail !== false) {
        // Defer normal map one more frame
        setTimeout(() => this._applyFloorNormal(this._currentTheme), 16);
      }
    }, 16);
  },

  // TASK-381: Schedule env map generation for next frame
  _scheduleEnvMapGeneration(theme) {
    if (this._pendingTheme === theme) return;
    this._pendingTheme = theme;
    setTimeout(() => {
      if (this._pendingTheme === theme) {
        this._applyEnvMap(theme);
        this._pendingTheme = null;
      }
    }, 16);
  },

  _applyEnvMap(themeId) {
    if (!this._pmrem || !this.data.enabled) return;

    // Check settings at runtime
    const settings = typeof window.__getSettings === 'function' ? window.__getSettings() : {};
    if (settings.reflections === false) {
      this.el.object3D.environment = null;
      return;
    }

    // Use cached if available
    if (this._envCache[themeId]) {
      this.el.object3D.environment = this._envCache[themeId];
      return;
    }

    const envMap = this._generateEnvMap(themeId);
    this._envCache[themeId] = envMap;
    this.el.object3D.environment = envMap;
  },

  _generateEnvMap(themeId) {
    const presets = {
      cyber: {
        sky: 0x0c0c24,
        lights: [
          { color: 0x4466ff, pos: [0, 5, -10], intensity: 2 },
          { color: 0xff44aa, pos: [-8, 3, 5], intensity: 1 },
          { color: 0x00d4ff, pos: [5, 8, 3], intensity: 1.5 },
        ],
      },
      sunset: {
        sky: 0x2a1510,
        lights: [
          { color: 0xff8844, pos: [0, 8, -10], intensity: 3 },
          { color: 0xffcc44, pos: [-5, 4, 5], intensity: 1.5 },
          { color: 0xff6622, pos: [6, 2, -3], intensity: 1 },
        ],
      },
      space: {
        sky: 0x050510,
        lights: [
          { color: 0x2244ff, pos: [0, 6, -10], intensity: 1.5 },
          { color: 0x6644ff, pos: [-6, 4, 5], intensity: 1 },
          { color: 0x4488ff, pos: [8, 8, 0], intensity: 0.8 },
        ],
      },
      underwater: {
        sky: 0x041520,
        lights: [
          { color: 0x00aa88, pos: [0, 10, -5], intensity: 2 },
          { color: 0x44ddff, pos: [-5, 3, 8], intensity: 1.2 },
          { color: 0x008866, pos: [6, 6, -8], intensity: 1 },
        ],
      },
      neon: {
        sky: 0x0a0a20,
        lights: [
          { color: 0xff00ff, pos: [0, 5, -10], intensity: 2.5 },
          { color: 0x00ffff, pos: [-8, 4, 5], intensity: 2 },
          { color: 0xff44aa, pos: [5, 8, 3], intensity: 1.5 },
        ],
      },
      day: {
        sky: 0x8899bb,
        lights: [
          { color: 0xffffff, pos: [5, 10, -5], intensity: 3 },
          { color: 0xaabbdd, pos: [-5, 3, 8], intensity: 1 },
          { color: 0xffeedd, pos: [0, 8, 0], intensity: 1.5 },
        ],
      },
    };

    const preset = presets[themeId] || presets.cyber;

    // Build a tiny scene for cubemap rendering
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(preset.sky);

    // Gradient sphere for sky variation
    const skyGeo = new THREE.SphereGeometry(20, 16, 8);
    const skyMat = new THREE.MeshBasicMaterial({
      color: preset.sky,
      side: THREE.BackSide,
    });
    envScene.add(new THREE.Mesh(skyGeo, skyMat));

    // Colored lights
    preset.lights.forEach(l => {
      const light = new THREE.PointLight(l.color, l.intensity, 40);
      light.position.set(l.pos[0], l.pos[1], l.pos[2]);
      envScene.add(light);

      // Small emissive sphere at light position for reflection hotspots
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 8, 4),
        new THREE.MeshBasicMaterial({ color: l.color }),
      );
      glow.position.copy(light.position);
      envScene.add(glow);
    });

    // Ambient fill
    envScene.add(new THREE.AmbientLight(preset.sky, 0.3));

    // Generate PMREM from scene — 128x128 resolution
    const renderTarget = this._pmrem.fromScene(envScene, 0, 0.1, 100);
    const envMap = renderTarget.texture;

    // Clean up temp scene
    envScene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });

    return envMap;
  },

  // TASK-341: Procedural floor normal maps
  _applyFloorNormal(themeId) {
    const scene = this.el.object3D;
    if (!scene) return;

    const normalTex = this._getOrGenerateNormal(themeId);
    if (!normalTex) return;

    // Find floor plane — first large horizontal plane with metalness
    this._traverseFloorMeshes(scene, (mesh) => {
      if (mesh.material && mesh.material.isMeshStandardMaterial) {
        mesh.material.normalMap = normalTex;
        mesh.material.normalScale = new THREE.Vector2(0.3, 0.3);
        mesh.material.needsUpdate = true;
      }
    });
  },

  _traverseFloorMeshes(obj, callback) {
    // Find the floor: large horizontal plane near y=0
    obj.traverse(child => {
      if (!child.isMesh) return;
      const wp = new THREE.Vector3();
      child.getWorldPosition(wp);
      // Floor is at y~0, rotated -90 on x, and is a large plane
      if (Math.abs(wp.y) < 0.5 && child.geometry) {
        const box = new THREE.Box3().setFromObject(child);
        const size = box.getSize(new THREE.Vector3());
        // Must be wide and flat (floor-like)
        if (size.x > 10 && size.z > 10 && size.y < 2) {
          callback(child);
        }
      }
    });
  },

  _getOrGenerateNormal(themeId) {
    if (this._normalCache[themeId]) return this._normalCache[themeId];

    // TASK-381: Reduced from 512×512 to 256×256 for faster generation
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Fill with neutral normal (pointing up: 128, 128, 255)
    ctx.fillStyle = 'rgb(128, 128, 255)';
    ctx.fillRect(0, 0, 256, 256);

    const generators = {
      cyber: () => this._drawHexGrid(ctx),
      sunset: () => this._drawCrackedTiles(ctx),
      space: () => this._drawMetalPanels(ctx),
      underwater: () => this._drawRipples(ctx),
      neon: () => this._drawGlowGrid(ctx),
      day: () => this._drawConcrete(ctx),
    };

    const gen = generators[themeId] || generators.cyber;
    gen();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 8);

    this._normalCache[themeId] = texture;
    return texture;
  },

  // Normal map helpers — draw patterns that encode surface normals
  // Normal color: R=X, G=Y, B=Z; neutral=(128,128,255)
  // TASK-381: Updated to use 256×256 canvas
  _drawHexGrid(ctx) {
    const w = 256, h = 256;
    const hexR = 20; // Scaled down from 32
    const hexH = hexR * Math.sqrt(3);

    ctx.strokeStyle = 'rgb(138, 138, 240)';
    ctx.lineWidth = 1.5;

    for (let row = -1; row < h / hexH + 1; row++) {
      for (let col = -1; col < w / (hexR * 1.5) + 1; col++) {
        const cx = col * hexR * 1.5;
        const cy = row * hexH + (col % 2 ? hexH / 2 : 0);
        this._drawHexagon(ctx, cx, cy, hexR - 2);
      }
    }

    // Circuit traces
    ctx.strokeStyle = 'rgb(148, 128, 245)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) { // Reduced from 12
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      let px = x, py = y;
      for (let j = 0; j < 3; j++) { // Reduced from 4
        const dir = Math.floor(Math.random() * 4);
        const len = 15 + Math.random() * 25; // Scaled down
        if (dir === 0) px += len;
        else if (dir === 1) px -= len;
        else if (dir === 2) py += len;
        else py -= len;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  },

  _drawHexagon(ctx, cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  },

  _drawCrackedTiles(ctx) {
    const w = 256, h = 256;
    // Stone tile grid
    const tileSize = 42; // Scaled from 64
    ctx.strokeStyle = 'rgb(118, 118, 245)';
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Cracks
    ctx.strokeStyle = 'rgb(108, 118, 240)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) { // Reduced from 8
      let x = Math.random() * w;
      let y = Math.random() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let j = 0; j < 4; j++) { // Reduced from 6
        x += (Math.random() - 0.5) * 20; // Scaled from 30
        y += (Math.random() - 0.5) * 20;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  },

  _drawMetalPanels(ctx) {
    const w = 256, h = 256;
    const panelW = 52, panelH = 52; // Scaled from 80

    // Panel seams — darker indent
    ctx.strokeStyle = 'rgb(118, 118, 240)';
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += panelW) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += panelH) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Rivet dots at panel corners
    ctx.fillStyle = 'rgb(148, 148, 250)';
    for (let x = 0; x < w; x += panelW) {
      for (let y = 0; y < h; y += panelH) {
        ctx.beginPath();
        ctx.arc(x + 5, y + 5, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + panelW - 5, y + 5, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 5, y + panelH - 5, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + panelW - 5, y + panelH - 5, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  _drawRipples(ctx) {
    const w = 256, h = 256;
    // Concentric ripple rings from several centers (scaled positions)
    const centers = [
      { x: 64, y: 64 }, { x: 192, y: 128 },
      { x: 100, y: 200 }, { x: 200, y: 50 },
    ];

    ctx.strokeStyle = 'rgb(133, 138, 248)';
    ctx.lineWidth = 1;

    centers.forEach(c => {
      for (let r = 10; r < 70; r += 12) { // Scaled from 15-120, step 18
        ctx.beginPath();
        ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // Sandy noise dots (reduced from 200)
    ctx.fillStyle = 'rgb(132, 125, 250)';
    for (let i = 0; i < 80; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  _drawGlowGrid(ctx) {
    const w = 256, h = 256;
    const spacing = 26; // Scaled from 40

    // Grid lines with stronger normals at intersections
    ctx.strokeStyle = 'rgb(143, 128, 248)';
    ctx.lineWidth = 1;

    for (let x = 0; x < w; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Brighter nodes at intersections
    ctx.fillStyle = 'rgb(158, 128, 252)';
    for (let x = 0; x < w; x += spacing) {
      for (let y = 0; y < h; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2); // Scaled from 4
        ctx.fill();
      }
    }
  },

  _drawConcrete(ctx) {
    const w = 256, h = 256;
    // TASK-381: Reduced from 512×512 (262K pixels) to 256×256 (65K pixels) — 4x faster
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 6;
      data[i] = 128 + noise;       // R (X normal)
      data[i + 1] = 128 + noise;   // G (Y normal)
      data[i + 2] = 255;           // B (Z normal — always up)
      data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);

    // Sparse hairline cracks
    ctx.strokeStyle = 'rgb(122, 122, 248)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) { // Reduced from 5
      let x = Math.random() * w;
      let y = Math.random() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let j = 0; j < 3; j++) {
        x += (Math.random() - 0.5) * 30; // Scaled from 50
        y += (Math.random() - 0.5) * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  },

  remove() {
    document.removeEventListener('theme-changed', this._onThemeChanged);

    // Dispose cached env maps
    Object.values(this._envCache).forEach(tex => {
      if (tex && tex.dispose) tex.dispose();
    });
    Object.values(this._normalCache).forEach(tex => {
      if (tex && tex.dispose) tex.dispose();
    });

    if (this._pmrem) {
      this._pmrem.dispose();
    }

    // Clear scene environment
    if (this.el.object3D) {
      this.el.object3D.environment = null;
    }
  },
});
