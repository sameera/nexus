---
name: nxs-env-sync
description: Syncs local environment files (e.g., .env, local configs) to new worktrees based on project tech stack and user preferences. Use when setting up a new git worktree to copy essential development environment files from the main worktree.
---

# nxs-env-sync

Syncs local environment files (e.g., `.env`, local configs) to new worktrees based on project tech stack and user preferences.

## Purpose

Automates the manual step of copying non-git-tracked configuration files when setting up a new git worktree. It:
1. Detects the project tech stack.
2. Identifies relevant environment patterns.
3. Remembers user-approved patterns in `CLAUDE.md` to avoid re-discovery.
4. Uses `copy_dev_env.py` to perform the copy.

## Usage

The skill is intended to be called during workspace setup (e.g., in `nxs.dev`).

### 1. Discovery & Memory

The skill should first check `CLAUDE.md` (at project root) for a section like:
```markdown
## Project Environment Patterns
- .env
- .env.local
- config/local.json
```

If missing, run the detection script:
```bash
python3 claude/.claude/skills/nxs-env-sync/scripts/detect_env_patterns.py
```

This outputs a JSON array of detected patterns.

### 2. Execution

Once patterns are determined (either from memory or detection), execute the sync:
```bash
python3 claude/.claude/skills/nxs-env-sync/scripts/copy_dev_env.py <target_path> --mode export --patterns <pattern1> <pattern2> ...
```

### Script Arguments

| Argument | Description |
|----------|-------------|
| `other_path` | Path to the target worktree/directory |
| `--mode` | `import` (from other to current) or `export` (from current to other) |
| `--patterns` | Additional glob patterns beyond defaults |
| `--dry-run` | Preview what would be copied without executing |

### Default Patterns

The copy script includes these default patterns:
- `.env`
- `.env.*`
- `.claude/settings.local.json`
- `*/.env`
- `*/.env.*`

## Integration

Integrated into `nxs.dev` during Phase 2b (Workspace Setup) as Step 2c.

## Pattern Memory

When patterns are detected and confirmed by the user, they are saved to `CLAUDE.md` at the project root under `## Project Environment Patterns`. This allows future worktree setups to skip the detection step.
