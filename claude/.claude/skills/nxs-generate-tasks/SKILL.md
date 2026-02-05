---
name: nxs-generate-tasks
description: Generate task files from decomposer output and architect responses. Use when you need to create TASK-*.md files from structured JSON containing task metadata and LLD content.
model: haiku
---

# NXS Generate Tasks

Generate TASK-\*.md files from structured JSON input containing task metadata and architect responses.

## Usage

```bash
python ./scripts/generate_task_files.py <input.json> [--dry-run]
```

**Arguments:**

- `input.json` - Path to JSON file containing epic metadata and tasks array
- `--dry-run` - Preview what would be generated without writing files

## Input JSON Schema

```json
{
  "epic_number": 7,
  "epic_title": "Core Layout Shell & Sidebar",
  "epic_type": "enhancement",
  "output_dir": "docs/features/layout/01-core-layout-shell-sidebar/tasks",
  "tasks": [
    {
      "sequence": 1,
      "title": "Create Jotai state atoms",
      "category": "Data Layer",
      "summary": "Initialize state management for layout...",
      "effort": "S",
      "labels": ["frontend", "state"],
      "blocked_by": [],
      "blocks": [2, 3],
      "architect_response": "### Files\n\n- `src/store/atoms.ts`..."
    }
  ]
}
```

**Field descriptions:**

| Field                        | Required | Description                                           |
| ---------------------------- | -------- | ----------------------------------------------------- |
| `epic_number`                | Yes      | GitHub issue number for the parent epic               |
| `epic_title`                 | Yes      | Epic title (used for branch naming)                   |
| `epic_type`                  | Yes      | `"enhancement"` or `"bug"` (determines branch prefix) |
| `output_dir`                 | Yes      | Directory to write task files                         |
| `tasks`                      | Yes      | Array of task objects                                 |
| `tasks[].sequence`           | Yes      | Task sequence number (1, 2, 3...)                     |
| `tasks[].title`              | Yes      | Concise task title                                    |
| `tasks[].category`           | Yes      | Phase category (Infrastructure, Data Layer, etc.)     |
| `tasks[].summary`            | Yes      | One paragraph task description                        |
| `tasks[].effort`             | Yes      | Size estimate (XS, S, M)                              |
| `tasks[].labels`             | Yes      | Array of GitHub labels                                |
| `tasks[].blocked_by`         | Yes      | Array of sequence numbers this task depends on        |
| `tasks[].blocks`             | Yes      | Array of sequence numbers this task unblocks          |
| `tasks[].architect_response` | No       | Markdown from nxs-architect LLD elaboration           |

## Architect Response Format

The `architect_response` field should contain markdown with these sections:

```markdown
### Files

- `path/to/file.ts` - Description of changes

### Interfaces/Types

\`\`\`typescript
export interface Example { ... }
\`\`\`

### Key Decisions

| Decision | Rationale | Alternatives |
| -------- | --------- | ------------ |
| ...      | ...       | ...          |

### Implementation Notes

Patterns, edge cases, algorithms...

### Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
```

If `architect_response` is missing or sections are incomplete, fallback content is used.

## Output

Creates `TASK-{epic}.{seq}.md` files in the output directory using the template at `docs/system/delivery/task-template.md`.

Returns JSON summary to stdout:

```json
{
  "status": "success",
  "tasks_generated": 5,
  "output_dir": "docs/features/.../tasks",
  "files": ["TASK-7.01.md", "TASK-7.02.md"],
  "fallbacks_used": 1,
  "invalid_labels": 0
}
```

**Notes:**
- Labels are validated against `docs/system/delivery/task-labels.md` if it exists
- Invalid labels are reported as warnings to stderr and counted in `invalid_labels`

## Template Variables

The script computes and substitutes these template variables:

| Variable                   | Derivation                           |
| -------------------------- | ------------------------------------ |
| `{{EPIC}}`                 | `epic_number`                        |
| `{{SEQ}}`                  | Sequence zero-padded to 2 digits     |
| `{{TITLE}}`                | Task title                           |
| `{{LABELS}}`               | Labels joined with `, `              |
| `{{PARENT}}`               | `#{epic_number}`                     |
| `{{SUMMARY}}`              | Task summary                         |
| `{{BLOCKED_BY}}`           | Formatted dependencies or "None"     |
| `{{BLOCKS}}`               | Formatted dependents or "None"       |
| `{{WORKSPACE_PATH}}`       | `../{repo-name}-worktrees/{epic_number}` |
| `{{BRANCH}}`               | `{type}/{epic_number}-{kebab-title}` |
| `{{EFFORT_ESTIMATE}}`      | Mapped from effort size              |
| `{{FILES}}`                | From architect or fallback           |
| `{{INTERFACES}}`           | From architect or fallback           |
| `{{KEY_DECISIONS}}`        | From architect or fallback           |
| `{{IMPLEMENTATION_NOTES}}` | From architect or fallback           |
| `{{ACCEPTANCE_CRITERIA}}`  | From architect or fallback           |

## Examples

```bash
# Preview task generation
python ./scripts/generate_task_files.py /tmp/tasks-input.json --dry-run

# Generate task files
python ./scripts/generate_task_files.py /tmp/tasks-input.json
```

## Prerequisites

- Python 3.10+
- Task template at `docs/system/delivery/task-template.md`
