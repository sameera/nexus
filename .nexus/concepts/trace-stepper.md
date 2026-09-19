---
title: "Trace Stepper"
aliases: ["trace stepper", "step gating", "predict before step"]
touches: ["answer-check", "component-refusal"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Trace Stepper

Trace Stepper is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [answer-check](answer-check.md) — checks a step's question, unchanged.
- [component-refusal](component-refusal.md) — fails the whole render when a step names a line the snippet does not have, or a question with no expected answer.

## Decision Log

### 2026-09-13 — #480 — A step's question belongs to that step and gates on being checked, not on being right

Decision record #616 amends story #519's acceptance criteria: stepping forward moves the mark to the line the next step names, not merely one line further, so a trace can follow a loop or a branch. A question belongs to the step it asks about and is visible while the learner is one step before it, and stepping past it is blocked until it has been checked, right or wrong, rather than until the learner gets it right; a learner who cannot get a question right would otherwise be trapped unable to continue. Refuted alternative: keeping every passed question and its result visible beneath the snippet as the learner advances. It would give the learner a running record of their answers, but it shows one visible question at a time and computes nothing beyond what the current step needs, and a running record is state this component does not otherwise keep.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
