/**
 * A-Frame component: floating damage number.
 * Shows points earned floating upward from hit position.
 *
 * Usage: Spawned programmatically from target-system.js
 */
AFRAME.registerComponent('damage-number', {
  schema: {
    text: { type: 'string', default: '+10' },
    color: { type: 'color', default: '#ffffff' },
  },

  init() {
    const { text, color } = this.data;
    const pos = this.el.object3D.position;

    this.el.setAttribute('text', {
      value: text,
      align: 'center',
      color: color,
      width: 4,
      font: 'mozillavr',
    });

    this.el.setAttribute('look-at', '[camera]');

    this.el.setAttribute('animation__rise', {
      property: 'position',
      to: `${pos.x} ${pos.y + 0.6} ${pos.z}`,
      dur: 800,
      easing: 'easeOutQuad',
    });

    this.el.setAttribute('animation__fade', {
      property: 'text.opacity',
      to: 0,
      dur: 800,
      easing: 'easeInQuad',
    });

    this.el.setAttribute('animation__grow', {
      property: 'scale',
      from: '0.5 0.5 0.5',
      to: '1 1 1',
      dur: 200,
      easing: 'easeOutBack',
    });

    setTimeout(() => {
      if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
    }, 850);
  },
});
