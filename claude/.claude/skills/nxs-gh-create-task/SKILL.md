---
name: nxs-gh-create-task
description: Create GitHub issues from TASK-???.md files. Use when you need to bulk-create GitHub issues from task markdown files with frontmatter containing title, label, and parent attributes. Automatically extracts frontmatter, creates issues via gh CLI, and links parent issues.
---

# NXS GitHub Create Task

Create GitHub issues from TASK-???.md files in a target folder.

## Usage

```bash
python scripts/create_gh_issues.py <target_folder> [--dry-run]
```

**Arguments:**

-   `target_folder` - Directory containing TASK-???.md files
-   `--dry-run` - Preview what would be created without making API calls

## Task File Format

Each TASK-???.md file should have YAML frontmatter:

```markdown
---
title: Implement user authentication
labels: [enhancement, backend]
parent: #42
---

## Description

Task body content goes here. This becomes the issue body.
```

**Frontmatter fields:**

-   `title` (required) - Issue title
-   `labels` (optional) - Array of GitHub labels: `[label1, label2, ...]`
-   `parent` (optional) - Parent issue reference (`#42` or full URL)

## Workflow

1. Script finds all `TASK-???.md` files matching the pattern
2. For each file:
    - Parses YAML frontmatter to extract title, labels, parent
    - Creates temp file with body content (frontmatter stripped)
    - Runs `gh issue create --title <title> --label <label1> --label <label2> ... --body-file <temp>`
    - If parent specified, adds comment linking to parent via `gh api`
    - Deletes temp file

## Prerequisites

-   `gh` CLI installed and authenticated
-   Repository context (run from within a git repo or use `gh repo set-default`)

## Example

```bash
# Preview what will be created
python scripts/create_gh_issues.py ./tasks --dry-run

# Create the issues
python scripts/create_gh_issues.py ./tasks
```
