# 3D Game Design Rules

> Priority: **UX (Player Experience) > Performance Stability > Extensibility**

## Core Philosophy

Build games that are: **Easy to play — Satisfying to control — Visually/audibly rewarding — Highly interactive**

---

## 1. Camera & Controls — "Easy Interaction"

### VR Context (This Codebase)
- Default: **First-person VR** via `#player-rig` with hand controllers
- Player rig structure: `#player-rig` > `a-camera` + `#left-hand` + `#right-hand`
- WebXR handles head tracking automatically

### Control Principles

| Principle | Implementation |
|-----------|----------------|
| Predictable | Input → immediate expected response |
| No Surprise | Never auto-rotate camera beyond player control |
| Discoverable | New player understands controls in <30 seconds |

### Checklist (Camera/Control)

- [ ] Camera smoothing enabled (A-Frame `look-controls` with `smoothingFactor`)
- [ ] FOV appropriate for VR (avoid motion sickness)
- [ ] Controller laser visible and responsive
- [ ] Teleport/snap-turn options for comfort
- [ ] No camera stuck in walls/geometry (collision handling)

### Pass Criteria
- New player understands basic interaction within 30 seconds
- No "stuck camera" or "lost orientation" moments

---

## 2. Game Feel — "Satisfying to Control"

### Core Loop
```
Action → Feedback → Reward → Next Goal
```

### Pacing
- **Start:** Easy, introduce mechanics gradually
- **Middle:** Increase challenge, maintain engagement
- **Climax:** Controlled intensity peaks

### Checklist (Game Feel)

For every primary action (shoot/grab/interact):
- [ ] **Input buffer** — Accept input slightly before action completes
- [ ] **Cancel window** — Allow interrupting animations when appropriate
- [ ] **Visual feedback** — Immediate visual response
- [ ] **Audio feedback** — Immediate sound response
- [ ] **Haptic feedback** — Controller vibration (Quest)

### Reward Structure

| Type | Example | Frequency |
|------|---------|-----------|
| Short-term | Coin pickup, hit confirm | Constant |
| Medium-term | Level complete, unlock | Every few minutes |
| Long-term | Achievement, full upgrade | Session-spanning |

### Pass Criteria
- Player always has clear "next objective" (visual marker/hint)
- Failure → quick respawn (minimize downtime)

---

## 3. Visual & Audio Feedback — "Satisfying Senses"

### VFX Hierarchy

| Impact Level | Example | Intensity |
|--------------|---------|-----------|
| Small | Footstep, pickup | Subtle particle, quiet sound |
| Medium | Hit enemy, jump | Moderate VFX, clear sound |
| Large | Critical hit, explosion | Screen effect, loud sound |

### Visual Checklist

- [ ] Effects tied to gameplay semantics (hit = flash, damage = red vignette)
- [ ] Post-processing optional and toggle-able (bloom, motion blur)
- [ ] UI readable: icons, reticle, hit markers, damage numbers
- [ ] Low HP warning (visual + audio)
- [ ] Lighting optimized (baked where possible)

### Audio Checklist

- [ ] Layered audio: ambient / action / UI / voice
- [ ] Hit confirmation sounds (distinct for hit/crit/miss)
- [ ] Positional audio (Three.js `PositionalAudio`)
- [ ] Volume sliders per category + master mute
- [ ] Warning sounds for low HP, incoming danger

### A-Frame/Three.js Implementation

```javascript
// Sound component example
AFRAME.registerComponent('game-audio', {
  schema: {
    src: { type: 'string' },
    volume: { type: 'number', default: 1.0 },
    positional: { type: 'boolean', default: false }
  },
  init() {
    // Setup audio with volume control
  }
});
```

### Pass Criteria
- FPS stable at target (72fps Quest, 60fps desktop)
- Player understands game state without reading text

---

## 3.5. 3D Visual Style — "Cohesive Aesthetic"

### Art Direction Principles

| Principle | Description |
|-----------|-------------|
| Consistency | Same style across all assets (don't mix realistic + cartoon) |
| Readability | Important objects stand out from background |
| Performance-aware | Visual fidelity must fit performance budget |

### Lighting Setup

#### Light Types (A-Frame/Three.js)

| Light Type | Use Case | Performance |
|------------|----------|-------------|
| `ambient` | Base fill, no harsh shadows | Cheap |
| `directional` | Sun/moon, primary shadows | Medium |
| `point` | Lamps, local highlights | Expensive |
| `spot` | Flashlight, focused areas | Expensive |

#### Lighting Checklist

- [ ] One primary directional light (sun) for main shadows
- [ ] Ambient light for fill (prevent pure black areas)
- [ ] Max 4 dynamic lights total (Quest budget)
- [ ] Bake lighting for static geometry when possible
- [ ] Light intensity balanced (no blown-out areas)

```html
<!-- A-Frame lighting example -->
<a-entity light="type: ambient; color: #445566; intensity: 0.4"></a-entity>
<a-entity light="type: directional; color: #ffffff; intensity: 0.8; castShadow: true"
          position="1 2 1"></a-entity>
```

### Shadows (Đổ Bóng)

#### Shadow Types

| Type | When to Use | Performance |
|------|-------------|-------------|
| **Real-time** | Moving objects, player, enemies | Expensive |
| **Baked** | Static environment | Free at runtime |
| **Blob shadow** | Simple circular shadow under characters | Cheap |

#### Shadow Quality Settings

```html
<!-- A-Frame: Enable shadows on scene -->
<a-scene shadow="type: pcfsoft; autoUpdate: true">

  <!-- Light that casts shadows -->
  <a-entity light="type: directional; castShadow: true;
                   shadowMapWidth: 1024; shadowMapHeight: 1024;
                   shadowCameraNear: 0.5; shadowCameraFar: 50;
                   shadowBias: -0.001"
            position="1 4 2"></a-entity>

  <!-- Objects that cast/receive shadows -->
  <a-box shadow="cast: true; receive: true"></a-box>
  <a-plane shadow="receive: true" rotation="-90 0 0"></a-plane>
</a-scene>
```

```javascript
// Or via JavaScript for dynamic setup
var scene = document.querySelector('a-scene');
scene.setAttribute('shadow', { type: 'pcfsoft', autoUpdate: true });

var light = document.querySelector('[light]');
light.setAttribute('light', {
  castShadow: true,
  shadowMapWidth: 1024,  // 512 for Quest, 2048 for desktop
  shadowMapHeight: 1024,
  shadowCameraNear: 0.5,
  shadowCameraFar: 50
});
```

#### Shadow Checklist

- [ ] Player and enemies cast shadows (essential for depth perception)
- [ ] Shadow map resolution appropriate for platform (512-1024 Quest)
- [ ] Shadow bias tuned (no shadow acne or peter-panning)
- [ ] Distant objects use blob shadows or none
- [ ] Shadow frustum covers playable area only

### Reflections (Phản Chiếu Ánh Sáng)

#### Reflection Types

| Type | Use Case | Performance |
|------|----------|-------------|
| **Environment Map** | Metal, glass, water surfaces | Medium |
| **Planar Reflection** | Mirrors, flat water | Expensive |
| **Screen-Space (SSR)** | General reflections | Very Expensive |
| **Baked Cubemap** | Static reflections | Cheap |

#### Implementation (A-Frame/Three.js)

```javascript
// Environment map for reflective materials
const envMap = new THREE.CubeTextureLoader().load([
  'px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg'
]);

material.envMap = envMap;
material.envMapIntensity = 0.5;  // Subtle reflection
material.metalness = 0.8;
material.roughness = 0.2;
```

#### Reflection Checklist

- [ ] Use baked cubemaps for static environments
- [ ] Limit real-time reflections to 1-2 surfaces
- [ ] Metallic objects have environment reflection
- [ ] Water/glass use simple fresnel effect
- [ ] No SSR on Quest (too expensive)

### Materials & Shaders

#### PBR Material Properties

| Property | Range | Description |
|----------|-------|-------------|
| `metalness` | 0-1 | 0 = dielectric, 1 = metal |
| `roughness` | 0-1 | 0 = mirror, 1 = matte |
| `emissive` | color | Self-illumination (no light cast) |
| `normalMap` | texture | Surface detail without geometry |

#### Material Guidelines

- [ ] Use consistent PBR workflow (metalness/roughness)
- [ ] Share materials across similar objects (reduce draw calls)
- [ ] Emissive for glowing UI elements, pickups
- [ ] Normal maps for detail on low-poly models
- [ ] Avoid transparency when possible (sorting issues)

```javascript
// A-Frame material example
AFRAME.registerComponent('metal-material', {
  init() {
    this.el.setAttribute('material', {
      metalness: 0.9,
      roughness: 0.1,
      envMap: '#env-cubemap',
      color: '#cccccc'
    });
  }
});
```

### Color & Tone

#### Color Palette Rules

| Element | Guideline |
|---------|-----------|
| Player/allies | Warm colors (blue, green, white) |
| Enemies/danger | Cool/aggressive colors (red, orange) |
| Interactables | Distinct highlight color (yellow glow) |
| Background | Muted, less saturated |
| UI | High contrast, readable |

#### Visual Hierarchy

```
1. Player character (brightest, most saturated)
2. Enemies & hazards (high contrast, warning colors)
3. Interactive objects (highlighted)
4. Foreground environment (medium detail)
5. Background (muted, low detail)
```

### Style Presets

#### Stylized/Cartoon

```javascript
// Flat shading, bold colors
material.flatShading = true;
material.roughness = 1.0;
material.metalness = 0.0;
// Use cel-shading post-process if needed
```

#### Semi-Realistic

```javascript
// PBR with moderate detail
material.roughness = 0.4;
material.metalness = 0.2;
material.normalMap = normalTexture;
```

#### Low-Poly

```javascript
// Minimal textures, vertex colors
material.vertexColors = true;
material.flatShading = true;
// No normal maps, rely on geometry
```

### Performance Impact Summary

| Feature | Quest Impact | Recommendation |
|---------|--------------|----------------|
| Real-time shadows | High | 1 shadow-casting light only |
| Environment maps | Medium | Use for hero objects only |
| Normal maps | Low | Recommended for detail |
| Emissive | Low | Use freely |
| Transparency | Medium | Minimize, causes sorting |
| Post-processing | Very High | Avoid on Quest |

### Visual Style Checklist

- [ ] Art style defined and documented
- [ ] All assets follow consistent style
- [ ] Lighting setup matches mood/genre
- [ ] Shadows enabled for depth perception
- [ ] Reflections used sparingly and appropriately
- [ ] Color palette enhances gameplay readability
- [ ] Visual hierarchy guides player attention
- [ ] Performance tested with all visual features

### Pass Criteria
- Visual style is cohesive across all game elements
- Player can distinguish interactive vs decorative objects
- Performance budget maintained with visual features enabled

---

## 4. Interactivity — "Many Things to Do"

### Interaction Types

| Type | Examples |
|------|----------|
| Combat | Shoot, melee, throw |
| Environment | Push, pull, destroy, toggle |
| Collect | Pickup items, resources |
| NPC | Dialogue, trade, react to player |
| Puzzle | Combine, sequence, physics |

### Checklist (Interactivity)

- [ ] Each area has 2-3 interaction types minimum
- [ ] Grabbable objects clearly indicated (glow, outline)
- [ ] NPC reactions to player actions (not just scripted dialogue)
- [ ] Points of Interest (POI) guide exploration naturally
- [ ] Destructible/interactive environment elements

### A-Frame Interaction Pattern

```javascript
// Standard interactive component
AFRAME.registerComponent('interactive', {
  schema: {
    type: { default: 'grab' }, // grab, push, toggle, destroy
    feedbackVfx: { type: 'string' },
    feedbackSfx: { type: 'string' }
  },
  events: {
    click() { this.onInteract(); },
    gripdown() { this.onGrab(); }
  }
});
```

### Pass Criteria
- Multiple valid play approaches per area
- Environment feels reactive, not static

---

## 5. Performance Budget — "Stable Experience"

### Target Platforms

| Platform | Design Target | VRC Minimum | Resolution |
|----------|---------------|-------------|------------|
| Quest 2/3 | **80 fps** | 60 fps | Eye buffer resolution |
| Desktop VR | 90 fps | 72 fps | HMD native |
| Desktop flat | 60 fps | 30 fps | 1080p |

> **Design for 80 FPS** on Quest gives ~10% headroom above 72Hz refresh rate.
> VRC requires minimum 60fps sustained - designing for 80 prevents edge-case failures.

### WebXR/Three.js Budgets

| Resource | Budget | Notes |
|----------|--------|-------|
| Draw calls | <100 per frame | Batch static geometry |
| Triangles | <300K visible | Use LOD |
| Textures | <50MB total | Compress, atlas |
| Lights | <4 dynamic | Bake static lighting |
| Physics bodies | <50 active | Disable distant objects |

### Performance Checklist

- [ ] Object pooling for spawned entities (no GC spikes)
- [ ] LOD system for complex models
- [ ] Frustum culling enabled (A-Frame default)
- [ ] Texture atlasing for small objects
- [ ] No memory leaks (dispose Three.js objects)
- [ ] Profile before merge (Quest: `adb logcat | grep fps`)

### Anti-Patterns

| Issue | Solution |
|-------|----------|
| Creating entities in game loop | Pre-spawn, use pool |
| New materials per entity | Share materials |
| Unbounded particle systems | Set maxParticles, auto-dispose |
| No LOD on detailed models | Add `lod` component |

### GC-Free Coding Patterns (CRITICAL for >80 FPS)

Every frame, V8 checks for garbage. Allocations in `tick()` cause GC spikes → frame drops.

#### ❌ BAD: Allocations in tick()

```javascript
tick: function(time, delta) {
  var direction = new THREE.Vector3();  // GC every frame!
  this.positionHistory.push({           // Object + clone() every frame!
    position: currentPos.clone(),
    time: performance.now()
  });
}
```

#### ✅ GOOD: Pre-allocated + Circular Buffer

```javascript
init: function() {
  // Pre-allocate at init (runs once)
  this._direction = new THREE.Vector3();

  // Circular buffer for history (no push/shift GC)
  this.positionHistory = [];
  for (var i = 0; i < 5; i++) {
    this.positionHistory.push({ position: new THREE.Vector3(), time: 0 });
  }
  this.historyIndex = 0;
},

tick: function(time, delta) {
  // Reuse pre-allocated vector
  this._direction.set(1, 0, 0);

  // Reuse buffer entry with .copy() instead of .clone()
  var entry = this.positionHistory[this.historyIndex];
  entry.position.copy(currentPos);  // No allocation!
  entry.time = performance.now();
  this.historyIndex = (this.historyIndex + 1) % 5;
}
```

#### ✅ GOOD: Cached DOM Queries

```javascript
// Module scope - shared cache
var _hittableCache = new Set();

// In component init/remove - maintain cache
init: function() {
  _hittableCache.add(this.el);
},
remove: function() {
  _hittableCache.delete(this.el);
}

// In tick - use cache instead of querySelectorAll
tick: function() {
  // BAD: document.querySelectorAll('[hittable]') - DOM query every frame
  // GOOD: _hittableCache.forEach() - O(1) Set iteration
  _hittableCache.forEach(function(el) { ... });
}
```

#### Framework Modules Using These Patterns

| Module | Pattern Used |
|--------|-------------|
| `grabbable.js` | Circular buffer for velocity tracking |
| `melee.js` | Circular buffer + hittable cache |
| `simple-physics.js` | Pre-allocated vectors for collision |
| `teleport.js` | Pre-allocated vectors for arc |
| `distance-grab.js` | Pre-allocated vectors |

### Merge Blocker
**Agent must not merge if:**
- FPS drops >10% on test scene
- GC spikes visible in profiler
- Memory grows unbounded over time

---

## 6. Agent-Safe Architecture

### Module Structure (Actual)

```
framework/
├── vr-core.js              # VRCore: loading screen, auto-VR, SW cleanup
├── hud.js                  # HUD: init, update, show/hide, message
├── controllers.js          # Controller reference docs
├── audio/
│   └── audio-manager.js    # AudioManager: layered audio, positional
├── vfx/
│   └── screen-shake.js     # A-Frame component: screen-shake
└── utils/
    ├── object-pool.js      # ObjectPool: GC-free spawning
    ├── haptics.js          # Haptics: Quest controller vibration
    └── analytics.js        # Analytics: session event logging
```

### Existing Framework APIs

```javascript
// VRCore (vr-core.js)
VRCore.loadingScreen({ title: 'Game Name', titleColor: '#5af' });
VRCore.autoEnterVR(sceneEl);
VRCore.clearServiceWorkers();

// HUD (hud.js)
HUD.init({ score: 'hud-score', timer: 'hud-timer' });
HUD.update('score', 'Score: 100');
HUD.message('Wave 1!', 2000);

// AudioManager (audio/audio-manager.js)
AudioManager.init({ ambient: 0.5, action: 1.0, ui: 0.8 });
AudioManager.load('hit', '/sounds/hit.mp3', { category: 'action' });
AudioManager.play('hit');
AudioManager.playPositional('explosion', entity, { refDistance: 5 });

// ObjectPool (utils/object-pool.js)
var pool = ObjectPool.create(factory, 20, { maxSize: 50 });
var obj = pool.get();
pool.release(obj);

// Haptics (utils/haptics.js)
Haptics.pulse('right', 0.5, 100);  // hand, intensity, duration(ms)
Haptics.light('both');   // Presets: light, medium, heavy

// Analytics (utils/analytics.js)
Analytics.log('level_complete', { level: 1, time: 120 });
Analytics.export();  // JSON string for analysis
```

### Feature Requirements

Every new feature must have:

1. **Config separated from code**
   ```javascript
   // Config in JSON or component schema
   const CONFIG = {
     enemySpeed: 5,
     spawnInterval: 2000  // ms
   };
   ```

2. **Logging at appropriate level**
   ```javascript
   console.log('[GameSystem] Initialized');
   console.warn('[GameSystem] Low performance detected');
   ```

3. **Testable entry points**
   ```javascript
   // Expose for testing
   window.DEBUG = { spawnEnemy, resetGame };
   ```

### PR Requirements

- [ ] Description: "Player experience change: ..."
- [ ] Screenshot/GIF for visual changes
- [ ] FPS before/after (if touching render)
- [ ] Test checklist: 3-5 steps + expected result

---

## 7. Game Feel Systems

### Juice Effects

| Effect | Use Case | A-Frame Implementation |
|--------|----------|------------------------|
| Hitstop | Melee impact | Pause animation 50-100ms |
| Screen shake | Explosion, hit | `ScreenShake.trigger(intensity, duration)` |
| Haptics | All impacts | `Haptics.pulse(hand, intensity, duration)` |

### Screen Shake (framework/vfx/screen-shake.js)

```html
<!-- Attach to player rig -->
<a-entity id="player-rig" screen-shake="intensity: 0.1; duration: 200">
  <a-camera></a-camera>
</a-entity>
```

```javascript
// Trigger via component method
var rig = document.getElementById('player-rig');
rig.components['screen-shake'].shake(0.5, 300);  // intensity, duration(ms)

// Or via global helper
ScreenShake.trigger(0.5, 300);

// Accessibility toggle
ScreenShake.disable();  // Motion sensitivity
ScreenShake.enable();
```

### Control Assists (if applicable)

- **Aim assist:** Subtle magnetism toward targets (gamepad)
- **Auto-target:** Highlight nearest valid target
- **Coyote time:** Accept jump input briefly after leaving edge

### Animation Principles

- Blend animations smoothly (Three.js AnimationMixer)
- **Responsiveness > Beauty** — cancel slow animations on input
- No input lag from animation commitment

---

## 8. Accessibility

### Required (Minimum Viable)

- [ ] Motion blur OFF by default (VR comfort)
- [ ] Head bob OFF by default (VR comfort)
- [ ] FOV adjustable
- [ ] Subtitles for dialogue/audio cues
- [ ] Controller remapping (where feasible)

### Recommended

- [ ] Colorblind-friendly UI (avoid red/green only)
- [ ] High contrast mode
- [ ] Seated play support
- [ ] One-handed mode option
- [ ] Audio descriptions for blind players

### VR Comfort Modes

| Mode | Description |
|------|-------------|
| Teleport | Instant position change |
| Snap Turn | 30°/45°/90° rotation |
| Vignette | Peripheral blackout during movement |
| Comfort Cage | Static reference frame overlay |

---

## 9. Telemetry & Balance (Optional)

### Key Metrics

| Metric | Purpose |
|--------|---------|
| Time to first action | Onboarding effectiveness |
| Death rate per area | Difficulty balance |
| Session length | Engagement |
| Drop-off points | Identify friction |
| Action frequency | Pacing validation |

### Implementation

```javascript
// Simple event logging
const Analytics = {
  log(event, data) {
    console.log(`[Analytics] ${event}`, data);
    // Send to server if configured
  }
};

Analytics.log('level_complete', { level: 1, time: 120 });
```

---

## 10. Definition of Done (Feature Checklist)

Every feature must pass before merge:

### Player Experience
- [ ] Player-facing change documented in PR
- [ ] Does not break existing camera/controls
- [ ] Has visual + audio feedback on interaction

### Technical
- [ ] No significant FPS drop on test scene
- [ ] Code follows module structure (config separated)
- [ ] No memory leaks introduced

### Quality
- [ ] Test checklist provided: 3-5 steps + expected result
- [ ] Edge cases handled (empty state, max count, etc.)

### Template

```markdown
## Test Checklist

1. **Step:** Enter VR mode
   **Expected:** Scene loads, hands visible

2. **Step:** Grab object with right hand
   **Expected:** Object attaches to hand, haptic pulse

3. **Step:** Throw object at target
   **Expected:** Hit VFX plays, score updates, sound plays

4. **Step:** Repeat 10 times rapidly
   **Expected:** No performance degradation
```

---

## Quick Reference

### Priority Order
1. **UX** — Does it feel good to play?
2. **Performance** — Does it run smoothly?
3. **Extensibility** — Can we build on it?

### Immediate Feedback Triad
Every action needs: **Visual + Audio + Haptic**

### Performance Gate
Design for **80 FPS on Quest** — gives headroom above 72Hz refresh rate.
VRC minimum is 60fps — designing for 80 prevents edge-case failures.

---

## 11. Meta Store VRC Compliance

> **Reference:** [Meta Quest VRC Guidelines](https://developer.oculus.com/resources/vrc-quest-performance-1/)

### VRC.Quest.Performance.1 Requirements

Meta Store submission requires stable frame rate performance:

| Requirement | Threshold | Notes |
|-------------|-----------|-------|
| Target refresh rate | 72 Hz | Request via WebXR API |
| Minimum sustained FPS | 60 fps | No drops during gameplay |
| Startup performance | 60 fps within 4s | No hitches on first frame |
| Frame drops tolerance | <5% frames below target | Over any 10-second window |

### Renderer Settings Checklist

A-Frame scene must use Quest-optimized defaults:

```html
<a-scene
  renderer="antialias: false; colorManagement: true; physicallyCorrectLights: false"
  vr-mode-ui="enabled: true"
>
```

| Setting | Quest Value | Reason |
|---------|-------------|--------|
| `antialias` | `false` | MSAA is expensive on mobile GPU |
| `pixelRatio` | `1.0` | Native resolution, no supersampling |
| `powerPreference` | `high-performance` | Request dedicated GPU |
| `physicallyCorrectLights` | `false` | Simpler light calculations |

### Lighting Budget

| Resource | Maximum | Notes |
|----------|---------|-------|
| Dynamic lights | 2 | 1 ambient + 1 directional |
| Shadow-casting lights | 1 | Directional only |
| Shadow map resolution | 1024x1024 | 512x512 for complex scenes |

### WebXR Refresh Rate Request

Request 72Hz refresh rate when entering VR:

```javascript
// In VRCore.applyQuestOptimizations() or session start handler
navigator.xr.requestSession('immersive-vr').then(session => {
  // Request 72Hz if supported
  if (session.updateTargetFrameRate) {
    session.updateTargetFrameRate(72).catch(() => {
      console.warn('[VRC] 72Hz not supported, using default');
    });
  }
});
```

### Pre-Submission Checklist

Verify before submitting to Meta Store:

#### OVR Metrics Tool Verification

1. **Install OVR Metrics Tool** on Quest
2. **Enable performance overlay**: Settings → Developer → Performance HUD
3. **Record 5-minute gameplay session**
4. **Verify metrics:**

| Metric | Pass Criteria |
|--------|---------------|
| GPU Utilization | <85% average |
| CPU Utilization | <80% average |
| Frame Rate | >60 fps sustained |
| Dropped Frames | <5% over session |
| Memory | No growth over time |

#### Build Verification

- [ ] `antialias: false` in scene renderer
- [ ] Maximum 2 dynamic lights in scene
- [ ] `VRCore.applyQuestOptimizations()` called on scene load
- [ ] No post-processing effects (bloom, motion blur, SSR)
- [ ] Shadow map ≤1024x1024
- [ ] Pixel ratio set to 1.0 on Quest
- [ ] 72Hz refresh rate requested via WebXR

#### Runtime Verification (adb)

```bash
# Monitor FPS in real-time
adb logcat | grep -E "(fps|FPS|frame)"

# Check GPU/CPU usage
adb shell dumpsys gpu

# Monitor thermal state
adb shell dumpsys thermalservice
```

#### Common VRC Rejection Causes

| Issue | Symptom | Fix |
|-------|---------|-----|
| Shader compilation stutter | FPS drop on first interaction | Pre-warm shaders at load |
| Antialiasing enabled | Sustained low FPS | `renderer="antialias: false"` |
| Too many lights | GPU >90% | Reduce to 2 lights max |
| High-res shadow maps | Frame drops during combat | Reduce to 512x512 |
| Memory leak | FPS degrades over time | Pool objects, dispose Three.js resources |
| No 72Hz request | Defaulting to 60Hz | Call `session.updateTargetFrameRate(72)` |

### Framework Support

The framework provides automatic Quest optimization:

```javascript
// vr-core.js - Called automatically on Quest
VRCore.applyQuestOptimizations(sceneEl);

// Manual call if needed
document.querySelector('a-scene').addEventListener('loaded', () => {
  VRCore.applyQuestOptimizations(document.querySelector('a-scene'));
});
```

This applies:
- Disables antialiasing at runtime
- Sets pixel ratio to 1.0
- Requests 72Hz refresh rate
- Pre-warms shaders with hidden render pass

### Pass Criteria

**Game is VRC-compliant when:**
- OVR Metrics Tool shows >60 fps for entire 5-minute session
- No frame drops during scene transitions
- GPU utilization stays below 85%
- Thermal state remains "normal" throughout testing

---

**See also:** `.claude/rules/performance.md`, `specs/architecture.md`
