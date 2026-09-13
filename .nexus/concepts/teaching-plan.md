---
title: "Teaching Plan"
aliases: ["plan of slices", "slice", "pinned story state", "declared suite command", "grading command", "control test", "handoff slice", "lesson stub", "committed plan", "dependency edges", "per-slice epic"]
touches: ["workbook-store", "teaching-session", "plan-drift-gate", "just-in-time-lesson", "return-verification", "handoff-prompt", "plan-draft", "scaffold-slice", "slice-identity", "plan-approval-gate", "plan-field-ownership", "plan-re-approval", "workbook-home-page"]
last_updated_by: "#458"
status: active
verification: verified
---

# Teaching Plan

One file describes everything a workbook teaches from: the order of the slices, what each one builds, whether the learner builds it or a coding agent does, and everything the session needs to teach it. The same file declares the commands that run the suite and grade one exercise, because nothing infers them. A slice whose lesson is not yet written is a stub, which under just-in-time writing is the normal state.

## How It Works

Two committed documents describing one plan can disagree, with nothing in a position to notice, so the pinned state lives beside the order rather than in a document of its own.

A slice the learner does not build names no lesson at all, and never enters the reading order: a lesson for it would be a stub that never becomes a page, and the navigation would advertise a lesson that will never exist.

Nothing infers the commands. A green light is worth exactly what the command behind it is worth, and an inferred command that runs only part of the suite makes the gate decorative while still looking like a gate. The plan may also declare one control test, written to pass in this repository's own stack, proving the grading command can run a single test file on its own.

## Key Invariants

1. ~~One file holds the order, the story, the learner-or-handoff mark, the pinned state, the concepts, the branch and the pinning test.~~ One file holds the order and, for each slice, everything that slice is taught from.
2. The pinned state lives beside the order, never in a second document.
3. A slice the learner does not build names no lesson, and it never enters the workbook's reading order.
4. The workbook declares the command that runs its suite and the command that grades one exercise; nothing infers either.
5. The grading command is given the test file to run as its last argument.
6. A slice whose lesson is not yet written is a stub, and the navigation names it as not yet written rather than linking to a page that does not exist.
7. ~~The plan is written by hand, so it works before the stage that produces it exists.~~ The approval gate writes the plan, and a hand-written one still reads.

## Integration Points

- [workbook-store](workbook-store.md) — the store the plan sits in, whose reading order it supplies.
- [teaching-session](teaching-session.md) — the session that walks these slices and may run only the commands declared here.
- [plan-drift-gate](plan-drift-gate.md) — the check that compares a story's live state against the state pinned here.
- [just-in-time-lesson](just-in-time-lesson.md) — the lesson written into a slice, whose exercise names facts taken only from here.
- [return-verification](return-verification.md) — the suite, grading and control commands it runs, all declared here.
- [handoff-prompt](handoff-prompt.md) — the prompt for a handoff slice, rendered from the marks, pinned text and sibling list held here.
- [plan-draft](plan-draft.md) — the uncommitted draft of stubs a planning pass writes, which approval turns into this plan.
- [scaffold-slice](scaffold-slice.md) — a slice with no story, which this contract now admits as a slice with no epic, no branch and no pinning test.
- [slice-identity](slice-identity.md) — how each slice in this file is named, and why its lesson and branch come from that name rather than its position.
- [plan-approval-gate](plan-approval-gate.md) — the one checkpoint that turns a draft into this file, and refuses to write it from a draft nobody read.
- [plan-field-ownership](plan-field-ownership.md) — who fills each field here, and why a field whose owner has not acted is absent rather than a placeholder.
- [plan-re-approval](plan-re-approval.md) — the pass that replaces this file after a story drifts, carrying the taught slices forward unchanged.
- [workbook-home-page](workbook-home-page.md) — the page drawn from the dependency edges this file records, which is why approval writes them here.

## Decision Log

### 2026-09-07 — #407 — The plan is one file of slices, and a handoff slice names no lesson

The order, the pinned state, the marks, the concepts, the branch and the pinning test all live in the one plan file, because two committed documents describing one plan can disagree with nothing in a position to notice. A handoff slice declares no lesson, so it never enters the reading order: a lesson for it would be a stub that never becomes a page, and the navigation would advertise a lesson that will never exist. The suite and grading commands are declared rather than inferred, since an inferred command that runs part of the suite makes the gate decorative while still looking like a gate. Refuted alternative: a separate teaching plan beside the existing plan file. It separates what the renderer orders from what the session teaches, and it would leave the earlier renderer's contract untouched, but it is exactly the two-documents-describing-one-plan shape this decision refuses.

### 2026-09-11 — #456 — Reciprocal link from plan-draft

A planning pass now produces this plan's slices, as stubs in an uncommitted draft that approval turns into the committed plan. The contract here is unchanged by that: a stub adopts these field names rather than defining a second set, and the one thing it adds beside them — the concepts a slice assumes — is a field the readers here ignore.

### 2026-09-12 — #457 — Reciprocal link from scaffold-slice

The draft now admits a slice with no story. This committed contract was deliberately left unchanged and still refuses such a slice, because admitting one means deciding what a scaffold's branch, pinning test and lesson are, and that decision belongs to the approval stage.

### 2026-09-13 — #458 — The committed contract admits scaffolds and split parts, records each slice's epic and edges, and is written by the gate

The contract was deliberately left refusing a slice with no story, because admitting one meant deciding what a scaffold's branch, pinning test and lesson are — and that decision belonged to approval. Approval is now built, so the contract admits both storyless scaffolds and the parts of a split story. Three things were added to a slice beside them: the epic its story belonged to at approval, which is what a handoff prompt names; the slices it depends on, which are the only source of the edges the home page draws; and the right to carry no pinning test at all until the session reaches the slice. A story with no description now pins an empty body rather than being refused, because an empty description is that story's real state and refusing it would block a legitimate roadmap over a field nobody chose. The plan-wide epic became a fallback rather than what a prompt names, kept only so hand-written single-epic plans keep reading. Refuted alternative: refuse any slice without its own epic, which is simpler to reason about; it lost because it breaks every single-epic plan written before this change. This entry also records the reciprocal links from slice-identity, plan-approval-gate, plan-field-ownership, plan-re-approval and workbook-home-page, each of which names this file as the contract it writes, reads or is filed against.
