/**
 * Target feedback — combo lost, wave events, damage numbers, screen flash, slow-mo, multiplier zones.
 * Extracted from target-system.js (V27 refactor, TASK-373).
 * Uses composition: receives parent TargetSystem reference via constructor.
 */
import audioManager from '../core/audio-manager.js';

export default class TargetFeedback {
  constructor(ts) {
    /** @type {import('./target-system.js').default} */
    this._ts = ts;
  }

  // TASK-367: Combo lost feedback — visual + audio when losing a high combo
  triggerComboLost(prevCombo, pos) {
    const ts = this._ts;
    const now = performance.now();
    if (ts._lastComboLostTime && now - ts._lastComboLostTime < 3000) return;
    ts._lastComboLostTime = now;
    audioManager.playComboLost(prevCombo);
    // HUD announcement
    document.dispatchEvent(new CustomEvent('hud-announce', {
      detail: { text: `COMBO LOST! ×${prevCombo}`, color: '#ff4444', duration: 1500 }
    }));
    // Camera shake scaled by combo level
    const intensity = Math.min(prevCombo / 20, 1);
    document.dispatchEvent(new CustomEvent('camera-shake', {
      detail: { intensity: 0.02 + intensity * 0.04, duration: 300 }
    }));
    // Red screen flash
    this.flashScreen('miss');
    // GPU particle burst at position (if available)
    if (pos && window.__spawnGPUBurst) {
      const scene = document.querySelector('a-scene');
      if (scene) {
        window.__spawnGPUBurst(scene, pos, {
          count: 20 + prevCombo * 2,
          color: '#ff2222',
          size: 0.04,
          speed: 2,
          lifetime: 600
        });
      }
    }
    // TASK-367: Debuff chance at combo ≥15
    if (prevCombo >= 15 && Math.random() < 0.3) {
      document.dispatchEvent(new CustomEvent('apply-debuff', {
        detail: { type: 'slowReload', duration: 3000 }
      }));
    }
  }

  // TASK-288: Wave events
  triggerWaveEvent() {
    const ts = this._ts;
    const events = ['swarm', 'sniper', 'bonusRain', 'shieldWall'];
    const event = events[Math.floor(Math.random() * events.length)];
    document.dispatchEvent(new CustomEvent('wave-event', { detail: { name: event } }));

    setTimeout(() => {
      if (!ts._running) return;
      switch (event) {
        case 'swarm': {
          for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const dist = 6 + Math.random() * 3;
            const pos = {
              x: Math.sin(angle) * dist,
              y: 1.5 + Math.random() * 2,
              z: -Math.cos(angle) * dist,
            };
            const el = ts._spawner.createEventTarget(pos, 0.15, '#ff69b4', 5, 1500);
            el.setAttribute('animation__move', {
              property: 'position',
              to: `${pos.x + (Math.random() - 0.5) * 3} ${pos.y + (Math.random() - 0.5)} ${pos.z + (Math.random() - 0.5) * 3}`,
              dur: 400 + Math.random() * 300, easing: 'easeInOutSine', loop: true, dir: 'alternate',
            });
          }
          break;
        }
        case 'sniper': {
          const angle = Math.random() * Math.PI * 2;
          const pos = { x: Math.sin(angle) * 14, y: 2 + Math.random() * 3, z: -Math.cos(angle) * 14 };
          ts._spawner.createEventTarget(pos, 0.12, '#00d4ff', 200, 3000);
          break;
        }
        case 'bonusRain': {
          for (let i = 0; i < 8; i++) {
            setTimeout(() => {
              if (!ts._running) return;
              const pos = { x: (Math.random() - 0.5) * 10, y: 8, z: -3 - Math.random() * 8 };
              const el = ts._spawner.createEventTarget(pos, 0.25, '#ffd700', 30, 3000);
              el.setAttribute('animation__fall', {
                property: 'position', to: `${pos.x} 0.3 ${pos.z}`,
                dur: 2800, easing: 'easeInQuad',
              });
            }, i * 150);
          }
          break;
        }
        case 'shieldWall': {
          const wallY = 1.5 + Math.random() * 2;
          const wallZ = -6 - Math.random() * 4;
          for (let i = 0; i < 5; i++) {
            const pos = { x: -3 + i * 1.5, y: wallY, z: wallZ };
            const el = ts._spawner.createEventTarget(pos, 0.35, '#ff3333', 20, 8000);
            el.setAttribute('target-hit', `hp: 2; targetType: heavy`);
          }
          break;
        }
      }
    }, 800); // Delay to let HUD announcement show first
  }

  triggerSlowMotion() {
    const ts = this._ts;
    if (ts._slowMoActive) return;
    ts._slowMoActive = true;

    // Store original animation durations and slow them
    const animData = [];
    ts._targets.forEach(el => {
      ['animation__move', 'animation__float', 'animation__rotate'].forEach(name => {
        const attr = el.getAttribute(name);
        if (attr && attr.dur) {
          const origDur = attr.dur;
          animData.push({ el, name, origDur });
          el.setAttribute(name, 'dur', origDur * 3);
        }
      });
    });

    audioManager.playSlowMoHit();
    window.__hapticManager?.slowMo();
    document.dispatchEvent(new CustomEvent('slow-motion', { detail: { active: true } }));

    // Restore after 300ms
    ts._slowMoTimeout = setTimeout(() => {
      ts._slowMoActive = false;
      animData.forEach(({ el, name, origDur }) => {
        if (el.parentNode) {
          el.setAttribute(name, 'dur', origDur);
        }
      });
      document.dispatchEvent(new CustomEvent('slow-motion', { detail: { active: false } }));
    }, 300);
  }

  spawnDamageNumber(pos, points, color, suffix) {
    const ts = this._ts;
    const scene = ts._container.sceneEl || ts._container.closest('a-scene');
    if (!scene) return;

    const text = points >= 0 ? `+${points}${suffix}` : `${points}`;
    const el = document.createElement('a-entity');
    el.setAttribute('position', `${pos.x} ${pos.y + 0.3} ${pos.z}`);
    el.setAttribute('damage-number', `text: ${text}; color: ${color}`);
    scene.appendChild(el);
  }

  flashScreen(type) {
    let flash = document.getElementById('hit-flash');
    if (!flash) {
      flash = document.createElement('div');
      flash.id = 'hit-flash';
      flash.className = 'hit-flash';
      document.body.appendChild(flash);
    }
    flash.className = 'hit-flash';
    // Force reflow
    void flash.offsetWidth;
    flash.classList.add(type === 'miss' ? 'flash-miss' : 'flash-hit');
    setTimeout(() => flash.classList.remove('flash-hit', 'flash-miss'), 100);
  }

  // TASK-290: Multiplier zone
  spawnMultiplierZone() {
    const ts = this._ts;
    const scene = ts._container.sceneEl || ts._container.closest('a-scene');
    if (!scene) return;
    const x = (Math.random() - 0.5) * 16;
    const y = 1.5 + Math.random() * 3;
    const z = -3 - Math.random() * 8;

    const el = document.createElement('a-entity');
    el.setAttribute('position', `${x} ${y} ${z}`);

    const ring = document.createElement('a-torus');
    ring.setAttribute('radius', '1.5');
    ring.setAttribute('radius-tubular', '0.03');
    ring.setAttribute('material', 'shader: flat; color: #ffd700; opacity: 0.3; transparent: true');
    ring.setAttribute('animation__pulse', { property: 'material.opacity', from: 0.2, to: 0.5, dur: 800, loop: true, dir: 'alternate' });
    ring.setAttribute('animation__spin', { property: 'rotation', to: '0 360 0', dur: 4000, loop: true, easing: 'linear' });
    el.appendChild(ring);

    const label = document.createElement('a-text');
    label.setAttribute('value', '3X');
    label.setAttribute('position', '0 0 0');
    label.setAttribute('align', 'center');
    label.setAttribute('color', '#ffd700');
    label.setAttribute('scale', '2 2 2');
    label.setAttribute('look-at', '[camera]');
    label.setAttribute('font', 'mozillavr');
    el.appendChild(label);

    el.setAttribute('animation__spawn', { property: 'scale', from: '0 0 0', to: '1 1 1', dur: 400, easing: 'easeOutElastic' });
    scene.appendChild(el);

    ts._multiplierZones.add({
      el,
      pos: new THREE.Vector3(x, y, z),
      spawnTime: Date.now(),
    });
    ts._lastZoneSpawnTime = Date.now();
  }

  getZoneMultiplier(hitPos) {
    const ts = this._ts;
    if (!hitPos) return 1;
    const hp = new THREE.Vector3(hitPos.x, hitPos.y, hitPos.z);
    for (const z of ts._multiplierZones) {
      if (hp.distanceTo(z.pos) < 3) {
        // Flash the zone
        const ring = z.el.querySelector('a-torus');
        if (ring) {
          ring.setAttribute('animation__flash', { property: 'material.opacity', from: 1, to: 0.3, dur: 300 });
        }
        return 3;
      }
    }
    return 1;
  }
}
