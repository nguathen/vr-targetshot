# Multi-Agent Workflow — VR Game

> **Last Updated:** 2026-02-05
> **Parent:** `CLAUDE.md` → Agent Mode section links here.
> **Authority:** Definitive source for agent coordination flow.

---

## Agent Team Overview

### /pipeline (PRIMARY - Recommended)

Unified skill that processes ALL pending tasks in a SINGLE session with automatic dev→code-check→test chaining. Token-efficient replacement for manual workflow (~5-10x savings).

```
/tl [requirement]    # Create tasks
/pipeline            # Process all pending tasks automatically
```

Features:
- Single context load (vs manual N×3 loads)
- Dependency resolution (processes in correct order)
- Auto-fix loops (max 3 retries per phase)
- Final summary report

### Core Agents (Manual/Debug)

| Agent | Command | Role | Use When |
|-------|---------|------|----------|
| TechLead | `/tl` | Architecture, planning, task breakdown | Always (create tasks) |
| **Pipeline** | `/pipeline` | **Auto dev→code-check→test for ALL tasks** | Standard workflow |
| Developer | `/dev` | Implementation, bug fixes | Debug single task |
| Code Review | `/code-check` | Security, quality, VR performance | Debug single task |
| Tester | `/test` | Code review mode (VR games) | Debug single task |

### Specialist Agents (On-Demand)

| Agent | Command | Role | When to Use |
|-------|---------|------|-------------|
| Debug | `/debug` | Error analysis, crash investigation | When bugs/crashes occur |
| Documentation | `/doc` | API docs, guides, README | After feature complete |
| Security | `/sec` | OWASP, CVE scan | Before release |
| Performance | `/perf` | VR profiling, Quest optimization | Performance issues |
| Status | `/st` | Project health report | Check project state |

---

## Workflow Diagram

### Option A: Unified Pipeline (Recommended)

```
User Request → /tl (create tasks in specs/tasks.md)
                    ↓
                /pipeline
                    ↓
    ┌─────────────────────────────────────┐
    │ For each pending task (by deps):    │
    │                                     │
    │   DEV: Implement                    │
    │     ↓                               │
    │   CODE-CHECK: Self-review           │
    │     ├─ APPROVED → continue          │
    │     └─ NEEDS CHANGES → fix (max 3x) │
    │     ↓                               │
    │   TEST: Code Review verify          │
    │     ├─ ALL PASS → mark completed    │
    │     └─ FAILURES → fix (max 3x)      │
    │     ↓                               │
    │   Next task...                      │
    └─────────────────────────────────────┘
                    ↓
            Final Summary Report
```

### Option B: Manual (Debug/Granular Control)

```
/tl → /dev → /code-check → /test
(invoke each manually, wait between each)
```

---

## Escalation Matrix

| Issue Type | Severity | Handler | Escalate To |
|------------|----------|---------|-------------|
| Security vulnerability | Critical | /dev | + /tl |
| Logic bug | High | /dev | - |
| Design flaw | High | /tl | /dev after fix |
| VR Performance issue | High | /dev | /tl if architectural |
| Code smell | Low | /dev | - |
| Test failure | High | /dev | /tl if design issue |

---

## Quality Gates

### Gate 1: Before /dev
- [ ] Requirements clear, acceptance criteria defined
- [ ] Architecture supports the change
- [ ] Performance budget considered (Quest 2/3)

### Gate 2: Before /code-check
- [ ] Implementation matches requirements
- [ ] Security checklist passed
- [ ] GC-free tick() patterns used
- [ ] Three.js objects disposed in remove()

### Gate 3: Before /test
- [ ] Security scan passed (OWASP)
- [ ] Code quality score ≥7/10
- [ ] No critical/high issues
- [ ] VR performance checklist passed

### Gate 4: Before Done
- [ ] All code review checks passing
- [ ] No regressions
- [ ] Performance verified on Quest

---

## Quick Commands Reference

```bash
# New Feature (Recommended)
/tl [requirement]    # Plan: creates tasks in specs/tasks.md
/pipeline            # Execute: processes all pending tasks automatically

# New Feature (Manual - for debugging)
/tl        # Plan
/dev       # Implement single task
/code-check # Review
/test      # Verify

# Bug Fix
/debug     # Investigate root cause
/dev       # Fix
/code-check # Review fix
/test      # Verify

# Project Status
/st        # Health report with recommendations
```

---

## Error/Crash Handling

```
Error occurs
     ↓
  /debug (Investigate)
     │
     ├── Check logs
     ├── Reproduce error
     ├── Find root cause
     └── Create ISSUE in specs/issues.md
            ↓
      /dev (Fix)
            ↓
      /code-check (Review)
            ↓
      /test (Verify)
            ↓
        Done
```

---

## File System

| File | Purpose | Updated By |
|------|---------|------------|
| `specs/tasks.md` | Task tracking | /tl, /dev |
| `specs/issues.md` | Issue tracking | /code-check, /test, /dev |
| `specs/tech-debt.md` | Technical debt | /code-check, /tl |
| `specs/architecture.md` | System design, ADRs | /tl |

---

## VR-Specific Testing

For 3D VR games, use **Code Review Mode** exclusively:

1. Read and analyze code against acceptance criteria
2. Verify A-Frame component lifecycle (init, tick, remove)
3. Check GC-free patterns (no allocations in tick)
4. Verify Three.js disposal in remove() handlers
5. No browser automation (3D rendering unreliable)

---

## Performance Gate (Quest 2/3)

All features must meet VR performance requirements:

| Metric | Target | Limit |
|--------|--------|-------|
| FPS | 80+ | 60 min |
| Draw calls | <50 | <100 |
| Dynamic lights | 2 | 4 max |
| Shadow map | 1024 | 1024 |

**Block merge if:**
- FPS drops >10%
- GC spikes visible
- Memory grows unbounded
