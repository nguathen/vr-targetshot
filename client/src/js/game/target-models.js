/**
 * Target Models (TASK-321)
 * Procedural 3D models for each target type using Three.js BufferGeometry.
 * Models are generated once on first use and cached as Object3D clones.
 * No external GLTF files needed — all geometry is built programmatically.
 */

const _cache = {};
let _initialized = false;

/** Color-tinted clone of a cached model */
function getTargetModel(type, color, scale = 1) {
  _ensureInit();
  const base = _cache[type];
  if (!base) return null;

  const clone = base.clone(true);

  // Apply color to all meshes
  clone.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material = child.material.clone();
      if (color) {
        const c = new THREE.Color(color);
        child.material.color = c;
        if (child.material.emissive) {
          child.material.emissive = c.clone().multiplyScalar(0.4);
        }
      }
    }
  });

  clone.scale.setScalar(scale);
  return clone;
}

function _ensureInit() {
  if (_initialized) return;
  _initialized = true;

  try {
    _cache.standard = _buildStandard();
    _cache.speed = _buildSpeed();
    _cache.heavy = _buildHeavy();
    _cache.bonus = _buildBonus();
    _cache.decoy = _buildDecoy();
    _cache.powerup = _buildPowerup();
    _cache.blink = _buildBlink();
    _cache.peripheral = _buildPeripheral();
    _cache.debuff = _buildDebuff();
    _cache.colorMatch = _buildColorMatch();
  } catch (e) {
    console.warn('[target-models] Failed to build models, falling back to primitives:', e);
    _initialized = false;
  }
}

function _mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    emissive: new THREE.Color(opts.emissive || color),
    emissiveIntensity: opts.emissiveIntensity || 0.4,
    metalness: opts.metalness !== undefined ? opts.metalness : 0.6,
    roughness: opts.roughness !== undefined ? opts.roughness : 0.3,
    transparent: true,
    opacity: opts.opacity !== undefined ? opts.opacity : 1,
  });
}

function _flatMat(color, opts = {}) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: opts.opacity !== undefined ? opts.opacity : 0.8,
  });
}

/** Standard: Beveled cube with inner glow core */
function _buildStandard() {
  const group = new THREE.Group();

  // Outer: rounded box (using chamfered box approximation)
  const outerGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5, 2, 2, 2);
  // Spherize vertices slightly for bevel effect
  const pos = outerGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const len = Math.sqrt(x * x + y * y + z * z);
    const target = 0.3;
    const factor = 0.15;
    pos.setXYZ(i,
      x + (x / len * target - x) * factor,
      y + (y / len * target - y) * factor,
      z + (z / len * target - z) * factor
    );
  }
  outerGeo.computeVertexNormals();
  const outer = new THREE.Mesh(outerGeo, _mat('#e94560'));
  group.add(outer);

  // Inner glow core
  const coreGeo = new THREE.IcosahedronGeometry(0.15, 1);
  const core = new THREE.Mesh(coreGeo, _flatMat('#ffffff', { opacity: 0.5 }));
  group.add(core);

  return group;
}

/** Speed: Arrow/dart shape */
function _buildSpeed() {
  const group = new THREE.Group();

  // Main cone (forward-pointing dart)
  const coneGeo = new THREE.ConeGeometry(0.18, 0.5, 6);
  const cone = new THREE.Mesh(coneGeo, _mat('#ffdd00', { emissiveIntensity: 0.6 }));
  cone.rotation.x = Math.PI / 2; // point forward
  group.add(cone);

  // Tail fins (3 small triangles)
  for (let i = 0; i < 3; i++) {
    const finGeo = new THREE.ConeGeometry(0.08, 0.15, 3);
    const fin = new THREE.Mesh(finGeo, _mat('#ffaa00', { emissiveIntensity: 0.3 }));
    const angle = (i / 3) * Math.PI * 2;
    fin.position.set(Math.cos(angle) * 0.12, Math.sin(angle) * 0.12, 0.2);
    fin.rotation.x = -Math.PI / 2;
    group.add(fin);
  }

  // Trail glow
  const trailGeo = new THREE.CylinderGeometry(0.02, 0.08, 0.3, 6);
  const trail = new THREE.Mesh(trailGeo, _flatMat('#ffdd00', { opacity: 0.4 }));
  trail.rotation.x = Math.PI / 2;
  trail.position.z = 0.35;
  group.add(trail);

  return group;
}

/** Heavy: Armored sphere with hexagonal plates */
function _buildHeavy() {
  const group = new THREE.Group();

  // Core sphere
  const sphereGeo = new THREE.IcosahedronGeometry(0.28, 1);
  const sphere = new THREE.Mesh(sphereGeo, _mat('#ff3333', {
    metalness: 0.9, roughness: 0.1, emissiveIntensity: 0.5,
  }));
  group.add(sphere);

  // Armor plates (6 floating hex panels)
  const plateGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.02, 6);
  const dirs = [
    [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1],
  ];
  dirs.forEach(([dx, dy, dz]) => {
    const plate = new THREE.Mesh(plateGeo, _mat('#661111', {
      metalness: 0.95, roughness: 0.1, emissiveIntensity: 0.2,
    }));
    plate.position.set(dx * 0.32, dy * 0.32, dz * 0.32);
    plate.lookAt(0, 0, 0);
    group.add(plate);
  });

  return group;
}

/** Bonus: Spinning gem/coin shape */
function _buildBonus() {
  const group = new THREE.Group();

  // Double cone (diamond shape)
  const topGeo = new THREE.ConeGeometry(0.2, 0.2, 8);
  const top = new THREE.Mesh(topGeo, _mat('#ffd700', {
    metalness: 0.7, emissiveIntensity: 0.8,
  }));
  top.position.y = 0.05;
  group.add(top);

  const botGeo = new THREE.ConeGeometry(0.2, 0.15, 8);
  const bot = new THREE.Mesh(botGeo, _mat('#ffd700', {
    metalness: 0.7, emissiveIntensity: 0.8,
  }));
  bot.rotation.x = Math.PI;
  bot.position.y = -0.025;
  group.add(bot);

  // Star glow ring
  const ringGeo = new THREE.TorusGeometry(0.22, 0.01, 4, 16);
  const ring = new THREE.Mesh(ringGeo, _flatMat('#ffd700', { opacity: 0.5 }));
  group.add(ring);

  return group;
}

/** Decoy: Cracked sphere with dark aura */
function _buildDecoy() {
  const group = new THREE.Group();

  // Outer sphere (dark, semi-transparent)
  const outerGeo = new THREE.IcosahedronGeometry(0.28, 0);
  const outer = new THREE.Mesh(outerGeo, _mat('#882222', {
    metalness: 0.5, roughness: 0.5, emissiveIntensity: 0.3, opacity: 0.8,
  }));
  group.add(outer);

  // Inner dim core
  const coreGeo = new THREE.SphereGeometry(0.12, 6, 6);
  const core = new THREE.Mesh(coreGeo, _flatMat('#331111', { opacity: 0.9 }));
  group.add(core);

  // Wireframe overlay (cracked look)
  const wireGeo = new THREE.IcosahedronGeometry(0.3, 0);
  const wire = new THREE.Mesh(wireGeo, new THREE.MeshBasicMaterial({
    color: 0x440000, wireframe: true, transparent: true, opacity: 0.6,
  }));
  group.add(wire);

  return group;
}

/** Powerup: Glowing crystal cluster */
function _buildPowerup() {
  const group = new THREE.Group();

  // Central crystal (tall octahedron)
  const mainGeo = new THREE.OctahedronGeometry(0.2, 0);
  const main = new THREE.Mesh(mainGeo, _mat('#00ffaa', {
    metalness: 0.9, roughness: 0.1, emissiveIntensity: 1.0,
  }));
  main.scale.set(1, 1.5, 1);
  group.add(main);

  // Satellite crystals (3 smaller)
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const crystalGeo = new THREE.OctahedronGeometry(0.08, 0);
    const crystal = new THREE.Mesh(crystalGeo, _mat('#00ffaa', {
      emissiveIntensity: 0.8, opacity: 0.9,
    }));
    crystal.position.set(Math.cos(angle) * 0.2, -0.05, Math.sin(angle) * 0.2);
    crystal.scale.y = 1.3;
    crystal.rotation.z = Math.random() * 0.5;
    group.add(crystal);
  }

  // Glow sphere
  const glowGeo = new THREE.SphereGeometry(0.3, 8, 8);
  const glow = new THREE.Mesh(glowGeo, _flatMat('#00ffaa', { opacity: 0.15 }));
  group.add(glow);

  return group;
}

/** Blink: Phasing ghost — wireframe shell + inner solid core */
function _buildBlink() {
  const group = new THREE.Group();

  // Solid inner core
  const coreGeo = new THREE.IcosahedronGeometry(0.16, 1);
  const core = new THREE.Mesh(coreGeo, _mat('#ff00ff', {
    metalness: 0.8, emissiveIntensity: 0.8,
  }));
  core.name = 'blinkCore';
  group.add(core);

  // Wireframe outer shell
  const shellGeo = new THREE.IcosahedronGeometry(0.28, 1);
  const shell = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({
    color: 0xff00ff, wireframe: true, transparent: true, opacity: 0.5,
  }));
  shell.name = 'blinkShell';
  group.add(shell);

  return group;
}

/** Peripheral: Radar dish / satellite */
function _buildPeripheral() {
  const group = new THREE.Group();

  // Dish (half sphere)
  const dishGeo = new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const dish = new THREE.Mesh(dishGeo, _mat('#ff8800', {
    metalness: 0.7, emissiveIntensity: 0.9,
  }));
  group.add(dish);

  // Antenna spike
  const antennaGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.2, 4);
  const antenna = new THREE.Mesh(antennaGeo, _mat('#ffaa44', { emissiveIntensity: 0.6 }));
  antenna.position.y = 0.15;
  group.add(antenna);

  // Signal ring
  const ringGeo = new THREE.TorusGeometry(0.15, 0.008, 4, 16);
  const ring = new THREE.Mesh(ringGeo, _flatMat('#ff8800', { opacity: 0.4 }));
  ring.position.y = -0.05;
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  return group;
}

/** Debuff: Skull-like angular shape */
function _buildDebuff() {
  const group = new THREE.Group();

  // Skull body (squashed icosahedron)
  const skullGeo = new THREE.IcosahedronGeometry(0.18, 0);
  const skull = new THREE.Mesh(skullGeo, _mat('#880044', {
    metalness: 0.5, roughness: 0.4, emissiveIntensity: 0.7,
  }));
  skull.scale.set(1, 1.2, 0.8);
  group.add(skull);

  // Eye sockets (two small dark spheres)
  [-0.06, 0.06].forEach((x) => {
    const eyeGeo = new THREE.SphereGeometry(0.04, 6, 6);
    const eye = new THREE.Mesh(eyeGeo, _flatMat('#000000', { opacity: 0.9 }));
    eye.position.set(x, 0.04, -0.12);
    group.add(eye);
  });

  // Dark aura
  const auraGeo = new THREE.SphereGeometry(0.25, 8, 8);
  const aura = new THREE.Mesh(auraGeo, _flatMat('#440022', { opacity: 0.2 }));
  group.add(aura);

  return group;
}

/** ColorMatch: Same as standard but with colored ring indicator */
function _buildColorMatch() {
  const group = new THREE.Group();

  const bodyGeo = new THREE.IcosahedronGeometry(0.22, 1);
  const body = new THREE.Mesh(bodyGeo, _mat('#ffffff', {
    emissiveIntensity: 0.5,
  }));
  group.add(body);

  // Color indicator ring (will be tinted per-instance)
  const ringGeo = new THREE.TorusGeometry(0.28, 0.015, 4, 24);
  const ring = new THREE.Mesh(ringGeo, _flatMat('#ffffff', { opacity: 0.7 }));
  ring.name = 'colorRing';
  group.add(ring);

  return group;
}

function isReady() {
  return _initialized && Object.keys(_cache).length > 0;
}

/**
 * TASK-382: Pre-warm target models during loading screen.
 * Call this before countdown to move geometry creation from first-spawn to loading phase.
 * Uses requestIdleCallback/setTimeout to avoid blocking.
 */
function preWarm() {
  return new Promise((resolve) => {
    if (_initialized) {
      resolve(true);
      return;
    }

    // Use requestIdleCallback for non-blocking init, fallback to setTimeout
    const schedule = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));

    schedule(() => {
      try {
        _ensureInit();
        resolve(true);
      } catch (e) {
        console.warn('[target-models] preWarm failed:', e);
        resolve(false);
      }
    });
  });
}

export { getTargetModel, isReady, preWarm };
export default { getTargetModel, isReady, preWarm };
