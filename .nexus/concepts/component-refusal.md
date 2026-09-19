---
title: "Component Refusal"
aliases: ["declaration refusal", "code field", "codeFields", "checkable exercise refusal"]
touches: ["widget-seam", "answer-check", "parsons-problem", "trace-stepper", "lesson-renderer"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Component Refusal

Component Refusal is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [widget-seam](widget-seam.md) — the component contract this extends; an unknown component name fails the render the same way a refusal does.
- [answer-check](answer-check.md) — the mechanism the three components below use refusal to protect: an exercise with nothing to check against.
- [parsons-problem](parsons-problem.md) — refuses a declaration naming fewer than two distinct lines.
- [trace-stepper](trace-stepper.md) — refuses a step naming a line the snippet does not have, or a question with no expected answer.
- [lesson-renderer](lesson-renderer.md) — the markup check whose code-field values this exempts.

## Decision Log

### 2026-09-13 — #480 — Split from widget-seam: a component may refuse a declaration and name its own code fields

Three more components ask the learner for an answer, and each can be declared with nothing to check against: a signature with no expected text, a Parsons list with fewer than two distinct lines, a trace step naming a line the snippet does not have. The seam already had one failure mode, an unknown component name, so a hollow declaration was given the same one rather than a second contract shape: a component may now say why it cannot check a declaration, and that failure takes down the whole render exactly as an unknown name does. Refuted alternative: leaving each component to throw its own error, which would give every future component its own way of failing instead of the one the seam already has. Separately, a component's code, such as a trace snippet or an expected signature, reads like markup to the lesson renderer's own markup check; a component now names which of its own fields carry code, as dotted paths with a `*` wildcard for a field nested inside a list or map, and the renderer skips checking only those fields' values. Refuted alternative: reading a component's code fields by convention, such as any field named `snippet` or `answer`. It needs no contract change, but it silently misreads a future component whose code lives in a differently named field, and a wrong guess there is a markup lesson would fail to catch.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
