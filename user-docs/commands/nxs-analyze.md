# /nxs.analyze

Validate epic, HLD, and task files for consistency, coverage gaps, and redundancies.

## Purpose

Performs cross-artifact consistency analysis before GitHub issue creation. Identifies issues that are cheaper to fix in documentation than in code.

## When to Use

- **Integrated Mode**: Automatically called by `/nxs.tasks` before review checkpoint
- **Standalone Mode**: Manually after exiting `/nxs.tasks` to revalidate changes

## Prerequisites

**Required Files**:
- `epic.md`
- `HLD.md`
- `tasks/TASK-*.md` (at least one)

All in same directory.

## Usage

### Option 1: Automatic (via /nxs.tasks)
```bash
/nxs.tasks
# Automatically runs analysis before review checkpoint
```

### Option 2: Standalone
```bash
# With open file (infers directory):
/nxs.analyze

# With explicit path:
/nxs.analyze docs/product/features/03-space-scoped-tags/
```

## What It Does

**STRICTLY READ-ONLY**: Does NOT modify any files except creating `task-review.md`.

### Phase 1: Load Artifacts

Reads required sections from:

**epic.md**:
- User stories
- Acceptance criteria
- Success metrics
- Dependencies, assumptions, out-of-scope

**HLD.md**:
- Components
- Implementation phases
- Non-functional requirements
- API endpoints
- Data entities

**TASK-*.md files**:
- Titles, summaries
- Files to modify
- Interfaces/types
- Dependencies (blocked_by, blocks)
- Acceptance criteria
- Effort estimates

### Phase 2: Build Semantic Models

Creates internal representations for cross-referencing:
- User story → tasks mapping
- HLD component → tasks mapping
- Task → task dependencies
- API endpoint → implementation task
- Data entity → migration task

### Phase 3: Detection Passes

Runs 7 detection passes with 50-finding limit:

#### A. Epic ↔ Task Coverage Gaps

Validates every user story has at least one task:

```markdown
❌ Gap: User story "admin can delete tags" has zero task coverage
```

#### B. HLD ↔ Task Coverage Gaps

Validates:
- Every HLD component has implementing tasks
- Phase deliverables have corresponding tasks
- Non-functional requirements (NFRs) reflected in acceptance criteria
- API endpoints have implementation tasks
- Data entities have migration tasks

#### C. Epic ↔ HLD Alignment

Checks:
- HLD scope matches epic scope
- HLD success criteria align with epic metrics
- HLD phases cover all user stories

```markdown
⚠️ Scope Drift: HLD includes "tag analytics" but epic has it out-of-scope
```

#### D. Task ↔ Task Logical Inconsistencies

Detects:
- Circular dependencies (A blocks B, B blocks A)
- Conflicting implementations (two tasks creating same file differently)
- Terminology drift (same entity called different names)
- Orphan tasks (no dependencies in either direction)

#### E. HLD ↔ Task Technical Inconsistencies

Validates tasks align with HLD:
- File paths match HLD architecture
- Interfaces/types match HLD data model
- API implementations match HLD endpoint specs
- Technology choices match HLD stack

```markdown
❌ Technical Deviation: TASK-42.03 uses MongoDB but HLD specifies PostgreSQL
```

#### F. Superfluous Task Detection

Identifies tasks for consolidation using heuristics:

**Heuristic 1: Effort Too Small**
- Task <1 hour → merge into related task

**Heuristic 2: Export/Barrel File Tasks**
- Task only creates `index.ts` to re-export → merge into originating task

**Heuristic 3: Verification-Only Tasks**
- Task only runs tests created by another → merge verification into source task

**Detection patterns**:
- Title contains "export", "barrel", "re-export", "index file"
- Title contains "run tests", "verify", "validate"
- Effort <1 hour

#### G. Redundancy Detection

Finds:
- Duplicate tasks (same files, same criteria)
- Overlapping scope (same feature, different implementation)

### Phase 4: Classify Findings

**Severity Levels**:
| Severity | Criteria |
|----------|----------|
| **CRITICAL** | Circular dependencies, conflicting implementations, missing core coverage |
| **HIGH** | User story with zero tasks, NFR with no coverage, scope drift |
| **MEDIUM** | Superfluous tasks, terminology drift, minor gaps |
| **LOW** | Style inconsistencies, suggestions |

**Remediation Classification**:
| Finding | Type | Auto-Fix |
|---------|------|----------|
| Barrel file task | AUTO | Merge export statements, delete task |
| Verification-only task | AUTO | Merge verification steps, delete task |
| Effort <1 hour | AUTO | Merge into blocked-by task |
| Task numbering gaps | AUTO | Renumber sequentially |
| Terminology drift | AUTO | Normalize to HLD canonical term |
| Circular dependencies | MANUAL | Requires understanding intent |
| Coverage gaps | MANUAL | Requires creating new tasks |

**Finding ID Format**:
- `[A-C1]` = Auto-remediable Critical
- `[M-H1]` = Manual High
- `[A-M1]` = Auto-remediable Medium

### Phase 5: Generate task-review.md

Creates actionable report in `tasks/task-review.md`:

```markdown
# Task Review: Space-Scoped Tags

**Analysis Date**: 2026-01-23 14:30
**Epic**: docs/product/features/03-space-scoped-tags/epic.md
**HLD**: docs/product/features/03-space-scoped-tags/HLD.md
**Tasks Analyzed**: 7

---

## Summary

| Metric | Value |
|--------|-------|
| Total Findings | 4 |
| Auto-Remediable | 2 |
| Requires Manual Review | 2 |
| Critical Issues | 0 |
| High Issues | 0 |
| Medium Issues | 3 |
| Low Issues | 1 |
| User Story Coverage | 100% (5/5) |
| HLD Component Coverage | 100% (6/6) |
| NFR Coverage | 80% (4/5) |
| Superfluous Tasks | 2 |

---

## Auto-Remediated ✅

_Issues fixed by /nxs.tasks._

- [x] **[A-M1]** Superfluous Task: Barrel file only
  - **Original**: TASK-42.05 "Export tag types"
  - **Action**: Merged into TASK-42.02, deleted original

- [x] **[A-M2]** Terminology Drift: Inconsistent naming
  - **Location**: TASK-42.03, 42.04
  - **Action**: Normalized "tagId" → "tagId" across all tasks

---

## Critical Issues (Manual)

_MUST resolve before creating GitHub issues._

None found.

---

## High Priority (Manual)

_SHOULD resolve before creating issues._

None found.

---

## Medium Priority (Manual)

_Consider addressing for improved quality._

- [ ] **[M-M1]** NFR Coverage Gap: Performance requirement missing
  - **Location**: HLD Section 4, Non-Functional Requirements
  - **Details**: HLD specifies "API response <200ms" but no task includes performance testing
  - **Remediation**: Add performance test criteria to TASK-42.03

- [ ] **[M-M2]** Documentation Gap: Migration rollback missing
  - **Location**: TASK-42.01
  - **Details**: Migration task lacks rollback acceptance criterion
  - **Remediation**: Add "Migration includes rollback script" to acceptance criteria

---

## Coverage Report

### User Stories → Tasks

| Story ID | Story Title | Mapped Tasks | Status |
|----------|-------------|--------------|--------|
| user-can-create-tag | User can create tags | TASK-42.02, 42.03 | ✅ Covered |
| user-can-apply-tag | User can apply tags | TASK-42.04 | ✅ Covered |

### HLD Components → Tasks

| Component | Layer | Mapped Tasks | Status |
|-----------|-------|--------------|--------|
| TagService | Backend | TASK-42.02 | ✅ Covered |
| TagRepository | Data | TASK-42.01, 42.02 | ✅ Covered |

---

## Superfluous Tasks

| Task ID | Title | Reason | Merge Into | Status |
|---------|-------|--------|------------|--------|
| TASK-42.05 | Export tag types | Barrel file only | TASK-42.02 | ✅ Auto-merged |

---

## Recommended Actions

1. Add performance test criteria to TASK-42.03
2. Add rollback criterion to TASK-42.01
3. Review task-review.md findings before issue creation

---

## Next Steps

- **If CRITICAL issues exist**: Resolve before proceeding
- **If only HIGH/MEDIUM/LOW**: Review, address as appropriate
- **To apply fixes**: Edit task files, re-run /nxs.analyze
```

### Phase 6: Report Completion

```
✅ Analysis complete: tasks/task-review.md

📊 Summary:
   - 4 findings (0 critical, 0 high, 3 medium, 1 low)
   - User story coverage: 100%
   - HLD coverage: 100%
   - Superfluous tasks identified: 2

✅ No blocking issues - Safe to proceed with issue creation.
```

## Integration with /nxs.tasks

When called from `/nxs.tasks`:

1. `/nxs.tasks` generates task files
2. `/nxs.tasks` invokes `/nxs.analyze`
3. `/nxs.analyze` writes `task-review.md`
4. `/nxs.tasks` includes analysis in review checkpoint:

```
Analysis: 0 critical, 0 high, 2 medium issues
See tasks/task-review.md for details.

⛔ Critical issues must be resolved before proceeding. (if any)
```

## Standalone Usage

Useful when:
- User aborted `/nxs.tasks` to make manual edits
- User wants to revalidate after editing task files
- User wants analysis without full task generation

```bash
/nxs.analyze docs/product/features/03-space-scoped-tags/
```

## Output

**Single File**:
- `{epic-dir}/tasks/task-review.md`

**Never modifies**:
- epic.md
- HLD.md
- TASK-*.md

## Common Issues

### Missing Required Files

**Problem**: "epic.md not found"

**Solutions**:
1. Run `/nxs.epic` first
2. Verify directory structure
3. Ensure all artifacts in same directory

### No Task Files

**Problem**: "No TASK-*.md files found"

**Solutions**:
1. Run `/nxs.tasks` first
2. Check tasks/ folder exists

### Zero Findings

**Problem**: "Is this normal?"

**Solution**: Yes. Zero findings means perfect consistency. Report still generated with coverage stats.

## Tips

**Run Early**: Better to find issues before implementing.

**Trust Auto-Remediation**: `/nxs.tasks` auto-fixes safe issues. Review `task-review.md` to understand what was changed.

**Fix Critical First**: Don't ignore critical findings. They indicate fundamental problems.

**Revalidate After Edits**: Re-run standalone after manual task file changes.

## Related Commands

- [/nxs.tasks](nxs-tasks.md) - Auto-runs this analysis
- [/nxs.epic](nxs-epic.md) - Creates epic.md (prerequisite)
- [/nxs.hld](nxs-hld.md) - Creates HLD.md (prerequisite)

## Related Concepts

- [Task Decomposition](../concepts/task-decomposition.md) - Why consistency matters
