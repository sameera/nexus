---
feature: "Multi-Repo Workspaces"
feature_path: docs/features/multi-repo-workspaces
epic: "Drain an Entry Whose Range Is a List"
slug: drain-a-range-list
created: 2026-09-08
type: enhancement
complexity: M
complexity_drivers: [a reader that today refuses the shape it must now accept, attribution that must survive several changes to one file, reporting keyed on a value that is no longer single]
concepts: []
link: "#214"
record: "#513"
record_state: closed
---

# Epic: Drain an Entry Whose Range Is a List

## Description

The drain reads what an epic landed from the range list its close record stamped, and today it expects at most one entry per repository. An epic closed over several pull requests in one repository stamps several entries there, and the drain refuses the entry outright rather than draining it.

This epic makes the drain read that list. Each range entry contributes its own set of changes, and the epic's changes are those sets combined. The obvious shortcut is wrong and is refused here for the same reason it was refused when the range was written: one span from the first range entry's start to the last one's end would sweep in every unrelated commit that landed between them, and the drain would then rewrite pages this epic never touched.

Reading is only half of it. Once one file has been changed by two range entries, everything downstream that says where a change came from has to say which one. A code anchor has to name the range entry it was taken from, and a concept page's provenance has to name the repository and the pull request rather than only the epic. Reporting is the same problem in a different place: the drain's own account of what it drained and what it could not is keyed on a value that used to be single.

## Success Metrics

- An epic closed over several pull requests in one repository drains, where today it is refused.
- The changes the drain reads are exactly those the epic's own pull requests landed, and none that landed between them.
- Every anchor and every provenance line the drain writes names which pull request it came from.

## Personas

Per `docs/product/context.md`. The actor throughout is the delivery lead, who runs the drain and reads its report.

## Smallest Usable Version

Read every range entry, not one per repository; Say which pull request each change came from.

## User Stories

### Story #506: Read every range entry, not one per repository

- **story_type:** system
- **size:** M

**As a** delivery lead, **I want** the drain to read every range entry an epic stamped rather than at most one per repository, **so that** an epic that shipped as several pull requests can be drained at all.

## Acceptance Criteria

- [ ] **Given** an entry whose range list names the same repository three times, **when** the drain reads it, **then** it reads all three range entries rather than refusing the entry.
- [ ] **Given** those three range entries, **when** the drain assembles what the epic changed, **then** it combines their three sets of changes and never reads one span from the first range entry's start to the last one's end.
- [ ] **Given** an entry one of whose range entries cannot be resolved, **when** the drain reads it, **then** the whole entry is left undrained and the unresolvable range entry is named.
- [ ] **Given** an entry whose range list names two repositories, **when** the drain reads it, **then** each range entry is read in its own repository's checkout.

### Story #507: Say which pull request each change came from

- **story_type:** system
- **size:** M

**As a** delivery lead, **I want** every anchor and every provenance line to name the pull request it came from, **so that** I can trace a claim on a concept page back to the change that justified it.

## Acceptance Criteria

- [ ] **Given** a concept page updated from a multi-entry drain, **when** its provenance is written, **then** it names the repository and the pull request the change came from, not only the epic.
- [ ] **Given** one file changed by two of the epic's pull requests, **when** the anchors are written, **then** each anchor names the pull request whose change it was taken from.
- [ ] **Given** an epic whose range entries span two repositories, **when** an anchor is written, **then** it names its own repository and never the other one.

### Story #508: Report a multi-entry drain by every repository it touched

- **story_type:** user
- **size:** S

**As a** delivery lead, **I want** the drain's report to account for an entry by every repository its ranges touch, **so that** an entry I need to chase is attributed to the right place rather than to whichever range happened to be first.

## Acceptance Criteria

- [ ] **Given** an undrained entry whose range entries span two repositories, **when** the drain reports it, **then** it names both repositories rather than only the first one in the list.
- [ ] **Given** an entry with several range entries, **when** the drain reports how long it has been waiting, **then** the age is one figure for the entry rather than one per range entry.
- [ ] **Given** a run in which one entry was blocked and another drained, **when** the report is written, **then** the blocked entry names the range entry that could not be resolved.

## Assumptions

- The range list the drain reads is the one #213 stamps, and this epic changes neither its shape nor how it is written.
- An entry is drained whole or not at all, so one unresolvable range entry blocks its entry and leaves the other entries in that run untouched.
- The pipeline's own stores are withheld from every range entry's changes, exactly as they are withheld today.

## Out of Scope

- Stamping the range list, which is #213.
- Deriving the epic receipt, which is #212.
- Retiring the member close-and-migrate path, which is #215.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #506 | none |
| #507 | #506 |
| #508 | #506 |
