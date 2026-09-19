---
title: "Scaffold Slice"
aliases: ["scaffold", "teaching step", "slice with no story", "storyless slice", "scaffold restraint", "forced need", "background concept"]
touches: ["plan-rewrite", "plan-draft", "coverage-check", "teaching-plan", "slice-identity"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Scaffold Slice

Scaffold Slice is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [plan-rewrite](plan-rewrite.md) — decides scaffolds before ordering, and emits each one when its needing slice is chosen.
- [plan-draft](plan-draft.md) — the one place a scaffold lives, as a stub that names a concept instead of a story.
- [coverage-check](coverage-check.md) — reports the handed-off case a scaffold must never cover.
- [teaching-plan](teaching-plan.md) — the committed contract, which now admits a scaffold as a slice with no story, no epic, no branch and no pinning test.
- [slice-identity](slice-identity.md) — why a scaffold's concept is its identity, and why a session cannot key it by a story it does not have.

## Decision Log

### 2026-09-12 — #457 — Scaffolds come from reachability, one concept each, with no story

Deciding scaffolds from the edges answers "could this be taught in time" the same way on every run. Deciding them from the chosen order would make the scaffold count depend on the selection rule, and would add scaffolds some permitted order did not need. One concept per scaffold lets a reviewer argue each scaffold down separately. A scaffold carries no story because it builds nothing. Borrowing the next slice's story would pin a teaching step to work it does not build and show the learner a story name on a step that is not that story. Scaffolds are emitted during ordering, so a concept has one owner without a second ownership pass. When needs conflict, the next permitted introducer is tried before scaffolding. Refuted alternative: order first, then insert a scaffold wherever the order left a concept late. That needs no reachability analysis, but it inserts scaffolds a different permitted order would have avoided.

### 2026-09-13 — #458 — The committed plan admits a scaffold, and its lesson is the only fact that finishes it

A scaffold lived only in the draft, because admitting one into the committed plan meant deciding what its branch, its pinning test and its lesson are — a decision left to approval. Approval decides them by leaving them out: a scaffold carries no story, no epic, no branch and no pinning test, and it is a learner slice by construction. That leaves nothing to observe about whether the learner finished it, since a scaffold builds nothing on the roadmap and has no test to pass, so writing its lesson is what puts it behind the learner. The session teaches it rather than stopping because it names no story; the drift check skips it, because it pins nothing that could have moved; a handoff prompt never names it among the slices to leave alone; and the return probe steps over it to fence the next slice that builds a story. This entry also records the reciprocal link from slice-identity.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
