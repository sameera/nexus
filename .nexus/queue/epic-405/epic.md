---
feature: "Roadmap-Driven Learning"
feature_path: docs/features/roadmap-driven-learning
epic: "The workbook store, and the renderer that turns lesson markdown into pages"
slug: workbook-store-and-renderer
created: 2026-09-06
type: enhancement
complexity: L
complexity_drivers: [six stories across two independent halves, three of them M, a new committed store the distiller must not read, a rendering seam every later teaching stage writes against]
concepts: []
link: "#405"
record: "#450"
record_state: closed
---

# Epic: The workbook store, and the renderer that turns lesson markdown into pages

> ⚠️ **Utilization risk:** assessed L (1–2 weeks). Fills the sprint with no slack for overruns. Watch for scope creep.

## Description

A workbook is a committed folder a learner opens in a browser. That folder is the workbook store: it holds the lesson pages, and under the learner's folder it holds everything the workbook retains about one person. This epic builds the two things every later teaching stage stands on: the store itself, and the code that turns an authored lesson into a page. Neither exists yet, and both are foundations rather than features — a lesson written before them has nowhere to live and nothing to render it.

The renderer matters because of what it removes. Markup is mechanical, and generating it costs several times the tokens the prose it wraps costs. That waste recurs on every lesson anyone ever writes. Moving the markup into code pays it once, and buys three things a generated page cannot have: the output is testable, it is identical across pages, and it cannot drift as lessons accumulate.

The store matters because of what it separates. A workbook is committed, so the team shares it. What a workbook retains about one person — what they have learned, how far they got, where they asked for a hint — is committed by the same act, and a repository may reasonably not want to commit a person's stumbles. Putting all of it under one parent folder makes excluding it a single line rather than an audit. The same folder holds the handoffs a session is waiting on, because a pause at a handoff can outlast the session that recorded it.

## Success Metrics

- A lesson author's output for one lesson is prose and front-matter, and the authored file contains no page markup.
- A behavioural diff over a commit range that changes workbook files reports no workbook file.
- A repository that excludes the learner's folder still shares every lesson page in the workbook.
- A rendered page opens and displays completely on a machine with no network.
- A learner who closes the workbook while a handoff is outstanding reopens it at the story that was handed off.

## Personas

Per `docs/product/context.md`. The learner in this epic is the canonical primary persona — an engineer on a small team, here in the role of someone reading a workbook rather than running the pipeline.

## Smallest Usable Version

The workbook store is committed, and no workbook file reaches the behavioural diff; A lesson's markdown and front-matter render to a page, and no agent writes the markup.

## User Stories

### Story #444: The workbook store is committed, and no workbook file reaches the behavioural diff

**As a** Nexus maintainer, **I want** the workbook store to live outside the queue and stay out of the behavioural diff, **so that** a learner's workbook never distorts what the distiller reads as shipped behaviour.

## Acceptance Criteria

- [ ] **Given** a repository with no workbook, **when** a workbook is created, **then** the workbook store is a committed folder outside the queue.
- [ ] **Given** a commit range whose commits change workbook files, **when** the behavioural diff for that range is derived, **then** no workbook file appears in it.
- [ ] **Given** a commit range that changes both workbook files and application source, **when** the behavioural diff is derived, **then** every application source change still appears in it.

## Notes

The queue and the discovery store are already withheld from the derived diff for the same reason: they are the distiller's input, not the behaviour it reads. The workbook is a third case of that rule, and whether it is a third exclusion or a shared convention is a decision-record question, not a scope question.

### Story #445: Everything retained per learner sits under one folder a single ignore rule excludes

**As a** repository owner, **I want** every record the workbook keeps about a person under the learner's folder, **so that** I can exclude a person's stumbles with one line and still share the workbook.

## Acceptance Criteria

- [ ] **Given** a learner with a concept ledger, progress, learning records and a hint log, **when** the workbook is inspected, **then** all four sit under one folder inside the workbook store — the learner's folder.
- [ ] **Given** the learner's folder is excluded by one ignore rule, **when** the repository is committed, **then** no per-learner record is committed and every lesson page still is.
- [ ] **Given** a workbook checked out with an empty learner's folder, **when** a learner opens it, **then** every page reads normally.

### Story #446: A paused workbook resumes at the handed-off story

**As a** learner, **I want** the workbook to remember the handoff I am waiting on, **so that** I come back to the story that was handed off instead of the start of the epic.

## Acceptance Criteria

- [ ] **Given** a session pauses at a handoff, **when** that handoff is recorded, **then** the record names the story that was handed off and is kept in the learner's folder with everything else.
- [ ] **Given** the session that recorded a handoff has ended, **when** the learner opens the workbook again, **then** it resumes at the story that was handed off rather than at the start.
- [ ] **Given** more than one handoff is outstanding, **when** the learner opens the workbook, **then** every outstanding handoff is listed.

## Notes

This story records the handoff and reads it back. What a handoff prompt says, and when a session decides to pause, belong to the session stage that writes them.

### Story #447: A lesson's markdown and front-matter render to a page, and no agent writes the markup

**As a** lesson author, **I want** the renderer to build the page from markdown and front-matter, **so that** writing a lesson costs the prose and nothing more.

## Acceptance Criteria

- [ ] **Given** a lesson authored as markdown carrying front-matter, **when** the workbook is rendered, **then** a page is produced that a learner opens in a browser, and the authored file contains no markup.
- [ ] **Given** two lessons authored months apart, **when** their pages are compared, **then** their chrome and their styling are identical.
- [ ] **Given** a rendered page, **when** it is viewed beside the project's existing documentation surfaces, **then** it presents the same colours and typography, and the workbook defines none of its own.

### Story #448: A widget declaration resolves to a component from a shared library

**As a** lesson author, **I want** a small declaration in the lesson to resolve to a working component, **so that** a lesson gains an interactive exercise without anyone writing markup for it.

## Acceptance Criteria

- [ ] **Given** a lesson carrying a widget declaration, **when** its page is rendered, **then** the declaration resolves to a component drawn from a library shared by every lesson.
- [ ] **Given** a declaration naming a component the library does not hold, **when** the workbook is rendered, **then** the render fails and names the missing component, rather than producing a page with a hole in it.
- [ ] **Given** a page carrying a widget the learner has not touched, **when** the page is printed, **then** the widget's content is on the paper rather than behind the interaction that would have revealed it.

## Notes

This story builds the seam and the library, not the components. The first component arrives with the session stage that asks for it. The page's print styling is the rendered-page story's to build; this story asserts only what printing means for something interactive.

### Story #449: A rendered page reads with no network and says it was generated

**As a** learner, **I want** a page that displays completely offline and declares where it came from, **so that** I can read a lesson anywhere and a reviewer knows to read the lesson instead of the page.

## Acceptance Criteria

- [ ] **Given** a rendered page, **when** it is opened on a machine with no network, **then** every asset it needs resolves and the page displays completely.
- [ ] **Given** a rendered page, **when** a reviewer reads the change that produced it, **then** the page states that it was generated and names the authored file it came from.
- [ ] **Given** a rendered page, **when** it is printed, **then** the lesson's content is readable on paper and the navigation chrome is not printed with it.

## Assumptions

- A workbook is read from the learner's own machine, so no page is served over a network.
- The renderer is code in the toolkit and is held to the toolkit's test discipline, so its output is asserted rather than reviewed by eye.
- The plan that names a workbook's lessons is produced by the planning stage; this epic renders what that plan and the lesson files already declare.
- The shared component library starts empty.

## Out of Scope

- Writing any lesson's prose, and deciding which lessons a workbook holds.
- The interactive components themselves, beyond the seam that resolves a declaration to one.
- The concept reference pages and the glossary a learner returns to.
- Grading, the hint ladder, and what a learning record contains; this epic gives them a home, not a behaviour.
- The handoff prompt's wording, and a session's decision to pause; this epic records an outstanding handoff and reads it back.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #444 | none |
| #445 | #444 |
| #446 | #445 |
| #447 | #444 |
| #448 | #447, #449 |
| #449 | #447 |
