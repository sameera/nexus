---
title: "Close Record: Planning Surfaces Follow the Docs Root"
epic: #81
feature: "Multi-Repo Workspaces"
date: 2026-07-19
analyze: ran 2026-07-19 @ 72f0a3f
range:
  - repo: github.com/sameera/nexus
    base: 504bfaa2421f3ab28427196c75d588a6bb7faf00
    head: 72f0a3f33475cde917bf192b5aa66a96511ad36a
---

# Close Record: Planning Surfaces Follow the Docs Root

## Key Decisions

- **Routed `/nxs.council` through the docs root too, threading `<docs-root>` into the PM and
  architect briefs.** The decision record scoped four surfaces (`/nxs.epic`, `/nxs.close`,
  `/nxs.setup`, `/nxs.hld`); council was not among them, but it invokes the same nxs-pm and
  nxs-architect agents Story 4 changed to read context under the resolved root. Council now
  resolves the docs root once and hands the value into both briefs, keeping the
  single-resolution-per-run property. *Refuted alternative:* leave council untouched and let each
  agent resolve for itself — rejected because it either stands up a second producer (violates the
  single-producer invariant) or lets council silently default to `docs` on a hub, reintroducing the
  exact silent-absent-context bug Story 4 exists to kill.

## Deviation Rationale

- **`/nxs.council` routed through the docs root — beyond the decision record's four named
  surfaces:** necessary follow-through (see the Key Decision above). Without it, the Story-4 agent
  change is defeated whenever council runs on a hub, so the epic's goal would hold for four
  commands and quietly fail for a fifth that shares the same agents.
- **`/nxs.epic`'s abs-doc-path call swapped `python get_abs_doc_path.py` → `tsx get_abs_doc_path.ts`:**
  incidental correct fix bundled with the in-scope argument change
  (`docs/features/<slug>` → `<feature-path>`). Only the `.ts` ships now; the base's `.py`
  reference was already stale. The `nxs-abs-doc-path` skill itself is unchanged, so the
  local-root-not-cross-ref-URL invariant holds.

## Deferred Scope

Deferred items appended to: `docs/features/multi-repo-workspaces/backlog.md`

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-07-19-docs-root-planning-surfaces.md`
