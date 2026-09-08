---
title: "Cold Drill"
aliases: ["spaced recall", "opening drill", "concept history", "hint ranking", "overdue concept", "eligible concept"]
touches: ["teaching-session", "just-in-time-lesson", "learner-folder", "widget-seam"]
last_updated_by: "#407"
status: active
verification: verified
---

# Cold Drill

A session opens by asking about a concept the learner met a while back, before it teaches anything new. Which concepts they have met, when they met them, and which have already been drilled all come from the lessons already written, so the history is committed and a teammate's checkout holds it. The learner's own folder contributes exactly one signal on top of that: how many hints they took on a concept.

## How It Works

Coldness decides which concepts are eligible, and hints decide which eligible concept is picked. A concept whose most recent mention is the lesson the learner has just finished is not a cold recall, so it is never the drill. Among the concepts that are cold enough, the one the learner took most hints on wins, because that is the one they are struggling with. Ties go to the concept whose last mention is furthest back, then to the concept's name, so the same history and the same hint counts always produce the same pick.

A first session behaves correctly without a special case, because an empty concept history and an empty hint log are inputs the ranking already handles. A hint log that cannot be read is reported and skipped rather than failing the session, and the ranking falls back to the most overdue concept.

The drill appears as an exercise on the page rather than as a question in the session's transcript. The page reads offline and prints; a transcript does neither.

## Key Invariants

1. A drill is never on a concept the learner met in the lesson they have just finished.
2. Coldness decides which concepts are eligible; hints taken decide which eligible concept is picked.
3. Ties go to the concept whose last mention is furthest back, then to its name, so the pick is deterministic.
4. A learner who has met no concept yet is offered no drill, and the session goes straight to the lesson.
5. The concept history comes from the written lessons, never from a personal record.
6. A hint log that cannot be read is reported and skipped, and the ranking falls back to the most overdue concept.
7. The drill appears on the page as an exercise, never only in the session's transcript.

## Integration Points

- [teaching-session](teaching-session.md) — the chain that picks the drill before it writes anything new.
- [just-in-time-lesson](just-in-time-lesson.md) — the lesson the drill opens, which also asks again about concepts the drill may not carry.
- [learner-folder](learner-folder.md) — where the hint counts live, the one personal signal that ranks an already-eligible concept.
- [widget-seam](widget-seam.md) — the component the drill is built from, which withholds the answer until the learner asks.

## Decision Log

### 2026-09-07 — #407 — Hints rank the drill, and coldness only makes a concept eligible

Coldness decides eligibility and hints decide the pick, which is what the story asks for: among concepts far enough back to be worth asking about, the learner is asked about the one they took more hints on. Ranking by coldness first honoured that only in the narrow case where two concepts were last mentioned in the same lesson. The history is read from the committed lessons rather than a personal record, so a teammate's checkout carries it and an empty learner folder changes nothing. Refuted alternative: keep coldness first and amend the story and the decision record to match the code. It is defensible as a spacing policy, but a scope edit to an approved story, made from the build, is the plan approver's act and not the implementer's.
