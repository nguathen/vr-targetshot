import './core/error-handler.js';
import gameManager, { GameState } from './core/game-manager.js';
import authManager from './core/auth-manager.js';
import scoreManager from './game/score-manager.js';
import TargetSystem from './game/target-system.js';
import audioManager from './core/audio-manager.js';
import gameModeManager from './game/game-modes.js';
import weaponSystem from './game/weapon-system.js';
import leaderboardManager from './core/leaderboard-manager.js';
import { checkProgress } from './game/daily-challenge.js';
import { checkAchievements } from './game/achievements.js';
import { applyTheme } from './game/environment-themes.js';
import { getSkinOverrides } from './game/weapon-skins.js';
import { getSettings, getLevelScaledDifficulty } from './game/settings-util.js';
import musicManager from './core/music-manager.js';
import { buildSummary } from './game/game-summary.js';
import powerUpManager from './game/power-up-manager.js';
import hapticManager from './core/haptic-manager.js';
import weatherSystem from './game/weather-system.js';
import arenaReactions from './game/arena-reactions.js';
import { getCurrentChallenge, getDaysRemaining } from './game/weekly-challenge.js';
import { checkNewUnlocks } from './game/unlock-tooltips.js';
import { showAchievementToasts } from './game/achievement-toast.js';
import { getRank } from './game/rank-system.js';
import tensionSystem from './game/tension-system.js';

const COUNTDOWN_FROM = 3;

let targetSystem;
let timerInterval;
let timeLeft;
let _gameStartTime = 0;
let _originalSpawnInterval = 1500;
let _frenzyActive = false;
let _onReturnToMenu;
let _initialized = false;

// TASK-314: Accuracy tracking
let _shotsFired = 0;
let _shotsHit = 0;
let _currentStreak = 0;
let _pbBestScore = 0;

// TASK-311: Surge
let _surgeCountdown = 0;
let _surgeHudTimer = null;

// TASK-350: Last Stand
let _lastStandActive = false;
let _lastStandConsecutiveHits = 0;
let _lastStandShakeTimer = null;

// TASK-352: Chain Lightning Combo
let _chainComboAccelerated = false;

// TASK-353: Darkness Wave
let _darknessTimer = null;
let _darknessActive = false;
let _darknessElapsed = 0;
const DARKNESS_INTERVAL = 60; // every 60s
const DARKNESS_DURATION = 10; // 10s

// TASK-354: Rival Ghost
let _ghostData = [];
let _ghostRecording = [];
let _ghostInterval = null;

// TASK-355: Sudden Death Overtime
let _overtimeActive = false;
let _overtimeTime = 0;
let _overtimeTimer = null;
let _overtimeTriggered = false;

// Expose systems to A-Frame components (non-module)
window.__weaponSystem = weaponSystem;
window.__hapticManager = hapticManager;
window.__audioManager = audioManager;
window.__getSettings = getSettings;

export function startGame({ mode, weapon, theme, onReturnToMenu }) {
  if (mode) gameModeManager.select(mode);
  if (weapon) weaponSystem.select(weapon);
  _onReturnToMenu = onReturnToMenu;

  if (!_initialized) {
    _initOnce();
    _initialized = true;
  }
  _initRound(theme);
}

// DOM refs (set once)
let _hudScore, _hudTimer, _hudCombo, _hudLives, _hudWeapon, _hudLevel, _hudPowerup, _hudReaction, _hudColorMatch;
let _hudAccuracy, _hudPbPace, _hudStreak, _hudSurge, _hudDebuff;
let _scene, _btnQuitVr;

function _initOnce() {
  _hudScore = document.getElementById('hud-score');
  _hudTimer = document.getElementById('hud-timer');
  _hudCombo = document.getElementById('hud-combo');
  _hudLives = document.getElementById('hud-lives');
  _hudWeapon = document.getElementById('hud-weapon');
  _hudLevel = document.getElementById('hud-level');
  _hudPowerup = document.getElementById('hud-powerup');
  _hudReaction = document.getElementById('hud-reaction');
  _hudAccuracy = document.getElementById('hud-accuracy');
  _hudPbPace = document.getElementById('hud-pb-pace');
  _hudStreak = document.getElementById('hud-streak');
  _hudSurge = document.getElementById('hud-surge');
  _hudDebuff = document.getElementById('hud-debuff');
  _hudColorMatch = document.getElementById('hud-color-match');
  _scene = document.getElementById('scene');
  _btnQuitVr = document.getElementById('btn-quit-vr');

  // VR Quit button
  if (_btnQuitVr) {
    const vrPlane = _btnQuitVr.querySelector('a-plane');
    if (vrPlane) {
      const handleQuit = () => {
        endGame();
      };
      vrPlane.addEventListener('click', handleQuit);
      vrPlane.addEventListener('hit', handleQuit);
      vrPlane.addEventListener('mouseenter', () => {
        vrPlane.setAttribute('material', 'opacity', 1.0);
        vrPlane.setAttribute('color', '#882222');
      });
      vrPlane.addEventListener('mouseleave', () => {
        vrPlane.setAttribute('material', 'opacity', 0.9);
        vrPlane.setAttribute('color', '#661a1a');
      });
    }
  }

  // Track shots for accuracy (VR triggers and flat-screen clicks)
  document.addEventListener('shot-fired', () => {
    if (gameManager.state === GameState.PLAYING) {
      scoreManager.recordShot();
      // TASK-312: Block shot if weapon jammed
      if (tensionSystem.isJammed) return;
      _shotsFired++;
      _updateAccuracyHud();
      document.dispatchEvent(new CustomEvent('camera-fov-punch'));
    }
  });
  _scene.addEventListener('click', () => {
    if (gameManager.state === GameState.PLAYING) {
      scoreManager.recordShot();
    }
  });

  // Spawn ambient particles once
  _spawnAmbientParticles(_scene);

  // Shield block bonus points (TASK-254)
  document.addEventListener('shield-block', (e) => {
    if (gameManager.state !== GameState.PLAYING) return;
    const pts = e.detail?.points || 5;
    scoreManager.add(pts);
    // Damage number at block position
    if (e.detail?.pos && _scene) {
      const pos = e.detail.pos;
      const el = document.createElement('a-entity');
      el.setAttribute('position', `${pos.x} ${pos.y + 0.3} ${pos.z}`);
      el.setAttribute('damage-number', `text: +${pts} BLOCK; color: #4488ff`);
      _scene.appendChild(el);
    }
  });

  // Scare ball dodge bonus (TASK-255)
  document.addEventListener('scare-dodge', (e) => {
    if (gameManager.state !== GameState.PLAYING) return;
    const pts = e.detail?.points || 3;
    scoreManager.add(pts);
    if (e.detail?.pos && _scene) {
      const pos = e.detail.pos;
      const el = document.createElement('a-entity');
      el.setAttribute('position', `${pos.x} ${pos.y + 0.3} ${pos.z}`);
      el.setAttribute('damage-number', `text: DODGE! +${pts}; color: #00ffff`);
      _scene.appendChild(el);
    }
  });

  // Punch hit bonus (TASK-256)
  document.addEventListener('punch-hit', (e) => {
    if (gameManager.state !== GameState.PLAYING) return;
    if (e.detail?.pos && _scene) {
      const pos = e.detail.pos;
      const el = document.createElement('a-entity');
      el.setAttribute('position', `${pos.x} ${pos.y + 0.3} ${pos.z}`);
      el.setAttribute('damage-number', `text: PUNCH!; color: #ff8800`);
      _scene.appendChild(el);
    }
  });

  // Laser dodge bonus (TASK-258)
  document.addEventListener('laser-dodge', (e) => {
    if (gameManager.state !== GameState.PLAYING) return;
    const pts = e.detail?.points || 5;
    scoreManager.add(pts);
    if (e.detail?.pos && _scene) {
      const pos = e.detail.pos;
      const el = document.createElement('a-entity');
      el.setAttribute('position', `${pos.x} ${pos.y + 0.3} ${pos.z}`);
      el.setAttribute('damage-number', `text: DODGE! +${pts}; color: #ff4444`);
      _scene.appendChild(el);
    }
  });

  // TASK-300: Reaction time HUD
  document.addEventListener('reaction-time', (e) => {
    if (gameManager.state !== GameState.PLAYING || !_hudReaction) return;
    // TASK-314: Track hits for accuracy
    _shotsHit++;
    _updateAccuracyHud();
    const ms = e.detail?.ms || 0;
    const avg = e.detail?.avg || 0;
    const color = ms < 200 ? '#44ff44' : ms < 400 ? '#ffff00' : '#ff4444';
    _hudReaction.setAttribute('value', `⚡ ${ms}ms (avg ${avg}ms)`);
    _hudReaction.setAttribute('color', color);
  });

  // TASK-301: Color-match HUD indicator
  document.addEventListener('color-match-change', (e) => {
    if (!_hudColorMatch) return;
    const { emoji, color } = e.detail;
    _hudColorMatch.setAttribute('value', `SHOOT: ${emoji}`);
    _hudColorMatch.setAttribute('color', color);
    _hudColorMatch.setAttribute('visible', 'true');
    // Flash animation
    _hudColorMatch.setAttribute('animation__flash', {
      property: 'scale', from: '0.5 0.5 0.5', to: '0.35 0.35 0.35',
      dur: 200, easing: 'easeOutBack',
    });
  });

  // TASK-311: Surge event HUD
  document.addEventListener('surge-warning', () => {
    if (!_hudSurge) return;
    _hudSurge.setAttribute('value', '⚡ SURGE!');
    _hudSurge.setAttribute('visible', 'true');
    _hudSurge.setAttribute('animation__pop', {
      property: 'scale', from: '0.6 0.6 0.6', to: '0.4 0.4 0.4',
      dur: 200, easing: 'easeOutBack',
    });
    audioManager.playGo?.();
  });

  document.addEventListener('surge-start', () => {
    if (!_hudSurge) return;
    _surgeCountdown = 5;
    _surgeHudTimer = setInterval(() => {
      _surgeCountdown--;
      if (_surgeCountdown > 0 && _hudSurge) {
        _hudSurge.setAttribute('value', `⚡ SURGE: ${_surgeCountdown}s`);
      }
    }, 1000);
  });

  document.addEventListener('surge-end', () => {
    if (_surgeHudTimer) { clearInterval(_surgeHudTimer); _surgeHudTimer = null; }
    if (_hudSurge) {
      _hudSurge.setAttribute('value', '');
      _hudSurge.setAttribute('visible', 'false');
    }
  });

  document.addEventListener('arena-reset', () => {
    if (_hudCombo) {
      _hudCombo.setAttribute('value', '🔓 ARENA RESET!');
      _hudCombo.setAttribute('color', '#00ffff');
      setTimeout(() => { if (_hudCombo) _hudCombo.setAttribute('value', ''); }, 2000);
    }
  });

  // Slow-motion overlay handler
  document.addEventListener('slow-motion', (e) => {
    const settings = getSettings();
    if (settings.reducedMotion) return;

    if (e.detail.active) {
      _showSlowMoOverlay();
      musicManager.setPlaybackRate(0.5);
      document.dispatchEvent(new CustomEvent('camera-impact-zoom', { detail: { duration: 200 } }));
    } else {
      _hideSlowMoOverlay();
      musicManager.setPlaybackRate(1.0);
    }
  });

  // Boss mode HUD handlers
  const hudBoss = document.getElementById('hud-boss');
  const bossBarFill = document.getElementById('boss-bar-fill');
  const bossBarLabel = document.getElementById('boss-bar-label');

  document.addEventListener('boss-spawn', (e) => {
    if (!hudBoss) return;
    hudBoss.setAttribute('visible', 'true');
    if (bossBarFill) {
      bossBarFill.setAttribute('width', '0.5');
      bossBarFill.setAttribute('color', '#44ff44');
    }
    if (bossBarLabel) {
      const w = e.detail.wave;
      bossBarLabel.setAttribute('value', w > 0 && w % 5 === 0 ? `BOSS WAVE ${w}!` : `WAVE ${w + 1}`);
    }
  });

  document.addEventListener('boss-damaged', (e) => {
    if (!hudBoss || !bossBarFill) return;
    const { hp, maxHp } = e.detail;
    const pct = hp / maxHp;
    bossBarFill.setAttribute('width', String(0.5 * pct));
    // Color transition by HP %
    if (pct > 0.5)      bossBarFill.setAttribute('color', '#44ff44');
    else if (pct > 0.25) bossBarFill.setAttribute('color', '#ffaa00');
    else                  bossBarFill.setAttribute('color', '#ff3333');
    audioManager.playBossHit();
  });

  document.addEventListener('boss-killed', (e) => {
    if (!hudBoss) return;
    setTimeout(() => hudBoss.setAttribute('visible', 'false'), 500);
    // Boss kill particle burst at boss position
    if (_scene && e.detail?.position) {
      _spawnEventParticles(_scene, e.detail.position, 8, '#ffd700');
    }
    // Big camera shake on boss kill
    document.dispatchEvent(new CustomEvent('camera-shake', { detail: { intensity: 0.03, duration: 300 } }));
  });

  document.addEventListener('boss-wave-clear', (e) => {
    // Show wave clear announcement via combo HUD
    if (_hudCombo) {
      _hudCombo.setAttribute('value', `WAVE ${e.detail.wave} CLEAR!`);
      _hudCombo.setAttribute('color', '#ffd700');
      _hudCombo.setAttribute('animation__pop', {
        property: 'scale', from: '0.6 0.6 0.6', to: '0.4 0.4 0.4',
        dur: 300, easing: 'easeOutElastic',
      });
      setTimeout(() => _hudCombo.setAttribute('value', ''), 2000);
    }
  });
}

function _showSlowMoOverlay() {
  let overlay = document.getElementById('slow-mo-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'slow-mo-overlay';
    overlay.className = 'slow-mo-overlay';
    document.body.appendChild(overlay);
  }
  void overlay.offsetWidth;
  overlay.classList.add('active');
}

function _hideSlowMoOverlay() {
  const overlay = document.getElementById('slow-mo-overlay');
  if (overlay) overlay.classList.remove('active');
}

// === TASK-350: Last Stand Mode ===
function _activateLastStand() {
  if (_lastStandActive) return;
  _lastStandActive = true;
  _lastStandConsecutiveHits = 0;
  // Desaturate via bloom-effect
  const sceneEl = document.querySelector('a-scene');
  if (sceneEl?.hasAttribute('bloom-effect')) {
    sceneEl.setAttribute('bloom-effect', 'saturation', 0.2);
  }
  // Faster heartbeat
  tensionSystem.setHeartbeatRate?.(350);
  // Micro camera shake
  _lastStandShakeTimer = setInterval(() => {
    document.dispatchEvent(new CustomEvent('camera-shake', { detail: { intensity: 0.005, duration: 50 } }));
  }, 200);
  // HUD
  if (_hudCombo) {
    _hudCombo.setAttribute('value', '💀 LAST STAND');
    _hudCombo.setAttribute('color', '#ff0000');
    _hudCombo.setAttribute('animation__pop', {
      property: 'scale', from: '0.5 0.5 0.5', to: '0.4 0.4 0.4',
      dur: 500, loop: true, dir: 'alternate', easing: 'easeInOutSine',
    });
  }
}

function _deactivateLastStand() {
  if (!_lastStandActive) return;
  _lastStandActive = false;
  _lastStandConsecutiveHits = 0;
  if (_lastStandShakeTimer) { clearInterval(_lastStandShakeTimer); _lastStandShakeTimer = null; }
  // Restore saturation
  const sceneEl = document.querySelector('a-scene');
  if (sceneEl?.hasAttribute('bloom-effect')) {
    sceneEl.setAttribute('bloom-effect', 'saturation', 1.0);
  }
  tensionSystem.setHeartbeatRate?.(500);
  if (_hudCombo) {
    _hudCombo.removeAttribute('animation__pop');
    _hudCombo.setAttribute('value', '');
  }
}

function _lastStandRecovery() {
  if (!_lastStandActive) return;
  _lastStandConsecutiveHits++;
  if (_lastStandConsecutiveHits >= 5) {
    // Recover 1 HP
    gameModeManager.addLife();
    _updateLivesDisplay();
    _deactivateLastStand();
    audioManager.playLastStandRecover();
    hapticManager.powerUp?.();
    // Green flash
    if (_hudCombo) {
      _hudCombo.setAttribute('value', '✅ SURVIVED!');
      _hudCombo.setAttribute('color', '#44ff44');
      _hudCombo.setAttribute('animation__pop', {
        property: 'scale', from: '0.6 0.6 0.6', to: '0.4 0.4 0.4',
        dur: 300, easing: 'easeOutElastic',
      });
      setTimeout(() => { if (_hudCombo) _hudCombo.setAttribute('value', ''); }, 2000);
    }
  }
}

// === TASK-353: Darkness Wave ===
function _startDarknessWave() {
  if (_darknessActive || _lastStandActive) return;
  const settings = getSettings();
  if (settings.darknessWave === false) return;

  _darknessActive = true;
  // Warning
  if (_hudCombo) {
    _hudCombo.setAttribute('value', '🌑 DARKNESS INCOMING...');
    _hudCombo.setAttribute('color', '#8844ff');
  }
  audioManager.playDarknessWarn?.();

  // Fade to dark after 3s warning
  setTimeout(() => {
    if (!_darknessActive) return;
    audioManager.playDarknessStart?.();
    const gc = _scene?.querySelector('#game-content') || _scene;
    if (!gc) return;
    // Dim all lights
    const lights = gc.querySelectorAll('a-light');
    lights.forEach(l => {
      l._origIntensity = parseFloat(l.getAttribute('intensity') || '0.6');
      l.setAttribute('animation__dark', {
        property: 'intensity', to: l._origIntensity * 0.1,
        dur: 2000, easing: 'easeInQuad',
      });
    });
    // Boost target emissive
    document.dispatchEvent(new CustomEvent('darkness-active', { detail: { active: true } }));
    // Speed up targets
    if (targetSystem) targetSystem.setSpawnRate(Math.round(_originalSpawnInterval * 0.67));
    // HUD
    if (_hudCombo) {
      _hudCombo.setAttribute('value', '🌑 DARKNESS! 2x POINTS');
      _hudCombo.setAttribute('color', '#ff44ff');
    }
    // Darkness scoring flag
    window.__darknessActive = true;

    // End darkness after duration
    setTimeout(() => {
      _endDarknessWave();
    }, DARKNESS_DURATION * 1000);
  }, 3000);
}

function _endDarknessWave() {
  if (!_darknessActive) return;
  _darknessActive = false;
  window.__darknessActive = false;
  const gc = _scene?.querySelector('#game-content') || _scene;
  if (gc) {
    const lights = gc.querySelectorAll('a-light');
    lights.forEach(l => {
      if (l._origIntensity !== undefined) {
        l.setAttribute('animation__dark', {
          property: 'intensity', to: l._origIntensity,
          dur: 2000, easing: 'easeOutQuad',
        });
      }
    });
  }
  document.dispatchEvent(new CustomEvent('darkness-active', { detail: { active: false } }));
  if (targetSystem && !_frenzyActive) {
    targetSystem.setSpawnRate(_originalSpawnInterval);
  }
  if (_hudCombo) {
    _hudCombo.setAttribute('value', '☀️ LIGHTS ON');
    _hudCombo.setAttribute('color', '#ffff00');
    setTimeout(() => { if (_hudCombo) _hudCombo.setAttribute('value', ''); }, 1500);
  }
}

// === TASK-355: Sudden Death Overtime ===
function _startOvertime() {
  _overtimeActive = true;
  _overtimeTime = 10.0;
  _overtimeTriggered = true;
  audioManager.playOvertimeStart?.();
  hapticManager.powerUp?.();
  musicManager.setIntensity(20);

  // Double spawn rate
  if (targetSystem) targetSystem.setSpawnRate(Math.round(_originalSpawnInterval * 0.5));

  // Banner
  if (_hudCombo) {
    _hudCombo.setAttribute('value', '⚡ OVERTIME!');
    _hudCombo.setAttribute('color', '#ff4400');
    _hudCombo.setAttribute('animation__pop', {
      property: 'scale', from: '0.8 0.8 0.8', to: '0.4 0.4 0.4',
      dur: 400, easing: 'easeOutElastic',
    });
    setTimeout(() => { if (_hudCombo) _hudCombo.setAttribute('value', ''); }, 2000);
  }

  // Timer
  _hudTimer.setAttribute('color', '#ff0000');
  _hudTimer.setAttribute('animation__pulse', {
    property: 'scale', from: '0.35 0.35 0.35', to: '0.5 0.5 0.5',
    dur: 300, loop: true, dir: 'alternate', easing: 'easeInOutSine',
  });

  _overtimeTimer = setInterval(() => {
    _overtimeTime -= 0.1;
    if (_hudTimer) _hudTimer.setAttribute('value', `OT: ${_overtimeTime.toFixed(1)}s`);
    if (_overtimeTime % 1 < 0.15) audioManager.playOvertimeTick?.();
    if (_overtimeTime <= 0) {
      _endOvertime();
    }
  }, 100);
}

function _endOvertime() {
  if (_overtimeTimer) { clearInterval(_overtimeTimer); _overtimeTimer = null; }
  _overtimeActive = false;
  endGame();
}

function _initRound(themeParam) {
  const container = document.getElementById('target-container');
  const mode = gameModeManager.current;

  const playerLevel = authManager.profile?.level || 1;
  const diff = getLevelScaledDifficulty(getSettings(), playerLevel);
  const challenge = getCurrentChallenge();
  const cMod = challenge.modifiers || {};
  const lifetimeMul = diff.lifetimeMul * (cMod.lifetimeMul || 1);
  _originalSpawnInterval = Math.round(mode.spawnInterval * diff.spawnMul);
  _frenzyActive = false;
  targetSystem = new TargetSystem(container, {
    spawnInterval: _originalSpawnInterval,
    maxTargets: Math.round(mode.maxTargets * diff.maxTargetsMul),
    targetLifetime: Math.round(mode.targetLifetime * lifetimeMul),
    bossMode: mode.id === 'bossRush',
    reflexMode: mode.reflexMode || false,
    challengeModifiers: cMod,
  });

  audioManager.loadSettings();

  _selectedTheme = themeParam || authManager.profile?.selectedTheme || 'cyber';
  applyTheme(_scene, _selectedTheme);

  const settings = getSettings();

  // TASK-260: Weather system
  weatherSystem.init(_scene);
  const weatherEnabled = settings.weather !== false;
  weatherSystem.setEnabled(weatherEnabled);
  weatherSystem.setTheme(_selectedTheme);

  // TASK-262: Arena reactions
  arenaReactions.init(_scene);

  // V19: Tension system (vignette, surge, debuffs, arena walls)
  tensionSystem.start(_scene);

  // TASK-311: Surge callbacks
  tensionSystem.onSurgeStart = () => {
    // Double spawn rate, halve lifetime during surge
    targetSystem.setSpawnRate(Math.round(_originalSpawnInterval * 0.5));
  };
  tensionSystem.onSurgeEnd = () => {
    if (!_frenzyActive) {
      targetSystem.setSpawnRate(_originalSpawnInterval);
    }
  };

  // TASK-312: Debuff HUD callback
  tensionSystem.onDebuffChange = (debuff) => {
    if (!_hudDebuff) return;
    if (debuff) {
      _hudDebuff.setAttribute('value', `${debuff.icon} ${debuff.label}`);
      _hudDebuff.setAttribute('color', debuff.color);
      _hudDebuff.setAttribute('visible', 'true');
    } else {
      _hudDebuff.setAttribute('value', '');
      _hudDebuff.setAttribute('visible', 'false');
    }
  };

  // TASK-314: Reset accuracy tracking
  _shotsFired = 0;
  _shotsHit = 0;
  _currentStreak = 0;

  // V23: Reset tension state
  _lastStandActive = false;
  _lastStandConsecutiveHits = 0;
  if (_lastStandShakeTimer) { clearInterval(_lastStandShakeTimer); _lastStandShakeTimer = null; }
  _chainComboAccelerated = false;
  _darknessActive = false;
  window.__darknessActive = false;
  _darknessElapsed = 0;
  _overtimeActive = false;
  _overtimeTime = 0;
  _overtimeTriggered = false;
  if (_overtimeTimer) { clearInterval(_overtimeTimer); _overtimeTimer = null; }
  if (_darknessTimer) { clearInterval(_darknessTimer); _darknessTimer = null; }
  if (_ghostInterval) { clearInterval(_ghostInterval); _ghostInterval = null; }
  _ghostRecording = [];

  // TASK-354: Load rival ghost data
  const modeId = gameModeManager.current.id;
  try {
    const raw = localStorage.getItem('ghostRun_' + modeId);
    _ghostData = raw ? JSON.parse(raw) : [];
  } catch (_e) { _ghostData = []; }

  // PB pace comparison
  _pbBestScore = authManager.profile?.highScores?.[mode.id] || 0;
  _gameStartTime = Date.now();

  _applyGameSettings(settings);
  _updateControllerLasers();

  if (_hudWeapon) {
    _hudWeapon.setAttribute('value', `${weaponSystem.current.icon} ${weaponSystem.current.name}`);
  }
  if (_hudLevel) {
    const profile = authManager.profile;
    if (profile) {
      _hudLevel.setAttribute('value', `Lv.${profile.level}`);
    }
  }

  // Auto-hide level & weapon labels after 3s (reduce clutter)
  setTimeout(() => {
    if (_hudLevel) _hudLevel.setAttribute('visible', 'false');
    if (_hudWeapon) _hudWeapon.setAttribute('visible', 'false');
  }, 3000);

  _updateLivesDisplay();

  // Ambient environment motion
  _startAmbientMotion(_scene);

  // Power-up HUD updates
  powerUpManager.onUpdate = (display) => {
    if (!_hudPowerup) return;
    if (!display) {
      _hudPowerup.setAttribute('value', '');
      return;
    }
    const secs = (display.remaining / 1000).toFixed(1);
    _hudPowerup.setAttribute('value', `${display.label} ${secs}s`);
    _hudPowerup.setAttribute('color', display.color);
  };

  powerUpManager.onDeactivate = () => {
    if (_hudPowerup) _hudPowerup.setAttribute('value', '');
  };

  // TASK-288: Wave event HUD announcement
  document.addEventListener('wave-event', (evt) => {
    const names = { swarm: '🌊 SWARM!', sniper: '🎯 SNIPER DUEL!', bonusRain: '🌟 BONUS RAIN!', shieldWall: '🛡️ SHIELD WALL!' };
    const name = names[evt.detail?.name] || evt.detail?.name;
    if (_hudCombo) {
      _hudCombo.setAttribute('value', name);
      _hudCombo.setAttribute('color', '#ff8800');
      _hudCombo.setAttribute('animation__pop', {
        property: 'scale', from: '0.6 0.6 0.6', to: '0.4 0.4 0.4',
        dur: 300, easing: 'easeOutElastic',
      });
      setTimeout(() => { if (_hudCombo) _hudCombo.setAttribute('value', ''); }, 2000);
    }
  });

  scoreManager.onChange(score => {
    _hudScore.setAttribute('value', `Score: ${score}`);
    // Score pop animation
    _hudScore.setAttribute('animation__pop', {
      property: 'scale', from: '0.42 0.42 0.42', to: '0.35 0.35 0.35',
      dur: 150, easing: 'easeOutQuad',
    });

    // TASK-314 + TASK-354: PB Pace indicator with ghost comparison
    if (_hudPbPace && _pbBestScore > 0) {
      const elapsed = Date.now() - _gameStartTime;
      // TASK-354: Use ghost data if available, else estimate linearly
      let expectedAtThisPoint = 0;
      if (_ghostData.length > 0) {
        const elapsedMs = elapsed;
        // Find closest ghost data point
        for (let i = _ghostData.length - 1; i >= 0; i--) {
          if (_ghostData[i].time <= elapsedMs) {
            expectedAtThisPoint = _ghostData[i].score;
            break;
          }
        }
      } else if (timeLeft !== Infinity) {
        const duration = gameModeManager.current.duration * 1000;
        const progress = elapsed / duration;
        expectedAtThisPoint = Math.round(_pbBestScore * progress);
      }
      if (expectedAtThisPoint > 0 || _ghostData.length > 0) {
        const diff = score - expectedAtThisPoint;
        if (diff >= 0) {
          _hudPbPace.setAttribute('value', `▲ +${diff}`);
          _hudPbPace.setAttribute('color', '#44ff44');
        } else {
          _hudPbPace.setAttribute('value', `▼ ${diff}`);
          _hudPbPace.setAttribute('color', '#ff4444');
          // TASK-354: Behind ghost = subtle red tint
          if (diff < -50) {
            musicManager.setIntensity(Math.max(musicManager._intensity || 0, 2));
          }
        }
        // TASK-354: New record pace flash
        if (score > _pbBestScore && !_hudPbPace._recordFlashed) {
          _hudPbPace._recordFlashed = true;
          _hudPbPace.setAttribute('value', '🏆 NEW RECORD PACE!');
          _hudPbPace.setAttribute('color', '#ffd700');
          setTimeout(() => { if (_hudPbPace) _hudPbPace._recordFlashed = false; }, 3000);
        }
      }
    }
  });

  targetSystem.onComboChange = (combo) => {
    // TASK-310: Update tension vignette for combo
    tensionSystem.updateCombo(combo);

    // TASK-350: Last Stand recovery on hit
    if (combo > 0 && _lastStandActive) {
      _lastStandRecovery();
    }
    // TASK-355: Overtime hit bonus
    if (combo > 0 && _overtimeActive) {
      _overtimeTime = Math.min(15, _overtimeTime + 1);
    }

    // TASK-314: Streak counter
    if (combo > 0) {
      _currentStreak = combo;
      if (_hudStreak) {
        _hudStreak.setAttribute('value', `🔥 ${combo}`);
      }
    } else {
      _currentStreak = 0;
      if (_hudStreak) _hudStreak.setAttribute('value', '');
    }

    // TASK-311: Check surge on wave transitions (combo resets = wave change proxy)
    if (combo > 0 && targetSystem.targetsHit > 0 && targetSystem.targetsHit % 5 === 0) {
      const wave = Math.floor(targetSystem.targetsHit / 5);
      tensionSystem.checkSurge(wave);
      // TASK-313: Arena wall shrink
      const arenaScale = tensionSystem.updateArenaForWave(wave);
      if (arenaScale < 1.0 && targetSystem._pick360Position) {
        // Arena scale is handled via SPAWN constants adjustment in target system
      }
    }

    if (combo >= 2) {
      _hudCombo.setAttribute('value', `x${combo} COMBO!`);
      // Color escalation
      let color = '#ff44aa';
      if (combo >= 10) color = '#ffd700';
      else if (combo >= 5) color = '#ff8800';

      // Camera shake scales with combo
      if (combo >= 5) {
        const intensity = combo >= 15 ? 0.025 : combo >= 10 ? 0.018 : 0.01;
        const dur = combo >= 15 ? 200 : combo >= 10 ? 150 : 100;
        document.dispatchEvent(new CustomEvent('camera-shake', { detail: { intensity, duration: dur } }));
      }
      _hudCombo.setAttribute('color', color);

      // HUD pulse — frequency increases with combo
      const pulseDur = combo >= 15 ? 200 : combo >= 10 ? 300 : combo >= 5 ? 500 : 700;
      _hudCombo.setAttribute('animation__pop', {
        property: 'scale',
        from: '0.5 0.5 0.5', to: '0.4 0.4 0.4',
        dur: pulseDur, easing: 'easeOutElastic',
        loop: true, dir: 'alternate',
      });

      // Shake at x10+
      if (combo >= 10) {
        _hudCombo.setAttribute('animation__shake', {
          property: 'position', from: '-0.01 0.2 -1', to: '0.01 0.2 -1',
          dur: 80, loop: 3, dir: 'alternate', easing: 'linear',
        });
        // Energy burst at camera position for high combo
        const cam = document.getElementById('camera');
        if (cam && _scene) {
          const cp = cam.object3D.getWorldPosition(new THREE.Vector3());
          _spawnEventParticles(_scene, { x: cp.x, y: cp.y, z: cp.z - 2 }, 5, color);
        }
      }

      // Bass drop zoom-out snap at milestone combos (x5, x10, x15, x20...)
      if (combo % 5 === 0 && combo >= 5) {
        const zoomDur = combo >= 15 ? 300 : combo >= 10 ? 250 : 200;
        document.dispatchEvent(new CustomEvent('camera-impact-zoom', { detail: { duration: zoomDur } }));
        hapticManager.combo(combo);
      }

      // Combo vignette overlay
      _updateComboVignette(combo);

      // Arena barrier glow intensifies with combo
      _updateBarrierComboGlow(combo);

      // Dynamic music intensity
      musicManager.setIntensity(combo);

      // TASK-352: Chain Combo acceleration
      if (combo >= 15 && !_chainComboAccelerated) {
        _chainComboAccelerated = true;
        targetSystem.setSpawnRate(Math.round(_originalSpawnInterval * 0.67));
        if (_hudCombo) {
          _hudCombo.setAttribute('value', `⚡ x${combo} CHAIN RUSH!`);
        }
      }
    } else {
      _hudCombo.setAttribute('value', '');
      _hudCombo.removeAttribute('animation__pop');
      _updateComboVignette(0);
      _updateBarrierComboGlow(0);
      musicManager.setIntensity(0);
      // TASK-352: Reset chain acceleration
      if (_chainComboAccelerated) {
        _chainComboAccelerated = false;
        if (!_frenzyActive && !_darknessActive && !_overtimeActive) {
          targetSystem.setSpawnRate(_originalSpawnInterval);
        }
      }
    }
  };

  targetSystem.onMiss = () => {
    // TASK-355: Overtime hit/miss
    if (_overtimeActive) {
      _overtimeTime = Math.max(0, _overtimeTime - 2);
      return;
    }
    // TASK-350: Reset Last Stand consecutive hits on miss
    _lastStandConsecutiveHits = 0;

    const currentMode = gameModeManager.current;
    if (currentMode.lives !== Infinity) {
      const dead = gameModeManager.loseLife();
      audioManager.playLifeLost();
      hapticManager.damageTaken();
      _updateLivesDisplay();
      // TASK-310: Update tension for lives change
      tensionSystem.updateDanger(gameModeManager.lives, currentMode.lives, timeLeft, currentMode.duration);
      // Shake lives display
      if (_hudLives) {
        _hudLives.setAttribute('animation__shake', {
          property: 'position', from: '-0.47 0.22 -1', to: '-0.43 0.22 -1',
          dur: 80, loop: 3, dir: 'alternate', easing: 'linear',
        });
        setTimeout(() => {
          _hudLives.setAttribute('position', '-0.45 0.22 -1');
          _hudLives.removeAttribute('animation__shake');
        }, 500);
      }
      // TASK-350: Activate Last Stand at 1 HP
      if (!dead && gameModeManager.lives === 1) {
        _activateLastStand();
      }
      if (dead) endGame();
    }
  };

  // Player damage from projectiles, chargers, danger zones, bombs (TASK-250/251/253/351)
  targetSystem.onPlayerDamage = (source) => {
    // TASK-271: Shield absorbs hit
    if (powerUpManager.consumeShield()) {
      audioManager.playShieldBlock({ x: 0, y: 1.5, z: 0 });
      hapticManager.pulse(0.6, 80);
      if (_scene) {
        const el = document.createElement('a-entity');
        el.setAttribute('position', '0 1.5 -0.5');
        el.setAttribute('damage-number', 'text: SHIELDED!; color: #4488ff');
        _scene.appendChild(el);
      }
      return;
    }
    // TASK-350: Reset Last Stand hits on damage
    _lastStandConsecutiveHits = 0;
    const currentMode = gameModeManager.current;
    if (currentMode.lives !== Infinity) {
      const dead = gameModeManager.loseLife();
      _updateLivesDisplay();
      // TASK-350: Activate Last Stand at 1 HP
      if (!dead && gameModeManager.lives === 1) {
        _activateLastStand();
      }
      if (dead) endGame();
    } else {
      // Time attack: deduct points
      scoreManager.add(source === 'dangerZone' ? -10 : source === 'bomb' ? -30 : -20);
    }
    // Camera shake on damage
    document.dispatchEvent(new CustomEvent('camera-shake', { detail: { intensity: 0.02, duration: 200 } }));
  };

  _startCountdown();
}

function _updateLivesDisplay() {
  if (!_hudLives) return;
  const lives = gameModeManager.lives;
  if (lives === Infinity) {
    _hudLives.setAttribute('value', '');
  } else {
    _hudLives.setAttribute('value', '♥'.repeat(Math.max(0, lives)));
  }
}

function _updateControllerLasers() {
  const weapon = weaponSystem.current;
  const profile = authManager.profile;
  const skinId = profile?.weaponSkins?.[weapon.id] || 'default';
  const overrides = getSkinOverrides(skinId, weapon);
  const laserColor = overrides.laserColor || weapon.laserColor;
  const laserOpacity = overrides.laserOpacity || weapon.laserOpacity;

  const rightHand = document.getElementById('right-hand');
  const leftHand = document.getElementById('left-hand');
  if (rightHand) {
    rightHand.setAttribute('raycaster', 'lineColor', laserColor);
    rightHand.setAttribute('raycaster', 'lineOpacity', laserOpacity);
  }
  if (leftHand) {
    leftHand.setAttribute('raycaster', 'lineColor', laserColor);
    leftHand.setAttribute('raycaster', 'lineOpacity', laserOpacity);
  }
}

/** Theme-specific ambient particle palettes */
const THEME_PARTICLES = {
  cyber:  { dust: '#aaccff', sparks: '#00d4ff', debris: '#4466ff' },
  sunset: { dust: '#ffccaa', sparks: '#ff6600', debris: '#ff4400' },
  space:  { dust: '#8899cc', sparks: '#4488ff', debris: '#6644ff' },
  neon:   { dust: '#ff88ff', sparks: '#ff00ff', debris: '#00ffff' },
  day:    { dust: '#ffffcc', sparks: '#44cc88', debris: '#88bbdd' },
};

function _spawnAmbientParticles(sceneEl) {
  const palette = THEME_PARTICLES[_selectedTheme] || THEME_PARTICLES.cyber;
  const settings = typeof getSettings === 'function' ? getSettings() : {};

  // TASK-320: Use GPU particles when available
  if (settings.particles !== 'off' && AFRAME.components['gpu-particles']) {
    const countMul = settings.particles === 'low' ? 0.5 : 1;

    // Dust motes
    const dust = document.createElement('a-entity');
    dust.setAttribute('class', 'ambient-particle');
    dust.setAttribute('gpu-particles', `preset: dust; count: ${Math.round(1200 * countMul)}; color: ${palette.dust}; area: 28; height: 5; opacity: 0.15`);
    sceneEl.appendChild(dust);

    // Energy sparks
    const sparks = document.createElement('a-entity');
    sparks.setAttribute('class', 'ambient-particle');
    sparks.setAttribute('gpu-particles', `preset: ambient; count: ${Math.round(800 * countMul)}; color: ${palette.sparks}; area: 24; height: 4; opacity: 0.4; size: 0.008`);
    sceneEl.appendChild(sparks);

    return;
  }

  // Legacy fallback: entity-based ambient particles
  // --- Dust motes (40) ---
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('a-sphere');
    const x = (Math.random() - 0.5) * 28;
    const y = Math.random() * 5 + 0.3;
    const z = (Math.random() - 0.5) * 28;
    p.setAttribute('class', 'ambient-particle');
    p.setAttribute('radius', String(0.008 + Math.random() * 0.012));
    p.setAttribute('material', `shader: flat; color: ${palette.dust}; opacity: ${0.08 + Math.random() * 0.12}`);
    p.setAttribute('position', `${x} ${y} ${z}`);
    p.setAttribute('animation', {
      property: 'position',
      to: `${x + (Math.random() - 0.5) * 3} ${y + 0.5 + Math.random() * 1.5} ${z + (Math.random() - 0.5) * 3}`,
      dur: 8000 + Math.random() * 6000,
      easing: 'linear', loop: true, dir: 'alternate',
    });
    sceneEl.appendChild(p);
  }

  // --- Energy sparks (20) ---
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('a-sphere');
    const x = (Math.random() - 0.5) * 24;
    const y = Math.random() * 4 + 1;
    const z = (Math.random() - 0.5) * 24;
    p.setAttribute('class', 'ambient-particle');
    p.setAttribute('radius', String(0.006 + Math.random() * 0.008));
    p.setAttribute('material', `shader: flat; color: ${palette.sparks}; opacity: ${0.3 + Math.random() * 0.4}`);
    p.setAttribute('position', `${x} ${y} ${z}`);
    p.setAttribute('animation__drift', {
      property: 'position',
      to: `${x + (Math.random() - 0.5) * 5} ${y + (Math.random() - 0.5) * 3} ${z + (Math.random() - 0.5) * 5}`,
      dur: 2000 + Math.random() * 2000,
      easing: 'easeInOutSine', loop: true, dir: 'alternate',
    });
    p.setAttribute('animation__twinkle', {
      property: 'material.opacity', from: 0.1, to: 0.6 + Math.random() * 0.3,
      dur: 600 + Math.random() * 800,
      loop: true, dir: 'alternate', easing: 'easeInOutSine',
    });
    sceneEl.appendChild(p);
  }

  // --- Floating debris (10) ---
  const debrisGeoms = ['a-icosahedron', 'a-octahedron', 'a-dodecahedron'];
  for (let i = 0; i < 10; i++) {
    const geom = debrisGeoms[Math.floor(Math.random() * debrisGeoms.length)];
    const p = document.createElement(geom);
    const x = (Math.random() - 0.5) * 26;
    const y = Math.random() * 4 + 1;
    const z = (Math.random() - 0.5) * 26;
    p.setAttribute('class', 'ambient-particle');
    p.setAttribute('radius', String(0.02 + Math.random() * 0.03));
    p.setAttribute('material', `color: ${palette.debris}; metalness: 0.7; roughness: 0.3; emissive: ${palette.debris}; emissiveIntensity: 0.3; opacity: ${0.15 + Math.random() * 0.2}`);
    p.setAttribute('position', `${x} ${y} ${z}`);
    p.setAttribute('animation__float', {
      property: 'position',
      to: `${x + (Math.random() - 0.5) * 2} ${y + Math.random() * 2} ${z + (Math.random() - 0.5) * 2}`,
      dur: 7000 + Math.random() * 5000,
      easing: 'easeInOutSine', loop: true, dir: 'alternate',
    });
    p.setAttribute('animation__spin', {
      property: 'rotation',
      to: `${Math.random() * 360} ${Math.random() * 360} ${Math.random() * 360}`,
      dur: 6000 + Math.random() * 6000,
      easing: 'linear', loop: true,
    });
    sceneEl.appendChild(p);
  }
}

/** Spawn burst particles on game events (target destroy, combo, power-up) */
function _spawnEventParticles(sceneEl, pos, count, color) {
  for (let i = 0; i < count; i++) {
    const p = document.createElement('a-sphere');
    p.setAttribute('radius', '0.01');
    p.setAttribute('material', `shader: flat; color: ${color}; opacity: 0.7`);
    p.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    const dx = (Math.random() - 0.5) * 3;
    const dy = Math.random() * 2;
    const dz = (Math.random() - 0.5) * 3;
    p.setAttribute('animation__burst', {
      property: 'position',
      to: `${pos.x + dx} ${pos.y + dy} ${pos.z + dz}`,
      dur: 400 + Math.random() * 200,
      easing: 'easeOutQuad',
    });
    p.setAttribute('animation__fade', {
      property: 'material.opacity', from: 0.7, to: 0,
      dur: 500, easing: 'easeOutQuad',
    });
    sceneEl.appendChild(p);
    setTimeout(() => { if (p.parentNode) p.parentNode.removeChild(p); }, 600);
  }
}

function _applyGameSettings(settings) {
  const crosshair = document.getElementById('crosshair');
  if (crosshair) {
    crosshair.setAttribute('material', `shader: flat; color: ${settings.crosshairColor}; opacity: 0.8`);
    crosshair.setAttribute('color', settings.crosshairColor);
    const sizes = { small: { inner: 0.007, outer: 0.01 }, medium: { inner: 0.01, outer: 0.015 }, large: { inner: 0.015, outer: 0.022 } };
    const s = sizes[settings.crosshairSize] || sizes.medium;
    crosshair.setAttribute('radius-inner', String(s.inner));
    crosshair.setAttribute('radius-outer', String(s.outer));
  }

  if (!settings.showCombo && _hudCombo) {
    _hudCombo.setAttribute('visible', 'false');
  }

  // Minimal HUD: hide everything except score + timer + crosshair
  if (settings.minimalHud) {
    if (_hudCombo) _hudCombo.setAttribute('visible', 'false');
    if (_hudLives) _hudLives.setAttribute('visible', 'false');
    if (_hudWeapon) _hudWeapon.setAttribute('visible', 'false');
    if (_hudLevel) _hudLevel.setAttribute('visible', 'false');
    if (_hudPowerup) _hudPowerup.setAttribute('visible', 'false');
  }

  // Bloom toggle
  const sceneEl = document.querySelector('a-scene');
  if (sceneEl && sceneEl.hasAttribute('bloom-effect')) {
    sceneEl.setAttribute('bloom-effect', 'enabled', settings.bloom !== false);
  }

  // Screen shake level
  const cam = document.getElementById('camera');
  if (cam && cam.hasAttribute('camera-effects')) {
    cam.setAttribute('camera-effects', 'shakeLevel', settings.screenShake || 'medium');
  }
}

function _startCountdown() {
  let count = COUNTDOWN_FROM;
  const hudCountdown = document.getElementById('hud-countdown');
  if (hudCountdown) {
    hudCountdown.setAttribute('value', String(count));
    hudCountdown.setAttribute('visible', 'true');
    hudCountdown.setAttribute('scale', '0.8 0.8 0.8');
  }

  const countInterval = setInterval(() => {
    count--;
    if (count > 0) {
      if (hudCountdown) {
        hudCountdown.setAttribute('value', String(count));
        hudCountdown.setAttribute('animation__pop', {
          property: 'scale', from: '1.0 1.0 1.0', to: '0.8 0.8 0.8',
          dur: 300, easing: 'easeOutQuad',
        });
      }
      audioManager.playCountdownBeep();
      hapticManager.pulse(0.2, 30);
    } else {
      if (hudCountdown) {
        hudCountdown.setAttribute('value', 'GO!');
        hudCountdown.setAttribute('color', '#ffaa00');
        hudCountdown.setAttribute('animation__pop', {
          property: 'scale', from: '1.2 1.2 1.2', to: '0.8 0.8 0.8',
          dur: 400, easing: 'easeOutElastic',
        });
      }
      audioManager.playGo();
      clearInterval(countInterval);
      setTimeout(() => {
        if (hudCountdown) {
          hudCountdown.setAttribute('visible', 'false');
          hudCountdown.setAttribute('color', '#00ff88');
        }
        startRound();
      }, 500);
    }
  }, 1000);
}

let _selectedTheme = 'cyber';

function startRound() {
  scoreManager.reset();
  powerUpManager.reset();
  const currentMode = gameModeManager.current;
  timeLeft = currentMode.duration;
  _gameStartTime = Date.now();
  gameModeManager.startRound();
  gameManager.changeState(GameState.PLAYING);
  if (_btnQuitVr) _btnQuitVr.setAttribute('visible', 'true');
  targetSystem.start();

  musicManager.loadSettings();
  musicManager.startMusic(_selectedTheme);

  _hudScore.setAttribute('value', 'Score: 0');
  // Show weekly challenge banner briefly
  const wc = getCurrentChallenge();
  _hudCombo.setAttribute('value', `${wc.icon} ${wc.name}`);
  _hudCombo.setAttribute('color', '#ffd700');
  setTimeout(() => { if (_hudCombo) _hudCombo.setAttribute('value', ''); }, 3000);

  // Reset timer state
  _hudTimer.removeAttribute('animation__pulse');
  _hudTimer.setAttribute('scale', '0.35 0.35 0.35');
  if (timeLeft === Infinity) {
    _hudTimer.setAttribute('value', '∞');
    _hudTimer.setAttribute('color', '#44ff44');
  } else {
    _hudTimer.setAttribute('value', String(timeLeft));
    _hudTimer.setAttribute('color', '#ffaa00');
  }

  _updateLivesDisplay();

  // TASK-353: Darkness wave timer (every 60s)
  _darknessElapsed = 0;
  if (_darknessTimer) clearInterval(_darknessTimer);
  _darknessTimer = setInterval(() => {
    _darknessElapsed++;
    if (_darknessElapsed >= DARKNESS_INTERVAL && !_darknessActive && gameManager.state === GameState.PLAYING) {
      _darknessElapsed = 0;
      _startDarknessWave();
    }
  }, 1000);

  // TASK-354: Ghost recording (every 1s)
  if (_ghostInterval) clearInterval(_ghostInterval);
  _ghostInterval = setInterval(() => {
    if (gameManager.state === GameState.PLAYING) {
      _ghostRecording.push({ time: Date.now() - _gameStartTime, score: scoreManager.score });
    }
  }, 1000);

  if (timerInterval) clearInterval(timerInterval);
  if (timeLeft !== Infinity) {
    timerInterval = setInterval(() => {
      if (powerUpManager.isTimeFrozen()) {
        _hudTimer.setAttribute('color', '#00d4ff');
        return;
      }
      timeLeft--;
      _hudTimer.setAttribute('value', String(timeLeft));

      // TASK-310: Update tension for time pressure
      tensionSystem.updateDanger(gameModeManager.lives, gameModeManager.current.lives, timeLeft, gameModeManager.current.duration);

      if (timeLeft <= 3 && !_frenzyActive) {
        // TASK-291: Extreme frenzy — triple spawn rate
        _frenzyActive = true;
        targetSystem.setSpawnRate(Math.round(_originalSpawnInterval * 0.33));
      }
      if (timeLeft <= 5) {
        _hudTimer.setAttribute('color', '#ff0000');
        _hudTimer.setAttribute('animation__pulse', {
          property: 'scale', from: '0.35 0.35 0.35', to: '0.45 0.45 0.45',
          dur: 400, loop: true, dir: 'alternate', easing: 'easeInOutSine',
        });
      } else if (timeLeft <= 10) {
        _hudTimer.setAttribute('color', '#ff4444');
        _hudTimer.setAttribute('animation__pulse', {
          property: 'scale', from: '0.35 0.35 0.35', to: '0.42 0.42 0.42',
          dur: 500, loop: true, dir: 'alternate', easing: 'easeInOutSine',
        });
        // TASK-291: Final Rush — double spawn rate + announce
        if (timeLeft === 10) {
          targetSystem.setSpawnRate(Math.round(_originalSpawnInterval * 0.5));
          musicManager.setIntensity(20);
          if (_hudCombo) {
            _hudCombo.setAttribute('value', '⚡ FINAL RUSH!');
            _hudCombo.setAttribute('color', '#ff0000');
            _hudCombo.setAttribute('animation__pop', {
              property: 'scale', from: '0.7 0.7 0.7', to: '0.4 0.4 0.4',
              dur: 400, easing: 'easeOutElastic',
            });
            setTimeout(() => { if (_hudCombo) _hudCombo.setAttribute('value', ''); }, 2000);
          }
          // Red vignette pulse
          document.dispatchEvent(new CustomEvent('camera-vignette', { detail: { color: '#ff0000', intensity: 0.3 } }));
          // Heartbeat audio via low-frequency pulses
          audioManager.playHeartbeat?.();
        }
      } else {
        _hudTimer.setAttribute('color', '#ffaa00');
        _hudTimer.removeAttribute('animation__pulse');
        _hudTimer.setAttribute('scale', '0.35 0.35 0.35');
      }

      if (timeLeft <= 0) {
        // TASK-355: Check for overtime eligibility
        if (!_overtimeTriggered && _pbBestScore > 0) {
          const score = scoreManager.score;
          if (score >= _pbBestScore * 0.8) {
            clearInterval(timerInterval);
            timerInterval = null;
            _startOvertime();
            return;
          }
        }
        endGame();
      }
    }, 1000);
  }
}

async function endGame() {
  if (timerInterval) clearInterval(timerInterval);
  if (_overtimeTimer) { clearInterval(_overtimeTimer); _overtimeTimer = null; }
  if (_darknessTimer) { clearInterval(_darknessTimer); _darknessTimer = null; }
  if (_ghostInterval) { clearInterval(_ghostInterval); _ghostInterval = null; }
  if (_lastStandShakeTimer) { clearInterval(_lastStandShakeTimer); _lastStandShakeTimer = null; }
  _overtimeActive = false;
  _darknessActive = false;
  window.__darknessActive = false;
  _lastStandActive = false;
  _chainComboAccelerated = false;

  if (_btnQuitVr) _btnQuitVr.setAttribute('visible', 'false');
  gameManager.changeState(GameState.GAME_OVER);
  targetSystem.stop();
  tensionSystem.stop();
  powerUpManager.reset();
  musicManager.stopMusic();
  weatherSystem.stop();
  if (_surgeHudTimer) { clearInterval(_surgeHudTimer); _surgeHudTimer = null; }
  document.dispatchEvent(new CustomEvent('game-over-reactions'));
  arenaReactions.stop();
  audioManager.playGameOver();

  // Restore bloom saturation if Last Stand was active
  const sceneEl = document.querySelector('a-scene');
  if (sceneEl?.hasAttribute('bloom-effect')) {
    sceneEl.setAttribute('bloom-effect', 'saturation', 1.0);
  }

  const result = scoreManager.finalize();
  const currentMode = gameModeManager.current;

  const summary = buildSummary(result, authManager.profile, currentMode, targetSystem);
  const xpEarned = summary.xpEarned;

  // TASK-354: Save ghost recording if new high score
  const isNewHigh = await authManager.updateHighScore(currentMode.id, result.score);
  if (isNewHigh && _ghostRecording.length > 0) {
    try {
      localStorage.setItem('ghostRun_' + currentMode.id, JSON.stringify(_ghostRecording));
    } catch (_e) { /* ignore */ }
  }
  const levelResult = await authManager.addXp(xpEarned);
  await authManager.recordGameResult({
    targetsHit: targetSystem.targetsHit,
    bestCombo: targetSystem.bestCombo,
  });

  const profile = authManager.profile;
  const weaponId = weaponSystem.currentId;
  const wu = { ...(profile.weaponUsage || {}) };
  wu[weaponId] = (wu[weaponId] || 0) + 1;
  const ms = { ...(profile.modeStats || {}) };
  if (!ms[currentMode.id]) ms[currentMode.id] = { games: 0, shots: 0, hits: 0 };
  ms[currentMode.id].games++;
  ms[currentMode.id].shots = (ms[currentMode.id].shots || 0) + (summary.shotsFired || 0);
  ms[currentMode.id].hits = (ms[currentMode.id].hits || 0) + (summary.targetsHit || 0);
  const recent = [...(profile.recentGames || [])];
  recent.push({ mode: currentMode.id, weapon: weaponId, score: result.score, targets: targetSystem.targetsHit, date: Date.now() });
  if (recent.length > 10) recent.shift();
  // Enhanced stats tracking
  const totalShotsFired = (profile.totalShotsFired || 0) + (summary.shotsFired || 0);
  const gameDuration = Math.round((Date.now() - _gameStartTime) / 1000);
  const totalPlayTime = (profile.totalPlayTime || 0) + gameDuration;
  const bestAccuracy = Math.max(profile.bestAccuracy || 0, summary.accuracy || 0);
  // Per-weapon detailed stats
  const pws = { ...(profile.perWeaponStats || {}) };
  if (!pws[weaponId]) pws[weaponId] = { kills: 0, shots: 0, games: 0, bestScore: 0 };
  pws[weaponId].kills += summary.targetsHit || 0;
  pws[weaponId].shots += summary.shotsFired || 0;
  pws[weaponId].games++;
  pws[weaponId].bestScore = Math.max(pws[weaponId].bestScore, result.score);
  // TASK-300: Reaction time stats
  const avgRt = targetSystem.avgReactionTime;
  const bestRt = targetSystem.bestReactionTime;
  const savedBestRt = profile.bestReactionTime || 9999;
  const newBestRt = bestRt > 0 ? Math.min(savedBestRt, bestRt) : savedBestRt;
  const newAvgRt = avgRt > 0 ? (profile.avgReactionTime > 0 ? Math.round((profile.avgReactionTime + avgRt) / 2) : avgRt) : (profile.avgReactionTime || 0);
  // TASK-304: Peripheral hits
  const totalPeripheralHits = (profile.peripheralHits || 0) + targetSystem.peripheralHits;
  await authManager.saveProfile({ weaponUsage: wu, modeStats: ms, recentGames: recent, totalShotsFired, totalPlayTime, bestAccuracy, perWeaponStats: pws, bestReactionTime: newBestRt === 9999 ? 0 : newBestRt, avgReactionTime: newAvgRt, peripheralHits: totalPeripheralHits });

  // Always submit score — leaderboardManager keeps best per player
  leaderboardManager.submitScore(currentMode.id, result.score).catch(() => {});

  const challengeResult = await checkProgress({
    score: result.score,
    targetsHit: targetSystem.targetsHit,
    bestCombo: targetSystem.bestCombo,
    mode: currentMode.id,
    weapon: weaponId,
  });

  const newAchievements = await checkAchievements();

  // TASK-296: Achievement toast notifications
  if (newAchievements.length > 0) {
    audioManager.playAchievement?.();
    showAchievementToasts(newAchievements);
  }

  // TASK-293: Daily challenge completion notification
  if (challengeResult.justCompleted && _hudCombo) {
    setTimeout(() => {
      _hudCombo.setAttribute('value', `✅ Challenge Complete! +${challengeResult.challenge.rewardXp} XP`);
      _hudCombo.setAttribute('color', '#00ff88');
      _hudCombo.setAttribute('visible', 'true');
      setTimeout(() => _hudCombo.setAttribute('value', ''), 3000);
    }, 500);
  }

  if (levelResult.leveledUp) {
    audioManager.playLevelUp();
    checkNewUnlocks(levelResult.oldLevel, levelResult.newLevel);

    // TASK-294: Rank-up check
    const oldRank = getRank(profile.totalXp - xpEarned);
    const newRank = getRank(profile.totalXp);
    if (oldRank.tier !== newRank.tier) {
      _showRankUpPopup(newRank);
    }
  }

  // VR: show post-game summary and auto-return to menu
  _showPostGameSummary(result, summary, isNewHigh, xpEarned, challengeResult, currentMode);
}

// TASK-294: Rank-up VR popup
function _showRankUpPopup(rank) {
  const scene = document.querySelector('a-scene');
  if (!scene) return;

  const panel = document.createElement('a-entity');
  panel.setAttribute('position', '0 2.8 -2.5');

  const bg = document.createElement('a-plane');
  bg.setAttribute('width', '1.8');
  bg.setAttribute('height', '0.5');
  bg.setAttribute('material', `shader: flat; color: #111122; opacity: 0.92; transparent: true`);
  bg.setAttribute('position', '0 0 -0.01');
  panel.appendChild(bg);

  const glow = document.createElement('a-plane');
  glow.setAttribute('width', '1.84');
  glow.setAttribute('height', '0.54');
  glow.setAttribute('material', `shader: flat; color: ${rank.color}; opacity: 0.25; transparent: true`);
  glow.setAttribute('position', '0 0 -0.02');
  glow.setAttribute('animation__pulse', {
    property: 'material.opacity', from: 0.15, to: 0.35,
    dur: 600, loop: true, dir: 'alternate', easing: 'easeInOutSine',
  });
  panel.appendChild(glow);

  const title = document.createElement('a-text');
  title.setAttribute('value', 'RANK UP!');
  title.setAttribute('color', rank.color);
  title.setAttribute('align', 'center');
  title.setAttribute('width', '2.5');
  title.setAttribute('position', '0 0.1 0');
  panel.appendChild(title);

  const text = document.createElement('a-text');
  text.setAttribute('value', `${rank.icon} ${rank.tier}`);
  text.setAttribute('color', '#ffffff');
  text.setAttribute('align', 'center');
  text.setAttribute('width', '3');
  text.setAttribute('position', '0 -0.1 0');
  panel.appendChild(text);

  panel.setAttribute('scale', '0 0 0');
  panel.setAttribute('animation__in', {
    property: 'scale', to: '1 1 1', dur: 300, easing: 'easeOutBack',
  });

  scene.appendChild(panel);

  setTimeout(() => {
    panel.setAttribute('animation__out', {
      property: 'scale', to: '0 0 0', dur: 200, easing: 'easeInQuad',
    });
    setTimeout(() => {
      if (panel.parentNode) panel.parentNode.removeChild(panel);
    }, 250);
  }, 4000);
}

// TASK-295: Post-Game Summary Screen
function _showPostGameSummary(result, summary, isNewHigh, xpEarned, challengeResult, currentMode) {
  const hudGameover = document.getElementById('hud-gameover');
  if (!hudGameover) return;

  const goScore = document.getElementById('hud-go-score');
  const goStats = document.getElementById('hud-go-stats');
  const goTitle = document.getElementById('hud-go-title');
  const goInfo = document.getElementById('hud-go-info');

  if (goTitle) {
    if (isNewHigh) {
      goTitle.setAttribute('value', '⭐ NEW HIGH SCORE!');
      goTitle.setAttribute('color', '#ffd700');
    } else {
      goTitle.setAttribute('value', 'GAME OVER');
      goTitle.setAttribute('color', '#ff4444');
    }
  }
  if (goScore) goScore.setAttribute('value', `Score: ${result.score}`);
  if (goStats) {
    const rank = getRank(authManager.profile?.totalXp || 0);
    goStats.setAttribute('value',
      `Acc: ${summary.accuracy}%  |  Combo: x${targetSystem.bestCombo}  |  +${xpEarned} XP\n` +
      `${rank.icon} ${rank.tier}  |  Targets: ${targetSystem.targetsHit}`
    );
  }
  if (goInfo) {
    const lines = [];
    if (challengeResult.justCompleted) lines.push(`✅ Challenge +${challengeResult.challenge.rewardXp} XP`);
    lines.push('Returning to menu...');
    goInfo.setAttribute('value', lines.join('\n'));
  }

  hudGameover.setAttribute('visible', 'true');

  // Hide HUD elements during game over display
  ['hud-score', 'hud-timer', 'hud-combo', 'hud-lives', 'hud-weapon', 'hud-level', 'hud-powerup', 'hud-boss', 'hud-accuracy', 'hud-pb-pace', 'hud-streak', 'hud-surge', 'hud-debuff', 'hud-reaction', 'hud-color-match'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('visible', 'false');
  });

  setTimeout(() => {
    hudGameover.setAttribute('visible', 'false');
    if (goTitle) { goTitle.setAttribute('value', 'GAME OVER'); goTitle.setAttribute('color', '#ff4444'); }
    if (_onReturnToMenu) _onReturnToMenu();
  }, 6000);
}

// === Ambient Environment Motion (TASK-243) ===

function _startAmbientMotion(sceneEl) {
  const gc = sceneEl.querySelector('#game-content') || sceneEl;

  // Barrier shimmer: each barrier gets offset phase opacity oscillation
  const barriers = gc.querySelectorAll('.arena-barrier');
  barriers.forEach((b, i) => {
    const phase = i * 800;
    b.setAttribute('animation__shimmer', {
      property: 'material.opacity',
      from: 0.01, to: 0.04,
      dur: 2500 + phase,
      loop: true, dir: 'alternate',
      easing: 'easeInOutSine',
    });
  });

  // Point lights breathing: slow intensity oscillation with offset per light
  const lights = gc.querySelectorAll('a-light[type="point"]');
  lights.forEach((l, i) => {
    const baseIntensity = parseFloat(l.getAttribute('intensity') || '0.6');
    const low = Math.max(0.1, baseIntensity - 0.2);
    const high = baseIntensity + 0.15;
    l.setAttribute('animation__breathe', {
      property: 'intensity',
      from: low, to: high,
      dur: 3000 + i * 700,
      loop: true, dir: 'alternate',
      easing: 'easeInOutSine',
    });
  });

  // Ground fog layer (subtle translucent plane at floor level)
  const existingFog = gc.querySelector('#ground-fog');
  if (!existingFog) {
    const fog = document.createElement('a-plane');
    fog.id = 'ground-fog';
    fog.setAttribute('position', '0 0.05 0');
    fog.setAttribute('rotation', '-90 0 0');
    fog.setAttribute('width', '30');
    fog.setAttribute('height', '30');
    fog.setAttribute('material', 'shader: flat; color: #aabbff; opacity: 0.015; transparent: true');
    fog.setAttribute('animation__fogpulse', {
      property: 'material.opacity',
      from: 0.01, to: 0.025,
      dur: 5000, loop: true, dir: 'alternate',
      easing: 'easeInOutSine',
    });
    gc.appendChild(fog);
  }

  // Pillar glow rings: responsive to combo (speed up rotation)
  const pillarToruses = gc.querySelectorAll('.arena-pillar a-torus');
  pillarToruses.forEach((t, i) => {
    t.setAttribute('animation__combospin', {
      property: 'rotation',
      to: `0 360 0`,
      dur: 6000 + i * 500,
      loop: true, easing: 'linear',
    });
  });
}

// === Combo Juice Helpers (TASK-227) ===

function _updateComboVignette(combo) {
  let vignette = document.getElementById('combo-vignette');
  if (!vignette) {
    vignette = document.createElement('div');
    vignette.id = 'combo-vignette';
    vignette.className = 'combo-vignette';
    document.body.appendChild(vignette);
  }
  // Remove all combo classes
  vignette.classList.remove('active', 'combo-low', 'combo-mid', 'combo-high');

  if (combo >= 10) {
    vignette.classList.add('active', 'combo-high');
  } else if (combo >= 5) {
    vignette.classList.add('active', 'combo-mid');
  } else if (combo >= 3) {
    vignette.classList.add('active', 'combo-low');
  }
}

// TASK-314: Live accuracy HUD
function _updateAccuracyHud() {
  if (!_hudAccuracy) return;
  _hudAccuracy.setAttribute('visible', 'true');
  const acc = _shotsFired > 0 ? Math.round((_shotsHit / _shotsFired) * 100) : 100;
  _hudAccuracy.setAttribute('value', `ACC: ${acc}%`);
  const color = acc > 90 ? '#44ff44' : acc > 70 ? '#ffff00' : '#ff4444';
  _hudAccuracy.setAttribute('color', color);
}

function _updateBarrierComboGlow(combo) {
  const barriers = document.querySelectorAll('.arena-barrier');
  if (combo >= 10) {
    barriers.forEach(b => b.setAttribute('material', 'opacity', 0.06));
  } else if (combo >= 5) {
    barriers.forEach(b => b.setAttribute('material', 'opacity', 0.035));
  } else {
    barriers.forEach(b => b.setAttribute('material', 'opacity', 0.015));
  }

  // Pillar ring rotation speed scales with combo
  const pillarToruses = document.querySelectorAll('.arena-pillar a-torus');
  const baseDur = 6000;
  const speedFactor = combo >= 15 ? 0.3 : combo >= 10 ? 0.5 : combo >= 5 ? 0.7 : 1.0;
  pillarToruses.forEach((t, i) => {
    t.setAttribute('animation__combospin', 'dur', Math.round((baseDur + i * 500) * speedFactor));
  });
}

// SPA: game is started via startGame() exported above, called from main.js
