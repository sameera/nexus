---
title: "Conformance Gate"
aliases: ["analyze receipt", "conformance receipt", "analyze-close gate", "the receipt"]
touches: ["nexus-pipeline", "decision-record", "record-digest", "pr-driven-flow", "ephemeral-handoff-entry", "durable-close-record", "writer-stamp", "fix-lane", "pipeline-store-exclusion"]
last_updated_by: "#405"
status: active
verification: verified
---

# Conformance Gate

Analyze checks the implemented code against the epic's acceptance criteria and the decision
record's invariants, then proves it ran by leaving a receipt. Close treats the receipt as a
hard precondition, reading it back rather than regenerating it.

## How It Works

Analyze reports findings inline, then writes the receipt as its only output. Locally, the
receipt is a small artifact beside the epic. It sits in the ephemeral area for issue-sourced
epics or in the committed entry for old-contract ones. This placement is contractual; the next two stages depend on it. Against a pull request, the receipt is a published review with
the same information in a machine-readable block, because the worktree that would hold a local
artifact is gone before close's pull-request run can read it. Close reads the receipt before mining
anything else, classifying it by staleness or by blocking findings. Staleness means the
record's approved body changed since analyze ran. The verdict with any waiver is restated on
the durable close comment. An unapproved decision record blocks analyze entirely; a blocked
run emits nothing. That single rule gives a missing receipt exactly one meaning: analyze never
ran. An entry lacking acceptance criteria, success metrics, or decision record is refused
rather than passed: the check is undefined, not optional, and such an entry records this state
as a literal value no reader can mistake for a waiver.

## Key Invariants

1. Analyze writes only the receipt or the published-review equivalent; no other report
   artifact exists.
2. When an unapproved decision record blocks analyze, the run emits nothing: no receipt, no
   review, no comment.
3. A missing receipt means exactly one thing to close: analyze never ran.
4. Close reads the receipt before mining anything else; it never infers conformance itself.
5. A stale or blocking receipt gates close behind an explicit human waiver, never a silent
   pass.
6. Which form and placement the receipt takes follows from where analyze and close execute,
   not from a mode-specific rule: a local artifact in the ephemeral area or the committed
   entry, or a published review when the worktree is gone. Downstream stages rely on that
   placement.
7. Both forms record which release wrote them; a receipt carrying no such record, or one
   naming a release other than the reader's, is read exactly as before.

## Integration Points

- [nexus-pipeline](nexus-pipeline.md) — the stage pair this gate sits between.
- [fix-lane](fix-lane.md) — the lane this gate refuses to run against, having no criteria to check.
- [decision-record](decision-record.md) — its approval state makes the gate meaningful;
  unapproved blocks analyze.
- [record-digest](record-digest.md) — the hash the receipt stamps to detect record staleness.
- [pr-driven-flow](pr-driven-flow.md) — the mode where the receipt becomes a published review.
- [ephemeral-handoff-entry](ephemeral-handoff-entry.md) — where an issue-sourced epic's receipt
  is written.
- [durable-close-record](durable-close-record.md) — the close comment restating this verdict
  durably.
- [writer-stamp](writer-stamp.md) — the record of which release wrote the receipt, carried in
  both its local and published-review forms.
- [pipeline-store-exclusion](pipeline-store-exclusion.md) — analyze draws its verdict from a diff withholding every member; it withheld none before.

## Decision Log

### 2026-07-28 — manual — Named as its own concept

The receipt that proves analyze ran and gates close existed only as command-file procedure,
referenced in passing elsewhere in the store — `record-digest.md` builds an invariant on
"its receipt" and `nexus-pipeline.md`'s own Decision Log notes in an aside that "close reads
a missing receipt as analyze never ran" — with no page stating the contract itself. Filed
manually rather than waiting for a distill, because no open epic touches this mechanism to
trigger one, and the gap was concrete enough (a page already assuming it, a reader unable to
find it) to fix on sight. Prompted the same-day clarification to 0003 §2.2: the concept
store's file-path/code ban excludes the literal artifact (a path, a schema field, a marker
string) but not the behavioral contract a reader needs — what the receipt proves, who writes
and reads it, what its absence means. Refuted alternative: fold this into `nexus-pipeline.md`
— rejected, that page already sits at its word cap describing the whole pipeline shape, and
adding the receipt's contract there would relocate the omission rather than fix it.

### 2026-07-31 — #170 — Receipt placement becomes contractual, and the verdict reaches a durable surface

Where a local receipt lands stopped being an accident of where the epic resolved and became a stated contract: for an issue-sourced epic it sits in the ephemeral area beside the materialized epic, for an old-contract epic in the committed entry, and the two stages that read it depend on that placement rather than re-deriving it. The same change gave the verdict a second, durable home — the close comment stamps it, waiver text included — so a reader of the closed epic can see it closed on a waiver without the receipt file, which is now disposable in both local placements. This page's claims were re-checked against the shipped code while patching it, retiring its unverified bootstrap flag.

### 2026-08-26 — #251 — The receipt records which release wrote it, in both forms

The local receipt and its published-review block both now carry the writing release, so a later change to how receipt data is written is detectable rather than silently invalidating every receipt in flight. The record is placed beside the digests the receipt already carries, never inside the bytes any of them cover, so a stamped receipt verifies exactly as an unstamped one does — an invariant pinned by a test rather than left to the placement being obvious. Reading is unchanged in both directions: a receipt with no such record reads as an unknown writer, and one naming a different release is read normally. Refuted: gating close on the receipt's release matching the reader's — a rung of the deferred version-difference ladder, and the epic's own scope explicitly stops at making a difference detectable.

### 2026-09-05 — #263 — Refusing an entry the check is undefined for, rather than passing it

The gate now stops outright against an entry that carries no acceptance criteria, no success metrics and no decision record, because checking code against three things that do not exist is undefined rather than optional. Stopping is the honest outcome; degrading into a pass would report a conformance judgement nobody made. Such an entry states the state in words instead — a literal value, never a blank — so it stays greppable and can never be read as a waiver of a check that was never available. The considered alternative — let the gate run and emit an empty or trivially-passing receipt — was rejected because a receipt is precisely the artifact the closing stage treats as proof the check ran, and one that means "nothing was checkable" is indistinguishable downstream from one that means "everything passed".

### 2026-09-07 — #405 — Reciprocal link from pipeline-store-exclusion

Mechanical reciprocity fan-out: analyze withheld nothing from the diff it judged, so a branch that also touched a queue entry or a discovery folder presented planning prose to the gate as shipped behaviour. It now derives its diff from the same named set close and distill use, so a conformance verdict cannot be drawn from a surface the pipeline wrote itself.
