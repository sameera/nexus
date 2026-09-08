---
title: "Just-In-Time Lesson"
aliases: ["written on arrival", "lesson written when the learner arrives", "arrival", "exercise half", "revisit a hinted concept", "one lesson ahead"]
touches: ["teaching-session", "teaching-plan", "cold-drill", "lesson-renderer", "learner-folder"]
last_updated_by: "#407"
status: active
verification: verified
---

# Just-In-Time Lesson

A lesson is written at the moment the learner reaches it, and never before. Writing the whole workbook up front throws away the one input that makes a lesson fit its reader, which is how the previous lesson went. At most one slice beyond those already taught holds a written lesson, and every later slice is a stub.

## How It Works

Arrival walks the plan in order. The first slice with no lesson is where the learner is: a slice they build gets a lesson, and a slice they do not gets handed off. A slice that already has a lesson but an unfinished exercise is opened again rather than rewritten. An exercise is finished when the pinning test the lesson named is present in the tree, which is the text the fence check runs, so there is one notion of done rather than two that can disagree.

The exercise half names the story, the branch, the pinning test to write first, that test's own text, and the grading command. Every one of those facts comes from the plan, so a lesson cannot name a branch or a test the session did not choose.

A concept the learner took a hint on in the lesson they have just finished is asked about again in this one. The drill cannot carry that, because a concept from the last lesson is not a cold recall.

## Key Invariants

1. At most one slice beyond those already taught holds a written lesson; every later slice is a stub.
2. Writing a lesson is idempotent: a session finding the current slice's lesson already written opens it rather than rewriting it.
3. The exercise half names the story, the branch, the pinning test to write first, that test's own text, and the grading command.
4. Every fact the exercise asserts comes from the plan, so a lesson cannot name a branch or a test the session did not choose.
5. A concept the learner took a hint on in the lesson just finished is asked about again here, and a lesson that names one and asks nothing about it is refused.
6. An exercise is finished when the pinning test the lesson named is present in the tree, the same text the fence check runs.
7. The learner's position derives from the written lessons and the tree, not a personal record.

## Integration Points

- [teaching-session](teaching-session.md) — the chain that decides the learner has arrived here and writes the one lesson.
- [teaching-plan](teaching-plan.md) — the slice being taught, and the source of every fact the exercise names.
- [cold-drill](cold-drill.md) — the section that opens the lesson, which never carries a concept from the lesson just finished.
- [lesson-renderer](lesson-renderer.md) — what turns the written lesson into the page the session opens for the learner.
- [learner-folder](learner-folder.md) — the hint counts that say which concepts this lesson comes back to.

## Decision Log

### 2026-09-07 — #407 — Finished is the pinning test in the tree, and the hint log has a second use

A slice is finished when the file the lesson named as its pinning test is present, and nothing else. Position is then derived from committed lessons plus files in the tree, so it is the same on every run, and a red suite reports itself as the blocker instead of the session claiming a finished exercise is unfinished. Folding the suite result into finished-ness was the first cut here and was refuted: it made every written slice read as unfinished on a red suite, so a learner who had finished their exercise was told it was not done, and a handoff slice that might have fixed the suite could never be reached. Concepts the learner took a hint on in the last lesson are carried into the brief and the lesson refuses to omit them, which puts the fact on the committed page where a teammate's checkout can read it without a hint log. Refuted alternative: fold those concepts into the next slice's concept list. It is cheaper, but that list means introduced here, so a revisited concept would read as freshly taught, would go cold one lesson late, and nothing would check the prose mentioned it.
