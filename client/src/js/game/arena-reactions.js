/**
 * Arena Reactions (TASK-262)
 * Environment responds to gameplay events: boss spawn, combos, kill streaks, game over.
 */

class ArenaReactions {
  constructor() {
    this._scene = null;
    this._active = false;
    this._listeners = [];
    this._intensity = 0.5; // 0-1 master scale
    this._killTimes = [];
  }

  init(sceneEl) {
    this._scene = sceneEl;
    this._active = true;
    this._killTimes = [];

    this._listen('boss-spawn', (e) => this._onBossSpawn(e));
    this._listen('combo-milestone', (e) => this._onComboMilestone(e));
    this._listen('game-over-reactions', () => this._onGameOver());
    this._listen('crosshair-hit', () => this._onKill());
  }

  setIntensity(v) {
    this._intensity = Math.max(0, Math.min(1, v));
  }

  stop() {
    this._active = false;
    this._listeners.forEach(({ event, fn }) => document.removeEventListener(event, fn));
    this._listeners = [];
    this._killTimes = [];
  }

  _listen(event, fn) {
    document.addEventListener(event, fn);
    this._listeners.push({ event, fn });
  }

  _getGC() {
    return this._scene?.querySelector('#game-content') || this._scene;
  }

  // === Boss Spawn: platform shake + light flash ===
  _onBossSpawn() {
    if (!this._active) return;
    const gc = this._getGC();
    if (!gc) return;

    // Platform shake
    const platform = gc.querySelector('#platform-slab');
    if (platform) {
      platform.setAttribute('animation__shake', {
        property: 'position',
        from: `0 -0.55 0`, to: `0 -0.5 0`,
        dur: 100, loop: 5, dir: 'alternate', easing: 'linear',
      });
      setTimeout(() => {
        platform.removeAttribute('animation__shake');
        platform.setAttribute('position', '0 -0.5 0');
      }, 1100);
    }

    // Flash all lights red twice
    const lights = gc.querySelectorAll('a-light[type="point"]');
    lights.forEach(l => {
      const origColor = l.getAttribute('color');
      l.setAttribute('color', '#ff2222');
      setTimeout(() => l.setAttribute('color', origColor), 200);
      setTimeout(() => l.setAttribute('color', '#ff2222'), 400);
      setTimeout(() => l.setAttribute('color', origColor), 600);
    });
  }

  // === Combo Milestone: floor color shift + ring pulse ===
  _onComboMilestone(e) {
    if (!this._active) return;
    const combo = e.detail?.combo || 0;
    if (combo < 15) return;

    const gc = this._getGC();
    if (!gc) return;

    // Floor grid color pulse
    const gridPlane = gc.querySelector('#floor-grid a-plane');
    if (gridPlane) {
      const comboColor = combo >= 20 ? '#ffd700' : '#ff44aa';
      gridPlane.setAttribute('animation__comboglow', {
        property: 'material.color', to: comboColor,
        dur: 500, easing: 'easeOutQuad',
      });
      setTimeout(() => {
        gridPlane.removeAttribute('animation__comboglow');
      }, 2000);
    }

    // Edge glow rings pulse faster
    gc.querySelectorAll('.platform-edge').forEach(el => {
      el.setAttribute('animation__combopulse', {
        property: 'material.opacity', from: 0.15, to: 0.4,
        dur: 300, loop: true, dir: 'alternate', easing: 'easeInOutSine',
      });
      setTimeout(() => {
        el.removeAttribute('animation__combopulse');
        el.setAttribute('material', 'opacity', 0.2);
      }, 3000);
    });
  }

  // === Kill Streak: light intensity spike ===
  _onKill() {
    if (!this._active) return;
    const now = Date.now();
    this._killTimes.push(now);
    // Keep last 3 seconds
    this._killTimes = this._killTimes.filter(t => now - t < 3000);

    if (this._killTimes.length >= 5) {
      this._killTimes = [];
      this._triggerKillStreak();
    }
  }

  _triggerKillStreak() {
    const gc = this._getGC();
    if (!gc) return;

    const lights = gc.querySelectorAll('a-light[type="point"]');
    lights.forEach(l => {
      const orig = parseFloat(l.getAttribute('intensity') || '0.6');
      l.setAttribute('animation__streak', {
        property: 'intensity', from: orig * 1.5, to: orig,
        dur: 500, easing: 'easeOutQuad',
      });
    });
  }

  // === Game Over: fade lights, slow particles ===
  _onGameOver() {
    if (!this._active) return;
    const gc = this._getGC();
    if (!gc) return;

    // Dim all lights to 30%
    const lights = gc.querySelectorAll('a-light[type="point"]');
    lights.forEach(l => {
      const orig = parseFloat(l.getAttribute('intensity') || '0.6');
      l.setAttribute('animation__dim', {
        property: 'intensity', to: orig * 0.3,
        dur: 2000, easing: 'easeInQuad',
      });
    });

    // Dim ambient
    const ambient = gc.querySelector('a-light[type="ambient"]');
    if (ambient) {
      const origA = parseFloat(ambient.getAttribute('intensity') || '0.5');
      ambient.setAttribute('animation__dim', {
        property: 'intensity', to: origA * 0.3,
        dur: 2000, easing: 'easeInQuad',
      });
    }
  }
}

const arenaReactions = new ArenaReactions();
export { arenaReactions };
export default arenaReactions;
