---
feature: "Scope Discipline"
feature_path: docs/features/scope-discipline
epic: "The Record Checkpoint Reads as One Checklist"
slug: record-checkpoint-checklist
created: 2026-09-20
type: enhancement
complexity: M
complexity_drivers: [invariants and risks to surface from a record draft that never showed them, a reviewer-facing gate whose default must not move]
concepts: []
link: "#722"
record: "#725"
record_state: closed
---

# Epic: The Record Checkpoint Reads as One Checklist

## Description

The decision-record stage labels every invariant and every risk it drafts as either the lead's own or the model's, checks each label's quotation against the run's source text, and then strips the labels before filing. No human ever sees them. The stage's checkpoint renders one list, and that list holds the refuted alternatives only. So the provenance work on invariants and risks is spent and thrown away, which is the exact failure the razor names: a gate that does not show what the model added leaves the labelling as decoration.

The two razor gates also ask the reviewer to learn two idioms. At the planning gate a number flips a tick, in whichever direction that line is currently set. At the record checkpoint a number deletes. A lead who runs both stages in the same week reads "type 3" two ways.

This epic closes the first gap and removes the second idiom. The record checkpoint gets the planning gate's shape: one numbered checklist, every line carrying its tick, one typed selection covering the whole list. It keeps its own convention. Removal stays, so every line arrives ticked, because a refuted alternative is not scope and an invariant describes an epic whose scope the planning gate has already settled. There is no smaller usable record to default to. The alignment is in how the reviewer reads and acts, not in which direction the default points.

The stage also runs against a record that is already filed and approved, whose body is frozen. The list can therefore name content nobody can still change, and the checkpoint has to refuse that rather than edit a published body.

## Success Metrics

- A reviewer at the record checkpoint can see and untick every invariant and every risk the model added to the record. Today the checkpoint shows none of them.
- One typed number means the same thing at both razor gates: it flips exactly one line of a list whose ticks the reviewer read.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

The checkpoint shows every invariant and risk the model added; The checkpoint's list reads like the planning gate's

## User Stories

### Story #723: The checkpoint shows every invariant and risk the model added

- **story_type:** user
- **size:** M

**As a** delivery lead approving a decision record, **I want** the checkpoint to show me the invariants and risks the model wrote, **so that** I can throw out a constraint nobody asked for before it binds the build.

## Acceptance Criteria

- [ ] **Given** a drafted record, **when** the checkpoint renders, **then** every invariant the model added appears on the list as its own numbered line.
- [ ] **Given** the same record, **when** the checkpoint renders, **then** every risk the model added appears on the list as its own numbered line.
- [ ] **Given** a record carrying invariants or risks the lead asked for, **when** the checkpoint renders, **then** none of those appears on the list.
- [ ] **Given** a reviewer who names the number of one of those lines, **when** the record is filed, **then** that line is absent from the filed body.

## Notes

The checkpoint already lists the refuted alternatives, and the stage already labels the invariants and the risks. What is missing is the rendering that puts the labelled items in front of a human.

### Story #724: The checkpoint's list reads like the planning gate's

- **story_type:** user
- **size:** M

**As a** delivery lead who runs both planning and design stages, **I want** one list idiom at both gates, **so that** a number I type means the same thing wherever I am in the pipeline.

## Acceptance Criteria

- [ ] **Given** a drafted record, **when** the checkpoint renders, **then** the reviewer sees one numbered checklist whose ticked lines are exactly what a plain approval files.
- [ ] **Given** that checklist, **when** the reviewer types a number, **then** that one line flips, and one typed selection covers every kind the list holds.
- [ ] **Given** any record, **when** the checkpoint renders, **then** every line arrives ticked and the numbering runs as one sequence from 1 across every kind on the list.
- [ ] **Given** a reviewer who types no numbers, **when** they approve, **then** the record is filed as drafted, with no re-render and no second confirmation.
- [ ] **Given** a line whose content a prior run already filed and approved, **when** the reviewer types its number, **then** the flip is refused and the reason is stated.

## Notes

The checkpoint keeps the exit it already owes beside the two approvals and the revise, so the lead can still end the run with no record at all.

## Assumptions

- The record checkpoint keeps the removal convention, so no line on its checklist ever arrives unticked.
- An invariant or a risk the lead asked for stays off the list, matching how the planning gate treats an acceptance criterion the lead asked for.
- The record's drafted sections keep the headings they have now, which is how the list finds the invariants and the risks.

## Out of Scope

- Inverting the record checkpoint to the addition convention, where a plain approval would file the smallest record and the reviewer would tick the rest back in.
- Any change to what the planning gate renders.
- Porting either gate to a second harness.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #723 | none |
| #724 | #723 |
