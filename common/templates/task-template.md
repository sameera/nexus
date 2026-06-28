<!--
TASK TEMPLATE — the GitHub issue body shape for a single task.

WHAT THIS IS
    The slim per-task scope contract: summary + acceptance criteria +
    dependencies. The LLD layer (Files / Interfaces / Implementation Notes),
    the Key Decisions table, and the Git Workspace section are CUT (0001 D4,
    0002 §5) — implementation design is the engineer's.

FRONTMATTER VARIABLES
- {{EPIC}}      : Parent epic's GitHub issue number
- {{SEQ}}       : Append-only sequence number (01, 02, ...). Never renumbered
                  once referenced (C7).
- {{TITLE}}     : Concise task title
- {{LABELS}}    : Comma-separated labels from .claude/nexus/task-labels.md
- {{PARENT}}    : Epic issue reference (e.g., #42)
- {{PROJECT}}   : GitHub project name
- {{STORY_REF}} : Required. The story/stories this task serves, e.g. [STORY-1].
                  No task without a story parent (analyze severity gate).

CONTENT VARIABLES
- {{SUMMARY}}             : One paragraph describing the task
- {{BLOCKED_BY}}          : Task dependencies or "None"
- {{BLOCKS}}              : Tasks this unblocks or "None"
- {{ACCEPTANCE_CRITERIA}} : Bulleted checklist items
- {{EFFORT_ESTIMATE}}     : Time range (e.g., "2-4 hours")
-->
---
title: "TASK-{{EPIC}}.{{SEQ}}: {{TITLE}}"
labels: [{{LABELS}}]
parent: {{PARENT}}
project: {{PROJECT}}
story_ref: [{{STORY_REF}}]
---

## Summary

{{SUMMARY}}

## Dependencies

-   Blocked by: {{BLOCKED_BY}}
-   Blocks: {{BLOCKS}}

## Acceptance Criteria

{{ACCEPTANCE_CRITERIA}}
-   [ ] All existing tests pass
-   [ ] New functionality has test coverage (if applicable)

## Estimated Effort

{{EFFORT_ESTIMATE}}
