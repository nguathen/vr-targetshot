# Conventions Registry — VR Quest Game

> Purpose: Track patterns and conventions established during development.
> Updated by: /code-check after each review.
> Used by: /dev to maintain consistency.
> Last verified: 2026-02-04

---

## Project Structure Conventions

| Pattern | Convention | Example |
|---------|-----------|---------|
| Client code | `client/src/js/<category>/` | `core/`, `game/`, `components/` |
| Components | `client/src/js/components/<name>.js` | `bloom-effect.js`, `shoot-controls.js` |
| Vendor modules | `client/src/js/vendor/<module>.js` | `object-pool.js`, `haptics.js` |
| HTML pages | `client/src/*.html` | `game.html`, `shop.html`, `index.html` |
| Deploy target | `client/dist/` (gitignored, Vite output) | `npm run build` |
| Server | `server/` (Express backend) | `server/index.js`, `server/routes/` |

---

## Game HTML Conventions

| Pattern | Convention | Example |
|---------|-----------|---------|
| A-Frame CDN | Version 1.6.0 via `aframe.io/releases/` | `<script src="https://aframe.io/releases/1.6.0/aframe.min.js">` |
| Framework includes | `/framework/vr-core.js` + `/framework/hud.js` | After A-Frame CDN |
| Scene structure | Player rig → camera (HUD + cursor) + hands | Template lines 16-36 |
| Menu/Game toggle | `#menu-content` visible, `#game-content` hidden | Toggle via `setAttribute('visible', ...)` |
| Inline JS | Single `<script>` IIFE at bottom of body | Template lines 76-113 |
| Clickable elements | `class="clickable"` + raycaster `objects: .clickable` | Buttons, interactive entities |

---

## Framework/Vendor Conventions

| Pattern | Convention | Example |
|---------|-----------|---------|
| Module style | IIFE with global export (`window.X = { ... }`) | `VRCore`, `ObjectPool`, `Haptics` |
| VFX components | A-Frame component + global helper object | `screen-shake` component + `window.ScreenShake` |
| VFX folder | `vendor/vfx/<effect>.js` | `vendor/vfx/particles.js` |
| Locomotion folder | `vendor/locomotion/<mode>.js` | `vendor/locomotion/teleport.js` |
| Combat folder | `vendor/combat/<system>.js` | `vendor/combat/melee.js` |
| Loading screen | `VRCore.loadingScreen({ title, titleColor })` | Called once at init |
| Auto VR | `VRCore.autoEnterVR(sceneEl)` | Quest auto-enters immersive mode |
| Object pooling | `ObjectPool.create(factory, size)` | GC-free entity spawning |
| Haptic feedback | `Haptics.pulse(hand, intensity, duration)` | `Haptics.light('right')` |
| Screen shake | `ScreenShake.trigger(intensity, duration)` | Impact feedback on player rig |
| Hitstop | `Hitstop.trigger(duration, options)` | Combat impact freeze |
| Quest detection | `VRCore.isQuest()` | Returns cached boolean |
| Quest optimizations | `VRCore.applyQuestOptimizations(sceneEl)` | Call early, before scene loads |

---

## Quest Performance Conventions

| Pattern | Convention | Notes |
|---------|-----------|-------|
| Antialias | Disable via `renderer="antialias: false"` | Cannot change at runtime |
| Renderer | `renderer="antialias: false; physicallyCorrectLights: false"` | V34: Full Quest-optimized |
| Shadows | `shadow="type: basic; autoUpdate: false"` | V34: Cheaper than pcfsoft |
| Pixel ratio | 1.0 on Quest | Set via `renderer.setPixelRatio(1.0)` |
| Refresh rate | Request 90Hz (default) | Via `session.updateTargetFrameRate(90)` |
| Shader warmup | Pre-compile before first frame | Via `renderer.compile(scene, camera)` |
| Dynamic lights | Max 2 | Quest budget: ambient + directional |
| Draw calls | <100 per frame | Use batching, instancing |
| GC-free tick | Pre-allocate vectors in `init()`, reuse with `.copy()` | Never `.clone()` in tick |
| Circular buffer | Pre-allocate fixed-size array with objects | Use index + count, not push/shift |
| Quest skip pattern | `if (VRCore.isQuest()) return;` in `_setup()` | V34: Skip expensive features |
| Module-level cache | Shared Set for cross-component data | `window.__cache` pattern (V36) |
| DOM selector cache | Cache querySelectorAll results in component | Lazy-init on first use, reuse after |
| Debounce expensive ops | Rate-limit DOM manipulation | `if (now - _lastTime < _debounceMs) return;` |
| Pool fallback | Check ObjectPool exists before use | `if (typeof ObjectPool !== 'undefined')` |
| Quest thermal | Enable via `QuestMonitor.enableAutoQuality()` | Handle `thermal-quality-change` event |
| setInterval timers | Cache DOM refs in startTimers(), not constructor | V37: Refs may not exist at construct time |
| Class-level vectors | Pre-allocate `this._vecName` in constructor | V37: For setInterval-based update functions |
| HUD value caching | Cache last value, only setAttribute if changed | V39: `if (newValue !== _lastValue)` |
| HUD debouncing | Rate-limit non-critical HUD updates | V39: `if (now - _lastUpdate < 500) return;` |
| object3D.visible | Use `el.object3D.visible = true/false` over setAttribute | V39: Faster than setAttribute('visible') |
| Feature disable pattern | Early return with comment explaining why | V39: `if (typeId === 'x') { return; }` |
| Dynamic light skip | Skip point lights on Quest (2-light budget) | V44: `if (!_isQuest) { el.appendChild(light); }` |
| Particle count reduce | Reduce particle counts on Quest | V44: `_isQuest ? 6 : 15` |
| Direct position update | Use `object3D.position.set()` over `setAttribute` | V46: Avoids string parsing in tick |
| Pre-alloc vector clone | Clone pre-allocated vectors for per-entity state | V46: `dir: dir.clone()` not `dir: dir` |

---

## VR Input Conventions

| Pattern | Convention | Example |
|---------|-----------|---------|
| Controller setup | `laser-controls` on left/right hand entities | Template lines 28-35 |
| Click detection | `raycaster` + `cursor` components, listen `click` event | `el.addEventListener('click', ...)` |
| Cursor | `a-cursor` on camera for gaze/mouse fallback | `fuse: false` for click-only |
| Hand reference | `#left-hand`, `#right-hand` entity IDs | Standard across all games |

---

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| JS files | kebab-case | `target-system.js`, `audio-manager.js` |
| A-Frame components | kebab-case | `shoot-controls`, `bloom-effect` |
| HTML IDs | kebab-case | `player-rig`, `menu-content`, `btn-play` |
| CSS classes | kebab-case | `.clickable`, `.hud-text` |
| JS globals | PascalCase | `VRCore`, `ObjectPool`, `Haptics` |
| JS functions | camelCase | `applyTheme()`, `checkAchievements()` |
| Private functions | _underscore prefix | `_processQueue()`, `_spawnDecorations()` |
| Constants | UPPER_SNAKE_CASE | `TARGET_TYPES`, `DEFAULT_PROFILE` |

---

## Event Naming Conventions

| Event | Source | Detail |
|-------|--------|--------|
| `theme-changed` | environment-themes.js | `{ theme }` |
| `powerup-activate` | power-up-manager.js | `{ type, config }` |
| `powerup-deactivate` | power-up-manager.js | `{ type }` |
| `crosshair-hit` | target-system.js | (none) |
| `crosshair-miss` | target-system.js | (none) |
| `camera-shake` | target-feedback.js | `{ intensity, duration }` |
| `slow-motion` | target-feedback.js | `{ active }` |
| `boss-spawn` | target-spawner.js | `{ wave, color }` |
| `boss-killed` | target-system.js | (none) |
| `wave-event` | target-feedback.js | `{ name }` |
| `hud-announce` | target-feedback/spawner.js | `{ text, duration }` |
| `player-damage` | tension-system.js | (none) |
| `thermal-quality-change` | quest-monitor.js | `{ state, pixelRatio }` |

---

## Orchestrator Conventions

| Pattern | Convention | Example |
|---------|-----------|---------|
| Module logger | `logger = logging.getLogger(__name__)` top of file | All orchestrator modules |
| Constants | `UPPER_SNAKE_CASE` at module level | `MAX_COMMANDS`, `OUTPUT_TAIL_LINES` |
| File I/O encoding | Always `encoding="utf-8"` on `open()` | `open(path, encoding="utf-8")` |
| Atomic writes | Write to `.tmp`, then `os.replace()` | `state.py:save_state()` |
| Telegram messaging | Use `send()` for all plain text messages | `bot.send("text")` |
