import {
  db, isConfigured,
  collection, query, orderBy, limit, getDocs,
  doc, setDoc, serverTimestamp,
} from './firebase-config.js';
import authManager from './auth-manager.js';

const CACHE_KEY = 'vr_quest_leaderboard_cache';
const MAX_ENTRIES = 20;

class LeaderboardManager {
  constructor() {
    this._cache = this._loadCache();
  }

  async submitScore(modeId, score) {
    const uid = authManager.uid || 'local';
    const entry = {
      id: uid,
      uid,
      displayName: authManager.displayName,
      score,
      level: authManager.profile?.level || 1,
    };

    // Always update local cache (keeps best score per player)
    if (!this._cache[modeId]) this._cache[modeId] = [];
    const existing = this._cache[modeId].find(e => (e.id || e.uid) === uid);
    if (existing) {
      if (score > (existing.score || 0)) Object.assign(existing, entry);
    } else {
      this._cache[modeId].push(entry);
    }
    this._saveCache();

    // Also submit to Firebase if available
    if (!isConfigured || !authManager.user) return;
    const ref = doc(db, 'leaderboards', modeId, 'scores', uid);
    await setDoc(ref, {
      ...entry,
      timestamp: serverTimestamp(),
    }, { merge: true });
  }

  async getTopScores(modeId, count = MAX_ENTRIES) {
    if (!isConfigured) return this._cache[modeId] || [];

    try {
      const col = collection(db, 'leaderboards', modeId, 'scores');
      const q = query(col, orderBy('score', 'desc'), limit(count));
      const snap = await getDocs(q);

      const entries = [];
      snap.forEach(d => entries.push({ id: d.id, ...d.data() }));

      this._cache[modeId] = entries;
      this._saveCache();
      return entries;
    } catch {
      return this._cache[modeId] || [];
    }
  }

  _loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  _saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(this._cache));
    } catch { /* ignore */ }
  }
}

const leaderboardManager = new LeaderboardManager();
export default leaderboardManager;
