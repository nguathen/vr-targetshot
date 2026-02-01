/**
 * A-Frame component: particle burst effect on target destruction.
 * Spawns sparks (fast, tiny, emissive) and debris (slower, tumbling, gravity).
 *
 * Usage: Emitted programmatically from target-hit.js
 */
AFRAME.registerComponent('particle-burst', {
  schema: {
    color: { type: 'color', default: '#ffffff' },
    count: { type: 'int', default: 15 },
    size: { type: 'number', default: 0.04 },
    speed: { type: 'number', default: 4 },
    lifetime: { type: 'int', default: 500 },
  },

  init() {
    const { color, count, size, speed, lifetime } = this.data;
    const pos = this.el.object3D.position;

    // 60% sparks (fast, tiny, emissive), 40% debris (slower, chunky, tumbling)
    const sparkCount = Math.ceil(count * 0.6);
    const debrisCount = count - sparkCount;

    // --- Sparks ---
    for (let i = 0; i < sparkCount; i++) {
      const frag = document.createElement('a-sphere');
      const s = size * (0.3 + Math.random() * 0.5);
      frag.setAttribute('radius', String(s));
      frag.setAttribute('material', `shader: flat; color: ${color}; emissive: ${color}; emissiveIntensity: 1.5; opacity: 1; transparent: true`);
      frag.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
      frag.setAttribute('shadow', 'cast: false; receive: false');

      const sparkSpeed = speed * (1.0 + Math.random() * 0.8);
      const vx = (Math.random() - 0.5) * sparkSpeed;
      const vy = (Math.random() - 0.1) * sparkSpeed;
      const vz = (Math.random() - 0.5) * sparkSpeed;
      const dist = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
      const norm = sparkSpeed / dist;
      const sparkLife = lifetime * (0.5 + Math.random() * 0.4);

      frag.setAttribute('animation__move', {
        property: 'position',
        to: `${pos.x + vx * norm * 0.4} ${pos.y + vy * norm * 0.4} ${pos.z + vz * norm * 0.4}`,
        dur: sparkLife,
        easing: 'easeOutQuad',
      });

      frag.setAttribute('animation__fade', {
        property: 'material.opacity',
        from: 1, to: 0,
        dur: sparkLife,
        easing: 'easeInQuad',
      });

      frag.setAttribute('animation__shrink', {
        property: 'scale',
        to: '0 0 0',
        dur: sparkLife,
        easing: 'easeInQuad',
      });

      this.el.sceneEl.appendChild(frag);
      setTimeout(() => {
        if (frag.parentNode) frag.parentNode.removeChild(frag);
      }, sparkLife + 50);
    }

    // --- Debris (chunky, slower, tumbling with gravity) ---
    const debrisGeos = ['a-box', 'a-tetrahedron', 'a-octahedron'];
    for (let i = 0; i < debrisCount; i++) {
      const geo = debrisGeos[Math.floor(Math.random() * debrisGeos.length)];
      const frag = document.createElement(geo);
      const s = size * (0.8 + Math.random() * 1.2);

      if (geo === 'a-box') {
        frag.setAttribute('width', String(s));
        frag.setAttribute('height', String(s));
        frag.setAttribute('depth', String(s));
      } else {
        frag.setAttribute('radius', String(s));
      }

      // Slightly desaturated color for debris
      frag.setAttribute('material', `shader: flat; color: ${color}; opacity: 0.9; transparent: true`);
      frag.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
      frag.setAttribute('shadow', 'cast: false; receive: false');

      const debrisSpeed = speed * (0.4 + Math.random() * 0.5);
      const vx = (Math.random() - 0.5) * debrisSpeed;
      const vy = (Math.random() * 0.6 + 0.2) * debrisSpeed; // upward bias
      const vz = (Math.random() - 0.5) * debrisSpeed;
      const debrisLife = lifetime * (0.8 + Math.random() * 0.4);

      // Debris arcs up then falls (gravity sim via two-step animation)
      const midY = pos.y + vy * 0.3;
      const endY = pos.y - 0.5; // fall below origin

      frag.setAttribute('animation__moveXZ', {
        property: 'position',
        to: `${pos.x + vx * 0.5} ${midY + (endY - midY) * 0.5} ${pos.z + vz * 0.5}`,
        dur: debrisLife,
        easing: 'easeOutQuad',
      });

      // Tumble rotation
      const rx = Math.random() * 720 - 360;
      const ry = Math.random() * 720 - 360;
      const rz = Math.random() * 720 - 360;
      frag.setAttribute('animation__tumble', {
        property: 'rotation',
        to: `${rx} ${ry} ${rz}`,
        dur: debrisLife,
        easing: 'linear',
      });

      frag.setAttribute('animation__fade', {
        property: 'material.opacity',
        from: 0.9, to: 0,
        dur: debrisLife,
        easing: 'easeInQuad',
      });

      frag.setAttribute('animation__shrink', {
        property: 'scale',
        from: '1 1 1', to: '0.2 0.2 0.2',
        dur: debrisLife,
        easing: 'easeInQuad',
      });

      this.el.sceneEl.appendChild(frag);
      setTimeout(() => {
        if (frag.parentNode) frag.parentNode.removeChild(frag);
      }, debrisLife + 50);
    }

    // Self-remove the burst entity
    setTimeout(() => {
      if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
    }, lifetime + 200);
  },
});
