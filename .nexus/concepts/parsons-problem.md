---
title: "Parsons Problem"
aliases: ["parsons problem", "shuffle guard", "line reordering exercise", "earlier later buttons"]
touches: ["answer-check", "component-refusal"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Parsons Problem

Parsons Problem is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [answer-check](answer-check.md) — checks the settled order against the expected one, unchanged.
- [component-refusal](component-refusal.md) — fails the whole render when a declaration names fewer than two distinct lines.

## Decision Log

### 2026-09-13 — #480 — The shuffle guard strips whitespace and rotates by one; lines move with native buttons

Two decisions shape this component. The shuffle guard compares lines with all whitespace stripped and rotates the order by one position when that stripped comparison would otherwise equal the expected order; stripping is strictly tighter than the runtime's own spacing rule, so nothing that would pass the check can be produced as a starting shuffle, without a second copy of the spacing rule written in TypeScript. The refuted alternative, re-implementing the runtime's spacing rule at render time or re-seeding until the shuffle differs, would either duplicate a rule that must stay in sync in two places or make the render's output depend on how many seeds it happened to try. A line moves with a pair of native, never-disabled "earlier"/"later" buttons rather than drag-and-drop, because native buttons are keyboard, touch and pointer operable with no extra handling, and a control that stays enabled at both ends keeps focus from falling off the puzzle; the refuted alternative, drag and drop, cannot be driven from the keyboard and would still need a parallel keyboard path built alongside it.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
