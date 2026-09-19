---
title: "Pinned Lesson Sources"
aliases: ["pinned sources", "source pinning", "sources pinned at record approval", "lesson grounding", "exemplar file", "pin workbook sources"]
touches: ["teaching-plan", "plan-field-ownership", "plan-re-approval", "decision-record", "record-digest"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Pinned Lesson Sources

Pinned Lesson Sources is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [teaching-plan](teaching-plan.md) — the committed plan whose learner slices hold the pinned sources.
- [plan-field-ownership](plan-field-ownership.md) — assigns the sources field to the design stage and keeps it absent until pinned.
- [plan-re-approval](plan-re-approval.md) — carries a slice's pinned sources into the new plan while the slice stays one the learner builds.
- [decision-record](decision-record.md) — the approved record the sources name, whose close triggers the pinning.
- [record-digest](record-digest.md) — the record fetch whose approval reading the pinning step reuses.

## Decision Log

### 2026-09-17 — #459 — Sources are pinned on the plan slice when the decision record is approved

A slice's lesson needs grounding that the plan cannot hold at approval, so the design stage now pins it on the slice when the epic's decision record is approved. The sources live on the committed plan slice, because a second committed file describing one plan can disagree with the plan without anyone noticing. Pinning happens at record approval and not at close, because a lesson is written before its story is built and close waits for every story to merge. Close-time pinning would always land after the lessons it exists to ground. Approval is read through the record digest's fetch, so there is one approval rule and not a second one that can drift. The exemplar is a file already in the tree and not the story's own code, which corrects story #625's third acceptance criterion. Refuted alternative: keep close as a backstop that pins later. It lost because close would pin sources onto slices whose lessons were already written without them.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
