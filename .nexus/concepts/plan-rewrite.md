---
title: "Plan Rewrite"
aliases: ["rewrite pass", "ordering pass", "introduced once and assumed thereafter", "fewest new concepts per step", "split slice", "split part", "step concept limit", "handoff placement", "nothing iterates"]
touches: ["plan-draft", "prior-knowledge-declaration", "scaffold-slice", "coverage-check", "focus-marking", "slice-identity", "plan-re-approval"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Plan Rewrite

Plan Rewrite is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

## How It Works

Nothing here asserts the concept any more. The teaching stage left Nexus as its own package,
and its knowledge left with it — one page, one decision log, one place it can be wrong. What
stayed is this stub, because two things still need the name. A reader who greps an old slug
gets an answer instead of silence. And the pages here that name this one keep a live edge: an
edge whose other end is gone is a dead edge, which reads as though the interaction lapsed when
in fact it only moved.

The bullets below are the interactions as they stood when the page left. They are a map to
follow, not a claim about today; the page in the teaching repository is what is current.

## Key Invariants

1. This entry asserts nothing about behaviour; the page in the teaching repository is the one that does.
2. The name keeps resolving here, so a reader who searches the old slug is told where it went.
3. Edges from pages that stayed keep resolving, so no page here carries an edge whose other end is gone.

## Integration Points

- [plan-draft](plan-draft.md) — the draft this pass reads and replaces whole, still uncommitted.
- [prior-knowledge-declaration](prior-knowledge-declaration.md) — the first pass, which removes what the learner already knows before anything is ordered.
- [scaffold-slice](scaffold-slice.md) — decided from the dependency edges before ordering, and emitted when the slice that needs it is chosen.
- [coverage-check](coverage-check.md) — the last pass, run over the finished order this pass produces.
- [focus-marking](focus-marking.md) — the marks that decide which slices are ordered and which are placed as handoffs.
- [slice-identity](slice-identity.md) — the part numbers this pass assigns, which it continues on from the last part already taught.
- [plan-re-approval](plan-re-approval.md) — the pass that hands this one the taught part of an approved plan to keep first and unchanged.

## Decision Log

### 2026-09-12 — #457 — Ownership comes from one greedy traversal, and nothing iterates

Which slice owns a concept depends on which slice comes first, and which order is best depends on what each slice introduces. As two passes those questions depend on each other, so one traversal produces the order and the ownership together. Greedy selection attains the fewest new concepts at every position given the positions before it, which is the minimality the story asks for. The limit is four because four is the working-memory ceiling for new material, and one sitting already spends attention on a drill, a revisit, the theory and an exercise. Splits stay inside their story's span, so splitting cannot disturb the order and no pass runs twice. A rerun merges split parts back first, because a part that lists its siblings' concepts as assumed reads as a separate story, and the rerun would then scaffold and reorder the plan differently. Refuted alternative: subtract duplicates first against the arriving order, then reorder. That keeps two small passes that are each easy to test, but reordering can move a concept's owner after the slice that assumes it, so subtraction would have to run again.

### 2026-09-13 — #458 — The rewrite keeps the taught part of an approved plan first and plans only what follows

Until now the rewrite read only the stubs and the checked lists, so a plan re-planned after a story drifted was re-planned whole — and a concept an earlier lesson had already taught could land on a later slice, teaching it twice. The pass now takes the taught part of the approved plan and keeps it first and unchanged. Everything that part introduced counts as introduced for the remainder, a scaffold for a concept it already taught is dropped, a story it taught whole is not planned again, and a story it taught partly continues from the part after the last one taught. The taught part is exempt from the ordering rule, because a dependency edge pointing into lessons already taught cannot move those lessons. **Eviction:** the How It Works sentence restating that a concept belongs to the first slice that reaches it was dropped to stay under the page's word cap; it said exactly what invariant 2 says, so nothing was lost. This entry also records the reciprocal links from slice-identity and plan-re-approval.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
