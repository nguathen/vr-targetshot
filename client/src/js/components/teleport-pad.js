/**
 * A-Frame component: teleport pads placed around the arena.
 * Player looks at a pad and clicks to teleport with a comfort vignette transition.
 *
 * Usage: <a-entity teleport-pad="target: 0 0 -8">
 */
AFRAME.registerComponent('teleport-pad', {
  schema: {
    target: { type: 'vec3', default: { x: 0, y: 0, z: 0 } },
  },

  init() {
    this._onHover = this._onHover.bind(this);
    this._onLeave = this._onLeave.bind(this);
    this._onClick = this._onClick.bind(this);

    this.el.addEventListener('mouseenter', this._onHover);
    this.el.addEventListener('mouseleave', this._onLeave);
    this.el.addEventListener('click', this._onClick);
    this.el.classList.add('clickable');
  },

  remove() {
    this.el.removeEventListener('mouseenter', this._onHover);
    this.el.removeEventListener('mouseleave', this._onLeave);
    this.el.removeEventListener('click', this._onClick);
  },

  _onHover() {
    this.el.setAttribute('material', 'opacity', 0.6);
  },

  _onLeave() {
    this.el.setAttribute('material', 'opacity', 0.25);
  },

  _onClick() {
    const rig = document.getElementById('player-rig');
    if (!rig) return;

    const t = this.data.target;

    // Show comfort vignette
    let vignette = document.getElementById('teleport-vignette');
    if (!vignette) {
      vignette = document.createElement('div');
      vignette.id = 'teleport-vignette';
      vignette.className = 'teleport-vignette';
      document.body.appendChild(vignette);
    }

    vignette.classList.add('active');

    // Teleport after vignette covers screen
    setTimeout(() => {
      rig.object3D.position.set(t.x, 0, t.z);
      // Fade out
      setTimeout(() => {
        vignette.classList.remove('active');
      }, 150);
    }, 200);
  },
});
