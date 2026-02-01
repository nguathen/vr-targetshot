import authManager from '../core/auth-manager.js';

const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'First Blood', description: 'Hit your first target', icon: '🎯', rewardXp: 10, check: (p) => p.totalTargetsHit >= 1 },
  { id: 'sharpshooter', name: 'Sharpshooter', description: 'Get a x10 combo', icon: '🔥', rewardXp: 50, check: (p) => p.bestCombo >= 10 },
  { id: 'centurion', name: 'Centurion', description: 'Hit 100 total targets', icon: '💯', rewardXp: 25, check: (p) => p.totalTargetsHit >= 100 },
  { id: 'marksman', name: 'Marksman', description: 'Score 1000 in Time Attack', icon: '🏆', rewardXp: 50, check: (p) => (p.highScores?.timeAttack || 0) >= 1000 },
  { id: 'survivor', name: 'Survivor', description: 'Score 500 in Survival', icon: '❤️', rewardXp: 50, check: (p) => (p.highScores?.survival || 0) >= 500 },
  { id: 'zen_master', name: 'Zen Master', description: 'Play 10 games', icon: '🧘', rewardXp: 30, check: (p) => p.gamesPlayed >= 10 },
  { id: 'arsenal', name: 'Arsenal', description: 'Reach level 5 (unlock all weapons)', icon: '🔫', rewardXp: 100, check: (p) => p.level >= 5 },
  { id: 'veteran', name: 'Veteran', description: 'Play 50 games', icon: '⭐', rewardXp: 75, check: (p) => p.gamesPlayed >= 50 },
  { id: 'level10', name: 'Level 10', description: 'Reach level 10', icon: '👑', rewardXp: 100, check: (p) => p.level >= 10 },
  { id: 'boss_slayer', name: 'Boss Slayer', description: 'Score 300 in Boss Rush', icon: '👹', rewardXp: 100, check: (p) => (p.highScores?.bossRush || 0) >= 300 },
  { id: 'combo_king', name: 'Combo King', description: 'Get a x15 combo', icon: '⚡', rewardXp: 75, check: (p) => p.bestCombo >= 15 },
  { id: 'five_hundred', name: 'Five Hundred', description: 'Hit 500 total targets', icon: '🎖️', rewardXp: 50, check: (p) => p.totalTargetsHit >= 500 },
  { id: 'thousand', name: 'Thousand', description: 'Hit 1000 total targets', icon: '🏅', rewardXp: 100, check: (p) => p.totalTargetsHit >= 1000 },
  { id: 'level20', name: 'Legend', description: 'Reach level 20', icon: '💎', rewardXp: 200, check: (p) => p.level >= 20 },
  { id: 'dedicated', name: 'Dedicated', description: 'Play 100 games', icon: '🎮', rewardXp: 100, check: (p) => p.gamesPlayed >= 100 },
  // V14 achievements
  { id: 'combo_legend', name: 'Combo Legend', description: 'Get a x25 combo', icon: '💥', rewardXp: 150, check: (p) => p.bestCombo >= 25 },
  { id: 'five_thousand', name: 'Five Thousand', description: 'Hit 5000 total targets', icon: '🌟', rewardXp: 200, check: (p) => p.totalTargetsHit >= 5000 },
  { id: 'level30', name: 'Mythic', description: 'Reach level 30', icon: '🔱', rewardXp: 300, check: (p) => p.level >= 30 },
  { id: 'high_roller', name: 'High Roller', description: 'Earn 500 coins total', icon: '💰', rewardXp: 75, check: (p) => (p.coins || 0) >= 500 },
  { id: 'sniper_elite', name: 'Sniper Elite', description: 'Score 2000 in Time Attack', icon: '🎯', rewardXp: 100, check: (p) => (p.highScores?.timeAttack || 0) >= 2000 },
  { id: 'iron_will', name: 'Iron Will', description: 'Score 1000 in Survival', icon: '🛡️', rewardXp: 150, check: (p) => (p.highScores?.survival || 0) >= 1000 },
  { id: 'boss_master', name: 'Boss Master', description: 'Score 1000 in Boss Rush', icon: '💀', rewardXp: 200, check: (p) => (p.highScores?.bossRush || 0) >= 1000 },
  { id: 'perfectionist', name: 'Perfectionist', description: 'Achieve 90%+ accuracy in a game', icon: '✨', rewardXp: 100, check: (p) => (p.bestAccuracy || 0) >= 90 },
  { id: 'marathon', name: 'Marathon', description: 'Play 250 games', icon: '🏃', rewardXp: 150, check: (p) => p.gamesPlayed >= 250 },
  { id: 'collector', name: 'Collector', description: 'Unlock 5 weapon skins', icon: '🎨', rewardXp: 75, check: (p) => (p.ownedSkins?.length || 0) >= 5 },
];

async function checkAchievements() {
  const profile = authManager.profile;
  if (!profile) return [];

  const unlocked = profile.achievements || [];
  const newlyUnlocked = [];

  for (const ach of ACHIEVEMENTS) {
    if (unlocked.includes(ach.id)) continue;
    if (ach.check(profile)) {
      newlyUnlocked.push(ach);
      unlocked.push(ach.id);
    }
  }

  if (newlyUnlocked.length > 0) {
    await authManager.saveProfile({ achievements: unlocked });
    let totalXp = 0;
    for (const ach of newlyUnlocked) totalXp += ach.rewardXp;
    if (totalXp > 0) await authManager.addXp(totalXp);
  }

  return newlyUnlocked;
}

function getAllAchievements() {
  return ACHIEVEMENTS;
}

function isUnlocked(achId) {
  return (authManager.profile?.achievements || []).includes(achId);
}

export { ACHIEVEMENTS, checkAchievements, getAllAchievements, isUnlocked };
export default { ACHIEVEMENTS, checkAchievements, getAllAchievements, isUnlocked };
