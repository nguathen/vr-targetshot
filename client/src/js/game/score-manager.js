class ScoreManager {
  constructor() {
    this._score = 0;
    this._shotsFired = 0;
    this._listeners = [];
  }

  get score() { return this._score; }

  reset() {
    this._score = 0;
    this._shotsFired = 0;
    this._notify();
  }

  recordShot() {
    this._shotsFired++;
  }

  add(points) {
    this._score += points;
    this._notify();
  }

  finalize() {
    return { score: this._score, shotsFired: this._shotsFired };
  }

  onChange(fn) {
    this._listeners.push(fn);
  }

  clearListeners() {
    this._listeners = [];
  }

  _notify() {
    this._listeners.forEach(fn => fn(this._score));
  }
}

const scoreManager = new ScoreManager();
export { scoreManager };
export default scoreManager;
