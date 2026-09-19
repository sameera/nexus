---
title: "Slice Identity"
aliases: ["slice name", "story and part", "scaffold concept as identity", "a slice is remembered by its lesson", "branch per story", "position is not identity"]
touches: ["teaching-plan", "teaching-session", "scaffold-slice", "just-in-time-lesson", "plan-rewrite"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Slice Identity

Slice Identity is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [teaching-plan](teaching-plan.md) — the committed contract that carries each slice's identity, its lesson, its branch and its edges.
- [teaching-session](teaching-session.md) — walks the plan by position but asks each slice, by this identity, whether it is behind the learner.
- [scaffold-slice](scaffold-slice.md) — the slice identified by its concept rather than a story, which is why a story key alone cannot work.
- [just-in-time-lesson](just-in-time-lesson.md) — the lesson written on arrival, whose file name is this identity and whose presence marks the slice done.
- [plan-rewrite](plan-rewrite.md) — assigns the part numbers this identity is built from, and continues them across a re-plan.

## Decision Log

### 2026-09-13 — #458 — A slice is remembered through its own lesson, and its name comes from its identity rather than its position

Keying a slice by its story was already wrong in two ways once the plan admitted splits and scaffolds: a story key skips the second part of a split story, and a scaffold has no story to key on. A slice's identity was already fixed as its story plus its part, or a scaffold's concept, and the committed plan's uniqueness rule was already keyed on the lesson — so the lesson file became the key, and written lessons and finished exercises are tracked through it. Handoff records stay keyed by story, because a handoff is never split. Lesson names and branches derive from the identity for the same reason: position changes at every re-plan, and a position-named lesson would be orphaned from its slice at the next approval. One branch per story, shared by its parts, follows from the parts building one story in sequence. Refuted alternative: keep the story as the key and add a part counter per story. It contains the change better — every reader keyed on story keeps working with a small edit — but a scaffold still needs a second rule, and the counter is new state that has to live somewhere: in the learner folder it breaks the rule that the committed lessons are the session's memory, and in the plan it duplicates what position already says. Refuted alternative: a branch per part, which keeps each exercise's diff separate; it lost because part two builds on part one, so the learner would manage a chain of branches by hand.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
