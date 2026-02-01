import authManager from './core/auth-manager.js';
import leaderboardManager from './core/leaderboard-manager.js';
import friendManager from './core/friend-manager.js';
import { GAME_MODES } from './game/game-modes.js';
import { getRank } from './game/rank-system.js';

let currentTab = 'global'; // 'global' | 'friends'
let currentMode = 'timeAttack';

async function init() {
  const transition = document.getElementById('transition');
  transition.classList.add('active');
  requestAnimationFrame(() => transition.classList.remove('active'));

  buildTabs();
  buildModeFilter();
  await loadLeaderboard();

  document.getElementById('btn-back').addEventListener('click', () => {
    transition.classList.add('active');
    setTimeout(() => { window.location.href = './index.html'; }, 300);
  });
}

function buildTabs() {
  const container = document.getElementById('lb-tabs');
  container.innerHTML = '';

  ['global', 'friends'].forEach(tab => {
    const btn = document.createElement('button');
    btn.className = `lb-tab${tab === currentTab ? ' active' : ''}`;
    btn.textContent = tab === 'global' ? '🌍 Global' : '👥 Friends';
    btn.addEventListener('click', () => {
      currentTab = tab;
      buildTabs();
      loadLeaderboard();
    });
    container.appendChild(btn);
  });
}

function buildModeFilter() {
  const container = document.getElementById('lb-filter');
  container.innerHTML = '';

  Object.values(GAME_MODES).forEach(mode => {
    if (mode.id === 'zen') return; // Zen has no competitive scores
    const btn = document.createElement('button');
    btn.className = `lb-tab${mode.id === currentMode ? ' active' : ''}`;
    btn.textContent = `${mode.icon} ${mode.name}`;
    btn.style.fontSize = '0.75rem';
    btn.addEventListener('click', () => {
      currentMode = mode.id;
      buildModeFilter();
      loadLeaderboard();
    });
    container.appendChild(btn);
  });
}

async function loadLeaderboard() {
  const list = document.getElementById('lb-list');
  const rankInfo = document.getElementById('lb-rank-info');
  list.innerHTML = '<div style="text-align:center;color:#555;padding:20px">Loading...</div>';

  let entries = await leaderboardManager.getTopScores(currentMode, 20);
  const myUid = authManager.uid;

  if (currentTab === 'friends') {
    const friends = await friendManager.getFriendProfiles();
    const friendUids = new Set(friends.map(f => f.uid));
    friendUids.add(myUid); // Include self
    entries = entries.filter(e => friendUids.has(e.id || e.uid));
  }

  // Sort by score descending
  entries.sort((a, b) => (b.score || 0) - (a.score || 0));

  list.innerHTML = '';

  if (entries.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:#555;padding:20px">No scores yet</div>';
    rankInfo.textContent = '';
    return;
  }

  // Find my rank
  const myIdx = entries.findIndex(e => (e.id || e.uid) === myUid);
  if (myIdx >= 0) {
    rankInfo.textContent = `You are #${myIdx + 1} of ${entries.length}`;
  } else {
    rankInfo.textContent = '';
  }

  entries.forEach((entry, i) => {
    const row = document.createElement('div');
    row.className = 'lb-row';
    const isMe = (entry.id || entry.uid) === myUid;
    if (isMe) row.classList.add('lb-me');

    const rank = document.createElement('span');
    rank.className = 'lb-rank';
    rank.textContent = `#${i + 1}`;
    row.appendChild(rank);

    const name = document.createElement('span');
    name.className = 'lb-name';
    const playerRank = getRank(0); // We don't have totalXp in leaderboard entries
    const lvl = entry.level || 1;
    name.textContent = `${entry.displayName || 'Player'}  Lv.${lvl}`;
    row.appendChild(name);

    const score = document.createElement('span');
    score.className = 'lb-score';
    score.textContent = entry.score || 0;
    row.appendChild(score);

    list.appendChild(row);
  });
}

let initialized = false;
authManager.waitReady().then(() => {
  const safeInit = () => { if (!initialized) { initialized = true; init(); } };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeInit);
  } else {
    safeInit();
  }
});
