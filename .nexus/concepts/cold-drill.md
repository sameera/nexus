---
title: "Cold Drill"
aliases: ["spaced recall", "opening drill", "concept history", "hint ranking", "overdue concept", "eligible concept"]
touches: ["teaching-session", "just-in-time-lesson", "learner-folder", "widget-seam", "reference-page"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Cold Drill

Cold Drill is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [teaching-session](teaching-session.md) — the chain that picks the drill before it writes anything new.
- [just-in-time-lesson](just-in-time-lesson.md) — the lesson the drill opens, which also asks again about concepts the drill may not carry.
- [learner-folder](learner-folder.md) — where the hint counts live, the one personal signal that ranks an already-eligible concept.
- [widget-seam](widget-seam.md) — the component the drill is built from, which withholds the answer until the learner asks.
- [reference-page](reference-page.md) — the concept a second drill earns a short page for, counted over this same drill history.

## Decision Log

### 2026-09-07 — #407 — Hints rank the drill, and coldness only makes a concept eligible

Coldness decides eligibility and hints decide the pick, which is what the story asks for: among concepts far enough back to be worth asking about, the learner is asked about the one they took more hints on. Ranking by coldness first honoured that only in the narrow case where two concepts were last mentioned in the same lesson. The history is read from the committed lessons rather than a personal record, so a teammate's checkout carries it and an empty learner folder changes nothing. Refuted alternative: keep coldness first and amend the story and the decision record to match the code. It is defensible as a spacing policy, but a scope edit to an approved story, made from the build, is the plan approver's act and not the implementer's.

### 2026-09-18 — #481 — Reciprocal link from reference-page

Mechanical reciprocity fan-out: a concept this drill picks for a second time, having already been drilled by an earlier written lesson, now earns a reference page. The earning is counted over the same drill history this page reads from the committed lessons, so it adds no personal record. How the drill is chosen is unchanged; hints still only rank a concept that coldness already made eligible.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
