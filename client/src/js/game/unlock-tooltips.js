/**
 * First-unlock tooltip system. Shows VR popup when player unlocks
 * new weapons or game modes via level-up. Queues multiple unlocks.
 */
import authManager from '../core/auth-manager.js';
import { WEAPONS } from './weapon-system.js';
import { GAME_MODES } from './game-modes.js';

const _queue = [];
let _showing = false;

function checkNewUnlocks(oldLevel, newLevel) {
  if (newLevel <= oldLevel) return;

  const profile = authManager.profile;
  const shown = profile?.shownTooltips || [];

  // Check weapons
  for (const w of Object.values(WEAPONS)) {
    if (w.unlockLevel > oldLevel && w.unlockLevel <= newLevel && !shown.includes(`weapon_${w.id}`)) {
      _queue.push({
        id: `weapon_${w.id}`,
        title: 'New Weapon Unlocked!',
        text: `${w.icon} ${w.name} — ${w.description}`,
        color: w.laserColor || '#00ff88',
      });
    }
  }

  // Check modes
  for (const m of Object.values(GAME_MODES)) {
    if (m.unlockLevel > oldLevel && m.unlockLevel <= newLevel && !shown.includes(`mode_${m.id}`)) {
      _queue.push({
        id: `mode_${m.id}`,
        title: 'New Mode Unlocked!',
        text: `${m.icon} ${m.name} — ${m.description}`,
        color: '#ffd700',
      });
    }
  }

  if (_queue.length > 0) _processQueue();
}

async function _processQueue() {
  if (_showing || _queue.length === 0) return;
  _showing = true;

  const item = _queue.shift();

  // Save shown state
  const profile = authManager.profile;
  const shown = [...(profile?.shownTooltips || []), item.id];
  await authManager.saveProfile({ shownTooltips: shown });

  // Show VR tooltip
  const scene = document.querySelector('a-scene');
  if (!scene) { _showing = false; return; }

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
  glow.setAttribute('material', `shader: flat; color: ${item.color}; opacity: 0.25; transparent: true`);
  glow.setAttribute('position', '0 0 -0.02');
  glow.setAttribute('animation__pulse', {
    property: 'material.opacity', from: 0.15, to: 0.35,
    dur: 600, loop: true, dir: 'alternate', easing: 'easeInOutSine',
  });
  panel.appendChild(glow);

  const title = document.createElement('a-text');
  title.setAttribute('value', item.title);
  title.setAttribute('color', item.color);
  title.setAttribute('align', 'center');
  title.setAttribute('width', '2.5');
  title.setAttribute('position', '0 0.1 0');
  panel.appendChild(title);

  const text = document.createElement('a-text');
  text.setAttribute('value', item.text);
  text.setAttribute('color', '#cccccc');
  text.setAttribute('align', 'center');
  text.setAttribute('width', '2');
  text.setAttribute('position', '0 -0.1 0');
  panel.appendChild(text);

  panel.setAttribute('scale', '0 0 0');
  panel.setAttribute('animation__in', {
    property: 'scale', to: '1 1 1', dur: 300, easing: 'easeOutBack',
  });

  scene.appendChild(panel);

  // Auto-dismiss after 4s, then process next in queue
  setTimeout(() => {
    panel.setAttribute('animation__out', {
      property: 'scale', to: '0 0 0', dur: 200, easing: 'easeInQuad',
    });
    setTimeout(() => {
      if (panel.parentNode) panel.parentNode.removeChild(panel);
      _showing = false;
      // Process next after 1s gap
      if (_queue.length > 0) setTimeout(() => _processQueue(), 1000);
    }, 250);
  }, 4000);
}

export { checkNewUnlocks };
export default checkNewUnlocks;
