---
title: "Learner Folder"
aliases: ["learner store", "personal records", "one ignore rule", "learner ignore guard", "per-learner state"]
touches: ["workbook-store", "workbook-handoff", "lesson-renderer", "cold-drill", "just-in-time-lesson", "handoff-prompt", "focus-marking"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Learner Folder

Learner Folder is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [workbook-store](workbook-store.md) — the store this folder is a direct child of, so one rule covers every workbook in it.
- [workbook-handoff](workbook-handoff.md) — handoff records are kept here, under the same rule as everything else personal.
- [lesson-renderer](lesson-renderer.md) — reads nothing from here, which is what lets an empty folder read normally.
- [cold-drill](cold-drill.md) — the hint counts kept here are the one personal signal that ranks an already-eligible concept.
- [just-in-time-lesson](just-in-time-lesson.md) — reads the same hint counts to decide which concepts the next lesson comes back to.
- [handoff-prompt](handoff-prompt.md) — the prompt is kept here, so it is never a page and can never appear as drift.
- [focus-marking](focus-marking.md) — files each verdict's reason here, so the one line saying why a slice was handed off survives for the reviewer.

## Decision Log

### 2026-09-07 — #405 — One learner folder, and a per-write question put to git

The folder sits directly under the store rather than inside each workbook, because the story promises one line rather than an audit, and that promise only holds if the line's coverage does not depend on how many workbooks exist. The write guard asks git instead of reading an ignore file, and it asks per write, because the rule can be removed between two writes and the second one has to stop. During implementation the resolve path was found to append outside that guard and was routed through it. Refuted alternative: a learner folder inside each workbook, matched by a wildcard ignore pattern. It keeps a workbook self-contained and movable as a unit, but wildcard patterns are the kind of rule people get subtly wrong, and one mistake commits a person's records.

### 2026-09-07 — #407 — Reciprocal links from the cold drill, the just-in-time lesson and the handoff prompt

The teaching session's stages read and write here, so the edges are recorded on both sides. The drill and the lesson both read the hint counts: the drill uses them to rank a concept already cold enough to ask about, and the lesson uses them to decide which concepts to come back to. The handoff prompt is written here rather than into the workbook, which is what keeps it from ever appearing as drift against the rendered lessons.

### 2026-09-11 — #456 — A handoff verdict's reason is a personal record, not derived scratch

The planning pass that marks a slice records one line saying why, and that line is about the learner rather than about the code, so it belongs here rather than beside the plan. The draft it was judged for is already excluded from the commit, which made leaving it there look safe — but being excluded from a commit is not what makes a record personal, and the reason would then sit outside the guard every other personal record passes. The proposal the reason arrived in is removed once it has been read, so this folder is the only place it is kept. Refuted alternative: discard the reason once the mark is set, which is simplest and keeps the pass from writing anything personal at all. It lost because the reviewer who approves the marks would then have nothing saying why a slice was handed off, which is the one thing that makes a wrong mark visible.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
