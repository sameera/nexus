---
title: "Decision Record: Issue-Sourced Planning: Nothing Commits Until Close"
epic: #114
feature: "Multi-Repo Workspaces"
rating: L
concepts: ["committed-queue", "epic-approval-gate", "distiller", "nexus-pipeline", "workspace-resolution"]
date: 2026-07-21
---

# Decision Record: Issue-Sourced Planning: Nothing Commits Until Close

## Summary

This epic makes GitHub issues the single source of truth for epic and story planning and stops
committing anything to the queue at planning time. A single deterministic resolver reconstructs an
ephemeral, gitignored epic from an epic issue number on demand — the issue number is the only join
key — and every downstream stage reads through it. The committed queue entry is no longer born at
planning but at close, so the queue becomes a closed-only drain buffer for the distiller.

## Chosen Approach

One resolver keyed on the epic issue number is the shared substrate. It fetches the epic body, its
story sub-issues, and their native dependency graph, and materializes them into the existing epic
field shape at a location outside version control — byte-identical on re-run, and all-or-nothing
(any unfetchable sub-issue is a hard failure with no output).

Planning drafts in session scratch, runs the epic gate on the draft, and at approval files the epic
issue first and its story sub-issues as children, committing nothing. The `hld` and `analyze` stages
obtain the epic by resolving its number instead of globbing a committed entry. The `close` stage
materializes the epic via the same resolver and writes the committed entry alongside the close
record, folding into the existing PR-driven post-merge close flow (#101). The `--from #<issue>` path
is a thin, read-only wrapper over the resolver that lets a hand-filed epic enter the pipeline.

The migration lands incrementally: the resolver ships first and breaks nothing, then each command is
moved in sequence, and this epic itself runs under the old commit-at-planning contract until the new
one is in place.

## Key Decisions

### GitHub issues become the single source of truth; the committed planning file is removed

- **Decision:** The epic and story text, acceptance criteria, and dependency graph live only on the
  GitHub issues. The committed planning-time `epic.md` is removed from the model.
- **Why:** Today the same content lives in two places — the issue humans edit and the committed file
  the gates validate against — and they drift. Collapsing to one copy removes the drift class
  entirely. The issue is the correct survivor: it is the surface humans actually edit, it already
  carries the sub-issue graph, dependency edges, comment history, and provenance.
- **Refuted alternative:** Keep the planning file as the source of truth and treat issues as a
  derived mirror (regenerate or reconcile issues from the file). An engineer could pick this to avoid
  touching four commands, but it fights GitHub's grain — the approval gate, the dependency wiring,
  and the sub-issue relationships all live issue-side — and any sync step re-introduces the exact
  two-copy drift being eliminated.

### A single deterministic, idempotent, fail-closed resolver is the only producer of the materialized epic

- **Decision:** Exactly one resolver reconstructs the epic from the issue graph. Its output is
  byte-identical on re-run against an unchanged graph, and it is all-or-nothing: any unfetchable
  referenced sub-issue is a hard non-zero exit with no output.
- **Why:** Every stage reading through one producer guarantees they all see the same reconstruction.
  Byte-identical idempotency makes the output safe to re-run and to diff. Fail-closed prevents a
  silently truncated epic, where a dropped story would mean a missing design or close obligation that
  nobody notices.
- **Refuted alternative:** Let each stage fetch the issues inline. Viable and fewer moving parts, but
  it scatters reconstruction logic across `hld`, `analyze`, and `close`, which then drift and can see
  different story sets — the same failure the workspace resolver's single-producer invariant (#38)
  exists to prevent — and it leaves no single place to enforce byte-identical output.

### The committed queue entry is born at close, folded into the existing #101 post-merge flow

- **Decision:** The committed entry (materialized epic plus close record) is written by `close`, as
  part of the same post-merge commit the PR-driven flow (#101) already makes on the distill branch.
  Nothing is committed to the queue before close.
- **Why:** With nothing committed at planning, the only drift-free moment to commit the epic is when
  nothing can change anymore — code merged, stories closed. Born-at-close deletes the planned-entry
  lifecycle (there is no committed-but-unclosed entry) and hands the distiller a complete, internally
  consistent entry to drain. It is not a second close mechanism; it adds one materialization step to
  the flow that already exists.
- **Refuted alternative:** Keep committing the epic at planning but regenerate it from issues at each
  stage — a committed cache. Plausible as a smaller change, but a committed cache *is* the second
  copy that drifts, and born-at-close removes it for free while preserving the queue's
  presence-equals-unconsumed invariant.

### No pinned approved-baseline; stages validate against live issue state (ratified)

- **Decision:** Stages resolve the live issue state at read time. No snapshot of the approved epic is
  frozen. The "scope or design changed after approval" staleness axis is deferred to the sibling
  stub's content-hash mechanism (`hld_hash`). This posture was raised at the design gate and
  ratified.
- **Why:** Freezing a snapshot would re-create the second source of truth this epic exists to remove.
  The content-hash axis detects a changed design later without freezing scope, and close-time
  deviation capture is the interim safety net (see Risks).
- **Refuted alternative:** Snapshot the approved epic (pin a baseline commit or hash) and validate
  against it. An engineer would reach for this to get change-detection, but the pinned snapshot
  drifts from the live issues humans keep editing — exactly the drift being collapsed — and the
  content-hash axis handles the concern later without a frozen copy.

### Reuse the existing field shape, the #38 workspace resolver, and the existing filing skills

- **Decision:** The resolver emits the same frontmatter, user-stories, and implementation-sequence
  shape the pipeline writes today, so no downstream parser changes. In a workspace it targets the hub
  repo's issues via the shared workspace resolver; in single-repo it targets the local repo. Planning
  keeps using the existing epic- and story-filing skills.
- **Why:** The existing shape already carries everything the stages read, and role comes from the
  committed workspace artifacts, never a fresh heuristic. Reuse keeps the pipeline runnable between
  merges.
- **Refuted alternative:** Define a new canonical epic schema for resolver output. Cleaner in
  isolation, but it forces rewriting every downstream parser and breaks the "pipeline must stay
  runnable between merges" constraint for no gain.

### Migrate incrementally; the resolver ships first and this epic runs under the old contract

- **Decision:** The resolver lands first as substrate that breaks nothing. Then `epic`, `--from`,
  `hld`+`analyze`, and `close` move in sequence. During the migration, stages read a committed entry
  when one exists (old-contract epics, including #114 itself) and resolve from the issue number when
  none does.
- **Why:** This keeps every intermediate merge shippable. A big-bang cutover would leave the pipeline
  unrunnable mid-migration and put one un-reviewable blast radius on the pipeline's critical path.
- **Refuted alternative:** Big-bang cutover of all four commands plus the epic in one PR. Tempting to
  avoid a transitional dual-read, but an epic that commits nothing while `hld` still globs a committed
  entry finds no epic — the pipeline breaks between merges.

### Sequence `hld-subissue-record` before flipping the read path; `analyze` degrades in the interim (ratified)

- **Decision:** The durable home for the decision record — an `hld` sub-issue, owned by the sibling
  stub `hld-subissue-record` — lands in the same wave and before `hld`+`analyze` are flipped off the
  committed entry. Until it lands, `analyze` degrades to no-invariant mode (acceptance-criteria and
  success-metric conformance only) for any epic with no resolvable decision record, and states that
  it did so. This ordering was raised at the design gate and ratified.
- **Why:** Removing the committed entry removes the committed decision record `analyze` reads its
  invariants from. Sequencing the durable home first closes the gap; the interim degraded mode keeps
  the pipeline runnable and honest (it announces the reduced check) rather than failing or silently
  skipping.
- **Refuted alternative:** Keep committing the decision record into the queue entry at planning as an
  interim home. Viable and preserves full invariant checking, but it leaves a committed-at-planning
  residue that contradicts the born-at-close model and re-opens a file that can drift from the issue.

### The epic issue number is supplied by argument, else derived from the linked issue (ratified)

- **Decision:** In the local (non-`--pr`) flow, `hld` and `analyze` accept the epic issue number as
  an explicit argument; when absent, they derive it from the current branch's linked issue (its
  parent epic). The `--pr` flow derives it from the PR's linked issue. This UX contract was ratified
  at the design gate.
- **Why:** With no committed entry to read the epic reference from, the number must be supplied or
  derived. An explicit argument gives an unambiguous path; branch/PR derivation makes the common case
  zero-argument.
- **Refuted alternative:** Always require the number explicitly. Simplest and unambiguous, but it
  forces typing on every run and discards the branch/PR linkage that already identifies the epic.

## Constraints & Invariants

*Resolver*

1. The epic issue number is the sole join key; the resolver reconstructs the epic from the issue
   graph alone, with no dependency on a branch name or a committed queue path.
2. Resolution is all-or-nothing: any unfetchable referenced sub-issue is a hard non-zero exit that
   writes no epic output — never a partial or silently truncated epic.
3. Re-running against an unchanged issue graph produces byte-identical output; this requires a
   canonical story ordering independent of GitHub's return order, stable serialization, and no
   volatile fields (timestamps, run IDs) in the output.
4. The materialized epic is ephemeral and outside version control; a resolver run leaves the working
   tree reporting no new tracked file.
5. Output reuses the existing epic field shape so downstream parsers are unchanged, and the
   implementation-sequence dependency column reproduces the native GitHub dependencies exactly —
   every edge present, none invented.
6. The resolver is read-only against GitHub and against any member checkout; it fetches, never
   mutates.
7. In a workspace it targets the hub repo's issues via the shared workspace resolver (#38); in
   single-repo it targets the local repo — the role comes from the committed workspace artifacts,
   never a new heuristic.

*Planning (`/nxs.epic`)*

8. Filing order is issue-first: the epic issue is created before any story sub-issue, and stories are
   created as its children.
9. Planning writes only to session scratch; after filing, the working tree shows zero new files under
   the committed queue.
10. Filing is idempotent: an epic issue already recorded in the session draft is reused, never
    re-created.

*Read path (`hld`, `analyze`)*

11. `hld` and `analyze` obtain the epic by resolving its issue number with zero reads of a committed
    planning-time queue file; the story set and success metrics they see equal the live GitHub issue
    state at resolve time.
12. The epic issue number is taken from an explicit argument when given, else derived from the current
    branch's linked issue (local flow) or the PR's linked issue (`--pr` flow).
13. Until the durable decision-record home lands, `analyze` runs in no-invariant mode (acceptance-
    criteria and success-metric conformance only) for any epic with no resolvable decision record, and
    states that it did so.
14. Transitional: for an epic that still carries a committed planning-time entry (planned under the
    old contract, including #114 itself), the stages read that entry; the resolver path governs epics
    planned after the migration, and the committed-entry read is dead code to remove once no
    old-contract epics remain in flight.

*Close / queue*

15. The committed entry is born at close: `close` materializes the epic via the resolver and writes it
    with the close record as one commit, inside the existing #101 post-merge distill-branch flow — not
    a second close mechanism. Born-at-close in this epic is single-repo / single-PR only; workspace and
    multi-PR close stay out of scope.
16. Every entry present on the trunk queue carries a close record; there is no committed-but-unclosed
    entry.
17. The distiller finds a complete entry (materialized epic plus close record) without requiring any
    planning-time commit.

*Security boundary*

18. `--from #<issue>` validates the target is an epic issue before materializing; a story issue, or a
    non-existent number, fails with a clear diagnostic naming why and produces no output. It commits
    nothing — the same no-commit contract as planning.

## Risks (BLOCKER / ADDRESS only)

- **ADDRESS — the decision-record home is unresolved for new-contract epics until `hld-subissue-record`
  lands:** With nothing committed at planning, there is no committed decision record for `analyze` to
  read its invariants from, and the durable home (an `hld` sub-issue) is a sibling stub out of scope
  here. *Resolved posture:* sequence `hld-subissue-record` to land before the read path is flipped off
  the committed entry (Key Decision above); in the interim, `analyze` degrades to no-invariant mode for
  epics with no resolvable decision record and announces it. Ratified at the design gate.
- **ADDRESS — post-approval scope drift is undetected until `hld_hash` lands:** Because stages resolve
  live, a story added, edited, or removed after `hld` verified design coverage is not re-checked, and
  nothing flags that the scope changed since approval. *Resolved posture:* accept the live-state model;
  the close-from-diff forcing function surfaces divergence between the decision record and shipped code
  at close as a recorded deviation, the epic-approval-gate remains the scope gate, material
  post-approval scope changes should re-run `hld`, and durable detection arrives later via the
  `hld_hash` content-hash axis. Ratified at the design gate.

## Open Clarifications

_None. Three clarifications were raised at the design gate — the decision-record-home ordering, the
no-pinned-baseline trade, and the epic-issue-number input contract — and all three were resolved; their
resolutions are folded into the decisions, invariants, and risks above._
