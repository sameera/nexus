---
feature: "Artifact Prose Style"
feature_path: docs/features/artifact-prose-style
epic: "Decision Records That Are Quick to Review and Hide No Gaps"
slug: decision-records-approval-contract-first
created: 2026-09-25
type: enhancement
complexity: L
complexity_drivers: [four record-shape surfaces must change together, checkpoint parser reads exact headings, three downstream stages read the record, new pre-filing checks]
concepts: []
link: "#787"
record: "#794"
record_state: closed
---

# Epic: Decision Records That Are Quick to Review and Hide No Gaps

> ⚠️ **Utilization risk:** assessed L (1–2 weeks). Fills the sprint with no slack for overruns. Watch for scope creep.

## Description

Decision records are dense, and reviewers skim them. A record states each decision three or four times: in the Summary, in Chosen Approach, as a Key Decision and again as an invariant. Once a reader sees that each section repeats the last, they stop reading closely. The one new clause inside a repeat is then missed. The costs a design accepts have no field of their own, so they sit inside the "Why" text. In records #245 and #786, a success metric that no longer holds, a story change the record promised but never made, and a permanent restriction described as temporary were all written only in rationale.

A trial on #245 and #786 settled a new structure. The record opens with a short "How it works" in the epic's own words. An "Approval brief" follows, listing what must be resolved before approval and every decision that carries a trade-off. The guarantees come next, grouped and each tied to the decisions behind it, then the risks. Internal names, the detailed mechanism and the full reasons for each decision move to an appendix at the end. The trial also found that a word limit on the first section pushes the drafter into jargon. So the limit became a guideline. A cold-reader check of the front sections before filing is deferred to a later epic.

This epic makes `/nxs.decision-record` produce records in that structure, keeps the stages that read a record working on both the old and the new format, and adds the pre-filing checks the trial relied on.

## Success Metrics

- A reader who sees only the front sections (every section before the appendix) of a new-format record names every blocker, every accepted trade-off and every pending epic or story amendment the record contains.
- Every record approved in the old format passes `/nxs.analyze`, `/nxs.close` and `/nxs.distill` exactly as it does today.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

The record stage drafts the approval-first structure; The record checkpoint lists the new sections; Stages that read a record accept both formats

## User Stories

### Story #788: The record stage drafts the approval-first structure

- **story_type:** user
- **size:** M

**As a** lead approving a decision record, **I want** the record to open with what I am approving and what it costs, **so that** I do not have to read the full reasoning to find a blocker or a trade-off.

#### Acceptance Criteria

**Reason for six:** the new structure has six separately checkable parts (order, vocabulary, length, brief, guarantees, decision entries), and merging any two would hide which part a record got wrong.

- [ ] **Given** a planned epic, **when** the stage drafts its record, **then** the sections appear in this order: How it works, Approval brief, Guarantees, Risks and dependencies, Concept-store changes (only when the design changes a concept-store statement), and Design rationale and mechanism (the appendix).
- [ ] **Given** a drafted How it works section, **when** it is read beside the epic and its stories, **then** it uses only their vocabulary, names no internal component, and does not restate an outcome the epic or a story already states.
- [ ] **Given** a design whose clear explanation needs more than 300 words, **when** the stage drafts How it works, **then** the section runs longer and no content or definition is cut to meet the guideline.
- [ ] **Given** a decision with a trade-off, **when** the record is drafted, **then** the Approval brief lists that decision with its trade-off as a sub-bullet, and a decision listed under "Resolve before approval" carries its trade-off there instead of under "Choices with trade-offs".
- [ ] **Given** a drafted record, **when** its Guarantees section is read, **then** each guarantee sits under a heading naming what the reviewer checks and ends with the decisions it supports, or sits under "Existing behaviour to preserve".
- [ ] **Given** a decision, **when** the record is drafted, **then** its appendix entry states the decision, its reason, its trade-off, the exact old and new wording of any epic or story text it changes, the story that delivers it in a multi-story epic, and the guarantees it supports.

#### Notes

The target is the trial template from the second session, with #245 and #786 rewritten as its worked examples. The appendix holds a Terms list that defines once every internal name the decisions use. The complexity tier still selects which sections are required. The Summary and Chosen Approach sections are removed; How it works and the Approval brief do their job. This changes what the stage produces, so it is a minor version bump.

### Story #789: The record checkpoint lists the new sections

- **story_type:** system
- **size:** M

**As a** lead at the pre-filing checkpoint, **I want** the cut list to read the new sections, **so that** a renamed heading does not silently empty the list the checkpoint exists to show.

#### Acceptance Criteria

- [ ] **Given** a new-format draft, **when** the checkpoint renders its cut list, **then** the list holds every refuted alternative under its decision and every model-added guarantee and risk, and none is missing.
- [ ] **Given** the reviewer cuts a guarantee, **when** the cut is applied, **then** every other guarantee keeps its number and the gap stays.
- [ ] **Given** a surviving decision or guarantee still cites a cut guarantee, **when** the filing body is derived, **then** filing stops and names the citation.
- [ ] **Given** a draft field written as `none`, **when** the filing body is derived, **then** that field is absent from the filed body.
- [ ] **Given** a revision of an approved record in the old format, **when** the checkpoint renders, **then** the list reads the old sections and marks the approved lines as frozen, as it does today.

### Story #790: Stages that read a record accept both formats

- **story_type:** system
- **size:** M

**As a** lead running the stages after approval, **I want** analyze, close and distill to read a new-format record, **so that** the new format does not lose checks or rationale downstream.

#### Acceptance Criteria

- [ ] **Given** an approved new-format record, **when** `/nxs.analyze` runs, **then** it checks every guarantee against the change and reports a broken guarantee as critical.
- [ ] **Given** a new-format record, **when** `/nxs.distill` builds decision log entries, **then** it takes them from the record's decisions and reasons.
- [ ] **Given** a new-format record with a Concept-store changes section, **when** `/nxs.distill` runs, **then** it rewrites each named statement as the record gives it instead of reporting drift.
- [ ] **Given** an approved new-format record, **when** `/nxs.close` runs, **then** it stamps and verifies the record's hash and reads its decisions exactly as it does for an old-format record.
- [ ] **Given** a record approved in the old format, **when** `/nxs.analyze`, `/nxs.close` or `/nxs.distill` runs, **then** the stage reads it as it does today and its stamped hash still verifies.

### Story #791: Pending epic amendments are checked against the live issues

- **story_type:** user
- **size:** S

**As a** lead, **I want** the stage to check whether a promised epic or story change was actually made, **so that** a link to the epic is not taken as proof the epic was amended.

#### Acceptance Criteria

- [ ] **Given** a decision that changes a story's or the epic's text, **when** the checkpoint runs, **then** the stage reads the live issue and records the date it checked and whether the new wording is present.
- [ ] **Given** the new wording is on the live issue, **when** the checkpoint runs, **then** the change's status is amended with the date it was checked.
- [ ] **Given** the new wording is not on the live issue, **when** the checkpoint runs, **then** the status stays pending and the record carries a BLOCKER risk naming the issue, the exact wording to apply and what the issue says today, listed first under "Resolve before approval".
- [ ] **Given** any record run, **when** the stage drafts, checks or files the record, **then** it never edits the epic issue or a story issue.

### Story #792: The checkpoint blocks a draft whose cross-references do not hold

- **story_type:** system
- **size:** M

**As a** lead, **I want** the checkpoint to block a draft that hides a gap, **so that** an unsupported guarantee or an undelivered decision cannot pass for a settled one.

#### Acceptance Criteria

- [ ] **Given** a guarantee that cites no decision and is not under "Existing behaviour to preserve", **when** the checkpoint runs, **then** filing is blocked unless the Approval brief lists it under "Resolve before approval".
- [ ] **Given** a multi-story epic and a decision that names no delivering story, **when** the checkpoint runs, **then** filing is blocked unless the Approval brief lists it under "Resolve before approval".
- [ ] **Given** a decision that changes epic or story text without both the exact old and the exact new wording, **when** the checkpoint runs, **then** filing is blocked.
- [ ] **Given** an epic or story change whose status is not amended, **when** the checkpoint runs, **then** filing is blocked unless the Approval brief lists it under "Resolve before approval".
- [ ] **Given** a decision with a trade-off that the Approval brief does not list, **when** the checkpoint runs, **then** filing is blocked and the decision is named.

## Assumptions

- The trial template from the second session is the target format, and the rewritten #245 and #786 are its worked examples.
- Records already filed in the old format are not rewritten; the new format applies to records drafted after the release.
- The complexity tier keeps choosing which sections are required, with the old section names mapped onto the new ones.

## Out of Scope

- Holding approval while a BLOCKER or a pending amendment remains in a closed record.
- Rewriting records #786, #245 or #141 on GitHub.
- Changing how `/nxs.epic` drafts an epic.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #788 | none |
| #789 | #788 |
| #790 | #788 |
| #791 | #788, #789 |
| #792 | #789 |
