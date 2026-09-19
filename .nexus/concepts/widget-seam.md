---
title: "Widget Seam"
aliases: ["widget declaration", "component library", "inert widget", "interactive exercise", "widget manifest", "predict-then-reveal", "lead region", "always-visible region"]
touches: ["lesson-renderer", "offline-page", "cold-drill", "component-refusal"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Widget Seam

Widget Seam is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [lesson-renderer](lesson-renderer.md) — the render that resolves a declaration, and that fails whole when it cannot.
- [offline-page](offline-page.md) — the page a widget must work in, with nothing fetched and no module loader.
- [cold-drill](cold-drill.md) — the library's first consumer, whose drill is a predict-then-reveal exercise on the page.
- [component-refusal](component-refusal.md) — split from this page: how a component says it cannot check a declaration, and names its own code fields.

## Decision Log

### 2026-09-07 — #405 — An inert declaration, resolved by lookup, failing the whole render

The declaration is placed in the prose because position matters for a teaching aid, and it stays valid markdown so the lesson keeps reading in every surface that already displays markdown. Resolution is a manifest lookup rather than an execution of the runtime, which keeps the render fast and its failure cheap; the accepted cost is that adding a component needs a toolkit release. Failing the whole render on an unknown component, rather than the one page, is what makes a page with a hole in it impossible. Refuted alternative: bundle at render time, so a workbook builds itself from source wherever it lives. A component could then be added without a release and an adopter could extend the library, but it puts a bundler and its dependency tree into a tool that is currently one self-contained program, and it makes every render a build.

### 2026-09-07 — #407 — One optional lead region, and the library's first component

The library gained predict-then-reveal, the component the opening drill is built from: a learner who commits to an answer before seeing it finds out what they knew rather than recognising an answer they were shown. Commitment is enforced by ordering alone, and the component stores nothing about the learner, because a page opened from a file has nowhere to write and giving it somewhere would create a record about a person outside the one folder the ignore rule protects. The seam gained one optional lead region, always visible and always printed, because the shipped seam could only hide content or label a button and a button is excluded from print. One optional field on the existing component contract is the smallest change that satisfies it, since every existing component and the declaration syntax are untouched. This entry also records the reciprocal link to the cold drill. Refuted alternative: a second widget kind carrying its own always-visible slot. It leaves the component contract unchanged, but it forks the declaration syntax and the render path for what is really one property of the seam, and every future component wanting such a region faces the same fork.

### 2026-09-13 — #480 — Split: the refusal and code-field contract additions moved to component-refusal

Three more components need two additions to the component contract: a way to say a declaration has nothing to check, and a way to name which of a component's own fields carry code. Both belong to this page's own contract, but adding them here took the page over its own-content cap, so they moved to their own page rather than compressing what already stood here. A task asking how a declaration resolves against the library needs neither addition; a task asking why a bad declaration fails, or why a snippet reads as code and not markup, needs nothing about position, resolution or the lead region. This entry carries no other change: the seam's own resolution, failure and printing rules stand exactly as decided at #405 and #407.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
