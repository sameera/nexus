---
title: "Plan Re-Approval"
aliases: ["re-approval", "taught prefix", "carried slice", "re-plan after drift", "carried forward unchanged", "identifier rename refusal"]
touches: ["plan-approval-gate", "plan-rewrite", "plan-drift-gate", "teaching-plan", "pinned-sources"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Plan Re-Approval

Plan Re-Approval is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [plan-approval-gate](plan-approval-gate.md) — the one gate a re-approval runs through, unchanged, with the same refusals in the same order.
- [plan-rewrite](plan-rewrite.md) — keeps the taught part first and unchanged, and plans only the slices that follow it.
- [plan-drift-gate](plan-drift-gate.md) — the stop that sends a learner here, and which re-approval is the only way past.
- [teaching-plan](teaching-plan.md) — the approved plan a re-approval reads the taught part from and replaces whole.
- [pinned-sources](pinned-sources.md) — sources pinned from an approved record, which a re-approval keeps on every slice that stays a learner slice.

## Decision Log

### 2026-09-13 — #458 — Re-approval fixes the taught part and plans only the rest, and a carried slice's edges are recomputed

A story changing used to end a workbook: the drift gate stopped the session with an instruction to re-approve the plan, and nothing a learner could follow did that. Re-approval now runs the same chain and gate, with the taught part — every slice up to the last written lesson — carried forward unchanged. This makes the rewrite read the taught part of the approved plan, which amends the earlier rule that it reads only the stubs and the checked lists; the taught part is also exempt from the ordering rule, because a new dependency edge pointing into lessons already taught cannot move those lessons. Two deviations from the approved design were taken while building it. A carried slice's dependency edges are recomputed rather than frozen, because the committed plan is the only source of the edges the home page draws and a frozen edge would draw to a slice the re-plan moved. A pinning test written for a slice past the carried prefix also survives the rebuild, because a handoff writes the next story slice's test before its lesson and the return probe fences with that text; rebuilding the slice would drop the test and make the session ask for a second one. Refuted alternative: re-pin only, with no re-plan, which is smaller and cannot disturb a lesson; it lost because the drifted story's concepts are stale by definition. Refuted alternative: re-plan everything and keep whatever lessons still match, which gives the best order for the remaining work; it lost because a taught concept can be handed to another slice, so lessons end up duplicated or skipped.

### 2026-09-17 — #459 — Reciprocal link from pinned-sources

A slice may now carry sources pinned from its epic's approved decision record. A re-plan reads the issue graph and the roadmap, and neither can change the record those sources came from, so re-approval keeps them on any slice that is still a learner slice. A slice that becomes a handoff slice loses them, because a handoff slice teaches nothing. Refuted alternative: drop sources on re-plan and pin again. It lost because a lesson may already be written from the earlier sources, and a slice left bare would be taught from the repository search that pinning replaces. The body here is unchanged because it sits at the word cap. The pinned-sources page states the rule in full.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
