/**
 * Weekly rotating challenges. The active challenge is determined by ISO week number,
 * cycling through the CHALLENGES array. Each challenge applies modifiers to gameplay.
 */

const CHALLENGES = [
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'All targets are speed targets! Move fast.',
    icon: '💨',
    xpBonus: 1.5,
    modifiers: { forceTargetType: 'speed' },
  },
  {
    id: 'heavy_hitter',
    name: 'Heavy Hitter',
    description: 'Only heavy targets spawn — 2 HP each.',
    icon: '🪨',
    xpBonus: 2.0,
    modifiers: { forceTargetType: 'heavy' },
  },
  {
    id: 'powerup_frenzy',
    name: 'Power-up Frenzy',
    description: 'Power-up targets spawn 3x more often!',
    icon: '🎁',
    xpBonus: 1.3,
    modifiers: { powerupWeightMul: 3 },
  },
  {
    id: 'combo_master',
    name: 'Combo Master',
    description: 'Combo multiplier caps at x10 instead of x5!',
    icon: '🔗',
    xpBonus: 1.5,
    modifiers: { comboCapOverride: 10 },
  },
  {
    id: 'sharpshooter',
    name: 'Sharpshooter Week',
    description: 'Targets are smaller but worth double points.',
    icon: '🎯',
    xpBonus: 1.8,
    modifiers: { radiusMul: 0.6, pointsMul: 2 },
  },
  {
    id: 'endurance',
    name: 'Endurance',
    description: 'Targets disappear 30% faster. Survive!',
    icon: '⏰',
    xpBonus: 1.5,
    modifiers: { lifetimeMul: 0.7 },
  },
  {
    id: 'bonus_bonanza',
    name: 'Bonus Bonanza',
    description: 'Bonus targets appear 4x more often!',
    icon: '💰',
    xpBonus: 1.2,
    modifiers: { bonusWeightMul: 4 },
  },
];

function getISOWeek() {
  const d = new Date();
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getCurrentChallenge() {
  const week = getISOWeek();
  return CHALLENGES[week % CHALLENGES.length];
}

function getDaysRemaining() {
  const now = new Date();
  const dayOfWeek = now.getUTCDay() || 7; // 1=Mon, 7=Sun
  return 7 - dayOfWeek + 1; // days until next Monday
}

export { CHALLENGES, getCurrentChallenge, getDaysRemaining };
export default getCurrentChallenge;
