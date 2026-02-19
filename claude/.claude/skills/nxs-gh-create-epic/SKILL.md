---
name: nxs-gh-create-epic
description: Create a GitHub issue from an Epic document. Use when the user wants to create a GitHub issue from an epic.md file, sync an epic to GitHub, or link an epic document to a GitHub issue. The skill extracts the epic title and type from YAML frontmatter, creates an issue via `gh issue create`, and updates the frontmatter with the issue link.
---

# GitHub Epic Issue Creator

Create a GitHub issue from an Epic document's content and link it back to the epic.

## Prerequisites

-   GitHub CLI (`gh`) installed and authenticated
-   Running within a git repository connected to GitHub

## Workflow

1. **Locate the Epic document** from user reference, open file, or argument
2. **Run the script** to create the issue and update frontmatter:

```bash
python ./scripts/nxs_gh_create_epic.py "<path-to-epic.md>"
```

### Optional Flags

| Flag                 | Description                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `--project "<name>"` | Specify the GitHub project to add the issue to (e.g., `my-org/my-project`). If omitted, reads from `docs/system/delivery/config.json`, then auto-discovers from repository. |
| `-y`, `--yes`        | Skip confirmation if a link already exists                                                                              |
| `--no-project`       | Skip adding the issue to any project                                                                                    |

### Examples

```bash
# Basic usage (auto-discovers project from repo)
python ./scripts/nxs_gh_create_epic.py "<path-to-epic.md>"

# Specify target project explicitly
python ./scripts/nxs_gh_create_epic.py --project "acme-corp/backend-roadmap" "<path-to-epic.md>"

# Skip confirmation for existing links
python ./scripts/nxs_gh_create_epic.py -y "<path-to-epic.md>"

# Create issue without adding to any project
python ./scripts/nxs_gh_create_epic.py --no-project "<path-to-epic.md>"
```

## Script Behavior

The script (`./scripts/nxs_gh_create_epic.py`):

1. Parses YAML frontmatter for `epic` (title) and `type` (issue type name)
2. Resolves the GitHub issue type with the following priority:
   1. `type` field in the epic's YAML frontmatter
   2. `epicType` field in `docs/system/delivery/config.json`
   3. Falls back to adding the `enhancement` **label** if neither is set
3. Creates temp file with markdown body (frontmatter stripped)
4. Executes `gh issue create --title "<epic>" --body-file <temp>`
   (adds `--label "enhancement"` only when falling back)
5. Extracts issue number from returned URL
6. Adds the issue to the specified project (or auto-discovered project)
7. If an issue type was resolved, queries the repository's available issue types,
   matches by name, and calls the `updateIssue` GraphQL mutation to set it
8. Updates frontmatter with `link: "#<issue-number>"`
9. Cleans up temp file

## Expected Frontmatter

```yaml
---
feature: "Feature Name"
epic: "Epic Title" # Required - becomes issue title
created: 2025-01-02
status: draft
type: Task # Optional - set as GitHub issue type; falls back to config.json epicType, then "enhancement" label
---
```

After execution, `link: "#123"` is added to frontmatter.

## Error Handling

| Error                   | Resolution                                   |
| ----------------------- | -------------------------------------------- |
| `gh: command not found` | Install GitHub CLI: https://cli.github.com   |
| `gh: not logged in`     | Run `gh auth login`                          |
| `label does not exist`  | Create label in GitHub or use existing label |
| `not a git repository`  | Navigate to project root                     |
| `No 'epic' field found` | Add `epic: "Title"` to frontmatter           |
| `Project not found`     | Verify project name or use `--no-project`    |
