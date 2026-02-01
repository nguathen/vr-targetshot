const THEMES = {
  cyber: {
    id: 'cyber',
    name: 'Cyber Arena',
    icon: '💎',
    unlockLevel: 1,
    sky: '#0c0c24',
    floor: '#111133',
    grid: '#1a1a4e',
    gridOpacity: 0.12,
    lights: [
      { type: 'ambient', color: '#2a2a50', intensity: 0.55 },
      { type: 'point', position: '0 10 0', color: '#4466ff', intensity: 1.2, distance: 50 },
      { type: 'point', position: '-8 6 -8', color: '#ff4444', intensity: 0.6, distance: 30 },
      { type: 'point', position: '8 6 -8', color: '#44ff44', intensity: 0.6, distance: 30 },
      { type: 'point', position: '0 4 8', color: '#ff88ff', intensity: 0.4, distance: 25 },
    ],
    shadowLight: { color: '#4466ff', intensity: 0.6, position: '5 12 5' },
    pillarColor: '#1a1a4e',
    barrierColor: '#0044aa',
    floorRingColor1: '#00d4ff',
    floorRingColor2: '#ff44aa',
    pillarGlowColor: '#00d4ff',
    baseGlowColor: '#0088ff',
    cornerGlowColor: '#0088ff',
    // Sky gradient: bottom → top (brighter for open feel)
    skyGradient: { bottom: '#121240', mid: '#0e0e2e', top: '#080828' },
    // Floor fade color
    floorFadeColor: '#0a0a1a',
    // Platform
    platformSlabColor: '#0a0a22',
    edgeGlowColor: '#0088ff',
    underGlowColor: '#0088ff',
    underGlowRing1: '#0088ff',
    underGlowRing2: '#00d4ff',
    // Below void
    belowEnv: [
      // Data grid far below
      { tag: 'a-plane', position: '0 -50 0', rotation: '-90 0 0', width: '200', height: '200', material: 'color: #0a0a2e; wireframe: true; opacity: 0.06; shader: flat', 'segments-width': '40', 'segments-height': '40' },
      // Vertical data streams
      { tag: 'a-plane', position: '-5 -15 -8', width: '0.03', height: '20', material: 'shader: flat; color: #4466ff; emissive: #4466ff; emissiveIntensity: 1; opacity: 0.08', animation: 'property: position; from: -5 -15 -8; to: -5 -25 -8; dur: 4000; loop: true; easing: linear' },
      { tag: 'a-plane', position: '8 -12 -5', width: '0.03', height: '15', material: 'shader: flat; color: #00d4ff; emissive: #00d4ff; emissiveIntensity: 1; opacity: 0.06', animation: 'property: position; from: 8 -12 -5; to: 8 -22 -5; dur: 5000; loop: true; easing: linear' },
      { tag: 'a-plane', position: '-10 -18 3', width: '0.03', height: '18', material: 'shader: flat; color: #4466ff; emissive: #4466ff; emissiveIntensity: 1; opacity: 0.07', animation: 'property: position; from: -10 -18 3; to: -10 -28 3; dur: 3500; loop: true; easing: linear' },
      { tag: 'a-plane', position: '3 -10 6', width: '0.02', height: '12', material: 'shader: flat; color: #00d4ff; emissive: #00d4ff; emissiveIntensity: 1; opacity: 0.05', animation: 'property: position; from: 3 -10 6; to: 3 -20 6; dur: 4500; loop: true; easing: linear' },
    ],
    // Distant environment
    distantEnv: [
      // Cyber buildings (front) — more visible for depth
      { tag: 'a-box', position: '-20 5 -40', width: '4', height: '10', depth: '4', material: 'color: #10103a; metalness: 0.9; roughness: 0.2; emissive: #1a2a55; emissiveIntensity: 0.5' },
      { tag: 'a-box', position: '-12 8 -45', width: '3', height: '16', depth: '3', material: 'color: #10103a; metalness: 0.9; roughness: 0.2; emissive: #1a2a55; emissiveIntensity: 0.5' },
      { tag: 'a-box', position: '0 6 -42', width: '5', height: '12', depth: '5', material: 'color: #10103a; metalness: 0.9; roughness: 0.2; emissive: #152244; emissiveIntensity: 0.5' },
      { tag: 'a-box', position: '14 9 -48', width: '3.5', height: '18', depth: '3.5', material: 'color: #10103a; metalness: 0.9; roughness: 0.2; emissive: #1a2a55; emissiveIntensity: 0.5' },
      { tag: 'a-box', position: '22 4 -38', width: '3', height: '8', depth: '3', material: 'color: #10103a; metalness: 0.9; roughness: 0.2; emissive: #152244; emissiveIntensity: 0.4' },
      // Window strips on buildings
      { tag: 'a-plane', position: '-20 6 -37.9', width: '3', height: '0.08', material: 'shader: flat; color: #4466ff; emissive: #4466ff; emissiveIntensity: 1; opacity: 0.6', animation: 'property: material.opacity; from: 0.4; to: 0.7; dur: 2000; loop: true; dir: alternate' },
      { tag: 'a-plane', position: '-12 10 -43.4', width: '2', height: '0.08', material: 'shader: flat; color: #00d4ff; emissive: #00d4ff; emissiveIntensity: 1; opacity: 0.6', animation: 'property: material.opacity; from: 0.4; to: 0.8; dur: 2500; loop: true; dir: alternate' },
      { tag: 'a-plane', position: '14 12 -46.2', width: '2.5', height: '0.08', material: 'shader: flat; color: #4466ff; emissive: #4466ff; emissiveIntensity: 1; opacity: 0.7', animation: 'property: material.opacity; from: 0.5; to: 0.8; dur: 1800; loop: true; dir: alternate' },
      // Left side buildings
      { tag: 'a-box', position: '-38 7 -10', width: '4', height: '14', depth: '4', material: 'color: #10103a; metalness: 0.9; roughness: 0.2; emissive: #1a2a55; emissiveIntensity: 0.4' },
      { tag: 'a-box', position: '-42 5 -5', width: '3', height: '10', depth: '3', material: 'color: #10103a; metalness: 0.9; roughness: 0.2; emissive: #152244; emissiveIntensity: 0.35' },
      // Right side buildings
      { tag: 'a-box', position: '38 6 -8', width: '3.5', height: '12', depth: '3.5', material: 'color: #10103a; metalness: 0.9; roughness: 0.2; emissive: #1a2a55; emissiveIntensity: 0.4' },
      { tag: 'a-box', position: '44 4  0', width: '3', height: '8', depth: '3', material: 'color: #10103a; metalness: 0.9; roughness: 0.2; emissive: #152244; emissiveIntensity: 0.35' },
      // Behind player buildings (new — so player sees depth when turning around)
      { tag: 'a-box', position: '-16 6 35', width: '3.5', height: '12', depth: '3.5', material: 'color: #10103a; metalness: 0.9; roughness: 0.2; emissive: #1a2a55; emissiveIntensity: 0.4' },
      { tag: 'a-box', position: '10 4 40', width: '3', height: '8', depth: '3', material: 'color: #10103a; metalness: 0.9; roughness: 0.2; emissive: #152244; emissiveIntensity: 0.35' },
      { tag: 'a-plane', position: '-16 7 33', width: '2.5', height: '0.08', material: 'shader: flat; color: #4466ff; emissive: #4466ff; emissiveIntensity: 1; opacity: 0.5', animation: 'property: material.opacity; from: 0.3; to: 0.6; dur: 2200; loop: true; dir: alternate' },
      // Horizon glow ring — gives sense of infinite open space
      { tag: 'a-torus', position: '0 -1 0', rotation: '-90 0 0', radius: '80', 'radius-tubular': '0.15', material: 'shader: flat; color: #1a2a55; emissive: #1a2a55; emissiveIntensity: 1; opacity: 0.12', animation: 'property: material.opacity; from: 0.08; to: 0.15; dur: 4000; loop: true; dir: alternate; easing: easeInOutSine' },
      // Grid horizon line (all 4 directions for openness)
      { tag: 'a-plane', position: '0 0.02 -35', rotation: '-90 0 0', width: '80', height: '0.06', material: 'shader: flat; color: #4466ff; emissive: #4466ff; emissiveIntensity: 1; opacity: 0.2' },
      { tag: 'a-plane', position: '0 0.02 35', rotation: '-90 0 0', width: '80', height: '0.06', material: 'shader: flat; color: #4466ff; emissive: #4466ff; emissiveIntensity: 1; opacity: 0.15' },
    ],
    decorations: [],
    ambientParticles: { count: 25, color: '#4488ff', color2: '#ff44aa', area: 22, height: 8 },
  },
  space: {
    id: 'space',
    name: 'Deep Space',
    icon: '🌌',
    unlockLevel: 6,
    sky: '#050515',
    floor: '#060610',
    grid: '#0a0a22',
    gridOpacity: 0.08,
    lights: [
      { type: 'ambient', color: '#141428', intensity: 0.35 },
      { type: 'point', position: '0 10 0', color: '#2244ff', intensity: 0.9, distance: 50 },
      { type: 'point', position: '-8 6 -8', color: '#4488ff', intensity: 0.5, distance: 30 },
      { type: 'point', position: '8 6 -8', color: '#2266cc', intensity: 0.5, distance: 30 },
      { type: 'point', position: '0 4 8', color: '#6644ff', intensity: 0.35, distance: 25 },
    ],
    shadowLight: { color: '#2244ff', intensity: 0.4, position: '5 12 5' },
    pillarColor: '#080820',
    barrierColor: '#0a1133',
    floorRingColor1: '#2244ff',
    floorRingColor2: '#6644ff',
    pillarGlowColor: '#4488ff',
    baseGlowColor: '#2244ff',
    cornerGlowColor: '#2244ff',
    skyGradient: { bottom: '#0a0a25', mid: '#050518', top: '#030310' },
    floorFadeColor: '#010105',
    platformSlabColor: '#040412',
    edgeGlowColor: '#2244ff',
    underGlowColor: '#2244ff',
    underGlowRing1: '#2244ff',
    underGlowRing2: '#6644ff',
    belowEnv: [
      // Star clusters below
      { tag: 'a-sphere', position: '-8 -15 -5', radius: '0.04', material: 'shader: flat; color: #ffffff; opacity: 0.4', animation: 'property: material.opacity; from: 0.2; to: 0.5; dur: 2000; loop: true; dir: alternate' },
      { tag: 'a-sphere', position: '12 -20 3', radius: '0.05', material: 'shader: flat; color: #aaccff; opacity: 0.35', animation: 'property: material.opacity; from: 0.15; to: 0.45; dur: 2400; loop: true; dir: alternate' },
      { tag: 'a-sphere', position: '-3 -25 8', radius: '0.06', material: 'shader: flat; color: #ffffff; opacity: 0.3', animation: 'property: material.opacity; from: 0.1; to: 0.4; dur: 1800; loop: true; dir: alternate' },
      { tag: 'a-sphere', position: '6 -12 -10', radius: '0.03', material: 'shader: flat; color: #ffddaa; opacity: 0.35', animation: 'property: material.opacity; from: 0.15; to: 0.45; dur: 2200; loop: true; dir: alternate' },
      { tag: 'a-sphere', position: '-15 -18 0', radius: '0.05', material: 'shader: flat; color: #ffffff; opacity: 0.25', animation: 'property: material.opacity; from: 0.1; to: 0.35; dur: 2600; loop: true; dir: alternate' },
      { tag: 'a-sphere', position: '10 -30 -8', radius: '0.07', material: 'shader: flat; color: #8888ff; opacity: 0.2', animation: 'property: material.opacity; from: 0.1; to: 0.3; dur: 3000; loop: true; dir: alternate' },
      // Distant nebula below
      { tag: 'a-sphere', position: '0 -35 0', radius: '8', material: 'shader: flat; color: #221144; opacity: 0.04' },
      { tag: 'a-sphere', position: '-12 -40 -10', radius: '6', material: 'shader: flat; color: #441122; opacity: 0.03' },
    ],
    distantEnv: [
      // Large planet
      { tag: 'a-sphere', position: '25 18 -50', radius: '8', material: 'color: #334488; metalness: 0.3; roughness: 0.7; emissive: #112244; emissiveIntensity: 0.3' },
      { tag: 'a-torus', position: '25 18 -50', rotation: '20 0 10', radius: '10', 'radius-tubular': '0.2', material: 'color: #556699; emissive: #334466; emissiveIntensity: 0.3; opacity: 0.25', animation: 'property: rotation; from: 20 0 10; to: 20 360 10; dur: 60000; easing: linear; loop: true' },
      { tag: 'a-sphere', position: '25 18 -50', radius: '9', material: 'shader: flat; color: #2244aa; opacity: 0.04' },
      // Moon
      { tag: 'a-sphere', position: '-20 12 -40', radius: '2.5', material: 'color: #aaaacc; metalness: 0.2; roughness: 0.8; emissive: #333344; emissiveIntensity: 0.2' },
      // Asteroids
      { tag: 'a-icosahedron', position: '-10 8 -30', radius: '0.5', material: 'color: #444455; metalness: 0.6; roughness: 0.5', animation: 'property: rotation; to: 360 180 90; dur: 8000; easing: linear; loop: true' },
      { tag: 'a-icosahedron', position: '12 10 -35', radius: '0.4', material: 'color: #555566; metalness: 0.7; roughness: 0.4', animation: 'property: rotation; to: 180 360 0; dur: 10000; easing: linear; loop: true' },
      { tag: 'a-icosahedron', position: '-30 14 -42', radius: '0.7', material: 'color: #3a3a4a; metalness: 0.5; roughness: 0.6', animation: 'property: rotation; to: 90 270 360; dur: 12000; easing: linear; loop: true' },
      // Space station
      { tag: 'a-torus', position: '-15 8 -35', radius: '2.5', 'radius-tubular': '0.08', material: 'color: #334466; metalness: 0.9; roughness: 0.1; emissive: #112244; emissiveIntensity: 0.3', animation: 'property: rotation; to: 360 0 0; dur: 15000; easing: linear; loop: true' },
      { tag: 'a-torus', position: '-15 8 -35', radius: '3', 'radius-tubular': '0.04', material: 'color: #4466aa; emissive: #4466aa; emissiveIntensity: 0.5; opacity: 0.2', animation: 'property: rotation; to: 0 360 0; dur: 20000; easing: linear; loop: true' },
      // Nebula clouds
      { tag: 'a-sphere', position: '-25 10 -45', radius: '6', material: 'shader: flat; color: #4422aa; opacity: 0.04' },
      { tag: 'a-sphere', position: '18 15 -50', radius: '8', material: 'shader: flat; color: #aa2266; opacity: 0.03' },
      { tag: 'a-sphere', position: '0 20 -55', radius: '10', material: 'shader: flat; color: #2244aa; opacity: 0.035' },
      // Dense star field
      { tag: 'a-sphere', position: '-12 10 -30', radius: '0.05', material: 'shader: flat; color: #ffffff; opacity: 0.5', animation: 'property: material.opacity; from: 0.2; to: 0.6; dur: 1500; loop: true; dir: alternate' },
      { tag: 'a-sphere', position: '14 13 -28', radius: '0.04', material: 'shader: flat; color: #aaccff; opacity: 0.4', animation: 'property: material.opacity; from: 0.15; to: 0.5; dur: 1800; loop: true; dir: alternate' },
      { tag: 'a-sphere', position: '-8 16 -35', radius: '0.06', material: 'shader: flat; color: #ffffff; opacity: 0.45', animation: 'property: material.opacity; from: 0.2; to: 0.6; dur: 2200; loop: true; dir: alternate' },
      { tag: 'a-sphere', position: '10 14 -38', radius: '0.035', material: 'shader: flat; color: #ffddaa; opacity: 0.35', animation: 'property: material.opacity; from: 0.1; to: 0.5; dur: 2500; loop: true; dir: alternate' },
      { tag: 'a-sphere', position: '-18 18 -42', radius: '0.05', material: 'shader: flat; color: #ffffff; opacity: 0.3', animation: 'property: material.opacity; from: 0.15; to: 0.45; dur: 2000; loop: true; dir: alternate' },
      { tag: 'a-sphere', position: '6 20 -48', radius: '0.07', material: 'shader: flat; color: #aaaaff; opacity: 0.25', animation: 'property: material.opacity; from: 0.1; to: 0.4; dur: 3000; loop: true; dir: alternate' },
      { tag: 'a-sphere', position: '-5 11 -26', radius: '0.03', material: 'shader: flat; color: #ffffff; opacity: 0.5', animation: 'property: material.opacity; from: 0.25; to: 0.6; dur: 1600; loop: true; dir: alternate' },
      { tag: 'a-sphere', position: '20 16 -40', radius: '0.04', material: 'shader: flat; color: #ffccff; opacity: 0.35', animation: 'property: material.opacity; from: 0.15; to: 0.5; dur: 2100; loop: true; dir: alternate' },
      { tag: 'a-sphere', position: '-22 13 -32', radius: '0.045', material: 'shader: flat; color: #ffffff; opacity: 0.4', animation: 'property: material.opacity; from: 0.2; to: 0.55; dur: 1700; loop: true; dir: alternate' },
      { tag: 'a-sphere', position: '0 22 -52', radius: '0.08', material: 'shader: flat; color: #88aaff; opacity: 0.2', animation: 'property: material.opacity; from: 0.1; to: 0.35; dur: 2800; loop: true; dir: alternate' },
      { tag: 'a-sphere', position: '22 9 -25', radius: '0.03', material: 'shader: flat; color: #ffffff; opacity: 0.45', animation: 'property: material.opacity; from: 0.2; to: 0.55; dur: 1400; loop: true; dir: alternate' },
      { tag: 'a-sphere', position: '-28 17 -44', radius: '0.05', material: 'shader: flat; color: #ccddff; opacity: 0.3', animation: 'property: material.opacity; from: 0.1; to: 0.45; dur: 2600; loop: true; dir: alternate' },
    ],
    decorations: [],
    ambientParticles: { count: 20, color: '#aaccff', color2: '#6644aa', area: 22, height: 10 },
  },
  underwater: {
    id: 'underwater',
    name: 'Deep Ocean',
    icon: '🐋',
    unlockLevel: 10,
    sky: '#041520',
    floor: '#1a2a20',
    grid: '#0a1a15',
    gridOpacity: 0.06,
    lights: [
      { type: 'ambient', color: '#88cccc', intensity: 0.4 },
      { type: 'point', position: '0 10 0', color: '#00aa88', intensity: 0.8, distance: 50 },
      { type: 'point', position: '-8 6 -8', color: '#006666', intensity: 0.5, distance: 30 },
      { type: 'point', position: '8 6 -8', color: '#003366', intensity: 0.5, distance: 30 },
      { type: 'point', position: '0 4 8', color: '#008888', intensity: 0.35, distance: 25 },
    ],
    shadowLight: { color: '#00aa88', intensity: 0.35, position: '5 12 5' },
    pillarColor: '#0a1a1a',
    barrierColor: '#004444',
    floorRingColor1: '#00aa88',
    floorRingColor2: '#008888',
    pillarGlowColor: '#00cc99',
    baseGlowColor: '#006666',
    cornerGlowColor: '#006666',
    skyGradient: { bottom: '#0a3040', mid: '#062028', top: '#041520' },
    floorFadeColor: '#020a0a',
    platformSlabColor: '#061210',
    edgeGlowColor: '#00aa88',
    underGlowColor: '#00aa88',
    underGlowRing1: '#00aa88',
    underGlowRing2: '#008888',
    belowEnv: [
      // Dark abyss gradient
      { tag: 'a-sphere', position: '0 -30 0', radius: '15', material: 'shader: flat; color: #000a0a; opacity: 0.06; side: back' },
      // Bioluminescent dots
      { tag: 'a-sphere', position: '-8 -12 -6', radius: '0.03', material: 'shader: flat; color: #00ffaa; emissive: #00ffaa; emissiveIntensity: 2; opacity: 0.4', animation: 'property: material.opacity; from: 0.1; to: 0.5; dur: 2000; loop: true; dir: alternate' },
      { tag: 'a-sphere', position: '10 -18 3', radius: '0.04', material: 'shader: flat; color: #ff44aa; emissive: #ff44aa; emissiveIntensity: 2; opacity: 0.3', animation: 'property: material.opacity; from: 0.05; to: 0.4; dur: 2500; loop: true; dir: alternate' },
      { tag: 'a-sphere', position: '-4 -22 8', radius: '0.025', material: 'shader: flat; color: #44aaff; emissive: #44aaff; emissiveIntensity: 2; opacity: 0.35', animation: 'property: material.opacity; from: 0.1; to: 0.45; dur: 1800; loop: true; dir: alternate' },
      { tag: 'a-sphere', position: '6 -15 -10', radius: '0.035', material: 'shader: flat; color: #00ff88; emissive: #00ff88; emissiveIntensity: 2; opacity: 0.25', animation: 'property: material.opacity; from: 0.05; to: 0.35; dur: 3000; loop: true; dir: alternate' },
      { tag: 'a-sphere', position: '-12 -25 0', radius: '0.05', material: 'shader: flat; color: #aa44ff; emissive: #aa44ff; emissiveIntensity: 2; opacity: 0.2', animation: 'property: material.opacity; from: 0.05; to: 0.3; dur: 2800; loop: true; dir: alternate' },
    ],
    distantEnv: [
      // Coral formations (colored icosahedra clusters)
      { tag: 'a-icosahedron', position: '-18 0 -35', radius: '2', material: 'color: #cc4466; metalness: 0.3; roughness: 0.8; emissive: #881133; emissiveIntensity: 0.2' },
      { tag: 'a-icosahedron', position: '-16 1.5 -34', radius: '1.2', material: 'color: #ff8844; metalness: 0.3; roughness: 0.8; emissive: #993311; emissiveIntensity: 0.2' },
      { tag: 'a-icosahedron', position: '-19 0.5 -33', radius: '0.8', material: 'color: #cc66aa; metalness: 0.3; roughness: 0.8; emissive: #881155; emissiveIntensity: 0.2' },
      { tag: 'a-icosahedron', position: '20 0 -38', radius: '1.8', material: 'color: #44cc88; metalness: 0.3; roughness: 0.8; emissive: #228844; emissiveIntensity: 0.2' },
      { tag: 'a-icosahedron', position: '22 1 -36', radius: '1', material: 'color: #ffaa44; metalness: 0.3; roughness: 0.8; emissive: #884400; emissiveIntensity: 0.2' },
      { tag: 'a-icosahedron', position: '-30 0 -20', radius: '1.5', material: 'color: #ff6688; metalness: 0.3; roughness: 0.8; emissive: #882244; emissiveIntensity: 0.2' },
      { tag: 'a-icosahedron', position: '30 0 -15', radius: '1.3', material: 'color: #aa88cc; metalness: 0.3; roughness: 0.8; emissive: #664488; emissiveIntensity: 0.2' },
      { tag: 'a-icosahedron', position: '10 0 35', radius: '1.6', material: 'color: #cc8844; metalness: 0.3; roughness: 0.8; emissive: #884422; emissiveIntensity: 0.2' },
      // Kelp forest (tall green cylinders with sway)
      { tag: 'a-cylinder', position: '-25 4 -30', radius: '0.08', height: '8', material: 'color: #226633; metalness: 0.2; roughness: 0.9; emissive: #113322; emissiveIntensity: 0.2; opacity: 0.7', animation: 'property: rotation; from: 0 0 -3; to: 0 0 3; dur: 3000; loop: true; dir: alternate; easing: easeInOutSine' },
      { tag: 'a-cylinder', position: '-23 3.5 -28', radius: '0.06', height: '7', material: 'color: #338844; metalness: 0.2; roughness: 0.9; emissive: #224433; emissiveIntensity: 0.2; opacity: 0.6', animation: 'property: rotation; from: 0 0 -2; to: 0 0 4; dur: 3500; loop: true; dir: alternate; easing: easeInOutSine' },
      { tag: 'a-cylinder', position: '25 3 -32', radius: '0.07', height: '6', material: 'color: #226633; metalness: 0.2; roughness: 0.9; emissive: #113322; emissiveIntensity: 0.2; opacity: 0.65', animation: 'property: rotation; from: 0 0 -4; to: 0 0 2; dur: 2800; loop: true; dir: alternate; easing: easeInOutSine' },
      { tag: 'a-cylinder', position: '28 4.5 -28', radius: '0.05', height: '9', material: 'color: #338844; metalness: 0.2; roughness: 0.9; emissive: #224433; emissiveIntensity: 0.2; opacity: 0.55', animation: 'property: rotation; from: 0 0 -3; to: 0 0 3; dur: 4000; loop: true; dir: alternate; easing: easeInOutSine' },
      // Sunlight rays (wide transparent cylinders from above)
      { tag: 'a-cylinder', position: '-5 8 -20', radius: '2', height: '18', material: 'shader: flat; color: #88ccaa; opacity: 0.03; transparent: true', animation: 'property: rotation; from: 0 0 -5; to: 0 0 5; dur: 8000; loop: true; dir: alternate; easing: easeInOutSine' },
      { tag: 'a-cylinder', position: '8 9 -25', radius: '1.5', height: '20', material: 'shader: flat; color: #88ddbb; opacity: 0.025; transparent: true', animation: 'property: rotation; from: 0 0 3; to: 0 0 -3; dur: 10000; loop: true; dir: alternate; easing: easeInOutSine' },
      { tag: 'a-cylinder', position: '-12 7 -15', radius: '2.5', height: '16', material: 'shader: flat; color: #aaddcc; opacity: 0.02; transparent: true', animation: 'property: rotation; from: 0 0 -2; to: 0 0 4; dur: 12000; loop: true; dir: alternate; easing: easeInOutSine' },
      // Whale silhouette (dark elongated body moving slowly across background)
      { tag: 'a-sphere', position: '40 10 -45', radius: '3', material: 'color: #111822; metalness: 0.2; roughness: 0.9; emissive: #050a11; emissiveIntensity: 0.1; opacity: 0.4', animation: 'property: position; from: 40 10 -45; to: -40 12 -50; dur: 60000; loop: true; easing: linear' },
      { tag: 'a-cylinder', position: '42 10 -45', radius: '1.5', height: '6', rotation: '0 0 90', material: 'color: #111822; metalness: 0.2; roughness: 0.9; emissive: #050a11; emissiveIntensity: 0.1; opacity: 0.35', animation: 'property: position; from: 42 10 -45; to: -38 12 -50; dur: 60000; loop: true; easing: linear' },
      // Bubble columns (rising from coral)
      { tag: 'a-sphere', position: '-18 2 -35', radius: '0.05', material: 'shader: flat; color: #88ddff; opacity: 0.3; transparent: true', animation: 'property: position; from: -18 0 -35; to: -18 8 -35; dur: 6000; loop: true; easing: linear' },
      { tag: 'a-sphere', position: '20 3 -38', radius: '0.04', material: 'shader: flat; color: #aaeeff; opacity: 0.25; transparent: true', animation: 'property: position; from: 20 0 -38; to: 20 9 -38; dur: 7000; loop: true; easing: linear' },
      { tag: 'a-sphere', position: '-30 1 -20', radius: '0.06', material: 'shader: flat; color: #88ddff; opacity: 0.2; transparent: true', animation: 'property: position; from: -30 0 -20; to: -30 7 -20; dur: 5500; loop: true; easing: linear' },
      // Horizon glow ring (aqua tones)
      { tag: 'a-torus', position: '0 -1 0', rotation: '-90 0 0', radius: '80', 'radius-tubular': '0.15', material: 'shader: flat; color: #004444; emissive: #004444; emissiveIntensity: 1; opacity: 0.08', animation: 'property: material.opacity; from: 0.05; to: 0.1; dur: 5000; loop: true; dir: alternate; easing: easeInOutSine' },
    ],
    decorations: [],
    ambientParticles: { count: 20, color: '#88ddff', color2: '#00aa88', area: 22, height: 10 },
  },
};

// Helper: spawn elements from a decoration array into a container
function _spawnDecorations(container, items, cssClass) {
  items.forEach(dec => {
    const el = document.createElement(dec.tag);
    el.classList.add(cssClass);
    for (const [key, val] of Object.entries(dec)) {
      if (key === 'tag') continue;
      el.setAttribute(key, val);
    }
    container.appendChild(el);
  });
}

function applyTheme(sceneEl, themeId) {
  const theme = THEMES[themeId] || THEMES.cyber;
  const gc = sceneEl.querySelector('#game-content') || sceneEl;

  // Sky color
  const sky = sceneEl.querySelector('a-sky');
  if (sky) sky.setAttribute('color', theme.sky);

  // === Platform ===
  const platformSurface = gc.querySelector('#platform-surface');
  if (platformSurface) {
    platformSurface.setAttribute('material', `color: ${theme.floor}; metalness: 0.8; roughness: 0.4`);
  }
  const platformSlab = gc.querySelector('#platform-slab');
  if (platformSlab) {
    const slabColor = theme.platformSlabColor || '#0a0a22';
    platformSlab.setAttribute('material', `color: ${slabColor}; metalness: 0.9; roughness: 0.2`);
  }

  // Platform edge glow
  const edgeColor = theme.edgeGlowColor || '#0088ff';
  gc.querySelectorAll('.platform-edge').forEach(el => {
    el.setAttribute('material', `shader: flat; color: ${edgeColor}; emissive: ${edgeColor}; emissiveIntensity: 1; opacity: 0.2`);
  });

  // Under-glow rings
  const underRings = gc.querySelectorAll('.under-glow-ring');
  if (underRings.length >= 2) {
    const r1 = theme.underGlowRing1 || '#0088ff';
    const r2 = theme.underGlowRing2 || '#00d4ff';
    underRings[0].setAttribute('material', `color: ${r1}; emissive: ${r1}; emissiveIntensity: 1; opacity: 0.2`);
    underRings[1].setAttribute('material', `color: ${r2}; emissive: ${r2}; emissiveIntensity: 0.8; opacity: 0.15`);
  }

  // Under-glow light
  const underLight = gc.querySelector('.under-glow-light');
  if (underLight) {
    underLight.setAttribute('color', theme.underGlowColor || '#0088ff');
  }

  // Grid
  const gridPlane = gc.querySelector('#floor-grid a-plane');
  if (gridPlane) {
    gridPlane.setAttribute('material', `color: ${theme.grid}; wireframe: true; wireframeLinewidth: 1; opacity: ${theme.gridOpacity}`);
  }

  // Energy barriers
  const barriers = gc.querySelectorAll('.arena-barrier');
  barriers.forEach(barrier => {
    barrier.setAttribute('material', `shader: flat; color: ${theme.barrierColor}; opacity: 0.015; transparent: true; side: double`);
  });

  // Floor glow rings (on platform surface)
  const floorRings = gc.querySelectorAll(':scope > a-torus');
  if (floorRings.length >= 2) {
    if (theme.floorRingColor1) {
      floorRings[0].setAttribute('material', `color: ${theme.floorRingColor1}; emissive: ${theme.floorRingColor1}; emissiveIntensity: 0.8; opacity: 0.2`);
    }
    if (theme.floorRingColor2) {
      floorRings[1].setAttribute('material', `color: ${theme.floorRingColor2}; emissive: ${theme.floorRingColor2}; emissiveIntensity: 0.6; opacity: 0.15`);
    }
  }

  // Base glow lines
  const baseGlow = theme.baseGlowColor || '#0088ff';
  gc.querySelectorAll('.wall-base-glow').forEach(el => {
    el.setAttribute('material', `shader: flat; color: ${baseGlow}; emissive: ${baseGlow}; emissiveIntensity: 1; opacity: 0.15`);
  });

  // Corner glow lines
  const cornerGlow = theme.cornerGlowColor || '#0088ff';
  gc.querySelectorAll('.wall-corner-glow').forEach(el => {
    el.setAttribute('material', `color: ${cornerGlow}; emissive: ${cornerGlow}; emissiveIntensity: 1; opacity: 0.15`);
  });

  // Pillars
  const pillarEntities = gc.querySelectorAll('.arena-pillar');
  pillarEntities.forEach(pe => {
    const cyl = pe.querySelector('a-cylinder');
    if (cyl) cyl.setAttribute('material', `color: ${theme.pillarColor}; metalness: 0.9; roughness: 0.2`);
    const torus = pe.querySelector('a-torus');
    if (torus && theme.pillarGlowColor) {
      torus.setAttribute('material', `color: ${theme.pillarGlowColor}; emissive: ${theme.pillarGlowColor}; emissiveIntensity: 0.8; opacity: 0.3`);
    }
  });

  // Lights
  const existingLights = gc.querySelectorAll(':scope > a-light');
  existingLights.forEach((light, i) => {
    if (i < theme.lights.length) {
      const l = theme.lights[i];
      light.setAttribute('type', l.type);
      light.setAttribute('color', l.color);
      light.setAttribute('intensity', String(l.intensity));
      if (l.position) light.setAttribute('position', l.position);
      if (l.distance) light.setAttribute('distance', String(l.distance));
    }
  });

  // Shadow directional light
  let shadowLight = gc.querySelector('#shadow-dir-light');
  if (!shadowLight) {
    shadowLight = document.createElement('a-light');
    shadowLight.id = 'shadow-dir-light';
    gc.appendChild(shadowLight);
  }
  const sl = theme.shadowLight || { color: '#4466ff', intensity: 0.6, position: '5 12 5' };
  shadowLight.setAttribute('type', 'directional');
  shadowLight.setAttribute('color', sl.color);
  shadowLight.setAttribute('intensity', String(sl.intensity));
  shadowLight.setAttribute('position', sl.position);
  shadowLight.setAttribute('light', `castShadow: true; shadowMapWidth: 1024; shadowMapHeight: 1024; shadowCameraLeft: -20; shadowCameraRight: 20; shadowCameraTop: 20; shadowCameraBottom: -20; shadowCameraNear: 0.5; shadowCameraFar: 50`);

  // === Floor edge gradient (ambient occlusion on platform) ===
  gc.querySelectorAll('.floor-edge-gradient').forEach(el => el.remove());
  const edgePositions = [
    { pos: '0 0.02 -15', rot: '-90 0 0', w: 32, h: 2 },
    { pos: '0 0.02 15', rot: '-90 0 0', w: 32, h: 2 },
    { pos: '-15 0.02 0', rot: '-90 90 0', w: 32, h: 2 },
    { pos: '15 0.02 0', rot: '-90 90 0', w: 32, h: 2 },
  ];
  edgePositions.forEach(e => {
    const grad = document.createElement('a-plane');
    grad.classList.add('floor-edge-gradient');
    grad.setAttribute('position', e.pos);
    grad.setAttribute('rotation', e.rot);
    grad.setAttribute('width', String(e.w));
    grad.setAttribute('height', String(e.h));
    grad.setAttribute('material', `shader: flat; color: #000000; opacity: 0.1; transparent: true`);
    gc.appendChild(grad);
  });

  // === Sky gradient ===
  const skyGradientContainer = gc.querySelector('#sky-gradient');
  if (skyGradientContainer) {
    while (skyGradientContainer.firstChild) skyGradientContainer.firstChild.remove();
    const sg = theme.skyGradient;
    if (sg) {
      const bottomGlow = document.createElement('a-sphere');
      bottomGlow.setAttribute('radius', '90');
      bottomGlow.setAttribute('position', '0 -20 0');
      bottomGlow.setAttribute('material', `shader: flat; color: ${sg.bottom}; opacity: 0.08; side: back; transparent: true`);
      skyGradientContainer.appendChild(bottomGlow);

      const midGlow = document.createElement('a-sphere');
      midGlow.setAttribute('radius', '85');
      midGlow.setAttribute('position', '0 -5 0');
      midGlow.setAttribute('material', `shader: flat; color: ${sg.mid}; opacity: 0.05; side: back; transparent: true`);
      skyGradientContainer.appendChild(midGlow);

      const topGlow = document.createElement('a-sphere');
      topGlow.setAttribute('radius', '80');
      topGlow.setAttribute('position', '0 15 0');
      topGlow.setAttribute('material', `shader: flat; color: ${sg.top}; opacity: 0.06; side: back; transparent: true`);
      skyGradientContainer.appendChild(topGlow);
    }
  }

  // === Floor fade edges (platform rim blend) ===
  const floorFadeContainer = gc.querySelector('#floor-fade');
  if (floorFadeContainer) {
    while (floorFadeContainer.firstChild) floorFadeContainer.firstChild.remove();
    const fadeColor = theme.floorFadeColor || theme.sky;
    const fadePlanes = [
      { pos: '0 0.015 -15.5', rot: '-90 0 0', w: 32, h: 2 },
      { pos: '0 0.015 15.5', rot: '-90 0 0', w: 32, h: 2 },
      { pos: '-15.5 0.015 0', rot: '-90 0 0', w: 2, h: 32 },
      { pos: '15.5 0.015 0', rot: '-90 0 0', w: 2, h: 32 },
    ];
    fadePlanes.forEach(fp => {
      const plane = document.createElement('a-plane');
      plane.setAttribute('position', fp.pos);
      plane.setAttribute('rotation', fp.rot);
      plane.setAttribute('width', String(fp.w));
      plane.setAttribute('height', String(fp.h));
      plane.setAttribute('material', `shader: flat; color: ${fadeColor}; opacity: 0.5; transparent: true`);
      floorFadeContainer.appendChild(plane);
    });
  }

  // === Below-void content ===
  const belowVoidContainer = gc.querySelector('#below-void');
  if (belowVoidContainer) {
    while (belowVoidContainer.firstChild) belowVoidContainer.firstChild.remove();
    if (theme.belowEnv) {
      _spawnDecorations(belowVoidContainer, theme.belowEnv, 'below-decoration');
    }
  }

  // === Distant environment ===
  const distantEnvContainer = gc.querySelector('#distant-env');
  if (distantEnvContainer) {
    while (distantEnvContainer.firstChild) distantEnvContainer.firstChild.remove();
    if (theme.distantEnv) {
      _spawnDecorations(distantEnvContainer, theme.distantEnv, 'distant-decoration');
    }
  }

  // === Legacy theme decorations ===
  gc.querySelectorAll('.theme-decoration').forEach(el => el.remove());
  if (theme.decorations && theme.decorations.length > 0) {
    _spawnDecorations(gc, theme.decorations, 'theme-decoration');
  }

  // === Ambient particles ===
  const apContainer = gc.querySelector('#ambient-particles-container');
  if (apContainer) {
    // Remove old particles entity
    const old = apContainer.querySelector('[ambient-particles]');
    if (old) old.remove();
    if (theme.ambientParticles) {
      const ap = document.createElement('a-entity');
      const cfg = theme.ambientParticles;
      ap.setAttribute('ambient-particles', `count: ${cfg.count}; color: ${cfg.color}; color2: ${cfg.color2}; area: ${cfg.area}; height: ${cfg.height}`);
      apContainer.appendChild(ap);
    }
  }
}

function getThemes() {
  return THEMES;
}

function getTheme(id) {
  return THEMES[id] || THEMES.cyber;
}

export { THEMES, applyTheme, getThemes, getTheme };
export default { applyTheme, getThemes, getTheme };
