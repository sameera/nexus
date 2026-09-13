---
title: "Workbook Home Page"
aliases: ["home page", "the road ahead", "dependency edges on the page", "not yet written", "in-page anchor graph", "reserved page name"]
touches: ["lesson-renderer", "teaching-plan", "generated-page-check", "offline-page", "workbook-store"]
last_updated_by: "#458"
status: active
verification: verified
---

# Workbook Home Page

A workbook's home page shows the whole road ahead: every slice of the approved plan, in teaching order, each naming the slices it depends on. A written lesson's slice links to its page, a slice with no lesson is shown as not yet written, a handed-off slice is marked as handed off, and a scaffold is marked as a teaching step. The page exists from the moment the plan is approved, before any lesson has been written.

## How It Works

The page is built from the committed lessons and the committed plan, and from nothing else. No learner record is read, so a handoff's resolution never shows. The resolved roadmap is not read either: it is ignored by git and missing on a fresh clone, so a page needing it could be neither rendered nor checked there. The dependency edges are therefore written into the committed plan at approval — between stories, from one part of a split story to the next, and from each scaffold to the slice it serves.

The graph is a list in plan order. Each slice is anchored by its identity and names its dependencies as links to those anchors, so the page prints as it appears and needs nothing computed when it opens.

Every render path produces the page from the same inputs — approval, the session, the render command and the drift check alike. Paths rendering from different inputs are how the check came to disagree with the session before.

## Key Invariants

1. The page is built from the committed lessons and the committed plan only; no learner record, resolved roadmap or live issue state is an input.
2. It shows every slice as a list in plan order, with the dependency edges between them.
3. The committed plan carries every edge the page shows, including part-to-part and scaffold-to-slice edges.
4. A slice with a written lesson links to its page; a slice with no written lesson is shown as not yet written, with no link.
5. A handed-off slice is marked as handed off, and a scaffold as a teaching step, not a roadmap story.
6. Every render path produces the page from the same inputs, including when no lesson is written, and the drift check covers it.
7. The page's name is reserved: a plan naming a lesson that would render over it is refused.

## Integration Points

- [lesson-renderer](lesson-renderer.md) — the render this page is one more output of, under the same closed markup channel and all-or-nothing write.
- [teaching-plan](teaching-plan.md) — the committed plan this page reads its slices, marks and dependency edges from.
- [generated-page-check](generated-page-check.md) — the drift check that now covers this page, comparing it byte for byte against a fresh render.
- [offline-page](offline-page.md) — what this page must be: openable from disk, complete, with no network and nothing running.
- [workbook-store](workbook-store.md) — the folder this page is written into, beside the lesson pages it links to.

## Decision Log

### 2026-09-13 — #458 — The home page is one more generated page, with its edges committed in the plan and its graph drawn as anchored list items

A learner could open a lesson but had no way to see where that lesson sat in the road ahead. The page is generated from the same two inputs every other page has — the lessons and the plan — which meant approval had to write the dependency edges into the committed plan, because the resolved roadmap that knows them is ignored by git and absent from a fresh clone. The graph is a list whose items anchor on slice identity and link to each other, so the content exists at render time and prints as it appears. Every render path was made to build its options from the plan and the lessons together, because the session already passed the unwritten slices to its render while the render command and the drift check passed neither, and the check would otherwise have reported this page as drifted after every session. Refuted alternative: have the render read the resolved roadmap for the edges, which keeps the plan's contract smaller and always follows the graph; it lost because rendering on a fresh checkout would fail, the byte comparison would stop being reliable, and a changing graph would become a render input. Refuted alternative: lay the graph out with a script when the page opens, which looks better and costs nothing at render time; it lost because a generated page's content must exist at render time.
