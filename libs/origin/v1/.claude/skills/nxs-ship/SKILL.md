---
name: nxs-ship
description: Post-implementation shipping workflow for issue completion. Handles commit operations, GitHub comment posting, closure eligibility evaluation, and worktree cleanup with support for YOLO mode auto-approval.
---

# nxs-ship

Automates the complete post-implementation shipping workflow for GitHub issue completion.

## Purpose

Extracts the post-implementation logic from `nxs.dev` Phase 5 into a reusable, testable skill. This skill:

1. Gathers git changes (status, diff stats) for review
2. Handles pre-commit review checkpoint (or auto-commit in YOLO mode)
3. Commits all implementation changes
4. Posts implementation summary to GitHub issue
5. Evaluates closure eligibility based on agent summary
6. Closes issue if eligible (tests pass, no blockers)
7. Handles worktree cleanup checkpoint (or auto-keep in YOLO mode)
8. Returns shipping metadata in structured JSON format

## Responsibilities

- **Change Gathering**: Collect git status and diff statistics
- **Commit Operations**: Stage and commit all changes with issue reference
- **GitHub Integration**: Post implementation summary as issue comment
- **Closure Evaluation**: Parse agent summary for test failures and blockers
- **Issue Closure**: Automatically close issue if eligible
- **Worktree Cleanup**: Manage worktree removal or retention
- **Checkpoint Management**: Return checkpoint data for user decisions

## Script Interface

### Command

```bash
python3 claude/.claude/skills/nxs-ship/scripts/ship_implementation.py \
    --workspace-path <path> \
    --workspace-mode <worktree|in-place> \
    --workspace-branch <branch> \
    --issue-number <number> \
    --issue-title <title> \
    --agent-summary <summary-text> \
    --tests-passed <true|false> \
    --yolo-mode <true|false>
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `--workspace-path` | Yes | Absolute path to workspace directory |
| `--workspace-mode` | Yes | "worktree" or "in-place" |
| `--workspace-branch` | Yes | Git branch name |
| `--issue-number` | Yes | GitHub issue number (e.g., "123") |
| `--issue-title` | Yes | Issue title for commit message |
| `--agent-summary` | Yes | Implementation summary from nxs-dev agent |
| `--tests-passed` | Yes | "true" or "false" - whether tests passed |
| `--yolo-mode` | Yes | "true" or "false" - enables auto-approval |

### Output Format

Returns JSON object with the following structure:

```json
{
    "commit_hash": "abc123f",
    "files_changed_count": 5,
    "issue_closed": true,
    "closure_blockers": [],
    "worktree_action": "removed|kept|pending",
    "github_comment_url": "https://github.com/org/repo/issues/123#issuecomment",
    "checkpoint_required": false,
    "checkpoint_data": {
        "type": "pre_commit_review|worktree_cleanup|error",
        "message": "Human-readable description",
        "...": "type-specific fields"
    }
}
```

## Workflow Phases

### Phase 1: Gather Changes

Collects git status and diff statistics for review:

```bash
git status --short
git diff --stat
```

**Output Fields:**
- `files_changed_count`: Number of modified files
- `checkpoint_data.status_output`: Raw git status output
- `checkpoint_data.diff_stat`: Diff statistics

### Phase 2: Pre-Commit Review

**YOLO Mode:**
- Auto-commits without user review
- Returns commit hash immediately

**Normal Mode:**
- Returns `pre_commit_review` checkpoint
- Waits for user approval
- Script must be re-invoked after approval

### Phase 3: Commit Changes

Stages and commits all changes:

```bash
git add -A
git commit -m "<issue-title>" -m "Implements #<issue-number>"
```

**Commit Message Format:**
```
<issue-title>

Implements #<issue-number>
```

**Output Field:**
- `commit_hash`: Short hash of created commit

### Phase 4: Post GitHub Comment

Posts implementation summary to issue:

```bash
gh issue comment <number> --body "<formatted-summary>"
```

**Comment Format:**
```markdown
## Implementation Summary

<agent-summary>

**Branch**: `<branch-name>`
**Mode**: YOLO mode | Normal mode

---
*Implemented via Claude Code (YOLO mode)*
```

**Output Field:**
- `github_comment_url`: URL to issue (comment ID not available from gh CLI)

### Phase 5: Evaluate Closure Eligibility

Parses agent summary for blockers and test failures.

**Closure Criteria (ALL must be true):**
- ✅ Tests passed (`--tests-passed true`)
- ✅ No "⚠️ REQUIRES ACTION:" in summary
- ✅ No test failure mentions in summary
- ✅ No blocker keywords (blocked, manual required, follow-up required)

**Output Fields:**
- `issue_closed`: Boolean indicating if issue was closed
- `closure_blockers`: List of reasons preventing closure

### Phase 6: Close Issue (If Eligible)

Automatically closes issue when eligible:

```bash
gh issue close <number> --reason completed
```

### Phase 7: Worktree Cleanup

**YOLO Mode:**
- Auto-keeps worktree (no prompt)
- Sets `worktree_action: "kept"`

**Normal Mode:**
- Returns `worktree_cleanup` checkpoint
- Waits for user decision
- Script can be re-invoked to remove worktree

**In-Place Mode:**
- No cleanup needed (not a worktree)
- Sets `worktree_action: "kept"`

## Checkpoint Types

### 1. `pre_commit_review`

Presented in normal mode before committing changes.

**Checkpoint Data:**
```json
{
    "type": "pre_commit_review",
    "message": "Review changes before committing",
    "workspace_path": "/absolute/path/to/workspace",
    "workspace_branch": "feat/issue-123-feature",
    "status_output": "M  src/file1.ts\nA  src/file2.ts",
    "diff_stat": "2 files changed, 45 insertions(+), 10 deletions(-)",
    "files_changed": 2
}
```

**User Response Handling:**
- `commit`: Re-invoke script with same arguments to complete shipping
- `cancel`: Stop workflow, leave changes uncommitted
- `show_diff`: Display full diff, then re-present checkpoint

**Orchestrator Example:**
```bash
echo "🔄 CHECKPOINT: Pre-Commit Review"
echo ""
echo "Files Changed: $FILES_CHANGED"
echo "$STATUS_OUTPUT"
echo ""
echo "$DIFF_STAT"
echo ""
echo "Commit these changes? (y/n/d)"
read RESPONSE

if [ "$RESPONSE" = "y" ]; then
    # Re-invoke script to complete shipping
    # (Script will skip checkpoint on second invocation)
fi
```

### 2. `worktree_cleanup`

Presented in normal mode after issue is complete (worktree mode only).

**Checkpoint Data:**
```json
{
    "type": "worktree_cleanup",
    "message": "Implementation complete. Remove worktree?",
    "worktree_path": "/absolute/path/to/worktree",
    "workspace_branch": "feat/issue-123-feature",
    "issue_closed": true
}
```

**User Response Handling:**
- `remove`: Execute `git worktree remove <path>`
- `keep`: Do nothing, worktree remains
- `info`: Show removal instructions

**Orchestrator Example:**
```bash
echo "🔄 CHECKPOINT: Worktree Cleanup"
echo ""
echo "Worktree: $WORKTREE_PATH"
echo "Branch: $BRANCH"
echo ""
echo "Options:"
echo "1. Remove worktree now"
echo "2. Keep worktree for further work"
echo "3. Show removal instructions"
echo ""
read CHOICE

if [ "$CHOICE" = "1" ]; then
    git worktree remove "$WORKTREE_PATH"
fi
```

### 3. `error`

Presented when an operation fails.

**Checkpoint Data:**
```json
{
    "type": "error",
    "message": "Failed to commit changes: <error-details>"
}
```

**Output Fields:**
- `commit_hash`: `null`
- `issue_closed`: `false`
- `closure_blockers`: Error description

## YOLO Mode Behavior

When `--yolo-mode true`:

1. **Auto-commit**: Commits changes without pre-commit review
2. **Auto-keep worktree**: No cleanup prompt (worktree kept for PR creation)
3. **Same closure logic**: Closure eligibility is still based on facts (tests, blockers)
4. **Same GitHub operations**: Comments and closures still execute normally

**Rationale for Auto-Keep:**
- YOLO mode assumes rapid iteration
- User likely wants to create PR immediately
- Worktree provides clean environment for PR review
- Manual cleanup is trivial: `git worktree remove <path>`

## Closure Evaluation Logic

### Blocker Detection Patterns

The script scans `agent_summary` for these patterns:

1. **Explicit Action Items**
   ```
   ⚠️ REQUIRES ACTION:
   - Manual database migration needed
   - Update API documentation
   ```

2. **Test Failures**
   ```
   Pattern: \btest.*fail
   Examples: "test failed", "tests failing", "unit test failure"
   ```

3. **Blocker Keywords**
   ```
   - \bblocked\b
   - \bmanual.*(?:required|needed)\b
   - \bfollow-?up.*(?:required|needed)\b
   - \bpending\b.*\bresolution\b
   ```

### Example Evaluations

**Eligible for Closure:**
```
Summary: "Implemented user caching layer with Redis. All tests passing.
Added 15 unit tests. Performance improved by 40%."

tests_passed: true
blockers: []
→ issue_closed: true
```

**Not Eligible - Action Required:**
```
Summary: "Implemented caching layer. ⚠️ REQUIRES ACTION:
Manual migration needed to populate cache. All tests passing."

tests_passed: true
blockers: ["Action required: Manual migration needed to populate cache"]
→ issue_closed: false
```

**Not Eligible - Tests Failed:**
```
Summary: "Implemented caching. Two integration tests failed due to
timeout issues. Needs investigation."

tests_passed: false
blockers: ["Tests did not pass", "Test failures mentioned in summary"]
→ issue_closed: false
```

## Integration with nxs.dev

The `nxs.dev` command invokes this skill in Phase 5:

```bash
# Extract agent summary and test results from agent output
AGENT_SUMMARY="<extracted from agent's final summary>"
TESTS_PASSED="true"  # Based on agent report

# Invoke shipping skill
result=$(python3 claude/.claude/skills/nxs-ship/scripts/ship_implementation.py \
    --workspace-path "$WORKSPACE_PATH" \
    --workspace-mode "$WORKSPACE_MODE" \
    --workspace-branch "$WORKSPACE_BRANCH" \
    --issue-number "$ISSUE_NUMBER" \
    --issue-title "$ISSUE_TITLE" \
    --agent-summary "$AGENT_SUMMARY" \
    --tests-passed "$TESTS_PASSED" \
    --yolo-mode "$YOLO_MODE")

# Parse results
COMMIT_HASH=$(echo "$result" | jq -r '.commit_hash')
ISSUE_CLOSED=$(echo "$result" | jq -r '.issue_closed')
CHECKPOINT_REQUIRED=$(echo "$result" | jq -r '.checkpoint_required')

# Handle checkpoint if needed
if [ "$CHECKPOINT_REQUIRED" = "true" ]; then
    CHECKPOINT_TYPE=$(echo "$result" | jq -r '.checkpoint_data.type')
    # Present checkpoint to user based on type
fi

# Report final status
if [ "$ISSUE_CLOSED" = "true" ]; then
    echo "✅ Issue #$ISSUE_NUMBER closed successfully"
else
    BLOCKERS=$(echo "$result" | jq -r '.closure_blockers[]')
    echo "⚠️ Issue #$ISSUE_NUMBER implemented but not closed"
    echo "Blockers: $BLOCKERS"
fi
```

## Error Handling

### Git Command Failures

The script raises `RuntimeError` for git operation failures:
- Commit failure (e.g., empty commit, hook rejection)
- Worktree removal failure (e.g., uncommitted changes)

**Orchestrator Response:**
- Check `checkpoint_data.type` for `error`
- Display `checkpoint_data.message` to user
- Provide remediation steps

### GitHub API Failures

The script handles GitHub failures gracefully:
- Comment posting failure: Warns but continues
- Issue closure failure: Warns but continues
- Sets `github_comment_url` to empty string on failure

**Rationale:**
- Git operations are critical (block on failure)
- GitHub operations are best-effort (warn on failure)
- User can manually comment/close if needed

## Testing Scenarios

### 1. Clean Implementation - Normal Mode

```bash
python3 ship_implementation.py \
    --workspace-path /tmp/test-worktree \
    --workspace-mode worktree \
    --workspace-branch feat/123-test \
    --issue-number 123 \
    --issue-title "Add caching" \
    --agent-summary "Implemented caching. All tests passing." \
    --tests-passed true \
    --yolo-mode false

# Expected:
# - pre_commit_review checkpoint returned
# - No commit made yet (awaiting approval)
```

### 2. Clean Implementation - YOLO Mode

```bash
python3 ship_implementation.py \
    --workspace-path /tmp/test-worktree \
    --workspace-mode worktree \
    --workspace-branch feat/124-test \
    --issue-number 124 \
    --issue-title "Add feature" \
    --agent-summary "Implemented feature X. All tests passing." \
    --tests-passed true \
    --yolo-mode true

# Expected:
# - Commit created immediately
# - GitHub comment posted
# - Issue closed
# - Worktree kept (no cleanup checkpoint)
```

### 3. Implementation with Blockers

```bash
python3 ship_implementation.py \
    --workspace-path /tmp/test-worktree \
    --workspace-mode worktree \
    --workspace-branch feat/125-test \
    --issue-number 125 \
    --issue-title "Add migration" \
    --agent-summary "Implemented. ⚠️ REQUIRES ACTION: Run migration script manually." \
    --tests-passed true \
    --yolo-mode false

# Expected:
# - pre_commit_review checkpoint
# - After approval: commit created, comment posted
# - Issue NOT closed (blocker detected)
# - Blockers: ["Action required: Run migration script manually"]
```

### 4. In-Place Mode

```bash
python3 ship_implementation.py \
    --workspace-path /home/user/repo \
    --workspace-mode in-place \
    --workspace-branch feat/126-test \
    --issue-number 126 \
    --issue-title "Fix bug" \
    --agent-summary "Fixed bug. All tests passing." \
    --tests-passed true \
    --yolo-mode false

# Expected:
# - pre_commit_review checkpoint
# - After approval: commit in current directory
# - No worktree cleanup checkpoint (in-place mode)
```

### 5. Test Failures

```bash
python3 ship_implementation.py \
    --workspace-path /tmp/test-worktree \
    --workspace-mode worktree \
    --workspace-branch feat/127-test \
    --issue-number 127 \
    --issue-title "Add feature" \
    --agent-summary "Implemented feature. Two tests failed." \
    --tests-passed false \
    --yolo-mode true

# Expected:
# - Commit created (YOLO auto-commits)
# - Comment posted
# - Issue NOT closed (tests failed)
# - Blockers: ["Tests did not pass", "Test failures mentioned in summary"]
```

## Two-Phase Invocation Pattern

For normal mode, the script uses a two-phase invocation pattern:

### Phase 1: Pre-Commit Review
```bash
result=$(ship_implementation.py <args> --yolo-mode false)
CHECKPOINT_REQUIRED=$(echo "$result" | jq -r '.checkpoint_required')

if [ "$CHECKPOINT_REQUIRED" = "true" ]; then
    # Present checkpoint to user
    # Wait for approval
fi
```

### Phase 2: Complete Shipping (After Approval)
```bash
# User approved - but how to signal completion?
# Option 1: Orchestrator commits directly, then calls with --already-committed flag
# Option 2: Orchestrator calls script twice (first returns checkpoint, second completes)
```

**Current Implementation:**
- Script returns checkpoint for pre-commit review
- Orchestrator must handle commit separately
- Script handles post-commit operations

**Simplified Flow:**
1. Script gathers changes → returns checkpoint
2. Orchestrator gets approval → commits directly
3. Orchestrator invokes script again for GitHub operations

This may be refined in future iterations.

## Design Decisions

### Why Skills, Not Inline Code?

1. **Atomic Operations**: Shipping is a self-contained workflow
2. **Reusability**: Future commands may need shipping workflows
3. **Testability**: Skills can be unit-tested independently
4. **Separation of Concerns**: Git/GitHub logic separated from orchestration
5. **No Breaking Changes**: Users still call `/nxs.dev` - refactoring is transparent

### Why Auto-Keep Worktrees in YOLO?

YOLO mode optimizes for velocity:
- User likely wants to create PR immediately
- Worktree provides clean staging area
- Manual removal is trivial
- Keeps workflow consistent with YOLO philosophy

### Why Factual Closure Logic?

Closure eligibility is determined by objective criteria:
- Test results (pass/fail)
- Blocker keywords in summary
- Action items flagged by agent

This ensures consistency regardless of mode (YOLO or normal).

## Future Enhancements

- Support for PR auto-creation in YOLO mode
- Configurable blocker patterns (per-project)
- Integration with PR templates
- Multi-comment summary (for large implementations)
- Automatic branch cleanup after merge
- Support for draft PRs
- Milestone tracking

## See Also

- [nxs-workspace-setup](../nxs-workspace-setup/SKILL.md) - Workspace setup (Phase 1 of refactoring)
- [nxs.dev](../../commands/nxs.dev.md) - Issue implementation orchestrator
- [nxs-env-sync](../nxs-env-sync/SKILL.md) - Environment file synchronization
