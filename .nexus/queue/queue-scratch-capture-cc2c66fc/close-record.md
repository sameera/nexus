---
title: "Close Record: Committed Queue Scratch Capture"
epic: #67
feature: "Queue Scratch Capture"
date: 2026-07-18
analyze: stale — ran 2026-07-18 @ b88edc2, 1 commit unanalyzed; lone HIGH was the now-resolved stories-open/uncommitted process block; waived 2026-07-18
range:
  - repo: github.com/sameera/nexus
    base: b88edc2a50579e5dc3a2660a4de7bff2d50c1ced
    head: f04488689f5da44048778729e71a9b119941a9bf
---

# Close Record: Committed Queue Scratch Capture

## Key Decisions

Every decision below was set in the decision record and held unchanged through implementation
(retroactive epic — the change shipped before the planning record, then matched it). No in-flight
decision was reversed or added during the build; the diff confirms each.

- **Scratch is committed inside the epic's queue entry, not gitignored local scratch:** the old
  `.nexus/plans/<branch>/` never reached the PR head, so the lead could not see rationale at analyze
  or close, and close had to delete it. Committing lets the rationale ride ordinary commits and be
  drained by the existing entry-deletion — no separate cleanup, no branch→epic mapping at close.
  *Refuted:* keep scratch gitignored/local — invisible to the lead and forces a bespoke branch-keyed
  deletion the committed model removes for free.
- **Concurrency handled by branch-keyed filenames under per-user dirs, not merge/locking:** each
  session appends only to its own `decisions-<branch>.md`, so writes are conflict-free by construction
  regardless of engineer or branch count. *Refuted:* a shared per-epic file with merge/lock
  coordination — invents concurrency reasoning to solve a problem disjoint filenames make impossible.
- **On an unresolvable epic, write nothing — silent skip:** a stub in the wrong folder pollutes an
  unrelated epic's rationale and would be mined into the wrong close, so the passive capture rule
  writes nothing rather than prompt or best-effort place. *Refuted:* prompt the engineer or drop in a
  holding location — breaks passive-at-the-moment capture and risks contaminating the wrong entry.
- **Retire the plan-capture hook rather than keep it as a local aide:** the hook fires with only plan
  text and a branch, so it structurally cannot run the parent-epic lookup the committed per-user path
  needs; the standing agent authoring rule is now the sole mechanism. *Refuted:* keep the hook on the
  old gitignored path as a local-only aide — resurrects the invisible-to-lead scratch this epic
  removes and leaves a dead hook in a fresh repo.
- **Username source is the GitHub login, git-name slug fallback:** the login is stable, unique, and
  matches the provenance surface (PRs, issues) the pipeline already uses. *Refuted:* git user name as
  primary — non-unique and locally configurable, so it collides and drifts from pipeline identity.
- **A developer HLD is placed nowhere in the repo tree; it enters only via the lead's hld ingest:**
  a committed HLD becomes a second design artifact that rots against the decision record; one HLD in,
  one epic-scoped record out preserves cardinality. *Refuted:* commit the HLD beside the epic or into
  scratch — artifact duplication plus an identity mismatch (epic-scoped human doc vs branch-scoped
  machine scratch).

## Deviation Rationale

None. The shipped code matched the decision record's chosen approach — all eight constraints/invariants
held (verified against the `b88edc2...f044886` diff): scratch committed under the queue entry, close's
`.nexus/plans/` deletion block removed, distiller's per-user ban documented, setup's hook seed retired,
the retired `.gitignore` line retained with no committed-surface ignore added.

One in-intent scope item beyond story ACs, recorded for completeness (not a deviation): the
`manual/assets.html` SCRATCH slide was rewritten from the gitignored/deleted model to the
committed/drained-with-entry model — the manual is the presentation surface for exactly this change, so
the edit is consistent with epic intent. (An unrelated `docs/TODO.md` RR7-SSR checkbox toggle rode
along in the same commit; excluded as noise — it belongs to separate Prime work, not this epic.)

## Deferred Scope

Deferred items appended to: `docs/features/queue-scratch-capture/backlog.md`

None deferred at close. The epic's Out-of-Scope items (`/nxs.hld --from` team-HLD ingest, the
distill-owned `scratch-capture.md` rewrite, wiring `/nxs.hld` to read scratch mid-flight) were
pre-declared boundaries, not new deferrals surfaced during the build.

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-07-18-retroactive-epic-close.md`
