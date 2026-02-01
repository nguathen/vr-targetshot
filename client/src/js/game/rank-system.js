/**
 * Rank/Tier system based on total XP.
 * 6 tiers: Bronze → Silver → Gold → Platinum → Diamond → Legend
 */

const RANKS = [
  { tier: 'Bronze',   minXp: 0,       color: '#cd7f32', icon: '🥉' },
  { tier: 'Silver',   minXp: 5000,    color: '#c0c0c0', icon: '🥈' },
  { tier: 'Gold',     minXp: 15000,   color: '#ffd700', icon: '🥇' },
  { tier: 'Platinum', minXp: 40000,   color: '#44ddff', icon: '💠' },
  { tier: 'Diamond',  minXp: 100000,  color: '#b9f2ff', icon: '💎' },
  { tier: 'Legend',   minXp: 250000,  color: '#ff44ff', icon: '👑' },
];

function getRank(totalXp) {
  const xp = totalXp || 0;
  let current = RANKS[0];
  let nextIdx = 1;

  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (xp >= RANKS[i].minXp) {
      current = RANKS[i];
      nextIdx = i + 1;
      break;
    }
  }

  const next = nextIdx < RANKS.length ? RANKS[nextIdx] : null;
  const xpToNext = next ? next.minXp - xp : 0;
  const progressPercent = next
    ? ((xp - current.minXp) / (next.minXp - current.minXp)) * 100
    : 100;

  return {
    tier: current.tier,
    color: current.color,
    icon: current.icon,
    nextTier: next?.tier || null,
    xpToNext,
    progressPercent: Math.min(100, Math.max(0, progressPercent)),
  };
}

export { RANKS, getRank };
export default getRank;
