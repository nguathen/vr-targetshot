/**
 * A-Frame component: floating ambient particles in the arena.
 * Spawns drifting dust/ember particles for atmosphere.
 *
 * Usage: <a-entity ambient-particles="count: 25; color: #4488ff; area: 20">
 */
AFRAME.registerComponent('ambient-particles', {
  schema: {
    count: { type: 'int', default: 25 },
    color: { type: 'color', default: '#4488ff' },
    color2: { type: 'color', default: '#ff44aa' },
    area: { type: 'number', default: 20 },
    height: { type: 'number', default: 8 },
  },

  init() {
    this._particles = [];
    this._spawn();
  },

  remove() {
    this._particles.forEach(p => { if (p.parentNode) p.parentNode.removeChild(p); });
    this._particles = [];
  },

  _spawn() {
    const { count, color, color2, area, height } = this.data;
    const scene = this.el.sceneEl;
    if (!scene) return;

    for (let i = 0; i < count; i++) {
      const p = document.createElement('a-sphere');
      const x = (Math.random() - 0.5) * area;
      const y = 0.5 + Math.random() * height;
      const z = (Math.random() - 0.5) * area;
      const size = 0.01 + Math.random() * 0.025;
      const c = Math.random() > 0.5 ? color : color2;
      const opacity = 0.15 + Math.random() * 0.25;

      p.setAttribute('position', `${x} ${y} ${z}`);
      p.setAttribute('radius', String(size));
      p.setAttribute('material', `shader: flat; color: ${c}; emissive: ${c}; emissiveIntensity: 0.8; opacity: ${opacity}; transparent: true`);
      p.setAttribute('shadow', 'cast: false; receive: false');

      // Slow drift animation
      const dur = 8000 + Math.random() * 12000;
      const dx = x + (Math.random() - 0.5) * 4;
      const dy = y + (Math.random() - 0.5) * 2;
      const dz = z + (Math.random() - 0.5) * 4;

      p.setAttribute('animation__drift', {
        property: 'position',
        to: `${dx} ${dy} ${dz}`,
        dur, easing: 'linear', loop: true, dir: 'alternate',
      });

      // Pulse opacity
      p.setAttribute('animation__pulse', {
        property: 'material.opacity',
        from: opacity * 0.5, to: opacity,
        dur: 3000 + Math.random() * 4000,
        loop: true, dir: 'alternate', easing: 'easeInOutSine',
      });

      scene.appendChild(p);
      this._particles.push(p);
    }
  },
});
