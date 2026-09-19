---
title: "Workbook Home Page"
aliases: ["home page", "the road ahead", "dependency edges on the page", "not yet written", "in-page anchor graph", "reserved page name"]
touches: ["lesson-renderer", "teaching-plan", "generated-page-check", "offline-page", "workbook-store"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Workbook Home Page

Workbook Home Page is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [lesson-renderer](lesson-renderer.md) — the render this page is one more output of, under the same closed markup channel and all-or-nothing write.
- [teaching-plan](teaching-plan.md) — the committed plan this page reads its slices, marks and dependency edges from.
- [generated-page-check](generated-page-check.md) — the drift check that now covers this page, comparing it byte for byte against a fresh render.
- [offline-page](offline-page.md) — what this page must be: openable from disk, complete, with no network and nothing running.
- [workbook-store](workbook-store.md) — the folder this page is written into, beside the lesson pages it links to.

## Decision Log

### 2026-09-13 — #458 — The home page is one more generated page, with its edges committed in the plan and its graph drawn as anchored list items

A learner could open a lesson but had no way to see where that lesson sat in the road ahead. The page is generated from the same two inputs every other page has — the lessons and the plan — which meant approval had to write the dependency edges into the committed plan, because the resolved roadmap that knows them is ignored by git and absent from a fresh clone. The graph is a list whose items anchor on slice identity and link to each other, so the content exists at render time and prints as it appears. Every render path was made to build its options from the plan and the lessons together, because the session already passed the unwritten slices to its render while the render command and the drift check passed neither, and the check would otherwise have reported this page as drifted after every session. Refuted alternative: have the render read the resolved roadmap for the edges, which keeps the plan's contract smaller and always follows the graph; it lost because rendering on a fresh checkout would fail, the byte comparison would stop being reliable, and a changing graph would become a render input. Refuted alternative: lay the graph out with a script when the page opens, which looks better and costs nothing at render time; it lost because a generated page's content must exist at render time.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
