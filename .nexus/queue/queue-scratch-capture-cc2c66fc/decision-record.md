---
title: "Decision Record: Committed Queue Scratch Capture"
epic: #67
feature: "Queue Scratch Capture"
rating: M
concepts: [scratch-capture]
date: 2026-07-17
---

# Decision Record: Committed Queue Scratch Capture

## Summary

Decision scratch — the in-flight "why" an engineer's agent captures at the moment of choosing —
moves from a gitignored per-branch local directory into committed per-user subdirectories inside the
epic's own queue entry. Because it now rides ordinary commits onto the PR head, the rationale becomes
visible to the lead at analyze and close time and is drained automatically by the distiller when the
entry's distillation-PR merges. The trust boundary is unchanged: scratch stays a pre-checkpoint hint
verified against the diff, never load-bearing, and never read by the distiller.

## Chosen Approach

Scratch lives at a committed, tool-written path keyed by epic, username, and branch. The engineer's
agent resolves which epic a story belongs to silently, writes a stub if it can, and writes nothing if
it cannot. Lead-run stages (close, analyze, and — documented but not yet wired — a mid-flight hld
re-run) read scratch only as hints they verify against the shipped diff. Close stops owning any
cleanup; the distiller drains scratch with the entry on merge and never reads it into a concept delta.
Setup stops seeding the old plan-capture hook and seeds the new committed convention instead.

## Key Decisions

### Scratch is committed inside the epic's queue entry, not gitignored local scratch

- **Decision:** Capture stubs and notes at a committed path inside the epic's queue entry rather than
  in a gitignored per-branch directory on the author's machine.
- **Why:** The highest-fidelity "why" is captured at the decision moment, but the old location never
  reached the PR head, so the lead could not see it at review, and it required close to delete it
  afterward. Committing makes the rationale reviewable exactly where decisions are reviewed and lets
  the existing entry-deletion drain it — no separate cleanup, no branch-to-epic mapping at close.
- **Refuted alternative:** Keep scratch gitignored and local. It loses because machine-local scratch
  is invisible to the lead at analyze and close, and it forces a bespoke deletion step keyed by a
  branch-to-epic mapping that the committed model removes for free.

### Concurrency is handled by branch-keyed filenames under per-user directories, not merge or locking

- **Decision:** Name each scratch file after the writing branch, nested under a per-user directory, so
  every writing session appends only to its own file.
- **Why:** Writes are conflict-free by construction regardless of how many engineers or branches touch
  the epic. This is just the default naming (the file is named after the branch writing it), not a
  mitigation bolted on; the per-user directory adds organization and guards against branch-name
  collisions across engineers.
- **Refuted alternative:** A shared per-epic scratch file with merge or lock coordination. It loses
  because it introduces merge-conflict and concurrency reasoning to solve a problem that disjoint
  filenames make impossible in the first place.

### On an unresolvable epic, write nothing — silent skip, not prompt or best-effort placement

- **Decision:** The agent resolves the epic silently (story issue → parent epic issue → matching queue
  entry, with a branch-slug fallback); if it still cannot resolve, it writes nothing.
- **Why:** A stub in the wrong folder is worse than no stub — it pollutes an unrelated epic's rationale
  and would be mined into the wrong close. Silent skip keeps the capture rule a passive background aide
  that never interrupts the engineer.
- **Refuted alternative:** Prompt the engineer to pick the epic, or drop the stub in a default/holding
  location. Prompting breaks the "capture passively at the moment of choosing" property; best-effort
  placement risks contaminating the wrong entry, which the diff-verified floor would then have to catch.

### Retire the plan-capture hook rather than keep it as a local-only aide

- **Decision:** Setup stops seeding the plan-capture hook and its opt-in; the standing agent authoring
  rule is the sole capture mechanism.
- **Why:** The hook fires with only plan text and a branch, so it cannot run the parent-epic lookup
  needed to resolve the committed per-user directory — it structurally cannot write where the new model
  requires. Plans were always the weakest hint, and the agent session (which can resolve the epic) now
  captures notes.
- **Refuted alternative:** Keep the hook writing to the old gitignored path as a pure local aide that
  never feeds close. It loses because it resurrects the exact invisible-to-lead scratch this epic
  removes, and it would require close to carry a dead plan-reading path; retirement is cleaner and
  leaves no dead hook in a freshly set-up repo.

### Username source is the GitHub login, with a git-name slug fallback

- **Decision:** Derive the per-user directory from the GitHub login primarily, falling back to a slug
  of the git user name.
- **Why:** The login is stable, unique, and matches the provenance surface (PRs, issues) the rest of
  the pipeline already uses. The git-name fallback keeps capture working when the login is unavailable.
- **Refuted alternative:** Use the git user name as primary. It loses because git names are non-unique
  and locally configurable, so they collide and drift from the identity the pipeline tracks everywhere
  else.

### A developer HLD is placed nowhere in the repo tree; it enters only via the lead's hld ingest

- **Decision:** A developer's design/HLD document stays in the team's existing doc space and reaches
  Nexus only when the lead runs the hld ingest at approval; it is never committed beside the epic and
  never dropped into the per-user scratch.
- **Why:** A committed HLD becomes a second, competing design artifact that rots against the canonical
  decision record. The scratch is branch-keyed and machine-written, whereas an HLD is epic-scoped and
  human-authored — forcing it into scratch would require the manual copy/rename this design rejects and
  reintroduce the conflicts branch-keying eliminates. One HLD in, one epic-scoped record out preserves
  cardinality.
- **Refuted alternative:** Commit the HLD beside the epic or into the scratch so it travels with the
  code. It loses on artifact duplication (two design surfaces competing with the decision record) and
  on the identity mismatch between epic-scoped human docs and branch-scoped machine scratch.

## Constraints & Invariants

1. Scratch is a pre-checkpoint hint only: every stub is verified against the shipped diff before use,
   is never load-bearing, and a stub the code contradicts is dropped or recorded as the "planned" side
   of a deviation.
2. Analyze may read scratch as context to explain divergence, but scratch never changes a
   met/partial/unmet/contradicted verdict and a missing scratch directory changes nothing; the analyze
   receipt schema is unchanged.
3. The distiller never reads the per-user scratch directories: no concept delta is ever derived from
   any per-user path, and the "why" onward comes only from the decision record and close record.
4. Close deletes no scratch: the old deletion block is gone, scratch remains inside the committed entry
   after close, and it is removed only when the distillation-PR removes the whole entry on merge.
5. Scratch is never linked from any durable surface (issue, doc, or concept page), because the entry —
   and thus the scratch — is deleted on distillation-PR merge.
6. Branch-keyed filenames under per-user directories keep concurrent writes conflict-free by
   construction; no merge or locking logic exists or is introduced.
7. Scratch is tool-written only along a resolved epic path: the engineer never names, places, or
   renames a file, and on an unresolvable epic the agent writes nothing.
8. The retired gitignore line for the old local path is retained (marked retired) and no ignore is
   added for the committed queue surface, so residual local scratch ages out silently without
   surfacing as untracked noise.
