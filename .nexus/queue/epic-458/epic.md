---
feature: "Roadmap-Driven Learning"
feature_path: docs/features/roadmap-driven-learning
epic: "The plan is approved at a decision-grade gate and renders as a home page"
slug: plan-approval-gate-and-home-page
created: 2026-09-12
type: enhancement
complexity: L
complexity_drivers: [seven stories of which four are M, every story reads or writes the one committed plan contract, two slice shapes the shipped session cannot yet teach, fields the shipped plan requires that no earlier epic produces, a gate refusal that must be code rather than instruction]
concepts: []
link: "#458"
record: "#591"
record_state: closed
---

# Epic: The plan is approved at a decision-grade gate and renders as a home page

> ⚠️ **Utilization risk:** assessed L (1–2 weeks). Fills the sprint with no slack for overruns. Watch for scope creep.

## Description

Epics #455, #456 and #457 turn a roadmap into an uncommitted draft plan. The draft holds the order of the slices, the learner-or-handoff mark on each one, the splits, the scaffolds, the concepts the learner's declaration removed, and a coverage verdict. Nobody can be taught from the draft yet. This epic adds the one human checkpoint the draft passes through, and it adds the page the learner opens once the plan is approved.

The gate runs once on the whole roadmap, because concept ordering needs the whole dependency graph. The reviewer decides the sequence, the splits, the scaffolds and the focus boundary there. Lesson prose is not one of those decisions, and leaving it out is what keeps the gate readable in one screen. A plan whose coverage verdict is not clean never reaches the reviewer. Record #562 requires that refusal to be enforced by code, because an instruction to refuse can be skipped.

Approval turns the draft into the committed plan the shipped teaching session reads. That session cannot read the draft as it stands. It keys every slice by its story, so it would skip the second part of a split story, and it refuses a scaffold, which has no story. It also requires a lesson name, a branch and a pinning test on every slice, and no earlier epic produces those fields. Records #550 and #562 both left these gaps to this epic. The approved plan then renders as a home page that shows the dependency graph, including the slices nobody has written yet and the slices handed off, each marked as what it is.

## Success Metrics

- No plan with a coverage gap is ever committed.
- Every plan the gate approves is read by the shipped teaching session without refusing any slice.
- A reviewer approves a roadmap of any number of epics at one gate.
- Every slice of an approved plan appears on the home page, including the slices with no written lesson.

## Personas

Per `docs/product/context.md`. The learner in this epic is the canonical primary persona, here in the role of someone approving their own plan and then opening it.

## Smallest Usable Version

The committed plan admits split parts and scaffolds, and the session advances by position; A plan whose coverage verdict is not clean cannot be approved; The reviewer approves the sequence, the splits, the scaffolds and the focus boundary at one gate; Approval writes a committed plan the shipped teaching session reads; The approved plan renders as a home page showing the dependency graph.

## User Stories

### Story #583: The committed plan admits split parts and scaffolds, and the session advances by position

- **story_type:** user
- **size:** M

**As a** learner, **I want** a plan with split stories and scaffolds to teach every one of its steps in order, **so that** the splits and scaffolds the gate approved are the steps I actually take.

## Acceptance Criteria

- [ ] **Given** an approved plan in which one story is split into two parts, **when** the learner finishes the first part's exercise, **then** the next session teaches the second part rather than moving on to the next story.
- [ ] **Given** an approved plan, **when** each part of a split story is taught, **then** each part is written into its own lesson and no lesson overwrites another.
- [ ] **Given** an approved plan whose next step is a scaffold, **when** the learner arrives at it, **then** the session writes the scaffold's lesson and does not stop because the scaffold names no story.
- [ ] **Given** a handoff slice beside a scaffold, **when** its handoff prompt is written, **then** the prompt lists no scaffold among the slices the coding agent must leave alone.

## Notes

Record #562 named this as an ADDRESS risk: the shipped session's advance, its drift stop and its handoff prompt each key a slice by its story. Nothing broke while the plan was only a draft. Approval is the point where it would.

### Story #584: A handoff from an initiative roadmap names the epic its slice belongs to

- **story_type:** user
- **size:** S

**As a** learner working through a roadmap of several epics, **I want** each handoff prompt to name the epic its slice belongs to, **so that** the coding agent I hand the work to is not sent to the wrong epic.

## Acceptance Criteria

- [ ] **Given** a plan approved from an initiative roadmap spanning two epics, **when** a handoff prompt is written for a slice of the second epic, **then** the prompt names the second epic.
- [ ] **Given** a plan approved from a single-epic roadmap, **when** a handoff prompt is written, **then** the prompt names that epic.

## Notes

Record #550 named this as an ADDRESS risk, and left the choice between a per-slice epic and a lookup at prompt time to this epic's decision record.

### Story #585: A plan whose coverage verdict is not clean cannot be approved

- **story_type:** system
- **size:** S

**As a** reviewer, **I want** a plan with a coverage gap refused before I see it, **so that** no plan that assumes an untaught concept is committed.

## Acceptance Criteria

- [ ] **Given** a draft whose coverage verdict names at least one gap, **when** approval is requested, **then** approval is refused, the committed workbook is unchanged, and every gap is named.
- [ ] **Given** a draft that carries no coverage verdict, **when** approval is requested, **then** approval is refused in the same way as a draft with a gap.
- [ ] **Given** a draft whose coverage verdict is clean, **when** approval is requested, **then** the gate is shown and nothing is refused.

## Notes

Record #562 invariant 33 requires this refusal to be enforced in code rather than in the stage's instructions.

### Story #586: The reviewer approves the sequence, the splits, the scaffolds and the focus boundary at one gate

- **story_type:** user
- **size:** M

**As a** reviewer, **I want** every judgement the planning passes made laid out on one screen, **so that** I can approve or change the plan without reading the stories it came from.

## Acceptance Criteria

- [ ] **Given** a clean draft, **when** the gate is shown, **then** it shows every slice in order with its mark, each split story with its parts, and each scaffold beside the slice whose assumption forced it.
- [ ] **Given** a clean draft, **when** the gate is shown, **then** it shows each concept the learner's declaration removed beside the phrase that removed it, the declared phrases that matched no concept, and whether the learner's focus matched no story.
- [ ] **Given** a roadmap spanning several epics, **when** the plan is approved, **then** one gate approves the whole roadmap and no epic has a gate of its own.
- [ ] **Given** the gate is shown, **when** the reviewer reads it, **then** it carries no lesson prose and no pinned sources.
- [ ] **Given** the reviewer changes the mark on a slice at the gate, **when** the gate is shown again, **then** the order, the splits, the scaffolds and the coverage verdict shown reflect the changed mark, and nothing was committed in between.

## Notes

The learner's quoted phrases are shown at the gate only. Record #562 invariant 10 keeps them out of every committed file.

### Story #587: Approval writes a committed plan the shipped teaching session reads

- **story_type:** system
- **size:** M

**As a** learner, **I want** approval to produce a plan the teaching session can teach from at once, **so that** the first session after approval teaches rather than refusing the plan.

## Acceptance Criteria

- [ ] **Given** an approved plan, **when** the shipped teaching session reads it, **then** it refuses no slice for a value the plan does not hold.
- [ ] **Given** an approved plan, **when** its pinned story states are compared with the issue graph at the moment of approval, **then** every pinned state matches.
- [ ] **Given** an approved plan, **when** the committed workbook is searched for the learner's interview answers, **then** none of the learner's own words is found.
- [ ] **Given** a gate the reviewer did not approve, **when** the gate ends, **then** the committed workbook is unchanged and the draft is still in place.

## Notes

The shipped plan requires a lesson name, a branch and a pinning test on every slice, and a plan-wide repository, suite command and grading command. Record #550 left ownership of those fields to this epic's decision record. No field may be filled with a placeholder, because the shipped session acts on the value.

### Story #588: A plan re-approved after drift keeps the lessons already written

- **story_type:** user
- **size:** S

**As a** learner whose session stopped because a story changed, **I want** to re-approve the plan and continue, **so that** a changed story does not end the workbook.

## Acceptance Criteria

- [ ] **Given** a session that stopped because a story changed since it was pinned, **when** the plan is re-approved, **then** the changed story is pinned to its current state and the next session teaches it.
- [ ] **Given** a plan re-approved after drift, **when** the learner opens the workbook, **then** every lesson written before the re-approval is still there and is not taught again.
- [ ] **Given** a re-planned draft whose coverage verdict is not clean, **when** re-approval is requested, **then** re-approval is refused and the previously approved plan is unchanged.

## Notes

The shipped `/nxs.teach` already stops on drift with the instruction that the plan is re-approved. This story makes that instruction something a learner can follow.

### Story #589: The approved plan renders as a home page showing the dependency graph

- **story_type:** user
- **size:** M

**As a** learner, **I want** a home page that shows the whole road ahead, **so that** I can see where each step sits and click into the ones that exist.

## Acceptance Criteria

- [ ] **Given** an approved plan, **when** the learner opens the workbook's home page, **then** it shows every slice with the dependency edges between them.
- [ ] **Given** an approved plan, **when** the home page is shown, **then** a slice with a written lesson links to its page and a slice with no written lesson is shown as not yet written, with no link.
- [ ] **Given** an approved plan, **when** the home page is shown, **then** a handed-off slice is marked as handed off and a scaffold is marked as a teaching step rather than as a roadmap story.
- [ ] **Given** a session has just written a lesson, **when** the learner opens the home page, **then** that lesson's slice links to its page.
- [ ] **Given** a machine with no network, **when** the learner opens the home page, **then** it displays completely.

## Assumptions

- The draft that reaches the gate is the one epic #457's rewrite writes, holding the marks, the splits, the scaffolds, the concepts the learner's declaration removed, and the coverage verdict.
- The home page is rendered by the renderer epic #405 shipped, under the same no-network and generated-page rules as a lesson page.
- The learner who ran planning is also the reviewer at the gate.

## Out of Scope

- Writing any lesson's prose.
- Pinning a learner stub's sources, and deciding what a scaffold's lesson is written from, which are planned as #459.
- Building a handed-off slice, writing a handoff prompt at approval, or starting a coding-agent session.
- Changing the order, the splits or the scaffolds by hand at the gate; a change of mark is ordered again by epic #457's rewrite.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #583 | none |
| #584 | #583 |
| #585 | none |
| #586 | #585 |
| #587 | #583, #584, #586 |
| #588 | #587 |
| #589 | #587 |
