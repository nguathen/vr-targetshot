/**
 * Target spawner — target type selection, spawn logic, telegraphs, movement patterns, positions.
 * Extracted from target-system.js (V27 refactor, TASK-373).
 * Uses composition: receives parent TargetSystem reference via constructor.
 */
import audioManager from '../core/audio-manager.js';
import powerUpManager from './power-up-manager.js';
import { getSettings, remapColor } from './settings-util.js';
import tensionSystem from './tension-system.js';
import targetModels from './target-models.js';

// 360-degree spawn: distance bands (close/mid/far), full height range, hemisphere bias
const SPAWN = {
  distMin: 4, distMax: 14,
  yMin: 0.5, yMax: 6,
  frontBias: 0.60,
  sideBias: 0.25,
};
const COLORS = ['#e94560', '#ff6b6b', '#ffa502', '#2ed573', '#1e90ff', '#a855f7', '#ff69b4'];

const TARGET_MATERIALS = {
  standard: { metalness: 0.6, roughness: 0.3, emissive: '#222222', emissiveIntensity: 0.4 },
  speed:    { metalness: 0.8, roughness: 0.2, emissive: '#ffdd00', emissiveIntensity: 0.6 },
  heavy:    { metalness: 0.9, roughness: 0.1, emissive: '#ff1111', emissiveIntensity: 0.5 },
  bonus:    { metalness: 0.7, roughness: 0.2, emissive: '#ffd700', emissiveIntensity: 0.8 },
  decoy:    { metalness: 0.5, roughness: 0.5, emissive: '#440000', emissiveIntensity: 0.3 },
  powerup:  { metalness: 0.9, roughness: 0.1, emissive: '#00ffaa', emissiveIntensity: 1.0 },
  blink:    { metalness: 0.8, roughness: 0.2, emissive: '#ff00ff', emissiveIntensity: 0.8 },
  peripheral: { metalness: 0.7, roughness: 0.2, emissive: '#ff8800', emissiveIntensity: 0.9 },
  debuff:     { metalness: 0.5, roughness: 0.4, emissive: '#880044', emissiveIntensity: 0.7 },
  bomb:       { metalness: 0.8, roughness: 0.2, emissive: '#ff2200', emissiveIntensity: 1.0 },
};

export const TARGET_TYPES = {
  standard:  { weight: 50, points: 10, radius: 0.3,  geometry: 'a-icosahedron', color: null, hp: 1, speed: 0, lifetime: null, coins: 0 },
  speed:     { weight: 20, points: 25, radius: 0.22, geometry: 'a-octahedron', color: '#ffdd00', hp: 1, speed: 2.5, lifetime: null, coins: 0 },
  heavy:     { weight: 15, points: 30, radius: 0.4,  geometry: 'a-dodecahedron', color: '#ff3333', hp: 2, speed: 0, lifetime: null, coins: 0 },
  bonus:     { weight: 8,  points: 50, radius: 0.25, geometry: 'a-torus', color: '#ffd700', hp: 1, speed: 0, lifetime: 2000, coins: 5 },
  decoy:     { weight: 7,  points: -10, radius: 0.3, geometry: 'a-sphere', color: '#882222', hp: 1, speed: 0, lifetime: null, coins: 0 },
  powerup:   { weight: 5,  points: 10,  radius: 0.35, geometry: 'a-torus-knot', color: '#00ffaa', hp: 1, speed: 1.5, lifetime: 3000, coins: 0 },
  blink:     { weight: 0,  points: 35,  radius: 0.28, geometry: 'a-icosahedron', color: '#ff00ff', hp: 1, speed: 0, lifetime: null, coins: 0 },
  peripheral:{ weight: 0,  points: 40,  radius: 0.3,  geometry: 'a-icosahedron', color: '#ff8800', hp: 1, speed: 0, lifetime: 2500, coins: 0 },
  debuff:    { weight: 0,  points: 0,   radius: 0.2,  geometry: 'a-sphere', color: '#880044', hp: 1, speed: 0, lifetime: 4000, coins: 0 },
  bomb:      { weight: 0,  points: 40,  radius: 0.35, geometry: 'a-icosahedron', color: '#ff2200', hp: 1, speed: 0, lifetime: 3000, coins: 0 },
};

export default class TargetSpawner {
  constructor(ts) {
    /** @type {import('./target-system.js').default} */
    this._ts = ts;
  }

  // ===================== Target Type Selection =====================

  pickTargetType() {
    const ts = this._ts;
    if (ts._bossMode) return 'heavy';
    if (ts._reflexMode) return 'standard';
    if (ts._challengeMods.forceTargetType) return ts._challengeMods.forceTargetType;

    // TASK-351: Bomb targets
    if (ts._wave >= 3 && !ts._bombActive) {
      ts._bombSpawnCounter++;
      if (ts._bombSpawnCounter >= ts._bombSpawnThreshold) {
        ts._bombSpawnCounter = 0;
        ts._bombSpawnThreshold = 8 + Math.floor(Math.random() * 5);
        return 'bomb';
      }
    }

    let total = 0;
    const entries = Object.entries(TARGET_TYPES).map(([id, t]) => {
      let w = t.weight;
      if (id === 'blink') w = ts._wave >= 5 ? 10 : 0;
      if (id === 'peripheral') w = ts._wave >= 4 ? 8 : 0;
      if (id === 'powerup' && ts._challengeMods.powerupWeightMul) w *= ts._challengeMods.powerupWeightMul;
      if (id === 'bonus' && ts._challengeMods.bonusWeightMul) w *= ts._challengeMods.bonusWeightMul;
      total += w;
      return [id, w];
    });
    let r = Math.random() * total;
    for (const [id, w] of entries) {
      r -= w;
      if (r <= 0) return id;
    }
    return 'standard';
  }

  // ===================== Main Spawn Logic =====================

  spawnTarget() {
    const ts = this._ts;
    let typeId = this.pickTargetType();
    let type = TARGET_TYPES[typeId];

    if (ts._challengeMods.radiusMul || ts._challengeMods.pointsMul) {
      type = { ...type };
      if (ts._challengeMods.radiusMul) type.radius *= ts._challengeMods.radiusMul;
      if (ts._challengeMods.pointsMul) type.points *= ts._challengeMods.pointsMul;
    }

    if (!ts._bossMode && !ts._reflexMode && typeId === 'standard' && Math.random() < 0.15) {
      ts._specials.spawnMeleeTarget();
      return;
    }

    if (!ts._bossMode && !ts._reflexMode && ts._wave >= 3 && typeId === 'standard' && Math.random() < 0.25) {
      ts._specials.spawnColorMatchTarget();
      return;
    }

    if (typeId === 'powerup' && ts._wave >= 4 && !tensionSystem.isSurgeActive && !tensionSystem.activeDebuff && Math.random() < 0.5) {
      typeId = 'debuff';
      type = TARGET_TYPES.debuff;
    }

    let spawnPos;
    if (typeId === 'peripheral') {
      spawnPos = this.pickPeripheralPosition();
    } else {
      spawnPos = this.pick360Position();
    }

    if (ts._rhythmMode && typeId !== 'decoy') {
      spawnPos._rhythmTarget = true;
      spawnPos._beatSpawnTime = Date.now();
    }

    if (typeId === 'bomb') {
      const cam = document.querySelector('[camera]');
      let warningTime = 800;
      if (cam) {
        const cp = cam.object3D.position;
        const dx = spawnPos.x - cp.x, dy = spawnPos.y - cp.y, dz = spawnPos.z - cp.z;
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) < 3) warningTime = 400;
      }
      this.spawnBombWarning(spawnPos);
      audioManager.playBombWarning();
      document.dispatchEvent(new CustomEvent('hud-announce', {
        detail: { text: '⚠ BOMB INCOMING!', color: '#ff4444', duration: 1200 }
      }));
      setTimeout(() => {
        if (!ts._running) return;
        this.spawnTelegraph(spawnPos, typeId);
        setTimeout(() => {
          if (!ts._running) return;
          this.spawnTargetAt(typeId, type, spawnPos);
        }, 500);
      }, warningTime);
      return;
    }

    this.spawnTelegraph(spawnPos, typeId);
    setTimeout(() => {
      if (!ts._running) return;
      this.spawnTargetAt(typeId, type, spawnPos);
    }, 500);
  }

  // ===================== Spawn At Position =====================

  spawnTargetAt(typeId, type, spawnPos) {
    const ts = this._ts;
    const GEO_MAP = { 'a-torus-knot': 'torusKnot' };
    const geoPrimitive = GEO_MAP[type.geometry] || type.geometry.replace('a-', '');
    const el = document.createElement('a-entity');
    el.setAttribute('class', 'target');

    let geoStr = `primitive: ${geoPrimitive}`;
    if (type.geometry === 'a-torus') {
      geoStr += `; radius: ${type.radius}; radiusTubular: 0.06; segmentsRadial: 8; segmentsTubular: 24`;
    } else if (type.geometry === 'a-torus-knot') {
      geoStr += `; radius: ${type.radius * 0.6}; radiusTubular: 0.04`;
    } else {
      geoStr += `; radius: ${type.radius}`;
    }
    el.setAttribute('geometry', geoStr);

    if (type.geometry !== 'a-sphere') {
      el.setAttribute('animation__rotate', {
        property: 'rotation', to: '360 360 0',
        dur: 4000 + Math.random() * 2000, easing: 'linear', loop: true,
      });
    }

    const settings = getSettings();
    const rawColor = type.color || this._randomColor();
    const color = remapColor(rawColor, settings);

    const use3DModels = settings.targetModels !== false && targetModels.isReady();
    if (use3DModels) {
      el.setAttribute('material', 'visible: false; opacity: 0');
      el.setAttribute('shadow', 'cast: false; receive: false');
      const model = targetModels.getTargetModel(typeId, color, type.radius / 0.3);
      if (model) {
        el.addEventListener('loaded', () => {
          el.object3D.add(model);
        }, { once: true });
        el._has3DModel = true;
      } else {
        this._applyPrimitiveMaterial(el, type, typeId, color, settings);
      }
    } else {
      this._applyPrimitiveMaterial(el, type, typeId, color, settings);
    }

    const hp = ts._bossMode ? type.hp + Math.floor(ts._wave / 3) : type.hp;
    el.setAttribute('target-hit', `hp: ${hp}; targetType: ${typeId}`);

    if (ts._bossMode) {
      const scale = Math.min(1.0 + ts._bossWave * 0.05, 2.0);
      el.setAttribute('scale', `${scale} ${scale} ${scale}`);
      let bossColor = '#ff3333';
      let bossEmissive = '#ff1111';
      if (ts._bossWave >= 16)     { bossColor = '#ffd700'; bossEmissive = '#ffaa00'; }
      else if (ts._bossWave >= 11) { bossColor = '#aa00ff'; bossEmissive = '#7700cc'; }
      else if (ts._bossWave >= 6)  { bossColor = '#ff6600'; bossEmissive = '#cc4400'; }
      el.setAttribute('material', `color: ${bossColor}; metalness: 0.9; roughness: 0.1; emissive: ${bossEmissive}; emissiveIntensity: 0.6`);

      const bossRing = document.createElement('a-torus');
      bossRing.setAttribute('radius', String(type.radius * 1.6));
      bossRing.setAttribute('radius-tubular', '0.02');
      bossRing.setAttribute('material', `color: ${bossColor}; emissive: ${bossEmissive}; emissiveIntensity: 0.8; opacity: 0.4`);
      bossRing.setAttribute('animation__spin', { property: 'rotation', to: '0 360 0', dur: 2000, easing: 'linear', loop: true });
      el.appendChild(bossRing);

      const bossRing2 = document.createElement('a-torus');
      bossRing2.setAttribute('radius', String(type.radius * 1.4));
      bossRing2.setAttribute('radius-tubular', '0.015');
      bossRing2.setAttribute('rotation', '90 0 0');
      bossRing2.setAttribute('material', `color: ${bossColor}; emissive: ${bossEmissive}; emissiveIntensity: 0.6; opacity: 0.3`);
      bossRing2.setAttribute('animation__spin', { property: 'rotation', from: '90 0 0', to: '90 0 360', dur: 3000, easing: 'linear', loop: true });
      el.appendChild(bossRing2);

      el.setAttribute('animation__glow', {
        property: 'material.emissiveIntensity', from: 0.3, to: 0.8,
        dur: 800, loop: true, dir: 'alternate', easing: 'easeInOutSine',
      });

      ts._currentBoss = el;
      ts._currentBossHp = hp;
      ts._currentBossMaxHp = hp;
      audioManager.playBossSpawn();
      document.dispatchEvent(new CustomEvent('boss-spawn', {
        detail: { hp, maxHp: hp, wave: ts._bossWave },
      }));
    }

    const x = spawnPos.x;
    const y = spawnPos.y;
    const z = spawnPos.z;
    el.setAttribute('position', `${x} ${y} ${z}`);

    document.dispatchEvent(new CustomEvent('target-spawn-at', {
      detail: { x, y, z, type: typeId },
    }));

    el.setAttribute('animation__spawn', {
      property: 'scale', from: '0 0 0', to: '1 1 1',
      dur: 300, easing: 'easeOutElastic',
    });

    const slowMul = powerUpManager.hasSlowField() ? 2.0 : 1.0;
    if (!settings.reducedMotion) {
      this._applyMovementPattern(el, typeId, type, x, y, z, slowMul);
    }

    if (typeId === 'powerup') {
      el.setAttribute('animation__rotate', {
        property: 'rotation', to: '360 360 0',
        dur: 2000, easing: 'linear', loop: true,
      });
      el.setAttribute('animation__glow', {
        property: 'material.emissiveIntensity', from: 0.5, to: 1.2,
        dur: 600, loop: true, dir: 'alternate', easing: 'easeInOutSine',
      });
    }

    el._targetType = typeId;
    el._targetPoints = type.points;
    el._targetCoins = type.coins;
    el._spawnReadyTime = Date.now();

    if (ts._reflexMode) {
      type = { ...type, lifetime: ts._reflexLifetime };
    }

    if (typeId === 'debuff') {
      const skull = document.createElement('a-text');
      skull.setAttribute('value', '☠');
      skull.setAttribute('align', 'center');
      skull.setAttribute('color', '#ff4444');
      skull.setAttribute('scale', '1.5 1.5 1.5');
      skull.setAttribute('position', '0 0.25 0');
      skull.setAttribute('look-at', '[camera]');
      el.appendChild(skull);
      el.setAttribute('animation__glow', {
        property: 'material.emissiveIntensity', from: 0.4, to: 1.2,
        dur: 400, loop: true, dir: 'alternate', easing: 'easeInOutSine',
      });
    }

    if (typeId === 'bomb') {
      ts._bombActive = true;
      el._bombCountdown = 3;
      el.setAttribute('animation__bombpulse', {
        property: 'scale', from: '1 1 1', to: '1.2 1.2 1.2',
        dur: 300, loop: true, dir: 'alternate', easing: 'easeInOutSine',
      });
      el.setAttribute('animation__glow', {
        property: 'material.emissiveIntensity', from: 0.6, to: 1.5,
        dur: 300, loop: true, dir: 'alternate', easing: 'easeInOutSine',
      });
      const label = document.createElement('a-text');
      label.setAttribute('value', '3');
      label.setAttribute('align', 'center');
      label.setAttribute('color', '#ffffff');
      label.setAttribute('scale', '2 2 2');
      label.setAttribute('position', '0 0.35 0');
      label.setAttribute('look-at', '[camera]');
      el.appendChild(label);
      el._bombLabel = label;
      audioManager.playBombTick(0);
      el._bombTickTimer = setInterval(() => {
        el._bombCountdown--;
        if (el._bombLabel) el._bombLabel.setAttribute('value', String(Math.max(0, el._bombCountdown)));
        if (el._bombCountdown > 0) {
          audioManager.playBombTick(3 - el._bombCountdown);
        }
      }, 1000);
    }

    if (typeId === 'blink') {
      el._blinkVisible = true;
      el._blinkInterval = 400 + Math.random() * 200;
      el._lastBlinkTime = Date.now();
    }

    el.addEventListener('destroyed', (evt) => {
      const damage = evt?.detail?.damage || 1;
      const hitPos = evt?.detail?.position || null;
      ts._onTargetHit(el, damage, hitPos);
    });

    const lifetime = type.lifetime || this.getEffectiveLifetime();
    const expireTimeout = setTimeout(() => {
      if (ts._targets.has(el)) {
        ts._removeTarget(el, true);
      }
    }, lifetime);
    el._expireTimeout = expireTimeout;

    if (!el._skipContainerAppend) {
      ts._container.appendChild(el);
    }
    ts._targets.add(el);
    audioManager.playSpawn({ x, y, z });

    if (spawnPos._rhythmTarget) {
      el._rhythmTarget = true;
      el._beatSpawnTime = spawnPos._beatSpawnTime;
      const beatDuration = 60000 / ts._bpm;
      const timingRing = document.createElement('a-ring');
      timingRing.setAttribute('radius-inner', '0.78');
      timingRing.setAttribute('radius-outer', '0.8');
      timingRing.setAttribute('material', 'shader: flat; color: #44ff44; opacity: 0.6; transparent: true');
      timingRing.setAttribute('animation__shrink', {
        property: 'radius-inner', from: 0.78, to: type.radius,
        dur: beatDuration, easing: 'linear',
      });
      timingRing.setAttribute('animation__shrink2', {
        property: 'radius-outer', from: 0.8, to: type.radius + 0.02,
        dur: beatDuration, easing: 'linear',
      });
      timingRing.setAttribute('animation__color', {
        property: 'material.color', from: '#44ff44', to: '#ff4444',
        dur: beatDuration, easing: 'linear',
      });
      el.appendChild(timingRing);
      el._timingRing = timingRing;
    }

    // TASK-252: Height-zone visual indicators
    const heightZone = spawnPos._heightZone || 'normal';
    el._heightZone = heightZone;
    if (heightZone === 'floor') {
      const ring = document.createElement('a-ring');
      ring.setAttribute('position', `${x} 0.05 ${z}`);
      ring.setAttribute('rotation', '-90 0 0');
      ring.setAttribute('radius-inner', '0.4');
      ring.setAttribute('radius-outer', '0.6');
      ring.setAttribute('material', 'shader: flat; color: #ff6600; emissive: #ff4400; emissiveIntensity: 1; opacity: 0.4; transparent: true');
      ring.setAttribute('animation__pulse', {
        property: 'material.opacity', from: 0.2, to: 0.5,
        dur: 600, loop: true, dir: 'alternate', easing: 'easeInOutSine',
      });
      const scene = ts._container.sceneEl || ts._container.closest('a-scene');
      if (scene) {
        scene.appendChild(ring);
        el._heightIndicator = ring;
      }
      audioManager.playHeightZoneCue('floor', { x, y, z });
    } else if (heightZone === 'overhead') {
      const beam = document.createElement('a-cylinder');
      const beamH = y - 0.05;
      beam.setAttribute('position', `${x} ${y / 2} ${z}`);
      beam.setAttribute('radius', '0.03');
      beam.setAttribute('height', String(beamH));
      beam.setAttribute('material', 'shader: flat; color: #44aaff; emissive: #2288ff; emissiveIntensity: 1; opacity: 0.08; transparent: true');
      beam.setAttribute('animation__pulse', {
        property: 'material.opacity', from: 0.04, to: 0.12,
        dur: 800, loop: true, dir: 'alternate', easing: 'easeInOutSine',
      });
      const scene = ts._container.sceneEl || ts._container.closest('a-scene');
      if (scene) {
        scene.appendChild(beam);
        el._heightIndicator = beam;
      }
      audioManager.playHeightZoneCue('overhead', { x, y, z });
    }

    // Spatial audio hum (max 8 concurrent)
    if (ts._targetHums.size < 8) {
      const hum = audioManager.createTargetHum({ x, y, z }, typeId);
      if (hum) {
        el._spawnTime = Date.now();
        el._lifetime = lifetime;
        ts._targetHums.set(el, hum);
      }
    }
  }

  // ===================== Telegraph & Warning =====================

  spawnTelegraph(pos, typeId) {
    const ts = this._ts;
    const scene = ts._container.sceneEl || ts._container.closest('a-scene');
    if (!scene) return;

    const isBoss = ts._bossMode;
    const color = TARGET_TYPES[typeId]?.color || '#00d4ff';
    const size = isBoss ? 1.5 : 0.8;

    const light = document.createElement('a-entity');
    light.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    light.setAttribute('light', `type: point; color: ${color}; intensity: 0; distance: ${isBoss ? 8 : 4}; decay: 2`);
    light.setAttribute('animation__fadein', {
      property: 'light.intensity', from: 0, to: isBoss ? 1.5 : 0.8,
      dur: 450, easing: 'easeInQuad',
    });
    scene.appendChild(light);

    const particleCount = isBoss ? 5 : 3;
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const dist = size;
      const px = pos.x + Math.cos(angle) * dist;
      const py = pos.y + Math.sin(angle) * dist * 0.5;
      const pz = pos.z + Math.sin(angle) * dist;
      const p = document.createElement('a-sphere');
      p.setAttribute('radius', isBoss ? '0.04' : '0.025');
      p.setAttribute('material', `shader: flat; color: ${color}; opacity: 0.6`);
      p.setAttribute('position', `${px} ${py} ${pz}`);
      p.setAttribute('animation__converge', {
        property: 'position', to: `${pos.x} ${pos.y} ${pos.z}`,
        dur: 450, easing: 'easeInQuad',
      });
      p.setAttribute('animation__fade', {
        property: 'material.opacity', from: 0.6, to: 0,
        dur: 480, easing: 'easeInQuad',
      });
      scene.appendChild(p);
      setTimeout(() => { if (p.parentNode) p.parentNode.removeChild(p); }, 520);
    }

    audioManager.playTelegraph(pos, isBoss);
    setTimeout(() => { if (light.parentNode) light.parentNode.removeChild(light); }, 550);
  }

  spawnBombWarning(pos) {
    const ts = this._ts;
    const scene = ts._container.sceneEl || ts._container.closest('a-scene');
    if (!scene) return;

    const ring = document.createElement('a-ring');
    ring.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    ring.setAttribute('radius-inner', '0.6');
    ring.setAttribute('radius-outer', '0.8');
    ring.setAttribute('material', 'color: #ff0000; emissive: #ff0000; emissiveIntensity: 1; transparent: true; opacity: 0.8; side: double');
    ring.setAttribute('look-at', '[camera]');
    ring.setAttribute('animation__pulse', {
      property: 'scale', from: '0.5 0.5 0.5', to: '1.5 1.5 1.5',
      dur: 400, dir: 'alternate', loop: 2, easing: 'easeInOutSine'
    });
    ring.setAttribute('animation__fade', {
      property: 'material.opacity', from: 0.8, to: 0,
      dur: 800, easing: 'easeInQuad'
    });
    scene.appendChild(ring);
    setTimeout(() => { if (ring.parentNode) ring.parentNode.removeChild(ring); }, 850);

    const light = document.createElement('a-entity');
    light.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    light.setAttribute('light', 'type: point; color: #ff0000; intensity: 2; distance: 6; decay: 2');
    light.setAttribute('animation__dim', {
      property: 'light.intensity', from: 2, to: 0,
      dur: 800, easing: 'easeInQuad'
    });
    scene.appendChild(light);
    setTimeout(() => { if (light.parentNode) light.parentNode.removeChild(light); }, 850);

    if (window.__spawnGPUBurst) {
      window.__spawnGPUBurst(scene, pos, {
        count: 30, color: '#ff2200', size: 0.03, speed: 1.5, lifetime: 800
      });
    }
  }

  // ===================== Material & Movement =====================

  _applyPrimitiveMaterial(el, type, typeId, color, settings) {
    const matProps = TARGET_MATERIALS[typeId] || TARGET_MATERIALS.standard;
    const emissive = remapColor(matProps.emissive, settings);
    el.setAttribute('material', `color: ${color}; metalness: ${matProps.metalness}; roughness: ${matProps.roughness}; emissive: ${emissive}; emissiveIntensity: ${matProps.emissiveIntensity}`);
    el.setAttribute('shadow', 'cast: true; receive: false');

    if (typeId !== 'decoy') {
      const wire = document.createElement(type.geometry === 'a-torus' ? 'a-torus' : type.geometry === 'a-torus-knot' ? 'a-torus-knot' : 'a-sphere');
      if (type.geometry === 'a-torus') {
        wire.setAttribute('radius', String(type.radius * 1.05));
        wire.setAttribute('radius-tubular', '0.065');
        wire.setAttribute('segments-radial', '8');
        wire.setAttribute('segments-tubular', '24');
      } else if (type.geometry === 'a-torus-knot') {
        wire.setAttribute('radius', String(type.radius * 0.65));
        wire.setAttribute('radius-tubular', '0.05');
      } else {
        wire.setAttribute('radius', String(type.radius * 1.05));
      }
      wire.setAttribute('material', `color: ${color}; wireframe: true; opacity: 0.15; transparent: true`);
      el.appendChild(wire);
    } else {
      const wire = document.createElement('a-sphere');
      wire.setAttribute('radius', String(type.radius * 1.08));
      wire.setAttribute('material', `color: #ff0000; wireframe: true; opacity: 0.2; transparent: true`);
      el.appendChild(wire);
    }
  }

  _pickMovementPattern(typeId) {
    const ts = this._ts;
    const w = ts._wave;
    const patterns = [{ name: 'float', weight: 30 }];
    if (w >= 3) patterns.push({ name: 'zigzag', weight: 25 });
    if (w >= 5) patterns.push({ name: 'orbit', weight: 20 });
    if (w >= 8) patterns.push({ name: 'dive', weight: 15 });
    if (w >= 10 && typeId !== 'heavy') patterns.push({ name: 'teleport', weight: 10 });
    if (typeId === 'speed' && patterns.length > 1) {
      const idx = patterns.findIndex(p => p.name === 'float');
      if (idx >= 0) { patterns[idx].weight = 0; }
    }
    const total = patterns.reduce((s, p) => s + p.weight, 0);
    let r = Math.random() * total;
    for (const p of patterns) { r -= p.weight; if (r <= 0) return p.name; }
    return 'float';
  }

  _applyMovementPattern(el, typeId, type, x, y, z, slowMul) {
    const ts = this._ts;
    const pattern = this._pickMovementPattern(typeId);
    el._movementPattern = pattern;

    switch (pattern) {
      case 'zigzag': {
        const rx = (type.speed || 1.5) + Math.random();
        const ry = 0.5 + Math.random() * 0.5;
        el.setAttribute('animation__moveX', {
          property: 'object3D.position.x', from: x - rx, to: x + rx,
          dur: (700 + Math.random() * 300) * slowMul,
          easing: 'easeInOutSine', loop: true, dir: 'alternate',
        });
        el.setAttribute('animation__moveY', {
          property: 'object3D.position.y', from: y - ry, to: y + ry,
          dur: (500 + Math.random() * 300) * slowMul,
          easing: 'easeInOutSine', loop: true, dir: 'alternate',
        });
        break;
      }
      case 'orbit': {
        const wrapper = document.createElement('a-entity');
        wrapper.setAttribute('position', `${x} ${y} ${z}`);
        const orbitR = 1.5 + Math.random();
        el.setAttribute('position', `${orbitR} 0 0`);
        wrapper.setAttribute('animation__orbit', {
          property: 'rotation', from: '0 0 0', to: '0 360 0',
          dur: (2500 + Math.random() * 1500) * slowMul,
          easing: 'linear', loop: true,
        });
        el.setAttribute('animation__float', {
          property: 'object3D.position.y', from: -0.2, to: 0.2,
          dur: (1000 + Math.random() * 500) * slowMul,
          easing: 'easeInOutSine', loop: true, dir: 'alternate',
        });
        wrapper.appendChild(el);
        el._orbitWrapper = wrapper;
        ts._container.appendChild(wrapper);
        el._skipContainerAppend = true;
        break;
      }
      case 'dive': {
        const cam = document.getElementById('camera');
        let cx = 0, cy = 1.6, cz = 0;
        if (cam) {
          const cp = new THREE.Vector3();
          cam.object3D.getWorldPosition(cp);
          cx = cp.x; cy = cp.y; cz = cp.z;
        }
        const mx = (x + cx) / 2, my = (y + cy) / 2, mz = (z + cz) / 2;
        const diveDur = 1200 * slowMul;
        el.setAttribute('animation__dive', {
          property: 'position', from: `${x} ${y} ${z}`, to: `${mx} ${my} ${mz}`,
          dur: diveDur, easing: 'easeInQuad',
        });
        el.setAttribute('animation__retreat', {
          property: 'position', from: `${mx} ${my} ${mz}`, to: `${x} ${y} ${z}`,
          dur: diveDur * 0.8, easing: 'easeOutQuad', delay: diveDur,
        });
        el.setAttribute('animation__dive2', {
          property: 'position', from: `${x} ${y} ${z}`, to: `${mx} ${my} ${mz}`,
          dur: diveDur, easing: 'easeInQuad', delay: diveDur + diveDur * 0.8,
        });
        break;
      }
      case 'teleport': {
        const origX = x, origY = y, origZ = z;
        const tpInterval = setInterval(() => {
          if (!el.parentNode) { clearInterval(tpInterval); return; }
          el.setAttribute('material', 'opacity', 0);
          setTimeout(() => {
            if (!el.parentNode) return;
            const nx = origX + (Math.random() - 0.5) * 4;
            const ny = Math.max(0.5, origY + (Math.random() - 0.5) * 2);
            const nz = origZ + (Math.random() - 0.5) * 4;
            el.setAttribute('position', `${nx} ${ny} ${nz}`);
            el.setAttribute('material', 'opacity', 1);
          }, 200 * slowMul);
        }, 1500 * slowMul);
        el._teleportInterval = tpInterval;
        break;
      }
      default: {
        el.setAttribute('animation__float', {
          property: 'position',
          to: `${x} ${y + 0.3} ${z}`,
          dur: (1200 + Math.random() * 600) * slowMul,
          easing: 'easeInOutSine', loop: true, dir: 'alternate',
        });
      }
    }
  }

  // ===================== Event Target =====================

  createEventTarget(pos, radius, color, points, lifetime) {
    const ts = this._ts;
    const el = document.createElement('a-entity');
    el.setAttribute('class', 'target');
    el.setAttribute('geometry', `primitive: sphere; radius: ${radius}`);
    el.setAttribute('material', `color: ${color}; metalness: 0.7; roughness: 0.2; emissive: ${color}; emissiveIntensity: 0.6`);
    el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    el.setAttribute('shadow', 'cast: true; receive: false');
    el.setAttribute('target-hit', `hp: 1; targetType: standard`);
    el.setAttribute('animation__spawn', { property: 'scale', from: '0 0 0', to: '1 1 1', dur: 200, easing: 'easeOutElastic' });

    el._targetType = 'standard';
    el._targetPoints = points;
    el._targetCoins = 0;

    el.addEventListener('destroyed', (evt) => {
      const damage = evt?.detail?.damage || 1;
      const hitPos = evt?.detail?.position || null;
      ts._onTargetHit(el, damage, hitPos);
    });

    const expireTimeout = setTimeout(() => {
      if (ts._targets.has(el)) ts._removeTarget(el, true);
    }, lifetime);
    el._expireTimeout = expireTimeout;

    ts._container.appendChild(el);
    ts._targets.add(el);
    return el;
  }

  // ===================== Position Picking =====================

  getEffectiveLifetime() {
    const ts = this._ts;
    const waveScale = Math.min(ts._wave / 50, 1);
    return Math.round(ts._targetLifetime * (1 - waveScale * 0.4));
  }

  pick360Position() {
    const ts = this._ts;
    const arenaScale = tensionSystem.arenaScale;
    const effectiveDistMax = SPAWN.distMax * arenaScale;
    const effectiveDistMin = Math.min(SPAWN.distMin, effectiveDistMax - 1);

    let angle;
    const r = Math.random();
    if (r < SPAWN.frontBias) {
      angle = (Math.random() - 0.5) * (140 * Math.PI / 180);
    } else if (r < SPAWN.frontBias + SPAWN.sideBias) {
      const side = Math.random() < 0.5 ? 1 : -1;
      angle = side * (70 + Math.random() * 40) * Math.PI / 180;
    } else {
      const side = Math.random() < 0.5 ? 1 : -1;
      angle = side * (110 + Math.random() * 70) * Math.PI / 180;
    }

    const dist = effectiveDistMin + Math.random() * (effectiveDistMax - effectiveDistMin);

    let y;
    let heightZone = 'normal';
    const hr = Math.random();
    if (hr < 0.20) {
      y = this._rand(0.3, 0.6);
      heightZone = 'floor';
    } else if (hr < 0.35) {
      y = this._rand(3.5, 5.0);
      heightZone = 'overhead';
    } else {
      y = this._rand(SPAWN.yMin, SPAWN.yMax);
    }

    const x = Math.sin(angle) * dist;
    const z = -Math.cos(angle) * dist;

    const clampMax = 13 * arenaScale;
    return {
      x: THREE.MathUtils.clamp(x, -clampMax, clampMax),
      y,
      z: THREE.MathUtils.clamp(z, -clampMax, clampMax),
      _heightZone: heightZone,
    };
  }

  pickPeripheralPosition() {
    const cam = document.getElementById('camera');
    if (!cam || !cam.object3D) return this.pick360Position();

    const camRot = cam.object3D.rotation;
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(camRot);

    const side = Math.random() < 0.5 ? 1 : -1;
    const angle = (90 + Math.random() * 60) * side * (Math.PI / 180);

    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const dir = {
      x: forward.x * cosA + forward.z * sinA,
      z: -forward.x * sinA + forward.z * cosA,
    };

    const dist = 6 + Math.random() * 6;
    const y = 1 + Math.random() * 3;
    const rig = document.getElementById('player-rig');
    const rigPos = rig?.object3D?.position || { x: 0, y: 0, z: 0 };

    return {
      x: rigPos.x + dir.x * dist,
      y,
      z: rigPos.z + dir.z * dist,
    };
  }

  // ===================== Utilities =====================

  _randomColor() {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  _rand(min, max) {
    return Math.random() * (max - min) + min;
  }
}
