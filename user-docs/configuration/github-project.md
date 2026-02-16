# GitHub Project Configuration

Nexus can automatically add GitHub issues (epics and tasks) to a GitHub Project board when they are created. This page explains how to configure that integration.

## Quick Setup

Add a `project` attribute to your delivery config file at `docs/system/delivery/config.json`:

```json
{
    "docRoot": "https://github.com/your-org/your-repo/tree/main/",
    "project": "your-org/1"
}
```

The `project` value identifies which GitHub Project to use. All epics and tasks created by `/nxs.epic`, `/nxs.tasks`, and `/nxs.dev` will be added to this project automatically.

## Project Identifier Formats

The `project` value supports three formats:

| Format | Example | Description |
|--------|---------|-------------|
| `owner/number` | `"acme-corp/1"` | Organization or user login + project number |
| `number` | `"1"` | Project number only (uses current repo's owner) |
| `title` | `"Backend Roadmap"` | Project title (case-insensitive search) |

**Recommendation**: Use the `owner/number` format for reliability. You can find the project number in the GitHub Project URL: `https://github.com/orgs/acme-corp/projects/1` -> `"acme-corp/1"`.

## How Resolution Works

When creating a GitHub issue, Nexus resolves the target project using a priority chain. The first match wins:

### For epics (`nxs-gh-create-epic`)

| Priority | Source | Description |
|----------|--------|-------------|
| 1 | `--project` CLI flag | Explicit flag passed to the script |
| 2 | `config.json` `project` | The `project` attribute in `docs/system/delivery/config.json` |
| 3 | Repository auto-discovery | Queries the repository's linked GitHub Projects |
| 4 | Skip | No project assignment |

### For tasks (`nxs-gh-create-task`)

| Priority | Source | Description |
|----------|--------|-------------|
| 1 | Task frontmatter `project` | The `project` field in the task's YAML frontmatter |
| 2 | `config.json` `project` | The `project` attribute in `docs/system/delivery/config.json` |
| 3 | Repository auto-discovery | Queries the repository's linked GitHub Projects |
| 4 | Skip | No project assignment |

### For generated task files (`nxs-generate-tasks`)

When `/nxs.tasks` generates `TASK-*.md` files, it reads the `project` from `config.json` and writes it into each task file's frontmatter `project` field. This means the value is baked into the task files at generation time.

## First-Time Setup

When you run `/nxs.tasks` for the first time and `config.json` does not contain a `project` attribute, the command will prompt you to provide the GitHub project name. It then writes the value to `config.json` for all future runs.

You can also add it manually before your first run:

```bash
# Check your current config
cat docs/system/delivery/config.json

# Edit to add the project attribute
```

```json
{
    "docRoot": "https://github.com/your-org/your-repo/tree/main/",
    "project": "your-org/1"
}
```

## Prerequisites

GitHub Project integration requires the `project` OAuth scope for the `gh` CLI:

```bash
gh auth login --scopes 'project'
```

You can verify your scopes with:

```bash
gh auth status
```

If you see permission errors when adding issues to projects, re-authenticate with the `project` scope.

## Skipping Project Assignment

If you don't use GitHub Projects or want to skip the integration entirely:

- **Per-command**: Pass `--no-project` to the skill scripts
- **Permanently**: Omit the `project` attribute from `config.json` and ensure your repository has no linked projects

## Troubleshooting

### "Project not found" warning

**Cause**: The `project` value in `config.json` doesn't match any project accessible to your `gh` authentication.

**Solutions**:
- Verify the project number in the GitHub UI: `https://github.com/orgs/{owner}/projects/{number}`
- Ensure you have access to the project
- Check the owner name matches exactly (case-sensitive for orgs)

### Issues created but not added to project

**Cause**: Missing OAuth scope or project permissions.

**Solution**: Re-authenticate with the `project` scope:
```bash
gh auth login --scopes 'project'
```

### Auto-discovery picks wrong project

**Cause**: The repository has multiple linked projects and auto-discovery uses the first one.

**Solution**: Set the `project` attribute explicitly in `config.json` to avoid ambiguity.

### Task files have literal `{{PROJECT}}`

**Cause**: Task files were generated before `config.json` had a `project` attribute.

**Solution**: Re-generate task files with `/nxs.tasks`, or manually edit the task frontmatter to replace `{{PROJECT}}` with the correct value (e.g., `your-org/1`).
