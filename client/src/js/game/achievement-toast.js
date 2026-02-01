/**
 * VR toast notifications for achievement unlocks.
 * Queues multiple toasts, shows one at a time (3s each).
 * Follows camera via look-at.
 */

const _queue = [];
let _showing = false;

function showAchievementToasts(achievements) {
  if (!achievements || achievements.length === 0) return;
  for (const ach of achievements) {
    _queue.push(ach);
  }
  _processQueue();
}

function _processQueue() {
  if (_showing || _queue.length === 0) return;
  _showing = true;

  const ach = _queue.shift();
  const scene = document.querySelector('a-scene');
  if (!scene) { _showing = false; return; }

  const cam = document.getElementById('camera');
  if (!cam) { _showing = false; return; }

  // Position in top-right of view
  const panel = document.createElement('a-entity');
  panel.setAttribute('position', '0.35 0.28 -1');

  // Background
  const bg = document.createElement('a-plane');
  bg.setAttribute('width', '0.55');
  bg.setAttribute('height', '0.18');
  bg.setAttribute('material', 'shader: flat; color: #111122; opacity: 0.92; transparent: true');
  bg.setAttribute('position', '0 0 -0.01');
  panel.appendChild(bg);

  // Border glow
  const glow = document.createElement('a-plane');
  glow.setAttribute('width', '0.57');
  glow.setAttribute('height', '0.20');
  glow.setAttribute('material', 'shader: flat; color: #ffd700; opacity: 0.2; transparent: true');
  glow.setAttribute('position', '0 0 -0.02');
  glow.setAttribute('animation__pulse', {
    property: 'material.opacity', from: 0.1, to: 0.3,
    dur: 500, loop: true, dir: 'alternate', easing: 'easeInOutSine',
  });
  panel.appendChild(glow);

  // Icon + Name
  const title = document.createElement('a-text');
  title.setAttribute('value', `${ach.icon} ${ach.name}`);
  title.setAttribute('color', '#ffd700');
  title.setAttribute('align', 'center');
  title.setAttribute('width', '1.5');
  title.setAttribute('position', '0 0.03 0');
  panel.appendChild(title);

  // XP reward
  const reward = document.createElement('a-text');
  reward.setAttribute('value', `+${ach.rewardXp} XP`);
  reward.setAttribute('color', '#00d4ff');
  reward.setAttribute('align', 'center');
  reward.setAttribute('width', '1.2');
  reward.setAttribute('position', '0 -0.04 0');
  panel.appendChild(reward);

  // Scale-in animation
  panel.setAttribute('scale', '0 0 0');
  panel.setAttribute('animation__in', {
    property: 'scale', to: '1 1 1', dur: 250, easing: 'easeOutBack',
  });

  // Attach to camera so it follows view
  cam.appendChild(panel);

  // Auto-dismiss after 3s
  setTimeout(() => {
    panel.setAttribute('animation__out', {
      property: 'scale', to: '0 0 0', dur: 200, easing: 'easeInQuad',
    });
    setTimeout(() => {
      if (panel.parentNode) panel.parentNode.removeChild(panel);
      _showing = false;
      if (_queue.length > 0) setTimeout(() => _processQueue(), 500);
    }, 250);
  }, 3000);
}

export { showAchievementToasts };
export default showAchievementToasts;
