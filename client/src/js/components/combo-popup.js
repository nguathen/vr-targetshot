/**
 * A-Frame component: spawns floating 3D combo milestone text.
 * Called from game-main when combo hits x5, x10, x15, x20, etc.
 *
 * Usage: document.dispatchEvent(new CustomEvent('combo-milestone', { detail: { combo: 10 } }))
 */
AFRAME.registerComponent('combo-popup-listener', {
  init() {
    this._onMilestone = this._onMilestone.bind(this);
    document.addEventListener('combo-milestone', this._onMilestone);
  },

  remove() {
    document.removeEventListener('combo-milestone', this._onMilestone);
  },

  _onMilestone(evt) {
    const combo = evt.detail?.combo || 5;
    const scene = this.el.sceneEl || this.el;

    // Position popup in front of camera
    const cam = document.getElementById('camera');
    if (!cam) return;
    const camPos = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    cam.object3D.getWorldPosition(camPos);
    cam.object3D.getWorldDirection(camDir);
    camDir.negate();

    const spawnPos = camPos.clone().add(camDir.multiplyScalar(2.5));
    // Slight random offset
    spawnPos.x += (Math.random() - 0.5) * 0.3;
    spawnPos.y += 0.2;

    // Color escalation
    let color = '#ffd700'; // gold default
    let scale = 1.0;
    if (combo >= 20) { color = '#ff00ff'; scale = 1.4; }
    else if (combo >= 15) { color = '#00ffff'; scale = 1.3; }
    else if (combo >= 10) { color = '#ff4400'; scale = 1.2; }

    const popup = document.createElement('a-text');
    popup.setAttribute('value', `x${combo} COMBO!`);
    popup.setAttribute('position', `${spawnPos.x} ${spawnPos.y} ${spawnPos.z}`);
    popup.setAttribute('color', color);
    popup.setAttribute('align', 'center');
    popup.setAttribute('width', String(3 * scale));
    popup.setAttribute('font', 'mozillavr');
    popup.setAttribute('shader', 'msdf');
    popup.setAttribute('negate', 'false');
    popup.setAttribute('look-at', '[camera]');
    popup.setAttribute('shadow', 'cast: false; receive: false');
    popup.setAttribute('scale', '0.01 0.01 0.01');

    // Elastic scale up
    popup.setAttribute('animation__scalein', {
      property: 'scale',
      from: '0.01 0.01 0.01',
      to: `${scale} ${scale} ${scale}`,
      dur: 300,
      easing: 'easeOutElastic',
    });

    // Drift upward
    popup.setAttribute('animation__drift', {
      property: 'position',
      to: `${spawnPos.x} ${spawnPos.y + 1.0} ${spawnPos.z}`,
      dur: 1200,
      easing: 'easeOutQuad',
    });

    // Fade out
    popup.setAttribute('animation__fade', {
      property: 'material.opacity',
      from: 1, to: 0,
      dur: 800,
      delay: 400,
      easing: 'easeInQuad',
    });

    scene.appendChild(popup);
    setTimeout(() => {
      if (popup.parentNode) popup.parentNode.removeChild(popup);
    }, 1300);
  },
});
