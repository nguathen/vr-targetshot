# Performance Rules

## VR Frame Rate Targets

| Platform | Target | Minimum | Refresh Rate |
|----------|--------|---------|--------------|
| Quest 2/3 | **80 fps** | 60 fps | 72/90/120 Hz |
| Desktop VR | 90 fps | 72 fps | 90 Hz |
| Desktop flat | 60 fps | 30 fps | 60 Hz |

> **Design for 80+ FPS** on Quest ensures smooth experience at 90Hz default refresh rate.

## WebXR/Three.js Budgets

| Resource | Budget | Notes |
|----------|--------|-------|
| Draw calls | <100 per frame | Batch static geometry, target: 50 |
| Triangles | <300K visible | Use LOD for complex models |
| Textures | <50MB total | Compress, use atlases |
| Dynamic lights | ≤4 | Prefer 2, bake static lighting |
| Shadow-casting lights | 1 | Directional only |
| Physics bodies | <50 active | Disable distant objects |

## GC-Free Patterns (CRITICAL for 90 FPS)

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

  // Circular buffer for history
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

init: function() {
  _hittableCache.add(this.el);
},
remove: function() {
  _hittableCache.delete(this.el);
}

tick: function() {
  // BAD: document.querySelectorAll('[hittable]')
  // GOOD: _hittableCache.forEach()
  _hittableCache.forEach(function(el) { ... });
}
```

## A-Frame Performance Checklist

- [ ] No allocations in tick() - pre-allocated vectors
- [ ] Object pooling for spawned entities
- [ ] Three.js objects disposed in remove()
- [ ] Event listeners cleaned up in remove()
- [ ] Frustum culling enabled (default)
- [ ] LOD for complex models

## Quest Renderer Settings

```html
<a-scene
  renderer="antialias: false; colorManagement: true; physicallyCorrectLights: false"
>
```

| Setting | Quest Value | Reason |
|---------|-------------|--------|
| `antialias` | `false` | MSAA expensive on mobile GPU |
| `pixelRatio` | `1.0` | Native resolution |
| `physicallyCorrectLights` | `false` | Simpler light calculations |

## Anti-Patterns

| Issue | Solution |
|-------|----------|
| Creating entities in game loop | Pre-spawn, use pool |
| New materials per entity | Share materials |
| Unbounded particle systems | Set maxParticles, auto-dispose |
| No LOD on detailed models | Add LOD component |
| querySelectorAll in tick | Cache element references |

## Response Time Targets (API)

| Operation | Target | Max Acceptable |
|-----------|--------|----------------|
| API endpoint | <100ms | <500ms |
| Database query | <50ms | <200ms |
| Page load | <1s | <3s |

## Algorithm Complexity

### Prefer
| Operation | Complexity |
|-----------|------------|
| Hash lookup | O(1) |
| Binary search | O(log n) |
| Single loop | O(n) |
| Sorting | O(n log n) |

### Avoid
| Pattern | Complexity | Fix |
|---------|------------|-----|
| Nested loops | O(n²) | Use hash map |
| Triple nested | O(n³) | Redesign algorithm |
| Recursive without memo | Exponential | Add memoization |

## Memory Management

### Anti-Patterns
- ❌ Loading entire file into memory
- ❌ Unbounded caches
- ❌ Circular references
- ❌ Large global variables
- ❌ No disposal of Three.js objects

## Profiling Commands

```bash
# Quest FPS monitoring
adb logcat | grep -E "(fps|FPS|frame)"

# GPU/CPU usage
adb shell dumpsys gpu

# Thermal state
adb shell dumpsys thermalservice
```

## Merge Blocker

**Agent must not merge if:**
- FPS drops >10% on test scene
- GC spikes visible in profiler
- Memory grows unbounded over time
- GPU utilization >85% average on Quest

---

**Rule: Measure first, optimize second. Premature optimization is the root of all evil.**

---

**See also:** `.claude/rules/game-design.md`, `specs/architecture.md`
