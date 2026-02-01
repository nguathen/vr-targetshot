# Task Management

> Last Updated: 2026-02-01
> Purpose: Active work queue. Keep this file short.
> [View Completed Tasks Archive](./tasks-archive.md)

---

## Overview

| Status | Count |
|--------|-------|
| In Progress | 0 |
| Pending | 0 |
| Completed | 107 |

> V1–V13 — all completed (68 tasks).
> **V14 Content & QoL Upgrade (TASK-270~277)** — completed.
> **V15 Production Hardening & UX Polish (TASK-280~286)** — completed.
> **V16 Gameplay Engagement (TASK-287~291)** — completed.
> **V17 Player Retention & Social (TASK-292~296)** — completed.
> **V18 Reflex Mastery (TASK-300~304)** — completed.
> **V19 Adrenaline Surge (TASK-310~314)** — completed.
> **V20 Visual & Interaction Upgrade (TASK-320~323)** — completed.

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

## Recently Completed

| Task | Title | Completed |
|------|-------|-----------|
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
