---
feature: "Unattended Epic Implementation"
feature_path: docs/features/unattended-implementation
epic: "Keep accepted outside-epic dependencies out of Before implementation"
slug: outside-epic-dependency-bucketing
created: 2026-10-12
type: enhancement
complexity: S
complexity_drivers: [two S stories change how the decision-record stage groups ADDRESS risks in the approval brief, on a new record and on a revision, no new data and no new stage]
concepts: ["release-changelog", "decision-record", "draft-ordering-block", "epic-approval-gate", "scope-razor", "derived-filing-body", "release-identity"]
link: "#934"
---

# Epic: Keep accepted outside-epic dependencies out of Before implementation

## Description

The decision record's approval brief lists every ADDRESS risk whose mitigation is a plan not yet made under "Before implementation". That group tells the implementer what to do before the first story. Some of those risks are not this epic's work at all. Another epic delivers the mitigation, and the owner has already accepted the gap until it ships. Record #38 in sameera/magpie is one case: its R1 waits on a Maps epic nobody has planned yet, and the record says the owner accepts that the epic's value stays latent until then.

An implementer cannot finish such an item, because the work belongs to another epic. An unattended implementation run reads the group as work to do first, so it stops at the item every time and never reaches the first story. Epic #31 in sameera/magpie stopped this way.

This epic makes the approval brief put a risk where its mitigation is delivered. A risk that another epic delivers, whose gap the owner accepts, is listed with who delivers it, and not as work before implementation. "Before implementation" keeps only work this epic's team must finish before its first story.

## Success Metrics

- No record approved after this change lists under "Before implementation" a risk whose mitigation another epic delivers.
- An unattended implementation run on a record whose only open ADDRESS risk is an accepted outside-epic dependency reaches its first story.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

List accepted outside-epic dependencies apart from pre-implementation work; Re-group an approved record's risks when it is revised

## User Stories

### Story #935: List accepted outside-epic dependencies apart from pre-implementation work

- **story_type:** user
- **size:** S

**As a** lead, **I want** the approval brief to list a risk that another epic delivers apart from the work due before implementation, **so that** the implementer is never told to do another epic's work before the first story.

#### Acceptance Criteria

- [ ] **Given** an ADDRESS risk whose mitigation another epic delivers, and whose gap the record says the owner accepts, **when** the record is filed, **then** the approval brief lists the risk with who delivers it and does not list it under "Before implementation".
- [ ] **Given** an ADDRESS risk whose mitigation is a plan this epic's team must make before its first story, **when** the record is filed, **then** the risk is listed under "Before implementation".
- [ ] **Given** an ADDRESS risk whose mitigation another epic delivers, and whose gap the record does not say the owner accepts, **when** the record is filed, **then** the risk is listed under "Resolve before approval", so the lead accepts the gap or changes the plan before approving.
- [ ] **Given** any record, **when** it is filed, **then** each ADDRESS risk appears in exactly one group of the approval brief.

### Story #936: Re-group an approved record's risks when it is revised

- **story_type:** user
- **size:** S

**As a** lead, **I want** a revision of a record approved before this change to move an accepted outside-epic dependency out of "Before implementation", **so that** I can correct an old record without changing any of its decisions.

#### Acceptance Criteria

- [ ] **Given** an approved record that lists an accepted outside-epic dependency under "Before implementation", **when** the lead revises the record, **then** the revised record lists that risk with who delivers it and not under "Before implementation".
- [ ] **Given** such a revision changes only where a risk is listed, **when** it is re-approved, **then** it marks no decision as changed or withdrawn.

## Assumptions

- A record states the owner's acceptance of an outside-epic gap in the risk's own text, as R1 of record #38 does.

## Out of Scope

- Changing what a BLOCKER risk means or where a BLOCKER risk is listed.
- Moving `utils/implement-epic.sh` into a `nexus` subcommand. #928 carries that work.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #935 | none |
| #936 | #935 |
