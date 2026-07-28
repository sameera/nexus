---
title: "Conformance Gate"
aliases: ["analyze receipt", "conformance receipt", "analyze-close gate", "the receipt"]
touches: ["nexus-pipeline", "decision-record", "record-digest", "pr-driven-flow"]
last_updated_by: "manual"
status: active
verification: unverified
---

# Conformance Gate

Analyze checks the implemented code against the epic's acceptance criteria and the decision
record's invariants, then proves it ran by leaving a receipt. Close treats that receipt as a
hard precondition it reads back, never a courtesy it regenerates.

## How It Works

Analyze reports its findings inline for the human, then writes the receipt as its only
output. Locally that is a small artifact beside the resolved epic; run against a pull
request it is instead a published review carrying the same information as a machine-readable
block, because the worktree that would hold a local artifact is removed before close's
pull-request run can read it — so where the receipt lives follows from where the two stages
execute, not from a mode-specific redesign. Close reads the receipt before mining
anything else, classifying it by staleness — the record's approved body changed since analyze
ran — or by blocking findings, and either state gates close behind an explicit human waiver
rather than a silent pass. An unapproved decision record blocks analyze entirely, and a
blocked run emits nothing at all: no receipt, no review, no comment. That single rule gives a
missing receipt exactly one meaning downstream, in either mode: analyze never ran.

## Key Invariants

1. Analyze's only write is the receipt (or, against a pull request, the equivalent published
   review); no other report artifact exists.
2. A blocked analyze run — an unapproved decision record — emits nothing: no receipt, no
   review, no comment.
3. A missing receipt means exactly one thing to close, in either mode: analyze never ran.
4. Close reads the receipt before mining anything else; it never regenerates or infers
   conformance itself.
5. A stale or blocking receipt gates close behind an explicit human waiver, never a silent
   pass.
6. Which form the receipt takes follows from where analyze and close execute, not from a
   mode-specific rule: a surviving local artifact, or a published review when the worktree
   that would hold one is already gone.

## Integration Points

- [nexus-pipeline](nexus-pipeline.md) — the stage pair, analyze and close, this gate sits
  between.
- [decision-record](decision-record.md) — its approval state is what makes the gate
  meaningful; unapproved blocks analyze outright.
- [record-digest](record-digest.md) — the hash the receipt stamps to detect record staleness,
  independent of the code-conformance findings.
- [pr-driven-flow](pr-driven-flow.md) — the mode where the receipt becomes a published review
  instead of a local artifact.

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
