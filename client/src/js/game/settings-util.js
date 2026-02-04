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
  // V30 TASK-403: Hitstop effect toggle (accessibility)
  hitstop: true,
  // V30 TASK-405: Audio category volumes (0-1)
  audioCategories: {
    ambient: 0.7,
    action: 1.0,
    ui: 0.8,
    voice: 1.0,
  },
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

// TASK-394: VR/Quest detection and mobile quality preset
let _vrModeCache = null;
let _questDeviceCache = null;

/**
 * TASK-391/394: Detect if running in VR/XR mode
 * Checks: XR session active, Quest user-agent, or VR-specific URL params
 */
function isVRMode() {
  if (_vrModeCache !== null) return _vrModeCache;

  // Check XR session (most reliable during gameplay)
  const scene = document.querySelector('a-scene');
  if (scene?.renderer?.xr?.isPresenting) {
    _vrModeCache = true;
    return true;
  }

  // Check Quest device (works before XR session starts)
  if (isQuestDevice()) {
    _vrModeCache = true;
    return true;
  }

  // Check URL param for testing
  if (new URLSearchParams(window.location.search).get('vr') === '1') {
    _vrModeCache = true;
    return true;
  }

  _vrModeCache = false;
  return false;
}

/**
 * TASK-394: Detect Meta Quest device via user-agent
 */
function isQuestDevice() {
  if (_questDeviceCache !== null) return _questDeviceCache;

  const ua = navigator.userAgent || '';
  _questDeviceCache = /Quest/i.test(ua) || /OculusBrowser/i.test(ua);
  return _questDeviceCache;
}

/**
 * TASK-394: Get VR-optimized quality settings for Quest
 * Drastically reduces render load for stable 72 FPS
 */
function getVRQualitySettings() {
  return {
    particles: 'vr',        // Special VR particle mode (10% of normal)
    weather: false,         // Disable weather particles
    reflections: false,     // Disable env reflections
    floorDetail: false,     // Disable floor normal maps
    bloom: false,           // Disable bloom post-processing
    decorationLOD: true,    // Enable decoration distance culling
    animatedDecorations: false, // Disable decoration animations
  };
}

/**
 * TASK-394: Apply mobile/VR preset if Quest detected and no user override
 */
function applyQuestPresetIfNeeded() {
  if (!isQuestDevice()) return false;

  try {
    const raw = localStorage.getItem('vr_quest_player_v2');
    if (raw) {
      const profile = JSON.parse(raw);
      // Check if user has explicitly set quality preferences
      if (profile.settings?.vrPresetApplied) return false;
    }

    // Apply VR preset
    const vrSettings = getVRQualitySettings();
    const currentRaw = localStorage.getItem('vr_quest_player_v2');
    const current = currentRaw ? JSON.parse(currentRaw) : {};
    current.settings = { ...(current.settings || {}), ...vrSettings, vrPresetApplied: true };
    localStorage.setItem('vr_quest_player_v2', JSON.stringify(current));
    console.log('[settings] Applied Quest VR quality preset');
    return true;
  } catch (e) {
    console.warn('[settings] Failed to apply VR preset:', e);
    return false;
  }
}

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

export {
  DEFAULT_SETTINGS,
  getSettings,
  remapColor,
  COLORBLIND_PALETTES,
  DIFFICULTY_PRESETS,
  getDifficultyPreset,
  getLevelScaledDifficulty,
  isVRMode,
  isQuestDevice,
  getVRQualitySettings,
  applyQuestPresetIfNeeded,
};
export default getSettings;
