/**
 * A-Frame component: crosshair reacts to hit/miss/kill events.
 * - Hit: expands + white flash + "X" hit marker
 * - Miss/decoy: shrinks + red flash
 * - Kill: gold flash + skull icon
 *
 * Attach to the crosshair ring: <a-ring crosshair-feedback>
 * Listens to document-level custom events dispatched by target-system.
 */
AFRAME.registerComponent('crosshair-feedback', {
  init() {
    this._onHit = this._onHit.bind(this);
    this._onMiss = this._onMiss.bind(this);
    this._onKill = this._onKill.bind(this);
    this._timeout = null;
    this._killTimeout = null;

    // Cache refs
    this._ring = this.el;
    this._dot = document.getElementById('crosshair-dot');
    this._outer = document.getElementById('crosshair-outer');
    this._origColor = null;
    this._hitMarker = null;

    document.addEventListener('crosshair-hit', this._onHit);
    document.addEventListener('crosshair-miss', this._onMiss);
    document.addEventListener('crosshair-kill', this._onKill);
  },

  remove() {
    document.removeEventListener('crosshair-hit', this._onHit);
    document.removeEventListener('crosshair-miss', this._onMiss);
    document.removeEventListener('crosshair-kill', this._onKill);
    if (this._timeout) clearTimeout(this._timeout);
    if (this._killTimeout) clearTimeout(this._killTimeout);
  },

  _saveOrigColor() {
    if (!this._origColor) {
      this._origColor = this._ring.getAttribute('material')?.color || '#00ff88';
    }
  },

  _resetColor() {
    if (this._origColor) {
      this._ring.setAttribute('material', 'color', this._origColor);
      if (this._dot) this._dot.setAttribute('material', 'color', this._origColor);
      if (this._outer) this._outer.setAttribute('material', 'color', this._origColor);
    }
  },

  _onHit() {
    this._saveOrigColor();
    if (this._timeout) clearTimeout(this._timeout);

    // White flash
    this._ring.setAttribute('material', 'color', '#ffffff');
    if (this._dot) this._dot.setAttribute('material', 'color', '#ffffff');

    // Expand crosshair briefly
    this._ring.setAttribute('animation__hitpop', {
      property: 'geometry.radiusOuter',
      from: 0.02, to: 0.015,
      dur: 120, easing: 'easeOutQuad',
    });

    // Show hit marker (X shape via text)
    this._showHitMarker('#ffffff');

    this._timeout = setTimeout(() => {
      this._resetColor();
      this._timeout = null;
    }, 100);
  },

  _onMiss() {
    this._saveOrigColor();
    if (this._timeout) clearTimeout(this._timeout);

    // Red flash
    this._ring.setAttribute('material', 'color', '#ff2222');
    if (this._dot) this._dot.setAttribute('material', 'color', '#ff2222');

    // Shrink briefly
    this._ring.setAttribute('animation__misspop', {
      property: 'geometry.radiusOuter',
      from: 0.01, to: 0.015,
      dur: 150, easing: 'easeOutQuad',
    });

    this._timeout = setTimeout(() => {
      this._resetColor();
      this._timeout = null;
    }, 150);
  },

  _onKill() {
    this._saveOrigColor();
    if (this._killTimeout) clearTimeout(this._killTimeout);

    // Gold flash
    this._ring.setAttribute('material', 'color', '#ffd700');
    if (this._dot) this._dot.setAttribute('material', 'color', '#ffd700');
    if (this._outer) this._outer.setAttribute('material', 'color', '#ffd700');

    // Expand outer ring
    if (this._outer) {
      this._outer.setAttribute('animation__killpop', {
        property: 'geometry.radiusOuter',
        from: 0.035, to: 0.027,
        dur: 200, easing: 'easeOutElastic',
      });
    }

    // Show kill marker
    this._showHitMarker('#ffd700', true);

    this._killTimeout = setTimeout(() => {
      this._resetColor();
      this._killTimeout = null;
    }, 250);
  },

  _showHitMarker(color, isKill) {
    // Remove previous marker
    if (this._hitMarker && this._hitMarker.parentNode) {
      this._hitMarker.parentNode.removeChild(this._hitMarker);
    }

    const marker = document.createElement('a-text');
    marker.setAttribute('value', isKill ? '✕' : '×');
    marker.setAttribute('position', '0 0 -0.998');
    marker.setAttribute('align', 'center');
    marker.setAttribute('color', color);
    marker.setAttribute('scale', isKill ? '0.12 0.12 0.12' : '0.08 0.08 0.08');
    marker.setAttribute('font', 'mozillavr');
    marker.setAttribute('material', `shader: flat; opacity: 1`);

    // Fade + scale out
    const dur = isKill ? 300 : 180;
    marker.setAttribute('animation__fade', {
      property: 'material.opacity', from: 1, to: 0,
      dur, easing: 'easeInQuad',
    });
    marker.setAttribute('animation__grow', {
      property: 'scale',
      from: isKill ? '0.12 0.12 0.12' : '0.08 0.08 0.08',
      to: isKill ? '0.2 0.2 0.2' : '0.14 0.14 0.14',
      dur, easing: 'easeOutQuad',
    });

    // Append to camera (parent of crosshair)
    const cam = this._ring.parentEl || this._ring.parentNode;
    if (cam) cam.appendChild(marker);

    this._hitMarker = marker;
    setTimeout(() => {
      if (marker.parentNode) marker.parentNode.removeChild(marker);
    }, dur + 50);
  },
});
