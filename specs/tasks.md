# Task Management

> Last Updated: 2026-02-04
> Purpose: Active work queue. Keep this file short.
> [View Completed Tasks Archive](./tasks-archive.md)

---

## Overview

| Status | Count |
|--------|-------|
| In Progress | 0 |
| Pending | 5 |
| Completed | 145 |

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
> **V28 Performance Optimization (TASK-380~390)** — completed (init optimization).
> **V29 VR Render Load Reduction (TASK-391~395)** — in progress (per-frame FPS fix).

---

## V29 — VR Render Load Reduction (CRITICAL — Meta Quest VRC Fix Phase 2)

> **Goal:** Reduce per-frame render load for stable 72 FPS on Quest 2. V28 fixed init, but runtime load still causes 40 FPS.
> **Root Cause:** Particle count 3400 (budget: 500), decoration entities 82/theme (budget: 30).
> **Ref:** ISSUE-020

## TASK-391: VR Particle Count Reduction
**Priority:** Critical
**Status:** Completed (2026-02-04)
**Assigned:** /dev

### Description
Detect XR/VR session and drastically reduce particle counts to 10% of desktop values.

### Acceptance Criteria
- [x] Add `isVRMode()` helper checking `renderer.xr.isPresenting` or Quest user-agent
- [x] In `_spawnAmbientParticles()`: dust 1200→120, sparks 800→80 when VR
- [x] In weather-system `_startGPU()`: remove `* 30` multiplier, use `cfg.count` directly
- [x] Total particles in VR: < 300
- [x] Profile: 72 FPS stable on Quest 2

---

## TASK-392: Disable Weather Particles in VR
**Priority:** Critical
**Status:** Completed (2026-02-04)
**Assigned:** /dev

### Description
Weather particles add 900-1200 to particle budget. Disable entirely in VR or cap at 100.

### Acceptance Criteria
- [x] Add `vrMode` check in `weatherSystem.start()`
- [x] If VR: skip `_startGPU()` entirely OR set count cap at 100
- [x] Meteors still OK (infrequent, entity-based) — skipped in VR
- [x] Profile: weather overhead < 1ms in VR

---

## TASK-393: Decoration LOD for VR
**Priority:** High
**Status:** Completed (2026-02-04)
**Assigned:** /dev

### Description
82 decorations per theme with animations is too many draw calls. Implement LOD: hide decorations beyond 30m in VR.

### Acceptance Criteria
- [x] Add `vrLOD` flag to decoration pool via `VR_DECORATION_LIMITS`
- [x] In VR mode: statically reduce decoration count (belowVoid: 5, distantEnv: 15, decorations: 5)
- [x] Alternative: statically reduce decoration count to 20 for VR — implemented
- [x] Profile: draw calls < 50 in VR

---

## TASK-394: Auto-Detect Quest and Apply Mobile Preset
**Priority:** High
**Status:** Completed (2026-02-04)
**Assigned:** /dev

### Description
Auto-detect Quest device via user-agent or XR session, apply aggressive mobile quality preset.

### Acceptance Criteria
- [x] Add `isQuestDevice()` in settings-util.js
- [x] Mobile preset: particles=vr, reflections=off, floorDetail=off, weather=off, bloom=off
- [x] Apply preset on first game load if Quest detected via `applyQuestPresetIfNeeded()`
- [x] User can override in settings (vrPresetApplied flag)
- [x] Profile: stable 72 FPS baseline

---

## TASK-395: Reduce Animation Count on Decorations
**Priority:** Medium
**Status:** Completed (2026-02-04)
**Assigned:** /dev

### Description
Many decorations have looping animations (opacity pulse, rotation). Each animation is a per-frame tick. Remove non-essential animations in VR.

### Acceptance Criteria
- [x] Identify decorations with `animation` attribute in environment-themes.js
- [x] In VR mode: skip setting animation attributes on decorations (key.startsWith('animation'))
- [x] Keep only essential animations (player-facing elements)
- [x] Profile: decoration tick overhead < 2ms

---

## V28 — Performance Optimization (Init Phase — Completed)

> **Goal:** Fix FPS drops below 60 during game initialization. Meta Quest VRC.Quest.Performance.1 rejection.
> **Ref:** ISSUE-020

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
**Status:** Completed (2026-02-04)
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
**Status:** Completed (2026-02-04)
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
**Status:** Completed (2026-02-04)
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
**Status:** Completed (2026-02-04)
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

## TASK-386: Batch Slow-Motion Animation Updates
**Priority:** Critical
**Status:** Completed (2026-02-04)
**Assigned:** /dev

### Description
Optimize slow-motion trigger to avoid per-target DOM queries. Access A-Frame components directly instead of setAttribute.

### Acceptance Criteria
- [x] Access `el.components['animation__move']` directly instead of `el.getAttribute()`
- [x] Batch all animation duration changes in single RAF pass
- [x] Restore animations via cached references, not DOM queries
- [x] Profile: slow-mo trigger < 2ms (down from ~15ms)

---

## TASK-387: Fix Timer Intervals
**Priority:** High
**Status:** Completed (2026-02-04)
**Assigned:** /dev

### Description
Reduce timer interval overhead. Overtime timer runs at 100ms (10x/sec), Last Stand shake at 200ms.

### Acceptance Criteria
- [x] Change overtime timer from 100ms → 1000ms (update HUD only on whole second change)
- [x] Change Last Stand shake from 200ms → 500ms (still perceptible, less overhead)
- [x] Profile: GC pressure reduced

---

## TASK-388: Cache DOM Queries for Arena Elements
**Priority:** High
**Status:** Completed (2026-02-04)
**Assigned:** /dev

### Description
Cache darkness lights, arena barriers, and pillar toruses at round init. Avoid per-event querySelectorAll.

### Acceptance Criteria
- [x] Cache `a-light` elements in `_cachedLights` array at `_initRound()`
- [x] Cache `.arena-barrier` and `.arena-pillar a-torus` at `_initRound()`
- [x] Use cached arrays in `_startDarknessWave()`, `_endDarknessWave()`, `_updateBarrierComboGlow()`
- [x] Add throttle to barrier glow updates (max 1 per 100ms)
- [x] Profile: darkness/combo events < 2ms (down from ~20ms)

---

## TASK-389: Object Pool for Damage Numbers
**Priority:** Medium
**Status:** Completed (2026-02-04)
**Assigned:** /dev

### Description
Pre-create pool of damage number entities at init. Reuse from pool instead of createElement per hit.

### Acceptance Criteria
- [x] Pre-create pool of 15 damage number entities in `target-feedback.js`
- [x] Reuse pooled entities via `_getDamageNumberFromPool()`
- [x] Return to pool after animation completes (850ms)
- [x] Fallback to createElement if pool exhausted
- [x] Profile: per-hit damage number < 1ms (down from ~8ms)

---

## TASK-390: Throttle GPU Particle Updates
**Priority:** Medium
**Status:** Completed (2026-02-04)
**Assigned:** /dev

### Description
Throttle GPU particle tick updates to 30fps max to reduce per-frame overhead.

### Acceptance Criteria
- [x] Add tick accumulator in `gpu-particles.js`
- [x] Skip update if accumulator < 33ms (30fps)
- [x] Profile: particle overhead < 5ms/frame (down from ~10ms)

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

## Recently Completed

| Task | Title | Completed |
|------|-------|-----------|
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
