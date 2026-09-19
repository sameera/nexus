---
title: "Plan Field Ownership"
aliases: ["field owner", "fixed field list", "no placeholder", "absent until its owner acts", "declared commands", "pinning test written on arrival"]
touches: ["teaching-plan", "plan-approval-gate", "return-verification", "just-in-time-lesson", "pinned-sources"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Plan Field Ownership

Plan Field Ownership is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [teaching-plan](teaching-plan.md) — the committed contract whose every field this ownership assigns, and whose reader enforces the absent-not-placeholder rule.
- [plan-approval-gate](plan-approval-gate.md) — the step that fills the approval-owned fields and refuses a first approval with no declared commands.
- [return-verification](return-verification.md) — runs the reviewer's declared suite and grading commands, and probes the tests the session wrote.
- [just-in-time-lesson](just-in-time-lesson.md) — the arrival that writes a slice's pinning test, alongside the lesson that shows its text.
- [pinned-sources](pinned-sources.md) — the field the design stage owns, filled when the epic's decision record is approved.

## Decision Log

### 2026-09-13 — #458 — Each field has one owner, and the plan is built from a fixed list rather than a stripped copy

The shipped session refuses a slice missing a lesson name, a branch or a pinning test, and no planning pass produced any of them, so this epic had to say who fills each in. Approval fills what is already known — the live pinned states, the names derived from each slice's identity, each slice's epic, the edges and the repository. The reviewer declares the two commands, because a green light is worth exactly what the command behind it is worth and inferring one was already refused. The session writes each pinning test on arrival, which amends the earlier rule that a session has exactly one generative step: a handoff arrival now writes test text too. Nothing is ever a placeholder, so a field whose owner has not acted is simply absent and the reader requires it only where the session has reached. The plan is assembled from a fixed list of fields rather than copied from the draft and stripped, because the draft carries the learner's own phrases for the gate. Refuted alternative: copy the draft and remove the known personal fields, which is less upkeep — a new planning field reaches the plan with no change. It lost because it fails open, and a leak of the learner's words into a committed file cannot be undone. Refuted alternative: generate every pinning test at approval, which leaves the plan whole at approval and needs no step on arrival; it lost because it is speculative generation at the scale of the roadmap, at a gate where nobody reviews prose.

### 2026-09-17 — #459 — Reciprocal link from pinned-sources

A plan slice gained one more field, the sources its lesson is written from. Neither approval nor the session could own the field, because the material comes from a decision record that exists only after the slice's epic is designed. So the design stage owns the field and fills it when the record is approved. Until then the field is absent, which follows the existing no-placeholder rule. Refuted alternative: have close fill the field. It lost because close waits for every story to merge, and a lesson is written before its story is built. The body here is unchanged because it sits at the word cap. The pinned-sources page states the ownership rule in full.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
