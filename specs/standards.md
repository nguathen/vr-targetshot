# VR Game Framework — Coding Standards

> **Last Updated:** 2026-02-03
> **Language:** JavaScript (vanilla, no build step)
> **Engine:** A-Frame 1.6.0 + Three.js (WebXR)
> **Used by:** `/dev`, `/code-check` agents

---

## 1. Game Structure

Each game is a single `index.html` file containing:
- A-Frame scene markup (HTML)
- Inline JavaScript in `<script>` IIFE at bottom of `<body>`
- No external CSS/JS files (except framework includes)

Games should stay under ~500 lines. If larger, extract reusable logic into `framework/` modules.

---

## 2. JavaScript Style

### Variables & Functions
- `var` for IIFE scope (no build step, browser compatibility)
- camelCase functions: `goToGame()`, `spawnEnemy()`
- UPPER_SNAKE_CASE constants: `MAX_ENEMIES`, `WAVE_COUNT`

### Framework Modules
- IIFE pattern with global export: `window.ModuleName = { ... }`
- No ES Modules (no build step)
- No external NPM dependencies in client code

---

## 3. A-Frame Patterns

### Components
```javascript
AFRAME.registerComponent('my-component', {
  schema: { speed: { type: 'number', default: 1 } },
  init: function() { /* setup */ },
  tick: function(time, delta) { /* per-frame */ },
  remove: function() { /* cleanup */ }
});
```

### Performance
- Use `object3D` direct manipulation in tick (avoid `setAttribute`)
- Cache element references: `var el = document.getElementById('x')`
- Limit entities: ~50 max active for Quest 2 performance
- Use `visible="false"` instead of removing/adding entities

---

## 4. VR Input

- `laser-controls` for hand controllers
- `a-cursor` for gaze/mouse fallback
- `class="clickable"` on interactive elements
- `raycaster` with `objects: .clickable; far: 20`
- Listen for `click` event on elements

---

## 5. Error Handling

- `try/catch` around localStorage operations
- Fallback defaults when data is missing
- Console warnings for non-critical issues
- No silent error swallowing

---

## 6. Server (Node.js)

- ES Modules (`"type": "module"`)
- Express with CORS
- Static serving from `public/`
- Environment variables for config (`PORT`)
