---
title: "Just-In-Time Lesson"
aliases: ["written on arrival", "lesson written when the learner arrives", "arrival", "exercise half", "revisit a hinted concept", "one lesson ahead", "pinning test written on arrival"]
touches: ["teaching-session", "teaching-plan", "cold-drill", "lesson-renderer", "learner-folder", "slice-identity", "plan-field-ownership"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Just-In-Time Lesson

Just-In-Time Lesson is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [teaching-session](teaching-session.md) — the chain that decides the learner has arrived here and writes the one lesson.
- [teaching-plan](teaching-plan.md) — the slice being taught, and the source of every fact the exercise names.
- [cold-drill](cold-drill.md) — the section that opens the lesson, which never carries a concept from the lesson just finished.
- [lesson-renderer](lesson-renderer.md) — what turns the written lesson into the page the session opens for the learner.
- [learner-folder](learner-folder.md) — the hint counts that say which concepts this lesson comes back to.
- [slice-identity](slice-identity.md) — the name this lesson's file takes, and the reason the lesson itself is what marks its slice done.
- [plan-field-ownership](plan-field-ownership.md) — why the pinning test is this arrival's to write rather than approval's, and why it is written once.

## Decision Log

### 2026-09-07 — #407 — Finished is the pinning test in the tree, and the hint log has a second use

A slice is finished when the file the lesson named as its pinning test is present, and nothing else. Position is then derived from committed lessons plus files in the tree, so it is the same on every run, and a red suite reports itself as the blocker instead of the session claiming a finished exercise is unfinished. Folding the suite result into finished-ness was the first cut here and was refuted: it made every written slice read as unfinished on a red suite, so a learner who had finished their exercise was told it was not done, and a handoff slice that might have fixed the suite could never be reached. Concepts the learner took a hint on in the last lesson are carried into the brief and the lesson refuses to omit them, which puts the fact on the committed page where a teammate's checkout can read it without a hint log. Refuted alternative: fold those concepts into the next slice's concept list. It is cheaper, but that list means introduced here, so a revisited concept would read as freshly taught, would go cold one lesson late, and nothing would check the prose mentioned it.

### 2026-09-13 — #458 — The pinning test is written on arrival too, and a scaffold's lesson has no exercise

Writing on arrival now covers the exercise's pinning test, not only the lesson's prose. An approved plan holds no test for a slice the learner has not reached, so the arrival that writes the lesson also writes that slice's test, records it in the plan, and composes the lesson from the recorded value — which keeps every fact the exercise asserts a fact the plan holds. A test is written once and never rewritten, so the lesson and the fence probe always show the same words. Producing every test at approval was refused: it means generating tests for a whole roadmap from story text the planning session never holds, at a gate that shows no prose, and they would go stale before the learner reached them — which is what writing on arrival exists to avoid. A scaffold's lesson has no exercise half at all, because a scaffold builds nothing and so has no branch and no test. This entry also records the reciprocal links from slice-identity and plan-field-ownership.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
