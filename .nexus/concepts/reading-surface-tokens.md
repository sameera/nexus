---
title: "Reading Surface Tokens"
aliases: ["shared reading definition", "reading subset", "lifted tokens", "one palette two surfaces", "print token exception"]
touches: ["theme-tokens", "offline-page", "lesson-renderer"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Reading Surface Tokens

Reading Surface Tokens is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [theme-tokens](theme-tokens.md) — the application's token vocabulary, whose reading subset was lifted out into this shared definition.
- [offline-page](offline-page.md) — the surface resolving every one of its values from here, on screen and on paper.
- [lesson-renderer](lesson-renderer.md) — embeds this definition in the one stylesheet it writes per workbook.

## Decision Log

### 2026-09-07 — #405 — The reading subset is lifted, and print is the one place literals live

A second reading surface can only declare none of its own values while a shared definition exists, because a library cannot depend on an application, so the reading subset was lifted rather than copied. Restricting the lift to that subset stops the shared definition becoming a home for application chrome. Refuted alternative: a small palette for the workbook, hand-matched to the application's, which decouples the two but drifts within a release or two. Print deviates from the record's invariant that the workbook declares no value of its own. Print must be ink on white whatever the screen theme is, and the shared definition carries no print set, so literals are unavoidable somewhere. They are confined to the print rules and assigned only onto shared token names, pinned by a test, so the invariant holds for the screen surface it was written about and yields to the print requirement.

### 2026-09-18 — #669 — The second consumer left, so parity is now unpinned here

The one test that read Prime's stylesheet directly was removed when Prime moved to sameera/prime. It was the single place a pipeline test depended on an application tree, and the invariant it guarded became cross-repository the moment the tree left. Its sibling assertion is untouched: the workbook still declares no colour or typography of its own, so the shared definition is still pinned as the single source for everything that remains here. Filing the parity invariant at the other end is deferred to its own stub. Refuted alternative: keep the assertion and read the departed tree over a checked-out sibling, which preserves the check but makes a library test depend on another repository being present on disk.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
