# Epic to Implementation Flow

Complete development lifecycle from capability idea to deployed code using Nexus.

## Overview

Nexus workflow has three distinct phases:

1. **Specification Phase**: Define what and why
2. **Implementation Phase**: Build and verify
3. **Completion Phase**: Close and learn

## Complete Workflow

```
┌─────────────────────────────────────────────────────┐
│              SPECIFICATION PHASE                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  1. Feature README                                  │
│     └─> Write capability description               │
│          + Frontmatter with feature: attribute     │
│                                                      │
│  2. /nxs.epic                                       │
│     └─> Generate user stories                      │
│          + Complexity assessment (S/M/L/XL)        │
│          + Right-sizing check                       │
│          + epic.md created                          │
│                                                      │
│  3. /nxs.hld (optional: /nxs.council for review)   │
│     └─> Generate technical design                  │
│          + nxs-architect agent analysis            │
│          + 16-section HLD document                  │
│          + HLD.md created                           │
│                                                      │
│  4. /nxs.tasks                                      │
│     └─> Decompose into implementation tasks        │
│          + Per-task LLD via nxs-architect          │
│          + Auto-consistency analysis                │
│          + Review checkpoint                        │
│          + Create GitHub issues                     │
│                                                      │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│            IMPLEMENTATION PHASE                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  5. /nxs.dev <issue-number> (repeat for each task) │
│     └─> Implement task                             │
│          + Workspace setup (worktree or branch)    │
│          + Test-first development                   │
│          + Pre-commit review checkpoint             │
│          + Commit and close issue                   │
│                                                      │
│  6. Create Pull Request                             │
│     └─> gh pr create                               │
│          + Review and merge                         │
│                                                      │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│              COMPLETION PHASE                        │
├─────────────────────────────────────────────────────┤
│                                                      │
│  7. /nxs.close                                      │
│     └─> Generate Post-Implementation Report        │
│          + Consolidate key decisions                │
│          + Document lessons learned                 │
│          + Close GitHub epic issue                  │
│          + Archive task files                       │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## Phase 1: Specification (Days 0-1)

### Step 1.1: Create Feature Directory

```bash
mkdir -p docs/product/features/tagging
cd docs/product/features/tagging
```

### Step 1.2: Write Feature README

`README.md`:
```markdown
---
feature: "User Tagging System"
status: "proposed"
priority: "high"
---

# User Tagging System

Allow users to create and manage custom tags for content organization.

## Problem
Users struggle to organize growing content libraries.

## Opportunity
Tagging improves discovery and user engagement.

## Success
60% of users create at least one tag.
```

### Step 1.3: Generate Epic

```bash
/nxs.epic
```

**Delivers**: `01-space-scoped-tags/epic.md`

**Time**: 15-30 minutes
**Review**: Validate user stories match intent

### Step 1.4: Optional Council Review

```bash
/nxs.council @01-space-scoped-tags/epic.md
```

**Purpose**: Multi-perspective validation (PM + Architect)

**Delivers**: Council recommendation on scope/approach

**Time**: 10-15 minutes
**Review**: Consider scope adjustments

### Step 1.5: Generate HLD

```bash
/nxs.hld @01-space-scoped-tags/epic.md
```

**Delivers**: `01-space-scoped-tags/HLD.md`

**Time**: 20-40 minutes
**Review**: Validate architecture, check for ⚠️ NEEDS CLARIFICATION

### Step 1.6: Generate Tasks

```bash
/nxs.tasks @01-space-scoped-tags/HLD.md
```

**Delivers**:
- `tasks/TASK-42.01.md` through `TASK-42.NN.md`
- `tasks/task-review.md` (analysis)
- GitHub epic issue (#42)

**Time**: 30-60 minutes (includes per-task LLD generation)

**Review Checkpoint**: Presented automatically
- Validate task breakdown
- Check task-review.md for issues
- Choose: `continue`, `skip N`, or `abort`

### Step 1.7: Confirm GitHub Issue Creation

```
Options:
- continue - Create GitHub issues for all tasks
- skip 03, 05 - Create issues excluding specified
- abort - Cancel to make manual edits

Your choice?
```

Choose `continue` to create issues.

**Delivers**: GitHub issues #43-47 (if 5 tasks)

## Phase 2: Implementation (Days 1-8)

### Step 2.1: Implement First Task

```bash
/nxs.dev 43
```

**Workspace Setup Checkpoint**:
```
Options:
1. Create isolated worktree (recommended)
2. Switch to new branch
3. Custom path/branch
```

Choose 1 (worktree) for isolation.

**Environment Sync Checkpoint**:
```
Copy these files to worktree?
- .env.local
- .vscode/settings.json

Proceed? (y/n)
```

Choose `y` to sync.

**Implementation**: Agent implements via test-first workflow

**Pre-Commit Review Checkpoint**:
```
Files Changed:
M  migrations/001_create_tags.sql
...

Commit these changes? (y/n/d)
```

Choose `y` to commit.

**Delivers**:
- Implementation committed
- GitHub issue #43 closed
- Comment posted with summary

**Time**: 2-4 hours (per task estimate)

### Step 2.2: Repeat for Each Task

```bash
/nxs.dev 44
/nxs.dev 45
/nxs.dev 46
/nxs.dev 47
```

**Work in dependency order** (task numbers reflect dependencies).

### Step 2.3: Create Pull Request

After all tasks complete:

```bash
cd ../nexus-worktrees/42  # Navigate to worktree
gh pr create --title "feat: Space-scoped tags" --body "Implements epic #42"
```

### Step 2.4: Review and Merge

Team reviews PR, merges to main.

## Phase 3: Completion (Day 8)

### Step 3.1: Generate PIR

```bash
/nxs.close @01-space-scoped-tags/epic.md
```

**Delivers**: `01-space-scoped-tags/PIR.md`

**Time**: 10-15 minutes

**Cleanup Checkpoint**:
```
Options:
1. Archive tasks to tasks-archive/
2. Keep tasks/ as-is
3. Delete tasks/ completely
```

Choose 1 (archive) to preserve history.

### Step 3.2: Review and Commit

```bash
git add 01-space-scoped-tags/PIR.md
git add 01-space-scoped-tags/epic.md  # Status updated to "closed"
git commit -m "docs: Close epic #42 - Space-scoped tags"
git push
```

### Step 3.3: Share Lessons

Distribute PIR to team for lessons learned.

## Timeline Example

| Phase | Activities | Duration |
|-------|------------|----------|
| **Day 0** | Feature README, /nxs.epic, /nxs.hld | 2 hours |
| **Day 1 AM** | /nxs.tasks, review, create issues | 1 hour |
| **Day 1 PM - Day 7** | Implement tasks 1-5 (/nxs.dev each) | 6.5 days |
| **Day 7 PM** | Create PR, review | 2 hours |
| **Day 8 AM** | Merge, /nxs.close | 1 hour |
| **Total** | | **8 days** |

For Medium (M) complexity epic as estimated.

## Key Decision Points

### Decision 1: Right-Size Epic

**When**: During `/nxs.epic` complexity assessment

**Options**:
1. Reduce scope (recommended for L/XL)
2. Generate multiple epics
3. Proceed with original scope

**Recommendation**: Choose 1 or 2 for L/XL complexity

### Decision 2: Address Consistency Issues

**When**: During `/nxs.tasks` review checkpoint

**Action**:
- **Critical issues**: Must fix before continuing
- **High issues**: Should fix
- **Medium/Low**: Optional

**Options**: `continue`, `skip`, or `abort`

### Decision 3: Workspace Mode

**When**: First `/nxs.dev` invocation (if on main branch)

**Options**:
1. Worktree (isolated, recommended)
2. In-place branch
3. Custom

**Recommendation**: Choose 1 (worktree) for parallel work

### Decision 4: Pre-Commit Review

**When**: Every `/nxs.dev` completion

**Action**: Review changes before committing

**Options**: `y` (commit), `n` (cancel), `d` (show full diff)

**Recommendation**: Always review. Cancel if unexpected changes.

## Checkpoints Summary

| Checkpoint | Command | Purpose | Action |
|------------|---------|---------|--------|
| Right-Sizing | /nxs.epic | Validate epic fits sprint | Reduce scope if L/XL |
| Task Review | /nxs.tasks | Validate consistency | Fix critical issues |
| Workspace Setup | /nxs.dev | Choose isolation strategy | Select worktree mode |
| Environment Sync | /nxs.dev | Copy local files | Confirm sync |
| Pre-Commit Review | /nxs.dev | Validate changes | Review before commit |
| Worktree Cleanup | /nxs.dev | Remove workspace | Archive or remove |
| Task Cleanup | /nxs.close | Archive task files | Choose archive option |

## Best Practices

### Do

✅ **Read your specs**: Review epic and HLD before implementing
✅ **Fix critical issues**: Don't skip consistency analysis warnings
✅ **Use worktrees**: Keeps main clean, enables parallel work
✅ **Review before commit**: Catch issues before they're permanent
✅ **Document lessons**: PIR captures what you learned

### Don't

❌ **Skip complexity assessment**: Oversized epics cause problems
❌ **Ignore clarifications**: Resolve ⚠️ NEEDS CLARIFICATION items
❌ **Rush checkpoints**: They exist to prevent rework
❌ **Work out of order**: Task dependencies matter
❌ **Skip PIR**: Lessons learned are valuable for next epic

## Troubleshooting

### Epic Too Large

**Symptom**: Complexity assessment shows L or XL

**Solution**: Choose decomposition option 1 or 2 during right-sizing prompt

### Critical Consistency Issues

**Symptom**: `/nxs.tasks` reports critical findings

**Solution**: Review `task-review.md`, fix issues, re-run `/nxs.tasks`

### Tests Failing During Implementation

**Symptom**: `/nxs.dev` agent reports test failures

**Solution**: Agent will iterate. If stuck, provide guidance at checkpoint.

### Merge Conflicts

**Symptom**: PR has conflicts with main

**Solution**: In worktree, merge main, resolve conflicts, push

## Related Documentation

- [Specification-First Philosophy](specification-first.md) - Why this workflow
- [Git Workflows](git-workflows.md) - Worktree details
- [Commands Reference](../commands/nxs-epic.md) - Detailed command docs
