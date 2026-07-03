<!--
TASK INDEX TEMPLATE — the slimmed tasks.md shape.

WHAT THIS IS
    The single surviving task artifact emitted by /nxs.tasks into the committed
    planning queue. The PjM approves sequencing against it. There are NO
    per-task LLD files — the LLD layer is cut (0001 D4, 0002 §5).

FILLING RULES
    - One row per task. Every column except Mermaid is substance.
    - `story_ref` is REQUIRED — no task without a story parent. An orphaned
      technical task is an analyze severity-gate failure.
    - `blocked_by` is the dependency substance; the Mermaid graph below is
      optional sugar over it.

C7 — TASK-ID STABILITY (overrides the old §8 renumbering remediation)
    Task IDs are append-only. NEVER renumber a task ID once it is referenced
    elsewhere (`blocked_by`, a GH issue, or concept-store provenance) —
    renumbering breaks merges and references silently. Remediation MAY merge or
    delete tasks, but new IDs are assigned append-only; freed numbers are not
    reused.
-->
---
title: "Task Index: {{EPIC_TITLE}}"
epic: {{EPIC_ISSUE_REF}}        # parent epic GitHub issue, e.g. #42
date: {{YYYY-MM-DD}}
---

# Task Index: {{EPIC_TITLE}}

| Task ID | Title | Summary | AC | story_ref | blocked_by | Effort |
|---|---|---|---|---|---|---|
| TASK-{{EPIC}}.{{SEQ}} | {{TITLE}} | {{ONE_LINE_SUMMARY}} | {{AC_POINTER}} | [{{STORY-N}}, ...] | {{TASK_IDS_OR_NONE}} | {{EFFORT}} |

<!-- AC pointer = where the acceptance criteria live (the task's GH issue body /
     task file). story_ref lists every story this task serves (M:N). blocked_by
     lists task IDs, or "None". -->

## Dependency Graph (optional)

<!-- Optional Mermaid view of `blocked_by`. Omit if the table is clear. -->

```mermaid
graph TD
    {{TASK_A}} --> {{TASK_B}}
```
