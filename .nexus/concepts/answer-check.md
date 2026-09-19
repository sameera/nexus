---
title: "Answer Check"
aliases: ["checkable answer", "answer checking", "spacing rule", "reveal after check", "fill-the-signature"]
touches: ["component-refusal", "parsons-problem", "trace-stepper"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Answer Check

Answer Check is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [component-refusal](component-refusal.md) — the contract fields a checkable-answer component uses to reject a hollow declaration and exempt its code from the markup check.
- [parsons-problem](parsons-problem.md) — checks its settled line order with this mechanism, unchanged.
- [trace-stepper](trace-stepper.md) — checks a step's question with this mechanism, unchanged.

## Decision Log

### 2026-09-13 — #480 — One checking mechanism, matched by position and cleared by a plain input event

The library's first three answer-asking components share one checking mechanism rather than each growing its own, so a learner meets one way of asking to be checked and one way of being told the result. Parts pair with their expected copies by position because a component renders from data alone and cannot mint a page-unique id; the refuted alternative, generated ids linking each check to its copy, would need a per-page counter threaded through the seam. Checking enables the reveal control rather than the seam gaining a new render contract, which keeps the widget shell unchanged and lets the same disable/enable toggle double as the back/forward-cache reset. A control that rearranges parts signals the change with a plain `input` event instead of calling a clear-result function directly, which lets later components consume the checking unchanged; the refuted alternative, exposing a function each component's runtime calls, would tie every future component to this mechanism's internals rather than to one DOM event every browser already dispatches.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
