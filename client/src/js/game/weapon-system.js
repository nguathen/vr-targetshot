import audioManager from '../core/audio-manager.js';
import powerUpManager from './power-up-manager.js';

const WEAPONS = {
  pistol: {
    id: 'pistol',
    name: 'Pistol',
    description: 'Balanced precision shooter',
    icon: '🔫',
    damage: 1,
    fireRate: 0,        // no cooldown
    spread: 0,          // single ray
    projectiles: 1,
    laserColor: '#ff4444',
    laserOpacity: 0.7,
    hapticIntensity: 0.3,
    hapticDuration: 50,
    unlockLevel: 1,
    sound: 'pistol',
  },
  shotgun: {
    id: 'shotgun',
    name: 'Shotgun',
    description: 'Wide spread, hits multiple targets',
    icon: '💥',
    damage: 1,
    fireRate: 800,       // 800ms cooldown
    spread: 0.15,        // radians spread cone
    projectiles: 5,
    laserColor: '#ff8800',
    laserOpacity: 0.5,
    hapticIntensity: 0.8,
    hapticDuration: 100,
    unlockLevel: 3,
    sound: 'shotgun',
  },
  sniper: {
    id: 'sniper',
    name: 'Sniper',
    description: 'Slow fire, double points',
    icon: '🎯',
    damage: 2,           // 2x points
    fireRate: 1500,      // 1.5s cooldown
    spread: 0,
    projectiles: 1,
    laserColor: '#00ff88',
    laserOpacity: 0.9,
    hapticIntensity: 0.6,
    hapticDuration: 80,
    unlockLevel: 5,
    sound: 'sniper',
  },
  smg: {
    id: 'smg',
    name: 'SMG',
    description: '3-round burst, rapid fire',
    icon: '🔥',
    damage: 1,
    fireRate: 400,        // 400ms between bursts
    spread: 0.08,
    projectiles: 1,
    burstCount: 3,        // 3-round burst
    burstDelay: 100,      // 100ms between burst shots
    laserColor: '#ff6622',
    laserOpacity: 0.65,
    hapticIntensity: 0.25,
    hapticDuration: 30,
    unlockLevel: 7,
    sound: 'smg',
  },
  railgun: {
    id: 'railgun',
    name: 'Railgun',
    description: 'Charge to fire, massive damage',
    icon: '⚡',
    damage: 1,            // scales 1-3x with charge
    fireRate: 2000,
    spread: 0,
    projectiles: 1,
    chargeTime: 1500,     // 1.5s for full charge
    laserColor: '#4488ff',
    laserOpacity: 0.9,
    hapticIntensity: 1.0,
    hapticDuration: 120,
    unlockLevel: 12,
    sound: 'railgun',
  },
};

class WeaponSystem {
  constructor() {
    this._current = 'pistol';
    this._lastFireTime = 0;
    this._listeners = [];
  }

  get current() { return WEAPONS[this._current]; }
  get currentId() { return this._current; }
  get all() { return WEAPONS; }

  select(weaponId) {
    if (!WEAPONS[weaponId]) return false;
    this._current = weaponId;
    this._notify();
    return true;
  }

  canFire() {
    const weapon = this.current;
    if (weapon.fireRate === 0) return true;
    return (Date.now() - this._lastFireTime) >= weapon.fireRate;
  }

  fire() {
    if (!this.canFire()) return null;
    this._lastFireTime = Date.now();
    const weapon = this.current;

    // SMG burst: schedule 3 rapid shots
    if (weapon.burstCount > 1) {
      audioManager.playWeaponFire(weapon.sound);
      for (let i = 1; i < weapon.burstCount; i++) {
        setTimeout(() => {
          audioManager.playWeaponFire(weapon.sound);
          document.dispatchEvent(new CustomEvent('smg-burst-shot', { detail: { index: i } }));
        }, weapon.burstDelay * i);
      }
      return weapon;
    }

    // Railgun: damage based on charge level
    if (weapon.chargeTime) {
      audioManager.playWeaponFire(weapon.sound);
      const charge = this._chargeLevel || 1;
      this._chargeLevel = 0;
      return { ...weapon, damage: charge };
    }

    audioManager.playWeaponFire(weapon.sound);

    // Multi-shot power-up: widen spread for single-shot weapons
    const puMultiplier = powerUpManager.getProjectileMultiplier();
    if (puMultiplier > 1 && weapon.projectiles === 1) {
      return { ...weapon, projectiles: puMultiplier, spread: 0.12 };
    }
    return weapon;
  }

  // Railgun charge management
  startCharge() {
    const weapon = this.current;
    if (!weapon.chargeTime) return;
    this._chargeStart = Date.now();
    this._chargeLevel = 0;
  }

  updateCharge() {
    const weapon = this.current;
    if (!weapon.chargeTime || !this._chargeStart) return 0;
    const elapsed = Date.now() - this._chargeStart;
    this._chargeLevel = Math.min(3, 1 + (elapsed / weapon.chargeTime) * 2);
    return this._chargeLevel;
  }

  releaseCharge() {
    const level = this._chargeLevel || 1;
    this._chargeStart = 0;
    return level;
  }

  isUnlocked(weaponId, playerLevel) {
    const weapon = WEAPONS[weaponId];
    return weapon && playerLevel >= weapon.unlockLevel;
  }

  getLockedWeapons(playerLevel) {
    return Object.values(WEAPONS).filter(w => playerLevel < w.unlockLevel);
  }

  getUnlockedWeapons(playerLevel) {
    return Object.values(WEAPONS).filter(w => playerLevel >= w.unlockLevel);
  }

  onChange(fn) {
    this._listeners.push(fn);
  }

  _notify() {
    this._listeners.forEach(fn => fn(this.current));
  }
}

const weaponSystem = new WeaponSystem();
export { weaponSystem, WEAPONS };
export default weaponSystem;
