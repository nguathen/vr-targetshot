# Coding Style Rules

## SOLID Principles
- **S**ingle Responsibility - One class/function = one job
- **O**pen/Closed - Extend without modification
- **L**iskov Substitution - Subtypes replace base types
- **I**nterface Segregation - Small, focused interfaces
- **D**ependency Inversion - Depend on abstractions

## Naming Conventions
- Classes: `PascalCase` (nouns)
- Functions: `snake_case` (verbs)
- Constants: `UPPER_SNAKE_CASE`
- Private: `_leading_underscore`

## Function Rules
- Max 20 lines (prefer <10)
- Max 3 parameters (use objects for more)
- No side effects when possible

## Error Handling
- Use specific exceptions with context
- Never bare `except:` or swallow errors
- Log with structured data

## Code Smells to Avoid
| Smell | Fix |
|-------|-----|
| Long method (>20 lines) | Extract Method |
| Large class (>200 lines) | Extract Class |
| Duplicate code | Extract Method/Class |
| Long parameter list | Parameter Object |
| Magic numbers | Named constants |

## Comments
- Code should be self-documenting
- Comment "why", not "what"
- Use docstrings for public APIs

---

## Quest Material Guidelines (MANDATORY)

### Static Elements — `shader: flat`
```html
<!-- Floors, walls, menu panels, backgrounds -->
<a-plane material="shader: flat; color: #111133"></a-plane>
```
- **Always** use `shader: flat` for non-interactive static geometry
- Avoids per-fragment lighting calculations
- ~10-15% GPU savings vs standard shader

### Dynamic/Interactive Elements — Standard with Emissive
```html
<!-- Targets, grabbables, interactive objects -->
<a-box material="color: #ff6644; emissive: #331100; emissiveIntensity: 0.4"></a-box>
```
- Use emissive for glow effects instead of point lights
- `emissiveIntensity: 0.3-0.6` for visibility without bloom

### UI Elements — Opaque, No Transparency
```html
<!-- Buttons, panels, HUD -->
<a-plane material="shader: flat; color: #164016"></a-plane>
```
- **Avoid** `transparent: true` on UI
- Use solid dark backgrounds instead of alpha
- Transparency = alpha blending = expensive on Quest

### Forbidden Patterns
| Pattern | Problem | Fix |
|---------|---------|-----|
| `opacity < 1` on large surfaces | Alpha blending | Use solid colors |
| `shader: standard` on floors | Unnecessary PBR | Use `shader: flat` |
| Point lights for glow | GPU overhead | Use emissive materials |
| Multiple transparent layers | Overdraw | Single opaque layer |
