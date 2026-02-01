import { getSettings } from '../game/settings-util.js';

class HapticManager {
  pulse(intensity, duration) {
    const settings = getSettings();
    const scale = (settings.vibration ?? 50) / 100;
    if (scale === 0) return;

    const scaledIntensity = Math.min(intensity * scale, 1.0);

    // Strategy 1: WebXR inputSources (Quest Browser — most reliable)
    const scene = document.getElementById('scene');
    const xrSession = scene?.xrSession       // A-Frame 1.4+
      || scene?.renderer?.xr?.getSession?.(); // Three.js fallback
    if (xrSession?.inputSources) {
      for (const src of xrSession.inputSources) {
        const gp = src.gamepad;
        if (!gp) continue;
        try {
          if (gp.hapticActuators?.[0]) {
            gp.hapticActuators[0].pulse(scaledIntensity, duration);
          } else if (gp.vibrationActuator) {
            gp.vibrationActuator.playEffect('dual-rumble', {
              duration, strongMagnitude: scaledIntensity, weakMagnitude: scaledIntensity * 0.5,
            });
          }
        } catch { /* ignore */ }
      }
      return;
    }

    // Strategy 2: A-Frame tracked controller components (desktop VR / older runtimes)
    ['left-hand', 'right-hand'].forEach(id => {
      const el = document.getElementById(id);
      if (!el?.components) return;
      const comp = el.components['oculus-touch-controls']
        || el.components['tracked-controls-webxr']
        || el.components['tracked-controls'];
      const gp = comp?.controller?.gamepad;
      if (!gp) return;
      try {
        if (gp.hapticActuators?.[0]) {
          gp.hapticActuators[0].pulse(scaledIntensity, duration);
        }
      } catch { /* ignore */ }
    });
  }

  hit()           { this.pulse(0.4, 40); }
  combo(n)        { this.pulse(Math.min(0.3 + n * 0.05, 1.0), 60); }
  powerUp()       { this._pattern([0.5, 80], [0.0, 50], [0.7, 80]); }
  slowMo()        { this.pulse(0.8, 200); }
  damageTaken()   { this._pattern([1.0, 100], [0.0, 50], [1.0, 100]); }
  bossKill()      { this._pattern([0.6, 60], [0.0, 40], [0.8, 80], [0.0, 40], [1.0, 120]); }

  // Weapon-specific fire patterns
  firePistol()    { this.pulse(0.3, 40); }
  fireShotgun()   { this._pattern([1.0, 60], [0.4, 80]); }
  fireSniper()    { this._pattern([0.2, 30], [0.8, 100]); }
  fireSmg()       { this._pattern([0.25, 25], [0.0, 75], [0.25, 25], [0.0, 75], [0.25, 25]); }
  fireRailgun(charge) {
    const intensity = Math.min(0.5 + charge * 0.2, 1.0);
    this._pattern([intensity, 120], [0.0, 30], [intensity * 0.5, 60]);
  }
  railgunCharge(level) { this.pulse(Math.min(0.1 + level * 0.1, 0.5), 50); }

  // Target-type hit confirmation
  hitStandard()   { this.pulse(0.4, 40); }
  hitHeavy()      { this._pattern([0.6, 60], [0.0, 30], [0.8, 80]); }
  hitBonus()      { this._pattern([0.5, 40], [0.0, 30], [0.5, 40], [0.0, 30], [0.5, 40]); }
  hitDecoy()      { this._pattern([1.0, 80], [0.0, 40], [1.0, 80]); }
  hitSpeed()      { this.pulse(0.5, 30); }
  hitBoss()       { this._pattern([0.7, 80], [0.0, 40], [1.0, 120]); }

  async _pattern(...steps) {
    for (const [intensity, duration] of steps) {
      if (intensity > 0) this.pulse(intensity, duration);
      await new Promise(r => setTimeout(r, duration));
    }
  }
}

const hapticManager = new HapticManager();
export default hapticManager;
