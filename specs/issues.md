# Issue Tracker

> Last Updated: 2026-02-02
> Purpose: Track bugs/regressions discovered during development.

---

## Overview

| Status | Count |
|--------|-------|
| Open | 0 |
| In Progress | 0 |
| Resolved | 19 |

---

## Open Issues

### ISSUE-021: [Critical] Meta Quest VRC Rejection — No VR Loading Indicator (VRC.Quest.Performance.3)

**Severity:** Critical
**Status:** Open
**Found By:** Meta Quest Store Review (VRC.Quest.Performance.3)
**Date:** 2026-02-06
**Assigned:** /dev

### Description
App rejected by Meta Quest Store. Fails to display head-tracked graphics within 4 seconds of launch AND lacks a VR loading indicator. User sees black/frozen screen in headset during app startup.

> "Your app fails to display head-tracked graphics within 4 seconds of launch and lacks a loading indicator in VR, resulting in an unresponsive or frozen appearance."

### Root Cause Analysis
1. **TWA splash screen is 2D** — not visible as head-tracked content in VR headset
2. **HTML loading screen (`#loading-screen`) is a 2D DOM overlay** — not rendered in WebXR stereo view
3. **A-Frame CDN load is blocking** — ~500-1000ms before any 3D rendering possible
4. **No A-Frame loading indicator in VR** — from VR session start to scene ready, nothing head-tracked is shown
5. **Total startup: 4-6 seconds** before first head-tracked frame

### Fix Strategy
**V43 — VR Loading Indicator** (TASK-480~482):
1. Create minimal A-Frame VR loading scene component (head-tracked spinner + text)
2. Show immediately when scene initializes (before game assets load)
3. Dismiss when game is fully ready
4. Ensure it appears within 4 seconds of app launch

### Acceptance Criteria
- [ ] Head-tracked loading indicator visible within 4 seconds of launch
- [ ] Loading indicator shows progress/activity (spinner or animation)
- [ ] Loading indicator dismisses when game is ready
- [ ] Pass VRC.Quest.Performance.3

---

### ISSUE-020: [Critical] Meta Quest VRC Rejection — FPS drops below 60 at game start

**Severity:** Critical
**Status:** Resolved (2026-02-05)
**Found By:** Meta Quest Store Review (VRC.Quest.Performance.1)
**Date:** 2026-02-04
**Assigned:** /dev
**Resolution:** V28-V42 performance optimization series brought FPS to stable 80+ on Quest.

---

## Resolved Issues (V26 Code Review)

### ISSUE-019: [Medium] `_spawnBombWarning` GPU particle lifetime unit mismatch
**Severity:** Medium | **Status:** Resolved (2026-02-02) | **Found By:** /code-check | **Date:** 2026-02-02
**Assigned:** /dev
Fixed `lifetime: 0.8` → `lifetime: 800` (milliseconds). Same unit mismatch as ISSUE-017.

### ISSUE-015: [Medium] `_canPlay()`/`_soundDone()` dead code in audio-manager.js
**Severity:** Medium | **Status:** Resolved (2026-02-02) | **Found By:** /code-check | **Date:** 2026-02-02
**Assigned:** /dev
Integrated `_canPlay()` guard + `osc.onended = _soundDone()` into `playHit`, `playWeaponFire` (all branches), and `playRicochet`. Concurrent sound limit (max 8) now functional.

### ISSUE-016: [Medium] No combo-lost debounce/cooldown
**Severity:** Medium | **Status:** Resolved (2026-02-02) | **Found By:** /code-check | **Date:** 2026-02-02
**Assigned:** /dev
Added `this._lastComboLostTime` guard with 3s cooldown at top of `_triggerComboLost()`.

### ISSUE-017: [Medium] GPU particle lifetime unit mismatch in combo-lost burst
**Severity:** Medium | **Status:** Resolved (2026-02-02) | **Found By:** /code-check | **Date:** 2026-02-02
**Assigned:** /dev
Fixed `lifetime: 0.6` → `lifetime: 600` (milliseconds).

### ISSUE-018: [Low] Bomb warning doesn't check close-range distance
**Severity:** Low | **Status:** Resolved (2026-02-02) | **Found By:** /code-check | **Date:** 2026-02-02
**Assigned:** /dev
Added camera distance check: if spawn < 3m from camera, warning reduced from 800ms to 400ms.

## Recently Resolved (V25 Code Review)

### ISSUE-013: [Medium] Bomb explosion pos is live Vector3 reference used in delayed setTimeout
**Severity:** Medium | **Status:** Resolved (2026-02-02) | **Found By:** /code-check
`pos = el.object3D.position` was a live reference. Delayed smoke setTimeout (100ms) used it after `removeChild(el)`. Fixed: cloned to plain object `{ x, y, z }`.

### ISSUE-014: [Low] Warning telegraph ring used wrong look-at selector
**Severity:** Low | **Status:** Resolved (2026-02-02) | **Found By:** /code-check
Used `#camera` but codebase convention is `[camera]` (attribute selector). Fixed to match existing pattern.

## Recently Resolved (V24 Code Review)

### ISSUE-009: [Medium] Shadow follow interval string re-parsing
**Severity:** Medium | **Status:** Resolved (2026-02-02) | **Found By:** /code-check
`sl.position.split(' ').map(Number)` was re-computed every 500ms tick. Fixed: cached outside interval.

### ISSUE-010: [Medium] Batched mesh GPU memory leak on theme switch
**Severity:** Medium | **Status:** Resolved (2026-02-02) | **Found By:** /code-check
Merged geometry + material not disposed before container cleared. Fixed: added `_disposeBatchedMeshes()`.

### ISSUE-011: [Low] VR vignette canvas texture not disposed
**Severity:** Low | **Status:** Resolved (2026-02-02) | **Found By:** /code-check
`CanvasTexture` leaked on VR session end. Fixed: stored as `_vrVignetteTex`, disposed in `_removeVROverlays()`.

### ISSUE-012: [Low] _parseMaterialString colon splitting fragility
**Severity:** Low | **Status:** Accepted Risk | **Found By:** /code-check
`pair.split(':')` splits all colons. Current data has no colons in values. Accepted as-is.

### ISSUE-007: [High] Menu buttons not clickable on Quest TWA app

**Severity:** High
**Status:** Resolved (2026-01-30)
**Found By:** User (manual testing on Quest 2)
**Date:** 2026-01-30
**Assigned:** /dev

### Description
Welcome screen buttons (Play, mode selection, weapon selection) cannot be clicked when running inside the Quest TWA app. Same buttons work fine on desktop browser.

### Repro Steps
1. Launch app on Quest 2 via TWA
2. Auto-enters VR mode
3. Point controller laser at "PLAY" button
4. Pull trigger — nothing happens
5. Same for mode/weapon buttons

### Expected Behavior
Buttons should respond to VR controller trigger press.

### Actual Behavior
Buttons are visible but non-interactive in Quest TWA. Work fine on desktop.

### Location
- **File:** `src/js/main.js`
- **Functions:** `setupControllerClick()`, `autoEnterVR()`, `buildModeButtons()`, `buildWeaponButtons()`
- **File:** `src/index.html` (controller raycaster config)

### Root Cause (3 issues)
1. **Dynamic buttons not captured:** `setupControllerClick()` line 153 queries `.clickable` at setup time, but mode/weapon buttons are created dynamically after. These buttons miss mouseenter/mouseleave handlers.
2. **Raycaster static selector:** `raycaster="objects: .clickable"` on controllers is evaluated at parse time. Dynamically added `.clickable` elements may not be picked up without forcing a raycaster refresh.
3. **Race condition:** `autoEnterVR()` fires immediately (line 177), but `initMenu()` waits for `authManager.waitReady()` (line 179). VR session starts before buttons exist → raycaster finds nothing.

### Fix Plan
1. **Force raycaster refresh** after dynamic buttons are created — call `hand.components.raycaster.refreshObjects()` after `buildModeButtons()` and `buildWeaponButtons()`
2. **Move autoEnterVR()** inside the `authManager.waitReady().then()` block, after `initMenu()` completes
3. **Use event delegation** for hover effects instead of static querySelectorAll

---

## In Progress

_None_

---

## Recently Resolved

### ISSUE-001: [Medium] Dead code in shoot-controls shotgun ray
**Status:** Resolved (2026-01-29)
**Fix:** Removed dead line `raycaster.raycaster.ray.origin.toArray()` from `shoot-controls.js`.

### ISSUE-002: [Medium] Dual data persistence — GameManager and AuthManager conflict
**Status:** Resolved (2026-01-29)
**Fix:** Stripped `GameManager` to pure state machine. Removed `gameManager` dependency from `ScoreManager`. Migrated `shop-main.js` to use `authManager`.

### ISSUE-003: [Medium] Zen mode has no way to end the game
**Status:** Resolved (2026-01-29)
**Fix:** Added a "Quit" button (`btn-quit`) visible during gameplay in `game.html`. Wired to `endGame()` in `game-main.js`. Styled in `style.css`.

### ISSUE-004: [Low] `bossRush` mode missing from `DEFAULT_PROFILE.highScores`
**Status:** Resolved (2026-01-29)
**Fix:** Added `bossRush: 0` to `DEFAULT_PROFILE.highScores` in `auth-manager.js`.

### ISSUE-005: [Low] `init()` may be called twice
**Status:** Resolved (2026-01-29)
**Fix:** Added `let initialized = false` guard with `safeInit()` wrapper in both `game-main.js` and `main.js`.

### ISSUE-006: [Low] Unused variable `key` in `updateHighScore`
**Status:** Resolved (2026-01-29)
**Fix:** Removed unused `const key = 'highScores'` from `auth-manager.js`.

### ISSUE-008: [High] Shop UI click-through bugs on Quest VR
**Status:** Resolved (2026-01-30)
**Found By:** User (manual testing on Quest 2)
**Date:** 2026-01-30

**Root Causes & Fixes (5 bugs):**

1. **Shop UI visible during gameplay** — `switchToGame()` didn't hide `shop-content`. Fix: add `shopContent.setAttribute('visible', 'false')` in both `switchToGame()` and `switchToMenu()`.

2. **Hidden shop buttons still purchasable** — Click events on hidden A-Frame entities still fire because Three.js meshes remain in scene graph. Fix: add `shopVisible` boolean guard in `handlePurchase()`.

3. **Duplicate event listeners stacking** — `init()` in `game-main.js` called every PLAY press, stacking listeners on btn-retry etc. Random clicks triggered `startCountdown()` multiple times. Fix: split into `_initOnce()` + `_initRound()` with `_initialized` guard.

4. **Desktop raycaster hitting hidden elements** — `setupMouseClick()` Three.js raycaster picked up meshes from hidden entities. First fix used `getAttribute('visible') === 'false'` which DOES NOT WORK — A-Frame returns boolean, not string. Fix: check `!el.object3D.visible` directly. Also filter by hidden parent containers.

5. **SHOP button overlapping PLAY on Quest** — VR controller raycaster is imprecise. Buttons at same z-depth with small vertical gap caused accidental clicks. Fix: move SHOP to a small icon in bottom-right corner, well separated from PLAY.

### Lessons Learned (AVOID IN FUTURE)

| # | Pitfall | Rule |
|---|---------|------|
| 1 | A-Frame `getAttribute('visible')` returns boolean, NOT string `"false"` | Always use `el.object3D.visible` for visibility checks |
| 2 | A-Frame `visible="false"` hides visually but raycaster still intersects meshes | Guard click handlers with state flags; filter hidden containers in custom raycasters |
| 3 | Calling `init()` on every game start stacks event listeners | Use `_initialized` guard; split one-time setup from per-round setup |
| 4 | VR controller raycaster is imprecise (~0.1-0.2 unit tolerance) | Keep clickable buttons well separated (>0.3 units); don't stack buttons vertically at same z-depth |
| 5 | Large centered buttons overlap with nearby elements | Use small, corner-positioned buttons for secondary actions (Shop, Settings) |
| 6 | SPA scene switching must hide ALL other containers | Every `switchTo*()` function must explicitly hide all sibling containers |
| 7 | Cloudflare quick tunnel URL changes on restart | After tunnel restart: update `build.gradle`, `strings.xml`, rebuild APK, reinstall |

---

## Issue Template

```markdown
### ISSUE-XXX: Issue Title

**Severity:** Critical | High | Medium | Low
**Status:** Open | In Progress | Resolved
**Found By:** /code-check | /test | /debug | /sec
**Date:** YYYY-MM-DD
**Assigned:** /dev | /tl

### Description
What is the problem?

### Repro Steps
1. ...

### Expected Behavior
...

### Actual Behavior
...

### Location
- **File:** `path/to/file.py`
- **Function/Method:** `name()`

### Root Cause
...

### Fix
...

### Verification
...
```
