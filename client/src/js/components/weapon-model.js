/**
 * A-Frame component: procedural geometric gun model attached to hand.
 * Builds a different shape per weapon type (pistol/shotgun/sniper).
 * Listens for weapon changes and does a scale swap transition.
 *
 * Usage: <a-entity weapon-model>
 */
AFRAME.registerComponent('weapon-model', {
  init() {
    this._currentWeapon = null;
    this._container = document.createElement('a-entity');
    this._container.setAttribute('position', '0 -0.02 -0.08');
    this._container.setAttribute('rotation', '-20 0 0');
    this.el.appendChild(this._container);

    // Build initial weapon after scene is ready
    this._buildTimeout = setTimeout(() => {
      const ws = window.__weaponSystem;
      if (ws) {
        this._buildWeapon(ws.current);
        ws.onChange((weapon) => this._swapWeapon(weapon));
      } else {
        this._buildWeapon({ id: 'pistol', laserColor: '#ff4444' });
      }
    }, 500);
  },

  remove() {
    if (this._buildTimeout) clearTimeout(this._buildTimeout);
    if (this._container.parentNode) this._container.parentNode.removeChild(this._container);
  },

  _swapWeapon(weapon) {
    if (this._currentWeapon === weapon.id) return;

    // Scale down, rebuild, scale up
    this._container.setAttribute('animation__down', {
      property: 'scale', to: '0 0 0', dur: 80, easing: 'easeInQuad',
    });

    setTimeout(() => {
      this._clearParts();
      this._buildWeapon(weapon);
      this._container.setAttribute('scale', '0 0 0');
      this._container.setAttribute('animation__up', {
        property: 'scale', to: '1 1 1', dur: 120, easing: 'easeOutBack',
      });
    }, 90);
  },

  _clearParts() {
    while (this._container.firstChild) {
      this._container.removeChild(this._container.firstChild);
    }
  },

  _buildWeapon(weapon) {
    this._currentWeapon = weapon.id;
    const color = weapon.laserColor || '#ff4444';
    const mat = `shader: flat; color: ${color}; emissive: ${color}; emissiveIntensity: 0.3; opacity: 0.9; transparent: true`;
    const darkMat = `shader: flat; color: #222233; emissive: ${color}; emissiveIntensity: 0.15; opacity: 0.95; transparent: true`;

    if (weapon.id === 'shotgun') {
      this._buildShotgun(mat, darkMat, color);
    } else if (weapon.id === 'sniper') {
      this._buildSniper(mat, darkMat, color);
    } else if (weapon.id === 'smg') {
      this._buildSmg(mat, darkMat, color);
    } else if (weapon.id === 'railgun') {
      this._buildRailgun(mat, darkMat, color);
    } else {
      this._buildPistol(mat, darkMat, color);
    }
  },

  _buildPistol(mat, darkMat, color) {
    // Barrel
    const barrel = this._box(0, 0, -0.04, 0.015, 0.015, 0.08, darkMat);
    this._container.appendChild(barrel);
    // Body
    const body = this._box(0, -0.01, 0, 0.02, 0.025, 0.05, mat);
    this._container.appendChild(body);
    // Grip
    const grip = this._box(0, -0.035, 0.015, 0.016, 0.03, 0.018, darkMat);
    this._container.appendChild(grip);
    // Muzzle glow
    const muzzle = this._sphere(0, 0, -0.085, 0.008, `shader: flat; color: ${color}; emissive: ${color}; emissiveIntensity: 1; opacity: 0.7; transparent: true`);
    this._container.appendChild(muzzle);
  },

  _buildShotgun(mat, darkMat, color) {
    // Double barrel
    const b1 = this._box(-0.008, 0, -0.05, 0.012, 0.014, 0.12, darkMat);
    const b2 = this._box(0.008, 0, -0.05, 0.012, 0.014, 0.12, darkMat);
    this._container.appendChild(b1);
    this._container.appendChild(b2);
    // Body
    const body = this._box(0, -0.012, 0.01, 0.03, 0.022, 0.05, mat);
    this._container.appendChild(body);
    // Grip
    const grip = this._box(0, -0.038, 0.025, 0.018, 0.032, 0.02, darkMat);
    this._container.appendChild(grip);
    // Pump
    const pump = this._box(0, -0.005, -0.02, 0.026, 0.018, 0.03, mat);
    this._container.appendChild(pump);
    // Muzzle glow
    const m = this._sphere(0, 0, -0.115, 0.012, `shader: flat; color: ${color}; emissive: ${color}; emissiveIntensity: 1; opacity: 0.7; transparent: true`);
    this._container.appendChild(m);
  },

  _buildSniper(mat, darkMat, color) {
    // Long barrel
    const barrel = this._box(0, 0, -0.07, 0.01, 0.01, 0.16, darkMat);
    this._container.appendChild(barrel);
    // Body
    const body = this._box(0, -0.008, 0.02, 0.018, 0.022, 0.06, mat);
    this._container.appendChild(body);
    // Scope
    const scope = this._cylinder(0, 0.018, -0.02, 0.007, 0.04, mat);
    this._container.appendChild(scope);
    // Scope lens
    const lens = this._sphere(0, 0.018, -0.042, 0.007, `shader: flat; color: ${color}; emissive: ${color}; emissiveIntensity: 0.8; opacity: 0.6; transparent: true`);
    this._container.appendChild(lens);
    // Stock
    const stock = this._box(0, -0.01, 0.065, 0.016, 0.028, 0.04, darkMat);
    this._container.appendChild(stock);
    // Grip
    const grip = this._box(0, -0.035, 0.03, 0.014, 0.028, 0.016, darkMat);
    this._container.appendChild(grip);
    // Muzzle glow
    const m = this._sphere(0, 0, -0.155, 0.006, `shader: flat; color: ${color}; emissive: ${color}; emissiveIntensity: 1; opacity: 0.7; transparent: true`);
    this._container.appendChild(m);
  },

  _buildSmg(mat, darkMat, color) {
    // Compact body with foregrip
    const barrel = this._box(0, 0, -0.04, 0.013, 0.013, 0.07, darkMat);
    this._container.appendChild(barrel);
    const body = this._box(0, -0.008, 0.005, 0.022, 0.024, 0.055, mat);
    this._container.appendChild(body);
    const mag = this._box(0, -0.032, 0.01, 0.012, 0.025, 0.012, darkMat);
    this._container.appendChild(mag);
    const grip = this._box(0, -0.032, 0.025, 0.015, 0.025, 0.016, darkMat);
    this._container.appendChild(grip);
    const foregrip = this._box(0, -0.018, -0.025, 0.012, 0.018, 0.015, mat);
    this._container.appendChild(foregrip);
    const stock = this._box(0, -0.005, 0.055, 0.01, 0.018, 0.025, darkMat);
    this._container.appendChild(stock);
    const muzzle = this._sphere(0, 0, -0.078, 0.008, `shader: flat; color: ${color}; emissive: ${color}; emissiveIntensity: 1; opacity: 0.7; transparent: true`);
    this._container.appendChild(muzzle);
  },

  _buildRailgun(mat, darkMat, color) {
    // Long barrel with coils
    const barrel = this._box(0, 0, -0.06, 0.012, 0.012, 0.14, darkMat);
    this._container.appendChild(barrel);
    // Coil rings along barrel
    for (let i = 0; i < 3; i++) {
      const coil = document.createElement('a-torus');
      coil.setAttribute('position', `0 0 ${-0.02 - i * 0.035}`);
      coil.setAttribute('rotation', '90 0 0');
      coil.setAttribute('radius', '0.016');
      coil.setAttribute('radius-tubular', '0.003');
      coil.setAttribute('material', mat);
      coil.setAttribute('shadow', 'cast: true; receive: false');
      this._container.appendChild(coil);
    }
    const body = this._box(0, -0.01, 0.02, 0.024, 0.028, 0.06, mat);
    this._container.appendChild(body);
    const grip = this._box(0, -0.038, 0.03, 0.015, 0.03, 0.018, darkMat);
    this._container.appendChild(grip);
    // Charge glow at muzzle
    const glow = this._sphere(0, 0, -0.135, 0.01, `shader: flat; color: ${color}; emissive: ${color}; emissiveIntensity: 2; opacity: 0.8; transparent: true`);
    this._container.appendChild(glow);
  },

  _box(x, y, z, w, h, d, material) {
    const el = document.createElement('a-box');
    el.setAttribute('position', `${x} ${y} ${z}`);
    el.setAttribute('width', String(w));
    el.setAttribute('height', String(h));
    el.setAttribute('depth', String(d));
    el.setAttribute('material', material);
    el.setAttribute('shadow', 'cast: true; receive: false');
    return el;
  },

  _cylinder(x, y, z, r, h, material) {
    const el = document.createElement('a-cylinder');
    el.setAttribute('position', `${x} ${y} ${z}`);
    el.setAttribute('radius', String(r));
    el.setAttribute('height', String(h));
    el.setAttribute('rotation', '90 0 0');
    el.setAttribute('material', material);
    el.setAttribute('shadow', 'cast: true; receive: false');
    return el;
  },

  _sphere(x, y, z, r, material) {
    const el = document.createElement('a-sphere');
    el.setAttribute('position', `${x} ${y} ${z}`);
    el.setAttribute('radius', String(r));
    el.setAttribute('material', material);
    el.setAttribute('shadow', 'cast: false; receive: false');
    return el;
  },
});
