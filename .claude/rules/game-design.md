# 3D Game Design Rules

> Priority: **UX (Player Experience) > Performance Stability > Extensibility**

> **PERFORMANCE GATE:** All designs MUST target **90 FPS** on Quest.
> See `.claude/rules/performance.md` for hard limits.
> **TechLead MUST include Performance Checklist in every task.**

## Core Philosophy

Build games that are: **Easy to play — Satisfying to control — Visually/audibly rewarding — Highly interactive**

---

## 1. Camera & Controls — "Easy Interaction"

### VR Context
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

---

## 2. Game Feel — "Satisfying to Control"

### Core Loop
```
Action → Feedback → Reward → Next Goal
```

### Checklist (Game Feel)

For every primary action (shoot/grab/interact):
- [ ] **Visual feedback** — Immediate visual response
- [ ] **Audio feedback** — Immediate sound response
- [ ] **Haptic feedback** — Controller vibration (Quest)

### Reward Structure

| Type | Example | Frequency |
|------|---------|-----------|
| Short-term | Coin pickup, hit confirm | Constant |
| Medium-term | Level complete, unlock | Every few minutes |
| Long-term | Achievement, full upgrade | Session-spanning |

---

## 3. Visual & Audio Feedback

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

---

## 4. 3D Visual Style

### Lighting Setup

| Light Type | Use Case | Performance |
|------------|----------|-------------|
| `ambient` | Base fill, no harsh shadows | Cheap |
| `directional` | Sun/moon, primary shadows | Medium |
| `point` | Lamps, local highlights | Expensive |
| `spot` | Flashlight, focused areas | Expensive |

### Lighting Checklist

- [ ] One primary directional light (sun) for main shadows
- [ ] Ambient light for fill (prevent pure black areas)
- [ ] Max 4 dynamic lights total (Quest budget)
- [ ] Bake lighting for static geometry when possible

### Shadows

| Type | When to Use | Performance |
|------|-------------|-------------|
| **Real-time** | Moving objects, player, enemies | Expensive |
| **Baked** | Static environment | Free at runtime |
| **Blob shadow** | Simple circular shadow under characters | Cheap |

### Shadow Checklist

- [ ] Player and enemies cast shadows (essential for depth perception)
- [ ] Shadow map resolution appropriate for platform (512-1024 Quest)
- [ ] Shadow bias tuned (no shadow acne or peter-panning)
- [ ] Distant objects use blob shadows or none

### Reflections

| Type | Use Case | Performance |
|------|----------|-------------|
| **Environment Map** | Metal, glass, water surfaces | Medium |
| **Planar Reflection** | Mirrors, flat water | Expensive |
| **Baked Cubemap** | Static reflections | Cheap |

- [ ] Use baked cubemaps for static environments
- [ ] Limit real-time reflections to 1-2 surfaces
- [ ] No SSR on Quest (too expensive)

### Quest Material Optimization (MANDATORY)

> **Rule:** Material choice is a BLOCKING performance gate. Wrong materials = reject.

#### Static Surfaces — `shader: flat`
```html
<!-- Floors, walls, ceilings, backgrounds, menu panels -->
<a-plane material="shader: flat; color: #111133"></a-plane>
```
- **MUST** use `shader: flat` for all non-interactive static geometry
- Eliminates per-fragment lighting (10-15% GPU savings)
- Applies to: floors, walls, arena barriers, sky, menu backgrounds

#### Dynamic/Interactive Objects — Emissive Glow
```html
<!-- Targets, weapons, grabbables, buttons -->
<a-entity material="color: #ff6644; emissive: #331100; emissiveIntensity: 0.4"></a-entity>
```
- Use `emissive` property for glow effects
- **NEVER** spawn point lights for visual glow — use emissive materials
- `emissiveIntensity: 0.3-0.6` provides visibility without bloom dependency

#### UI Elements — Opaque Only
```html
<!-- HUD, menus, buttons, panels -->
<a-plane material="shader: flat; color: #164016"></a-plane>
```
- **NEVER** use `transparent: true` on UI panels
- **NEVER** use `opacity < 1` on large surfaces
- Use layered opaque planes instead of transparency

#### Forbidden Material Patterns

| ❌ Pattern | Problem | ✅ Fix |
|-----------|---------|--------|
| `shader: standard` on floors | Unnecessary PBR | `shader: flat` |
| `opacity: 0.5` on panels | Alpha blending | Solid dark color |
| Point light for glow | +1 draw call per light | Emissive material |
| Multiple transparent layers | Overdraw multiplier | Single opaque |
| `metalness: 1` without envMap | Black surfaces | Lower metalness |

#### Material Checklist (BLOCKING)

- [ ] All static geometry uses `shader: flat`
- [ ] No point/spot lights for visual glow (use emissive)
- [ ] UI panels are 100% opaque
- [ ] Interactive objects use emissive for visibility
- [ ] No transparency on surfaces > 1m²

---

## 5. Performance Budget

### Target Platforms

| Platform | Design Target | Minimum | Resolution |
|----------|---------------|---------|------------|
| Quest 2/3 | **80 fps** | 60 fps | Eye buffer resolution |
| Desktop VR | 90 fps | 72 fps | HMD native |
| Desktop flat | 60 fps | 30 fps | 1080p |

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

---

## 6. GC-Free Coding Patterns (CRITICAL)

Every frame, V8 checks for garbage. Allocations in `tick()` cause GC spikes → frame drops.

### BAD: Allocations in tick()

```javascript
tick: function(time, delta) {
  var direction = new THREE.Vector3();  // GC every frame!
  this.positionHistory.push({           // Object every frame!
    position: currentPos.clone(),
    time: performance.now()
  });
}
```

### GOOD: Pre-allocated + Circular Buffer

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

### GOOD: Cached DOM Queries

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

---

## 7. Interactivity

### Interaction Types

| Type | Examples |
|------|----------|
| Combat | Shoot, melee, throw |
| Environment | Push, pull, destroy, toggle |
| Collect | Pickup items, resources |
| Puzzle | Combine, sequence, physics |

### Checklist (Interactivity)

- [ ] Each area has 2-3 interaction types minimum
- [ ] Grabbable objects clearly indicated (glow, outline)
- [ ] Destructible/interactive environment elements

---

## 8. Accessibility

### Required (Minimum Viable)

- [ ] Motion blur OFF by default (VR comfort)
- [ ] Head bob OFF by default (VR comfort)
- [ ] Subtitles for dialogue/audio cues
- [ ] Controller remapping (where feasible)

### VR Comfort Modes

| Mode | Description |
|------|-------------|
| Teleport | Instant position change |
| Snap Turn | 30°/45°/90° rotation |
| Vignette | Peripheral blackout during movement |

---

## 9. Definition of Done (Feature Checklist)

Every feature must pass before merge:

### Player Experience
- [ ] Player-facing change documented in PR
- [ ] Does not break existing camera/controls
- [ ] Has visual + audio feedback on interaction

### Technical
- [ ] No significant FPS drop on test scene
- [ ] Code follows module structure
- [ ] No memory leaks introduced

### Quality
- [ ] Test checklist provided: 3-5 steps + expected result
- [ ] Edge cases handled

---

## Quick Reference

### Priority Order
1. **UX** — Does it feel good to play?
2. **Performance** — Does it run smoothly?
3. **Extensibility** — Can we build on it?

### Immediate Feedback Triad
Every action needs: **Visual + Audio + Haptic**

### Performance Gate
Design for **80+ FPS on Quest** — ensures smooth 90Hz experience.

---

**See also:** `.claude/rules/performance.md`, `specs/architecture.md`
