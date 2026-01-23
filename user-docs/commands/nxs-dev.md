# /nxs.dev

Fetch a GitHub issue and implement it via test-first workflow with automatic workspace management.

## Purpose

Orchestrates the complete implementation workflow for a single task: workspace setup, test-first development, commit, and issue closure. Acts as a transparent relay between user and the `nxs-dev` implementation agent.

## When to Use

- After tasks are created with `/nxs.tasks`
- When ready to implement a GitHub issue
- For any issue with implementation-ready LLD

## Prerequisites

**Required**:
- GitHub issue number
- `gh` CLI authenticated
- Issue has Low-Level Design (typically from `/nxs.tasks`)

**Recommended**:
- Git worktree support enabled
- Environment file patterns configured (for worktree mode)

## Usage

```bash
/nxs.dev <issue-number>

# Examples:
/nxs.dev 43
/nxs.dev #43  # # is optional
```

**CRITICAL**: Issue number is required. Command will not proceed without it.

## What It Does

### Phase 1: Fetch GitHub Issue

Retrieves issue content via `gh` CLI:

```bash
gh issue view 43 --json number,title,body,url,state
```

**Validates**:
- Issue exists
- Issue is not already closed (prompts if closed)

### Phase 2: Parse Issue Content

Extracts from issue body:
- Low-Level Design section
- Acceptance Criteria
- HLD reference (if present)
- Git Workspace configuration (if present)

### Phase 3: Workspace Setup

**Critical**: This phase is owned by the orchestrator, NOT the agent.

#### Step 1: Check Current Branch

```bash
git branch --show-current
```

**If on feature branch** (not `main`/`master`):
- ✅ Use in-place mode automatically
- ✅ No workspace prompt needed
- ✅ Skip to Phase 4

**If on `main`/`master`**: Continue to Step 2.

#### Step 2: Check Issue for Workspace Config

Looks for this pattern in issue body:

```markdown
## Git Workspace
- Worktree: `../nexus-worktrees/42`
- Branch: `feat/42-space-scoped-tags`
```

**If found**:
- Extracts worktree path and branch
- Creates worktree if doesn't exist
- Skips user prompt
- Proceeds to Step 4 (Environment Sync)

**If NOT found**: Continue to Step 3.

#### Step 3: Prompt User for Workspace Setup

**Only runs if on `main`/`master` AND no workspace config in issue.**

```
🔄 CHECKPOINT: Workspace Setup

You're currently on `main`. Recommend working in isolated worktree.

Issue: #43 - Create tags database schema

Suggested setup:
- Worktree: `../nexus-worktrees/43`
- Branch: `feat/issue-43-create-tags-schema`

Options:
1. ✅ Create isolated worktree (recommended)
2. 🔀 Switch this directory to new branch
3. ✏️ Custom worktree path and/or branch name

Which approach? (1/2/3)
```

**STOP and wait for user choice.**

Creates workspace based on choice:
- **Option 1**: `git worktree add ../nexus-worktrees/43 -b feat/issue-43-...`
- **Option 2**: `git checkout -b feat/issue-43-...`
- **Option 3**: Prompts for custom values, then creates

#### Step 4: Environment File Sync (Worktree Only)

If worktree was created, syncs local environment files:

1. **Check for saved patterns** in `CLAUDE.md`
2. **Discover if needed**: Run `detect_env_patterns.py`
3. **Confirm with user**:
   ```
   🔄 CHECKPOINT: Environment Sync

   Copy these files to new worktree?
   - .env.local
   - .vscode/settings.json

   Proceed? (y/n)
   ```
4. **Execute sync**: Run `copy_dev_env.py`
5. **Memorize patterns**: Save to `CLAUDE.md` if newly detected

### Phase 4: Handoff to nxs-dev Agent

Delegates to implementation agent with formatted context:

```markdown
@nxs-dev Implement the following GitHub issue. Workspace is configured.

## GitHub Issue #43: Create tags database schema

**URL**: https://github.com/org/repo/issues/43

**Workspace**: `../nexus-worktrees/42` (branch: `feat/42-space-scoped-tags`)

### Description
[Issue body content]

### Low-Level Design
[LLD section from issue]

### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
```

**Orchestrator Role During Implementation**: TRANSPARENT PASSTHROUGH

- Surface all agent output to user
- Pass all user responses to agent verbatim
- Do not interpret, summarize, or answer
- Format checkpoints for readability

### Phase 5: Implementation (Agent-Driven)

The `nxs-dev` agent follows test-first workflow:

1. **Load Standards**: Reads `docs/system/standards/`
2. **Plan Implementation**: Creates step-by-step plan
3. **Write Tests**: Implements failing tests first
4. **Implement Code**: Writes production code
5. **Verify Tests**: Ensures tests pass
6. **Iterate**: Repeats for each chunk

**Checkpoints** presented by orchestrator:

```
🔄 CHECKPOINT: Chunk Complete

✅ Chunk 1 complete - all tests passing. Proceed to Chunk 2?

- ✅ Yes (y)
- ❌ No (n)
```

### Phase 6: Pre-Commit Review

**Before committing**, orchestrator presents review checkpoint:

```
🔄 CHECKPOINT: Pre-Commit Review

Implementation complete. Review changes before committing.

Workspace: `../nexus-worktrees/42` (branch: `feat/42-space-scoped-tags`)

Files Changed:
M  migrations/20260123_create_tags.sql
A  migrations/20260123_create_content_tags.sql
A  tests/migrations/tags.test.ts

Summary:
 3 files changed, 127 insertions(+)

To see full details:
- cd ../nexus-worktrees/42 && git diff

Commit these changes?

- ✅ Commit Changes (y)
- ❌ Cancel Commit (n)
- 📄 Show Full Diff (d)
```

**STOP and wait for confirmation.**

**If user chooses "d"**: Shows full diff, re-prompts.
**If user chooses "n"**: Stops. Does NOT commit or close issue.
**If user chooses "y"**: Proceeds to commit.

### Phase 7: Commit Changes

Commits from within worktree:

```bash
cd ../nexus-worktrees/42 && git add -A && git commit -m "Create tags database schema" -m "Implements #43"
```

### Phase 8: Post Comment & Close Issue

Posts implementation summary:

```bash
gh issue comment 43 --body "## Implementation Summary

Created database migrations for tags system:
- tags table with space-scoped unique constraint
- content_tags junction table for many-to-many relationship

**Files Changed**:
- migrations/20260123_create_tags.sql
- migrations/20260123_create_content_tags.sql
- tests/migrations/tags.test.ts

**Branch**: `feat/42-space-scoped-tags`

---
*Implemented via Claude Code*"
```

**Evaluates Closure Eligibility**:

Close if ALL true:
- ✅ All tests pass
- ✅ No unresolved blockers
- ✅ No pending follow-up items

```bash
gh issue close 43 --reason completed
```

### Phase 9: Worktree Cleanup (Optional)

If worktree was used, offers cleanup:

```
🔄 CHECKPOINT: Worktree Cleanup

Implementation complete. Worktree at `../nexus-worktrees/42` no longer needed.

Options:
1. 🗑️ Remove worktree now
2. 📁 Keep worktree for further work
3. ℹ️ Show me how to remove later

Which option? (1/2/3)
```

**Option 1**: `git worktree remove ../nexus-worktrees/42`
**Option 2**: Keeps worktree intact
**Option 3**: Shows removal instructions

## Workflow Example

```bash
/nxs.dev 43
```

**Output**:
```
✓ Fetching issue #43...

Title: Create tags database schema
State: Open

✓ Located workspace config in issue
✓ Creating worktree: ../nexus-worktrees/42
✓ Syncing environment files...

Handing off to nxs-dev agent...

[Agent implements task]

🔄 CHECKPOINT: Pre-Commit Review
[Shows changes]

User: y

✓ Committed changes: a3f8d91
✓ Posted comment to issue #43
✓ Closed issue #43

✅ ISSUE #43 COMPLETE

Worktree: ../nexus-worktrees/42
Branch: feat/42-space-scoped-tags
Commit: a3f8d91
Status: Implemented and closed

Files Changed: 3
Tests Added: 1
```

## User Agency Boundaries

**Orchestrator MUST ask user for**:
- Worktree vs in-place choice (if not in config)
- Worktree path/branch (if custom)
- Proceed on `main` (if user explicitly chooses)
- Implementation options (when agent presents A/B/C)
- Chunk approvals
- Pre-commit review
- Worktree cleanup

**Orchestrator CAN decide autonomously**:
- GitHub API calls (fetch, comment, close)
- Using workspace config from issue
- Determining closure eligibility (factual)

## Checkpoints

All agent questions/options are formatted by orchestrator for clarity:

### Simple Y/N Format
```
🔄 CHECKPOINT

Context summary... proceed?

- ✅ Yes (y)
- ❌ No (n)
```

### Multiple Choice Format
```
🔄 AGENT CHECKPOINT

Context or issue summary

**Options:**
1. Option A description
2. Option B description
3. Option C description

Which option? (Enter 1, 2, or 3)
```

## Common Issues

### Issue Not Found

**Problem**: "Issue #43 does not exist"

**Solutions**:
1. Verify issue number
2. Check repository (must be in correct repo)
3. Ensure `gh` CLI authenticated

### Issue Already Closed

**Problem**: "Issue #43 is already closed"

**Solution**: Command prompts to proceed anyway (reopen scenario). Confirm if intentional.

### Worktree Creation Failed

**Problem**: "Path already exists"

**Solutions**:
1. Remove existing worktree: `git worktree remove path`
2. Choose different path (option 3)
3. Use in-place mode (option 2)

### Tests Failing

**Problem**: Agent reports test failures

**Solution**: Agent will iterate to fix. If stuck, respond to checkpoint with guidance or abort to fix manually.

## Next Steps

After implementation:

1. **Create PR**: `cd worktree-path && gh pr create`
2. **Implement next task**: `/nxs.dev <next-issue>`
3. **Merge worktree**: After PR approval, merge branch

## Tips

**Sequential Implementation**: Implement tasks in dependency order (task numbers).

**Trust Test-First**: Agent writes tests before implementation. This catches issues early.

**Review Before Commit**: Always review changes at pre-commit checkpoint.

**Keep Worktrees**: If implementing multiple tasks, keep worktree until all done.

**Environment Sync**: First worktree setup detects patterns. Subsequent tasks reuse saved patterns.

## Related Commands

- [/nxs.tasks](nxs-tasks.md) - Create tasks (run first)
- [/nxs.close](nxs-close.md) - Post-implementation review

## Related Concepts

- [Git Worktrees](../concepts/worktrees.md) - Isolated development environments
- [Agents](../reference/agents.md) - nxs-dev implementation agent
