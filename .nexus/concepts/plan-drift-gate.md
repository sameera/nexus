---
title: "Plan Drift Gate"
aliases: ["drift check", "pinned versus live", "re-scoped story", "unverifiable story", "drift report", "closed story stops its lesson"]
touches: ["teaching-plan", "teaching-session", "plan-re-approval"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Plan Drift Gate

Plan Drift Gate is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [teaching-plan](teaching-plan.md) — the pinned state this check compares against, and the slice order it walks.
- [teaching-session](teaching-session.md) — the chain this check gates, which reports every finding and stops on the next slice's own.
- [plan-re-approval](plan-re-approval.md) — the only way past a stop here: the changed story is re-pinned and the taught lessons are carried forward.

## Decision Log

### 2026-09-07 — #407 — Pinned against live, per slice, and unverifiable is not unchanged

The check compares only the story's title and description because the reader is a learner in mid-flow, and a check firing on labels or comments is one they learn to skip past. Only the next slice's own drift blocks, so a later story that moved does not stop a lesson it has nothing to do with. A story that could not be read is reported as unverifiable rather than passed as unchanged, because treating a failed read as agreement is how a lesson gets written for work nobody is doing. The live read is injected rather than performed here, which keeps the comparison pure and makes the unverifiable case something a test can assert. Refuted alternative: have the check fetch the story itself and cache the result. It is simpler at the point of use, but it couples a pure comparison to running a process, and it duplicates a live-reading concern the session's own wiring should own once.

### 2026-09-13 — #458 — A story is read once however many slices name it, a scaffold never drifts, and re-approval is the way out

A split story now has several slices pinning one story, so the check read that story once per slice and reported the same drift several times. It now reads each story once and finds each story's drift once; only the slice about to be taught still blocks. A scaffold pins nothing, because it builds no story, so it is never drift-checked and drift never blocks it. The stop this check produces also became something a learner can act on: it told them the plan was re-approved, and until this epic nothing did that. Re-approval now runs the same planning chain and the same gate, carries every slice up to the last written lesson forward unchanged, and pins the changed story to its current state, so a changed story costs the learner nothing they have already been taught. This entry also records the reciprocal link from plan-re-approval.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
