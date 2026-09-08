---
title: "Close Record: A landed-change lane for design changes that shipped without planning"
epic: "#483"
feature: "Landed Change Intake"
date: 2026-09-08
nexus_version: 0.13.0
analyze: ran 2026-09-08 @ d2088529ef6e4ad2e9f22c6dd92fb60c6a2cf3fd
record: "#504"
record_hash: fb082010445a147e8c4609e4d7abe8c4938125aeaf05f4ed1a40b5d5381618fb
range:
  - repo: github.com/sameera/nexus
    base: 0dc96c2dcb60010ca06c198a30d842de253b3a0c
    head: 56c14a215e4927aa0d955fa4010962e1481b82ed
---

# Close Record: A landed-change lane for design changes that shipped without planning

## Key Decisions

- **The shared skill exposes four independently loadable sections instead of one linear phase
  list:** `/nxs.fix` needs its own epic and collision refusals between reference resolution and
  range resolution, so the shared rules could not stay in one strict sequence. Refuted: one
  monolithic phase list mirroring the old `/nxs.fix` numbering, which would force `/nxs.intake`
  through an interleaving it does not need.
- **`pr_digest` reuses `nexus record-digest --issue` against the pull request number, with no new
  fetch path:** GitHub serves a pull request through the same endpoint shape as an issue, and the
  decision record requires reusing the one digest program the pipeline already has. Refuted: a
  `--pr` flag on `record-digest`, which would duplicate a fetch the issues endpoint already
  performs.
- **Deferred-scope handling was left out of story #485's commit entirely and built only in #486:**
  story #485's acceptance criteria name only the drafted record and the approval gate; every
  criterion about follow-ups belongs to #486. Refuted: stub the section now with a "none yet"
  placeholder, which would be replaced wholesale by the next commit.
- **Phase 6.5 files the kept follow-ups and fills the close record's Deferred Scope section in
  memory before Phase 7's one disk write, rather than mirroring `/nxs.close`'s write-then-patch
  order:** an intake entry's close record has no on-disk existence before that write, so there is
  nothing to edit after writing.
- **`/nxs.distill` states explicitly that an intake entry gets the full epic vocabulary, instead of
  relying on the unbounded default applying by omission:** intake is new this release and sits
  beside the fix razor's stated bound, so a reader could otherwise reasonably ask whether intake is
  bounded too.
- **The drain's pull-request fingerprint check replaces the decision-record-hash branch for an
  intake entry rather than adding a fourth branch to that enumeration:** an intake entry
  structurally can never have a decision record, so the existing three branches can never apply to
  it, and folding a structurally different check into that list would understate how different it
  is.
- **`/nxs.analyze`'s refusal was rewritten as an inversion — run only for an epic entry — rather
  than adding a parallel `entry_kind: intake` clause:** a second clause is the same
  forgotten-clause failure the drain's own kind-selected razor already avoids, and a fourth kind
  added later would otherwise fall through unnoticed.
- **Both the fix lane's authoring-time advisory and the drain's two razor refusals were updated to
  name `/nxs.intake`:** the decision record scoped story #489 to both surfaces, and updating only
  the drain-side refusal would leave the advisory warning pointing at the wrong lane.
- **The distillation-PR's per-concept intake flag is one omittable bullet beside the existing
  Provenance bullet, not a separate summary section:** invariant 17 requires the flag to live
  beside the write it describes, and a separate section would force a reviewer to cross-reference
  by slug.

## Deviation Rationale

- **The epic-classification and number-collision refusals stayed fix-only instead of moving into
  the shared skill, and `/nxs.intake` got neither check (record #504, Key Decisions 1 and 3, story
  #484):** the decision record calls for both refusals to move into `nxs-landed-reference`, and for
  a same-number collision to refuse across kinds while a same-kind re-record rewrites in place. The
  shipped code leaves both refusals in `nxs.fix.md` only; `/nxs.intake` can write an
  `intake-<n>/` entry even when a `fix-<n>/` or `epic-<n>/` entry already exists for that number,
  and it has no epic-classification check at all. This was descoped to a follow-up rather than
  built in this epic; see Deferred Scope.

## Deferred Scope

Deferred items filed as epic stub issues:

- #515 — the epic-classification and cross-kind collision refusals move into
  `nxs-landed-reference`, and a same-kind re-record rewrites its entry in place.

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-09-08-landed-change-lane.md`
