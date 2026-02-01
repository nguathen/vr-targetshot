const DEFAULT_SETTINGS = {
  volume: 80,
  sfx: true,
  vibration: 50,
  crosshairSize: 'medium',
  crosshairColor: '#00ff88',
  highContrast: false,
  reducedMotion: false,
  autoSubmitScore: true,
  showCombo: true,
  minimalHud: false,
  bloom: true,
  screenShake: 'medium',
  colorblindMode: 'none',
  difficulty: 'normal',
};

// Colorblind-safe color remapping palettes
const COLORBLIND_PALETTES = {
  none: null,
  protanopia: {
    '#e94560': '#d4a017', '#ff6b6b': '#e8c547', '#ff3333': '#d4a017',
    '#2ed573': '#4488ff', '#00ff88': '#44bbff', '#ffd700': '#ffffff',
    '#ff4444': '#ddaa00', '#ff0000': '#ccaa00', '#00ffaa': '#44ccff',
  },
  deuteranopia: {
    '#e94560': '#cc8800', '#ff6b6b': '#ddaa44', '#ff3333': '#cc8800',
    '#2ed573': '#4499ff', '#00ff88': '#55aaff', '#ffd700': '#ffffff',
    '#ff4444': '#bb8800', '#ff0000': '#aa7700', '#00ffaa': '#55bbff',
  },
  tritanopia: {
    '#1e90ff': '#ff6688', '#4488ff': '#ff5577', '#00d4ff': '#ff7799',
    '#a855f7': '#ff4444', '#ffd700': '#ff8866', '#00ff88': '#ffaa44',
    '#00ffaa': '#ffbb55', '#44bbff': '#ff6688',
  },
};

const DIFFICULTY_PRESETS = {
  easy:   { spawnMul: 1.4, lifetimeMul: 1.5, maxTargetsMul: 0.75, label: 'Easy' },
  normal: { spawnMul: 1.0, lifetimeMul: 1.0, maxTargetsMul: 1.0,  label: 'Normal' },
  hard:   { spawnMul: 0.7, lifetimeMul: 0.7, maxTargetsMul: 1.3,  label: 'Hard' },
};

function getDifficultyPreset(settings) {
  return DIFFICULTY_PRESETS[settings?.difficulty || 'normal'] || DIFFICULTY_PRESETS.normal;
}

/** Apply player-level scaling on top of difficulty preset */
function getLevelScaledDifficulty(settings, playerLevel) {
  const base = getDifficultyPreset(settings);
  const lvl = Math.max(0, (playerLevel || 1) - 1);
  const s = Math.min(lvl / 19, 1); // 0→1 over levels 1→20
  return {
    ...base,
    spawnMul: base.spawnMul * (1 - s * 0.25),
    lifetimeMul: base.lifetimeMul * (1 - s * 0.30),
    maxTargetsMul: base.maxTargetsMul * (1 + s * 0.40),
  };
}

function remapColor(color, settings) {
  const mode = settings?.colorblindMode || 'none';
  const palette = COLORBLIND_PALETTES[mode];
  if (!palette) return color;
  return palette[color?.toLowerCase()] || color;
}

function getSettings() {
  try {
    const raw = localStorage.getItem('vr_quest_player_v2');
    if (raw) {
      const profile = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...(profile.settings || {}) };
    }
  } catch (e) { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

export { DEFAULT_SETTINGS, getSettings, remapColor, COLORBLIND_PALETTES, DIFFICULTY_PRESETS, getDifficultyPreset, getLevelScaledDifficulty };
export default getSettings;
