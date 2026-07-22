---
date: 2026-07-22
epic: "Issue-Sourced Planning: Nothing Commits Until Close"
source: "#114"
---

# Lesson: an L-rated file→issue migration compresses hard when the substrate ships first

## Estimate vs. actual

Assessed **L (1–2 weeks)** at the right-size gate; delivered in ~1 day (planned 2026-07-21,
closed 2026-07-22) across five stories with all acceptance criteria met and zero invariant
violations. The complexity drivers were real — new deterministic resolver tooling, an end-to-end
storage-model change across four commands, rewritten queue invariants — but the calendar estimate
overshot badly for agent-driven TFD delivery. The L rating captured *risk surface*, not *effort*.
For future migrations of this shape (a shared substrate plus a sequenced command-by-command
cutover), rate the risk honestly but expect the calendar to compress when the decomposition
isolates the risk up front.

## What worked: resolver-first decomposition

Shipping the resolver (Story 1) as a shared substrate that "breaks nothing" before any command
moved was the decision that made the rest cheap. Every later story depended on it, it shipped and
was unit-tested independently (determinism/idempotency specs), and the incremental four-command
cutover kept the pipeline runnable between merges — the stated risk surface, which held. When the
next migration has a single producer everything else reads through, build and prove that producer
first as its own story.

## What to carry forward: committed planning files drift within a single epic

The epic's own committed `epic.md` drifted from the live GitHub issues *during its own
implementation* — the `Implementation Sequence` maps STORY→issue numbers one way, but the live
issue titles at those numbers are scrambled (analyze flagged it as a medium finding). The exact
two-copy drift this epic set out to eliminate appeared in the epic's own planning artifact inside
one day. That is the sharpest possible validation of the issues-as-source-of-truth thesis, and a
standing caution: **a committed planning file drifts fast, so any stage that still reads one
(`analyze`, `close` for old-contract epics) must cross-check its story→issue mapping against the
live issues rather than trusting the committed copy.** analyze catching this is the pattern to keep.

## Minor: the queue root is not a planning surface

A deliberate cross-epic roadmap (`sequencing.md`) was committed at the queue root, then relocated to
`docs/delivery/` at close. It was inert (the distiller globs entries, not the root), so this was not
a bug — but `.nexus/queue/` is a drain buffer of closed epic entries, not a home for living planning
docs. Keep roadmaps and sequencing artifacts under the delivery-planning space from the start; the
queue holds only what the distiller will consume and delete.
