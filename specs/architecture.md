# Architecture

> Status: Active
> Last Updated: 2026-02-02

---

## 1. Project Overview

**VR Quest Game** — Game VR đơn giản chạy trên Meta Quest Browser, hỗ trợ In-App Purchase (IAP).

**Target Platform:** Meta Quest 2/3/Pro (Quest Browser — WebXR)
**Genre:** Simple VR Game (target shooting mini-game)
**Monetization:** IAP via Web Monetization / custom payment flow
**Access:** Hosted web app, truy cập qua Quest Browser

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | A-Frame 1.6 (WebXR) |
| Language | JavaScript (ES Modules) |
| 3D Engine | Three.js (via A-Frame) |
| Physics | aframe-physics-system (cannon.js) |
| UI | A-Frame HTML UI / custom VR panels |
| IAP Backend | Node.js + Express (REST API) |
| Database | JSON file (purchases.json) |
| Payment | Meta Digital Goods API (Quest) / Stripe (dev fallback) |
| Dev Server | Vite |
| Deploy | TWA APK via Meta Quest Store (ALPHA channel); `.\quest-deploy.ps1` = build + adb install (see **Build & Run on Quest 2** below) |
| Hosting | Nginx reverse proxy: `vr.proxyit.online` → `localhost:3001` |
| Monorepo | `client/` (Vite frontend) + `server/` (Express backend) |

---

## 3. Directory Structure

```
game-vr/
├── client/                        # Frontend (Vite + A-Frame)
│   ├── src/
│   │   ├── index.html             # Entry point — Main Menu + Game (SPA)
│   │   ├── game.html              # Game scene (alternate entry)
│   │   ├── shop.html              # IAP Shop page
│   │   ├── settings.html          # Settings page
│   │   ├── stats.html             # Stats dashboard
│   │   ├── tutorial.html          # Interactive tutorial
│   │   ├── friends.html           # Friends list
│   │   ├── leaderboard.html       # Leaderboard page
│   │   ├── privacy.html           # Privacy policy
│   │   ├── manifest.json          # PWA manifest (ovr_package_name, scope)
│   │   ├── css/
│   │   │   └── style.css          # UI styling
│   │   ├── js/
│   │   │   ├── main.js            # SPA entry point, menu, navigation
│   │   │   ├── game-main.js       # Game loop, HUD, countdown, game over
│   │   │   ├── shop-main.js       # Shop page entry point
│   │   │   ├── settings-main.js   # Settings page entry point
│   │   │   ├── stats-main.js      # Stats page entry point
│   │   │   ├── tutorial-main.js   # Tutorial page entry point
│   │   │   ├── friends-main.js    # Friends page entry point
│   │   │   ├── leaderboard-main.js # Leaderboard page entry point
│   │   │   │
│   │   │   ├── core/
│   │   │   │   ├── game-manager.js      # Game state machine
│   │   │   │   ├── audio-manager.js     # Procedural SFX (Web Audio) + reverb
│   │   │   │   ├── music-manager.js     # Procedural adaptive BGM per theme
│   │   │   │   ├── auth-manager.js      # Firebase auth + profile
│   │   │   │   ├── firebase-config.js   # Firebase config
│   │   │   │   ├── friend-manager.js    # Friend codes + social
│   │   │   │   ├── leaderboard-manager.js # Global leaderboard
│   │   │   │   ├── haptic-manager.js    # Controller vibration system
│   │   │   │   ├── error-handler.js     # Global error handling + recovery (V15)
│   │   │   │   └── vr-util.js           # VR utility helpers
│   │   │   │
│   │   │   ├── game/
│   │   │   │   ├── target-system.js     # Target spawning + hit detection + boss rush
│   │   │   │   ├── target-models.js     # Procedural GLTF model generation (V20)
│   │   │   │   ├── score-manager.js     # Score + accuracy tracking
│   │   │   │   ├── game-modes.js        # Mode definitions + lives
│   │   │   │   ├── weapon-system.js     # Weapon stats + selection (5 weapons)
│   │   │   │   ├── weapon-skins.js      # Cosmetic skin overrides
│   │   │   │   ├── weapon-tutorial.js   # Per-weapon tutorial steps (V15)
│   │   │   │   ├── achievements.js      # Achievement checks (25 milestones)
│   │   │   │   ├── achievement-toast.js # Achievement notification toasts (V17)
│   │   │   │   ├── daily-challenge.js   # Daily challenge progress
│   │   │   │   ├── weekly-challenge.js  # Weekly rotating seasonal events (V14)
│   │   │   │   ├── environment-themes.js # Theme visuals (6 themes)
│   │   │   │   ├── weather-system.js    # Weather particles per theme (V13)
│   │   │   │   ├── arena-reactions.js   # Arena lights/shake on events (V13)
│   │   │   │   ├── game-summary.js      # End-game stats builder
│   │   │   │   ├── power-up-manager.js  # Power-up buff system (6 power-ups)
│   │   │   │   ├── rank-system.js       # Bronze → Diamond tier system (V17)
│   │   │   │   ├── tension-system.js    # Last Stand, bombs, darkness, overtime (V23)
│   │   │   │   ├── unlock-tooltips.js   # First-unlock VR popups (V15)
│   │   │   │   └── settings-util.js     # Settings read helper
│   │   │   │
│   │   │   ├── iap/
│   │   │   │   ├── iap-manager.js       # Purchase flow (Meta DG / dev fallback)
│   │   │   │   └── iap-products.js      # Product definitions
│   │   │   │
│   │   │   ├── components/              # A-Frame components (non-module, <script>)
│   │   │   │   ├── shoot-controls.js    # VR trigger → raycaster shoot
│   │   │   │   ├── hand-shoot.js        # Hand tracking pinch-to-shoot (V20)
│   │   │   │   ├── hand-shield.js       # Hand tracking shield gesture (V20)
│   │   │   │   ├── target-hit.js        # Target hit reaction + particles
│   │   │   │   ├── target-indicator.js  # Off-screen target direction indicator
│   │   │   │   ├── particle-burst.js    # Entity-based particle burst (legacy)
│   │   │   │   ├── gpu-particles.js     # GPU-accelerated particle system (V20)
│   │   │   │   ├── ambient-particles.js # Ambient floating particles
│   │   │   │   ├── dissolve-effect.js   # Perlin noise dissolve shader (V20)
│   │   │   │   ├── bloom-effect.js      # Post-processing bloom + vignette + color grading
│   │   │   │   ├── env-reflections.js   # Procedural cubemap reflections (V22)
│   │   │   │   ├── camera-effects.js    # Camera shake, micro-shake, tilt
│   │   │   │   ├── crosshair-feedback.js # Dynamic crosshair hit/kill feedback
│   │   │   │   ├── combo-popup.js       # Combo milestone popup
│   │   │   │   ├── damage-number.js     # Floating damage numbers
│   │   │   │   ├── weapon-model.js      # 3D weapon model + muzzle flash
│   │   │   │   ├── smooth-locomotion.js # Thumbstick movement
│   │   │   │   ├── teleport-pad.js      # Teleport locomotion pads
│   │   │   │   └── menu-button.js       # VR menu button component
│   │   │   │
│   │   │   └── ui/
│   │   │       ├── animations.js        # staggerIn, countUp, pulse
│   │   │       └── toast.js             # Toast notifications
│   │   │
│   │   └── assets/
│   │       ├── models/
│   │       ├── sounds/
│   │       └── textures/
│   ├── public/                    # Static assets (copied to dist/)
│   │   ├── .well-known/
│   │   │   └── assetlinks.json    # Android app links verification
│   │   └── js/components/         # A-Frame components (mirror of src, synced by deploy script)
│   ├── dist/                      # Build output (gitignored)
│   ├── vite.config.js             # Vite build config
│   └── package.json               # Client deps (firebase, vite)
│
├── server/                        # Backend (Express.js)
│   ├── index.js                   # Express server, serves client/dist/, /api/health
│   ├── routes/
│   │   └── iap.js                 # IAP endpoints (Stripe + dev mode)
│   ├── db/
│   │   └── database.js            # JSON file DB (purchases.json)
│   └── package.json               # Server deps (express, cors, dotenv)
│
├── quest-wrapper/                 # Android TWA wrapper (Gradle)
│   ├── app/
│   │   ├── build.gradle           # TWA config (hostname, versionCode, deps)
│   │   └── src/main/
│   │       ├── AndroidManifest.xml # Quest VR manifest + billing components
│   │       ├── java/com/nvr/vrquest/
│   │       │   ├── LauncherActivity.java   # TWA launcher
│   │       │   ├── DelegationService.java  # Billing + Platform SDK handlers
│   │       │   └── Application.java
│   │       └── res/
│   │           ├── values/strings.xml      # Asset statements (domain verification)
│   │           ├── drawable/splash.png
│   │           └── mipmap-hdpi/ic_launcher.png
│   ├── build.gradle               # Root build (AGP 8.7.3)
│   ├── gradlew.bat                # Gradle wrapper (portable build)
│   ├── settings.gradle
│   ├── gradle.properties          # AndroidX config
│   ├── ovr-platform-util.exe      # Meta Store upload tool
│   └── upload.ps1                 # Upload script
│
├── docs/                          # Documentation
│   └── BUILD-AND-DEPLOY.md       # Build APK & deploy to Quest 2 guide
├── store-assets/                  # Meta Store images (icon, covers, screenshots)
├── .claude/                       # Claude Code configuration
├── specs/                         # Specifications and tracking
├── package.json                   # Root orchestrator (npm scripts)
├── quest-deploy.ps1               # Full deploy: build + APK + ADB install
├── build-apk.ps1                  # Simple APK build + install
├── purchases.json                 # Purchase records (gitignored)
└── .gitignore
```

---

## 4. Core Services

### GameManager (game-manager.js)
- State machine: Menu → Playing → Paused → GameOver
- Save/load progress via localStorage

### TargetSystem (target-system.js)
- Spawn targets ở random positions trong VR space
- Hit detection khi player bắn/chạm target
- Scoring: +10 points mỗi target

### IAPManager (iap-manager.js)
- Client-side: hiển thị products, gọi API mua hàng
- Redirect tới Stripe Checkout
- Webhook nhận kết quả payment
- Grant items sau khi payment success

### ScoreManager (score-manager.js)
- Track current score, high score
- Coins balance (dùng cho IAP items)
- Persist via localStorage

### PowerUpManager (power-up-manager.js)
- Manages temporary buffs: Double Points (10s), Freeze Time (5s), Multi-shot (10s)
- Activated when player hits `powerup` target type (5% spawn weight)
- Integrates with: TargetSystem (score multiplier), WeaponSystem (projectile count), game-main (timer freeze)
- HUD display shows active power-up name + remaining time
- `reset()` on game start/end

### Slow-Motion System (in target-system.js)
- Triggered at combo ≥ 10 on each hit
- 300ms duration: slows target animations to 0.3× speed
- Visual: blue tint radial overlay
- Audio: music pitch drops to 0.5×
- Non-stacking, visual-only (doesn't affect game timer)

### HapticManager (haptic-manager.js)
- Centralized controller vibration system
- Scales all vibrations by `settings.vibration` (0-100 slider)
- Pulses both controllers simultaneously
- Presets: hit(), combo(n), powerUp(), slowMo(), damageTaken(), bossKill()
- Pattern support: sequential pulse sequences with delays
- Exposed as `window.__hapticManager` for non-module A-Frame components

### Boss Rush System (enhanced target-system.js)
- Boss health bar: HUD entity `#hud-boss` with fill + label
- Wave system: every 5 kills = 1 wave, 1.5s pause between waves
- Visual scaling: boss size grows with wave (1.0→2.0), color tiers (red→orange→purple→gold)
- Events: `boss-spawn`, `boss-damaged`, `boss-killed`, `boss-wave-clear`
- Audio: bossSpawn (rumble), bossHit (clang), bossKill (explosion+chime)

### WeatherSystem (weather-system.js) — V13
- Per-theme weather particles: neon rain (cyber), dust (sunset), stars (space), bubbles (underwater)
- Object-pooled particle entities
- Settings: `settings.weather` toggle

### ArenaReactions (arena-reactions.js) — V13
- Arena lights/shake respond to gameplay events (kills, combos, boss, damage)
- Subtle intensity — motion sickness safe

### WeaponTutorial (weapon-tutorial.js) — V15
- Per-weapon tutorial steps triggered on first weapon unlock
- Shotgun spread, sniper precision, SMG burst timing, railgun charge

### ErrorHandler (error-handler.js) — V15
- `window.onerror` + `unhandledrejection` → user-friendly error overlay with retry
- WebXR session loss recovery

### RankSystem (rank-system.js) — V17
- Tier progression: Bronze → Silver → Gold → Platinum → Diamond
- XP-based ranking from game scores

### AchievementToast (achievement-toast.js) — V17
- VR toast notifications when achievements unlock
- Animated popup with icon + description

### WeeklyChallenge (weekly-challenge.js) — V14
- Weekly rotating challenge with bonus XP/coins
- Seasonal event system

### TargetModels (target-models.js) — V20
- Procedural GLTF model generation using Three.js BufferGeometry export
- Per-type models: beveled cube (standard), arrow (speed), armored sphere (heavy), coin (bonus), etc.
- Generated on first load, cached in memory

### GPU Particles (gpu-particles.js) — V20
- GPU-accelerated particle system replacing manual entity spawning
- Weather, target destruction, muzzle flash, ambient particles
- Exposed as `window.__spawnGPUBurst` for non-module components

### DissolveEffect (dissolve-effect.js) — V20
- Custom ShaderMaterial with Perlin noise dissolve on target destruction
- 400ms dissolve with edge glow + particle emission
- Settings: `settings.dissolveEffect` toggle

### Hand Tracking (hand-shoot.js, hand-shield.js) — V20
- Quest 2/3 hand tracking via `hand-tracking-controls`
- Pinch-to-shoot (right hand), menu interaction (left hand)
- Auto-detect controller vs hand tracking, seamless switching
- Aim assist: 1.5x hitbox when using hands

### MusicManager (music-manager.js) — V21
- Procedural adaptive music (Web Audio oscillators, no audio files)
- 4 intensity layers: ambient → active → combat → frenzy
- Per-theme tonal palette, BPM sync
- API: `start(theme)`, `stop()`, `setIntensity(level)`, `getBPM()`

### Post-Processing Pipeline (bloom-effect.js) — V21-V22
- 4-pass bloom + vignette + damage flash + kill flash + color grading
- ACES tone mapping, per-theme color temperature/saturation/contrast
- Low-HP pulsing vignette
- VR-safe: separate fullscreen quad for XR mode

### Environment Reflections (env-reflections.js) — V22
- Procedural cubemap via PMREMGenerator for metallic surfaces
- Per-theme cubemap colors, selective envMapIntensity per material type
- Canvas-generated floor normal maps (hex grid, tiles, circuit traces)

### TensionSystem (tension-system.js) — V23
- **Last Stand**: HP=1 → desaturate, heartbeat, micro-shake. 5 consecutive hits = +1 HP recovery
- **Bomb Targets**: 3s countdown, miss = explosion damage, chain explosion near decoys
- **Chain Lightning Combo**: Combo ≥15 = 1.5x spawn rate, ≥25 = ordered chain targets
- **Darkness Wave**: Every 60s, arena goes dark for 10s, targets glow, 2x kill points
- **Rival Ghost**: Ghost replay of high-score run, ahead/behind indicator
- **Sudden Death Overtime**: Timer=0 + score ≥ 80% PB = 10s overtime, hit=+1s, miss=-2s

---

## 5. Data Models

### Player Data (localStorage)
```json
{
  "highScore": 0,
  "coins": 0,
  "isPremium": false,
  "purchasedItems": []
}
```

### IAP Product
```javascript
{
  id: "coin_pack_100",
  name: "100 Coins",
  description: "Get 100 coins to unlock extras",
  price: 0.99,          // USD
  type: "consumable",   // consumable | non_consumable
  coinAmount: 100       // for consumable
}
```

### Purchase Record (purchases.json)
```json
{
  "purchases": [
    {
      "id": 1,
      "session_id": "uuid",
      "product_id": "coin_pack_100",
      "stripe_session": "cs_xxx",
      "status": "completed",
      "created_at": "2026-01-30T12:00:00.000Z"
    }
  ]
}
```

---

## 6. Game Flow

```
Quest Browser → index.html (Main Menu)
    ↓ Enter VR          ↓ Shop
game.html             shop.html
    ↓                    ↓
Target Shooting     Stripe Checkout
    ↓                    ↓
Game Over →         Webhook → Grant
Score + Retry         Item → Save
```

---

## 7. API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Server health check (used by deploy script) |
| GET | /api/products | Danh sách IAP products |
| POST | /api/checkout | Tạo Stripe checkout session |
| POST | /api/webhook | Stripe webhook (payment result) |
| GET | /api/purchases/:sessionId | Check purchase status |

---

## 8. External Integrations

| Service | Purpose | Integration |
|---------|---------|-------------|
| Meta Digital Goods API | IAP on Quest | PaymentRequest API + horizonbilling |
| Meta Quest Store | App distribution | TWA APK via ovr-platform-util |
| Nginx Proxy | Reverse proxy `vr.proxyit.online` → localhost:3001 | User-managed |
| Stripe | Dev mode fallback | Stripe Checkout (localhost only) |

---

## 9. Configuration

| Key | Source | Note |
|-----|--------|------|
| STRIPE_SECRET_KEY | .env | Stripe API key |
| STRIPE_WEBHOOK_SECRET | .env | Webhook verification |
| PORT | .env | Server port (default 3000) |

---

## 10. Build & Run on Quest 2

**Prerequisites**
- Node.js, npm (client + server deps: `npm run install:all`)
- Android SDK: `ANDROID_HOME` (default `%LOCALAPPDATA%\Android\Sdk`) with platform-tools (adb)
- Java: `JAVA_HOME` (e.g. Android Studio JBR: `C:\Program Files\Android\Android Studio\jbr`)
- Quest 2: USB connected, Developer Mode on, ADB authorized
- Backend reachable at `https://vr.proxyit.online` (nginx proxy → localhost:3001)

**Steps**
1. Start server locally: `npm run server` (or ensure proxy forwards to your machine).
2. From repo root: `.\quest-deploy.ps1` — syncs components, Vite build, starts server if needed, builds APK (Gradle), installs on Quest, launches app.
3. Optional: `.\quest-deploy.ps1 -SkipApk` — code-only deploy (build + sync + restart app, no APK rebuild).
4. Optional: `.\quest-deploy.ps1 -RestartServer` — kill existing server process and start fresh.

**Script** `quest-deploy.ps1` uses `ANDROID_HOME` for adb, `JAVA_HOME` for Gradle, and `quest-wrapper\gradlew.bat` for APK build (portable, no hardcoded user paths).

---

## ADRs (Architecture Decision Records)

### ADR-001: Unity cho VR Development
**Status:** Deprecated
**Date:** 2026-01-29
**Note:** Chuyển sang WebXR, xem ADR-002.

### ADR-002: WebXR (A-Frame) thay thế Unity
**Status:** Accepted
**Date:** 2026-01-29

**Context:** Unity cần GUI editor, không phù hợp với CLI-based development workflow. Cần giải pháp có thể code và test hoàn toàn từ terminal.

**Decision:** Dùng A-Frame (WebXR) + Node.js backend. IAP qua Stripe thay vì Meta Quest Store.

**Consequences:**
- Positive: Code hoàn toàn từ CLI, test trên browser, deploy dễ dàng
- Positive: Không cần Meta Developer account cho IAP (dùng Stripe)
- Positive: Cross-platform (Quest Browser, PC VR, mobile AR)
- Negative: Performance thấp hơn native Unity (nhưng đủ cho game đơn giản)
- Negative: Không có Meta Quest Store distribution (phải host web riêng)
- Risks: WebXR trên Quest Browser có thể có quirks

**Alternatives Considered:**
1. Unity — deprecated: cần GUI editor
2. Babylon.js — rejected: A-Frame dễ dùng hơn cho VR, declarative HTML

### ADR-003: Meta Digital Goods API thay thế Stripe cho Quest IAP
**Status:** Accepted
**Date:** 2026-01-29

**Context:** Stripe Checkout không hoạt động trong Quest TWA. Meta yêu cầu dùng Digital Goods API cho IAP trên Quest Store.

**Decision:** Dùng Meta Digital Goods API (PaymentRequest API + `https://store.meta.com/billing`) cho production. Giữ dev mode fallback (instant grant) khi chạy localhost.

**Consequences:**
- Positive: IAP hoạt động native trên Quest Store
- Positive: Meta handle payment processing, refunds
- Negative: Chỉ hoạt động trên Quest (không cross-platform)
- Negative: Cần TWA APK wrapper, không chạy standalone web

### ADR-004: TWA (Trusted Web Activity) cho Quest Store Distribution
**Status:** Accepted
**Date:** 2026-01-29

**Context:** Meta Quest Store yêu cầu APK có Horizon SDK. Plain WebView APK bị reject ("Horizon SDK not found").

**Decision:** Dùng Meta's forked androidbrowserhelper library để build TWA APK. App mở trong Quest's built-in browser với full Digital Goods API support.

**Consequences:**
- Positive: Pass Meta's server-side APK validation
- Positive: Full billing integration (PaymentActivity, PaymentService)
- Negative: Tunnel URL hardcoded, cần rebuild khi URL thay đổi
- Risk: Production cần stable hosting (không dùng Cloudflare quick tunnel)

### ADR-005: A-Frame Particle System (No External Library)
**Status:** Accepted
**Date:** 2026-01-29

**Context:** Need particle effects for target destruction and visual feedback. Options: aframe-particle-system-component (external), Three.js Points (low-level), or simple entity spawning.

**Decision:** Use simple A-Frame entity spawning (create small a-sphere elements with animation, auto-remove). No external particle library.

**Consequences:**
- Positive: Zero dependencies, full control, easy to understand
- Positive: Works in all browsers, no compatibility issues
- Negative: Less performant than GPU-based particles for large counts
- Mitigation: Cap at 15 fragments per burst, auto-cleanup after 500ms

### ADR-006: Procedural Audio (No Audio Files)
**Status:** Accepted
**Date:** 2026-01-29

**Context:** Game needs background music and additional SFX. Options: embed audio files (MP3/OGG), use a music library (Tone.js), or procedural Web Audio API.

**Decision:** All audio is procedural using Web Audio API oscillators, filters, and gain envelopes. No audio files shipped. No external audio library.

**Consequences:**
- Positive: Zero asset weight, no loading time, no licensing issues
- Positive: Dynamic music that adapts to game state (theme-matched)
- Positive: Already established pattern in existing audio-manager.js
- Negative: Limited to synthetic sounds (no realistic instruments)
- Mitigation: Game aesthetic is sci-fi/neon, synthetic sounds fit perfectly

### ADR-007: Client/Server Monorepo Split
**Status:** Accepted
**Date:** 2026-01-30

**Context:** All source code was mixed at root level — `src/` (frontend), `server/` (backend), `vite.config.js`, and a shared `package.json`. This made it unclear which code was client vs server and complicated independent dependency management.

**Decision:** Split into `client/` and `server/` directories, each with its own `package.json`. Root `package.json` acts as orchestrator with convenience scripts. Deploy script (`quest-deploy.ps1`) updated to use new paths.

**Consequences:**
- Positive: Clear separation — `client/` = Vite + A-Frame, `server/` = Express API
- Positive: Independent dependency management (no canvas/express bloat in client)
- Positive: Each folder can be deployed independently in production
- Negative: Need to run `npm install` in both directories (mitigated by `npm run install:all`)
- Note: A-Frame components in `client/src/js/components/` must be synced to `client/public/js/components/` before build (handled by `quest-deploy.ps1`)

### ADR-008: V13 Environment Upgrade — Weather, Destruction, Reactions, Underwater Theme
**Status:** Accepted
**Date:** 2026-01-31

**Context:** Game đã có gameplay mechanics phong phú (V11-V12) nhưng không gian ảo còn tĩnh. Cần môi trường phản ứng với gameplay và thêm variety cho themes.

**Decision:** 4 upgrades:
1. Weather System (rain/dust per theme, object-pooled particles)
2. Destructible Environment (impact marks on miss shots)
3. Arena Reactions (lights/shake respond to gameplay events)
4. Underwater Theme (3rd complete environment, unlock level 10)

**Consequences:**
- Positive: Immersion tăng đáng kể, arena "sống" thay vì tĩnh
- Positive: Tận dụng particle/audio system đã có
- Positive: Thêm progression goal (level 10 unlock)
- Negative: Thêm ~100 particles (weather) — cần object pool
- Risk: Motion sickness nếu screen shake quá mạnh → keep subtle
- Mitigation: All effects có toggle/intensity control

### ADR-009: V14 Content & Quality-of-Life Upgrade
**Status:** Accepted
**Date:** 2026-01-31

**Context:** Game có 68 completed tasks, gameplay rất phong phú. Tuy nhiên content variety còn hạn chế (3 weapons, 3 power-ups, 15 achievements) và thiếu accessibility/QoL features.

**Decision:** 8 upgrades chia 2 nhóm:

**Content Expansion:**
1. New Weapons — SMG (burst-fire 3-round) + Railgun (charge-shot, high damage)
2. New Power-ups — Shield (absorb 1 hit), Magnet (auto-attract nearby targets), Slow-Mo (slow target movement)
3. More Achievements — 10 new (accuracy, weapon mastery, mode-specific, streak-based)
4. Progressive Difficulty — Survival mode scales spawn rate/speed over time

**Quality-of-Life:**
5. Colorblind Mode — 3 presets (protanopia, deuteranopia, tritanopia) with target shape+pattern differentiation
6. Detailed Stats — Track accuracy trends, playtime, longest streaks, per-weapon stats
7. Difficulty Presets — Easy/Normal/Hard modifiers on existing modes
8. Seasonal Events — Weekly rotating challenge with bonus XP/coins

**Consequences:**
- Positive: Double weapon variety (3→5), power-up variety (3→6)
- Positive: Accessibility compliance (colorblind support)
- Positive: Deeper progression (25 achievements, difficulty tiers)
- Positive: Retention (seasonal events, stats tracking)
- Negative: More balance tuning needed for new weapons
- Risk: SMG burst might feel too powerful → cap damage per burst
- Mitigation: All new content follows existing unlock-level gating

### ADR-010: V15 Production Hardening & UX Polish

**Status:** Accepted
**Date:** 2026-01-31

**Context:**
Game has excellent single-player content (5 weapons, 6 power-ups, 4 modes, 3 themes, 25 achievements, weekly challenges). However, production infrastructure and onboarding UX are lacking — no offline support, no error handling, no loading tips, no weapon-specific tutorials, no first-unlock tooltips, no per-weapon detailed stats.

**Decision:**
V15 splits into Tier 1 (Production-Ready) and Tier 2 (UX Polish):

**Tier 1 — Production-Ready:**
1. **Service Worker + Offline Cache** — Cache A-Frame, game assets, enable offline play with localStorage profile. Register SW in all HTML pages.
2. **Global Error Handling** — window.onerror + unhandledrejection → user-friendly error overlay with retry. WebXR session loss recovery.
3. **Loading Screen Tips** — Randomized gameplay tips during page load + scene initialization. Progress indicator.

**Tier 2 — UX Polish:**
4. **Weapon Tutorial Expansion** — Add weapon-specific tutorial steps: shotgun spread, sniper precision, SMG burst timing, railgun charge. Triggered on first weapon unlock.
5. **First-Unlock Tooltips** — VR popup when unlocking weapon/mode/skin for first time. Shows name + description + "Try it!" prompt.
6. **Per-Weapon Detailed Stats** — Track per-weapon: kills, accuracy, best score. Display in stats dashboard with weapon breakdown section.

**Consequences:**
- Positive: Playable offline on Quest, crash-resilient, better new-player experience
- Negative: Service worker adds complexity to deployment (cache invalidation)
- Risks: SW cache staleness — mitigated with version-based cache busting

### ADR-011: V20 Visual & Interaction Upgrade — Hand Tracking, 3D Models, GPU Particles, Dissolve FX

**Status:** Accepted
**Date:** 2026-02-01

**Context:**
Game đã rất mature (103 tasks, V1-V19) nhưng visuals vẫn dùng primitive geometries (icosahedron, sphere, etc.) và manual entity-spawning cho particles. A-Frame ecosystem có sẵn nhiều components mạnh chưa được tận dụng. Quest 3 users ngày càng prefer hand tracking thay vì controllers.

**Decision:** 4 upgrades chia 2 tier:

**Tier 1 — Visual Overhaul:**
1. **GPU Particle System** — Replace manual entity spawning bằng `aframe-particle-system-component`. GPU-accelerated, hỗ trợ 5000+ particles cho rain, explosions, muzzle flash, target trails
2. **3D Target Models (GLTF)** — Replace primitive geometries bằng low-poly GLTF models cho targets (robot drone, crystal, skull debuff, etc.). Weapon models upgrade từ procedural → GLTF
3. **Dissolve Shader Effect** — Custom shader cho target destruction: Perlin noise dissolve thay vì instant remove. Áp dụng cho tất cả target types

**Tier 2 — Interaction:**
4. **Hand Tracking Controls** — `hand-tracking-controls` component cho Quest 2/3. Pinch-to-shoot, hand raise to pause, gesture reload. Fallback graceful cho controller users

**Consequences:**
- Positive: Visual quality jump lớn — từ prototype look → polished game
- Positive: GPU particles giải phóng main thread, cho phép nhiều particles hơn (100→5000+)
- Positive: Hand tracking mở rộng audience (no-controller play)
- Positive: GLTF models cho phép community contribute assets
- Negative: GLTF models tăng initial load size (~2-5MB) — mitigated by lazy loading + SW cache
- Negative: Hand tracking accuracy thấp hơn controllers — mitigated by larger hit targets in hand mode
- Risk: Dissolve shader có thể gây performance drop trên Quest 2 — mitigated by LOD/fallback to instant remove
- Risk: `aframe-particle-system-component` dependency — mitigated by vendoring

**Alternatives Considered:**
1. Three.js Points (raw) — rejected: too low-level, A-Frame component wraps nicely
2. Babylon.js migration — rejected: too disruptive, A-Frame ecosystem đủ mạnh
3. Full environment component — deferred to V21: cần evaluate performance trên Quest 2 trước

### ADR-012: V21 Audio & Visual Polish — Dynamic Music, Reverb, Vignette, Color Grading

**Status:** Accepted
**Date:** 2026-02-01

**Context:**
Audio system có 49 procedural SFX methods nhưng thiếu music, reverb, UI sounds. Post-processing chỉ có bloom 4-pass, thiếu vignette, damage flash, color grading. Game "sounds flat" và "looks uniform" across themes.

**Decision:** 4 tasks:

**Tier 1 — Audio:**
1. **Dynamic Music System** — Procedural adaptive music bằng Web Audio API oscillators + gain layers. 4 intensity layers (ambient → combat → frenzy → boss) crossfade theo gameplay state. Per-theme tonal palette. No audio files.
2. **Audio Polish** — Add ConvolverNode reverb (procedural impulse response), UI sounds (hover, click, toggle), dissolve SFX, missing feedback sounds. Expose reverb settings.

**Tier 2 — Visual:**
3. **Vignette & Damage Flash** — Extend bloom-effect pipeline: vignette darkening (adjustable), red damage flash overlay, low-HP pulsing vignette. Single extra shader pass.
4. **Color Grading & Tone Mapping** — Per-theme color grading (cyber=cool blue, sunset=warm orange, space=desaturated, underwater=teal). ACES tone mapping. Exposure control. Integrated into composite pass.

**Consequences:**
- Positive: Music adds emotional depth — procedural = zero download overhead
- Positive: Reverb gives spatial depth to all existing SFX
- Positive: Vignette + color grading = each theme feels visually distinct
- Negative: Music oscillators add CPU load — mitigated by limiting to 8 concurrent oscillators
- Negative: Extra shader passes add GPU cost — mitigated by combining vignette+grading into single pass
- Risk: Procedural music may sound repetitive — mitigated by randomized phrase generation + multiple patterns

### ADR-013: V22 3D Graphics Upgrade — Environment Maps, Floor Detail, Enhanced Muzzle Flash

**Status:** Accepted
**Date:** 2026-02-01

**Context:**
Game đã có post-processing pipeline tốt (bloom, vignette, color grading, ACES tone mapping) và GPU particles. Tuy nhiên materials còn "flat" — metallic surfaces thiếu reflections, sàn chỉ có flat color, muzzle flash chưa có light flash kèm particles. 3 upgrades này tăng visual quality đáng kể mà không ảnh hưởng performance trên Quest 2.

**Decision:** 3 tasks:

1. **Environment Map Reflections** — Procedural cubemap (PMREMGenerator) cho metallic materials. Sàn, pillars, weapons, targets có phản chiếu môi trường. Per-theme cubemap colors. Áp dụng qua scene.environment (Three.js built-in).
2. **Floor Detail — Procedural Normal Map** — Canvas-generated normal map cho sàn: hex grid pattern, tile cracks, tech lines. Tăng chi tiết bề mặt mà không cần texture files. Per-theme normal patterns.
3. **Enhanced Muzzle Flash** — GPU particle burst + dynamic point light flash on shoot. Light color matches weapon. 50ms duration, subtle nhưng impactful. Integrates with existing gpu-particles system.

**Consequences:**
- Positive: Metallic surfaces phản chiếu → chất lượng PBR tăng vượt bậc
- Positive: Floor detail → arena feels "built" thay vì flat
- Positive: Muzzle flash → shooting feels more impactful
- Negative: Cubemap generation thêm ~100ms vào scene init
- Negative: Normal map thêm 1 texture lookup per fragment cho floor
- Risk: PMREMGenerator có thể chậm trên Quest 2 → mitigated: generate offline, cache
- Risk: Dynamic light từ muzzle flash thêm shadow recalc → mitigated: no shadows on muzzle light

### ADR-014: V23 Tension & Thrill Upgrade — Last Stand, Bombs, Chain Combo, Darkness, Ghost, Overtime

**Status:** Accepted
**Date:** 2026-02-01

**Context:**
Game đã có tension mechanics (vignette, heartbeat, surge, closing walls, boss rush, slow-mo, frenzy) nhưng thiếu các khoảnh khắc "clutch" — lúc người chơi cảm thấy mình sắp thua nhưng vẫn có cơ hội lật ngược. Cần thêm risk/reward mechanics và environmental tension.

**Decision:** 6 features chia 3 tier:

**Tier 1 — Core Tension:**
1. **Last Stand Mode** — Khi HP=1: desaturate, heartbeat nhanh, camera micro-shake. Bắn trúng 5 liên tiếp → hồi 1 HP + color restore. Tạo clutch moments.
2. **Bomb Targets** — Target đếm ngược 3s, không bắn kịp = nổ mất HP. Bắn nhầm decoy gần bomb = cũng nổ. Forces precision under pressure.
3. **Sudden Death Overtime** — Timer=0 + score ≥ 80% high score → "OVERTIME!" 10s bonus. Hit = +1s (max 15s), Miss = -2s. Clutch finish.

**Tier 2 — Advanced Tension:**
4. **Chain Lightning Combo** — Combo ≥15: spawn rate 1.5x. Combo ≥25: chain targets (bắn theo thứ tự 1→2→3). Sai thứ tự = mất combo. High risk/high reward.
5. **Darkness Wave** — Mỗi 60s: arena tối dần (2s), chỉ thấy target glow + weapon laser. 10s duration, targets nhanh hơn. Survival horror moment.

**Tier 3 — Social Tension:**
6. **Rival Ghost** — Ghost replay của lần chơi high-score trước. Ahead = green indicator, behind = red vignette + tense music. Personal competition.

**Consequences:**
- Positive: Clutch moments tăng adrenaline — Last Stand + Overtime = memorable highlights
- Positive: Bomb targets force precision, not just speed
- Positive: Darkness Wave adds variety, breaks monotony
- Positive: Rival Ghost tạo self-competition loop
- Negative: Bomb + Chain combo thêm complexity cho new players → mitigated: chỉ spawn ở wave 3+
- Risk: Darkness wave gây disorientation → mitigated: targets vẫn glow, 10s max duration
- Risk: Overtime kéo dài game → mitigated: max 15s, miss penalty lớn

### ADR-017: V26 Game Feel & Audio Polish — Ducking, Combo Feedback, Bomb Warning

**Status:** Accepted
**Date:** 2026-02-02

**Context:**
Game có 30+ sound effects nhưng không có priority system — khi bomb explode + weapon fire + combo chime đồng thời, tất cả play ở full volume → audio saturation. Combo reset (từ 20+ về 0) không có feedback → player không biết mất combo. Bomb targets xuất hiện đột ngột không có warning.

**Decision:** 3 tasks:

**TASK-366: Audio Ducking System** — Tạo 3 GainNode buses (critical/high/low) trong audio-manager.js. Route sounds theo priority. Khi P0 sound fires → auto-duck P1 (-3dB) và P2 (-8dB) qua Web Audio `linearRampToValueAtTime`. Music cũng bị duck khi P0 active.

**TASK-367: Combo Reset Feedback** — Detect high combo loss (≥10) tại tất cả combo=0 locations trong target-system.js. Play descending chime + "COMBO LOST!" HUD flash + micro camera shake. Combo loss ≥15 có 20% chance trigger debuff.

**TASK-368: Bomb Spawn Warning Telegraph** — 800ms pre-spawn warning (pulsing red ring + audio alert + HUD arrow) trước khi bomb entity thực sự spawn. Player có tổng 3.8s reaction time thay vì 3s.

**Consequences:**
- Positive: Audio mix sạch hơn, không bị muddy khi nhiều SFX đồng thời
- Positive: Combo loss trở thành moment đáng nhớ thay vì silent reset
- Positive: Bomb warning tăng fairness — player có thời gian chuẩn bị
- Negative: Ducking có thể mask ambient sounds quá mức → mitigated: chỉ duck khi P0 active, restore nhanh (200ms)
- Risk: Combo lost debuff trigger có thể frustrating → mitigated: chỉ 20% chance, chỉ khi combo ≥15

### ADR-016: V25 VFX Enhancement — Explosions, Projectile Trails, Muzzle Smoke

**Status:** Accepted
**Date:** 2026-02-02

**Context:**
Game có GPU particle system (gpu-particles.js) mạnh nhưng thiếu nhiều presets quan trọng. Bug critical: bomb explosion gọi `preset: 'explosion'` nhưng preset này không tồn tại — bomb nổ không có VFX. Projectile bay vào mặt player chỉ là sphere cam nhỏ không có trail — khó thấy và dodge. Muzzle flash thiếu smoke puff.

**Decision:** 3 tasks:

**TASK-363: Explosion Preset + Fireball** — Tạo multi-layer explosion preset (core hot + fire + smoke + shrapnel). Fix critical bug. Thêm ground scorch marks.

**TASK-364: Projectile Trail + Warning Telegraph** — GPU particle trail dọc theo projectile path. Warning indicator 0.5s trước khi bắn. Enhanced projectile visual (core + outer glow). Impact explosion khi trúng/miss.

**TASK-365: Muzzle Smoke** — Smoke puff 5 particles sau mỗi shot, drift upward. Shell casing spark on floor hit.

**Consequences:**
- Positive: Bomb explosion có fireball thực sự thay vì silent fail
- Positive: Projectile dễ thấy hơn → gameplay fairness tăng
- Positive: Warning telegraph cho player reaction time
- Positive: Muzzle smoke tăng weapon satisfaction
- Negative: Thêm ~70-180 particles/sec khi active — mitigated: all GPU-based, Quest 2 tested
- Risk: Trail emitter mỗi 50ms có thể tạo nhiều GPU particle systems — mitigated: reuse single system, update positions

### ADR-015: V24 Graphics Polish — VR Post-Processing, Shadow Optimization, Draw Call Batching

**Status:** Accepted
**Date:** 2026-02-02

**Context:**
Game có hệ thống post-processing đầy đủ (bloom, vignette, color grading, ACES tone mapping) nhưng **tất cả bị tắt trong VR mode** (line 162-167 bloom-effect.js: `if (xrSession) { origRenderFunc.call(...); return; }`). Khi chơi trên Quest 2 thực tế, player không thấy bloom, color grading, vignette — game trông "flat". Ngoài ra, mỗi theme spawn 15-30+ A-Frame entities cho distant environment (buildings, stars, coral, kelp) — mỗi entity = 1 draw call riêng.

**Decision:** 3 tasks:

**TASK-360: VR-Compatible Post-Processing**
Viết lại render pipeline để hoạt động trong XR mode. Thay vì EffectComposer (không hỗ trợ stereo), inject color grading + vignette + damage flash trực tiếp vào material shaders thông qua `onBeforeCompile`. Bloom giữ disabled trong VR (quá tốn GPU cho Quest 2), nhưng tone mapping + color grading + vignette + damage flash phải hoạt động.

Kỹ thuật: `renderer.xr.isPresenting` → thay vì skip toàn bộ, apply lightweight grading path:
- Option A: `scene.onBeforeRender` hook — inject uniforms vào mỗi material's fragment shader qua `onBeforeCompile`
- Option B: Fullscreen quad per-eye — render to `renderer.xr.getRenderTarget()`, apply composite shader per eye
- Option C (đơn giản nhất): Sử dụng Three.js built-in `renderer.toneMapping = ACESFilmicToneMapping` + `renderer.toneMappingExposure` cho VR mode. Vignette + damage flash qua overlay entity gắn vào camera.

→ **Chọn Option C** vì đơn giản nhất, Quest 2 safe, không cần custom render targets.

**TASK-361: Shadow Optimization**
Thu nhỏ shadow camera bounds từ ±20 về ±12 (vừa đủ cho arena 32x32, player ở giữa). Tăng effective shadow resolution. Thêm shadow camera follow player position (dynamic shadow frustum).

**TASK-362: Draw Call Batching — Merge Distant Environment**
Thay vì spawn 15-30 A-Frame entities cho distant decorations, merge tất cả static geometry thành 1 `THREE.Group` với `BufferGeometryUtils.mergeGeometries()` per material type. Kết quả: 15-30 draw calls → 2-4 draw calls per theme. Animated objects (whale, rotating asteroids) giữ riêng.

**Consequences:**
- Positive: Player trên Quest 2 thấy color grading + tone mapping + vignette + damage flash trong VR
- Positive: Shadow chất lượng cao hơn với cùng texture size
- Positive: Giảm ~80% draw calls cho distant environment
- Negative: Option C cho VR post-processing đơn giản hơn Option A/B — không có per-pixel bloom trong VR
- Negative: Merged geometry không thể animate từng object riêng
- Risk: `onBeforeRender` hook có thể conflict với A-Frame internal rendering → mitigated: chỉ modify renderer settings, không override render
- Risk: mergeGeometries cần matching material properties → mitigated: group by material type trước khi merge

### ADR-018: V27 God Class Refactoring — Facade + Module Extraction

**Status:** Accepted
**Date:** 2026-02-02

**Context:**
target-system.js (3040 lines, 65+ methods) và audio-manager.js (1616 lines, 80+ methods) là god classes xử lý quá nhiều responsibilities. Mỗi code review tìm thấy bugs do file quá lớn khó review (ISSUE-017, ISSUE-019 lifetime unit bugs). Cần tách thành modules nhỏ hơn mà không thay đổi public API.

**Decision:**
- **Facade pattern**: Giữ `TargetSystem` và `AudioManager` làm public API/singleton. Tách logic nội bộ sang sub-modules.
- **AudioManager** (1616 → ~250 lines facade + 4 modules): Sử dụng mixin pattern (`Object.assign(prototype, module)`). Sub-modules: `audio-weapons.js`, `audio-gameplay.js`, `audio-tension.js`, `audio-ui.js`.
- **TargetSystem** (3040 → ~800 lines facade + 4 modules): Sử dụng composition (`this._hazards = new TargetHazards(this)`). Sub-modules: `target-hazards.js`, `target-specials.js`, `target-spawner.js`, `target-feedback.js`.
- **Zero behavior change**: Pure structural refactor, no gameplay impact.
- **Execution order**: Audio first (simpler, less coupling), then target-system hazards, specials, spawner+feedback.

**Consequences:**
- Positive: Mỗi file ≤ 900 lines, dễ review, dễ tìm bugs
- Positive: Mixin pattern cho audio = zero overhead, methods attach trực tiếp vào prototype
- Positive: Composition cho targets = clear dependency graph, testable
- Negative: Thêm 8 files mới vào codebase
- Negative: Mixin pattern mất IDE autocomplete cho sub-module methods (acceptable tradeoff)
- Risk: Circular dependency nếu sub-modules reference nhau → mitigated: sub-modules chỉ reference parent facade qua constructor injection

### ADR-019: V30 Framework Integration — Adopt Shared VR Components

**Status:** Proposed
**Date:** 2026-02-04

**Context:**
Codebase `/codebases/game-vr-codebase/framework/` chứa 40 reusable VR modules đã được thiết kế tốt với focus vào performance (GC-free, object pooling) và modularity. Current game có nhiều systems tương đương nhưng implementation khác nhau, đôi khi less optimized. ISSUE-020 (Meta Quest VRC rejection) yêu cầu stable 72 FPS — framework utilities được thiết kế chính xác cho mục tiêu này.

**Key Framework Components to Adopt:**

| Framework Module | Current Game Equivalent | Benefit |
|------------------|------------------------|---------|
| `utils/object-pool.js` (292 lines) | Ad-hoc pooling in various files | GC-free, prewarm, stats, callbacks |
| `utils/haptics.js` (231 lines) | `haptic-manager.js` (complex) | Cleaner API: `Haptics.light/medium/heavy()` |
| `vfx/screen-shake.js` (130 lines) | `camera-effects.js` (mixed) | Standalone A-Frame component |
| `vfx/hitstop.js` (403 lines) | None | NEW: Impact freeze effect |
| `interaction/grabbable.js` (451 lines) | None | NEW: VR object grab system |
| `utils/state-machine.js` | `game-manager.js` | Generic FSM utility |

**Decision:**
Adopt 6 framework utilities into current game:

**Tier 1 — Critical for Performance (ISSUE-020):**
1. **ObjectPool** — Replace ad-hoc pooling with centralized `window.ObjectPool`. Pre-warm pools for: targets, damage numbers, particles, decorations
2. **Haptics** — Replace `haptic-manager.js` with simpler `Haptics` global. Keep existing presets mapping

**Tier 2 — Code Quality & New Features:**
3. **Screen Shake** — Extract from `camera-effects.js` to standalone component `screen-shake`
4. **Hitstop** — NEW feature: add impact freeze on boss kills, heavy hits, bomb explosions
5. **State Machine** — Optional: migrate `GameManager` to use generic FSM

**Tier 3 — Future Features:**
6. **Grabbable** — Prepare infrastructure for future grabbable weapon mechanics

**Consequences:**
- Positive: Centralized object pooling → measurable GC reduction
- Positive: Simpler haptic API → easier to maintain
- Positive: Hitstop adds game feel without new gameplay
- Positive: Shared codebase → fixes benefit both projects
- Negative: Migration effort ~3-5 hours
- Negative: Two haptic systems during transition
- Risk: ObjectPool behavior differences → mitigated: comprehensive testing

**Migration Strategy:**
1. Copy framework files to `client/src/js/vendor/` (vendored, not npm)
2. Add to HTML as `<script>` before modules (maintain global availability)
3. Migrate callers incrementally
4. Remove old implementations after verification

### ADR-020: V31 Comprehensive Framework Adoption

**Status:** Proposed
**Date:** 2026-02-04

**Context:**
V30 integrated 7/38 framework modules (ObjectPool, Haptics, ScreenShake, Hitstop, Grabbable, StateMachine, PerfMonitor). Reference codebase `/codebases/game-vr-codebase/` contains:
- **31 additional framework modules** (locomotion, combat, player, ui, physics, ai, quest, etc.)
- **Comprehensive game-design.md** (25KB) with UX guidelines
- **Specialized agent commands** (dev.md, test.md, perf.md tailored for VR)
- **Enhanced specs** (conventions.md, standards.md, decision-rules.md)

**Decision:**
Adopt remaining framework in 4 phases:

**Phase 1: Core Modules (Priority: High)**
- `locomotion/teleport.js`, `snap-turn.js`, `vignette.js` — VR comfort
- `combat/projectile.js`, `melee.js`, `destructible.js` — Combat systems
- `player/player-health.js` — Player damage/respawn
- `quest/quest-monitor.js` — Battery/thermal monitoring

**Phase 2: UI & Gameplay (Priority: Medium)**
- `ui/settings-menu.js`, `tutorial.js` — Better VR menus
- `gameplay/wave-manager.js`, `score-manager.js` — Game progression
- `vfx/particles.js`, `damage-vignette.js`, `hit-feedback.js` — Effects

**Phase 3: Utilities & AI (Priority: Low)**
- `utils/save-load.js`, `spawner.js`, `timer.js`, `animator.js`, `analytics.js`
- `ai/enemy-ai.js` — Behavior state machine
- `physics/simple-physics.js` — Lightweight physics

**Phase 4: Rules & Documentation**
- Adopt `game-design.md` as `.claude/rules/game-design.md`
- Add `specs/conventions.md`, `specs/standards.md`
- Update agent commands for VR-specific workflows

**Consequences:**
- Positive: Unified codebase with proven VR patterns
- Positive: Comprehensive UX guidelines improve game feel
- Positive: Specialized VR agents improve development workflow
- Negative: Large migration effort (~10-15 hours total)
- Negative: Learning curve for new framework APIs
- Risk: Breaking changes during migration → mitigated: incremental adoption, keep fallbacks

### ADR Template

```markdown
### ADR-XXX: [Title]

**Status:** Proposed | Accepted | Deprecated
**Date:** YYYY-MM-DD

**Context:**
Why is this decision needed?

**Decision:**
What was decided?

**Consequences:**
- Positive: ...
- Negative: ...
- Risks: ...

**Alternatives Considered:**
1. Option A - rejected because...
2. Option B - rejected because...
```

---

## 11. Framework Utilities (V30-V31)

> Integrated from framework codebase. Location: `client/src/js/vendor/`

### 11.1 Core Utilities

#### ObjectPool (object-pool.js)
GC-free object pooling for spawned entities.

```javascript
// Create pool with factory function
var pool = ObjectPool.create(function() {
  return document.createElement('a-entity');
}, 20, { maxSize: 50 });

// Usage
var obj = pool.get();          // Get from pool (auto-visible)
pool.release(obj);             // Return to pool (auto-hidden)
pool.prewarm(10);              // Pre-allocate more objects
pool.stats();                  // { available, inUse, total }
pool.releaseAll();             // Release all in-use objects
pool.clear();                  // Dispose all objects
```

#### Haptics (haptics.js)
VR controller vibration feedback for Quest.

```javascript
// Basic pulse
Haptics.pulse('right', 0.5, 100);  // hand, intensity (0-1), duration (ms)
Haptics.pulse('both', 1.0, 200);   // Both hands

// Presets
Haptics.light('right');    // 0.2 intensity, 50ms (UI hover)
Haptics.medium('left');    // 0.5 intensity, 100ms (hit confirm)
Haptics.heavy('both');     // 1.0 intensity, 200ms (explosion)

// Pattern sequence
Haptics.pattern('right', [
  { intensity: 0.5, duration: 50, pause: 30 },
  { intensity: 1.0, duration: 100, pause: 0 }
]);

// Utility
Haptics.isAvailable();     // Check if haptics supported
Haptics.reset();           // Clear cached XR session
```

#### ScreenShake (screen-shake.js)
Camera shake effect for impact feedback.

```javascript
// A-Frame component
<a-entity id="player-rig" screen-shake="intensity: 0.1; duration: 200">

// Trigger via component
document.getElementById('player-rig').components['screen-shake'].shake(0.5, 300);

// Global API
ScreenShake.trigger(0.5, 300);  // intensity (0-1), duration (ms)
ScreenShake.enable();           // Enable (default)
ScreenShake.disable();          // Disable (accessibility)
```

#### Hitstop (hitstop.js)
Impact freeze effect for combat feedback.

```javascript
// Basic trigger
Hitstop.trigger(50);                     // 50ms full freeze
Hitstop.trigger(100, { scale: 0.1 });    // 100ms slow-mo (10% speed)
Hitstop.trigger(80, { zoom: true });     // With camera zoom punch

// Presets
Hitstop.light();     // 30ms freeze
Hitstop.medium();    // 50ms freeze
Hitstop.heavy();     // 80ms freeze + zoom
Hitstop.critical();  // 120ms slow-mo + zoom

// Utility
Hitstop.cancel();       // End current hitstop
Hitstop.enable();       // Enable (default)
Hitstop.disable();      // Disable (accessibility)
Hitstop.isActive();     // Check if currently active
Hitstop.getState();     // { active, remaining, scale, zoom, enabled }
```

#### VRCore (vr-core.js)
Shared utilities for Quest TWA VR games.

```javascript
// Loading screen
VRCore.loadingScreen({
  title: 'MY GAME<span>VR</span>',
  titleColor: '#5af',
  tips: ['Tip 1', 'Tip 2'],
  timeout: 8000
});

// Auto-enter VR on Quest
VRCore.autoEnterVR(sceneEl);

// Quest optimizations (VRC compliance) — default 90Hz
VRCore.applyQuestOptimizations(sceneEl);  // 90Hz, pixelRatio 1.0, disable AA
VRCore.applyQuestOptimizations(sceneEl, { refreshRate: 120 });  // Custom rate

// Runtime refresh rate control (V33)
VRCore.getRefreshRate();       // Returns current rate (default 90)
VRCore.setRefreshRate(120);    // Change at runtime (requires active VR session)

// Utilities
VRCore.isQuest();              // Detect Quest device
VRCore.clearServiceWorkers();  // Clear stale SW cache
VRCore.disableAntialias(sceneEl);
```

#### StateMachine (state-machine.js)
Generic finite state machine utility.

```javascript
var fsm = StateMachine.create({
  initial: 'idle',
  states: {
    idle: { enter: onIdleEnter, exit: onIdleExit },
    playing: { enter: onPlayingEnter },
    paused: { enter: onPausedEnter }
  },
  transitions: {
    start: { from: 'idle', to: 'playing' },
    pause: { from: 'playing', to: 'paused' },
    resume: { from: 'paused', to: 'playing' }
  }
});

fsm.transition('start');  // idle → playing
fsm.current();            // 'playing'
fsm.can('pause');         // true
```

#### PerfMonitor (perf-monitor.js)
Real-time FPS and performance tracking.

```javascript
PerfMonitor.start();
PerfMonitor.stop();
PerfMonitor.getFPS();        // Current FPS
PerfMonitor.getStats();      // { fps, frameTime, drawCalls }
PerfMonitor.onDrop(fn, 60);  // Callback when FPS drops below threshold
```

---

### 11.2 Locomotion Modules

#### Teleport (locomotion/teleport.js)
Point-and-teleport locomotion with arc visualization.

```javascript
// A-Frame component
<a-entity id="right-hand" teleport-controls="teleportable: .floor; fadeDuration: 150">

// Schema options
teleportable: '.teleportable'   // CSS selector for valid surfaces
button: 'trigger'               // trigger, grip, thumbstick
cursorColor: '#00ff88'          // Valid destination color
cursorInvalidColor: '#ff4444'   // Invalid destination color
landingMaxAngle: 45             // Max floor angle in degrees
fadeDuration: 150               // Fade transition (ms)

// Global API
Teleport.enable();      // Enable on all hands
Teleport.disable();     // Disable on all hands
Teleport.isEnabled();   // Check if enabled

// Events
'teleport-start' → { destination }
'teleport-end' → { destination }
```

#### SnapTurn (locomotion/snap-turn.js)
Thumbstick snap rotation for VR comfort.

```javascript
// A-Frame component
<a-entity id="player-rig" snap-turn="turnAngle: 45; hand: right">

// Schema options
turnAngle: 45      // Degrees per turn (30, 45, 90)
hand: 'right'      // Which hand thumbstick
deadzone: 0.5      // Thumbstick deadzone

// Global API
SnapTurn.enable();
SnapTurn.disable();
```

#### Vignette (locomotion/vignette.js)
Comfort vignette during movement (motion sickness reduction).

```javascript
// A-Frame component
<a-entity id="player-rig" comfort-vignette="intensity: 0.5">

// Schema options
intensity: 0.5     // Max vignette darkness (0-1)
threshold: 0.1     // Movement speed to trigger

// Global API
ComfortVignette.enable();
ComfortVignette.disable();
```

---

### 11.3 Combat Modules

#### Projectile (combat/projectile.js)
Projectile spawning and physics.

```javascript
// Spawn projectile
Projectile.spawn({
  position: { x: 0, y: 1.5, z: -2 },
  direction: { x: 0, y: 0, z: -1 },
  speed: 10,
  damage: 25,
  color: '#ff6600',
  lifetime: 3000
});

// Events on projectile entity
'projectile-hit' → { target, damage, point }
'projectile-expire' → {}
```

#### Melee (combat/melee.js)
VR melee combat with velocity-based damage.

```javascript
// A-Frame component
<a-entity id="right-hand" melee-weapon="damage: 50; swingThreshold: 3">

// Schema options
damage: 50              // Base damage
swingThreshold: 3       // Min velocity to register hit
hitCooldown: 200        // MS between hits

// Events
'melee-hit' → { target, damage, velocity, point }
'melee-swing' → { velocity }
```

#### Destructible (combat/destructible.js)
Destructible objects with health and fragments.

```javascript
// A-Frame component
<a-entity destructible="health: 100; fragments: 8">

// Schema options
health: 100        // Starting health
fragments: 8       // Number of debris pieces
fragmentForce: 5   // Explosion force

// Events
'damage' → { amount, remaining }
'destroyed' → {}
```

---

### 11.4 Interaction Modules

#### Grabbable (grabbable.js)
VR hand grabbing with physics.

```javascript
// A-Frame component
<a-entity grabbable="physics: true; throwForce: 8">

// Schema options
physics: true      // Enable physics on release
throwForce: 8      // Throw velocity multiplier
snapOnGrab: true   // Snap to hand position

// Events
'grab-start' → { hand }
'grab-end' → { hand, velocity }
```

#### DistanceGrab (interaction/distance-grab.js)
Grab objects at a distance with laser pointer.

```javascript
// A-Frame component
<a-entity id="right-hand" distance-grab="maxDistance: 10">

// Schema options
maxDistance: 10    // Max grab distance
pullSpeed: 5       // Object pull speed
```

#### Interactable (interaction/interactable.js)
Generic interactable object component.

```javascript
// A-Frame component
<a-entity interactable="highlight: true; hoverScale: 1.1">

// Events
'interact' → { hand }
'hover-start' → {}
'hover-end' → {}
```

#### PointerHighlight (interaction/pointer-highlight.js)
Visual highlight when pointing at objects.

```javascript
// A-Frame component
<a-entity pointer-highlight="color: #ffff00; opacity: 0.3">
```

#### SocketSnap (interaction/socket-snap.js)
Snap objects to socket positions.

```javascript
// Socket
<a-entity socket="accepts: .snappable">

// Snappable object
<a-entity class="snappable" socket-snap>
```

---

### 11.5 VFX Modules

#### Particles (vfx/particles.js)
GPU-accelerated particle system wrapper.

```javascript
Particles.burst({
  position: { x: 0, y: 1, z: 0 },
  count: 20,
  color: '#ff4444',
  size: 0.05,
  speed: 3,
  lifetime: 500
});
```

#### DamageVignette (vfx/damage-vignette.js)
Screen damage flash effect.

```javascript
DamageVignette.flash(0.5);     // Flash with intensity 0-1
DamageVignette.pulse(1.0);     // Low HP pulsing vignette
DamageVignette.stop();         // Stop pulsing
```

#### HitFeedback (vfx/hit-feedback.js)
Combined hit feedback (flash + shake + haptic).

```javascript
HitFeedback.trigger({
  flash: true,
  shake: 0.3,
  haptic: 'medium'
});
```

---

### 11.6 Gameplay Modules

#### WaveManager (gameplay/wave-manager.js)
Wave-based game progression.

```javascript
var waves = WaveManager.create({
  waves: [
    { enemies: 5, delay: 1000 },
    { enemies: 10, delay: 800 },
    { enemies: 15, delay: 600, boss: true }
  ],
  onWaveStart: function(wave) { },
  onWaveEnd: function(wave) { },
  onAllComplete: function() { }
});

waves.start();
waves.getCurrentWave();   // Current wave number
waves.getProgress();      // { current, total, enemiesRemaining }
```

#### ScoreManager (gameplay/score-manager.js)
Score tracking with multipliers.

```javascript
ScoreManager.add(100);           // Add points
ScoreManager.addWithMultiplier(100, 2);  // With multiplier
ScoreManager.get();              // Current score
ScoreManager.getHighScore();     // Best score
ScoreManager.reset();            // Reset to 0
```

---

### 11.7 Player Module

#### PlayerHealth (player/player-health.js)
Player health management.

```javascript
// A-Frame component
<a-entity player-health="max: 100; startHealth: 100">

// API via component
var health = el.components['player-health'];
health.damage(25);      // Take damage
health.heal(10);        // Heal
health.getHealth();     // Current health
health.isDead();        // Check if dead

// Events
'damage-taken' → { amount, remaining }
'health-restored' → { amount, current }
'player-death' → {}
```

---

### 11.8 Quest Module

#### QuestMonitor (quest/quest-monitor.js)
Battery and thermal monitoring for Quest.

```javascript
// Battery
QuestMonitor.getBatteryLevel();   // 0-100 or null
QuestMonitor.isCharging();        // true/false/null

// Thermal
QuestMonitor.getThermalState();   // 'normal', 'warm', 'hot', 'unknown'

// Callbacks
QuestMonitor.onLowBattery(function(level) {
  showBatteryWarning();
}, 20);  // Threshold 20%

QuestMonitor.onThermalWarning(function(state) {
  if (state === 'hot') reduceQuality();
});

// Auto quality reduction
QuestMonitor.enableAutoQuality(sceneEl);  // Auto-reduce on thermal
QuestMonitor.disableAutoQuality();
QuestMonitor.restoreQuality();

// Status
QuestMonitor.getStatus();  // { batteryLevel, charging, thermalState, ... }
```

---

### 11.9 Other Utilities

| Module | Purpose | Key API |
|--------|---------|---------|
| `hud.js` | HUD management | `HUD.init()`, `HUD.update()`, `HUD.message()` |
| `timer.js` | Game timer | `Timer.start()`, `Timer.pause()`, `Timer.getRemaining()` |
| `animator.js` | Animation sequencing | `Animator.sequence()`, `Animator.parallel()` |
| `spawner.js` | Entity spawning | `Spawner.spawn()`, `Spawner.spawnWave()` |
| `save-load.js` | Persistence | `SaveLoad.save()`, `SaveLoad.load()` |
| `analytics.js` | Event logging | `Analytics.log()`, `Analytics.export()` |
| `controllers.js` | Controller reference | Input mapping documentation |
| `simple-physics.js` | Lightweight physics | `Physics.update()`, collision detection |
| `enemy-ai.js` | Enemy behavior FSM | `EnemyAI.create()`, state-based AI |
| `hand-model.js` | Hand visualization | Hand mesh rendering |
| `settings-menu.js` | VR settings panel | In-VR settings UI |
| `tutorial.js` | Tutorial system | Step-by-step hints |

---

### 11.10 Loading Order

```html
<!-- In game.html <head> before </head> -->

<!-- Core (load first) -->
<script src="js/vendor/vr-core.js"></script>
<script src="js/vendor/object-pool.js"></script>
<script src="js/vendor/state-machine.js"></script>

<!-- VFX (before components) -->
<script src="js/vendor/screen-shake.js"></script>
<script src="js/vendor/hitstop.js"></script>
<script src="js/vendor/haptics.js"></script>

<!-- Locomotion -->
<script src="js/vendor/locomotion/teleport.js"></script>
<script src="js/vendor/locomotion/snap-turn.js"></script>
<script src="js/vendor/locomotion/vignette.js"></script>

<!-- Quest -->
<script src="js/vendor/quest/quest-monitor.js"></script>

<!-- Then game components and modules -->
```

---

## 12. Performance Optimization Patterns (V46)

> Added: 2026-02-04 | Reference: TASK-504

### 12.1 Hazard System Tick Optimization

All hazard update functions in [target-hazards.js](client/src/js/game/target-hazards.js) follow these GC-free patterns:

#### **Pre-allocated Vectors (V37 + V46)**

```javascript
// In constructor - allocate once
constructor(ts) {
  this._projCamPos = new THREE.Vector3();      // Projectile collision
  this._scareCamPos = new THREE.Vector3();     // Scare ball collision
  this._chargerCamPos = new THREE.Vector3();   // Charger collision
  this._laserCamPos = new THREE.Vector3();     // Laser sweep collision
  this._launchCamPos = new THREE.Vector3();    // V46: Scare ball launch
  this._launchDir = new THREE.Vector3();       // V46: Scare ball direction
}

// In tick functions - reuse with .set() or .copy()
_updateScareBalls() {
  this._cameraEl.object3D.getWorldPosition(this._scareCamPos);  // Reuse
  const dist = b.pos.distanceTo(this._scareCamPos);             // No allocation
}
```

#### **Direct Position Updates (V46)**

```javascript
// ❌ BAD: String parsing overhead every tick
b.el.setAttribute('position', `${x} ${y} ${z}`);  // Parses "x y z" string

// ✅ GOOD: Direct Three.js vector update
b.el.object3D.position.set(x, y, z);              // Sets vector directly
```

**Impact:** Eliminates ~0.3-0.5ms per entity per tick on string parsing.

#### **Tick Interval Standards**

| Hazard Type | Interval | Updates/Sec | Rationale |
|-------------|----------|-------------|-----------|
| Projectiles | 50ms | 20 | Medium-speed tracking |
| Chargers | 50ms | 20 | Medium-speed tracking |
| Scare Balls | 50ms (V46) | 20 | Reduced from 33 (was 30ms) |
| Laser Sweeps | 30ms | 33 | Fast sweeps need precision |
| Danger Zones | 500ms | 2 | Slow area damage check |

**Guideline:** Use 50ms for moving hazards, 30ms only when precision required.

#### **Cached Element References (V37)**

```javascript
// In startTimers() - cache once
this._cameraEl = document.getElementById('camera');
this._leftHandEl = document.getElementById('left-hand');

// In tick functions - use cached refs
this._cameraEl.object3D.getWorldPosition(this._camPos);  // No getElementById
```

**Impact:** Eliminates 850+ `getElementById` calls per second across all hazard ticks.

### 12.2 Quest Optimization Checklist

When adding new VFX or hazards, apply these Quest-specific optimizations:

| Feature | Desktop | Quest | Pattern |
|---------|---------|-------|---------|
| Point lights | ✓ Allowed | ❌ Skip if >2 total | Check `_isQuest` flag |
| Tail particles | 3-5 | 0-1 | Reduce count drastically |
| Animation loops | ✓ Full | ❌ Skip or static | Disable `animation__pulse` etc |
| DOM createElement | Pool or minimal | ❌ Skip fallback | Prefer GPU particles |
| Shadow casting | ✓ 1-2 lights | ❌ Basic, autoUpdate:false | Reduce shadow quality |

**Example (V44-V46):**
```javascript
// Module-level Quest check (cache result)
const _isQuest = typeof VRCore !== 'undefined' && VRCore.isQuest && VRCore.isQuest();

// In code - conditional VFX
if (!_isQuest) {
  const light = document.createElement('a-entity');  // Desktop only
  light.setAttribute('light', '...');
}

const tailCount = _isQuest ? 0 : 3;  // Quest: no tails, Desktop: 3 tails
```

### 12.3 Performance Budget Summary

| System | Target Overhead | V46 Actual |
|--------|-----------------|------------|
| Scare Ball Tick | <0.5ms per ball | ~0.3ms ✓ |
| Projectile Tick | <0.3ms per projectile | ~0.2ms ✓ |
| Charger Tick | <0.4ms per charger | ~0.3ms ✓ |
| Laser Sweep Tick | <0.5ms per sweep | ~0.4ms ✓ |
| Total Hazard Overhead | <2.0ms | ~1.2ms ✓ |

**Target:** 72fps = 13.9ms per frame. Hazard systems consume <10% of frame budget.

---
