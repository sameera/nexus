---
title: "Reference Page"
aliases: ["earned page", "second drill", "compressed page", "owed reference page", "reference prose", "returning learner page"]
touches: ["cold-drill", "teaching-session", "lesson-renderer", "workbook-store", "offline-page"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Reference Page

Reference Page is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [cold-drill](cold-drill.md) — the drill history a page is earned from, where a second drill of one concept is the trigger.
- [teaching-session](teaching-session.md) — the chain that names an earned concept, asks for its prose, and checks that prose before writing anything.
- [lesson-renderer](lesson-renderer.md) — builds the page in the same all-or-nothing render and links to it from the drilling lesson's warm-up.
- [workbook-store](workbook-store.md) — holds the page's authored prose in its own folder beside the lessons.
- [offline-page](offline-page.md) — the rules the page is read and printed under, including that nothing on paper is hidden or clipped.

## Decision Log

### 2026-09-18 — #481 — A second drill earns a page, and the page is linked at render time

A concept that matters a second time was introduced several lessons back, and rereading a whole lesson to recover one idea costs more than the idea is worth. Earning is counted over the drill history the committed lessons already carry, so a teammate's checkout sees the same earned set and an empty learner folder changes nothing. Earning a page and writing it are separate events, so a missing page never holds back the lesson the learner came for. The build went one step past the record: prose the render would refuse now stops the sitting, because the render is all-or-nothing and writing that prose would leave the new lesson with no page. The link is resolved at render time because the lesson is always written before the page it points at. Refuted alternative: keep a per-learner tally of drills in the learner folder. It survives a re-plan that rewrites lessons, but the folder is ignored and personal, so no other checkout would see the tally, and it is the personal record this epic rules out.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
