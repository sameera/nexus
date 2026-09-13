---
feature: "Roadmap-Driven Learning"
feature_path: docs/features/roadmap-driven-learning
epic: "The rest of the shared component library, and the answer-checking it needs"
slug: component-library-answer-checking
created: 2026-09-08
type: enhancement
complexity: M
complexity_drivers: [three stories of which two consume a capability the first introduces, a kind of interaction the shipped runtime has never had, every component must print completely when the learner never touched it]
concepts: []
link: "#480"
record: "#616"
record_state: closed
---

# Epic: The rest of the shared component library, and the answer-checking it needs

## Description

The shared component library holds one component. Predict-then-reveal shows a question, hides an answer, and reveals the answer when the learner asks for it. Three more components have been asked for by two lessons each, and all three ask the learner for an answer rather than merely showing them one. Nothing in the library can tell a learner whether an answer is right, because the shipped runtime changes what is visible and does nothing else. This epic builds the three components and the answer-checking they need.

The answer-checking arrives with the smallest of the three. Fill-the-signature asks the learner to type a function's signature and compares what they typed against the expected shape, so it is the component that needs the least around it. Building the checking there means the Parsons problem and the trace stepper consume it rather than each growing a copy. A learner then meets one way of asking to be checked and one way of being told the result, across all three exercises.

Two constraints from the workbook shape every component here. A page is opened from a file, so it can make no network request and it has nowhere to store anything. The expected answer therefore sits in the page from the moment the page is written, exactly as predict-then-reveal's answer already does, and nothing the learner types survives closing the page. A page is also printed, so an exercise nobody touched has to put its question and its expected answer on the paper.

## Success Metrics

- Every exercise in the library that asks the learner for an answer tells them whether the answer is right.
- The way a learner asks to be checked, and the way the result is shown, is the same in all three exercises.
- A learner with no network completes and checks every exercise on a page.
- An exercise of any of the three kinds, never touched, prints with its question and its expected answer on the paper.
- A learner who closes and reopens a page finds nothing they typed earlier.

## Personas

Per `docs/product/context.md`. The learner in this epic is the canonical primary persona. That engineer is working through a workbook page here rather than running the pipeline.

## Smallest Usable Version

Fill-the-signature checks a typed answer, and the library learns to check answers.

## User Stories

### Story #517: Fill-the-signature checks a typed answer, and the library learns to check answers

**As a** learner working through a lesson, **I want** to type the signature I think a function should have and be told whether I got it right, **so that** I find out what I actually knew instead of grading myself.

## Acceptance Criteria

- [ ] **Given** a lesson declaring a fill-the-signature exercise, **when** the learner opens the page, **then** the prompt and an empty answer field are visible and the expected answer is not.
- [ ] **Given** a typed answer, **when** the learner asks for it to be checked, **then** the page says whether the answer matches the expected one, on a machine with no network.
- [ ] **Given** an answer differing from the expected one only in spacing, **when** the learner asks for it to be checked, **then** it is accepted.
- [ ] **Given** a fill-the-signature exercise the learner never touched, **when** the page is printed, **then** the prompt and the expected answer both appear on the paper.
- [ ] **Given** a learner who closes and reopens the page, **when** it opens, **then** no answer they typed earlier is present.

## Notes

This is the smallest of the three components, and it is where the answer-checking every later component uses is built. #518 and #519 consume that checking rather than building one each.

### Story #518: Parsons problems order shuffled lines into a working function or test

**As a** learner working through a lesson, **I want** to put shuffled lines into the order that makes them work and be told whether the order is right, **so that** I practise the shape of a solution without typing every character of it.

## Acceptance Criteria

- [ ] **Given** a lesson declaring a Parsons problem, **when** the learner opens the page, **then** the lines are visible in an order that is not the expected one.
- [ ] **Given** the shuffled lines, **when** the learner moves a line, **then** the order changes and no line is lost or duplicated.
- [ ] **Given** an order the learner has settled on, **when** they ask for it to be checked, **then** the page says whether the order matches the expected one.
- [ ] **Given** a Parsons problem the learner never touched, **when** the page is printed, **then** every line and the expected order both appear on the paper.

## Notes

The shuffle is fixed when the page is written, because a page opened from a file has nothing to shuffle with at opening time and a learner who reloads should meet the same problem.

The answer-checking this story uses is built in #517 and is consumed here unchanged.

### Story #519: The trace stepper walks a snippet beside its changing state

**As a** learner working through a lesson, **I want** to predict what a snippet's state will be at a line before I step to it, **so that** I learn to read code by running it in my head rather than by skimming it.

## Acceptance Criteria

- [ ] **Given** a lesson declaring a trace stepper, **when** the learner opens the page, **then** the snippet is visible with its first step's line marked as the current one and the state at that line shown beside it.
- [ ] **Given** a marked line, **when** the learner steps forward, **then** the mark moves to the line the next step names and the state shown beside the snippet is the state after that step.
- [ ] **Given** a step the lesson attached a question to, **when** the learner answers it and asks for it to be checked, **then** the page says whether the answer is right before the step is taken.
- [ ] **Given** a trace stepper the learner never touched, **when** the page is printed, **then** every line of the snippet and the state at every step appear on the paper.

## Notes

Every step's state is in the page when the page is written, so stepping changes what is visible and computes nothing.

The answer-checking this story uses is built in #517 and is consumed here unchanged.

## Assumptions

- The workbook store, the renderer that writes a page, the runtime a page loads and the seam that resolves a declared component all already exist, so this epic puts components into a library rather than building the place they live.
- A page is opened from a file with nothing running, so every component here works with no network and keeps nothing between openings.
- Answer-checking is built once in Story 1 and consumed unchanged by Stories 2 and 3.
- The lessons that asked for these three components declare them by name and supply their data, so this epic builds the components and not the lessons that use them.

## Out of Scope

- A fourth component. Each of these three was asked for by two lessons, and a component asked for once is not built here.
- Recording what a learner answered, and grading their work across a lesson.
- The concept reference pages and the glossary a learner returns to.
- Writing the prose of any lesson that declares one of these components.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #517 | none |
| #518 | #517 |
| #519 | #517 |
