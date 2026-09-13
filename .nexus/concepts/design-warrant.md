---
title: "Design Warrant"
aliases: ["needs-design label", "design warrant", "complexity rollup check", "rollup floor", "complexity drivers", "which epics need a record"]
touches: ["epic-approval-gate", "story-as-unit", "cut-gate", "addition-gate", "decision-record", "razor-enforcement"]
last_updated_by: "#576"
status: active
verification: verified
---

# Design Warrant

Whether an epic must have a decision record follows from its complexity rollup, and nothing else decides it. A medium-or-larger rollup carries the needs-design label. The rollup is a property of the stories actually filed, so the checker holds it to that set rather than to whatever the draft first guessed.

## How It Works

Filing declares the warrant. The label is upserted before it is applied, and an absent or unrecognized rollup errs toward needing design. The lead can edit the label afterwards.

The checker decides only the mechanical half. It blocks a filed story that states no size, because the rollup cannot then be derived at all. It blocks a recorded complexity below the largest size in the filed set, which is the floor that set forces. It blocks a recorded complexity above that floor while nothing is stated that raises it. How far cross-story integration raises the rollup above the floor stays a judgment; the rule is that the judgment was made over the stories actually filed, and was stated rather than assumed.

Deriving the rollup exactly from the sizes and the story count was considered and refused. It catches the stale-high case as well as the stale-low one, but it invents a count threshold no rule holds, and it would make a new normative default nobody approved.

Any change to the filed story set, in either direction, re-derives the rollup and the warrant that follows from it. A change that drops the epic below the threshold drops the label, and a change that carries it past the threshold gains one.

## Key Invariants

1. The needs-design label follows from the complexity rollup and from nothing else.
2. An absent or unrecognized rollup errs toward needing design.
3. A filed story that states no size blocks, because the rollup cannot be derived from the filed set.
4. A recorded complexity below the largest size in the filed set blocks.
5. A recorded complexity above that floor blocks while nothing is stated that raises it.
6. How far integration raises the rollup above the floor is a judgment, and the rule is only that the judgment is stated.
7. Any change to the filed story set re-derives the rollup and the warrant, in both directions.

## Integration Points

- [epic-approval-gate](epic-approval-gate.md) — declares the warrant at filing, and runs the check that holds the rollup to the filed set.
- [story-as-unit](story-as-unit.md) — supplies the per-story sizes the floor is taken from.
- [cut-gate](cut-gate.md) — the re-derivation step this is one of the three outputs of.
- [addition-gate](addition-gate.md) — the gate where the filed set can differ from the drafted one in either direction.
- [decision-record](decision-record.md) — the artifact the warrant demands, and whose absence the close gate then blocks on.
- [razor-enforcement](razor-enforcement.md) — the shared checker this rule was placed in rather than a gate's prose.

## Decision Log

### 2026-09-13 — #576 — The rollup is checked against the stories actually filed

Split out of the epic approval gate, which was at its own-content capacity when the planning gate's default inverted. The seam holds because each half is loadable alone: a question about why an epic carries the needs-design label never needs the digest's shape, and a question about what the digest renders never needs the floor rule. The move was forced by a real change. Once the reviewer assembles the filed set at the gate, the rollup and the warrant can describe stories nobody filed, and re-derivation used to be an instruction in the gate's prose, which is exactly the failure the closure rule was moved into the checker to end. Only the mechanically decidable half moved. A fully derived rollup was refuted because it invents a count threshold no rule holds.
