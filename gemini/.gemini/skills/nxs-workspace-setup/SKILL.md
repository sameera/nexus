---
name: nxs-workspace-setup
description: Automates git workspace setup for issue implementation. Handles worktree creation, branch management, and environment file synchronization with support for YOLO mode auto-approval and issue-embedded configurations.
---

# nxs-workspace-setup

Automates git workspace setup for issue implementation, handling worktree creation, branch management, and environment file synchronization.

## Purpose

Extracts the workspace setup logic from `nxs.dev` Phase 2b into a reusable, testable skill. This skill:

1. Detects current branch state (skip setup if already on feature branch)
2. Parses issue body for embedded workspace configuration
3. Generates suggested worktree paths and branch names
4. Handles YOLO mode auto-creation vs interactive prompts
5. Manages branch conflicts
6. Creates worktrees or in-place branches
7. Coordinates environment file synchronization
8. Returns workspace metadata in structured JSON format

## Responsibilities

- **Branch Detection**: Check if already on a feature branch (skip setup if so)
- **Config Parsing**: Extract `## Git Workspace` section from issue body
- **Path Generation**: Create sensible defaults from issue number and title
- **Conflict Handling**: Detect and report branch name conflicts
- **Workspace Creation**: Execute `git worktree add` or `git checkout -b`
- **Environment Sync**: Trigger `nxs-env-sync` skill for worktrees
- **Checkpoint Management**: Return checkpoint data for user decisions

## Script Interface

### Command

```bash
python3 gemini/.gemini/skills/nxs-workspace-setup/scripts/setup_workspace.py \
    --issue-number <number> \
    --issue-title <title> \
    --issue-body <body> \
    --yolo-mode <true|false> \
    [--workspace-config <path>:<branch>]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `--issue-number` | Yes | GitHub issue number (e.g., "123") |
| `--issue-title` | Yes | Issue title for branch name generation |
| `--issue-body` | Yes | Full issue body text (for config parsing) |
| `--yolo-mode` | Yes | "true" or "false" - enables auto-approval |
| `--workspace-config` | No | Explicit config in format "path:branch" |

### Output Format

Returns JSON object with the following structure:

```json
{
    "workspace_path": "/absolute/path/to/worktree",
    "workspace_branch": "feat/issue-123-feature-name",
    "workspace_mode": "worktree|in-place",
    "action_taken": "created|reused|skipped|pending|conflict|error",
    "env_sync_performed": false,
    "checkpoint_required": true,
    "checkpoint_data": {
        "type": "workspace_choice|branch_conflict|env_sync_confirm|env_sync_yolo|error",
        "message": "Human-readable description",
        "options": [...],
        "...": "type-specific fields"
    }
}
```

## Action Types

| Action | Meaning | Checkpoint Required |
|--------|---------|---------------------|
| `skipped` | Already on feature branch, no setup needed | No |
| `created` | Workspace created successfully | Yes (env sync) |
| `reused` | Existing worktree reused | No |
| `pending` | Awaiting user workspace choice | Yes |
| `conflict` | Branch name conflict detected | Yes |
| `error` | Setup failed | No |

## Checkpoint Types

### 1. `workspace_choice`

Presented when on main/master branch with no embedded config (normal mode only).

**Checkpoint Data:**
```json
{
    "type": "workspace_choice",
    "message": "You're on 'main'. Choose workspace setup approach.",
    "issue_number": "123",
    "issue_title": "Add user caching",
    "suggested_path": "../myrepo-worktrees/123",
    "suggested_branch": "feat/issue-123-add-user-caching",
    "options": [
        {
            "label": "Create isolated worktree (recommended)",
            "value": "worktree",
            "description": "Creates worktree at ../myrepo-worktrees/123"
        },
        {
            "label": "Switch this directory to new branch",
            "value": "in_place",
            "description": "Creates branch feat/issue-123-add-user-caching in current directory"
        },
        {
            "label": "Custom worktree path and/or branch name",
            "value": "custom",
            "description": "Specify custom path and branch"
        }
    ]
}
```

**User Response Handling:**
- `worktree`: Create worktree with suggested path/branch
- `in_place`: Create branch in current directory
- `custom`: Prompt for custom values, then re-invoke script

### 2. `branch_conflict`

Presented when suggested branch name already exists (even in YOLO mode).

**Checkpoint Data:**
```json
{
    "type": "branch_conflict",
    "message": "Branch 'feat/issue-123-feature' already exists",
    "suggested_branch": "feat/issue-123-feature",
    "options": [
        {"label": "Use existing branch", "value": "use_existing"},
        {"label": "Create with suffix: feat/issue-123-feature-v2", "value": "add_suffix"},
        {"label": "Custom branch name", "value": "custom"}
    ]
}
```

**User Response Handling:**
- `use_existing`: Checkout existing branch in worktree
- `add_suffix`: Create branch with `-v2` suffix
- `custom`: Prompt for custom branch name, then re-invoke script

### 3. `env_sync_confirm`

Presented after worktree creation (normal mode).

**Checkpoint Data:**
```json
{
    "type": "env_sync_confirm",
    "message": "Worktree created from issue config. Sync environment files?",
    "worktree_path": "/absolute/path/to/worktree"
}
```

**User Response Handling:**
- `yes`: Invoke `nxs-env-sync` skill
- `no`: Skip environment sync

### 4. `env_sync_yolo`

Presented after worktree creation (YOLO mode).

**Checkpoint Data:**
```json
{
    "type": "env_sync_yolo",
    "message": "Auto-created worktree (YOLO mode). Auto-sync environment?",
    "worktree_path": "/absolute/path/to/worktree"
}
```

**Orchestrator Action:**
- Automatically invoke `nxs-env-sync` skill without user prompt
- Report sync results to user (info only)

### 5. `error`

Presented when workspace creation fails.

**Checkpoint Data:**
```json
{
    "type": "error",
    "message": "Failed to create worktree"
}
```

## YOLO Mode Behavior

When `--yolo-mode true`:

1. **Auto-create worktree**: Uses suggested path/branch without prompting
2. **Auto-sync environment**: Automatically invokes `nxs-env-sync` after creation
3. **Branch conflicts**: STILL prompt user (design decision - conflict resolution requires judgment)
4. **No workspace choice**: Skip the worktree vs in-place prompt

## Issue-Embedded Configuration

The skill automatically detects and uses workspace config from issue body:

```markdown
## Git Workspace
- Worktree: ../myrepo-worktrees/123
- Branch: `feat/issue-123-custom-name`
```

**When found:**
- Use specified path/branch without prompting (even in normal mode)
- Create worktree if it doesn't exist
- Reuse worktree if it already exists
- Still prompt for environment sync

**Priority:**
1. Explicit `--workspace-config` CLI argument (highest)
2. Issue body `## Git Workspace` section
3. Generated suggestions (lowest)

## Integration with nxs.dev

The `nxs.dev` command invokes this skill in Phase 2b:

```bash
# Invoke skill
result=$(python3 gemini/.gemini/skills/nxs-workspace-setup/scripts/setup_workspace.py \
    --issue-number "$ISSUE_NUMBER" \
    --issue-title "$ISSUE_TITLE" \
    --issue-body "$ISSUE_BODY" \
    --yolo-mode "$YOLO_MODE")

# Parse result
WORKSPACE_PATH=$(echo "$result" | jq -r '.workspace_path')
WORKSPACE_BRANCH=$(echo "$result" | jq -r '.workspace_branch')
WORKSPACE_MODE=$(echo "$result" | jq -r '.workspace_mode')
CHECKPOINT_REQUIRED=$(echo "$result" | jq -r '.checkpoint_required')

# Handle checkpoint if needed
if [ "$CHECKPOINT_REQUIRED" = "true" ]; then
    CHECKPOINT_TYPE=$(echo "$result" | jq -r '.checkpoint_data.type')
    # Present checkpoint to user based on type
    # Re-invoke skill with user choice if needed
fi
```

## Path and Branch Name Generation

### Worktree Path Pattern

```
../<repo-name>-worktrees/<issue-number>
```

**Example:**
- Repository: `myapp`
- Issue: `#123`
- Path: `../myapp-worktrees/123`

### Branch Name Pattern

```
feat/issue-<number>-<slug>
```

**Slug Rules:**
- Derived from issue title
- Lowercase
- Alphanumeric + hyphens only
- Maximum 50 characters
- Leading/trailing hyphens trimmed

**Example:**
- Issue: `#123 - Add User Caching Layer`
- Branch: `feat/issue-123-add-user-caching-layer`

## Error Handling

### Git Command Failures

The script raises `RuntimeError` with command details on git failures:
- Branch already exists (handled as checkpoint, not error)
- Worktree path conflicts (reported as error)
- Invalid repository state (reported as error)

### Orchestrator Responsibility

The calling command (`nxs.dev`) should handle errors gracefully:
- Check `action_taken` field for `error` value
- Display `checkpoint_data.message` to user
- Provide remediation steps
- Allow manual intervention

## Testing Scenarios

### 1. Already on Feature Branch

```bash
git checkout feat/existing-branch
python3 setup_workspace.py \
    --issue-number 123 \
    --issue-title "Test" \
    --issue-body "" \
    --yolo-mode false

# Expected output:
# {
#   "action_taken": "skipped",
#   "workspace_mode": "in-place",
#   "checkpoint_required": false
# }
```

### 2. YOLO Mode Auto-Creation

```bash
git checkout main
python3 setup_workspace.py \
    --issue-number 124 \
    --issue-title "Add feature" \
    --issue-body "" \
    --yolo-mode true

# Expected: Worktree created, env_sync_yolo checkpoint
```

### 3. Branch Conflict

```bash
git checkout main
git branch feat/issue-125-add-feature  # Create conflict
python3 setup_workspace.py \
    --issue-number 125 \
    --issue-title "Add feature" \
    --issue-body "" \
    --yolo-mode true

# Expected: branch_conflict checkpoint (pauses YOLO mode)
```

### 4. Issue with Workspace Config

```bash
git checkout main
ISSUE_BODY="## Git Workspace
- Worktree: ../custom-path/125
- Branch: \`feat/custom-branch\`"

python3 setup_workspace.py \
    --issue-number 125 \
    --issue-title "Test" \
    --issue-body "$ISSUE_BODY" \
    --yolo-mode false

# Expected: Worktree created at custom path with custom branch
```

### 5. Normal Mode Workspace Choice

```bash
git checkout main
python3 setup_workspace.py \
    --issue-number 126 \
    --issue-title "New feature" \
    --issue-body "" \
    --yolo-mode false

# Expected: workspace_choice checkpoint with 3 options
```

## Environment Sync Integration

This skill does NOT directly sync environment files. Instead, it returns checkpoint data indicating that sync is needed.

**Orchestrator responsibilities:**

1. Check `checkpoint_data.type` for `env_sync_confirm` or `env_sync_yolo`
2. In normal mode: Prompt user, then invoke `nxs-env-sync` if approved
3. In YOLO mode: Auto-invoke `nxs-env-sync` without prompt
4. Report sync results to user

**Example orchestrator code:**

```bash
if [ "$CHECKPOINT_TYPE" = "env_sync_yolo" ]; then
    # YOLO mode - auto-sync
    python3 gemini/.gemini/skills/nxs-env-sync/scripts/copy_dev_env.py \
        "$WORKSPACE_PATH" --mode export
    echo "✅ Environment files synced automatically (YOLO mode)"
elif [ "$CHECKPOINT_TYPE" = "env_sync_confirm" ]; then
    # Normal mode - prompt user
    echo "Sync environment files to $WORKSPACE_PATH? (y/n)"
    read RESPONSE
    if [ "$RESPONSE" = "y" ]; then
        python3 gemini/.gemini/skills/nxs-env-sync/scripts/copy_dev_env.py \
            "$WORKSPACE_PATH" --mode export
    fi
fi
```

## Design Decisions

### Why Skills, Not Separate Commands?

1. **Atomic Operations**: Workspace setup is a self-contained operation
2. **Reusability**: Future commands may need workspace setup workflows
3. **Testability**: Skills can be unit-tested independently
4. **Orchestrator Philosophy**: Commands remain thin orchestrators that delegate
5. **No Breaking Changes**: Users still call `/nxs.dev` - internal refactoring is transparent

### Why Checkpoint Return Mechanism?

1. **Separation of Concerns**: Skill handles git operations, orchestrator handles user interaction
2. **Flexibility**: Orchestrator can format checkpoints for CLI, web, or API contexts
3. **Testability**: Skill can be tested without mocking user input
4. **YOLO Mode**: Orchestrator can auto-respond to specific checkpoint types

### Why Pause YOLO for Branch Conflicts?

Branch conflicts indicate potential data loss or confusion. Requiring user judgment prevents:
- Accidentally working on wrong branch
- Overwriting unrelated work
- Confusion about which branch is which

This is a deliberate design decision that may be revisited based on user feedback.

## Future Enhancements

- Support for custom branch prefixes (e.g., `bugfix/`, `chore/`)
- Integration with git-flow patterns
- Auto-detection of existing related branches
- Worktree path templates (e.g., `~/worktrees/<repo>/<issue>`)
- Branch naming templates from project config

## See Also

- [nxs-env-sync](../nxs-env-sync/SKILL.md) - Environment file synchronization
- [nxs.dev](../../commands/nxs.dev.md) - Issue implementation orchestrator
- [nxs-ship](../nxs-ship/SKILL.md) - Post-implementation workflow (Phase 2 of refactoring)
