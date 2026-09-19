---
title: "Offline Page"
aliases: ["opened from disk", "no server", "file-url page", "classic script", "printed lesson", "workbook page assets", "print completeness"]
touches: ["lesson-renderer", "widget-seam", "reading-surface-tokens", "workbook-home-page", "reference-page"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Offline Page

Offline Page is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [lesson-renderer](lesson-renderer.md) — writes the page and the two shared assets it references by relative path.
- [widget-seam](widget-seam.md) — the one interactive element here, whose content is present before any interaction.
- [reading-surface-tokens](reading-surface-tokens.md) — where the page's colours and typography come from, on screen and on paper.
- [workbook-home-page](workbook-home-page.md) — a generated page under these same rules, whose dependency graph is in-page anchors rather than a layout computed on open.
- [reference-page](reference-page.md) — a page printed under these rules, whose completeness on paper is asserted over the rendered page.

## Decision Log

### 2026-09-07 — #405 — A page opened from disk, with everything it needs beside it

A page opened directly from disk can neither load a module script nor fetch anything, so the design commits to that constraint rather than meeting it late: a classic script, relative paths, and no remote asset. Requiring nothing to be started is what lets a learner with no network and no running toolkit read a lesson. Printing is treated as a first-class output rather than a side effect, because a dark reading surface printed is unreadable and the navigation is not worth paper. Refuted alternative: serve the workbook from a local process the learner starts. It makes module scripts, fetching and per-request rendering available, which would ease later interactive components, but the learner must start a process before reading, and the published toolkit would gain a server it does not otherwise need.

### 2026-09-13 — #458 — Reciprocal link from workbook-home-page

Mechanical reciprocity fan-out: the workbook's home page is opened from disk under exactly these rules, and its dependency graph is drawn as list items linking to anchors on the same page rather than as a layout a script computes when the page opens. That choice is this page's rule applied: a generated page's content has to exist at render time and print as it appears.

### 2026-09-18 — #481 — Nothing on paper is hidden or clipped, and the limit of the check is stated

A printed reference page must carry all of its content, and fitting on one sheet must never be reached by cutting content off. The one rule that could clip content on paper was the screen rule letting a code block scroll sideways. On paper a code block now wraps, because making its overflow visible alone would still run a long line off the sheet. The check reads the screen rules and the print rules together, since a check of the print rules alone would have missed that screen rule. It treats controls, live regions and navigation as droppable. The check has no layout engine, so its limit is written into the invariant and into the workbook skill, and nobody reads a passing check as a measured guarantee. The print change alters every rendered page, so a workbook rendered before it shows as changed in the drift check until it is rendered once more. This entry also records the reciprocal link from reference-page. Refuted alternative: print each page in a browser and read the text back. It is the only form that sees real pagination, but the workbook's checks run without a browser, and comparing printed text is slow and tends to fail when the browser changes rather than when a page regresses.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
