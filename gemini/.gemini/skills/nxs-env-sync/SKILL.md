# nxs-env-sync

Syncs local environment files (e.g., `.env`, local configs) to new worktrees based on project tech stack and user preferences.

## Purpose

Automates the manual step of copying non-git-tracked configuration files when setting up a new git worktree. It:
1. Detects the project tech stack.
2. Identifies relevant environment patterns.
3. Remembers user-approved patterns in `GEMINI.md` to avoid re-discovery.
4. Uses `utils/copy_dev_env.py` to perform the copy.

## Usage

The skill is intended to be called during workspace setup (e.g., in `nxs.dev`).

### 1. Discovery & Memory
The skill should first check `GEMINI.md` for a section like:
```markdown
## Project Environment Patterns
- .env
- .env.local
- config/local.json
```

If missing, it runs the detection script:
```bash
python3 gemini/.gemini/skills/nxs-env-sync/scripts/detect_env_patterns.py
```

### 2. Execution
Once patterns are determined (either from memory or detection), it executes the sync:
```bash
python3 utils/copy_dev_env.py <target_path> --mode export --patterns <pattern1> <pattern2> ...
```

## Integration

Integrated into `nxs.dev` during Phase 2b (Workspace Setup).
