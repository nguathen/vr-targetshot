/**
 * Dissolve Shader Effect (TASK-322)
 * When attached to an entity, replaces its materials with a dissolve shader
 * and animates dissolution over the specified duration.
 *
 * Usage: el.setAttribute('dissolve-effect', 'color: #ff4444; duration: 400');
 */
AFRAME.registerComponent('dissolve-effect', {
  schema: {
    color: { type: 'color', default: '#ffffff' },
    duration: { type: 'number', default: 400 },
    edgeWidth: { type: 'number', default: 0.08 },
  },

  init() {
    this._startTime = performance.now();
    this._dissolved = false;
    this._origMaterials = new Map();

    // Apply dissolve shader to all meshes in this entity
    this.el.object3D.traverse((child) => {
      if (child.isMesh && child.material) {
        this._origMaterials.set(child, child.material);
        child.material = this._createDissolveMaterial(child.material);
      }
    });

    // Spawn edge particles if GPU particles available
    this._spawnEdgeParticles();

    // Play dissolve sound
    const am = window.__audioManager;
    if (am && am.playDissolve) {
      am.playDissolve();
    }
  },

  _createDissolveMaterial(origMat) {
    const color = origMat.color ? origMat.color.clone() : new THREE.Color(this.data.color);
    const edgeColor = new THREE.Color(this.data.color);

    return new THREE.ShaderMaterial({
      uniforms: {
        uProgress: { value: 0.0 },
        uColor: { value: color },
        uEdgeColor: { value: edgeColor },
        uEdgeWidth: { value: this.data.edgeWidth },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec3 vPosition;
        varying vec3 vNormal;
        void main() {
          vPosition = position;
          vNormal = normal;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uProgress;
        uniform vec3 uColor;
        uniform vec3 uEdgeColor;
        uniform float uEdgeWidth;
        uniform float uTime;
        varying vec3 vPosition;
        varying vec3 vNormal;

        // Simplex-like noise (cheap 3D hash)
        float hash(vec3 p) {
          p = fract(p * vec3(443.8975, 397.2973, 491.1871));
          p += dot(p, p.yzx + 19.19);
          return fract((p.x + p.y) * p.z);
        }

        float noise3D(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);

          float n000 = hash(i);
          float n001 = hash(i + vec3(0,0,1));
          float n010 = hash(i + vec3(0,1,0));
          float n011 = hash(i + vec3(0,1,1));
          float n100 = hash(i + vec3(1,0,0));
          float n101 = hash(i + vec3(1,0,1));
          float n110 = hash(i + vec3(1,1,0));
          float n111 = hash(i + vec3(1,1,1));

          float n00 = mix(n000, n100, f.x);
          float n01 = mix(n001, n101, f.x);
          float n10 = mix(n010, n110, f.x);
          float n11 = mix(n011, n111, f.x);

          float n0 = mix(n00, n10, f.y);
          float n1 = mix(n01, n11, f.y);

          return mix(n0, n1, f.z);
        }

        void main() {
          // Multi-octave noise for organic dissolve pattern
          float n = noise3D(vPosition * 5.0 + uTime * 0.5);
          n += noise3D(vPosition * 10.0) * 0.5;
          n += noise3D(vPosition * 20.0) * 0.25;
          n = n / 1.75;

          // Dissolve threshold
          float threshold = uProgress;
          if (n < threshold) discard;

          // Edge glow at dissolve boundary
          float edgeDist = n - threshold;
          float edgeFactor = smoothstep(0.0, uEdgeWidth, edgeDist);

          vec3 finalColor = mix(uEdgeColor * 3.0, uColor, edgeFactor);
          float alpha = mix(1.0, 0.8, 1.0 - edgeFactor);

          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  },

  tick(time) {
    if (this._dissolved) return;

    const elapsed = performance.now() - this._startTime;
    const progress = Math.min(elapsed / this.data.duration, 1.0);

    this.el.object3D.traverse((child) => {
      if (child.isMesh && child.material && child.material.uniforms) {
        child.material.uniforms.uProgress.value = progress;
        child.material.uniforms.uTime.value = time * 0.001;
      }
    });

    if (progress >= 1.0) {
      this._dissolved = true;
      // Remove entity after dissolve completes
      setTimeout(() => {
        if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
      }, 50);
    }
  },

  _spawnEdgeParticles() {
    const scene = this.el.sceneEl;
    if (!scene || !window.__spawnGPUBurst) return;

    const pos = this.el.object3D.position;
    window.__spawnGPUBurst(scene, {
      x: pos.x, y: pos.y, z: pos.z,
    }, {
      preset: 'burst',
      count: 10,
      color: this.data.color,
      size: 0.02,
      speed: 1.5,
      lifetime: this.data.duration,
      opacity: 0.6,
    });
  },

  remove() {
    // Restore original materials
    this._origMaterials.forEach((mat, mesh) => {
      if (mesh.material && mesh.material.dispose) {
        mesh.material.dispose();
      }
      mesh.material = mat;
    });
    this._origMaterials.clear();
  },
});
