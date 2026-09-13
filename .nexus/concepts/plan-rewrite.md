---
title: "Plan Rewrite"
aliases: ["rewrite pass", "ordering pass", "introduced once and assumed thereafter", "fewest new concepts per step", "split slice", "split part", "step concept limit", "handoff placement", "nothing iterates"]
touches: ["plan-draft", "prior-knowledge-declaration", "scaffold-slice", "coverage-check", "focus-marking"]
last_updated_by: "#457"
status: active
verification: verified
---

# Plan Rewrite

After the planning pass writes one stub per story, a second pass rewrites that draft into a teachable sequence. The rewrite orders the slices, gives every concept exactly one slice that introduces it, splits a slice that teaches too much, places each handoff, and checks coverage last. Every step is arithmetic over the stubs, so the rewrite reads no story text, no decision record and no diff.

## How It Works

The pass runs a fixed sequence once. The learner's declaration removes concepts first. Scaffolds are decided next, from the dependency edges. The learner slices are then ordered, and ownership is assigned while the order is built. At each position the candidates are the slices whose blockers are already placed, and the pass takes the one introducing the fewest concepts not yet introduced. Ties break by ascending story number. A concept belongs to the first slice that reaches it, and every later slice that proposed it assumes it instead.

Handoff slices take no part in the ordering, because a handoff teaches nothing. The learner-slice graph carries every edge that runs through a handoff, so the exclusion loses no dependency. A slice over the step limit becomes the fewest parts that fit, spread evenly, sitting consecutively where the original sat. Each handoff is then placed immediately before the earliest learner slice it unblocks.

A rerun first merges each story's parts back into one slice and drops scaffolds, so every pass reads one slice per story.

## Key Invariants

1. The rewrite reads the stubs, the checked concept lists, the merged vocabulary and the interview's recorded answers, and nothing else.
2. A concept is introduced by exactly one slice, and every later slice that proposed it assumes it instead.
3. A slice whose every concept was already taught or declared stays in the plan and introduces nothing.
4. No slice precedes a slice that blocks it, including through a handoff slice.
5. No step introduces more than four new concepts. A slice within the limit is never split, and the parts of a split slice name one story and sit consecutively.
6. Each handoff sits immediately before the earliest learner slice it unblocks, and a handoff that unblocks none comes after every learner slice.
7. The passes run once. A rewrite run again over its own output, with nothing changed, holds the same slices in the same order.

## Integration Points

- [plan-draft](plan-draft.md) — the draft this pass reads and replaces whole, still uncommitted.
- [prior-knowledge-declaration](prior-knowledge-declaration.md) — the first pass, which removes what the learner already knows before anything is ordered.
- [scaffold-slice](scaffold-slice.md) — decided from the dependency edges before ordering, and emitted when the slice that needs it is chosen.
- [coverage-check](coverage-check.md) — the last pass, run over the finished order this pass produces.
- [focus-marking](focus-marking.md) — the marks that decide which slices are ordered and which are placed as handoffs.

## Decision Log

### 2026-09-12 — #457 — Ownership comes from one greedy traversal, and nothing iterates

Which slice owns a concept depends on which slice comes first, and which order is best depends on what each slice introduces. As two passes those questions depend on each other, so one traversal produces the order and the ownership together. Greedy selection attains the fewest new concepts at every position given the positions before it, which is the minimality the story asks for. The limit is four because four is the working-memory ceiling for new material, and one sitting already spends attention on a drill, a revisit, the theory and an exercise. Splits stay inside their story's span, so splitting cannot disturb the order and no pass runs twice. A rerun merges split parts back first, because a part that lists its siblings' concepts as assumed reads as a separate story, and the rerun would then scaffold and reorder the plan differently. Refuted alternative: subtract duplicates first against the arriving order, then reorder. That keeps two small passes that are each easy to test, but reordering can move a concept's owner after the slice that assumes it, so subtraction would have to run again.
