---
title: "Scaffold Slice"
aliases: ["scaffold", "teaching step", "slice with no story", "storyless slice", "scaffold restraint", "forced need", "background concept"]
touches: ["plan-rewrite", "plan-draft", "coverage-check", "teaching-plan", "slice-identity"]
last_updated_by: "#458"
status: active
verification: verified
---

# Scaffold Slice

A scaffold is a teaching step the rewrite inserts before a slice that assumes a concept no permitted order of the real work could introduce in time. A scaffold teaches exactly one concept, names no story, is identified by that concept, and records which slice's assumption forced it. Reordering is always tried first, so a scaffold is the last resort.

## How It Works

Whether a concept can be taught in time is answered from the dependency edges, not from the order the rewrite chooses. The question is whether the edges permit the concept's introducer to come before the slice that assumes it. Each need that can be met becomes an added edge, and the ordering then meets it by construction. Avoiding a scaffold outranks keeping one step light.

Needs are taken by ascending assuming story, then in vocabulary order. Each need takes the lowest-numbered introducer the graph still permits to go first. A need with no permitted introducer left is scaffolded.

A concept no slice of the roadmap introduces is scaffolded rather than faulted, because every roadmap's first slices stand on background no story teaches. A concept only a handed-off story would introduce is never scaffolded, because a scaffold would hide a focus boundary drawn in the wrong place.

A scaffold is emitted during ordering, at the moment its needing slice is chosen, so each concept keeps one owner. The committed plan now admits one: it carries no story, no epic, no branch and no pinning test, and writing its lesson is the only fact that can put it behind the learner.

## Key Invariants

1. A scaffold introduces exactly one concept, names no story, is identified by that concept, and records the slice whose assumption forced it.
2. A scaffold is a learner slice, and it assumes nothing.
3. A concept has at most one scaffold.
4. No scaffold is inserted for a concept some permitted order could introduce in time, read one concept at a time.
5. A concept no slice of the roadmap introduces is scaffolded rather than faulted.
6. A concept introduced only by a handed-off story is never scaffolded.
7. A scaffold enters the order at the moment the slice whose need forced it is chosen, immediately ahead of that slice.

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
