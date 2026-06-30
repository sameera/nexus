---
name: nxs.analyze
description: Inline consistency gate over a planned epic — checks story design coverage, acceptance-criteria quality, and terminology drift between the epic and its decision record. No task layer, no persisted report.
category: planning
model: inherit
tools: Read, Edit, Glob, Grep, Bash
---

# Role

Act as a reviewer. Check one planned epic for internal consistency before its stories become GitHub
issues, and report findings inline. The unit of work is the **story** (0009) — there is no task layer
to trace, so this gate checks the epic and its decision record, not task files. It writes **no**
`task-review.md`; findings are returned in the response and safe fixes are applied in place.

# User Input

```text
$ARGUMENTS
```

# Phase 0 — Resolve the epic context

Resolve in priority order:

1. **Explicit path in `$ARGUMENTS`** — a queue entry, an `epic.md`, or its directory.
2. **Queue entry for the current branch** — `git branch --show-current`, then
   `.nexus/queue/<branch>/*/`; a single entry is used, multiple prompt a selection.
3. **File open in the editor** — infer the epic directory from it.
4. Otherwise stop and ask for the epic path.

Load `epic.md` and the **decision record** — `decision-record.md`, the `/nxs.hld` output — from the
same entry. If no decision record is present, run the coverage check (Phase 1.1) in **downgraded**
mode (warn rather than fail) and say so in the report.

# Phase 1 — Checks

## 1.1 Story design coverage

Every story in `## User Stories` must be addressed by the decision record. A story with no
corresponding design treatment is a **coverage gap** (high). Note any decision-record component that
no story exercises as an informational finding (it may signal scope drift or dead design).

## 1.2 Acceptance-criteria quality (by `story_type`)

For each story, read its `story_type`:

- **`user`** — at least one acceptance criterion must describe an **observable behavioral outcome**.
- **`system`** — at least one acceptance criterion must state a **measurable criterion** (metric,
  threshold, or pass/fail contract). Prose-only ACs (e.g. "implement caching") are a **failure**
  (high).

A story whose `story_type` does not match the shape of its ACs is a finding (medium).

## 1.3 Terminology consistency

Identify the decision record's canonical terms for the epic's core concepts. Where the epic uses a
drifted synonym, **normalize it to the canonical term by editing `epic.md` in place** (safe,
mechanical). Record each normalization in the report.

# Phase 2 — Report (inline, no file)

Return a concise summary — do not write a file:

```
Analysis: <epic title> (<queue-entry-or-path>)

Findings: <N> total
  Coverage gaps (stories without design):  <list of story refs/titles>
  AC quality failures:                      <list>
  Terminology normalized in place:          <old → new, ...>

Severity: ⛔ critical <C> · ⚠️ high <H> · medium <M> · low <L>
```

Severity gate: **critical or high findings should block** — fix the epic (and re-file affected story
issues) before relying on the design. This command does not create issues; story issues are filed in
`/nxs.epic` at the approval gate. It reports so the user can gate.

# Usage

```
/nxs.analyze                      # current branch's queue entry, or open-file context
/nxs.analyze path/to/epic-entry   # explicit queue entry / epic directory
```

# Constraints

- **No task analysis.** There is no task layer (0009): do not look for `TASK-*` files, `story_ref`,
  or task↔story traceability, and do not perform barrel-merge remediation.
- **No persisted report.** Findings are inline only — never write `task-review.md`.
- **Edits limited to safe terminology normalization** in `epic.md`. Surface everything else for a
  human; do not rewrite stories or design.
