# Git Workflows

Nexus supports two Git workflows: **worktree mode** (recommended) and **in-place branching**. Understanding when to use each improves productivity.

## Worktree Mode (Recommended)

### What are Git Worktrees?

Git worktrees allow multiple working directories for a single repository:

```
your-project/              ← Main repository (on main branch)
├── src/
├── docs/
└── ...

../your-project-worktrees/42/  ← Separate directory (on feat/42-tags branch)
├── src/
├── docs/
└── ...
```

**Key benefit**: Work on feature branch without leaving main directory.

### When to Use Worktrees

✅ **Multi-task work**: Implementing multiple tasks in parallel
✅ **Quick context switches**: Need to check main while working on feature
✅ **Clean main**: Keep main branch always ready for hotfixes
✅ **Team environments**: Avoid "oops, I'm on the wrong branch" issues

### Nexus Worktree Pattern

Nexus auto-configures worktrees with this structure:

```
../<repo-name>-worktrees/<epic-issue-number>/
```

**Example**: For repository `nexus` and epic #42:
```
../nexus-worktrees/42/
```

**Branch name**:
```
feat/<epic-issue-number>-<concise-epic-title>
```

**Example**:
```
feat/42-space-scoped-tags
```

### Worktree Creation

`/nxs.dev` handles this automatically:

**Option 1**: Issue has workspace config in body
```markdown
## Git Workspace
- Worktree: `../nexus-worktrees/42`
- Branch: `feat/42-space-scoped-tags`
```

Creates worktree automatically, no prompt.

**Option 2**: Prompt user (if on `main` and no config)
```
🔄 CHECKPOINT: Workspace Setup

Options:
1. ✅ Create isolated worktree (recommended)
2. 🔀 Switch this directory to new branch
3. ✏️ Custom worktree path/branch

Which approach? (1/2/3)
```

Choose 1 for worktree mode.

### Environment File Syncing

When creating worktree, Nexus syncs local environment files:

**First worktree**:
1. Detects patterns (`.env.local`, `.vscode/settings.json`, etc.)
2. Prompts for confirmation
3. Copies files to worktree
4. Saves patterns to `CLAUDE.md`

**Subsequent worktrees**:
1. Uses saved patterns from `CLAUDE.md`
2. Prompts for confirmation
3. Copies files

**Manual sync**:
```bash
python claude/.claude/skills/nxs-env-sync/scripts/copy_dev_env.py ../nexus-worktrees/42 --mode export
```

### Working in Worktrees

Navigate to worktree:
```bash
cd ../nexus-worktrees/42
```

All Git operations work normally:
```bash
git status
git add .
git commit -m "message"
git push
```

**Important**: Worktree is a separate directory, not a subdirectory of main repo.

### Worktree Cleanup

After task complete, `/nxs.dev` offers cleanup:

```
Options:
1. 🗑️ Remove worktree now
2. 📁 Keep for further work
3. ℹ️ Show removal instructions
```

**Manual removal**:
```bash
git worktree list  # See all worktrees
git worktree remove ../nexus-worktrees/42
```

**Note**: Branch persists after worktree removal. Merge via PR as usual.

## In-Place Branching

### What is In-Place Mode?

Work on feature branch in your main repository directory:

```
your-project/        ← Same directory, different branch
├── src/
├── docs/
└── ...

(Switch between main and feat/42-tags in same directory)
```

### When to Use In-Place

✅ **Single-task focus**: Only working on one task at a time
✅ **Simple changes**: Quick features without complex environment
✅ **Learning**: First time using Nexus, keep it simple
✅ **No hotfix needs**: Won't need to check main while working

### In-Place Workflow

`/nxs.dev` detects your preference:

**Already on feature branch**: Uses in-place automatically

**On main**: Offers option 2
```
🔄 CHECKPOINT: Workspace Setup

Options:
1. ✅ Create isolated worktree
2. 🔀 Switch this directory to new branch  ← In-place
3. ✏️ Custom

Which approach? (2)
```

Creates branch in current directory:
```bash
git checkout -b feat/42-space-scoped-tags
```

### Working In-Place

All work happens in main directory:
```bash
# You're now on feat/42-space-scoped-tags branch
git status
git add .
git commit -m "message"
```

**To return to main**:
```bash
git checkout main
```

**Warning**: Uncommitted changes must be stashed or committed before switching branches.

## Comparison

| Aspect | Worktree Mode | In-Place Mode |
|--------|---------------|---------------|
| **Isolation** | ✅ Separate directories | ❌ Same directory |
| **Parallel work** | ✅ Multiple tasks simultaneously | ❌ One task at a time |
| **Context switch** | ✅ Fast (just cd) | ⚠️ git checkout (loses uncommitted) |
| **Environment** | ⚠️ Must sync files | ✅ Same environment |
| **Complexity** | ⚠️ More directories | ✅ Simple |
| **Hotfix ready** | ✅ Main always clean | ❌ Must switch branches |

## Common Workflows

### Workflow 1: Implement Multiple Tasks (Worktree)

```bash
# Task 1
/nxs.dev 43  # Creates ../nexus-worktrees/42/
cd ../nexus-worktrees/42
# Work on task 1...

# Task 2 (without leaving task 1)
cd ~/projects/nexus  # Back to main
/nxs.dev 44  # Reuses same worktree
cd ../nexus-worktrees/42
# Work on task 2...
```

All tasks for epic #42 use same worktree.

### Workflow 2: Single Task Focus (In-Place)

```bash
# Start on main
git checkout main

# Task 1
/nxs.dev 43  # Choose option 2 (in-place)
# Work on task 1...

# After merge, return to main
git checkout main

# Task 2
/nxs.dev 44  # Reuses existing branch or prompts
```

### Workflow 3: Parallel Epics (Multiple Worktrees)

```bash
# Epic 1 (Tags)
/nxs.dev 43  # Creates ../nexus-worktrees/42/
cd ../nexus-worktrees/42
# Work on tags...

# Epic 2 (Search) - in parallel
cd ~/projects/nexus  # Main repo still on main
/nxs.dev 50  # Creates ../nexus-worktrees/48/
cd ../nexus-worktrees/48
# Work on search...
```

Switch between epics by cd to different worktree dirs.

## Branch Naming

Nexus auto-generates branch names:

**Format**:
```
<type>/<epic-number>-<concise-title>
```

**Type determination**:
- `bug` if epic has `bug` label
- `feat` otherwise

**Title transformation**:
- Lowercase
- Spaces → hyphens
- Remove special characters

**Examples**:
- Feature "Space-Scoped Tags" → `feat/42-space-scoped-tags`
- Bug "Fix Tag Deletion" → `bug/43-fix-tag-deletion`

## Environment File Patterns

Nexus syncs local files to worktrees. Common patterns:

```
.env
.env.local
.env.development
.vscode/settings.json
.idea/
*.local.config.js
```

**Saved in**: `CLAUDE.md` under `## Project Environment Patterns`

**Manual detection**:
```bash
python claude/.claude/skills/nxs-env-sync/scripts/detect_env_patterns.py
```

## Best Practices

### Do

✅ **Use worktrees for complex work**: Multiple tasks, long-running features
✅ **Use in-place for simple changes**: Quick features, learning
✅ **Sync environments**: Confirm environment sync on first worktree
✅ **Clean up worktrees**: Remove after PR merged
✅ **List worktrees**: `git worktree list` to see active worktrees

### Don't

❌ **Mix modes**: Pick one per epic, don't switch mid-epic
❌ **Forget cleanup**: Worktrees accumulate, remove after done
❌ **Edit worktree from main**: Changes in worktree don't affect main (by design)
❌ **Delete worktree directory manually**: Use `git worktree remove`

## Troubleshooting

### Worktree Creation Failed

**Symptom**: "fatal: '../nexus-worktrees/42' already exists"

**Solutions**:
```bash
# Remove existing worktree
git worktree remove ../nexus-worktrees/42

# Or choose different path (option 3)
```

### Can't Switch Branches (In-Place)

**Symptom**: "error: Your local changes would be overwritten"

**Solutions**:
```bash
# Stash changes
git stash

# Or commit changes
git add .
git commit -m "WIP"

# Then switch
git checkout main
```

### Lost Environment Files in Worktree

**Symptom**: `.env.local` missing in worktree

**Solutions**:
```bash
# Re-sync manually
python claude/.claude/skills/nxs-env-sync/scripts/copy_dev_env.py ../nexus-worktrees/42 --mode export
```

### Worktree Not Removed

**Symptom**: `git worktree list` shows worktree but directory deleted

**Solutions**:
```bash
# Prune stale worktrees
git worktree prune
```

## Advanced: Multiple Worktrees

Working on multiple epics simultaneously:

```
~/projects/nexus/                  ← Main (always on main branch)

../nexus-worktrees/42/             ← Epic #42 (tags feature)
../nexus-worktrees/48/             ← Epic #48 (search feature)
../nexus-worktrees/51/             ← Epic #51 (auth improvements)
```

**Benefit**: Context switch = `cd` to different directory. No git checkout, no stashing.

**Usage**:
```bash
# Work on tags
cd ../nexus-worktrees/42
# ... make changes ...

# Switch to search (instant)
cd ../nexus-worktrees/48
# ... make changes ...

# Check main (instant)
cd ~/projects/nexus
# ... check something ...

# Back to tags (instant)
cd ../nexus-worktrees/42
```

## Related Documentation

- [/nxs.dev Command](../commands/nxs-dev.md) - Workspace setup details
- [Epic to Implementation](epic-to-implementation.md) - Full workflow
- [Worktrees Concept](../concepts/worktrees.md) - Deep dive
