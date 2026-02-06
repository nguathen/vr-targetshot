# Task Management

> Last Updated: 2026-02-05
> Purpose: Active work queue. Keep this file short.
> [View Completed Tasks Archive](./tasks-archive.md)

---

## Overview

| Status | Count |
|--------|-------|
| In Progress | 0 |
| Pending | 1 |
| Completed | 222 |

> V1–V13 — all completed (68 tasks).
> **V14 Content & QoL Upgrade (TASK-270~277)** — completed.
> **V15 Production Hardening & UX Polish (TASK-280~286)** — completed.
> **V16 Gameplay Engagement (TASK-287~291)** — completed.
> **V17 Player Retention & Social (TASK-292~296)** — completed.
> **V18 Reflex Mastery (TASK-300~304)** — completed.
> **V19 Adrenaline Surge (TASK-310~314)** — completed.
> **V20 Visual & Interaction Upgrade (TASK-320~323)** — completed.
> **V21 Audio & Visual Polish (TASK-330~333)** — completed.
> **V22 3D Graphics Upgrade (TASK-340~342)** — completed.
> **V23 Tension & Thrill (TASK-350~355)** — completed.
> **V24 Graphics Polish (TASK-360~362)** — completed.
> **V25 VFX Enhancement (TASK-363~365)** — completed.
> **V26 Game Feel & Audio Polish (TASK-366~368)** — completed.
> **V27 God Class Refactoring (TASK-370~373)** — completed.
> **V28 Performance Optimization (TASK-380~400)** — completed.
> **V29 Runtime FPS Fix (TASK-401~407)** — completed.
> **V30 CSS Performance Fix (TASK-410~414)** — completed.
> **V31 Quest Emergency FPS Fix (TASK-420~428)** — completed.
> **V32 Ultra Performance Mode (TASK-430~439)** — completed.
> **V33 CSS DOM Elimination (TASK-440~444)** — completed.
> **V34 A-Frame Renderer & Raycaster (TASK-445~449)** — completed.
> **V35 Ultra-Simplified Targets (TASK-450~455)** — completed.
> **V36 Environment & tick() Optimization (TASK-456~460)** — completed.
> **V37 Deep tick() & Draw Call Optimization (TASK-461~462)** — completed.
> **V42 Final Quest Polish (TASK-470~472)** — completed.
> **V43 VR Loading Indicator (TASK-480~482)** — pending.

---

## V43 — VR Loading Indicator (Meta VRC.Quest.Performance.3 Fix)

> **Goal:** Pass Meta Quest Store review by showing head-tracked loading indicator within 4 seconds of launch.
> **Issue:** ISSUE-021 — App rejected because no VR loading content visible during startup.
> **Strategy:** Create an A-Frame `vr-loading-screen` component that renders a head-tracked 3D loading scene immediately when the A-Frame scene initializes, before any game assets load.

### Design

**Architecture Decision: In-Scene A-Frame Loading Indicator**

The loading indicator must be **head-tracked** (rendered in WebXR stereo view, moves with head rotation). A 2D HTML overlay does NOT satisfy the requirement.

**Approach:**
- Register `vr-loading-screen` A-Frame component on the `<a-scene>` element
- In `init()`: create a minimal 3D loading scene (camera-space HUD with spinner + text)
- The loading entities are children of the camera, so they're always in front of the user
- Animated via `tick()` (simple rotation, no allocations)
- Listens for a custom event `game:ready` → fade out and remove
- Must work on both `index.html` (menu) and `game.html` (direct game launch)

**Visual Design (minimal draw calls):**
```
[Camera space, z=-2]
  - "VR QUEST" text (a-text, flat)
  - Spinning ring (a-torus, flat shader, rotation animation)
  - "Loading..." text (a-text, flat)
```

**Performance:** 3 entities, all `shader: flat`, 1 rotation in tick() (pre-allocated). ~0 draw call overhead.

---

### TASK-480: Create `vr-loading-screen` A-Frame component ✅
**Priority:** Critical
**Status:** Completed (2026-02-06)
**Assigned:** /dev

#### Description
Create a new A-Frame component `vr-loading-screen` that displays a head-tracked 3D loading indicator in VR. This component attaches loading entities to the camera so they're always visible regardless of head orientation.

#### Scope
- **New file:** `client/src/js/components/vr-loading-screen.js`

#### Implementation Details
1. Register `AFRAME.registerComponent('vr-loading-screen', {...})`
2. In `init()`:
   - Create a container `a-entity` and parent it to the scene's camera (`[camera]` or `#camera`)
   - Add child entities (all using `shader: flat`):
     - `a-text` — "VR QUEST" title, position `0 0.3 -2`, color `#00ff88`
     - `a-torus` — Loading spinner, position `0 0 -2`, radius `0.15`, tube `0.01`, flat shader, color `#00ff88`
     - `a-text` — "Loading..." subtitle, position `0 -0.3 -2`, color `#aaaaaa`
   - Set `this._spinner` reference for tick rotation
   - Pre-allocate rotation: `this._rotation = {x: 0, y: 0, z: 0}`
3. In `tick(time, delta)`:
   - Rotate spinner: `this._rotation.z += delta * 0.18` (slow spin)
   - Apply via `this._spinner.object3D.rotation.z = this._rotation.z` (no allocation)
4. Listen for `'vr-loading-screen:dismiss'` event on `this.el`:
   - Fade out container (animate opacity or just remove)
   - Remove all loading entities
   - Remove component from element
5. In `remove()`:
   - Clean up all created entities
   - Remove event listeners

#### GC-Free Compliance
- Pre-allocate rotation value in `init()`
- No `new THREE.*` in `tick()`
- No DOM queries in `tick()`

#### Acceptance Criteria
- [x] Component creates head-tracked 3D loading scene
- [x] Loading spinner animates smoothly
- [x] All entities use `shader: flat`
- [x] Properly cleans up on dismiss/remove
- [x] No GC allocations in tick()

---

### TASK-481: Integrate `vr-loading-screen` into index.html and game.html ✅
**Priority:** Critical
**Status:** Completed (2026-02-06)
**Assigned:** /dev

#### Description
Add the `vr-loading-screen` component to both HTML entry points so the VR loading indicator appears immediately when the A-Frame scene initializes.

#### Scope
- `client/src/index.html` — Add script tag + component attribute
- `client/src/game.html` — Add script tag + component attribute

#### Implementation Details

**Both files:**
1. Add `<script src="./js/components/vr-loading-screen.js"></script>` BEFORE the `<a-scene>` tag (but AFTER `aframe.min.js`)
2. Add `vr-loading-screen` attribute to `<a-scene>`:
   - `index.html`: `<a-scene id="scene" vr-loading-screen ...>`
   - `game.html`: `<a-scene id="game-scene" vr-loading-screen ...>`

**Dismiss trigger:**
3. In `client/src/js/main.js` — After menu is ready, emit dismiss:
   ```javascript
   document.querySelector('a-scene').emit('vr-loading-screen:dismiss');
   ```
4. In `client/src/js/game-main.js` — After game scene is ready (scene 'loaded' event + initial setup), emit dismiss:
   ```javascript
   document.querySelector('a-scene').emit('vr-loading-screen:dismiss');
   ```

**Key: The dismiss must fire AFTER the scene has enough content to render.** If dismissed too early, user sees empty black screen again.

#### Acceptance Criteria
- [x] Loading indicator visible on both index.html and game.html
- [x] Appears immediately when A-Frame scene initializes
- [x] Dismissed when page-specific content is ready
- [x] Does NOT interfere with existing loading-screen (HTML overlay for flat mode)
- [x] Script loaded before `<a-scene>` so component is registered in time

#### Integration Impact
- `client/src/js/main.js` — Add dismiss emit
- `client/src/js/game-main.js` — Add dismiss emit

---

### TASK-482: Verify VR loading indicator timing meets 4-second requirement
**Priority:** Critical
**Status:** Pending (requires device testing)
**Assigned:** /dev

#### Description
Test and verify that the VR loading indicator appears within 4 seconds of app launch on Quest. Adjust if needed.

#### Scope
- Test on Quest 2/3 device via `quest-deploy.ps1`
- Measure time from APK launch to first head-tracked frame

#### Test Plan
1. Build and deploy to Quest: `.\quest-deploy.ps1`
2. Force-close app, then launch from Quest home
3. Start timer when app icon is tapped
4. Confirm: head-tracked loading spinner visible within 4 seconds
5. Confirm: loading spinner dismisses and game content appears
6. Repeat 3 times to verify consistency

#### Fallback if 4s not met
If A-Frame CDN load takes too long (>3s):
- **Option A:** Bundle A-Frame locally instead of CDN (eliminates network latency)
- **Option B:** Add an OS-level splash with `com.oculus.ossplash` meta-data in AndroidManifest.xml (already partially configured: `com.oculus.ossplash.background: passthrough-contextual`)

#### Acceptance Criteria
- [ ] Head-tracked content visible within 4 seconds on Quest 2
- [ ] Head-tracked content visible within 4 seconds on Quest 3
- [ ] Consistent across 3+ test launches
- [ ] Pass Meta VRC.Quest.Performance.3 on re-submission

---

## V42 — Final Quest Polish (80 FPS → 90 FPS)

> **Goal:** Disable remaining animated decorations and simplify floor for stable 90 FPS.
> **Current State:** FPS at 80. Remaining overhead: spinning torus rings, corner pillars, complex floor.
> **Strategy:** Remove/hide decorative torus, pillars, simplify floor to flat shader.
> **Expected Impact:** -10~15 draw calls, eliminate animation tick overhead.

### Element Analysis

| Element | Count | Issue | Fix |
|---------|-------|-------|-----|
| Animated torus | 5 | Spinning animations | Remove on Quest |
| Arena pillars | 4 | Cylinder + torus each | Remove on Quest |
| Platform surface | 1 | PBR material | Flat shader |
| Floor grid | 1 | Wireframe overlay | Remove on Quest |

---

### TASK-470: Disable spinning torus rings on Quest ✅
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

#### Description
Disable all `a-torus` elements with animation on Quest to reduce draw calls and animation overhead.

#### Scope
- `client/src/index.html` - Add Quest check to remove/hide torus elements:
  - Line ~347: Large decorative torus at (0, 4.5, -12)
  - Lines ~475-480: Under-glow rings (`.under-glow-ring`)
  - Lines ~483-488: Floor glow rings (direct `a-torus` in game-content)

#### Acceptance Criteria
- [x] All animated torus removed/hidden on Quest
- [x] No console errors
- [x] Desktop unchanged

#### Implementation
- Added to V40 cleanup block (line 85-88): `document.querySelectorAll('a-torus').forEach(el => el.remove())`

---

### TASK-471: Disable corner pillar decorations on Quest ✅
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

#### Description
Remove corner pillar entities (`.arena-pillar`) on Quest - they add 4 cylinders + 4 torus.

#### Scope
- `client/src/index.html` - Add to Quest cleanup:
  - Lines ~529-560: 4 arena pillars at corners (±14, 0, ±14)
  - Use `document.querySelectorAll('.arena-pillar').forEach(el => el.remove())`

#### Acceptance Criteria
- [x] All 4 arena pillars removed on Quest
- [x] No console errors
- [x] Desktop unchanged

#### Implementation
- Added to V40 cleanup block (line 89-92): `document.querySelectorAll('.arena-pillar').forEach(el => el.remove())`

---

### TASK-472: Simplify floor to flat shader on Quest ✅
**Priority:** Medium
**Status:** Completed (2026-02-05)
**Assigned:** /dev

#### Description
Change `#platform-surface` to use `shader: flat` on Quest to eliminate PBR calculations.

#### Scope
- `client/src/index.html` - Quest check to override:
  - `#platform-surface`: change to `material="shader: flat; color: #111122"`
  - `#floor-grid`: remove entirely

#### Acceptance Criteria
- [x] Floor uses flat shader on Quest
- [x] Grid removed on Quest
- [x] No visual gaps or holes

#### Implementation
- Added to V40 cleanup block (line 93-100):
  - `floor.setAttribute('material', 'shader: flat; color: #111122')`
  - `if (grid) grid.remove()`

---

## V37 — Deep tick() & Draw Call Optimization (40 FPS → 90 FPS)

> **Goal:** Eliminate remaining tick() overhead and draw calls from weapon model.
> **Current State:** weapon-model creates 5-10 entities per weapon with shadow casting. shoot-controls tick() runs 2x/frame.
> **Strategy:** Disable weapon-model on Quest, throttle shoot-controls tick().
> **Expected Impact:** -5~10 draw calls, 67% reduction in shoot-controls tick() overhead.

### Component Analysis (Quest)

| Component | Issue | V37 Fix | Savings |
|-----------|-------|---------|---------|
| weapon-model.js | 5-10 entities/weapon | Disable on Quest | -5~10 draw calls |
| shoot-controls.js | tick() 2x/frame | Throttle to every 3rd | 67% reduction |

---

## TASK-461: Disable weapon-model on Quest ✅
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
weapon-model.js creates 5-10 child entities (a-box, a-sphere, a-cylinder) per weapon with `shadow: cast: true`. On Quest, this adds significant draw call overhead.

### Acceptance Criteria
- [x] Add Quest detection to weapon-model.js
- [x] Early return in init() if Quest detected
- [x] Verify: No weapon visual on Quest (functionality unchanged)

### Files Changed
- `client/src/js/components/weapon-model.js`

### Performance Impact
- Expected: **-5~10 draw calls per weapon**

---

## TASK-462: Throttle shoot-controls tick() on Quest ✅
**Priority:** Medium
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
shoot-controls.js tick() runs on both hands (2x per frame) doing idle sway calculations. On Quest, can throttle to every 3rd frame.

### Acceptance Criteria
- [x] Add frame counter `_frameCount` in init()
- [x] Add throttle check in tick(): `if (_isQuest && this._frameCount++ % 3 !== 0) return;`
- [x] Verify: Shooting still works, just less frequent sway updates

### Files Changed
- `client/src/js/components/shoot-controls.js`

### Performance Impact
- Expected: **67% reduction in tick() overhead (2x/frame → 0.67x/frame)**

---

## V36 — Environment & tick() Optimization (40 FPS → 90 FPS)

> **Goal:** Fix remaining tick() GC issues and simplify environment for Quest.
> **Current State:** hand-shield.js has 2 GC allocations/frame. Environment has large floor + 4 walls.
> **Strategy:** Fix GC, reduce floor size, remove arena walls on Quest.
> **Expected Impact:** Eliminate GC pauses, reduce draw calls by 4.

### Environment Analysis (Quest)

| Element | Current | V36 Target | Savings |
|---------|---------|------------|---------|
| Floor plane | 100×100 | 30×30 | 90% fewer vertices |
| Arena walls | 4 boxes | 0 (remove) | -4 draw calls |
| hand-shield tick() | 2 GC/frame | 0 GC | Eliminate GC pauses |

---

## TASK-456: Fix hand-shield.js GC Allocations ✅
**Priority:** Critical
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
`hand-shield.js` tick() creates 2 new THREE.Vector3() every frame (lines 49-50). At 90 FPS = 180 allocations/sec → GC pauses.

### Acceptance Criteria
- [ ] Pre-allocate `_camPos` and `_handPos` vectors in init()
- [ ] Reuse vectors in tick() via `.getWorldPosition(this._camPos)`
- [ ] Verify: No `new THREE` in tick()

### Files Changed
- `client/src/js/components/hand-shield.js`

### Performance Impact
- Expected: **Eliminate GC pauses from this component**

---

## TASK-457: Reduce Floor Plane Size on Quest ✅
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Floor plane is 100×100 but player can only move within ±14m (line 62-63 smooth-locomotion.js). 90% of floor is never visible.

### Acceptance Criteria
- [ ] In V34 Quest script (game.html), reduce floor size from 100×100 to 30×30
- [ ] Verify: Floor still covers playable area
- [ ] No visual gaps at arena edges

### Files Changed
- `client/src/game.html` (Quest script)

### Performance Impact
- Expected: **90% fewer floor vertices, less overdraw**

---

## TASK-458: Remove Arena Walls on Quest ✅
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
4 arena wall boxes at ±15m add 4 draw calls but are rarely visible. Player movement is already clamped by smooth-locomotion.js.

### Acceptance Criteria
- [ ] In V34 Quest script (game.html), remove arena wall boxes
- [ ] Verify: Player movement still clamped to ±14m (handled by smooth-locomotion)
- [ ] No gameplay impact

### Files Changed
- `client/src/game.html` (Quest script)

### Performance Impact
- Expected: **-4 draw calls**

---

## TASK-459: Disable hand-shield on Quest ✅
**Priority:** Medium
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
hand-shield component still runs tick() on Quest even after GC fix. Shield mechanic may be unnecessary overhead on Quest.

### Acceptance Criteria
- [ ] Add Quest check in hand-shield.js init() to skip component entirely:
  ```javascript
  if (_isQuest) { console.log('[hand-shield] Disabled on Quest'); return; }
  ```
- [ ] Verify: No shield visual or tick() on Quest

### Files Changed
- `client/src/js/components/hand-shield.js`

### Performance Impact
- Expected: **Eliminate tick() overhead from this component**

---

## TASK-460: Throttle target-indicator on Quest ✅
**Priority:** Medium
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
target-indicator runs every frame to show off-screen target arrows. Could throttle to every 3rd frame on Quest.

### Acceptance Criteria
- [ ] Add Quest check with frame throttle in tick():
  ```javascript
  if (_isQuest && this._frameCount++ % 3 !== 0) return;
  ```
- [ ] Verify: Arrows still update, just less frequently

### Files Changed
- `client/src/js/components/target-indicator.js`

### Performance Impact
- Expected: **67% reduction in tick() overhead**

---

## V35 — Ultra-Simplified Targets for Quest (40 FPS → 90 FPS)

> **Goal:** Simplify target rendering to achieve 90 FPS on Quest.
> **Current State:** Each target has 3-4 meshes (body + wireframe + indicators). With 4 targets = 12-16 draw calls.
> **Strategy:** On Quest: single primitive, flat shader, no child elements, no shadows.
> **Expected Impact:** 4 targets × 1 mesh = 4 draw calls (75% reduction)

### Target Complexity Analysis

| Component | Desktop | Quest (V35) | Savings |
|-----------|---------|-------------|---------|
| Main mesh | Standard material | Flat shader | -PBR calc |
| 3D model children | 2-4 meshes | Skip entirely | -3 draw calls |
| Wireframe overlay | Yes | Skip | -1 draw call |
| Height indicator | Yes | Skip | -1 draw call |
| Timing ring | Yes | Skip | -1 draw call |
| Shadow casting | Yes | No | -shadow pass |
| Spawn animation | Complex | Simple | -animation |

---

## TASK-450: Skip 3D Models on Quest — Use Flat Primitives
**Priority:** Critical
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
`target-models.js` creates complex 3D models with `MeshStandardMaterial` (PBR). Each model has 2-4 child meshes. On Quest, skip 3D models entirely and use simple A-Frame primitives with `shader: flat`.

### Acceptance Criteria
- [x] In `target-spawner.js`, detect Quest and skip `targetModels.getTargetModel()`:
  ```javascript
  const use3DModels = !_isQuest && settings.targetModels !== false && targetModels.isReady();
  ```
- [x] When skipping 3D models, use `shader: flat` instead of standard material
- [x] Verify: No MeshStandardMaterial on Quest targets

### Files Changed
- `client/src/js/game/target-spawner.js` (line 196)

### Performance Impact
- Expected: **-3 draw calls per target**, eliminate PBR calculations

---

## TASK-451: Remove Wireframe Overlay on Quest
**Priority:** Critical
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Each target spawns a wireframe child element for visual effect (lines 519-539 in target-spawner.js). This adds +1 draw call per target. Skip on Quest.

### Acceptance Criteria
- [x] In `_applyPrimitiveMaterial()`, check `_isQuest` and skip wireframe creation
- [x] Skip wireframe for ALL target types on Quest (including decoy)
- [x] Verify: No wireframe child elements on Quest

### Files Changed
- `client/src/js/game/target-spawner.js` (lines 519-539)

### Performance Impact
- Expected: **-1 draw call per target**

---

## TASK-452: Remove Height Indicators on Quest
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Floor/overhead targets spawn indicator elements (ring on floor, beam for overhead). These are +1 draw call each. Skip on Quest.

### Acceptance Criteria
- [x] In `spawnTargetAt()`, check `_isQuest` and skip height indicator creation
- [x] Still set `el._heightZone` for scoring logic
- [x] Verify: No height indicator elements on Quest

### Files Changed
- `client/src/js/game/target-spawner.js` (lines 395-429)

### Performance Impact
- Expected: **-1 draw call per floor/overhead target**

---

## TASK-453: Remove Timing Rings on Quest
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Rhythm targets spawn timing ring indicators (lines 372-390). Skip on Quest.

### Acceptance Criteria
- [x] In `spawnTargetAt()`, check `_isQuest` before creating timing ring
- [x] Still track rhythm data (`el._rhythmTarget`, `el._beatSpawnTime`) for scoring
- [x] Verify: No timing ring elements on Quest

### Files Changed
- `client/src/js/game/target-spawner.js` (lines 368-390)

### Performance Impact
- Expected: **-1 draw call per rhythm target**

---

## TASK-454: Remove Shadow Casting on Quest
**Priority:** Critical
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Line 517 sets `shadow: cast: true` on targets. Even with scene shadow disabled, this attribute may cause overhead. Remove on Quest.

### Acceptance Criteria
- [x] In `_applyPrimitiveMaterial()`, skip shadow attribute entirely on Quest
- [x] Also skip in line 199 (when using 3D models)
- [x] Verify: No shadow attribute on Quest targets

### Files Changed
- `client/src/js/game/target-spawner.js` (lines 199, 517)

### Performance Impact
- Expected: Eliminate shadow pass overhead

---

## TASK-455: Use Flat Shader Material for Quest Targets
**Priority:** Critical
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Replace `MeshStandardMaterial` properties with `shader: flat` for Quest. Use bright colors for visibility without PBR.

### Acceptance Criteria
- [x] Create Quest-specific material in `_applyPrimitiveMaterial()`:
  ```javascript
  if (_isQuest) {
    el.setAttribute('material', `shader: flat; color: ${color}`);
  } else {
    el.setAttribute('material', `color: ${color}; metalness: ...`);
  }
  ```
- [x] Ensure target colors are bright enough without emissive
- [x] Verify: All Quest targets use `shader: flat`

### Files Changed
- `client/src/js/game/target-spawner.js` (function `_applyPrimitiveMaterial`)

### Performance Impact
- Expected: **Eliminate per-fragment PBR calculations** (~15% GPU savings)

---

## V31 — Quest Emergency FPS Fix (40 FPS → 90 FPS)

> **Goal:** Achieve 90 FPS on Quest 2/3 by cutting ALL expensive features by 50% or disabling entirely.
> **Current State:** FPS = 40 despite V28-V30 optimizations. Root cause: cumulative overhead from many systems.
> **Strategy:** Aggressive cuts — disable shadows, weather, music, arena reactions, shockwaves on Quest.
> **Ref:** TechLead analysis 2026-02-05

### Performance Budget (Quest 2)

| Resource | Current | Target | Action |
|----------|---------|--------|--------|
| Dynamic Lights | 2 | 2 | ✅ Keep |
| Shadows | 1 (PCFSoft) | **0** | ❌ Remove |
| Max Targets | 8 | **4** | 50% cut |
| Particles/kill | 8 | **4** | 50% cut |
| Weather particles | 100 | **0** | Disable |
| Music oscillators | 8 | **0** | Disable |
| Shockwave/kill | 1 | **0** | Disable |
| Environment pulse | Yes | **No** | Disable |
| Arena reactions | Yes | **No** | Disable |
| Dissolve shader | Yes | **No** | Disable |

---

## TASK-420: Disable Shadows on Quest
**Priority:** Critical
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
PCF soft shadows require 5-9 texture samples per fragment. On Quest, this is the #1 GPU bottleneck. Disable shadows entirely on Quest/mobile.

### Acceptance Criteria
- [ ] In `game.html`, detect Quest/mobile before scene loads:
  ```javascript
  if (/Quest|Android|Mobile/i.test(navigator.userAgent)) {
    document.querySelector('a-scene').removeAttribute('shadow');
  }
  ```
- [ ] Alternative: Add `shadow="enabled: false"` dynamically
- [ ] Floor still receives no shadows (already `shader: flat`)
- [ ] Verify: No shadow map rendering on Quest

### Files Changed
- `client/src/game.html` (add inline script before a-scene)

### Performance Impact
- Expected FPS improvement: **+15-25** on Quest

---

## TASK-421: Disable Weather System on Quest
**Priority:** Critical
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Weather particles (rain, dust, bubbles, stars) run 100-200 particles per frame. Disable entirely on Quest.

### Acceptance Criteria
- [ ] In `weather-system.js`, add Quest detection in `start()`:
  ```javascript
  if (/Quest|Android|Mobile/i.test(navigator.userAgent)) {
    console.log('[weather] Disabled on Quest');
    return;
  }
  ```
- [ ] Do not spawn any weather particle entities on Quest
- [ ] Verify: No weather particles visible on Quest

### Files Changed
- `client/src/js/game/weather-system.js`

### Performance Impact
- Expected FPS improvement: **+5-10** on Quest

---

## TASK-422: Disable Arena Reactions on Quest
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Arena reactions animate barriers, lights, and platform on every kill. This creates animation overhead and light intensity changes.

### Acceptance Criteria
- [ ] In `arena-reactions.js`, add Quest detection at top:
  ```javascript
  const _isQuest = /Quest|Android|Mobile/i.test(navigator.userAgent);
  ```
- [ ] In all reaction methods, early return if `_isQuest`
- [ ] Verify: No arena light/barrier animations on Quest

### Files Changed
- `client/src/js/game/arena-reactions.js`

### Performance Impact
- Expected FPS improvement: **+3-5** on Quest

---

## TASK-423: Disable Shockwave + Environment Pulse on Kill (Quest)
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Each kill spawns 1 a-ring shockwave (4 animations) + triggers `_pulseEnvironment()` animating multiple elements. Disable on Quest.

### Acceptance Criteria
- [ ] In `target-hit.js`, add Quest detection:
  ```javascript
  const _isQuest = /Quest|Android|Mobile/i.test(navigator.userAgent);
  ```
- [ ] In `_onHit()`, skip `_spawnShockwave()` if `_isQuest`
- [ ] In `_onHit()`, skip `_pulseEnvironment()` if `_isQuest`
- [ ] Keep: target white flash (lines 80-82) — zero cost
- [ ] Keep: particle burst — already optimized
- [ ] Verify: No shockwave rings or environment pulses on Quest

### Files Changed
- `client/src/js/components/target-hit.js`

### Performance Impact
- Expected FPS improvement: **+5-8** on Quest

---

## TASK-424: Disable Adaptive Music on Quest
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Music system uses 8 Web Audio oscillators + filters. Even idle, this consumes CPU for audio graph processing.

### Acceptance Criteria
- [ ] In `music-manager.js`, add Quest detection:
  ```javascript
  const _isQuest = /Quest|Android|Mobile/i.test(navigator.userAgent);
  ```
- [ ] In `start()`, early return if `_isQuest`
- [ ] In `setIntensity()`, early return if `_isQuest`
- [ ] SFX (audio-manager.js) remain enabled — they are event-driven
- [ ] Verify: No music playing on Quest

### Files Changed
- `client/src/js/core/music-manager.js`

### Performance Impact
- Expected FPS improvement: **+3-5** on Quest

---

## TASK-425: Reduce Max Targets to 4 on Quest
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
With 8 max targets, each having animations + materials + collision, the scene gets heavy. Reduce to 4 on Quest.

### Acceptance Criteria
- [ ] In `game-main.js` `_initRound()`, detect Quest and override config:
  ```javascript
  const isQuest = /Quest|Android|Mobile/i.test(navigator.userAgent);
  const maxTargets = isQuest ? 4 : 8;
  ```
- [ ] Pass `maxTargets` to TargetSystem constructor
- [ ] Verify: Never more than 4 active targets on Quest

### Files Changed
- `client/src/js/game-main.js`

### Performance Impact
- Expected FPS improvement: **+5-10** on Quest

---

## TASK-426: Reduce Particle Burst to 4 on Quest
**Priority:** Medium
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Kill particles already reduced from 15→8, but 8 GPU particles per kill × 4 targets = 32 particles. Reduce to 4 on Quest.

### Acceptance Criteria
- [ ] In `target-hit.js`, add Quest-aware counts:
  ```javascript
  const isQuest = /Quest|Android|Mobile/i.test(navigator.userAgent);
  const counts = isQuest
    ? { standard: 4, heavy: 6, bonus: 5, decoy: 3, speed: 4, powerup: 4 }
    : { standard: 8, heavy: 12, bonus: 10, decoy: 5, speed: 9, powerup: 9 };
  ```
- [ ] Verify: Smaller but still visible particle bursts on Quest

### Files Changed
- `client/src/js/components/target-hit.js`

### Performance Impact
- Expected FPS improvement: **+2-3** on Quest

---

## TASK-427: Disable Dissolve Effect on Quest
**Priority:** Medium
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Dissolve shader runs Perlin noise calculation per fragment. On Quest, use instant removal instead.

### Acceptance Criteria
- [ ] In `target-hit.js`, force `useDissolve = false` on Quest:
  ```javascript
  const isQuest = /Quest|Android|Mobile/i.test(navigator.userAgent);
  const useDissolve = !isQuest && settings.dissolveEffect !== false;
  ```
- [ ] Targets shrink/remove instantly instead of dissolving
- [ ] Verify: No dissolve shader on Quest

### Files Changed
- `client/src/js/components/target-hit.js`

### Performance Impact
- Expected FPS improvement: **+2-3** on Quest

---

## TASK-428: Remove Decorative Geometry on Quest
**Priority:** Low
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
4 decorative pillars + wireframe floor grid add 5+ draw calls. Remove on Quest.

### Acceptance Criteria
- [ ] In `game.html`, wrap decorative elements with Quest detection:
  ```javascript
  if (/Quest|Android|Mobile/i.test(navigator.userAgent)) {
    document.querySelectorAll('a-cylinder').forEach(el => el.remove());
    document.getElementById('floor-grid')?.remove();
  }
  ```
- [ ] Alternative: Add `.quest-hidden` class and CSS `display:none`
- [ ] Verify: No pillars or grid lines on Quest

### Files Changed
- `client/src/game.html`

### Performance Impact
- Expected FPS improvement: **+2-5** on Quest

---

### V31 Summary

| Task | Feature Disabled | Expected FPS Gain |
|------|------------------|-------------------|
| TASK-420 | Shadows | +15-25 |
| TASK-421 | Weather | +5-10 |
| TASK-422 | Arena Reactions | +3-5 |
| TASK-423 | Shockwave + Env Pulse | +5-8 |
| TASK-424 | Music | +3-5 |
| TASK-425 | Max Targets 8→4 | +5-10 |
| TASK-426 | Particles 8→4 | +2-3 |
| TASK-427 | Dissolve Shader | +2-3 |
| TASK-428 | Decorative Geometry | +2-5 |
| **TOTAL** | | **+42-74 FPS** |

**Target:** 40 + 50 = **90 FPS** ✓

---

## V29 — Runtime FPS Fix (CRITICAL — Kill Effects Causing 40 FPS)

> **Goal:** Fix actual gameplay FPS from ~40 to 90+ on Quest 2/3.
> **Root Cause Analysis:** target-hit.js spawns 4-5 entities + 1 point light per kill.
> **Ref:** TechLead analysis 2026-02-05

## TASK-401: Remove Flash Point Light from Kill Effects
**Priority:** Critical
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
`target-hit.js:200-215` creates a **new point light** for EVERY kill via `_spawnFlashLight()`. This violates the 4-light budget and causes severe FPS drops during rapid kills. Light = +1 draw call + per-fragment lighting calculation.

### Acceptance Criteria
- [ ] Remove `_spawnFlashLight()` function entirely (lines 200-215)
- [ ] Remove call to `_spawnFlashLight()` in `_onHit()` (line 88)
- [ ] Replace visual feedback with emissive flash on `_spawnCoreFlash()` sphere (already exists)
- [ ] Verify: no point lights created during target destruction
- [ ] Profile: Kill should not add any lights to scene

### Files Changed
- `client/src/js/components/target-hit.js`

### Performance Impact
- Expected FPS improvement: **+15-20** on Quest

---

## TASK-402: Remove Secondary Shockwave Effect
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
`target-hit.js:129-131` spawns a SECOND shockwave ring 80ms after the first. Each shockwave = 1 a-ring entity + 3 animations. Redundant visual that costs performance.

### Acceptance Criteria
- [ ] Remove secondary shockwave spawn (lines 129-131)
- [ ] Keep primary shockwave (sufficient visual feedback)
- [ ] Verify: only 1 shockwave ring per kill

### Files Changed
- `client/src/js/components/target-hit.js`

### Performance Impact
- Expected FPS improvement: **+3-5** on Quest

---

## TASK-403: Simplify Core Flash Effect
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
`_spawnCoreFlash()` (lines 217-239) creates a-sphere with 2 animations. Combined with shockwave and particles, this is 3+ entities per kill. Simplify to material flash only on target itself.

### Acceptance Criteria
- [ ] Remove `_spawnCoreFlash()` function entirely
- [ ] Remove call in `_onHit()` (line 91)
- [ ] Existing target flash (lines 77-82) provides sufficient visual feedback
- [ ] Verify: no core flash sphere spawned

### Files Changed
- `client/src/js/components/target-hit.js`

### Performance Impact
- Expected FPS improvement: **+3-5** on Quest

---

## TASK-404: Reduce Particle Burst Counts
**Priority:** Medium
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
`_spawnParticles()` (lines 298-315) spawns 15-25 particles per kill. With rapid kills, this creates 100+ active particles causing GPU pressure. Reduce counts by 50%.

### Acceptance Criteria
- [ ] Reduce particle counts in `_spawnParticles()`:
  - standard: 15 → 8
  - heavy: 25 → 12
  - bonus: 20 → 10
  - decoy: 8 → 5
  - speed: 18 → 9
  - powerup: 18 → 9
- [ ] Verify: visual still satisfying but lighter

### Files Changed
- `client/src/js/components/target-hit.js`

### Performance Impact
- Expected FPS improvement: **+5-8** on Quest

---

## TASK-405: Add Quest GPU Detection for Bloom Disable
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Bloom effect runs 5 render passes per frame on desktop browser. Even though it's disabled in VR mode, users testing on Quest browser (non-VR) still pay the cost. Add mobile GPU detection to disable bloom on Quest browser.

### Acceptance Criteria
- [ ] Add Quest/mobile GPU detection in `bloom-effect.js`:
  ```javascript
  const isMobileGPU = /Quest|Android|Mobile/i.test(navigator.userAgent);
  ```
- [ ] If `isMobileGPU` → set `this.data.enabled = false` in init()
- [ ] Allow override via `settings.forceBloom = true`
- [ ] Verify: Quest browser shows no bloom overhead

### Files Changed
- `client/src/js/components/bloom-effect.js`

### Performance Impact
- Expected FPS improvement: **+20-30** on Quest browser (non-VR)

---

## TASK-406: Disable env-reflections on Quest Browser
**Priority:** Medium
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
`env-reflections.js` has VR detection (line 57-71) but it only triggers when `navigator.xr.isSessionSupported` is called. On Quest browser (non-VR), PMREM generation still runs. Add mobile detection to skip entirely.

### Acceptance Criteria
- [ ] Add mobile GPU detection before `_initPMREM()`:
  ```javascript
  const isMobileGPU = /Quest|Android|Mobile/i.test(navigator.userAgent);
  if (isMobileGPU) {
    console.log('[env-reflections] Disabled for mobile GPU');
    return;
  }
  ```
- [ ] Skip all PMREM and normal map generation on mobile
- [ ] Verify: Quest browser shows no reflection overhead

### Files Changed
- `client/src/js/components/env-reflections.js`

### Performance Impact
- Expected FPS improvement: **+5-10** on Quest browser

---

## TASK-407: Reduce Default GPU Particle Count
**Priority:** Low
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
`gpu-particles.js` default count is 500 particles. Each particle requires CPU iteration in tick(). Reduce default and add mobile-aware counts.

### Acceptance Criteria
- [ ] Reduce default count from 500 → 200 in schema
- [ ] Add mobile detection for further reduction:
  ```javascript
  const isMobile = /Quest|Android|Mobile/i.test(navigator.userAgent);
  const effectiveCount = isMobile ? Math.min(data.count, 100) : data.count;
  ```
- [ ] Apply effective count in `_build()`
- [ ] Verify: ambient particles use reduced count on Quest

### Files Changed
- `client/src/js/components/gpu-particles.js`

### Performance Impact
- Expected FPS improvement: **+3-5** on Quest

---

## V30 — CSS Performance Fix (Full-Screen Overlays Stealing GPU)

> **Goal:** Eliminate CSS overhead during VR gameplay on Quest.
> **Root Cause Analysis:** Multiple full-screen CSS overlays with infinite animations compete for GPU.
> **Ref:** TechLead analysis 2026-02-05

## TASK-410: Disable CSS Vignette Overlays on Quest
**Priority:** Critical
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Full-screen CSS vignettes (`tension-vignette`, `combo-vignette`, `teleport-vignette`, `slow-mo-overlay`) use radial gradients + infinite animations. These render on top of WebGL canvas and steal GPU cycles on Quest.

### Acceptance Criteria
- [ ] Add Quest/mobile detection in JavaScript that controls these overlays
- [ ] On Quest: disable vignette classes entirely (don't add `.active` class)
- [ ] Alternative: Use A-Frame HUD overlay instead of CSS for VR feedback
- [ ] Verify: No CSS overlays visible during VR gameplay on Quest
- [ ] Keep overlays for desktop browser (non-VR)

### Files Changed
- `client/src/js/game/tension-manager.js` or equivalent
- `client/src/js/ui/effects.js` or equivalent
- `client/src/css/style.css` (add `.quest-mode` variants)

### Performance Impact
- Expected FPS improvement: **+10-15** on Quest

---

## TASK-411: Remove Infinite CSS Animations During Gameplay
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
CSS `@keyframes` animations run every frame even when elements are not visible. Animations like `tension-pulse`, `surge-pulse`, `badge-glow` consume CPU/GPU.

### Acceptance Criteria
- [ ] Add `animation: none` when element is not `.active`
- [ ] Use `animation-play-state: paused` when not needed
- [ ] Remove `infinite` from animations that can be one-shot
- [ ] Replace `box-shadow` animation (expensive) with `opacity` or `transform`

### CSS Changes
```css
/* Before - runs forever */
.tension-vignette.tension-active {
  animation: tension-pulse 800ms infinite;
}

/* After - paused when not active */
.tension-vignette {
  animation: tension-pulse 800ms infinite;
  animation-play-state: paused;
}
.tension-vignette.tension-active {
  animation-play-state: running;
}
```

### Files Changed
- `client/src/css/style.css`

### Performance Impact
- Expected FPS improvement: **+3-5** on Quest

---

## TASK-412: Replace CSS Gradients with Solid Colors on Quest
**Priority:** Medium
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
`radial-gradient()` on full-screen overlays is expensive. On Quest, replace with simpler solid color with opacity.

### Acceptance Criteria
- [ ] Add `.quest-mode` class to body when Quest detected
- [ ] Override gradient overlays with solid colors:
  ```css
  .quest-mode .tension-vignette.tension-active {
    background: rgba(255, 0, 0, 0.2); /* solid, no gradient */
  }
  ```
- [ ] Apply to all vignette classes

### Files Changed
- `client/src/css/style.css`
- `client/src/js/game-main.js` (add quest detection)

### Performance Impact
- Expected FPS improvement: **+2-3** on Quest

---

## TASK-413: Disable CSS Transitions During VR
**Priority:** Medium
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
CSS `transition` properties cause reflows. During active VR gameplay, transitions should be instant.

### Acceptance Criteria
- [ ] Add global `.vr-active` class when entering VR
- [ ] Override all transitions:
  ```css
  .vr-active * {
    transition: none !important;
  }
  ```
- [ ] Re-enable transitions when exiting VR

### Files Changed
- `client/src/css/style.css`
- `client/src/js/game-main.js`

### Performance Impact
- Expected FPS improvement: **+1-2** on Quest

---

## TASK-414: Hide All CSS Overlays in VR Mode
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
When in immersive VR, HTML overlays are not visible to the user anyway. Hide them entirely to prevent unnecessary rendering.

### Acceptance Criteria
- [ ] Listen for `enter-vr` / `exit-vr` events on scene
- [ ] On `enter-vr`: add `.vr-hidden` class to all overlay containers
- [ ] On `exit-vr`: remove `.vr-hidden` class
- [ ] `.vr-hidden { display: none !important; }`
- [ ] Ensure game logic still functions (emit events, track state)

### Files Changed
- `client/src/css/style.css`
- `client/src/js/game-main.js`

### Performance Impact
- Expected FPS improvement: **+5-10** on Quest (no CSS rendering overhead)

---

## V28 — Performance Optimization (CRITICAL — Meta Quest VRC Fix)

> **Goal:** Fix FPS from ~40 to 90+ on Quest 2/3. Four phases:
> - **Phase A (TASK-380~385):** Init stalls — defer heavy operations to loading screen (2/6 done)
> - **Phase B (TASK-386~392):** Runtime FPS — reduce lights, fix GC, cache DOM queries ✅
> - **Phase C (TASK-393~396):** GC-free hot paths — eliminate remaining allocations in tick/events ✅
> - **Phase D (TASK-397~400):** Menu optimization — reduce lights, remove transparency, remove blur ✅
> **Ref:** ISSUE-020, Plan: `/root/.claude/plans/kind-riding-hearth.md`

## TASK-380: Lazy Bloom Effect Initialization
**Priority:** Critical
**Status:** Completed (2026-02-04)
**Assigned:** /dev

### Description
Defer bloom-effect.js RenderTarget creation and shader compilation until first use (not scene load).

### Acceptance Criteria
- [ ] Move RenderTarget creation (lines 71-92) to `_ensureTargets()` called on first render
- [ ] Move ShaderMaterial creation (lines 98-154) to lazy getter
- [ ] Bloom disabled by default in VR, enable only if `settings.bloom = true`
- [ ] Profile: init should be < 5ms (down from ~80ms)

---

## TASK-381: Async Environment Map Generation
**Priority:** Critical
**Status:** Completed (2026-02-04)
**Assigned:** /dev

### Description
Defer PMREMGenerator cubemap and normal map generation. Generate asynchronously spread across multiple frames.

### Acceptance Criteria
- [ ] `init()` in env-reflections.js does NOT generate cubemap — only setup PMREMGenerator
- [ ] `_generateCubemap(theme)` runs via `setTimeout` chunking (1 light per frame)
- [ ] Normal map generation (lines 210-461) deferred to after first gameplay frame
- [ ] Use 256×256 normal maps initially (reduce from 512×512)
- [ ] Cache cubemaps per theme (already done) — verify no re-generation
- [ ] Profile: init should be < 10ms (down from ~150ms)

---

## TASK-382: Pre-warm Target Models During Loading
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Move target model generation from first-spawn (mid-gameplay) to loading screen phase.

### Acceptance Criteria
- [ ] Add `TargetModels.preWarm()` function that calls `_ensureInit()` explicitly
- [ ] Call `preWarm()` in game-main.js loading screen phase (before countdown)
- [ ] Use `requestIdleCallback` or `setTimeout(0)` to spread across idle frames
- [ ] Profile: first target spawn < 1ms (down from ~50ms)

---

## TASK-383: Remove Legacy Particle Fallback
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Remove entity-based particle spawning. Force GPU particles only. Legacy fallback in `_spawnAmbientParticles()` and `weather-system.js` causes 70+ entity creation.

### Acceptance Criteria
- [ ] Remove lines 1011-1078 in game-main.js (legacy ambient particles)
- [ ] Remove lines 177-228 in weather-system.js (legacy weather particles)
- [ ] Keep only GPU particle path (`window.__spawnGPUBurst`)
- [ ] If GPU particles unavailable → disable particles entirely (no fallback)
- [ ] Verify: 0 entities created for particles
- [ ] Profile: ambient particle init < 2ms (down from ~40ms)

---

## TASK-384: Async Theme Application
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Split `applyTheme()` into RAF-chunked async operations to avoid single-frame DOM stall.

### Acceptance Criteria
- [ ] Extract decoration spawning to `_applyThemeDecorations()` called via `setTimeout(0)`
- [ ] Extract normal map generation to separate async call
- [ ] Core theme (sky, lights, materials) applied synchronously (essential)
- [ ] Decorations, particles, reflections applied in next 2-3 frames
- [ ] Profile: synchronous applyTheme < 15ms (down from ~60ms)

---

## TASK-385: Object Pooling for Decorations
**Priority:** Medium
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Pre-create decoration entities (buildings, stars, etc.) at boot, toggle visibility instead of create/destroy on theme switch.

### Acceptance Criteria
- [ ] Create decoration pool during loading screen (all 6 themes' decorations)
- [ ] Pool entities start with `visible="false"`
- [ ] `applyTheme()` toggles pool visibility instead of creating new entities
- [ ] On theme switch: hide old decorations, show new decorations
- [ ] Profile: theme switch < 5ms (down from ~30ms entity creation)

---

## TASK-386: Reduce Static Lights (5→2)
**Priority:** Critical
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Game has 5 dynamic lights (4 point + 1 ambient) in game.html. Template specifies max 2 lights. Each extra light costs ~10-15% GPU on Quest.

### Acceptance Criteria
- [x] Replace 4 point lights + 1 ambient → 1 ambient + 1 directional (matching template)
- [x] Update lighting colors to maintain visual appeal: ambient=#445566 i=0.7, directional=#aabbff i=0.9
- [x] Verify no visual regression on key gameplay elements

### Files Changed
- `client/src/game.html:163-167`

---

## TASK-387: Remove Dynamic Lights from Spawner
**Priority:** Critical
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
`target-spawner.js` creates point lights dynamically for telegraph (lines 444-451) and bomb warning (lines 502-510). At peak: 4 static + 2 telegraph + 1 bomb = 7 lights. Must eliminate spawned lights.

### Acceptance Criteria
- [x] Remove point light creation in `spawnTelegraph()` (lines 444-451, 477)
- [x] Remove point light creation in `spawnBombWarning()` (lines 502-510)
- [x] Keep particle spheres with emissive material (provides glow without light component)
- [x] Verify telegraph/bomb warning still visible and recognizable

### Files Changed
- `client/src/js/game/target-spawner.js`

### Notes
- Emissive materials on spheres/rings provide sufficient visual feedback
- Ring in bomb warning already has `emissive: #ff0000; emissiveIntensity: 1`

---

## TASK-388: Fix GC Allocations in smooth-locomotion.js
**Priority:** Critical
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
`smooth-locomotion.js` tick() creates 2-3 new Vector3 objects EVERY FRAME (lines 45, 50-51). This causes GC spikes and frame drops on Quest.

### Acceptance Criteria
- [x] Pre-allocate `_dir`, `_right`, `_up` vectors in `init()`
- [x] Replace `new THREE.Vector3()` in tick() with pre-allocated vector reuse
- [x] Use `.set()` and `.crossVectors()` on pre-allocated vectors
- [x] Verify: Chrome DevTools shows 0 allocations in tick() hot path

### Files Changed
- `client/src/js/components/smooth-locomotion.js`

### Implementation
```javascript
// In init():
this._dir = new THREE.Vector3();
this._right = new THREE.Vector3();
this._up = new THREE.Vector3(0, 1, 0);

// In tick():
this._dir.set(0, 0, 0);
camObj.getWorldDirection(this._dir);
this._dir.y = 0;
this._dir.normalize();
this._right.crossVectors(this._dir, this._up).normalize();
```

---

## TASK-389: Add Global Target Cache
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Multiple components call `document.querySelectorAll('.target')` in hot paths. Create module-level Set cache in target-system.js, maintain on add/remove.

### Acceptance Criteria
- [x] Add `const _targetCache = new Set()` at module scope in target-system.js
- [x] Export `getTargetCache()` function
- [x] Add to cache in `_addTarget()` or equivalent
- [x] Remove from cache in `_removeTarget()` or cleanup
- [x] Verify cache stays in sync with actual DOM targets

### Files Changed
- `client/src/js/game/target-system.js`

---

## TASK-390: Update DOM Query Consumers
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Replace `querySelectorAll('.target')` calls with `getTargetCache()` in hot-path consumers.

### Acceptance Criteria
- [x] Update `hand-shoot.js:82,89` — use getTargetCache() in `_setInputMode()`
- [x] Update `target-indicator.js` — use cache in tick()
- [x] Update `shoot-controls.js` if applicable (no changes needed - no querySelectorAll found)
- [x] Cache barrier/edge refs in `target-hit.js:243-261` (lazy init, not per-kill query)

### Files Changed
- `client/src/js/components/hand-shoot.js`
- `client/src/js/components/target-indicator.js`
- `client/src/js/components/shoot-controls.js`
- `client/src/js/components/target-hit.js`

### Notes
- Import: `import { getTargetCache } from '../game/target-system.js'`

---

## TASK-391: Disable Post-Processing in VR Mode
**Priority:** Medium
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Bloom and env-reflections still run setup/tick in VR mode. Add early-exit checks to skip expensive operations on Quest.

### Acceptance Criteria
- [x] bloom-effect.js: Early return in tick() when `this._vrActive` (skip all flat-mode processing)
- [x] env-reflections.js: Skip PMREM generation entirely when VR detected
- [x] Add VR detection: `navigator.xr.isSessionSupported('immersive-vr')`
- [x] Verify: Quest shows no post-processing overhead in OVR Metrics

### Files Changed
- `client/src/js/components/bloom-effect.js`
- `client/src/js/components/env-reflections.js`

---

## TASK-028: Document Quest Material Guidelines
**Priority:** Low
**Status:** Completed (2026-02-05)
**Assigned:** /tl

### Description
Enhance Quest material guidelines by adding mandatory optimization rules for static, dynamic, and UI elements, including shader preferences and transparency restrictions.

### Acceptance Criteria
- [x] Add `shader: flat` rules for static surfaces in coding-style.md
- [x] Add emissive material guidelines (no point lights for glow)
- [x] Add transparency restrictions for UI elements
- [x] Add forbidden patterns table with fixes
- [x] Update game-design.md with Quest Material Optimization section

### Files Changed
- `.claude/rules/coding-style.md`
- `.claude/rules/game-design.md`
- `specs/tasks.md`

---

## TASK-392: Apply Quest Material Guidelines to game.html
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Apply Quest Material Guidelines to game.html: remove transparency from arena elements, use `shader: flat` for static surfaces.

### Acceptance Criteria
- [x] Floor: Change from PBR material (`metalness: 0.8; roughness: 0.4`) to `shader: flat`
- [x] Floor grid: Remove `opacity: 0.3`, use darker solid color with `shader: flat`
- [x] Arena walls: Remove `opacity: 0.15`, use dark solid color
- [x] Decorative pillars: Remove `opacity: 0.5`, use dark solid color

### Files Changed
- `client/src/game.html`

### Performance Impact
- Removed 4 transparent surfaces (expensive alpha blending)
- Changed floor from PBR to flat shader (~10% GPU savings)
- Expected FPS improvement: +5-10 on Quest

---

## TASK-393: Fix target-indicator.js GC Allocations
**Priority:** Critical
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
`target-indicator.js` tick() creates 2-4 new Vector3 objects EVERY FRAME per target. With 10 targets, that's 40 allocations per frame = constant GC spikes.

### Acceptance Criteria
- [ ] Pre-allocate `_toTarget`, `_forward`, `_right`, `_upVec` vectors in `init()`
- [ ] Replace `.clone()` calls (lines 47, 50) with pre-allocated vector `.copy()`
- [ ] Replace `new THREE.Vector3()` (line 64) with pre-allocated vectors
- [ ] Verify: Chrome DevTools shows 0 allocations in tick() hot path

### Files Changed
- `client/src/js/components/target-indicator.js`

### Implementation
```javascript
// In init():
this._toTarget = new THREE.Vector3();
this._forward = new THREE.Vector3();
this._right = new THREE.Vector3();
this._upVec = new THREE.Vector3(0, 1, 0);

// In tick() - replace:
// const toTarget = this._targetPos.clone().sub(this._camWorldPos);
this._toTarget.copy(this._targetPos).sub(this._camWorldPos);

// const forward = this._camDir.clone();
this._forward.copy(this._camDir);

// const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
this._right.crossVectors(this._forward, this._upVec).normalize();
```

### Performance Impact
- Expected FPS improvement: +10-15 on Quest

---

## TASK-394: Fix target-system.js Magnet Allocation
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
`target-system.js` line 569 creates `new THREE.Vector3()` in `_tick()` method when magnet power-up is active. This causes GC spikes during magnet duration.

### Acceptance Criteria
- [ ] Pre-allocate `_camPos` vector in constructor
- [ ] Replace `const camPos = new THREE.Vector3()` with pre-allocated vector
- [ ] Verify: no allocations in magnet check path

### Files Changed
- `client/src/js/game/target-system.js`

### Implementation
```javascript
// In constructor:
this._camPos = new THREE.Vector3();

// In _tick() magnet section:
// const camPos = new THREE.Vector3();
cam.object3D.getWorldPosition(this._camPos);
```

### Performance Impact
- Expected FPS improvement: +3-5 when magnet active

---

## TASK-395: Fix shoot-controls.js Shotgun Query
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
`shoot-controls.js` line 219 calls `document.querySelectorAll('.target')` on every shotgun shot. With rapid fire or multiple shotgun users, this causes performance drops.

### Acceptance Criteria
- [ ] Replace `document.querySelectorAll('.target')` with `window.getTargetCache()`
- [ ] Add fallback for when cache is not available
- [ ] Verify: no DOM queries in _shotgunHit()

### Files Changed
- `client/src/js/components/shoot-controls.js`

### Implementation
```javascript
// Replace line 219:
// const targets = document.querySelectorAll('.target');
const targets = window.getTargetCache ? window.getTargetCache() : document.querySelectorAll('.target');
```

### Performance Impact
- Expected FPS improvement: +5 during shotgun use

---

## TASK-396: Pre-allocate shoot-controls.js Event Vectors
**Priority:** Medium
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
`shoot-controls.js` creates multiple Vector3/Quaternion/Euler objects in event handlers (_onTrigger, _shotgunHit, _spawnLaserTrail). While not in tick(), these run frequently during gameplay.

### Acceptance Criteria
- [ ] Pre-allocate in init(): `_origin`, `_direction`, `_end`, `_mid`, `_targetPos`, `_toTarget`
- [ ] Pre-allocate: `_upVec`, `_quat`, `_euler` for laser trail orientation
- [ ] Replace all `new THREE.Vector3()` in event handlers with pre-allocated vectors
- [ ] Replace `.clone()` calls with `.copy()` pattern
- [ ] Verify: no allocations in shooting hot paths

### Files Changed
- `client/src/js/components/shoot-controls.js`

### Lines to Fix
- Lines 110-115: miss ricochet vectors
- Lines 174, 203: shell casing vectors
- Lines 220-221, 228: shotgun vectors
- Lines 265-266, 278-279: laser trail vectors
- Lines 292-294: laser orientation (Vector3, Quaternion, Euler)

### Performance Impact
- Expected FPS improvement: +2-3 during rapid shooting

---

## TASK-397: Reduce Menu Lights (15→2)
**Priority:** Critical
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
`index.html` menu page has **15 point lights** across different sections (menu-content, shop-content, stats-content, game-content). This FAR exceeds Quest's 2-light budget and causes severe FPS drops on menu.

### Current Lights (to remove/replace)
- Lines 211-213: 3 point lights (menu-content)
- Lines 321-323: 3 point lights (shop-content)
- Lines 369-371: 3 point lights (stats-content)
- Line 444: 1 point light (under-glow)
- Lines 495-499: 1 ambient + 4 point lights (game-content)

### Acceptance Criteria
- [x] Remove all point lights from menu-content, shop-content, stats-content
- [x] Keep only 1 ambient + 1 directional light total for entire scene
- [x] Replace colored glow effects with emissive materials on panels
- [x] Verify: max 2 dynamic lights in scene inspector

### Files Changed
- `client/src/index.html`

### Implementation
```html
<!-- Replace 15 lights with just 2 -->
<a-light type="ambient" color="#334455" intensity="0.6"></a-light>
<a-light type="directional" position="0 5 2" intensity="0.8" color="#aabbff"></a-light>

<!-- For colored glow effects, use emissive on panels -->
<a-plane material="shader: flat; color: #0a0a2a; emissive: #001133; emissiveIntensity: 0.3"></a-plane>
```

### Performance Impact
- Expected FPS improvement: +30-40 on Quest menu

---

## TASK-398: Remove Transparency from Menu (85 surfaces)
**Priority:** Critical
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
`index.html` has **85 elements with opacity < 1**. Each transparent surface requires alpha blending which is expensive on Quest's mobile GPU. Replace all transparency with solid colors.

### Acceptance Criteria
- [x] Replace all `opacity: 0.3-0.95` surfaces with solid opaque colors
- [x] Use darker solid colors instead of transparency (e.g., `opacity: 0.3` → solid `#0a0a1a`)
- [x] Remove opacity animations (lines 225, 271)
- [x] Keep only essential transparency (crosshair ring if needed)
- [x] Verify: search for "opacity" returns <5 results

### Files Changed
- `client/src/index.html`

### Color Mapping (opacity → solid)
| Original | Replacement |
|----------|-------------|
| `opacity: 0.95` | Remove opacity (use solid) |
| `opacity: 0.7` | Darker solid color |
| `opacity: 0.3` | Much darker solid (#0a0a1a) |
| `opacity: 0.05-0.06` | Remove element or use very dark solid |

### Performance Impact
- Expected FPS improvement: +15-25 on Quest menu

---

## TASK-399: Remove backdrop-filter: blur from CSS
**Priority:** Critical
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
`style.css` has 3 `backdrop-filter: blur()` rules (lines 28, 49, 914). `backdrop-filter` is **extremely expensive** on Quest's mobile GPU — it requires rendering the background, applying blur, then compositing. Replace with solid dark backgrounds.

### Acceptance Criteria
- [x] Remove `backdrop-filter: blur(10px)` from line 28 (game-over-overlay)
- [x] Remove `backdrop-filter: blur(6px)` from line 49 (btn-quit)
- [x] Remove `backdrop-filter: blur(8px)` from line 914
- [x] Replace with solid dark backgrounds: `background: rgba(10, 10, 26, 0.95)` → `background: #0a0a1a`
- [x] Verify: grep for "backdrop-filter" returns 0 results

### Files Changed
- `client/src/css/style.css`

### Implementation
```css
/* BEFORE (expensive) */
.game-over-overlay {
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
}

/* AFTER (fast) */
.game-over-overlay {
  background: #0a0a1a;
}
```

### Performance Impact
- Expected FPS improvement: +10-15 on Quest

---

## TASK-400: Remove Looping Opacity Animations
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
`index.html` has continuous opacity animations that cause constant recompositing. Replace with emissive intensity animations or remove entirely.

### Lines to Fix
- Line 225: `animation="property: material.opacity; from: 0.3; to: 0.8; dur: 2000; loop: true"`
- Line 271: `animation="property: material.opacity; from: 0.85; to: 1.0; dur: 1200; loop: true"`

### Acceptance Criteria
- [x] Remove opacity animation from accent line (line 225)
- [x] Remove opacity animation from PLAY button (line 271)
- [x] If glow effect needed, use emissive intensity animation instead
- [x] Verify: no `animation.*opacity` with `loop: true`

### Files Changed
- `client/src/index.html`

### Implementation
```html
<!-- BEFORE (expensive) -->
<a-plane animation="property: material.opacity; from: 0.3; to: 0.8; loop: true">

<!-- AFTER (cheaper - use emissive) -->
<a-plane material="shader: flat; color: #00d4ff; emissive: #00d4ff"
         animation="property: material.emissiveIntensity; from: 0.3; to: 0.6; loop: true">
```

### Performance Impact
- Expected FPS improvement: +5 on Quest

---

## V27 — God Class Refactoring

> **Goal:** Tách 2 god classes (target-system.js 3040 lines, audio-manager.js 1616 lines) thành modules nhỏ hơn. Facade pattern — giữ nguyên public API, tách logic nội bộ. Zero behavior change.

## TASK-370: Refactor audio-manager.js — Extract Audio Modules
**Priority:** High
**Status:** Completed (2026-02-02)
**Assigned:** /dev

### Description
Tách audio-manager.js (1616 lines, 80+ play methods) thành 5 modules. AudioManager giữ làm facade, delegate play methods sang sub-modules. Giữ nguyên `window.audioManager` singleton + tất cả method signatures.

### Acceptance Criteria
- [ ] Tạo `client/src/js/core/audio-weapons.js` — export mixin/object chứa: `playHit`, `playWeaponFire`, `playRailgunCharge`, `playRicochet`, `playMiss`
- [ ] Tạo `client/src/js/core/audio-gameplay.js` — `playCombo`, `playComboSound`, `playComboLost`, `playSpawn`, `playTelegraph`, `playBossSpawn`, `playBossHit`, `playBossKill`, `playWaveClear`, `playPowerUp`, `playPowerUpEnd`, `playSlowMoHit`
- [ ] Tạo `client/src/js/core/audio-tension.js` — `playBombTick`, `playBombExplode`, `playBombDefuse`, `playBombWarning`, `playHeartbeat`, `playLastStandRecover`, `playDarknessWarn`, `playDarknessStart`, `playOvertimeStart`, `playOvertimeTick`, `playChainBreak`, `playChainComplete`, `playArenaClose`, `playSurgeStart`, `playSurgeEnd`, `playDebuffApply`, `playDebuffClear`
- [ ] Tạo `client/src/js/core/audio-ui.js` — `playUIHover`, `playUIClick`, `playUIToggle`, `playUIBack`, `playUIError`, `playSelect`, `playGameOver`, `playLevelUp`, `playLifeLost`, `playAchievement`, `playCountdown`, `playCountdownBeep`, `playGo`, `playDissolve`
- [ ] **Kỹ thuật mixin**: Mỗi module export object `{ methodName(ctx, dest, ...) {} }`. AudioManager import + `Object.assign(AudioManager.prototype, ...modules)`. Các sub-methods nhận `this` context (access `_getCtx()`, `_getDest()`, `_pitchVar()`, `_canPlay()`, `_soundDone()`, `_triggerDuck()`)
- [ ] `audio-manager.js` giữ: constructor, loadSettings, _getCtx, _setupReverb, _setupPriorityBuses, _getDest, _triggerDuck, _canPlay/_soundDone, _pitchVar, _createPanner, updateListener, destination getter, createTargetHum. Export `audioManager` singleton
- [ ] **Zero API change**: `audioManager.playHit()` vẫn hoạt động y hệt, không thay đổi caller nào
- [ ] Tất cả existing callers (target-system.js, game-main.js, tension-system.js, shoot-controls.js, etc.) không cần sửa
- [ ] Mỗi sub-module file ≤ 400 lines
- [ ] audio-manager.js facade ≤ 250 lines

---

## TASK-371: Refactor target-system.js — Extract Hazard Systems
**Priority:** High
**Status:** Completed (2026-02-02)
**Assigned:** /dev

### Description
Tách các hệ thống hazard (projectiles, chargers, danger zones, scare balls, laser sweeps) ra khỏi target-system.js. Đây là nhóm lớn nhất (~800 lines) và có cohesion cao nội bộ.

### Acceptance Criteria
- [ ] Tạo `client/src/js/game/target-hazards.js` — class `TargetHazards` chứa:
  - Projectiles: `_tryFireProjectile`, `_launchProjectile`, `_updateProjectiles`, `_onProjectileHit`, `_onProjectileDodged`, `_onShieldBlock`, `_checkProjectileFiring`
  - Chargers: `_trySpawnCharger`, `_spawnCharger`, `_updateChargers`, `_onChargerContact`, `_onChargerKill`
  - Danger Zones: `_trySpawnDangerZone`, `_spawnDangerZone`, `_spawnDangerEmbers`, `_updateDangerZones`
  - Scare Balls: `_tryLaunchScareBall`, `_launchScareBall`, `_updateScareBalls`, `_onScareBallHit`, `_onScareBallDodge`
  - Laser Sweeps: `_tryLaunchLaserSweep`, `_launchLaserSweep`, `_updateLaserSweeps`, `_onLaserHit`, `_onLaserDodge`
- [ ] `TargetHazards` constructor nhận reference tới `TargetSystem` (access `_container`, `_running`, `_onPlayerDamage`, `audioManager`, etc.)
- [ ] `TargetSystem` khởi tạo `this._hazards = new TargetHazards(this)` và delegate calls
- [ ] Update tick/update methods trong TargetSystem để call `this._hazards.update(dt)`
- [ ] **Zero behavior change**: tất cả hazard mechanics hoạt động y hệt
- [ ] target-system.js giảm ~800 lines
- [ ] target-hazards.js ≤ 900 lines

---

## TASK-372: Refactor target-system.js — Extract Special Targets
**Priority:** Medium
**Status:** Completed (2026-02-02)
**Assigned:** /dev

### Description
Tách special target logic (melee/punch, rhythm, color-match, blink) ra khỏi target-system.js.

### Acceptance Criteria
- [ ] Tạo `client/src/js/game/target-specials.js` — class `TargetSpecials` chứa:
  - Melee: `_spawnMeleeTarget`, `_updatePunchDetection`, `_onPunchHit`
  - Rhythm: `_updateRhythmBeat` + rhythm spawn logic
  - Color-match: `_updateColorMatch`, `_rotateColorMatch`, `_spawnColorMatchTarget`
  - Blink: `_updateBlinkTargets`
- [ ] `TargetSpecials` constructor nhận reference tới `TargetSystem`
- [ ] `TargetSystem` delegate: `this._specials = new TargetSpecials(this)`
- [ ] **Zero behavior change**
- [ ] target-system.js giảm thêm ~400 lines
- [ ] target-specials.js ≤ 500 lines

---

## TASK-373: Refactor target-system.js — Extract Spawner & Feedback
**Priority:** Medium
**Status:** Completed ✅ (2026-02-02)
**Assigned:** /dev

### Description
Tách spawn logic và feedback system ra khỏi target-system.js. Sau task này, target-system.js facade chỉ còn ~600 lines (constructor, configure, start/stop, _onTargetHit dispatch, tick loop).

### Acceptance Criteria
- [x] Tạo `client/src/js/game/target-spawner.js` — class `TargetSpawner` (786 lines):
  - `pickTargetType`, `spawnTarget`, `spawnTargetAt`, `spawnTelegraph`, `spawnBombWarning`, `_applyPrimitiveMaterial`, `createEventTarget`
  - `_pickMovementPattern`, `_applyMovementPattern`, `pick360Position`, `pickPeripheralPosition`
  - Exports `TARGET_TYPES` constant
- [x] Tạo `client/src/js/game/target-feedback.js` — class `TargetFeedback` (~233 lines):
  - `triggerComboLost`, `triggerWaveEvent`, `spawnDamageNumber`, `flashScreen`, `triggerSlowMotion`, `spawnMultiplierZone`, `getZoneMultiplier`
- [x] `TargetSystem` facade delegate: `this._spawner`, `this._feedback`
- [x] **Zero behavior change**
- [x] target-system.js facade: 691 lines ≤ 800 ✓
- [x] target-spawner.js: 786 lines (~700 target; ~45 lines are data constants, remainder is procedural DOM)
- [x] target-feedback.js: ~233 lines ≤ 400 ✓

---

## V26 — Game Feel & Audio Polish

> **Goal:** Nâng cấp feedback loop: audio ducking khi nhiều SFX đồng thời, combo reset feedback khi mất combo cao, bomb spawn warning telegraph. Từ "functional audio" → "polished, layered audio-visual feedback".

## TASK-366: Audio Ducking System
**Priority:** High
**Status:** Completed (2026-02-02)
**Assigned:** /dev

### Description
Khi nhiều SFX fire đồng thời (bomb explode + combo chime + weapon fire + music), tất cả play ở full volume → audio saturation, muddy mix. Cần hệ thống ducking tự động giảm volume SFX thấp priority khi SFX cao priority đang play.

### Acceptance Criteria
- [ ] **Priority system** trong audio-manager.js: gán priority cho mỗi sound category:
  - P0 (Critical): bombExplode, bossKill, playerDamage — KHÔNG bị duck
  - P1 (High): weaponFire, hit, combo chime — duck nhẹ (-3dB) khi P0 active
  - P2 (Low): ricochet, shellCasing, ambientHum — duck mạnh (-8dB) khi P0/P1 active
- [ ] **Duck mechanism**: Khi P0 sound plays, tạo GainNode reduction cho P1/P2 channels. Fade reduction in 20ms, fade out 200ms sau khi P0 sound ends
- [ ] **Implementation**: Tạo 3 GainNode buses (critical, high, low) nối vào masterGain. Route mỗi sound qua bus tương ứng. Khi P0 fires → ramp P1 bus gain to 0.7, P2 bus gain to 0.4 over 20ms. Restore over 200ms
- [ ] **Music ducking**: Khi P0 sound plays, duck music masterGain to 0.5 over 50ms, restore over 500ms
- [ ] **Concurrent sound limit**: Max 8 simultaneous sounds. Khi vượt, drop P2 sounds đầu tiên
- [ ] **Performance**: GainNode operations = zero-cost (Web Audio native). Không thêm processing overhead

---

## TASK-367: Combo Reset Feedback
**Priority:** Medium
**Status:** Completed (2026-02-02)
**Assigned:** /dev

### Description
Khi player có combo cao (>10) rồi miss → combo drops về 0 silently. Không có audio/visual feedback cho moment quan trọng này. Cần "combo lost" feedback tỉ lệ với combo đã mất.

### Acceptance Criteria
- [ ] **Detect high combo loss**: Trong target-system.js, tại tất cả chỗ `this._combo = 0`, check combo trước khi reset:
  - `if (prevCombo >= 10)` → trigger combo-lost feedback
  - `if (prevCombo >= 25)` → trigger enhanced combo-lost feedback
- [ ] **Audio**: Tạo `playComboLost(level)` trong audio-manager.js:
  - Level 1 (combo 10-24): descending 3-note chime (C5→A4→F4), 150ms, gain 0.2
  - Level 2 (combo 25+): descending 5-note (C5→Bb4→Ab4→F4→D4) + low rumble, 300ms, gain 0.25
- [ ] **Visual**: Dispatch `combo-lost` CustomEvent với detail `{ lostCombo: prevCombo }`:
  - HUD text flash: "COMBO LOST!" in red, fade out 800ms (reuse damage-number pattern)
  - Camera micro-shake: intensity 0.01, duration 150ms (subtle, via camera-effects.js)
- [ ] **Cooldown**: Max 1 combo-lost feedback per 3 seconds (prevent spam from rapid resets)
- [ ] **Tension integration**: Combo loss khi combo ≥15 → trigger debuff chance (20%) via tensionSystem.activateDebuff()
- [ ] **Settings**: Respect `settings.screenShake` toggle for camera shake

---

## TASK-368: Bomb Spawn Warning Telegraph
**Priority:** Medium
**Status:** Completed (2026-02-02)
**Assigned:** /dev

### Description
Bomb targets xuất hiện đột ngột — player không có thời gian chuẩn bị. Cần warning telegraph 0.8s trước khi bomb thực sự spawn, cho player biết vị trí sắp xuất hiện bomb.

### Acceptance Criteria
- [ ] **Pre-spawn warning**: Trong target-system.js, khi `_resolveTargetType()` returns 'bomb':
  - Trước khi spawn bomb entity, tạo warning indicator tại spawn position
  - Warning hiển thị 800ms, sau đó spawn bomb thật
- [ ] **Warning visual**: Tại spawn position:
  - Pulsing red ring (a-ring): radius 0.3→0.6, opacity 0.5→0, 800ms animation
  - Red "⚠" text label: look-at camera, scale 0.3, fade in→out
  - Red point light: intensity 1, distance 3, 800ms decay
- [ ] **Warning audio**: Play `playBombWarning()` — ascending 2-note alert (F5→A5), 200ms, gain 0.2. Tạo method mới trong audio-manager.js
- [ ] **HUD indicator**: Dispatch `bomb-incoming` event → target-indicator.js hiển thị flashing red arrow pointing toward bomb spawn location
- [ ] **Timing**: Warning 800ms → spawn bomb (3s countdown bắt đầu) → total player có 3.8s để react
- [ ] **Performance**: 1 ring + 1 text + 1 light = 3 entities, auto-cleanup after 800ms
- [ ] **Skip nếu bomb spawn gần player**: Nếu spawn distance < 3m, giảm warning time xuống 400ms (close-range urgency)

---

## V25 — VFX Enhancement (Explosions, Projectile Trails, Muzzle Smoke)

> **Goal:** Nâng cấp hiệu ứng visual: explosion fireball cho bomb, trail lửa cho projectile bay vào mặt player, smoke sau mỗi shot. Từ "basic particles" → "cinematic VFX". Fix bug critical: `explosion` preset không tồn tại.

## TASK-363: Explosion Preset + Fireball Effect
**Priority:** High (fix critical bug)
**Status:** Completed (2025-02-02)
**Assigned:** /dev

### Description
Bomb target trong tension-system.js gọi `__spawnGPUBurst({ preset: 'explosion' })` nhưng preset `explosion` **KHÔNG TỒN TẠI** trong gpu-particles.js (chỉ có: ambient, rain, dust, bubbles, starfield, burst, muzzle, powerup). Cần tạo preset mới + nâng cấp bomb explosion VFX.

### Acceptance Criteria
- [ ] **Tạo `explosion` preset** trong gpu-particles.js:
  - Core layer: 20 particles, spherical burst, yellow→white (#ffcc00→#ffffff), size 0.08, speed 3, lifetime 300ms, gravity -2
  - Fire layer: 30 particles, spherical, orange→red (#ff6600→#ff2200), size 0.12, speed 2, lifetime 500ms, gravity -1, additive blend
  - Smoke layer: 15 particles, upward drift, gray (#444444), size 0.15, speed 0.5, lifetime 800ms, opacity 0.3→0
- [ ] **Shrapnel debris**: 8 particles, high speed (5-8), tiny (0.02), metallic color, gravity 6 (fall fast), lifetime 600ms
- [ ] **Ground scorch mark**: Tạo a-circle tại vị trí nổ, radius 0.5, black opacity 0.3, fade out over 3s. Max pool 5 marks
- [ ] **Flash light**: PointLight intensity 5, distance 8, decay over 200ms (tái sử dụng pattern từ target-hit.js)
- [ ] **Camera shake**: intensity 0.04, duration 300ms (đã có trong tension-system.js, verify)
- [ ] **Performance**: Tổng ~73 particles per explosion. One-shot, auto-cleanup. Quest 2 safe
- [ ] **Cũng dùng cho boss kill**: Boss destroy trigger `explosion` preset với scale 2x

---

## TASK-364: Projectile Trail + Warning Telegraph
**Priority:** High
**Status:** Completed (2025-02-02)
**Assigned:** /dev

### Description
Projectile (đạn enemy bay vào mặt player) hiện chỉ là sphere cam nhỏ (0.04 radius) + ring xoay. Không có trail, không có warning trước khi bắn. Player khó thấy và khó né.

### Acceptance Criteria
- [ ] **Fire trail**: Attach GPU particle emitter vào projectile entity. Emit 3-5 particles mỗi 50ms dọc theo path. Color: orange→red, size 0.04→0.01 (shrink), lifetime 200ms, additive blend. Kỹ thuật: spawn `__spawnGPUBurst` tại projectile position mỗi 50ms với count=3, speed=0.5 (gần như đứng yên → tạo trail)
- [ ] **Warning telegraph**: 0.5s trước khi bắn, hiển thị:
  - Red pulsing ring (a-ring) trên target đang chuẩn bị bắn, radius 0.3, opacity pulse 0.3→0.8
  - HUD warning indicator: red "⚠" text flash tại hướng target (reuse target-indicator logic)
  - Audio: short warning beep (reuse `playBombTick` hoặc similar)
- [ ] **Enhanced projectile visual**: Thay sphere đơn giản bằng:
  - Core: emissive sphere 0.04 radius, orange (#ff6600), intensity 2.0
  - Outer glow: larger sphere 0.08 radius, same color, opacity 0.2, shader flat
  - Spinning ring giữ nguyên (đã có)
- [ ] **Impact explosion on hit**: Khi projectile trúng player:
  - Trigger `explosion` preset (TASK-363) tại camera position, scale 0.5x
  - Camera shake intensity 0.03, duration 200ms
  - Haptic burst 0.5 intensity, 100ms
- [ ] **Impact explosion on miss**: Khi projectile hết lifetime (5s) hoặc bay quá xa:
  - Small burst tại last position (preset `burst`, count 10, color red)
- [ ] **Performance**: Trail = ~3 particles × 20 ticks/sec × max 3 projectiles = ~180 particles/sec. Quest 2 safe
- [ ] **Settings**: Respect `settings.particles` toggle

---

## TASK-365: Muzzle Smoke + Enhanced Shell Casing
**Priority:** Low
**Status:** Completed (2025-02-02)
**Assigned:** /dev

### Description
Sau mỗi shot chỉ có flash sphere + GPU burst. Thêm smoke puff nhẹ và cải thiện shell casing visual.

### Acceptance Criteria
- [ ] **Smoke puff**: Sau mỗi shot, spawn 5 particles tại muzzle position:
  - Color: light gray (#aaaaaa), opacity 0.15→0
  - Size: 0.02→0.06 (grow), lifetime 400ms
  - Drift: upward (y+0.5) + slight random spread
  - Kỹ thuật: Tạo `smoke` preset trong gpu-particles.js hoặc inline config cho `__spawnGPUBurst`
- [ ] **Rate limit**: Max 1 smoke puff per 150ms (prevent SMG spam)
- [ ] **Shell casing spark**: Khi shell casing rơi xuống floor (y<0.1), spawn 2 tiny spark particles (orange, 50ms lifetime). Detect via timeout estimate (shell eject duration ~400ms)
- [ ] **Performance**: 5 particles × ~3 shots/sec = ~15 particles/sec. Negligible
- [ ] **Settings**: Respect `settings.muzzleFlash` toggle (reuse existing)

---

## V24 — Graphics Polish (VR Post-Processing, Shadows, Batching)

> **Goal:** Làm cho post-processing (color grading, tone mapping, vignette, damage flash) hoạt động trong VR mode trên Quest 2. Tối ưu shadows và giảm draw calls. Từ "flat VR" → "polished VR with proper grading".

## TASK-360: VR-Compatible Post-Processing
**Priority:** High
**Status:** ✅ Completed (2026-02-02)
**Assigned:** /dev

### Description
Hiện tại toàn bộ bloom-effect pipeline bị skip khi `renderer.xr.isPresenting` (line 162-167). Player trên Quest 2 không thấy color grading, tone mapping, vignette, hay damage flash. Cần enable các effects nhẹ trong VR mà không cần custom render targets.

**Approach:** Sử dụng Three.js built-in tone mapping cho VR + overlay entities cho vignette/flash.

### Acceptance Criteria
- [ ] **VR Tone Mapping**: Khi XR session active, set `renderer.toneMapping = THREE.ACESFilmicToneMapping` và `renderer.toneMappingExposure` theo theme preset. Khi exit XR, restore về `NoToneMapping` (để custom pipeline handle)
- [ ] **VR Color Grading**: Không thể dùng post-process trong VR → thay vì per-pixel grading, adjust scene lights + ambient color per theme để approximate color temperature/saturation effect. Modify `applyTheme()` để tăng/giảm light color intensity matching grading presets
- [ ] **VR Vignette**: Tạo `#vr-vignette` entity — a-plane gắn vào camera (z=-0.5), transparent, radial gradient texture (canvas-generated). Chỉ visible khi XR presenting. Uniform `opacity` controlled bằng same `uVignetteIntensity` logic
- [ ] **VR Damage Flash**: Tạo `#vr-damage-flash` entity — a-plane gắn vào camera, material `color: red; opacity: 0`. Khi `player-damage` event → animate opacity 0→0.3→0 over 300ms. Same cho kill flash (white, 0→0.1→0, 100ms)
- [ ] **VR Low-HP Pulse**: Vignette overlay opacity oscillates 0.1→0.3 at 1Hz khi HP ≤ 1
- [ ] **Detect XR state change**: Listen `renderer.xr` events (`sessionstart`, `sessionend`) để toggle giữa custom pipeline vs built-in tone mapping
- [ ] **Per-theme exposure**: Áp dụng `toneMappingExposure` values: cyber=1.0, sunset=1.1, space=0.9, underwater=0.85, neon=1.05, day=1.15
- [ ] **bloom-effect.js** vẫn handle desktop post-processing bình thường. Chỉ thêm VR fallback path
- [ ] Performance: Overlay entities = 2 planes, no extra render targets. Quest 2 safe
- [ ] Settings: Respect existing `settings.vignette`, `settings.colorGrading`, `settings.damageFlash`

---

## TASK-361: Shadow Optimization
**Priority:** Medium
**Status:** ✅ Completed (2026-02-02)
**Assigned:** /dev

### Description
Shadow camera hiện cover ±20 units (40x40 area) cho shadow map 1024x1024. Arena chỉ 32x32 và player hầu như ở giữa. Thu nhỏ shadow frustum + follow player = shadow detail tăng đáng kể.

### Acceptance Criteria
- [ ] **Shrink shadow bounds**: `shadowCameraLeft/Right/Top/Bottom` từ ±20 → ±12. Effective texel density tăng ~2.8x (20/12)²
- [ ] **Dynamic shadow follow**: Trong `environment-themes.js` hoặc `game-main.js`, mỗi frame (throttle 500ms) update shadow light target position = camera world position (clamped to arena bounds ±10)
- [ ] **Shadow bias tuning**: Set `shadow.bias = -0.001` và `shadow.normalBias = 0.02` để giảm shadow acne trên metallic surfaces
- [ ] **Shadow map size**: Giữ 1024x1024 (Quest 2 safe). Comment option 2048x2048 cho Quest 3
- [ ] **Performance**: Shadow update throttle 500ms = 2 shadow recalc/second thay vì every frame
- [ ] **Fallback**: Nếu `settings.shadows === false`, disable hoàn toàn (hiện có nhưng verify)

---

## TASK-362: Draw Call Batching — Merge Distant Environment
**Priority:** Medium
**Status:** ✅ Completed (2026-02-02)
**Assigned:** /dev

### Description
Mỗi theme spawn 15-30 A-Frame entities cho `distantEnv` + `belowEnv` (buildings, stars, coral, nebulae...). Mỗi entity = 1 draw call. Merge static geometries thành batched meshes để giảm draw calls.

### Acceptance Criteria
- [ ] Tạo function `_batchStaticDecorations(items)` trong `environment-themes.js`
- [ ] **Geometry merging**: Group items theo material type:
  - Group 1: PBR metallic objects (buildings, asteroids, coral) → merge geometry, share single MeshStandardMaterial
  - Group 2: Flat shader objects (stars, nebulae, grid lines) → merge, share single MeshBasicMaterial
  - Group 3: Animated objects (rotating asteroids, whale, kelp sway) → KHÔNG merge, giữ riêng
- [ ] **Implementation**: Sử dụng `THREE.BufferGeometryUtils.mergeGeometries()`:
  - Parse A-Frame entity definitions → create Three.js geometries with transforms applied
  - Merge per group → tạo single `THREE.Mesh` per group
  - Attach vào `#distant-env` hoặc `#below-void` container
- [ ] **Animated objects**: Detect items có `animation` attribute → exclude from merge, spawn as normal A-Frame entities
- [ ] **Target**: Giảm draw calls từ ~25 → ~5 per theme cho static decorations
- [ ] **Theme switch**: Khi theme change, dispose old batched meshes, generate new ones
- [ ] **Performance**: Batch generation < 50ms. Single-frame operation (không async)
- [ ] **Fallback**: Nếu `mergeGeometries` fail (missing util) → fallback về current entity spawning
- [ ] **Import**: `BufferGeometryUtils` từ Three.js examples — vendor hoặc inline utility function

---

## V23 — Tension & Thrill Upgrade

> **Goal:** Tăng cảm giác gây cấn với clutch moments, risk/reward mechanics, environmental tension. Từ "fun shooter" → "heart-pounding experience".

## TASK-350: Last Stand Mode
**Priority:** High
**Status:** Completed (2026-02-01)
**Assigned:** /dev

### Description
Khi HP=1, kích hoạt Last Stand: desaturate screen, heartbeat nhanh, camera micro-shake. Bắn trúng 5 liên tiếp → hồi 1 HP, color restore + "SURVIVED!" flash.

### Acceptance Criteria
- [ ] Detect HP=1 trong `game-main.js` (listen `gameModeManager.loseLife()` result)
- [ ] **Visual**: Desaturate scene via bloom-effect uniform `uSaturation` → 0.2 (near grayscale)
- [ ] **Audio**: Heartbeat interval giảm từ 500ms → 350ms (faster than current critical)
- [ ] **Camera**: Subtle micro-shake (intensity 0.005, continuous, not per-event)
- [ ] **Recovery**: Track consecutive hits during Last Stand. 5 consecutive hits = +1 HP
- [ ] **Recovery FX**: Flash green vignette, "SURVIVED!" HUD text (2s), restore saturation over 1s
- [ ] **HUD**: Hiện "LAST STAND" text nhấp nháy đỏ khi active
- [ ] Reset Last Stand state on HP recovery hoặc game over
- [ ] Chỉ áp dụng cho modes có lives (survival, bossRush, reflexRush). Ignore cho timeAttack/zen

---

## TASK-351: Bomb Targets
**Priority:** High
**Status:** Completed (2026-02-01)
**Assigned:** /dev

### Description
Target loại mới "bomb" — có countdown 3s, không bắn kịp = nổ mất 1 HP. Bắn nhầm decoy gần bomb cũng trigger nổ. Spawn từ wave 3+.

### Acceptance Criteria
- [ ] Thêm `bomb` vào `TARGET_TYPES`: weight 0 (controlled spawn), points 40, radius 0.35, hp 1, lifetime 3000ms
- [ ] **Visual**: Đỏ sáng, pulsing scale animation (1.0→1.2, 300ms), countdown number hiện trên target (3→2→1)
- [ ] **Countdown**: 3s timer, mỗi giây emit beep sound (ascending pitch), flash đỏ hơn
- [ ] **Explosion on miss**: Khi lifetime hết → `onPlayerDamage('bomb')`, explosion particles (30 particles, red/orange), camera shake (intensity 0.04, 300ms), explosion SFX
- [ ] **Chain explosion**: Nếu decoy bị bắn trong radius 2m của bomb → trigger bomb explosion sớm
- [ ] **Defuse reward**: Bắn trúng bomb = +40 points, satisfying "defuse" SFX (relief tone), green particles
- [ ] **Spawn logic**: `_pickTargetType()` spawn bomb mỗi 8-12 targets (random), chỉ từ wave 3+
- [ ] **Max 1 bomb** active cùng lúc (tránh overwhelming)
- [ ] Thêm `playBombTick()`, `playBombExplode()`, `playBombDefuse()` vào audio-manager.js

---

## TASK-352: Chain Lightning Combo
**Priority:** Medium
**Status:** Completed (2026-02-01)
**Assigned:** /dev

### Description
Combo ≥15: spawn rate tăng 1.5x. Combo ≥25: spawn "chain" targets (bắn theo thứ tự 1→2→3). Sai thứ tự = reset combo. High risk/high reward.

### Acceptance Criteria
- [ ] **Combo 15+ acceleration**: Trong `onComboChange`, nếu combo ≥ 15 → `targetSystem.setSpawnRate(originalRate * 0.67)` (1.5x faster). Reset khi combo break
- [ ] **Chain targets** (combo ≥ 25): Spawn 3 targets đánh số 1, 2, 3 cùng lúc
- [ ] Chain target visual: Số hiện rõ trên target (a-text child), connected bằng thin laser line giữa 1→2→3
- [ ] **Order enforcement**: Bắn target 2 trước target 1 = combo reset + "CHAIN BREAK!" text
- [ ] Bắn đúng thứ tự: mỗi target +50 points, complete chain = bonus +100
- [ ] **Chain spawn**: 1 chain set mỗi 15s khi combo ≥ 25 (tránh spam)
- [ ] Chain targets có lifetime 5s (longer than normal), vị trí spread rộng (force player look around)
- [ ] **Visual feedback**: Target đang "next" glow sáng hơn, các target khác dim
- [ ] Reset chain state khi combo drop < 25

---

## TASK-353: Darkness Wave
**Priority:** Medium
**Status:** Completed (2026-02-01)
**Assigned:** /dev

### Description
Mỗi 60s, arena tối dần (2s), chỉ còn target emissive glow + weapon laser. 10s duration, targets nhanh hơn.

### Acceptance Criteria
- [ ] **Trigger**: Mỗi 60s trong game (timer hoặc elapsed time), dispatch `darkness-wave` event
- [ ] **Fade to dark** (2s): Giảm tất cả light intensity về 10% gốc, ambient light → near zero
- [ ] **Target glow**: Targets giữ emissive material (already glowing), tăng emissiveIntensity 2x trong darkness
- [ ] **Weapon laser**: Giữ visible, tăng opacity (guidance in dark)
- [ ] **Speed boost**: Targets di chuyển 1.5x nhanh hơn trong darkness
- [ ] **Duration**: 10s, sau đó lights fade back (2s restore)
- [ ] **Warning**: 3s trước darkness: "DARKNESS INCOMING..." HUD text + low rumble SFX
- [ ] **Bonus**: Mỗi kill trong darkness = 2x points
- [ ] **Visual**: Chỉ target glow + muzzle flash + laser visible. Arena gần như đen hoàn toàn
- [ ] Thêm `playDarknessWarn()`, `playDarknessStart()`, `playDarknessEnd()` vào audio-manager
- [ ] **Skip**: Không trigger darkness trong boss fight hoặc khi Last Stand active
- [ ] Settings: `settings.darknessWave` toggle (on/off)

---

## TASK-354: Rival Ghost
**Priority:** Low
**Status:** Completed (2026-02-01)
**Assigned:** /dev

### Description
Ghost replay của high-score run. Hiện ghost indicator (ahead/behind PB). Behind = tense visual.

### Acceptance Criteria
- [ ] **Record**: Mỗi game, lưu `ghostData[]` = array of `{time, score}` mỗi 1s vào localStorage
- [ ] **Replay**: Game mới load `ghostData` từ best run, compare real-time score vs ghost score
- [ ] **HUD indicator**: Nhỏ gọn ở góc: "▲ +120 AHEAD" (green) hoặc "▼ -50 BEHIND" (red)
- [ ] **Behind tension**: Khi behind PB → nhẹ red tint vignette (0.1 intensity), music intensity +1
- [ ] **Ahead reward**: Khi ahead → subtle gold shimmer on HUD border
- [ ] **New PB flash**: Khi vượt qua PB score → "NEW RECORD PACE!" flash gold (3s)
- [ ] Chỉ hiện ghost nếu có previous run data (first game = no ghost)
- [ ] **Data format**: `localStorage.setItem('ghostRun_' + mode, JSON.stringify(ghostData))`
- [ ] Settings: `settings.rivalGhost` toggle (on/off)

---

## TASK-355: Sudden Death Overtime
**Priority:** High
**Status:** Completed (2026-02-01)
**Assigned:** /dev

### Description
Khi timer=0 trong timeAttack/reflexRush, nếu score ≥ 80% high score → "OVERTIME!" 10s bonus. Hit=+1s, Miss=-2s.

### Acceptance Criteria
- [ ] **Trigger check** trong `endGame()`: Nếu timed mode + score ≥ 80% highScore → enter overtime thay vì end
- [ ] **Overtime state**: `_overtimeActive = true`, `_overtimeTime = 10`
- [ ] **Timer**: Riêng biệt, hiện đỏ nhấp nháy, format "OT: 8.5s" (1 decimal)
- [ ] **Hit bonus**: Mỗi target hit = +1s (cap tại 15s total overtime)
- [ ] **Miss penalty**: Mỗi miss/expire = -2s
- [ ] **End**: Overtime kết thúc khi `_overtimeTime ≤ 0` → actual endGame()
- [ ] **Visual**: "⚡ OVERTIME!" banner lớn (fade after 2s), màn hình red pulse border, spawn rate 2x
- [ ] **Audio**: Dramatic start sound (horn/siren), ticking clock SFX mỗi giây, heartbeat 300ms
- [ ] **Scoring**: Points trong overtime vẫn tính normal (no bonus, no penalty)
- [ ] **HUD**: Thay timer bằng overtime timer, flash animation
- [ ] Chỉ trigger 1 lần per game (không lặp lại overtime)
- [ ] Thêm `playOvertimeStart()`, `playOvertimeTick()`, `playOvertimeEnd()` vào audio-manager

---

## V22 — 3D Graphics Upgrade

> **Goal:** Nâng cấp chất lượng đồ họa 3D: environment map reflections cho metallic surfaces, procedural normal map cho sàn, enhanced muzzle flash với GPU particles + dynamic light. Từ "flat materials" → polished reflective PBR look.

## TASK-340: Environment Map Reflections
**Priority:** High
**Status:** Completed (2026-02-01)
**Assigned:** /dev

### Description
Tạo procedural cubemap bằng PMREMGenerator cho metallic materials. Sàn, pillars, weapons, targets sẽ phản chiếu môi trường xung quanh. Per-theme cubemap colors matching theme palette. Áp dụng qua `scene.environment` (Three.js built-in, A-Frame object3D accessible).

### Acceptance Criteria
- [ ] Tạo `client/src/js/components/env-reflections.js` — A-Frame component
- [ ] **Procedural cubemap generation** bằng PMREMGenerator:
  - Tạo simple scene (gradient sky + colored lights matching theme) → render to cubemap
  - Apply vào `this.el.object3D.environment` để tất cả PBR materials tự nhận reflection
  - Generate 1 lần khi scene init, cache kết quả
- [ ] **Per-theme cubemap** — listen `theme-changed` event:
  - Cyber: dark blue sky, neon accent lights (blue/pink)
  - Sunset: warm orange/red gradient, golden highlights
  - Space: deep black, blue/purple nebula tints
  - Underwater: teal/cyan ambient, caustic-like patterns
  - Neon: saturated magenta/cyan highlights
  - Day: bright neutral white/blue sky
- [ ] **Selective application**: Override `envMapIntensity` per material type:
  - Floor: 0.3 (subtle reflection)
  - Pillars/barriers: 0.5
  - Weapons: 0.7 (shiny)
  - Targets: 0.4
- [ ] Register component: `<a-scene env-reflections>`
- [ ] Performance: Cubemap resolution 128x128 (đủ cho diffuse reflection). Generation < 100ms
- [ ] Quest 2 safe: PMREMGenerator sử dụng existing WebGL context, không thêm render target
- [ ] Settings: `settings.reflections` (on/off). Off = skip cubemap generation

---

## TASK-341: Floor Detail — Procedural Normal Map
**Priority:** Medium
**Status:** Completed (2026-02-01)
**Assigned:** /dev

### Description
Canvas-generated normal map cho sàn arena. Tạo hex grid / tech line pattern bằng 2D canvas, convert thành Three.js texture, apply vào floor material. Tăng chi tiết bề mặt mà không cần external texture files. Per-theme patterns.

### Acceptance Criteria
- [ ] Tạo function `generateFloorNormalMap(theme)` trong `env-reflections.js` hoặc `environment-themes.js`
- [ ] **Canvas-generated normal map** (512x512):
  - Cyber: hex grid pattern + circuit traces
  - Sunset: cracked earth / stone tiles
  - Space: metal panel seams + rivet dots
  - Underwater: sandy ripple pattern
  - Neon: glowing grid lines (stronger normals at grid intersections)
  - Day: subtle concrete texture
- [ ] **Apply to floor**: Modify floor material trong `environment-themes.js`:
  - Set `normalMap` property
  - `normalScale` = new THREE.Vector2(0.3, 0.3) — subtle, not overwhelming
  - Tiling: `repeat.set(8, 8)` cho tiled pattern
- [ ] **Roughness map** (optional bonus): Use same canvas to vary roughness — grid lines slightly smoother than panels
- [ ] Generate once per theme change, cache canvas textures
- [ ] Performance: Canvas generation < 50ms, single texture lookup per fragment
- [ ] Settings: `settings.floorDetail` (on/off). Off = flat floor (current behavior)

---

## TASK-342: Enhanced Muzzle Flash
**Priority:** Medium
**Status:** Completed (2026-02-01)
**Assigned:** /dev

### Description
Nâng cấp muzzle flash khi bắn: GPU particle burst từ weapon tip + dynamic point light flash. Sử dụng existing gpu-particles system (`window.__spawnGPUBurst`). Thêm temporary point light (50ms) tại weapon tip, color matches weapon laser color.

### Acceptance Criteria
- [ ] **Muzzle particle burst** trong `shoot-controls.js` khi fire:
  - Gọi `window.__spawnGPUBurst` với preset 'muzzle' tại weapon tip position
  - 8-12 particles, 80ms lifetime, weapon color
  - Spread: small cone forward (0.3 spread)
  - Size: 0.02-0.04
- [ ] **Dynamic point light** flash:
  - Tạo `THREE.PointLight` attach vào weapon tip
  - Color = weapon laserColor, intensity = 2.0, distance = 3
  - Duration: 50ms → fade to 0 over 30ms
  - castShadow = false (performance)
  - Reuse single light object, don't create/destroy per shot
- [ ] **Rate limiting**: Max 1 flash every 80ms (prevent strobe effect with SMG/auto-fire)
- [ ] **Visual tuning**: Flash noticeable nhưng not distracting. Phải visible trong cả bright và dark themes
- [ ] Integrate: Modify `shoot-controls.js` hoặc `weapon-model.js`
- [ ] Performance: Single reused PointLight, no shadow recalculation
- [ ] Settings: `settings.muzzleFlash` (on/off). Off = no particles, no light (current behavior)
- [ ] Quest 2: Test light doesn't cause frame drops (no shadows = safe)

---

## V21 — Audio & Visual Polish

> **Goal:** Nâng cấp audio với dynamic music system + reverb + UI sounds, và mở rộng post-processing pipeline với vignette, damage flash, color grading per theme. Từ "sounds flat, looks uniform" → immersive audiovisual experience.

## TASK-330: Dynamic Music System
**Priority:** High
**Status:** Completed (2026-02-01)
**Assigned:** /dev

### Description
Procedural adaptive music system bằng Web Audio API. Không dùng audio files — tất cả generate bằng oscillators, gain nodes, filters. Music gồm 4 intensity layers crossfade theo gameplay state. Per-theme tonal palette (cyber=minor synth, sunset=warm pads, space=ambient drone, underwater=deep resonance).

### Acceptance Criteria
- [ ] Tạo `client/src/js/core/music-manager.js` — ES module
- [ ] **4 Intensity Layers** (crossfade via gain nodes):
  - `ambient` (0): Soft pad chord + subtle arpeggios (2 oscillators). Volume 0.15
  - `active` (1): Add rhythmic pulse + bass line (4 oscillators). Volume 0.25
  - `combat` (2): Add percussion (noise bursts) + faster arpeggios (6 oscillators). Volume 0.35
  - `frenzy` (3): Full intensity — all layers + distortion filter + octave up (8 oscillators max). Volume 0.4
- [ ] **Intensity transitions**: Crossfade over 2s. Triggered by events:
  - Game idle/menu → ambient
  - Game playing, combo < 5 → active
  - Combo ≥ 5 or boss mode → combat
  - Frenzy mode or surge event → frenzy
  - Game over → fade to silence over 3s
- [ ] **Per-theme tonal palette**:
  - Cyber: C minor, sawtooth + square, filter cutoff 800Hz
  - Sunset: D major, triangle + sine, warm filter 1200Hz
  - Space: A minor, sine + sine (detuned), reverb-heavy, filter 400Hz
  - Underwater: E minor, triangle, low-pass 600Hz, slow LFO modulation
  - Neon: F# minor, square + sawtooth, high-pass 200Hz, fast arpeggios
- [ ] **Randomized phrases**: Arpeggio patterns randomly pick from 4 note sequences per key, change every 8 bars
- [ ] **Beat sync**: Internal BPM (100 ambient → 140 frenzy), used by rhythm targets (TASK-257)
- [ ] **Settings**: `settings.music` = on/off, `settings.musicVolume` = 0-100
- [ ] **API**: `start(theme)`, `stop()`, `setIntensity(level)`, `getBPM()`, `onBeat(callback)`
- [ ] Max 8 concurrent oscillators. Reuse nodes, don't create/destroy per beat
- [ ] Integrate with `game-main.js`: start on game start, set intensity from combo/events, stop on game over

---

## TASK-331: Audio Polish — Reverb, UI Sounds, Dissolve SFX
**Priority:** Medium
**Status:** Completed (2026-02-01)
**Assigned:** /dev

### Description
Thêm ConvolverNode reverb cho spatial depth, UI interaction sounds, và các SFX còn thiếu (dissolve, surge, debuff). Tất cả procedural — no audio files.

### Acceptance Criteria
- [ ] **Reverb system** trong `audio-manager.js`:
  - Tạo procedural impulse response (noise burst → exponential decay, 1.5s)
  - ConvolverNode connected after SFX gain, trước master output
  - Reverb send/dry mix: `settings.reverbAmount` (0-100, default 30)
  - Per-theme reverb: Underwater = long (2s), Space = very long (3s), Cyber = short (0.8s)
- [ ] **UI Sounds** (thêm methods vào audio-manager.js):
  - `playUIHover()` — soft tick (sine 2000Hz, 20ms)
  - `playUIClick()` — crisp click (square 1500Hz, 30ms)
  - `playUIToggle()` — two-tone toggle (sine 800→1200Hz hoặc 1200→800Hz, 60ms)
  - `playUIBack()` — descending tone (triangle 1000→600Hz, 80ms)
  - `playUIError()` — harsh buzz (sawtooth 200Hz, 150ms, low volume)
- [ ] **Missing SFX**:
  - `playDissolve()` — rising noise sweep + shimmer (300ms, match dissolve duration)
  - `playSurgeStart()` — dramatic low boom + ascending power chord (TASK-311)
  - `playSurgeEnd()` — descending fade + release
  - `playDebuffApply()` — dark dissonant tone (TASK-312)
  - `playDebuffClear()` — bright resolution chord
  - `playArenaClose()` — rumble + metal clang (TASK-313)
- [ ] **Integrate UI sounds**: Hook into menu buttons (settings panel, mode select, weapon select)
- [ ] Settings: `settings.sfxReverb` toggle (on/off)

---

## TASK-332: Vignette & Damage Flash Post-Processing
**Priority:** Medium
**Status:** Completed (2026-02-01)
**Assigned:** /dev

### Description
Mở rộng `bloom-effect.js` pipeline: thêm vignette (edge darkening), damage flash (red overlay khi bị hit), low-HP pulse (vignette throbs). Single extra shader pass, combined vào composite step.

### Acceptance Criteria
- [ ] **Vignette** — thêm vào composite fragment shader:
  - Radial darkening từ center ra edges
  - Uniforms: `uVignetteIntensity` (0.0-1.0, default 0.3), `uVignetteRadius` (default 0.75)
  - Smooth falloff: `smoothstep(radius, radius - softness, dist)`
- [ ] **Damage Flash** — red overlay:
  - Uniform `uDamageFlash` (0.0-1.0): mix red tint vào final color
  - Triggered by `player-damage` event → flash to 0.4, decay over 300ms
  - Low-HP pulse: khi HP ≤ 1, vignette intensity oscillates (0.3→0.6) at 1Hz
- [ ] **Kill Flash** — brief white/color flash:
  - Uniform `uKillFlash` (0.0-1.0): additive bright flash
  - Triggered by `crosshair-kill` event → flash to 0.15, decay over 100ms
  - Subtle — not distracting, just satisfying
- [ ] **Event listeners** trong bloom-effect.js:
  - `player-damage` → set uDamageFlash
  - `crosshair-kill` → set uKillFlash
  - `hp-update` → toggle low-HP pulse
- [ ] **VR safety**: Vignette + damage flash work in XR mode (unlike bloom which is disabled)
  - Use separate simple fullscreen quad for VR vignette
- [ ] Settings: `settings.vignette` (on/off), `settings.damageFlash` (on/off)
- [ ] Performance: Single additional shader pass, no extra render targets

---

## TASK-333: Color Grading & Tone Mapping
**Priority:** Medium
**Status:** Completed (2026-02-01)
**Assigned:** /dev

### Description
Per-theme color grading và tone mapping trong post-processing pipeline. Mỗi theme có color palette riêng (temperature, saturation, contrast). ACES tone mapping thay thế default linear. Exposure control cho HDR-like look.

### Acceptance Criteria
- [ ] **Tone mapping** — thêm vào composite fragment shader:
  - ACES Filmic tone mapping function (replace NoToneMapping)
  - Uniform `uExposure` (default 1.0): multiply color trước tone map
  - Result: brighter highlights bloom more, darker shadows have more detail
- [ ] **Color grading** — per-theme uniforms:
  - `uColorTemp` (warm/cool shift): Cyber=-0.1 (cool), Sunset=+0.15 (warm), Space=-0.05, Underwater=-0.15 (teal), Neon=0
  - `uSaturation` (0-2): Cyber=1.1, Sunset=1.2, Space=0.8, Underwater=0.9, Neon=1.4
  - `uContrast` (0-2): Cyber=1.1, Sunset=1.0, Space=1.15, Underwater=0.95, Neon=1.2
  - `uBrightness` (-0.5 to 0.5): fine-tune per theme
- [ ] **Implementation**: All grading in composite pass (no extra render targets):
  - Apply order: exposure → ACES tonemap → color temp → saturation → contrast → vignette
- [ ] **Theme switching**: Khi theme change, lerp grading uniforms over 1s (smooth transition)
- [ ] **Event listener**: `theme-changed` event → update grading uniforms
- [ ] **Settings**: `settings.colorGrading` (on/off), `settings.exposure` (0.5-2.0)
- [ ] **VR mode**: Color grading works in XR mode (applied per-eye via composite)
- [ ] Quest 2 safe: All operations trong single fragment shader, no extra texture lookups

---

## V20 — Visual & Interaction Upgrade

> **Goal:** Nâng cấp chất lượng hình ảnh và tương tác bằng cách tận dụng A-Frame ecosystem: GPU particles, 3D models, dissolve shader, hand tracking. Từ prototype visuals → polished game.

## TASK-320: GPU Particle System
**Priority:** High
**Status:** Completed (2026-02-01)
**Assigned:** /dev

### Description
Thay thế hệ thống particle hiện tại (manual entity spawning, capped ~15 entities) bằng `aframe-particle-system-component` (GPU-accelerated). Áp dụng cho: weather (rain/dust/snow), target destruction burst, muzzle flash, power-up activation, combo energy, ambient floating particles. Giữ nguyên fallback cho low-end devices.

### Acceptance Criteria
- [ ] Install `aframe-particle-system-component` (vendor vào `client/src/js/vendor/` — không dùng CDN)
- [ ] Register component trong `index.html` trước `<a-scene>`
- [ ] **Weather particles**: Replace `weather-system.js` entity spawning bằng particle-system preset per theme:
  - Cyber: neon rain (blue, 2000 particles, downward)
  - Sunset: dust motes (orange, 800 particles, slow drift)
  - Space: star field (white, 1500 particles, slow radial)
  - Underwater: bubbles (cyan, 1000 particles, upward)
- [ ] **Target destroy**: Replace `particle-burst.js` entity spawning bằng on-demand particle emitter (15 particles, burst mode, 500ms lifetime, color matches target)
- [ ] **Muzzle flash**: Particle burst at weapon tip on shoot (5 particles, 100ms, weapon color)
- [ ] **Ambient particles**: Replace `_spawnAmbientParticles()` trong `game-main.js` (70 entities) bằng 1 particle-system entity (2000 particles)
- [ ] **Power-up activation**: Radial particle burst khi power-up collected (20 particles, power-up color)
- [ ] Performance: Maintain 72fps on Quest 2 (total particles < 5000 active)
- [ ] Settings toggle: `settings.particles` = high/low/off. Low = halve particle counts. Off = disable all particle systems
- [ ] Cleanup all old entity-spawning particle code sau khi verify GPU particles work

---

## TASK-321: 3D Target Models (GLTF)
**Priority:** High
**Status:** Completed (2026-02-01)
**Assigned:** /dev

### Description
Thay thế primitive geometries (icosahedron, octahedron, sphere, torus, etc.) cho targets bằng low-poly GLTF models. Tạo procedural GLTF models bằng Three.js BufferGeometry export (không cần external 3D assets). Mỗi target type có model riêng biệt, dễ nhận diện hơn primitives.

### Acceptance Criteria
- [ ] Tạo `client/src/js/game/target-models.js` — module generate GLTF blobs từ Three.js geometries:
  - `standard`: Beveled cube với inner glow core (thay icosahedron)
  - `speed`: Arrow/dart shape, elongated (thay octahedron)
  - `heavy`: Armored sphere với hexagonal plates (thay dodecahedron)
  - `bonus`: Spinning coin/gem shape (thay torus)
  - `decoy`: Cracked sphere với dark aura (thay sphere)
  - `powerup`: Glowing crystal cluster (thay torus-knot)
  - `blink`: Phasing ghost shape — outer wireframe shell + inner solid core
  - `peripheral`: Radar dish / satellite shape
  - `debuff`: Skull-like shape (angular, menacing)
  - `colorMatch`: Giữ shape differentiation hiện tại nhưng thêm detail
- [ ] Models auto-generated on first load, cached trong memory (no file downloads)
- [ ] `target-system.js` sử dụng models từ `target-models.js` thay vì primitive elements
- [ ] Mỗi model có: base mesh + emissive glow mesh + animation-ready structure
- [ ] Scale tương đương với primitive radius hiện tại (không thay đổi gameplay hitbox)
- [ ] Boss targets: scaled-up version với extra detail layers
- [ ] Performance: Model generation < 500ms total, reuse instances via `.clone()`
- [ ] Fallback: Nếu model generation fail → revert về primitive geometry (graceful degradation)

---

## TASK-322: Dissolve Shader Effect
**Priority:** Medium
**Status:** Completed (2026-02-01)
**Assigned:** /dev

### Description
Custom dissolve shader cho target destruction. Khi target bị hit (HP = 0), thay vì remove ngay, target dissolve trong 400ms sử dụng Perlin noise pattern. Particles bay ra từ dissolving edges. Áp dụng cho tất cả target types với color tint theo target color.

### Acceptance Criteria
- [ ] Tạo `client/src/js/components/dissolve-effect.js` — A-Frame component
- [ ] Custom ShaderMaterial sử dụng Perlin/Simplex noise:
  - Uniform `dissolveProgress` (0.0 → 1.0 over 400ms)
  - Dissolve từ edges vào center
  - Edge glow: bright emission color tại dissolve boundary (2px wide)
  - Alpha cutoff theo noise threshold
- [ ] Register component: `<a-entity dissolve-effect="color: #ff4444; duration: 400">`
- [ ] Trigger: Khi target bị destroy, apply dissolve thay vì instant remove
- [ ] Color tint: Dissolve edge color = target's primary color
- [ ] Particle emission: Spawn small particles along dissolve edge (reuse TASK-320 GPU particles nếu available)
- [ ] Audio: Subtle dissolve sound (procedural — rising noise sweep)
- [ ] Performance: Shader compiled once, reused via material cloning. Max 5 simultaneous dissolves
- [ ] Settings: `settings.dissolveEffect` toggle. Off = instant remove (legacy behavior)
- [ ] Quest 2 compatible: Test shader trên Quest 2 browser, fallback nếu shader compilation fails

---

## TASK-323: Hand Tracking Controls
**Priority:** High
**Status:** Completed (2026-02-01)
**Assigned:** /dev

### Description
Thêm hand tracking support cho Quest 2/3. Sử dụng A-Frame `hand-tracking-controls` component. Pinch gesture = shoot, hand raise = pause, open palm = menu. Auto-detect: nếu có controllers thì dùng controllers, nếu không thì hand tracking. Larger hit targets khi dùng hands (compensate cho lower accuracy).

### Acceptance Criteria
- [ ] Tạo `client/src/js/components/hand-shoot.js` — A-Frame component cho hand-based shooting
- [ ] Detect input mode: `navigator.xr` session check cho `hand-tracking` feature
  - Controller detected → existing `shoot-controls.js` (no change)
  - Hand tracking detected → activate `hand-shoot` component
- [ ] **Hand entities** trong `index.html`:
  - Left hand: `hand-tracking-controls="hand: left; modelStyle: mesh; modelColor: #44aaff"`
  - Right hand: `hand-tracking-controls="hand: right; modelStyle: mesh; modelColor: #ff4444"` + `hand-shoot`
- [ ] **Shoot gesture**: Right hand pinch (index + thumb) = fire raycaster from index finger tip
  - Raycaster direction: from index finger tip, along finger pointing direction
  - Visual: thin laser line from fingertip (same as controller laser)
  - Audio: same shoot SFX
  - Haptic: N/A (hand tracking không có haptic)
- [ ] **Aim assist**: Khi hand tracking active, target hitbox tăng 1.5x (compensate inaccuracy)
- [ ] **Crosshair**: Hiện crosshair dot tại raycaster intersection point
- [ ] **Menu interaction**: Left hand index finger point + pinch = click on menu buttons (replaces controller cursor)
- [ ] **Pause gesture**: Both hands open palm facing camera for 1s = toggle pause
- [ ] **HUD indicator**: Hiện "🤚 Hand Mode" hoặc "🎮 Controller Mode" khi game start (fade after 3s)
- [ ] **Settings**: `settings.handTracking` = auto/on/off. Auto = detect, On = force hands, Off = controllers only
- [ ] **Smooth transition**: Nếu player pick up controller mid-game → seamlessly switch to controller mode
- [ ] Fallback: Non-Quest browsers hoặc Quest 2 without hand tracking firmware → component không activate, no errors
- [ ] Test: Verify cả 2 modes work trên Quest 2 (controller) và Quest 3 (hand tracking)

---

## V32 — Ultra Performance Mode (Quest 40 FPS → 90 FPS)

> **Goal:** V31 không đủ. Cắt TOÀN BỘ visual effects còn lại để đạt 90 FPS.
> **Strategy:** TẮT HẾT - không compromise. Quest = Performance Mode.
> **Ref:** TechLead analysis 2026-02-05, post-V31 review

### Performance Budget (Quest 2) — AGGRESSIVE

| Resource | V31 | V32 Target | Action |
|----------|-----|------------|--------|
| Dynamic Lights | 2 | **1** | Remove directional |
| Muzzle flash | Yes | **No** | TẮT |
| Laser trail | Yes | **No** | TẮT |
| Shell casing | Yes | **No** | TẮT |
| Ricochet VFX | Yes | **No** | TẮT |
| Impact marks | Yes | **No** | TẮT |
| Tension vignette | Yes | **No** | TẮT |
| Heartbeat audio | Yes | **No** | TẮT |
| Surge events | Yes | **No** | TẮT |
| Camera shake | Yes | **No** | TẮT |
| FOV punch | Yes | **No** | TẮT |
| Target animations | Yes | **No** | TẮT |
| Bloom effect | Yes | **No** | TẮT |
| Env reflections | Yes | **No** | TẮT |
| GPU particles | Yes | **No** | TẮT |
| Haptics | Yes | **No** | TẮT |
| HUD elements | 7 | **2** | Score + Timer only |

---

## TASK-430: Disable shoot-controls.js Effects on Quest
**Priority:** Critical
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
shoot-controls.js spawns nhiều entities per shot: muzzle flash, laser trail, shell casing, ricochet, impact marks. TẮT HẾT trên Quest.

### Acceptance Criteria
- [ ] Add Quest detection at top of file
- [ ] In `_fireBullet()`: Skip muzzle flash, laser trail, shell casing creation
- [ ] In `_onMiss()`: Skip ricochet and impact mark creation
- [ ] Keep audio feedback (still needs confirmation sound)
- [ ] Keep damage logic (still needs to hit targets)

### Files Changed
- `client/src/js/components/shoot-controls.js`

---

## TASK-431: Disable tension-system.js on Quest
**Priority:** Critical
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
tension-system.js gây CSS overlay + audio intervals + DOM manipulation. TẮT HẾT trên Quest.

### Acceptance Criteria
- [ ] Add Quest detection in constructor or init
- [ ] Return early from `start()` if Quest
- [ ] Log `[tension-system] Disabled on Quest for performance`

### Files Changed
- `client/src/js/game/tension-system.js`

---

## TASK-432: Disable camera-effects.js on Quest
**Priority:** Critical
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Camera shake và FOV punch gây transform calculations mỗi frame. TẮT trên Quest.

### Acceptance Criteria
- [ ] Add Quest detection at component level
- [ ] Skip shake logic in tick() if Quest
- [ ] Skip FOV punch event handler if Quest
- [ ] Keep basic camera functionality

### Files Changed
- `client/src/js/components/camera-effects.js`

---

## TASK-433: Reduce Lights to 1 on Quest
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Hiện tại có 2 lights (ambient + directional). Remove directional trên Quest, chỉ giữ ambient.

### Acceptance Criteria
- [ ] In `game.html` Quest detection script: Remove directional light
- [ ] Increase ambient intensity từ 0.7 → 1.0 để compensate
- [ ] Verify gameplay vẫn visible

### Files Changed
- `client/src/game.html`

---

## TASK-434: Disable Target Animations on Quest
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Target spawn với float, move, rotate animations. TẮT HẾT trên Quest.

### Acceptance Criteria
- [ ] In `target-spawner.js`: Skip animation attributes when Quest
- [ ] Targets spawn static (no float, no move, no rotate)
- [ ] Keep target color và material (visibility)

### Files Changed
- `client/src/js/game/target-spawner.js`

---

## TASK-435: Simplify HUD on Quest
**Priority:** Medium
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
HUD hiện có 7 elements: score, timer, combo, lives, weapon, level, boss bar. Chỉ giữ 2: score + timer.

### Acceptance Criteria
- [ ] In `game.html` Quest detection: Hide combo, lives, weapon, level elements
- [ ] Or in `game-main.js`: Skip HUD updates for non-essential elements
- [ ] Boss bar hide entirely on Quest
- [ ] Score và Timer vẫn hoạt động bình thường

### Files Changed
- `client/src/game.html` hoặc `client/src/js/game-main.js`

---

## TASK-436: Disable Haptics on Quest
**Priority:** Medium
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Haptic feedback gọi Web API mỗi hit. Disable để save CPU cycles.

### Acceptance Criteria
- [ ] In `haptic-manager.js`: Return early from all methods if Quest
- [ ] Or check in `target-hit.js` before calling hapticManager
- [ ] Log `[haptics] Disabled on Quest for performance`

### Files Changed
- `client/src/js/core/haptic-manager.js` hoặc `client/src/js/components/target-hit.js`

---

## TASK-437: Disable GPU Particles on Quest
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
GPU particles system vẫn chạy cho kill bursts. TẮT HẾT trên Quest.

### Acceptance Criteria
- [ ] In `gpu-particles.js`: Add Quest detection, return early from init
- [ ] In `target-hit.js`: Skip GPU particle burst call on Quest
- [ ] No particles spawned on kill

### Files Changed
- `client/src/js/components/gpu-particles.js`
- `client/src/js/components/target-hit.js`

---

## TASK-438: Disable bloom-effect.js on Quest
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Bloom effect = post-processing pass. Remove trên Quest.

### Acceptance Criteria
- [ ] In `bloom-effect.js`: Add Quest detection in init, return early
- [ ] Or in `game.html`: Remove `bloom-effect` attribute on Quest
- [ ] Log `[bloom-effect] Disabled on Quest for performance`

### Files Changed
- `client/src/js/components/bloom-effect.js` hoặc `client/src/game.html`

---

## TASK-439: Disable env-reflections.js on Quest
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Environment reflections = extra render pass. Remove trên Quest.

### Acceptance Criteria
- [ ] In `env-reflections.js`: Add Quest detection in init, return early
- [ ] Or in `game.html`: Remove `env-reflections` attribute on Quest
- [ ] Log `[env-reflections] Disabled on Quest for performance`

### Files Changed
- `client/src/js/components/env-reflections.js` hoặc `client/src/game.html`

---

## V33 — CSS DOM Elimination (JavaScript Overlay Prevention)

> **Goal:** Achieve 90 FPS on Quest by preventing JavaScript from creating CSS overlay DOM elements.
> **Root Cause:** V30 CSS rules hide overlays with `.vr-mode`, but JavaScript still creates DOM elements and manipulates classes, causing browser style computation overhead.
> **Strategy:** Skip DOM creation entirely on Quest — no element = no computation.
> **Ref:** TechLead analysis 2026-02-05

### Problem Analysis

| Overlay | JavaScript | CSS | Issue |
|---------|-----------|-----|-------|
| combo-vignette | `_updateComboVignette()` creates DOM | `.vr-mode` hides | DOM still created |
| slow-mo-overlay | `_showSlowMoOverlay()` creates DOM | `.vr-mode` hides | DOM still created |
| tension-vignette | `tensionSystem._ensureVignette()` | `.vr-mode` hides | DOM still created |
| debuff-fog-overlay | `tensionSystem._ensureVignette()` | `.vr-mode` hides | DOM still created |

**Fix:** Add Quest detection in JavaScript functions to skip DOM creation entirely.

---

## TASK-440: Skip combo-vignette DOM Creation on Quest
**Priority:** Critical
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
`_updateComboVignette()` in game-main.js creates `combo-vignette` div on every combo update. On Quest, skip creation entirely.

### Acceptance Criteria
- [x] Add Quest detection at module level in game-main.js
- [x] In `_updateComboVignette()`: if Quest, return early before DOM manipulation
- [x] Verify: No `combo-vignette` element exists in DOM on Quest

### Files Changed
- `client/src/js/game-main.js`

### Performance Impact
- Expected: Eliminates combo vignette style computation

---

## TASK-441: Skip slow-mo-overlay DOM Creation on Quest
**Priority:** Critical
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
`_showSlowMoOverlay()` in game-main.js creates `slow-mo-overlay` div. On Quest, skip creation entirely.

### Acceptance Criteria
- [x] In `_showSlowMoOverlay()`: if Quest, return early
- [x] In slow-motion event handler: if Quest, skip overlay show
- [x] Verify: No `slow-mo-overlay` element exists in DOM on Quest

### Files Changed
- `client/src/js/game-main.js`

### Performance Impact
- Expected: Eliminates slow-mo overlay style computation

---

## TASK-442: Skip tension-vignette DOM Creation on Quest
**Priority:** Critical
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
`tensionSystem._ensureVignette()` creates `tension-vignette` div. tension-system.js already has Quest detection to disable the system, but `_ensureVignette()` may still be called. Ensure no DOM creation on Quest.

### Acceptance Criteria
- [x] In `_ensureVignette()`: if Quest detection active, skip DOM creation
- [x] Verify: No `tension-vignette` element exists in DOM on Quest
- [x] Verify: No `debuff-fog-overlay` element exists in DOM on Quest

### Files Changed
- `client/src/js/game/tension-system.js`

### Performance Impact
- Expected: Eliminates tension vignette style computation

---

## TASK-443: Skip All Vignette Updates on Quest
**Priority:** Critical
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Multiple functions in game-main.js update vignette states (`_updateVignetteDanger`, `_updateVignetteCombo`). On Quest, these should be no-ops.

### Acceptance Criteria
- [x] In tension-system.js: `_updateVignetteDanger()` and `_updateVignetteCombo()` check Quest before DOM manipulation
- [x] Verify: No vignette class changes occur on Quest

### Files Changed
- `client/src/js/game/tension-system.js`

### Performance Impact
- Expected: Zero vignette-related DOM operations on Quest

---

## TASK-444: Ensure Global Quest Flag Set Early
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Multiple files have their own `_isQuest` detection. Ensure `window.__isQuestDevice` is set very early (before any module loads) for consistent detection.

### Acceptance Criteria
- [x] In game.html: Add inline script BEFORE any module imports:
  ```html
  <script>
  window.__isQuestDevice = /Quest|Android|Mobile/i.test(navigator.userAgent);
  </script>
  ```
- [x] All modules can use `window.__isQuestDevice` for instant detection
- [x] Verify: Flag is available before any component init()

### Files Changed
- `client/src/game.html`

### Performance Impact
- Expected: Consistent, early Quest detection across all modules

---

## V34 — A-Frame Renderer & Raycaster Optimization (True Root Cause)

> **Goal:** Fix the ACTUAL bottleneck causing 40 FPS on Quest.
> **Root Cause:** A-Frame default settings are expensive on mobile GPU:
> - antialias: true (MSAA requires multiple render passes)
> - pixelRatio: devicePixelRatio (Quest has high DPI)
> - 3 raycasters checking ALL targets EVERY FRAME
> - Shadow system initialized before our disable script runs
> **Ref:** TechLead analysis 2026-02-05

### True Bottleneck Analysis

| Issue | Why It's Expensive | Impact |
|-------|-------------------|--------|
| **Default antialias** | MSAA = 4x fragment work | **-30 FPS** |
| **High pixelRatio** | More pixels to render | **-10 FPS** |
| **3 active raycasters** | Ray-mesh intersection tests/frame | **-15 FPS** |
| **Shadow in HTML** | System initializes before script | **-5 FPS** |

### Fix Strategy

1. Add explicit `renderer` attribute with Quest-optimized settings
2. Reduce raycaster complexity (disable a-cursor in VR, reduce far)
3. Move shadow removal to HTML (not script)
4. Remove bloom-effect/env-reflections attributes on Quest

---

## TASK-445: Add Quest-Optimized Renderer Settings
**Priority:** Critical
**Status:** Pending
**Assigned:** /dev

### Description
A-Frame uses expensive defaults: antialias=true, high pixelRatio. Add explicit renderer settings for Quest.

### Acceptance Criteria
- [ ] Add `renderer` attribute to `<a-scene>` in game.html:
  ```html
  <a-scene renderer="antialias: false; colorManagement: true; physicallyCorrectLights: false">
  ```
- [ ] For Quest, also set pixelRatio: 1.0 via script BEFORE scene loads
- [ ] Verify: No antialias on Quest (check renderer.capabilities)

### Files Changed
- `client/src/game.html`

### Performance Impact
- Expected FPS improvement: **+20-30** on Quest

---

## TASK-446: Reduce Raycaster Complexity on Quest
**Priority:** Critical
**Status:** Pending
**Assigned:** /dev

### Description
3 raycasters run every frame: a-cursor, left-hand, right-hand. Each checks ALL .target objects. On Quest VR, a-cursor is useless (only for desktop). Reduce raycaster far distance.

### Acceptance Criteria
- [ ] On Quest: Remove `a-cursor` element entirely (VR uses controller raycasters)
- [ ] Reduce raycaster `far` from 50 to 20 (targets spawn within 14m)
- [ ] Consider: Use raycaster `interval` attribute to reduce check frequency
- [ ] Verify: Only 2 raycasters active in VR

### Files Changed
- `client/src/game.html`

### Performance Impact
- Expected FPS improvement: **+10-15** on Quest

---

## TASK-447: Remove Shadow System from HTML
**Priority:** High
**Status:** Pending
**Assigned:** /dev

### Description
`shadow="type: pcfsoft"` is declared in HTML. Shadow system initializes BEFORE DOMContentLoaded script. Also `shadow="receive: true"` on floor plane.

### Acceptance Criteria
- [ ] Remove `shadow` attribute from `<a-scene>` in HTML
- [ ] Remove `shadow="receive: true"` from floor plane
- [ ] Verify: No shadow system initialized on Quest

### Files Changed
- `client/src/game.html`

### Performance Impact
- Expected FPS improvement: **+5-10** on Quest

---

## TASK-448: Remove Unused Scene Components on Quest
**Priority:** High
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
`bloom-effect` and `env-reflections` are attached to scene even though disabled. A-Frame still calls their lifecycle methods (init, tick, etc.).

### Acceptance Criteria
- [ ] On Quest: Remove `bloom-effect` and `env-reflections` attributes from scene via early script
- [ ] Alternative: Don't add these attributes at all in HTML, add via script only on desktop
- [ ] Verify: No bloom-effect or env-reflections components on Quest

### Files Changed
- `client/src/game.html`

### Performance Impact
- Expected FPS improvement: **+3-5** on Quest

---

## TASK-449: Create Quest-Only Scene Template
**Priority:** Medium
**Status:** Completed (2026-02-05)
**Assigned:** /dev

### Description
Current approach: same HTML for all, then remove things via script. Better approach: conditional HTML or early DOM manipulation.

### Acceptance Criteria
- [ ] Move ALL Quest modifications to a single early script block
- [ ] Script runs BEFORE A-Frame processes the scene
- [ ] Modifications: remove shadow, bloom-effect, env-reflections, a-cursor, reduce raycaster far
- [ ] Verify: Quest scene is minimal before A-Frame init

### Files Changed
- `client/src/game.html`

### Performance Impact
- Expected: Clean Quest initialization, no wasted work

---

## TASK-450: Skip 3D Target Models on Quest
**Priority:** Critical
**Status:** Pending
**Assigned:** /dev

### Description
`target-models.js` uses `MeshStandardMaterial` with PBR (metalness, roughness, emissive). Each model has 2-4 child meshes. Skip all 3D models on Quest and use simple primitives.

### Acceptance Criteria
- [ ] In `target-spawner.js`: Add Quest check before `use3DModels` decision
  ```javascript
  const use3DModels = !_isQuest && settings.targetModels !== false && targetModels.isReady();
  ```
- [ ] Quest targets use primitive geometry only (no Three.js model injection)
- [ ] Verify: No `getTargetModel()` calls on Quest

### Files Changed
- `client/src/js/game/target-spawner.js` (line ~196-211)

### Performance Impact
- Expected: **-3 draw calls per target** (each model has multiple meshes)

---

## TASK-451: Use Flat Shader for Quest Targets
**Priority:** Critical
**Status:** Pending
**Assigned:** /dev

### Description
Quest targets still use `material="color: X; metalness: 0.6; roughness: 0.3"` which defaults to `MeshStandardMaterial` (PBR). Use `shader: flat` instead.

### Acceptance Criteria
- [ ] In `target-spawner.js._applyPrimitiveMaterial()`: Quest branch uses flat shader
  ```javascript
  if (_isQuest) {
    el.setAttribute('material', `shader: flat; color: ${color}; emissive: ${color}; emissiveIntensity: 0.5`);
    return; // Skip wireframe overlay
  }
  ```
- [ ] Color + emissive provides visibility without PBR calculations
- [ ] Verify: Quest targets have no metalness/roughness

### Files Changed
- `client/src/js/game/target-spawner.js` (line ~513-540)

### Performance Impact
- Expected: **-50% fragment shader cost** (flat vs PBR per target)

---

## TASK-452: Remove Wireframe Overlay on Quest
**Priority:** High
**Status:** Pending
**Assigned:** /dev

### Description
Each target has a wireframe child element for visual effect. This adds +1 draw call per target. Remove on Quest.

### Acceptance Criteria
- [ ] In `_applyPrimitiveMaterial()`: Early return after setting material on Quest (skip wireframe creation)
- [ ] Verify: Quest targets have no wireframe children

### Files Changed
- `client/src/js/game/target-spawner.js` (line ~519-540)

### Performance Impact
- Expected: **-1 draw call per target** (4 targets = -4 draw calls)

---

## TASK-453: Skip Height Indicators on Quest
**Priority:** High
**Status:** Pending
**Assigned:** /dev

### Description
Floor/overhead targets get height indicator elements (ring/beam). These add +1 draw call per target. Skip on Quest.

### Acceptance Criteria
- [ ] In `spawnTargetAt()`: Wrap height indicator creation in `if (!_isQuest)`
- [ ] Lines 395-429: Skip floor ring, overhead beam, and audio cue creation
- [ ] Verify: No `_heightIndicator` elements on Quest

### Files Changed
- `client/src/js/game/target-spawner.js` (line ~392-429)

### Performance Impact
- Expected: **-1 draw call per indicated target** (~30% of targets)

---

## TASK-454: Skip Timing Rings on Quest
**Priority:** High
**Status:** Pending
**Assigned:** /dev

### Description
Rhythm targets get animated timing ring elements. Skip on Quest.

### Acceptance Criteria
- [ ] In `spawnTargetAt()`: Wrap timing ring creation in `if (!_isQuest)`
- [ ] Lines 368-390: Skip timing ring creation for rhythm targets
- [ ] Verify: No `_timingRing` elements on Quest

### Files Changed
- `client/src/js/game/target-spawner.js` (line ~368-390)

### Performance Impact
- Expected: **-1 draw call per rhythm target**

---

## TASK-455: Remove Shadow Casting from Quest Targets
**Priority:** Critical
**Status:** Pending
**Assigned:** /dev

### Description
Targets have `shadow="cast: true"` which enables shadow map rendering per target. Remove on Quest.

### Acceptance Criteria
- [ ] In `_applyPrimitiveMaterial()`: Quest branch sets `shadow: cast: false; receive: false`
- [ ] Or better: Don't set shadow attribute at all on Quest
- [ ] Verify: Quest targets don't contribute to shadow map

### Files Changed
- `client/src/js/game/target-spawner.js` (line ~517, ~663)

### Performance Impact
- Expected: **-shadow pass overhead** (significant on mobile GPU)

---

## Recently Completed

| Task | Title | Completed |
|------|-------|-----------|
| TASK-439 | Disable env-reflections.js on Quest | 2026-02-05 |
| TASK-438 | Disable bloom-effect.js on Quest | 2026-02-05 |
| TASK-437 | Disable gpu-particles.js on Quest | 2026-02-05 |
| TASK-436 | Disable haptic-manager.js on Quest | 2026-02-05 |
| TASK-435 | Simplify HUD on Quest | 2026-02-05 |
| TASK-434 | Disable target animations on Quest | 2026-02-05 |
| TASK-433 | Reduce lights to 1 on Quest | 2026-02-05 |
| TASK-432 | Disable camera-effects.js on Quest | 2026-02-05 |
| TASK-431 | Disable tension-system.js on Quest | 2026-02-05 |
| TASK-430 | Disable shoot-controls visual effects on Quest | 2026-02-05 |
| TASK-400 | Remove Looping Opacity Animations | 2026-02-05 |
| TASK-399 | Remove backdrop-filter: blur from CSS | 2026-02-05 |
| TASK-398 | Remove Transparency from Menu (85 surfaces) | 2026-02-05 |
| TASK-397 | Reduce Menu Lights (15→2) | 2026-02-05 |
| TASK-396 | Pre-allocate shoot-controls.js Event Vectors | 2026-02-05 |
| TASK-395 | Fix shoot-controls.js Shotgun Query | 2026-02-05 |
| TASK-394 | Fix target-system.js Magnet Allocation | 2026-02-05 |
| TASK-393 | Fix target-indicator.js GC Allocations | 2026-02-05 |
| TASK-392 | Apply Quest Material Guidelines to game.html | 2026-02-05 |
| TASK-350 | Last Stand Mode | 2026-02-01 |
| TASK-351 | Bomb Targets | 2026-02-01 |
| TASK-352 | Chain Lightning Combo | 2026-02-01 |
| TASK-353 | Darkness Wave | 2026-02-01 |
| TASK-354 | Rival Ghost | 2026-02-01 |
| TASK-355 | Sudden Death Overtime | 2026-02-01 |
| TASK-340 | Environment Map Reflections | 2026-02-01 |
| TASK-341 | Floor Detail — Procedural Normal Map | 2026-02-01 |
| TASK-342 | Enhanced Muzzle Flash | 2026-02-01 |
| TASK-320 | GPU Particle System | 2026-02-01 |
| TASK-321 | 3D Target Models (GLTF) | 2026-02-01 |
| TASK-322 | Dissolve Shader Effect | 2026-02-01 |
| TASK-323 | Hand Tracking Controls | 2026-02-01 |
| TASK-310 | Tension Vignette & Heartbeat | 2026-01-31 |
| TASK-311 | Sudden Surge Events | 2026-01-31 |
| TASK-312 | Power-Down Debuffs | 2026-01-31 |
| TASK-313 | Closing Arena Walls | 2026-01-31 |
| TASK-314 | Live Accuracy HUD + PB Pace | 2026-01-31 |
| TASK-300 | Reaction Time Tracker + HUD | 2026-01-31 |
| TASK-301 | Color-Match Targets | 2026-01-31 |
| TASK-302 | Reflex Rush Game Mode | 2026-01-31 |
| TASK-303 | Fake-Out Blink Targets | 2026-01-31 |
| TASK-304 | Peripheral Vision Trainer | 2026-01-31 |
| TASK-292 | Leaderboard UI + Friend Ranking | 2026-01-31 |
| TASK-293 | Daily Challenge Banner on Menu | 2026-01-31 |
| TASK-294 | Rank/Tier System (Bronze → Diamond) | 2026-01-31 |
| TASK-295 | Post-Game Summary Screen | 2026-01-31 |
| TASK-296 | Achievement Toast Notifications | 2026-01-31 |
| TASK-287 | Dynamic Target Movement Patterns | 2026-01-31 |
| TASK-288 | Wave Events / Mini-Objectives | 2026-01-31 |
| TASK-289 | Danger Projectiles — Dodge or Die | 2026-01-31 |
| TASK-290 | Score Multiplier Zones | 2026-01-31 |
| TASK-291 | End-of-Round Frenzy | 2026-01-31 |
| TASK-280 | Service Worker + Offline Cache | 2026-01-31 |
| TASK-281 | Global Error Handling + Recovery | 2026-01-31 |
| TASK-282 | Loading Screen Tips + Progress | 2026-01-31 |
| TASK-283 | Weapon Tutorial Expansion | 2026-01-31 |
| TASK-284 | First-Unlock Tooltips | 2026-01-31 |
| TASK-285 | Per-Weapon Detailed Stats | 2026-01-31 |
| TASK-286 | Declutter Game HUD | 2026-01-31 |
| TASK-270 | New Weapons — SMG + Railgun | 2026-01-31 |
| TASK-271 | New Power-ups — Shield, Magnet, Slow Field | 2026-01-31 |
| TASK-272 | Expanded Achievements — 10 New Milestones | 2026-01-31 |
| TASK-273 | Progressive Difficulty — Survival Scaling | 2026-01-31 |
| TASK-274 | Colorblind Mode — Accessibility Presets | 2026-01-31 |
| TASK-275 | Detailed Stats Dashboard | 2026-01-31 |
| TASK-276 | Difficulty Presets — Easy/Normal/Hard | 2026-01-31 |
| TASK-277 | Seasonal Events — Weekly Rotating Challenge | 2026-01-31 |
| TASK-252 | Height-Zone Targets — Crouch & Reach | 2026-01-31 |
| TASK-260 | Weather System — Neon Rain & Space Dust | 2026-01-31 |
| TASK-261 | Destructible Environment | 2026-01-31 |
| TASK-262 | Environmental Reactions | 2026-01-31 |
| TASK-263 | Underwater Theme | 2026-01-31 |
| TASK-256 | Punch Targets | 2026-01-31 |
| TASK-257 | Rhythm Targets | 2026-01-31 |
| TASK-258 | Wall Lean Dodge | 2026-01-31 |
| TASK-255 | Scare Balls | 2026-01-31 |
| TASK-250~254 | V11 Physical Movement | 2026-01-31 |
| TASK-240~244 | V10 Immersion | 2026-01-31 |
| TASK-234~236 | V9 Effects & Interaction | 2026-01-31 |

[View all completed tasks ->](./tasks-archive.md)
