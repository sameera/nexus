---
title: "Generated Page Check"
aliases: ["generated page check", "page drift check", "committed generated output", "re-render and compare", "check mode"]
touches: ["lesson-renderer", "workbook-home-page"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Generated Page Check

Generated Page Check is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [lesson-renderer](lesson-renderer.md) — the render this check re-runs and compares against, and the page it was split from.
- [workbook-home-page](workbook-home-page.md) — the page this check now covers, re-rendered from the committed plan and compared byte for byte.

## Decision Log

### 2026-09-07 — #407 — Split from the lesson renderer

The renderer's page reached its own-content cap when the markup refusal had to be amended, and the committed-page drift check was the half that reads independently. A task asking why a committed page no longer matches its lesson needs neither the markup rule nor the chrome rules; a task debugging a failed render needs nothing about the check. What moved is the paragraph on committed generated output and the invariant on the check mode, and the reporting detail was drawn from the same shipped behaviour. The renderer's Decision Log stays whole on the renderer, and this page opens with its own birth entry rather than a copy.

### 2026-09-13 — #458 — The check renders from the plan and the lessons together, so it covers the home page

The check re-rendered from the lessons alone while the session rendered from the lessons and the plan's unwritten slices. Once a home page existed, those two inputs would disagree on every run: the check would report the home page as drifted after every session, and a newly approved plan with no lesson yet would have no page for the check to compare at all. Every render path now builds its inputs the same way, from the committed plan and the lessons the workbook holds, and a workbook with a plan renders even before its first lesson is written. A workbook with no plan still renders its lessons alone, unchanged. This entry also records the reciprocal link from workbook-home-page.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
