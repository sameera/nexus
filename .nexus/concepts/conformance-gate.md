---
title: "Conformance Gate"
aliases: ["analyze receipt", "conformance receipt", "analyze-close gate", "the receipt"]
touches: ["nexus-pipeline", "decision-record", "record-digest", "pr-driven-flow", "ephemeral-handoff-entry", "durable-close-record"]
last_updated_by: "#170"
status: active
verification: verified
---

# Conformance Gate

Analyze checks the implemented code against the epic's acceptance criteria and the decision
record's invariants, then proves it ran by leaving a receipt. Close treats that receipt as a
hard precondition it reads back, never a courtesy it regenerates.

## How It Works

Analyze reports its findings inline for the human, then writes the receipt as its only
output. Locally that is a small artifact beside the resolved epic — in the ephemeral area for
an issue-sourced epic, in the committed entry for an old-contract one — a contractual
placement the next two stages rely on. Against a pull request it is a published review
carrying the same information as a machine-readable block, because the worktree that would
hold a local artifact is gone before close's pull-request run can read it. Close reads it
before mining anything else, classifying it by staleness — the record's approved body changed
since analyze ran — or by blocking findings; the verdict, waiver included, is then restated on
the durable close comment. An unapproved decision record blocks analyze entirely, and a
blocked run emits nothing at all. That single rule gives a missing receipt exactly one meaning
downstream: analyze never ran.

## Key Invariants

1. Analyze's only write is the receipt, or the equivalent published review; no other report
   artifact exists.
2. A blocked analyze run — an unapproved decision record — emits nothing: no receipt, no
   review, no comment.
3. A missing receipt means exactly one thing to close: analyze never ran.
4. Close reads the receipt before mining anything else; it never infers conformance itself.
5. A stale or blocking receipt gates close behind an explicit human waiver, never a silent
   pass.
6. Which form and placement the receipt takes follows from where analyze and close execute,
   not from a mode-specific rule: a local artifact in the ephemeral area or the committed
   entry, or a published review when the worktree is gone. Downstream stages rely on that
   placement.

## Integration Points

- [nexus-pipeline](nexus-pipeline.md) — the stage pair this gate sits between.
- [decision-record](decision-record.md) — its approval state makes the gate meaningful;
  unapproved blocks analyze.
- [record-digest](record-digest.md) — the hash the receipt stamps to detect record staleness.
- [pr-driven-flow](pr-driven-flow.md) — the mode where the receipt becomes a published review.
- [ephemeral-handoff-entry](ephemeral-handoff-entry.md) — where an issue-sourced epic's receipt
  is written.
- [durable-close-record](durable-close-record.md) — the close comment restating this verdict
  durably.

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
