---
title: "Trace Stepper"
aliases: ["trace stepper", "step gating", "predict before step"]
touches: ["answer-check", "component-refusal"]
last_updated_by: "#480"
status: active
verification: verified
---

# Trace Stepper

The trace stepper walks a learner through a code snippet one step at a time, showing the state beside the line each step names. A step that carries a question blocks stepping forward until the learner checks their answer, right or wrong, before the state at that step is shown. Every line and every step's state is written into the page at render time, so stepping only changes what is visible.

## How It Works

Every step names a line number and the state after that line has run, so a trace can follow a loop or a branch instead of only a straight line, and stepping forward always moves the mark to the exact line the next step names rather than merely to the next line down. The first step never carries a question, because the page opens on that step before any check could have happened. A step's question is its own checkable answer, checked by the shared mechanism and nothing this component adds; the stepper only asks whether that check has happened, never what the check compared. Stepping is blocked until the current step's question, if it has one, has been checked, and once checked the learner can step forward whether the answer was right or wrong. Stepping only ever moves forward. An untouched trace stepper prints every line of the snippet, the state at every step, and every question's expected answer, because nothing here is computed when the page is read.

## Key Invariants

1. Every step's line and state are written into the page at render time; stepping only changes what is visible.
2. Stepping moves the mark to the exact line the next step names.
3. A step carrying a question blocks stepping forward until that question has been checked, right or wrong.
4. The first step never carries a question.
5. Stepping only moves forward.
6. A step's question is checked by the shared checking mechanism; the stepper only asks whether the check happened.
7. An untouched trace stepper prints every line, every step's state, and every question's expected answer.

## Integration Points

- [answer-check](answer-check.md) — checks a step's question, unchanged.
- [component-refusal](component-refusal.md) — fails the whole render when a step names a line the snippet does not have, or a question with no expected answer.

## Decision Log

### 2026-09-13 — #480 — A step's question belongs to that step and gates on being checked, not on being right

Decision record #616 amends story #519's acceptance criteria: stepping forward moves the mark to the line the next step names, not merely one line further, so a trace can follow a loop or a branch. A question belongs to the step it asks about and is visible while the learner is one step before it, and stepping past it is blocked until it has been checked, right or wrong, rather than until the learner gets it right; a learner who cannot get a question right would otherwise be trapped unable to continue. Refuted alternative: keeping every passed question and its result visible beneath the snippet as the learner advances. It would give the learner a running record of their answers, but it shows one visible question at a time and computes nothing beyond what the current step needs, and a running record is state this component does not otherwise keep.
