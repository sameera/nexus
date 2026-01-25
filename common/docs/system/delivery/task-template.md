<!--
TASK TEMPLATE VARIABLE REFERENCE

This template uses {{VARIABLE}} placeholders that are replaced during task generation.

FRONTMATTER VARIABLES:
- {{EPIC}}    : Parent epic's GitHub issue number
- {{SEQ}}     : Zero-padded sequence number (01, 02, 03, etc.)
- {{TITLE}}   : Concise task title
- {{LABELS}}  : Comma-separated labels from docs/system/delivery/task-labels.md
- {{PARENT}}  : Epic issue reference (e.g., #42)
- {{PROJECT}} : GitHub project name (configured in template on first run)

CONTENT VARIABLES:
- {{SUMMARY}}              : One paragraph describing the task
- {{BLOCKED_BY}}           : Task dependencies or "None"
- {{BLOCKS}}               : Tasks this unblocks or "None"
- {{WORKSPACE_PATH}}       : Git worktree path (e.g., ../repo-name-worktrees/42)
- {{BRANCH}}               : Git branch (e.g., feat/42-epic-title or bug/42-epic-title)
- {{FILES}}                : Bulleted list of files to create/modify with purposes
- {{INTERFACES}}           : Key type definitions or TypeScript signatures
- {{KEY_DECISIONS}}        : Table of architectural decisions with rationale and alternatives
- {{IMPLEMENTATION_NOTES}} : Algorithms, patterns, edge cases, and guidance
- {{ACCEPTANCE_CRITERIA}}  : Bulleted checklist items
- {{EFFORT_ESTIMATE}}      : Time range (e.g., "2-4 hours", "4-8 hours")

GIT WORKSPACE DERIVATION:
- WORKSPACE_PATH format: ../<repo-name>-worktrees/<epic-issue-number>
  Example: For repo "nexus" and epic #42 → "../nexus-worktrees/42"

- BRANCH format: <type>/<epic-issue-number>-<concise-epic-title>
  - type: "bug" if epic has bug label, otherwise "feat"
  - concise-epic-title: kebab-case epic title
  Example: Feature epic #42 "User Authentication Flow" → "feat/42-user-authentication-flow"

USAGE: /nxs.tasks reads this template and replaces all {{VARIABLES}} with generated content.
Users may customize this template - always use the current version.
-->
---
title: "TASK-{{EPIC}}.{{SEQ}}: {{TITLE}}"
labels: [{{LABELS}}]
parent: {{PARENT}}
project: {{PROJECT}}
---

## Summary

{{SUMMARY}}

## Dependencies

-   Blocked by: {{BLOCKED_BY}}
-   Blocks: {{BLOCKS}}

## Git Workspace

-   Worktree: `{{WORKSPACE_PATH}}`
-   Branch: `{{BRANCH}}`

## Low-Level Design

### Files

{{FILES}}

### Interfaces/Types

```typescript
{{INTERFACES}}
```

### Key Decisions

{{KEY_DECISIONS}}

### Implementation Notes

{{IMPLEMENTATION_NOTES}}

## Acceptance Criteria

{{ACCEPTANCE_CRITERIA}}
-   [ ] All existing tests pass
-   [ ] New functionality has test coverage (if applicable)

## Estimated Effort

{{EFFORT_ESTIMATE}}