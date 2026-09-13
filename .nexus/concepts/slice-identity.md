---
title: "Slice Identity"
aliases: ["slice name", "story and part", "scaffold concept as identity", "a slice is remembered by its lesson", "branch per story", "position is not identity"]
touches: ["teaching-plan", "teaching-session", "scaffold-slice", "just-in-time-lesson", "plan-rewrite"]
last_updated_by: "#458"
status: active
verification: verified
---

# Slice Identity

A slice is named by its story and which part of that story it is, or — when it builds nothing on the roadmap — by the one concept it teaches. That name is what the slice's lesson, its branch and the dependency edges onto it are derived from, never its position in the plan. A re-plan that shifts every later position therefore leaves each written lesson still attached to the slice it was written for.

## How It Works

Position moves whenever a plan is planned again, because one new scaffold pushes every later slice along. A lesson named from position would be cut off from its slice at the next approval, so the name comes from the identity instead.

Whether a slice is behind the learner is read from that slice's own lesson, not from a key on its story. A story split into parts has one lesson per part, so a story key makes the second part invisible and moves the learner on before they build it. A scaffold has no story to key on at all. The committed plan already forbids two slices teaching into one lesson, so the lesson is the key that exists.

One branch serves a story and is shared by every part of it, prefixed with the workbook so it cannot collide with the team's own branch. Parts build one story in sequence, so a branch per part would leave the learner cutting each part's branch from the part before by hand.

## Key Invariants

1. A slice's identity is its story and its part, or the one concept a scaffold teaches — never its position.
2. Every teaching slice has its own lesson, named from its identity, and no session writes into a lesson that already exists.
3. Whether a slice is behind the learner is read from that slice's own lesson, never from another slice's.
4. A slice's branch is derived from its story, so every part of a split story shares one branch.
5. A branch name is prefixed with the workbook, so it cannot collide with the team's own branch for that story.
6. A scaffold has no branch, and writing its lesson is the only fact that puts it behind the learner.
7. Dependency edges between slices are recorded by identity, so a re-plan cannot silently re-point one by position.

## Integration Points

- [teaching-plan](teaching-plan.md) — the committed contract that carries each slice's identity, its lesson, its branch and its edges.
- [teaching-session](teaching-session.md) — walks the plan by position but asks each slice, by this identity, whether it is behind the learner.
- [scaffold-slice](scaffold-slice.md) — the slice identified by its concept rather than a story, which is why a story key alone cannot work.
- [just-in-time-lesson](just-in-time-lesson.md) — the lesson written on arrival, whose file name is this identity and whose presence marks the slice done.
- [plan-rewrite](plan-rewrite.md) — assigns the part numbers this identity is built from, and continues them across a re-plan.

## Decision Log

### 2026-09-13 — #458 — A slice is remembered through its own lesson, and its name comes from its identity rather than its position

Keying a slice by its story was already wrong in two ways once the plan admitted splits and scaffolds: a story key skips the second part of a split story, and a scaffold has no story to key on. A slice's identity was already fixed as its story plus its part, or a scaffold's concept, and the committed plan's uniqueness rule was already keyed on the lesson — so the lesson file became the key, and written lessons and finished exercises are tracked through it. Handoff records stay keyed by story, because a handoff is never split. Lesson names and branches derive from the identity for the same reason: position changes at every re-plan, and a position-named lesson would be orphaned from its slice at the next approval. One branch per story, shared by its parts, follows from the parts building one story in sequence. Refuted alternative: keep the story as the key and add a part counter per story. It contains the change better — every reader keyed on story keeps working with a small edit — but a scaffold still needs a second rule, and the counter is new state that has to live somewhere: in the learner folder it breaks the rule that the committed lessons are the session's memory, and in the plan it duplicates what position already says. Refuted alternative: a branch per part, which keeps each exercise's diff separate; it lost because part two builds on part one, so the learner would manage a chain of branches by hand.
