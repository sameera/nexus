# /nxs.analyze

Validate epic, HLD, and task files for consistency, coverage gaps, and redundancies.

## Purpose

Performs cross-artifact consistency analysis before GitHub issue creation. Identifies issues that are cheaper to fix in documentation than in code. Delegates to the `nxs-analyzer` agent for comprehensive validation.

## When to Use

- **Integrated Mode**: Automatically called by `/nxs.tasks` before review checkpoint
- **Standalone Mode**: Manually after exiting `/nxs.tasks` to revalidate changes
- **With Remediation**: When you want to auto-fix common issues

## Prerequisites

**Required Files**:
- `epic.md`
- `HLD.md`
- `tasks/TASK-*.md` (at least one)

All in same directory.

## Usage

### Analysis Only (Default)

```bash
# With open file (infers directory):
/nxs.analyze

# With explicit path:
/nxs.analyze docs/product/features/03-space-scoped-tags/
```

### With Auto-Remediation

```bash
# Auto-fix common issues:
/nxs.analyze --remediate

# With explicit path and remediation:
/nxs.analyze docs/product/features/03-space-scoped-tags --remediate
```

## What It Does

Delegates to the `nxs-analyzer` agent which performs:

### Detection Passes

1. **Epic <-> Task Coverage Gaps**: Every user story has at least one task
2. **HLD <-> Task Coverage Gaps**: Every component, phase, API endpoint, and data entity has tasks
3. **Epic <-> HLD Alignment**: HLD scope matches epic scope
4. **Task <-> Task Logical Inconsistencies**: No circular dependencies, conflicts, terminology drift
5. **HLD <-> Task Technical Inconsistencies**: File paths, interfaces, technology choices match HLD
6. **Superfluous Task Detection**: Barrel-only, verification-only, <1hr tasks
7. **Redundancy Detection**: Duplicate or overlapping tasks

### Severity Classification

| Severity | Criteria |
|----------|----------|
| **CRITICAL** | Circular dependencies, conflicting implementations, missing core coverage |
| **HIGH** | User story with zero tasks, NFR with no coverage, scope drift |
| **MEDIUM** | Superfluous tasks, terminology drift, minor gaps |
| **LOW** | Style inconsistencies, suggestions |

### Remediation Classification

| Classification | Code | Auto-Fixable |
|---------------|------|--------------|
| AUTO | `[A-*]` | Yes - programmatically fixable |
| MANUAL | `[M-*]` | No - requires human judgment |

### Auto-Remediation Actions (--remediate flag)

When `--remediate` is used, the analyzer automatically fixes:

| Finding Type | Action |
|--------------|--------|
| Superfluous: Barrel/export task | Merge export statements into originating task, delete file |
| Superfluous: Verification-only | Merge verification steps into source task, delete file |
| Superfluous: Effort < 1 hour | Merge into blocked-by task (or first task it blocks) |
| Task numbering gaps | Renumber tasks sequentially after merges |
| Terminology drift | Normalize to HLD canonical term across all tasks |

## Output

### Generated File

`{epic-dir}/tasks/task-review.md` - Comprehensive analysis report with:

- Summary metrics table
- Auto-remediated section (if remediation ran)
- Critical/High/Medium/Low sections with actionable findings
- Coverage report tables (Stories -> Tasks, Components -> Tasks, NFRs -> Tasks)
- Superfluous tasks table
- Recommended actions

### Console Output

```
Analysis complete: {epic-directory}/tasks/task-review.md

Summary:
   - {N} findings ({critical} critical, {high} high, {medium} medium, {low} low)
   - User story coverage: {X}%
   - HLD coverage: {X}%
   - Superfluous tasks identified: {N}

{If --remediate was used}
Auto-remediation applied:
   - {N} tasks merged
   - {N} terminology fixes
   - Tasks renumbered: {yes/no}

{Severity indicator}
```

### Severity Indicators

- **CRITICAL > 0**: "CRITICAL ISSUES - Resolve before proceeding"
- **HIGH > 0**: "HIGH priority issues - Review recommended"
- **Otherwise**: "No blocking issues"

## Example task-review.md

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

## Auto-Remediated

_Issues fixed during analysis._

- [x] **[A-M1]** Superfluous Task: Barrel file only
  - **Original**: TASK-42.05 "Export tag types"
  - **Action**: Merged into TASK-42.02, deleted original

- [x] **[A-M2]** Terminology Drift: Inconsistent naming
  - **Location**: TASK-42.03, 42.04
  - **Action**: Normalized "tagId" -> "tagId" across all tasks

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

---

## Coverage Report

### User Stories -> Tasks

| Story ID | Story Title | Mapped Tasks | Status |
|----------|-------------|--------------|--------|
| user-can-create-tag | User can create tags | TASK-42.02, 42.03 | Covered |

### HLD Components -> Tasks

| Component | Layer | Mapped Tasks | Status |
|-----------|-------|--------------|--------|
| TagService | Backend | TASK-42.02 | Covered |

---

## Superfluous Tasks

| Task ID | Title | Reason | Merge Into | Status |
|---------|-------|--------|------------|--------|
| TASK-42.05 | Export tag types | Barrel file only | TASK-42.02 | Auto-merged |

---

## Recommended Actions

1. Add performance test criteria to TASK-42.03
2. Add rollback criterion to TASK-42.01
3. Review task-review.md findings before issue creation
```

## Integration with /nxs.tasks

When called from `/nxs.tasks`:

1. `/nxs.tasks` generates task files
2. `/nxs.tasks` invokes `/nxs.analyze` with `--remediate` mode
3. `/nxs.analyze` applies auto-remediation and writes `task-review.md`
4. `/nxs.tasks` includes analysis in review checkpoint

## Common Issues

### Missing Required Files

**Problem**: "epic.md not found" or "HLD.md not found"

**Solutions**:
1. Run `/nxs.epic` first (for epic.md)
2. Run `/nxs.hld` first (for HLD.md)
3. Verify directory structure

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

**Use --remediate**: The auto-remediation is conservative and safe. Review `task-review.md` to see what changed.

**Fix Critical First**: Don't ignore critical findings. They indicate fundamental problems.

**Revalidate After Edits**: Re-run standalone after manual task file changes.

**Check Coverage**: Even with zero findings, review the coverage percentages to ensure completeness.

## Related Commands

- [/nxs.tasks](nxs-tasks.md) - Auto-runs this analysis with remediation
- [/nxs.epic](nxs-epic.md) - Creates epic.md (prerequisite)
- [/nxs.hld](nxs-hld.md) - Creates HLD.md (prerequisite)

## Related Concepts

- [Task Decomposition](../concepts/task-decomposition.md) - Why consistency matters
