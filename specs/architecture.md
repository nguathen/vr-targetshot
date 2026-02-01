# Architecture

> Status: Active
> Last Updated: 2026-01-30

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
vr/
├── client/                        # Frontend (Vite + A-Frame)
│   ├── src/
│   │   ├── index.html             # Entry point - Main Menu + Game (SPA)
│   │   ├── game.html              # Game scene (alternate entry)
│   │   ├── shop.html              # IAP Shop page
│   │   ├── settings.html          # Settings page
│   │   ├── stats.html             # Stats dashboard
│   │   ├── tutorial.html          # Interactive tutorial
│   │   ├── friends.html           # Friends list
│   │   ├── privacy.html           # Privacy policy
│   │   ├── manifest.json          # PWA manifest
│   │   ├── css/
│   │   │   └── style.css          # UI styling
│   │   ├── js/
│   │   │   ├── main.js            # SPA entry point, menu, navigation
│   │   │   ├── game-main.js       # Game loop, HUD, countdown, game over
│   │   │   ├── core/
│   │   │   │   ├── game-manager.js    # Game state machine
│   │   │   │   ├── audio-manager.js   # Procedural SFX (Web Audio)
│   │   │   │   ├── music-manager.js   # Procedural BGM per theme
│   │   │   │   ├── auth-manager.js    # Firebase auth + profile
│   │   │   │   ├── firebase-config.js # Firebase config
│   │   │   │   ├── friend-manager.js  # Friend codes + social
│   │   │   │   ├── leaderboard-manager.js # Global leaderboard
│   │   │   │   └── vr-util.js         # VR utility helpers
│   │   │   ├── game/
│   │   │   │   ├── target-system.js   # Target spawning + hit detection
│   │   │   │   ├── score-manager.js   # Score + accuracy tracking
│   │   │   │   ├── game-modes.js      # Mode definitions + lives
│   │   │   │   ├── weapon-system.js   # Weapon stats + selection
│   │   │   │   ├── weapon-skins.js    # Cosmetic skin overrides
│   │   │   │   ├── achievements.js    # Achievement checks
│   │   │   │   ├── daily-challenge.js # Daily challenge progress
│   │   │   │   ├── environment-themes.js # Theme visuals
│   │   │   │   ├── game-summary.js    # End-game stats builder
│   │   │   │   ├── power-up-manager.js # Power-up buff system
│   │   │   │   └── settings-util.js   # Settings read helper
│   │   │   ├── core/
│   │   │   │   ├── ...
│   │   │   │   └── haptic-manager.js  # Controller vibration system
│   │   │   ├── iap/
│   │   │   │   ├── iap-manager.js     # Purchase flow (Meta DG / dev)
│   │   │   │   └── iap-products.js    # Product definitions
│   │   │   ├── components/            # A-Frame components (non-module)
│   │   │   │   ├── shoot-controls.js  # VR trigger → raycaster shoot
│   │   │   │   ├── target-hit.js      # Target hit reaction + particles
│   │   │   │   ├── particle-burst.js  # Particle burst effect
│   │   │   │   ├── damage-number.js   # Floating damage numbers
│   │   │   │   ├── smooth-locomotion.js # Thumbstick movement
│   │   │   │   └── menu-button.js     # VR menu button component
│   │   │   └── ui/
│   │   │       ├── animations.js      # staggerIn, countUp, pulse
│   │   │       └── toast.js           # Toast notifications
│   │   └── assets/
│   │       ├── models/
│   │       ├── sounds/
│   │       └── textures/
│   ├── public/                    # Static assets (copied to dist/)
│   │   ├── .well-known/
│   │   │   └── assetlinks.json    # Android app links verification
│   │   └── js/components/         # A-Frame components (mirror of src)
│   ├── dist/                      # Build output (gitignored)
│   ├── vite.config.js             # Vite build config
│   └── package.json               # Client deps (firebase, vite)
│
├── server/                        # Backend (Express.js)
│   ├── index.js                   # Express server, serves client/dist/
│   ├── routes/
│   │   └── iap.js                 # IAP endpoints (Stripe + dev mode)
│   ├── db/
│   │   └── database.js            # JSON file DB (purchases.json)
│   ├── .env.example               # Environment variables template
│   └── package.json               # Server deps (express, cors, dotenv)
│
├── quest-wrapper/                 # Android TWA wrapper (Gradle)
│   ├── app/
│   │   ├── build.gradle           # TWA config (hostname, versionCode)
│   │   └── src/
│   ├── settings.gradle
│   └── release.keystore           # APK signing key (gitignored)
│
├── .claude/                       # Claude Code configuration
├── specs/                         # Specifications and tracking
├── package.json                   # Root orchestrator (npm scripts)
├── quest-deploy.ps1               # Build + deploy to Quest via ADB
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
