/**
 * Weapon-specific mini-tutorials. Triggered once per weapon on first selection.
 * Shows a VR text panel with weapon tip for 4 seconds.
 */
import authManager from '../core/auth-manager.js';

const WEAPON_TIPS = {
  shotgun: {
    title: 'Shotgun Unlocked!',
    tip: 'Wide spread hits multiple targets.\nAim at groups for maximum damage!',
    color: '#ff8800',
  },
  sniper: {
    title: 'Sniper Unlocked!',
    tip: 'Slow but powerful — 2x damage.\nTake your time and aim carefully!',
    color: '#00ff88',
  },
  smg: {
    title: 'SMG Unlocked!',
    tip: '3-round burst fire.\nTap trigger quickly for rapid shots!',
    color: '#ff6622',
  },
  railgun: {
    title: 'Railgun Unlocked!',
    tip: 'Hold trigger to charge (1.5s).\nRelease for massive 1-3x damage!',
    color: '#4488ff',
  },
};

let _showing = false;

async function showWeaponTutorial(weaponId) {
  const tip = WEAPON_TIPS[weaponId];
  if (!tip) return false;

  // Check if already shown
  const profile = authManager.profile;
  const shown = profile?.weaponTutorials || {};
  if (shown[weaponId]) return false;

  // Mark as shown
  shown[weaponId] = true;
  await authManager.saveProfile({ weaponTutorials: shown });

  // Don't overlap
  if (_showing) return false;
  _showing = true;

  // Create VR panel
  const scene = document.querySelector('a-scene');
  if (!scene) { _showing = false; return false; }

  const panel = document.createElement('a-entity');
  panel.setAttribute('position', '0 2.2 -2');

  // Background
  const bg = document.createElement('a-plane');
  bg.setAttribute('width', '1.6');
  bg.setAttribute('height', '0.6');
  bg.setAttribute('material', `shader: flat; color: #111122; opacity: 0.9; transparent: true`);
  bg.setAttribute('position', '0 0 -0.01');
  panel.appendChild(bg);

  // Border glow
  const border = document.createElement('a-plane');
  border.setAttribute('width', '1.64');
  border.setAttribute('height', '0.64');
  border.setAttribute('material', `shader: flat; color: ${tip.color}; opacity: 0.3; transparent: true`);
  border.setAttribute('position', '0 0 -0.02');
  panel.appendChild(border);

  // Title
  const title = document.createElement('a-text');
  title.setAttribute('value', tip.title);
  title.setAttribute('color', tip.color);
  title.setAttribute('align', 'center');
  title.setAttribute('width', '2.5');
  title.setAttribute('position', '0 0.15 0');
  panel.appendChild(title);

  // Tip text
  const text = document.createElement('a-text');
  text.setAttribute('value', tip.tip);
  text.setAttribute('color', '#cccccc');
  text.setAttribute('align', 'center');
  text.setAttribute('width', '2');
  text.setAttribute('position', '0 -0.08 0');
  panel.appendChild(text);

  // Spawn animation
  panel.setAttribute('scale', '0 0 0');
  panel.setAttribute('animation__in', {
    property: 'scale', to: '1 1 1', dur: 300, easing: 'easeOutBack',
  });

  scene.appendChild(panel);

  // Auto-dismiss after 4s
  setTimeout(() => {
    panel.setAttribute('animation__out', {
      property: 'scale', to: '0 0 0', dur: 200, easing: 'easeInQuad',
    });
    setTimeout(() => {
      if (panel.parentNode) panel.parentNode.removeChild(panel);
      _showing = false;
    }, 250);
  }, 4000);

  return true;
}

function hasSeenTutorial(weaponId) {
  return !!(authManager.profile?.weaponTutorials?.[weaponId]);
}

export { showWeaponTutorial, hasSeenTutorial, WEAPON_TIPS };
export default showWeaponTutorial;
