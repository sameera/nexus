---
title: "Teaching Plan"
aliases: ["plan of slices", "slice", "pinned story state", "declared suite command", "grading command", "control test", "handoff slice", "lesson stub"]
touches: ["workbook-store", "teaching-session", "plan-drift-gate", "just-in-time-lesson", "return-verification", "handoff-prompt", "plan-draft"]
last_updated_by: "#456"
status: active
verification: verified
---

# Teaching Plan

One file describes everything a workbook teaches from: the order of the slices, the story each slice builds, whether the learner builds it or a coding agent does, the state that story was pinned to at approval, the concepts, the branch, and the pinning test the learner writes first. The same file declares the commands that run the suite and grade one exercise, because nothing infers them. A slice whose lesson is not yet written is a stub, which under just-in-time writing is the normal state.

## How It Works

Two committed documents describing one plan can disagree, with nothing in a position to notice, so the pinned state lives beside the order rather than in a document of its own. The plan is written by hand, so the session that reads it can be used and tested before the stage that produces it exists.

A slice the learner does not build names no lesson at all, and never enters the reading order: a lesson for it would be a stub that never becomes a page, and the navigation would advertise a lesson that will never exist.

Nothing infers the commands. A green light is worth exactly what the command behind it is worth, and an inferred command that runs only part of the suite makes the gate decorative while still looking like a gate. The plan may also declare one control test, written to pass in this repository's own stack, proving the grading command can run a single test file on its own.

## Key Invariants

1. One file holds the order, the story, the learner-or-handoff mark, the pinned state, the concepts, the branch and the pinning test.
2. The pinned state lives beside the order, never in a second document.
3. A slice the learner does not build names no lesson, and it never enters the workbook's reading order.
4. The workbook declares the command that runs its suite and the command that grades one exercise; nothing infers either.
5. The grading command is given the test file to run as its last argument.
6. A slice whose lesson is not yet written is a stub, and the navigation names it as not yet written rather than linking to a page that does not exist.
7. The plan is written by hand, so it works before the stage that produces it exists.

## Integration Points

- [workbook-store](workbook-store.md) — the store the plan sits in, whose reading order it supplies.
- [teaching-session](teaching-session.md) — the session that walks these slices and may run only the commands declared here.
- [plan-drift-gate](plan-drift-gate.md) — the check that compares a story's live state against the state pinned here.
- [just-in-time-lesson](just-in-time-lesson.md) — the lesson written into a slice, whose exercise names facts taken only from here.
- [return-verification](return-verification.md) — the suite, grading and control commands it runs, all declared here.
- [handoff-prompt](handoff-prompt.md) — the prompt for a handoff slice, rendered from the marks, pinned text and sibling list held here.
- [plan-draft](plan-draft.md) — the uncommitted draft of stubs a planning pass writes, which approval turns into this plan.

## Decision Log

### 2026-09-07 — #407 — The plan is one file of slices, and a handoff slice names no lesson

The order, the pinned state, the marks, the concepts, the branch and the pinning test all live in the one plan file, because two committed documents describing one plan can disagree with nothing in a position to notice. A handoff slice declares no lesson, so it never enters the reading order: a lesson for it would be a stub that never becomes a page, and the navigation would advertise a lesson that will never exist. The suite and grading commands are declared rather than inferred, since an inferred command that runs part of the suite makes the gate decorative while still looking like a gate. Refuted alternative: a separate teaching plan beside the existing plan file. It separates what the renderer orders from what the session teaches, and it would leave the earlier renderer's contract untouched, but it is exactly the two-documents-describing-one-plan shape this decision refuses.

### 2026-09-11 — #456 — Reciprocal link from plan-draft

A planning pass now produces this plan's slices, as stubs in an uncommitted draft that approval turns into the committed plan. The contract here is unchanged by that: a stub adopts these field names rather than defining a second set, and the one thing it adds beside them — the concepts a slice assumes — is a field the readers here ignore.
