import authManager from './core/auth-manager.js';
import { GAME_MODES } from './game/game-modes.js';
import { WEAPONS } from './game/weapon-system.js';
import { getRank } from './game/rank-system.js';
import { ACHIEVEMENTS } from './game/achievements.js';

function initStats(profile) {
  const transition = document.getElementById('transition');
  transition.classList.add('active');
  requestAnimationFrame(() => transition.classList.remove('active'));

  buildSummary(profile);
  buildModes(profile);
  buildWeapons(profile);
  buildRecent(profile);

  document.getElementById('btn-back').addEventListener('click', () => {
    transition.classList.add('active');
    setTimeout(() => { window.location.href = './index.html'; }, 300);
  });
}

function buildSummary(profile) {
  const container = document.getElementById('stats-summary');
  const shotsFired = profile.totalShotsFired || 0;
  const targetsHit = profile.totalTargetsHit || 0;
  const accuracy = shotsFired > 0 ? Math.round((targetsHit / shotsFired) * 100) : 0;
  const playTimeSec = profile.totalPlayTime || 0;
  const playTimeMin = Math.floor(playTimeSec / 60);
  const achievementCount = (profile.achievements || []).length;
  const rank = getRank(profile.totalXp || 0);
  const items = [
    { label: 'Rank', value: `${rank.icon} ${rank.tier}` },
    { label: 'Level', value: profile.level || 1 },
    { label: 'Games', value: profile.gamesPlayed || 0 },
    { label: 'Targets Hit', value: targetsHit },
    { label: 'Accuracy', value: `${accuracy}%` },
    { label: 'Best Combo', value: `x${profile.bestCombo || 0}` },
    { label: 'Play Time', value: `${playTimeMin}m` },
    { label: 'Total XP', value: profile.totalXp || 0 },
    { label: 'Coins', value: profile.coins || 0 },
    { label: 'Achievements', value: `${achievementCount}/${ACHIEVEMENTS.length}` },
    { label: 'Best Reaction', value: profile.bestReactionTime ? `${profile.bestReactionTime}ms` : '—' },
    { label: 'Avg Reaction', value: profile.avgReactionTime ? `${profile.avgReactionTime}ms` : '—' },
    { label: 'Peripheral Hits', value: profile.peripheralHits || 0 },
  ];
  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'stat-card';
    const lbl = document.createElement('div');
    lbl.className = 'stat-card-label';
    lbl.textContent = item.label;
    const val = document.createElement('div');
    val.className = 'stat-card-value';
    val.textContent = item.value;
    el.appendChild(val);
    el.appendChild(lbl);
    container.appendChild(el);
  });
}

function buildModes(profile) {
  const container = document.getElementById('stats-modes');
  const hs = profile.highScores || {};
  const modeStats = profile.modeStats || {};

  Object.values(GAME_MODES).forEach(mode => {
    const ms = modeStats[mode.id] || {};
    const score = hs[mode.id] || 0;
    const games = ms.games || 0;
    if (score === 0 && games === 0) return;

    const row = document.createElement('div');
    row.className = 'high-score-row';
    const left = document.createElement('span');
    left.textContent = `${mode.icon} ${mode.name}`;
    const right = document.createElement('span');
    right.className = 'hs-value';
    const modeAcc = ms.shots > 0 ? Math.round((ms.hits || 0) / ms.shots * 100) : 0;
    right.textContent = `Best: ${score} | ${games} games | ${modeAcc}% acc`;
    row.appendChild(left);
    row.appendChild(right);
    container.appendChild(row);
  });

  if (container.children.length === 0) {
    const p = document.createElement('p');
    p.className = 'no-scores';
    p.textContent = 'No mode data yet';
    container.appendChild(p);
  }
}

function buildWeapons(profile) {
  const container = document.getElementById('stats-weapons');
  const usage = profile.weaponUsage || {};

  const pws = profile.perWeaponStats || {};

  Object.values(WEAPONS).forEach(weapon => {
    const games = usage[weapon.id] || 0;
    const ws = pws[weapon.id] || {};
    if (games === 0 && !ws.games) return;

    const totalGames = ws.games || games;
    const kills = ws.kills || 0;
    const shots = ws.shots || 0;
    const acc = shots > 0 ? Math.round((kills / shots) * 100) : 0;
    const best = ws.bestScore || 0;

    const row = document.createElement('div');
    row.className = 'high-score-row';
    const left = document.createElement('span');
    left.textContent = `${weapon.icon} ${weapon.name}`;
    const right = document.createElement('span');
    right.className = 'hs-value';
    right.textContent = `${totalGames}g | ${kills} kills | ${acc}% | Best: ${best}`;
    row.appendChild(left);
    row.appendChild(right);
    container.appendChild(row);
  });

  if (container.children.length === 0) {
    const p = document.createElement('p');
    p.className = 'no-scores';
    p.textContent = 'No weapon data yet';
    container.appendChild(p);
  }
}

function buildRecent(profile) {
  const container = document.getElementById('stats-recent');
  const recent = profile.recentGames || [];

  if (recent.length === 0) {
    const p = document.createElement('p');
    p.className = 'no-scores';
    p.textContent = 'No recent games';
    container.appendChild(p);
    return;
  }

  recent.slice().reverse().forEach(game => {
    const mode = GAME_MODES[game.mode];
    const row = document.createElement('div');
    row.className = 'high-score-row';
    const left = document.createElement('span');
    left.textContent = `${mode?.icon || '?'} ${mode?.name || game.mode}`;
    const right = document.createElement('span');
    right.className = 'hs-value';
    right.textContent = `${game.score} pts`;
    row.appendChild(left);
    row.appendChild(right);
    container.appendChild(row);
  });
}

let initialized = false;
authManager.waitReady().then(() => {
  const profile = authManager.profile;
  const safeInit = () => { if (!initialized) { initialized = true; initStats(profile); } };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeInit);
  } else {
    safeInit();
  }
});
