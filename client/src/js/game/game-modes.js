const GAME_MODES = {
  timeAttack: {
    id: 'timeAttack',
    name: 'Time Attack',
    description: '60 seconds — score as high as you can!',
    icon: '⏱️',
    duration: 60,
    lives: Infinity,
    spawnInterval: 1500,
    maxTargets: 8,
    targetLifetime: 5000,
    xpMultiplier: 1.0,
    unlockLevel: 1,
  },
  survival: {
    id: 'survival',
    name: 'Survival',
    description: '3 lives — miss a target, lose a life!',
    icon: '❤️',
    duration: Infinity,
    lives: 3,
    spawnInterval: 2000,
    maxTargets: 6,
    targetLifetime: 4000,
    xpMultiplier: 1.5,
    unlockLevel: 2,
  },
  zen: {
    id: 'zen',
    name: 'Zen Mode',
    description: 'No timer, no pressure — just practice',
    icon: '🧘',
    duration: Infinity,
    lives: Infinity,
    spawnInterval: 2500,
    maxTargets: 5,
    targetLifetime: 8000,
    xpMultiplier: 0.5,
    unlockLevel: 1,
  },
  bossRush: {
    id: 'bossRush',
    name: 'Boss Rush',
    description: 'Face increasingly tough boss targets!',
    icon: '👹',
    duration: Infinity,
    lives: 5,
    spawnInterval: 3000,
    maxTargets: 4,
    targetLifetime: 6000,
    xpMultiplier: 2.0,
    unlockLevel: 8,
  },
  reflexRush: {
    id: 'reflexRush',
    name: 'Reflex Rush',
    description: '1 target at a time — speed gets faster!',
    icon: '⚡',
    duration: Infinity,
    lives: 3,
    spawnInterval: 800,
    maxTargets: 1,
    targetLifetime: 2000,
    xpMultiplier: 1.8,
    unlockLevel: 3,
    reflexMode: true,
  },
};

class GameModeManager {
  constructor() {
    this._current = 'timeAttack';
    this._lives = Infinity;
    this._listeners = [];
  }

  get current() { return GAME_MODES[this._current]; }
  get currentId() { return this._current; }
  get lives() { return this._lives; }
  get all() { return GAME_MODES; }

  select(modeId) {
    if (!GAME_MODES[modeId]) return false;
    this._current = modeId;
    this._notify();
    return true;
  }

  startRound() {
    this._lives = this.current.lives;
  }

  loseLife() {
    if (this._lives === Infinity) return false;
    this._lives--;
    this._notify();
    return this._lives <= 0;
  }

  // TASK-350: Last Stand recovery
  addLife() {
    if (this._lives === Infinity) return;
    this._lives++;
    this._notify();
  }

  isGameOver(timeLeft) {
    if (this._lives !== Infinity && this._lives <= 0) return true;
    if (this.current.duration !== Infinity && timeLeft <= 0) return true;
    return false;
  }

  isUnlocked(modeId, playerLevel) {
    const mode = GAME_MODES[modeId];
    return mode && playerLevel >= mode.unlockLevel;
  }

  onChange(fn) {
    this._listeners.push(fn);
  }

  _notify() {
    this._listeners.forEach(fn => fn(this.current));
  }
}

const gameModeManager = new GameModeManager();
export { gameModeManager, GAME_MODES };
export default gameModeManager;
