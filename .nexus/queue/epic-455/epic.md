---
feature: "Roadmap-Driven Learning"
feature_path: docs/features/roadmap-driven-learning
epic: "A roadmap resolves, and an interview establishes the learner's starting point and focus"
slug: roadmap-resolution-and-learner-interview
created: 2026-09-07
type: enhancement
complexity: M
complexity_drivers: [two resolution entry points over one issue graph, an interview whose two answers every later phase reads, phase-scoped instruction loading]
concepts: []
link: "#455"
record: "#478"
record_state: closed
---

# Epic: A roadmap resolves, and an interview establishes the learner's starting point and focus

## Description

The teaching stage cannot plan anything until it knows three things. It has to know which stories the learner is going to work through. It has to know what that person already understands. It has to know what they came here to learn. This epic builds the entry that establishes all three, and it builds nothing that consumes them.

The first of the three is already written down. The stories, their bodies and the dependency edges between them live on the issue graph, so a roadmap is resolved from there rather than authored by hand. Resolution takes either one epic issue or a backlog query, which is what lets the same stage serve one epic and a whole programme of epics without a second entry point.

The other two are not written down anywhere, and no amount of reading the repository will produce them. Nothing in a checkout records what the person reading it already understands, and nothing in it records why they opened it. So the stage asks, once, in a bounded interview. Both questions go to the same person, so they go in the same pass. Every later phase reads both answers, which means splitting the interview in two would buy nothing and would make the learner answer twice.

The last piece is what the stage loads while it does this. Planning a roadmap and writing a lesson need different reference material, and a session that held both would be holding the material a lesson is written from while it is still ordering concepts. So the stage's instructions load by phase, and a planning session carries the planning references and none of the lesson-writing ones.

## Success Metrics

- A roadmap resolved from a backlog query naming several epics orders the stories of every one of those epics together.
- A learner answers one interview per roadmap, and no later phase asks either question a second time.
- The references loaded by a planning session contain no lesson-writing reference.
- A stage run against an issue that is not an epic asks the learner nothing.

## Personas

Per `docs/product/context.md`. The learner in this epic is the canonical primary persona, here in the role of someone about to be taught rather than someone running the delivery pipeline.

## Smallest Usable Version

A roadmap resolves from an epic issue or a backlog query; A bounded interview establishes what the learner already knows; The same interview establishes what the learner came to learn.

## User Stories

### Story #471: A roadmap resolves from an epic issue or a backlog query

- **story_type:** system
- **size:** M

**As a** learner starting a workbook, **I want** the stage to work out my roadmap from the issues that already exist, **so that** I do not restate a plan the team has already filed.

## Acceptance Criteria

- [ ] **Given** an epic issue number, **when** the stage resolves the roadmap, **then** the roadmap holds that epic's stories in an order the dependencies between them allow.
- [ ] **Given** a backlog query that returns several epics, **when** the stage resolves the roadmap, **then** the roadmap holds the stories of every epic the query returned and orders them across all of those epics together.
- [ ] **Given** a resolved roadmap, **when** a later phase reads it, **then** it finds each story's body and each dependency edge in the roadmap itself.
- [ ] **Given** an issue number that names something other than an epic, **when** the stage resolves the roadmap, **then** the stage stops, says why that number cannot be a roadmap, and asks the learner nothing.

## Notes

Resolution reads the issue graph because the graph is where the roadmap already is. This story does not extract concepts from a story body and does not mark any story as one the learner builds; both are planned separately.

### Story #472: A bounded interview establishes what the learner already knows

- **story_type:** user
- **size:** M

**As a** learner, **I want** to be asked once what I already understand, **so that** the plan does not teach me things I know and does not assume knowledge I lack.

## Acceptance Criteria

- [ ] **Given** a resolved roadmap, **when** the stage runs its interview, **then** the interview asks what the learner already knows and stops after at most five questions.
- [ ] **Given** a resolved roadmap, **when** the interview runs, **then** it asks about none of the stories, story bodies or dependency edges the roadmap already holds.
- [ ] **Given** a completed interview, **when** a later phase needs the learner's starting point, **then** it reads the starting point that interview recorded and the learner is not asked again.
- [ ] **Given** a question the learner leaves unanswered, **when** the interview ends, **then** the recorded starting point marks that question unanswered rather than recording that the learner knows nothing about it.

## Notes

Bounded means the interview asks a small fixed number of questions and stops. It does not walk the roadmap concept by concept. Five is the ceiling this epic sets; it is not stated in the source. What the recorded starting point is later used for is subtracting known concepts from each slice, and that belongs to a later epic.

### Story #473: The same interview establishes what the learner came to learn

- **story_type:** user
- **size:** S

**As a** learner on a roadmap that also builds things I did not come here to build, **I want** to say what I came to learn, **so that** I spend my time on that and not on the rest of the roadmap.

## Acceptance Criteria

- [ ] **Given** the interview establishing the learner's starting point, **when** it runs, **then** it establishes the focus in the same pass and the learner answers one interview rather than two.
- [ ] **Given** a roadmap that carries work outside what the learner came to learn, **when** the interview ends, **then** the recorded focus names what the learner came to learn and leaves the rest of the roadmap outside it.
- [ ] **Given** a learner who names no focus, **when** the interview ends, **then** the whole roadmap is recorded as within the focus.

## Notes

This story adds the second question to the interview #472 builds, so it ships after #472 rather than beside it. What it delivers on its own is the recorded focus and the default that applies when the learner names none. Marking each slice against that focus, and deciding which slices are handed off, is the most consequential judgement the stage makes and is planned separately.

### Story #474: The stage's instructions load by phase

- **story_type:** system
- **size:** S

**As a** learner planning a roadmap, **I want** the stage to load only the references the phase it is in needs, **so that** the session ordering concepts is never also holding the material a lesson would be written from.

## Acceptance Criteria

- [ ] **Given** a planning session, **when** the stage loads its instructions, **then** it loads the planning references and none of the lesson-writing ones.
- [ ] **Given** a lesson-writing session, **when** the stage loads its instructions, **then** it loads the lesson-writing references.
- [ ] **Given** a session that finishes one phase and begins the next, **when** the next phase runs, **then** it runs as a new invocation whose declared reference set excludes the references only the finished phase needed.

## Notes

The stage's instructions are the references it loads, and "instructions" and "references" name the same thing throughout this epic. Loading them by phase means each phase declares its own set and the stage loads that set alone.

The third criterion above was re-filed on invocation-boundary terms, as decision record #478 requires. As originally filed it asked that references the finished phase needed "are no longer loaded", which nothing can satisfy: a context window only appends, so within one session a loaded reference cannot be unloaded by any mechanism other than ending the session. The phase boundary is therefore the invocation boundary, and what is checkable is each entry point's declared reference set.

## Assumptions

- The roadmap's epics and stories are already filed as issues, and this stage files none of its own.
- The learner runs the stage in a checkout of the repository the roadmap belongs to.
- The two interview answers are retained in the workbook that epic #405 builds, so a later session reads them without re-asking.

## Out of Scope

- Extracting concepts from a story, and marking a slice as one the learner builds or one handed off — planned as #456.
- Subtraction, ordering, slice splitting, scaffold insertion and the coverage check — planned as #457.
- The gate that approves the plan, and the home page the approved plan renders as — planned as #458.
- Pinning a stub's sources when its epic is promoted — planned as #459.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #471 | none |
| #472 | #471 |
| #473 | #472 |
| #474 | none |
