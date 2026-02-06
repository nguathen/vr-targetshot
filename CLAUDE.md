# VR Game — Claude Rules

Dev/testing environment. All operations authorized.

**Stack:** A-Frame 1.6.0 + Three.js | Vanilla JS | Express | Android TWA

---

## Commands

```bash
npm run dev                    # Start both client + server
npm run client                 # Vite dev server (port 5173)
npm run server                 # Express server (port 3001)
.\quest-deploy.ps1             # Build + deploy TWA APK to Quest
.\quest-deploy.ps1 -SkipApk    # Code-only deploy
```

---

## Structure

```
client/                    # Frontend (Vite + A-Frame)
  src/
    js/
      components/          # A-Frame components
      core/                # Managers (audio, haptic, game, event-bus)
      game/                # Game systems (target, score, weapon)
      ui/                  # UI utilities
server/                    # Backend (Express.js)
specs/                     # architecture.md, tasks.md, issues.md, workflow.md
.claude/
  commands/                # Agent definitions
  rules/                   # Coding standards
```

---

## Game Rules

- Player rig: `#player-rig` > `a-camera` (HUD) + `#left-hand` + `#right-hand`
- Menu/Game split: `#menu-content` / `#game-content`
- Vanilla JS: `camelCase` vars/funcs, `PascalCase` classes
- A-Frame: `AFRAME.registerComponent()` with proper lifecycle (`init`, `tick`, `remove`)
- **GC-Free tick():** Pre-allocate vectors, no allocations in hot paths
- **Dispose Three.js objects:** Clean up in remove() handlers

---

## Performance Requirements (Quest 2/3)

| Metric | Target | Limit |
|--------|--------|-------|
| FPS | 80+ | 60 min |
| Draw calls | <50 | <100 |
| Dynamic lights | 2 | 4 max |
| Shadows | 1 light | 1024x1024 |

**Rule:** No allocations in tick(). Pre-allocate all vectors in init().

---

## Agent Workflow

**Recommended:** `/tl [requirement]` → `/pipeline` (auto: dev → code-check → test)

**Manual:** `/tl` → `/dev` → `/code-check` → `/test`

```
User Request
    ↓
/tl (Plan, Design, Delegate)
    ↓
/pipeline OR /dev (Implement)
    ↓
/code-check (Review)
    ↓
/test (Verify)
    ↓
Done (or escalate back to /tl)
```

---

## Agents vs Skills

| Type | Purpose | Examples |
|------|---------|----------|
| **Agent** | Role-based, Claude analyzes & decides | /tl, /dev, /test, /code-check, /pipeline |
| **Skill** | Task automation, fixed steps | Browser automation skills |
| **Utility** | Data generation | /getinfo |

### Core Development Team
- `/tl` - TechLead (planning, architecture, coordination)
- `/dev` - Developer (implementation, bug fixes)
- `/test` - Tester (code review mode for VR)
- `/code-check` - Code Review (quality, security, performance)
- `/pipeline` - **PRIMARY:** Process all tasks (dev→code-check→test with auto-fix)

### Specialized Agents
- `/debug` - Debug Agent (troubleshooting)
- `/doc` - Documentation Agent
- `/perf` - Performance Agent (VR optimization)
- `/sec` - Security Audit Agent
- `/st` - Status Agent

### Utilities
- `/getinfo` - Fake data generator

---

## Specs

| File | Purpose |
|------|---------|
| specs/architecture.md | System design, ADRs |
| specs/tasks.md | Task queue |
| specs/issues.md | Bug tracking |
| specs/workflow.md | Agent coordination |
| .claude/rules/*.md | Coding style, security, testing, performance, game-design |

---

## Quick Reference

**A-Frame Pattern:**
```javascript
AFRAME.registerComponent('my-component', {
  schema: { speed: { type: 'number', default: 1 } },
  init() {
    this._vec = new THREE.Vector3(); // Pre-allocate
  },
  tick(time, delta) {
    this._vec.set(1, 0, 0); // Reuse, no allocation
  },
  remove() {
    // Dispose Three.js objects
  }
});
```

**Event Bus:**
```javascript
import EventBus from './core/event-bus.js';
EventBus.on('enemy:hit', (data) => { ... });
EventBus.emit('enemy:hit', { damage: 10 });
```

---

## Getting Started

1. **New Feature:** `/tl [requirement]` → creates tasks → `/pipeline` runs all
2. **Bug Fix:** `/debug [issue]` → `/dev` → `/code-check` → `/test`
3. **Code Review:** `/code-check` after implementation
4. **Status:** `/st` to see project status

---

## Document Hierarchy

| Document | Purpose |
|----------|---------|
| **CLAUDE.md** | Master rules (this file) |
| specs/workflow.md | Agent coordination flow |
| specs/architecture.md | System design |
| .claude/commands/*.md | Agent definitions |
| .claude/rules/*.md | Coding standards |
