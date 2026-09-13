---
title: "Plan Field Ownership"
aliases: ["field owner", "fixed field list", "no placeholder", "absent until its owner acts", "declared commands", "pinning test written on arrival"]
touches: ["teaching-plan", "plan-approval-gate", "return-verification", "just-in-time-lesson"]
last_updated_by: "#458"
status: active
verification: verified
---

# Plan Field Ownership

Every field of the committed plan has exactly one owner. Approval fills in what the issue graph and the workspace already know, the reviewer declares the two commands, and the session writes a slice's pinning test when the learner arrives at that slice. A field whose owner has not acted yet is absent rather than filled with a placeholder, because the session acts on whatever value it finds.

## How It Works

Approval owns the facts: each story's state read live from the issue graph at that moment, the lesson names, the branches, each slice's epic, the dependency edges and the repository. The reviewer owns the command that runs the suite and the command that grades one exercise. The session owns each pinning test, and the reader requires one only on the slices the session has already reached.

Producing every pinning test at approval was refused. It means writing a test for every story on the roadmap from story text the planning session never holds, at a gate that deliberately shows no prose, so nobody reviews them — and they go stale before the learner reaches them, which is the whole reason a lesson is written on arrival.

The plan is built field by field from a fixed list rather than copied from the draft and stripped of what must not travel. A fixed list fails closed: a field added to the draft later reaches no committed file until someone adds it to the list on purpose. A strip list fails open, and a leak into a committed file cannot be undone.

## Key Invariants

1. Approval fills in the pinned states, the lesson names, the branches, each slice's epic, the dependency edges and the repository.
2. The reviewer declares the suite and grading commands as argument lists, never inferred, and approval refuses without them.
3. The session writes each pinning test when the learner arrives at its slice, and a test once written is never rewritten.
4. No field holds a placeholder; a field whose owner has not acted is absent.
5. The reader requires a field only on the slices the session has reached.
6. The committed plan is built from a fixed list of fields, never copied from the draft and stripped.
7. No interview answer, declared phrase, unmatched phrase, focus word or verdict reason reaches the plan, a lesson or a page.

## Integration Points

- [teaching-plan](teaching-plan.md) — the committed contract whose every field this ownership assigns, and whose reader enforces the absent-not-placeholder rule.
- [plan-approval-gate](plan-approval-gate.md) — the step that fills the approval-owned fields and refuses a first approval with no declared commands.
- [return-verification](return-verification.md) — runs the reviewer's declared suite and grading commands, and probes the tests the session wrote.
- [just-in-time-lesson](just-in-time-lesson.md) — the arrival that writes a slice's pinning test, alongside the lesson that shows its text.

## Decision Log

### 2026-09-13 — #458 — Each field has one owner, and the plan is built from a fixed list rather than a stripped copy

The shipped session refuses a slice missing a lesson name, a branch or a pinning test, and no planning pass produced any of them, so this epic had to say who fills each in. Approval fills what is already known — the live pinned states, the names derived from each slice's identity, each slice's epic, the edges and the repository. The reviewer declares the two commands, because a green light is worth exactly what the command behind it is worth and inferring one was already refused. The session writes each pinning test on arrival, which amends the earlier rule that a session has exactly one generative step: a handoff arrival now writes test text too. Nothing is ever a placeholder, so a field whose owner has not acted is simply absent and the reader requires it only where the session has reached. The plan is assembled from a fixed list of fields rather than copied from the draft and stripped, because the draft carries the learner's own phrases for the gate. Refuted alternative: copy the draft and remove the known personal fields, which is less upkeep — a new planning field reaches the plan with no change. It lost because it fails open, and a leak of the learner's words into a committed file cannot be undone. Refuted alternative: generate every pinning test at approval, which leaves the plan whole at approval and needs no step on arrival; it lost because it is speculative generation at the scale of the roadmap, at a gate where nobody reviews prose.
