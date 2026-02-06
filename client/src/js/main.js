import authManager from './core/auth-manager.js';
import { GAME_MODES } from './game/game-modes.js';
import { WEAPONS } from './game/weapon-system.js';
import { startGame as startGameSession } from './game-main.js';
import { getThemes } from './game/environment-themes.js';
import iapManager from './iap/iap-manager.js';
import { showToast } from './ui/toast.js';
import { showWeaponTutorial } from './game/weapon-tutorial.js';
import { getDailyChallenge, getCurrentProgress } from './game/daily-challenge.js';
import { getRank } from './game/rank-system.js';
import leaderboardManager from './core/leaderboard-manager.js';

let selectedMode = 'timeAttack';
let selectedWeapon = 'pistol';
let selectedTheme = 'cyber';

function refreshRaycasters() {
  ['left-hand', 'right-hand'].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.components && el.components.raycaster) {
      el.components.raycaster.refreshObjects();
    }
  });
}

// Disable raycasting on child meshes (text, glow) so only the button plane itself is hit
function disableChildRaycast(el) {
  const apply = () => {
    if (!el.object3D) return;
    const ownMesh = el.getObject3D('mesh');
    if (!ownMesh) return; // mesh not ready yet, retry via timeout
    el.object3D.traverse(child => {
      if (child !== ownMesh && child.isMesh) {
        child.raycast = () => {};
      }
    });
  };
  apply();
  setTimeout(apply, 100);
  setTimeout(apply, 500);
  el.querySelectorAll('a-text, a-plane').forEach(child => {
    child.addEventListener('loaded', () => {
      const m = child.getObject3D('mesh');
      if (m && m.isMesh) m.raycast = () => {};
    });
  });
}

function createButton(parent, { x, y, width, height, label, value, selected, locked }) {
  const plane = document.createElement('a-plane');
  plane.classList.add('clickable');
  plane.setAttribute('position', `${x} ${y} 0`);
  plane.setAttribute('width', width);
  plane.setAttribute('height', height);
  plane.setAttribute('color', locked ? '#1a1a2e' : selected ? '#00d4ff' : '#1a1a4e');
  plane.setAttribute('material', 'shader: flat; opacity: 0.85');
  plane.dataset.value = value;

  // Selected glow: child plane behind
  if (selected) {
    const glow = document.createElement('a-plane');
    glow.setAttribute('position', '0 0 -0.01');
    glow.setAttribute('width', width + 0.06);
    glow.setAttribute('height', height + 0.06);
    glow.setAttribute('color', '#00d4ff');
    glow.setAttribute('material', 'shader: flat; opacity: 0.15');
    plane.appendChild(glow);
  }

  // Hover effects
  plane.addEventListener('mouseenter', () => {
    plane.setAttribute('material', 'opacity', 1.0);
    if (!locked) {
      plane.setAttribute('animation__hover', {
        property: 'scale', to: '1.08 1.08 1.08', dur: 120, easing: 'easeOutQuad',
      });
    }
  });
  plane.addEventListener('mouseleave', () => {
    plane.setAttribute('material', 'opacity', 0.85);
    plane.setAttribute('animation__hover', {
      property: 'scale', to: '1 1 1', dur: 120, easing: 'easeOutQuad',
    });
  });

  const displayLabel = locked ? `🔒 ${label}` : label;
  const text = document.createElement('a-text');
  text.setAttribute('value', displayLabel);
  text.setAttribute('align', 'center');
  text.setAttribute('color', locked ? '#555566' : selected ? '#ffffff' : '#aaaacc');
  text.setAttribute('width', width * 3.5);
  text.setAttribute('position', '0 0 0.01');
  plane.appendChild(text);

  parent.appendChild(plane);
  disableChildRaycast(plane);
  return plane;
}

function buildModeButtons(profile) {
  const container = document.getElementById('mode-buttons');
  container.innerHTML = '';
  const modes = Object.values(GAME_MODES);
  const startX = -(modes.length - 1) * 0.85 / 2;

  modes.forEach((mode, i) => {
    const unlocked = profile.level >= mode.unlockLevel;
    const label = unlocked ? `${mode.icon} ${mode.name}` : `Lv.${mode.unlockLevel}`;
    const btn = createButton(container, {
      x: startX + i * 0.85, y: 0,
      width: 0.75, height: 0.3,
      label, value: mode.id,
      selected: mode.id === selectedMode,
      locked: !unlocked,
    });
    if (unlocked) {
      btn.addEventListener('menuclick', () => {
        selectedMode = mode.id;
        buildModeButtons(profile);
        refreshRaycasters();
      });
    }
  });
}

function buildWeaponButtons(profile) {
  const container = document.getElementById('weapon-buttons');
  container.innerHTML = '';
  const weapons = Object.values(WEAPONS);
  const startX = -(weapons.length - 1) * 0.85 / 2;

  weapons.forEach((weapon, i) => {
    const unlocked = profile.level >= weapon.unlockLevel;
    const label = unlocked ? `${weapon.icon} ${weapon.name}` : `Lv.${weapon.unlockLevel}`;
    const btn = createButton(container, {
      x: startX + i * 0.85, y: 0,
      width: 0.75, height: 0.3,
      label, value: weapon.id,
      selected: weapon.id === selectedWeapon,
      locked: !unlocked,
    });
    if (unlocked) {
      btn.addEventListener('menuclick', () => {
        selectedWeapon = weapon.id;
        buildWeaponButtons(profile);
        refreshRaycasters();
        // Show weapon tutorial on first selection (pistol excluded — it's the starter)
        if (weapon.id !== 'pistol') showWeaponTutorial(weapon.id);
      });
    }
  });
}

function buildThemeButtons(profile) {
  const container = document.getElementById('theme-buttons');
  if (!container) return; // guard against missing HTML element
  container.innerHTML = '';
  const themes = Object.values(getThemes());
  const spacing = 0.85;
  const btnW = 0.75;
  const btnH = 0.3;
  const sx = -(themes.length - 1) * spacing / 2;

  themes.forEach((theme, i) => {
    const unlocked = profile.level >= (theme.unlockLevel || 1);
    const label = unlocked ? theme.name : `${theme.name} (Lv.${theme.unlockLevel})`;
    const btn = createButton(container, {
      x: sx + i * spacing, y: 0,
      width: btnW, height: btnH,
      label, value: theme.id,
      selected: theme.id === selectedTheme,
      locked: !unlocked,
    });
    if (unlocked) {
      btn.addEventListener('menuclick', () => {
        selectedTheme = theme.id;
        buildThemeButtons(profile);
        refreshRaycasters();
      });
    }
  });
}

// TASK-293: Daily Challenge Banner on VR Menu
function _buildDailyChallengeBanner() {
  const menuContent = document.getElementById('menu-content');
  if (!menuContent) return;

  // Remove old banner if exists
  const old = menuContent.querySelector('#daily-challenge-banner');
  if (old) old.parentNode.removeChild(old);

  const challenge = getDailyChallenge();
  const progress = getCurrentProgress();
  if (!challenge) return;

  const banner = document.createElement('a-entity');
  banner.id = 'daily-challenge-banner';
  banner.setAttribute('position', '0 -0.25 -3.4');

  // Background
  const bg = document.createElement('a-plane');
  bg.setAttribute('width', '2.8');
  bg.setAttribute('height', '0.35');
  bg.setAttribute('material', 'shader: flat; color: #111128; opacity: 0.85; transparent: true');
  bg.setAttribute('position', '0 0 -0.01');
  banner.appendChild(bg);

  // Left accent line
  const accent = document.createElement('a-plane');
  accent.setAttribute('width', '2.8');
  accent.setAttribute('height', '0.005');
  accent.setAttribute('material', 'shader: flat; color: #00ff88; opacity: 0.4');
  accent.setAttribute('position', '0 0.17 0');
  banner.appendChild(accent);

  if (progress.completed) {
    const text = document.createElement('a-text');
    text.setAttribute('value', `✅ Daily Challenge Complete! +${challenge.rewardXp} XP`);
    text.setAttribute('color', '#00ff88');
    text.setAttribute('align', 'center');
    text.setAttribute('width', '2.5');
    text.setAttribute('position', '0 0 0');
    banner.appendChild(text);
  } else {
    // Challenge description
    const desc = document.createElement('a-text');
    desc.setAttribute('value', `📋 ${challenge.description}`);
    desc.setAttribute('color', '#cccccc');
    desc.setAttribute('align', 'center');
    desc.setAttribute('width', '2.2');
    desc.setAttribute('position', '0 0.05 0');
    banner.appendChild(desc);

    // Progress bar background
    const barBg = document.createElement('a-plane');
    barBg.setAttribute('width', '1.8');
    barBg.setAttribute('height', '0.03');
    barBg.setAttribute('material', 'shader: flat; color: #222244; opacity: 0.8');
    barBg.setAttribute('position', '0 -0.07 0');
    banner.appendChild(barBg);

    // Progress bar fill
    const pct = Math.min(1, (progress.progress || 0) / challenge.target);
    const fillW = Math.max(0.01, 1.8 * pct);
    const barFill = document.createElement('a-plane');
    barFill.setAttribute('width', String(fillW));
    barFill.setAttribute('height', '0.025');
    barFill.setAttribute('material', 'shader: flat; color: #00ff88; opacity: 0.8');
    barFill.setAttribute('position', `${(fillW - 1.8) / 2} -0.07 0.001`);
    banner.appendChild(barFill);

    // Progress text
    const progText = document.createElement('a-text');
    progText.setAttribute('value', `${progress.progress || 0}/${challenge.target}  |  +${challenge.rewardXp} XP  +${challenge.rewardCoins} 🪙`);
    progText.setAttribute('color', '#888899');
    progText.setAttribute('align', 'center');
    progText.setAttribute('width', '2');
    progText.setAttribute('position', '0 -0.13 0');
    banner.appendChild(progText);
  }

  menuContent.appendChild(banner);
}

// Switch from menu to game scene (SPA — no page navigation)
function switchToGame() {
  // Hide menu + shop + leaderboard, show game
  shopVisible = false;
  const menuContent = document.getElementById('menu-content');
  const gameContent = document.getElementById('game-content');
  const shopContent = document.getElementById('shop-content');
  const lbContent = document.getElementById('leaderboard-content');
  menuContent.setAttribute('visible', 'false');
  if (shopContent) shopContent.setAttribute('visible', 'false');
  if (lbContent) lbContent.setAttribute('visible', 'false');
  gameContent.setAttribute('visible', 'true');

  // Show HUD
  ['crosshair', 'crosshair-outer', 'crosshair-dot', 'hud-score', 'hud-timer', 'hud-combo', 'hud-lives', 'hud-weapon', 'hud-level', 'hud-powerup', 'hud-reaction', 'hud-color-match', 'hud-accuracy', 'hud-pb-pace', 'hud-streak', 'game-cursor'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('visible', 'true');
  });

  // Switch controller raycasters from .clickable to .target
  ['left-hand', 'right-hand'].forEach(id => {
    const hand = document.getElementById(id);
    if (hand) {
      hand.setAttribute('raycaster', 'objects', '.target');
      hand.setAttribute('shoot-controls', `hand: ${id === 'left-hand' ? 'left' : 'right'}`);
      // Remove cursor component (menu mode) - not needed in game
      if (hand.components.cursor) {
        hand.removeAttribute('cursor');
      }
    }
  });

  // Enable WASD movement for game
  const camera = document.getElementById('camera');
  if (camera) {
    camera.setAttribute('wasd-controls', 'acceleration: 20');
  }

  // Enable smooth locomotion on player rig
  const rig = document.getElementById('player-rig');
  if (rig) {
    rig.setAttribute('smooth-locomotion', 'speed: 3; camera: #camera');
  }

  // Start game logic with selected mode/weapon/theme
  startGameSession({
    mode: selectedMode,
    weapon: selectedWeapon,
    theme: selectedTheme,
    onReturnToMenu: switchToMenu,
  });
}

// Switch from game back to menu
function switchToMenu() {
  const menuContent = document.getElementById('menu-content');
  const gameContent = document.getElementById('game-content');
  const shopContent = document.getElementById('shop-content');
  const lbContent = document.getElementById('leaderboard-content');
  gameContent.setAttribute('visible', 'false');
  if (shopContent) shopContent.setAttribute('visible', 'false');
  if (lbContent) lbContent.setAttribute('visible', 'false');
  menuContent.setAttribute('visible', 'true');

  // Hide HUD
  ['crosshair', 'crosshair-outer', 'crosshair-dot', 'hud-score', 'hud-timer', 'hud-combo', 'hud-lives', 'hud-weapon', 'hud-level', 'hud-powerup', 'hud-reaction', 'hud-color-match', 'hud-accuracy', 'hud-pb-pace', 'hud-streak', 'hud-surge', 'hud-debuff', 'game-cursor'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('visible', 'false');
  });

  // Switch controller raycasters back to .clickable
  ['left-hand', 'right-hand'].forEach(id => {
    const hand = document.getElementById(id);
    if (hand) {
      hand.setAttribute('raycaster', 'objects', '.clickable');
      hand.removeAttribute('shoot-controls');
      hand.setAttribute('cursor', 'fuse: false; rayOrigin: entity');
    }
  });

  // Disable WASD
  const camera = document.getElementById('camera');
  if (camera) {
    camera.setAttribute('wasd-controls-enabled', 'false');
  }

  // Refresh menu buttons
  const profile = authManager.profile;
  if (profile) {
    buildModeButtons(profile);
    buildWeaponButtons(profile);
    buildThemeButtons(profile);
    _buildDailyChallengeBanner();
    const rank = getRank(profile.totalXp || 0);
    const info = document.getElementById('player-info');
    if (info) info.setAttribute('value', `${rank.icon} ${rank.tier}  |  Lv.${profile.level}  |  ${profile.coins} Coins`);
  }
  refreshRaycasters();

  // Hide VR game over HUD
  const hudGameover = document.getElementById('hud-gameover');
  if (hudGameover) hudGameover.setAttribute('visible', 'false');
}

// Expose for game-main.js
window.__switchToMenu = switchToMenu;

function initMenu(profile) {
  selectedWeapon = profile.selectedWeapon || 'pistol';

  // TASK-294: Show rank badge + level + coins
  const rank = getRank(profile.totalXp || 0);
  const info = document.getElementById('player-info');
  if (info) info.setAttribute('value', `${rank.icon} ${rank.tier}  |  Lv.${profile.level}  |  ${profile.coins} Coins`);

  buildModeButtons(profile);
  buildWeaponButtons(profile);
  buildThemeButtons(profile);
  _buildDailyChallengeBanner();
  refreshRaycasters();

  const playBtn = document.getElementById('btn-play-vr');
  if (playBtn) {
    disableChildRaycast(playBtn);
    playBtn.addEventListener('mouseenter', () => {
      playBtn.setAttribute('material', 'opacity', 1.0);
    });
    playBtn.addEventListener('mouseleave', () => {
      playBtn.setAttribute('material', 'opacity', 0.9);
    });
    playBtn.addEventListener('menuclick', () => {
      switchToGame();
    });
  }

  // Leaderboard button
  const lbBtn = document.getElementById('btn-leaderboard-vr');
  if (lbBtn) {
    disableChildRaycast(lbBtn);
    lbBtn.addEventListener('mouseenter', () => {
      lbBtn.setAttribute('material', 'opacity', 1.0);
    });
    lbBtn.addEventListener('mouseleave', () => {
      lbBtn.setAttribute('material', 'opacity', 0.9);
    });
    lbBtn.addEventListener('menuclick', () => {
      switchToLeaderboard();
    });
  }

  // Shop button
  const shopBtn = document.getElementById('btn-shop-vr');
  if (shopBtn) {
    disableChildRaycast(shopBtn);
    shopBtn.addEventListener('mouseenter', () => {
      shopBtn.setAttribute('material', 'opacity', 1.0);
    });
    shopBtn.addEventListener('mouseleave', () => {
      shopBtn.setAttribute('material', 'opacity', 0.9);
    });
    shopBtn.addEventListener('menuclick', () => switchToShop());
  }

  // Exit button
  const exitBtn = document.getElementById('btn-exit-vr');
  console.log('[Menu] Exit button found:', !!exitBtn);
  if (exitBtn) {
    exitBtn.addEventListener('mouseenter', () => {
      console.log('[Menu] Exit hover');
      exitBtn.setAttribute('material', 'opacity', 1.0);
    });
    exitBtn.addEventListener('mouseleave', () => {
      exitBtn.setAttribute('material', 'opacity', 0.9);
    });
    exitBtn.addEventListener('menuclick', () => {
      console.log('[Menu] Exit clicked!');
      const scene = document.getElementById('scene');
      if (scene && scene.is('vr-mode')) {
        scene.exitVR();
      }
      try { window.close(); } catch(e) {}
      setTimeout(() => { window.history.back(); }, 300);
    });
    refreshRaycasters();
  }

  // Shop back button
  const shopBackBtn = document.getElementById('btn-shop-back');
  if (shopBackBtn) {
    shopBackBtn.addEventListener('mouseenter', () => {
      shopBackBtn.setAttribute('material', 'opacity', 1.0);
    });
    shopBackBtn.addEventListener('mouseleave', () => {
      shopBackBtn.setAttribute('material', 'opacity', 0.9);
    });
    shopBackBtn.addEventListener('menuclick', () => switchFromShop());
  }

  // Leaderboard back button
  const lbBackBtn = document.getElementById('btn-lb-back');
  if (lbBackBtn) {
    lbBackBtn.addEventListener('mouseenter', () => {
      lbBackBtn.setAttribute('material', 'opacity', 1.0);
    });
    lbBackBtn.addEventListener('mouseleave', () => {
      lbBackBtn.setAttribute('material', 'opacity', 0.9);
    });
    lbBackBtn.addEventListener('menuclick', () => switchFromLeaderboard());
  }

  // Init IAP manager
  iapManager.init().catch(() => {});
}

// Direct Three.js raycasting — bypasses A-Frame cursor system entirely
function setupMouseClick(scene) {
  const canvas = scene.canvas;
  if (!canvas) return;

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const camera = scene.camera;
    raycaster.setFromCamera(mouse, camera);

    const clickables = [];
    const hiddenContainers = ['menu-content', 'shop-content', 'game-content']
      .map(id => document.getElementById(id))
      .filter(el => el && !el.object3D.visible);

    scene.querySelectorAll('.clickable').forEach(el => {
      if (!el.object3D || !el.object3D.visible) return;
      // Skip elements inside a hidden content container
      if (hiddenContainers.some(c => c.contains(el))) return;
      el.object3D.traverse(child => {
        if (child.isMesh) {
          child.__aframeEl = el;
          clickables.push(child);
        }
      });
    });

    const hits = raycaster.intersectObjects(clickables, false);
    if (hits.length > 0) {
      const el = hits[0].object.__aframeEl;
      if (el) el.emit('menuclick', {}, false);
    }
  });
}

// VR controller click
function setupControllerClick(scene) {
  ['left-hand', 'right-hand'].forEach(id => {
    const hand = document.getElementById(id);
    if (!hand) return;

    const doClick = () => {
      const rc = hand.components.raycaster;
      if (!rc) return;
      const els = rc.intersectedEls;
      if (els && els.length > 0) {
        els[0].emit('menuclick', {}, true);
      }
    };

    hand.addEventListener('triggerdown', doClick);
    hand.addEventListener('selectstart', doClick);
    hand.addEventListener('gripdown', doClick);
  });
}

// ==================== SHOP ====================

function switchToShop() {
  document.getElementById('menu-content').setAttribute('visible', 'false');
  document.getElementById('shop-content').setAttribute('visible', 'true');
  shopVisible = true;
  buildShopCards();
  setTimeout(() => refreshRaycasters(), 100);
}

function switchFromShop() {
  shopVisible = false;
  document.getElementById('shop-content').setAttribute('visible', 'false');
  document.getElementById('menu-content').setAttribute('visible', 'true');
  // Update coins on menu
  const profile = authManager.profile;
  if (profile) {
    const info = document.getElementById('player-info');
    if (info) info.setAttribute('value', `Lv.${profile.level} | ${profile.coins} Coins`);
  }
  setTimeout(() => refreshRaycasters(), 100);
}

function buildShopCards() {
  const container = document.getElementById('shop-cards');
  container.innerHTML = '';

  const products = iapManager.products;
  const startX = -(products.length - 1) * 1.1 / 2;

  // Update balance
  const balanceEl = document.getElementById('shop-balance');
  const profile = authManager.profile;
  if (balanceEl && profile) {
    const premiumBadge = profile.isPremium ? ' | Premium' : '';
    balanceEl.setAttribute('value', `${profile.coins || 0} Coins${premiumBadge}`);
  }

  products.forEach((product, i) => {
    const x = startX + i * 1.15;
    const owned = product.type === 'non_consumable' && iapManager.isOwned(product.id);

    // Card glow (behind card)
    const cardGlow = document.createElement('a-plane');
    cardGlow.setAttribute('position', `${x} 0 -0.02`);
    cardGlow.setAttribute('width', '1.06');
    cardGlow.setAttribute('height', '1.36');
    cardGlow.setAttribute('color', owned ? '#44ff44' : '#00d4ff');
    cardGlow.setAttribute('material', 'shader: flat; opacity: 0.06');
    container.appendChild(cardGlow);

    // Card background
    const card = document.createElement('a-plane');
    card.setAttribute('position', `${x} 0 0`);
    card.setAttribute('width', '1.0');
    card.setAttribute('height', '1.3');
    card.setAttribute('color', owned ? '#1a3a1a' : '#1a1a3a');
    card.setAttribute('material', 'shader: flat; opacity: 0.9');

    // Hover effect on card
    card.addEventListener('mouseenter', () => {
      card.setAttribute('material', 'opacity', 1.0);
      cardGlow.setAttribute('material', 'opacity', 0.12);
    });
    card.addEventListener('mouseleave', () => {
      card.setAttribute('material', 'opacity', 0.9);
      cardGlow.setAttribute('material', 'opacity', 0.06);
    });

    // Product icon
    const icon = document.createElement('a-text');
    const emoji = product.type === 'consumable' ? '🪙' : '⭐';
    icon.setAttribute('value', emoji);
    icon.setAttribute('position', '0 0.42 0.01');
    icon.setAttribute('align', 'center');
    icon.setAttribute('width', '3.5');
    card.appendChild(icon);

    // Product name
    const name = document.createElement('a-text');
    name.setAttribute('value', product.name);
    name.setAttribute('position', '0 0.15 0.01');
    name.setAttribute('align', 'center');
    name.setAttribute('color', '#ffffff');
    name.setAttribute('width', '2.8');
    card.appendChild(name);

    // Description
    const desc = document.createElement('a-text');
    desc.setAttribute('value', product.description);
    desc.setAttribute('position', '0 -0.02 0.01');
    desc.setAttribute('align', 'center');
    desc.setAttribute('color', '#888899');
    desc.setAttribute('width', '2');
    card.appendChild(desc);

    // Separator line
    const sep = document.createElement('a-plane');
    sep.setAttribute('position', '0 -0.18 0.01');
    sep.setAttribute('width', '0.7');
    sep.setAttribute('height', '0.002');
    sep.setAttribute('color', '#444466');
    sep.setAttribute('material', 'shader: flat; opacity: 0.5');
    card.appendChild(sep);

    // Price
    const price = document.createElement('a-text');
    price.setAttribute('value', iapManager.getDisplayPrice(product));
    price.setAttribute('position', '0 -0.3 0.01');
    price.setAttribute('align', 'center');
    price.setAttribute('color', '#ffd700');
    price.setAttribute('width', '2.8');
    card.appendChild(price);

    // Buy button
    const btn = document.createElement('a-plane');
    btn.classList.add('clickable');
    btn.setAttribute('position', `0 -0.5 0.02`);
    btn.setAttribute('width', '0.75');
    btn.setAttribute('height', '0.22');

    const btnText = document.createElement('a-text');
    btnText.setAttribute('position', '0 0 0.01');
    btnText.setAttribute('align', 'center');
    btnText.setAttribute('width', '3');

    if (owned) {
      btn.setAttribute('color', '#444444');
      btn.setAttribute('material', 'shader: flat; opacity: 0.7');
      btnText.setAttribute('value', '✓ OWNED');
      btnText.setAttribute('color', '#88ff88');
    } else {
      btn.setAttribute('color', '#006644');
      btn.setAttribute('material', 'shader: flat; opacity: 0.9');
      btnText.setAttribute('value', 'BUY');
      btnText.setAttribute('color', '#00ff88');

      btn.addEventListener('mouseenter', () => {
        btn.setAttribute('material', 'opacity', 1.0);
      });
      btn.addEventListener('mouseleave', () => {
        btn.setAttribute('material', 'opacity', 0.9);
      });
      btn.addEventListener('menuclick', () => handlePurchase(product));
    }

    btn.appendChild(btnText);
    card.appendChild(btn);
    container.appendChild(card);
  });

  refreshRaycasters();
}

let shopVisible = false;

async function handlePurchase(product) {
  if (!shopVisible) return;
  try {
    const result = await iapManager.purchase(product.id);
    if (result.success) {
      const msg = product.type === 'consumable'
        ? `Purchased! +${product.coinAmount} Coins`
        : `${product.name} unlocked!`;
      showToast(msg, 'success');
      buildShopCards();
    }
  } catch (err) {
    showToast('Purchase failed', 'error');
    console.warn('[Shop] Purchase error:', err.message);
  }
}

// ==================== LEADERBOARD ====================

let lbCurrentMode = 'timeAttack';

function switchToLeaderboard() {
  document.getElementById('menu-content').setAttribute('visible', 'false');
  document.getElementById('leaderboard-content').setAttribute('visible', 'true');
  buildLeaderboardModeTabs();
  loadLeaderboardRows();
  setTimeout(() => refreshRaycasters(), 100);
}

function switchFromLeaderboard() {
  document.getElementById('leaderboard-content').setAttribute('visible', 'false');
  document.getElementById('menu-content').setAttribute('visible', 'true');
  setTimeout(() => refreshRaycasters(), 100);
}

function buildLeaderboardModeTabs() {
  const container = document.getElementById('lb-mode-tabs');
  container.innerHTML = '';

  const modes = Object.values(GAME_MODES).filter(m => m.id !== 'zen');
  const startX = -(modes.length - 1) * 0.55 / 2;

  modes.forEach((mode, i) => {
    const x = startX + i * 0.55;
    const isActive = mode.id === lbCurrentMode;

    const tab = document.createElement('a-plane');
    tab.classList.add('clickable');
    tab.setAttribute('width', '0.5');
    tab.setAttribute('height', '0.18');
    tab.setAttribute('position', `${x} 0 0`);
    tab.setAttribute('material', `shader: flat; color: ${isActive ? '#00d4ff' : '#222244'}; opacity: 0.9`);

    const label = document.createElement('a-text');
    label.setAttribute('value', `${mode.icon} ${mode.name}`);
    label.setAttribute('align', 'center');
    label.setAttribute('color', isActive ? '#000' : '#aaa');
    label.setAttribute('width', '1.8');
    label.setAttribute('position', '0 0 0.01');
    tab.appendChild(label);

    tab.addEventListener('menuclick', () => {
      lbCurrentMode = mode.id;
      buildLeaderboardModeTabs();
      loadLeaderboardRows();
      setTimeout(() => refreshRaycasters(), 100);
    });

    container.appendChild(tab);
  });
}

async function loadLeaderboardRows() {
  const container = document.getElementById('lb-rows');
  const loading = document.getElementById('lb-loading');
  const rankInfoEl = document.getElementById('lb-rank-info-vr');
  container.innerHTML = '';
  if (loading) loading.setAttribute('visible', 'true');

  const entries = await leaderboardManager.getTopScores(lbCurrentMode, 10);
  entries.sort((a, b) => (b.score || 0) - (a.score || 0));

  if (loading) loading.setAttribute('visible', 'false');

  if (entries.length === 0) {
    const noData = document.createElement('a-text');
    noData.setAttribute('value', 'No scores yet');
    noData.setAttribute('align', 'center');
    noData.setAttribute('color', '#555');
    noData.setAttribute('width', '2');
    noData.setAttribute('position', '0 -0.3 0');
    container.appendChild(noData);
    if (rankInfoEl) rankInfoEl.setAttribute('value', '');
    return;
  }

  const myUid = authManager.uid;
  const myIdx = entries.findIndex(e => (e.id || e.uid) === myUid);
  if (rankInfoEl) {
    rankInfoEl.setAttribute('value', myIdx >= 0 ? `You are #${myIdx + 1} of ${entries.length}` : '');
  }

  const maxRows = Math.min(entries.length, 10);
  for (let i = 0; i < maxRows; i++) {
    const entry = entries[i];
    const y = -i * 0.16;
    const isMe = (entry.id || entry.uid) === myUid;

    // Row background
    const rowBg = document.createElement('a-plane');
    rowBg.setAttribute('width', '3.8');
    rowBg.setAttribute('height', '0.14');
    rowBg.setAttribute('position', `0 ${y} -0.01`);
    rowBg.setAttribute('material', `shader: flat; color: ${isMe ? '#1a3a5a' : '#111133'}; opacity: 0.8`);
    container.appendChild(rowBg);

    // Rank number
    const rankText = document.createElement('a-text');
    rankText.setAttribute('value', `#${i + 1}`);
    rankText.setAttribute('align', 'left');
    rankText.setAttribute('color', i < 3 ? '#ffd700' : '#888');
    rankText.setAttribute('width', '2');
    rankText.setAttribute('position', `-1.7 ${y} 0`);
    container.appendChild(rankText);

    // Name
    const nameText = document.createElement('a-text');
    nameText.setAttribute('value', entry.displayName || 'Player');
    nameText.setAttribute('align', 'left');
    nameText.setAttribute('color', isMe ? '#00d4ff' : '#ccc');
    nameText.setAttribute('width', '2');
    nameText.setAttribute('position', `-1.2 ${y} 0`);
    container.appendChild(nameText);

    // Score
    const scoreText = document.createElement('a-text');
    scoreText.setAttribute('value', `${entry.score || 0}`);
    scoreText.setAttribute('align', 'right');
    scoreText.setAttribute('color', '#ffd700');
    scoreText.setAttribute('width', '2');
    scoreText.setAttribute('position', `1.7 ${y} 0`);
    container.appendChild(scoreText);
  }
}

authManager.waitReady().then(() => {
  const profile = authManager.profile;
  const scene = document.getElementById('scene');

  const init = () => {
    initMenu(profile);
    setupMouseClick(scene);
    setupControllerClick(scene);

    // V35: Apply Quest optimizations (90Hz, pixelRatio 1.0, disable AA)
    if (typeof VRCore !== 'undefined' && VRCore.applyQuestOptimizations) {
      VRCore.applyQuestOptimizations(scene);
    }

    // Auto-enter VR on Quest (required for scene to be visible)
    if (navigator.xr && scene.enterVR) {
      navigator.xr.isSessionSupported('immersive-vr').then(ok => {
        if (ok && !scene.is('vr-mode')) scene.enterVR();
      }).catch(() => {});
    }

    // Dismiss VR loading screen now that menu is ready (VRC.Quest.Performance.3)
    scene.emit('vr-loading-screen:dismiss');
  };
  if (scene.hasLoaded) init();
  else scene.addEventListener('loaded', init);
});
