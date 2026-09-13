---
title: "Plan Re-Approval"
aliases: ["re-approval", "taught prefix", "carried slice", "re-plan after drift", "carried forward unchanged", "identifier rename refusal"]
touches: ["plan-approval-gate", "plan-rewrite", "plan-drift-gate", "teaching-plan"]
last_updated_by: "#458"
status: active
verification: verified
---

# Plan Re-Approval

A session that stopped because a story changed sends the learner back through the same planning chain and the same gate. Every slice up to and including the last one with a written lesson is carried into the new plan unchanged, so a changed story never costs a lesson already taught. Only what follows the taught part is planned again.

## How It Works

The committed lessons are the session's memory. A full re-plan can hand a concept an earlier lesson already taught to a later slice, so the learner is taught it twice, and the vocabulary merge can rename an identifier the drill history and the hint log are keyed on.

So the taught part is fixed and the rest is planned around it. The concepts those carried slices introduced count as introduced for the remainder, a partly taught story continues from the part after the last one taught, and a draft that drops or renames an identifier a written lesson carries is refused before anything is read from the issue graph.

A carried slice keeps its identity, its order, its concepts, its lesson, its branch and its pinning test. Two things about it do move: its pin is refreshed to the story's current state, and its dependency edges are recomputed, because the committed plan is the only source of the edges the home page draws and a frozen edge would point at a slice the re-plan moved or removed. A refused re-approval leaves the approved plan, its lessons and its pages exactly as they were.

## Key Invariants

1. Re-approval runs the same chain and the same gate as a first approval, and no path re-pins a story outside that gate.
2. Every slice up to and including the last one with a written lesson is carried forward unchanged, except for its pinned state and its dependency edges.
3. The changed story is pinned to its current state, and the next session teaches it.
4. Concepts introduced by carried slices count as introduced for the re-planned remainder, so no concept is taught twice across a re-approval.
5. A re-planned draft that drops or renames a concept identifier a written lesson carries is refused.
6. Re-approval reuses the committed plan's suite, grading and control commands, and refuses a second declaration of them.
7. A refused re-approval leaves the approved plan, its lessons and its pages unchanged.

## Integration Points

- [plan-approval-gate](plan-approval-gate.md) — the one gate a re-approval runs through, unchanged, with the same refusals in the same order.
- [plan-rewrite](plan-rewrite.md) — keeps the taught part first and unchanged, and plans only the slices that follow it.
- [plan-drift-gate](plan-drift-gate.md) — the stop that sends a learner here, and which re-approval is the only way past.
- [teaching-plan](teaching-plan.md) — the approved plan a re-approval reads the taught part from and replaces whole.

## Decision Log

### 2026-09-13 — #458 — Re-approval fixes the taught part and plans only the rest, and a carried slice's edges are recomputed

A story changing used to end a workbook: the drift gate stopped the session with an instruction to re-approve the plan, and nothing a learner could follow did that. Re-approval now runs the same chain and gate, with the taught part — every slice up to the last written lesson — carried forward unchanged. This makes the rewrite read the taught part of the approved plan, which amends the earlier rule that it reads only the stubs and the checked lists; the taught part is also exempt from the ordering rule, because a new dependency edge pointing into lessons already taught cannot move those lessons. Two deviations from the approved design were taken while building it. A carried slice's dependency edges are recomputed rather than frozen, because the committed plan is the only source of the edges the home page draws and a frozen edge would draw to a slice the re-plan moved. A pinning test written for a slice past the carried prefix also survives the rebuild, because a handoff writes the next story slice's test before its lesson and the return probe fences with that text; rebuilding the slice would drop the test and make the session ask for a second one. Refuted alternative: re-pin only, with no re-plan, which is smaller and cannot disturb a lesson; it lost because the drifted story's concepts are stale by definition. Refuted alternative: re-plan everything and keep whatever lessons still match, which gives the best order for the remaining work; it lost because a taught concept can be handed to another slice, so lessons end up duplicated or skipped.
