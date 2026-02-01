import authManager from './core/auth-manager.js';

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
  colorblindMode: 'none',
};

function init() {
  const profile = authManager.profile;
  const settings = { ...DEFAULT_SETTINGS, ...(profile.settings || {}) };

  // Populate controls
  const volumeSlider = document.getElementById('setting-volume');
  const volumeVal = document.getElementById('volume-val');
  const sfxCheckbox = document.getElementById('setting-sfx');
  const vibrationSlider = document.getElementById('setting-vibration');
  const vibrationVal = document.getElementById('vibration-val');
  const crosshairSize = document.getElementById('setting-crosshair-size');
  const crosshairColors = document.getElementById('crosshair-colors');
  const highContrast = document.getElementById('setting-high-contrast');
  const reducedMotion = document.getElementById('setting-reduced-motion');
  const autoSubmit = document.getElementById('setting-auto-submit');
  const showCombo = document.getElementById('setting-show-combo');
  const colorblindSelect = document.getElementById('setting-colorblind');
  const difficultySelect = document.getElementById('setting-difficulty');
  const minimalHud = document.getElementById('setting-minimal-hud');
  const musicCheckbox = document.getElementById('setting-music');

  volumeSlider.value = settings.volume;
  volumeVal.textContent = settings.volume;
  sfxCheckbox.checked = settings.sfx;
  if (musicCheckbox) musicCheckbox.checked = settings.music !== false;
  vibrationSlider.value = settings.vibration;
  vibrationVal.textContent = settings.vibration;
  crosshairSize.value = settings.crosshairSize;
  highContrast.checked = settings.highContrast;
  reducedMotion.checked = settings.reducedMotion;
  autoSubmit.checked = settings.autoSubmitScore;
  showCombo.checked = settings.showCombo;
  if (colorblindSelect) colorblindSelect.value = settings.colorblindMode || 'none';
  if (difficultySelect) difficultySelect.value = settings.difficulty || 'normal';
  if (minimalHud) minimalHud.checked = settings.minimalHud || false;

  // Color swatches
  crosshairColors.querySelectorAll('.color-swatch').forEach(sw => {
    if (sw.dataset.color === settings.crosshairColor) {
      sw.classList.add('selected');
    } else {
      sw.classList.remove('selected');
    }
    sw.addEventListener('click', () => {
      crosshairColors.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
    });
  });

  // Slider live update
  volumeSlider.addEventListener('input', () => { volumeVal.textContent = volumeSlider.value; });
  vibrationSlider.addEventListener('input', () => { vibrationVal.textContent = vibrationSlider.value; });

  // Save
  document.getElementById('btn-save').addEventListener('click', async () => {
    const selectedColor = crosshairColors.querySelector('.color-swatch.selected')?.dataset.color || '#00ff88';
    const newSettings = {
      volume: parseInt(volumeSlider.value, 10),
      sfx: sfxCheckbox.checked,
      vibration: parseInt(vibrationSlider.value, 10),
      crosshairSize: crosshairSize.value,
      crosshairColor: selectedColor,
      highContrast: highContrast.checked,
      reducedMotion: reducedMotion.checked,
      autoSubmitScore: autoSubmit.checked,
      showCombo: showCombo.checked,
      music: musicCheckbox ? musicCheckbox.checked : true,
      colorblindMode: colorblindSelect ? colorblindSelect.value : 'none',
      difficulty: difficultySelect ? difficultySelect.value : 'normal',
      minimalHud: minimalHud ? minimalHud.checked : false,
    };
    await authManager.saveProfile({ settings: newSettings });
    window.location.href = './index.html';
  });

  // Replay tutorial
  document.getElementById('btn-replay-tutorial')?.addEventListener('click', async () => {
    await authManager.saveProfile({ tutorialCompleted: false });
    window.location.href = './tutorial.html';
  });

  // Back
  document.getElementById('btn-back').addEventListener('click', () => {
    window.location.href = './index.html';
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
