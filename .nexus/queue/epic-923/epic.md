---
feature: "PR-Driven Delivery"
feature_path: docs/features/pr-driven-delivery
epic: "The analyze verdict on a pull request shows what blocks and how to resolve it"
slug: analyze-verdict-readability
created: 2026-10-11
type: enhancement
complexity: M
complexity_drivers: [one rendering step every other story builds on, analyze report template rewritten]
concepts: ["pr-verdict-answers", "record-digest", "conformance-gate", "release-changelog", "published-verdict-selection", "pr-driven-flow", "reading-list"]
link: "#923"
record: "#949"
record_state: closed
---

# Epic: The analyze verdict on a pull request shows what blocks and how to resolve it

## Description

`/nxs.analyze --pr` publishes its verdict as a review on the pull request. Today a reader cannot tell at a glance whether the pull request is blocked, what each issue is, or what to do about it. The severity counts sit at the bottom. Blocking items are mixed with bookkeeping such as the record hash and empty "none" lines. A way to resolve an item appears only when the model happens to write one.

The layout was written for a terminal and is posted to GitHub unchanged. Its space-aligned `Label: value` columns and indented sub-lines collapse when GitHub renders them. The model also writes the visible text freely from a prose template, and code checks only the machine blocks. So the structure differs between runs and inside one verdict: a waiver is printed before the item it waives, two epic-level lines contradict each other, and a table cell holds every evidence location for a story.

This epic makes the verdict lead with what blocks, gives every issue the same fields including how to resolve it, and collapses the supporting detail. The visible text and the hidden machine data are produced together from the same judgments, so they cannot disagree and the structure is the same on every run. Verdicts already published keep working with `nexus close`.

## Success Metrics

- In every verdict published after the release, the first section after the headline lists the open blocking items, or the headline says the pull request is clear to merge.
- Every verdict published after the release has the same section order and the same fields per item, checked by a test over the toolkit step that produces the verdict.
- Every verdict fixture published before the release gives `nexus close` the same result after the release as before it.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Every verdict has the same structure on every run; The verdict shows what blocks first, and how to resolve each item; Supporting detail is collapsed so the issues stay on top

## User Stories

### Story #924: Every verdict has the same structure on every run

- **story_type:** system
- **size:** M

**As a** lead, **I want** the verdict text produced by the toolkit from the run's judgments, **so that** its structure does not change with how the model phrased a run.

#### Acceptance Criteria

- [ ] **Given** the same judgments, **when** the verdict is produced twice, **then** the two visible bodies are identical byte for byte.
- [ ] **Given** a run's judgments, **when** the verdict is produced, **then** the visible text and the hidden machine data come from that one set of judgments, and a test finds no difference between the counts each states.
- [ ] **Given** an open item judged in this run whose judgment lacks a required field, **when** the verdict is produced, **then** publishing is refused and the refusal names the item and the missing field. An item carried unchanged from a verdict published before the release is shown without the fields it never had.
- [ ] **Given** two runs over different epics, **when** both verdicts are produced, **then** their sections appear in the same order and each item lists its fields in the same order.

#### Notes

The model still makes every judgment. Only the writing of the text moves to the toolkit.

### Story #925: The verdict shows what blocks first, and how to resolve each item

- **story_type:** user
- **size:** M

**As an** engineer reading the verdict on my pull request, **I want** to see at once whether it is blocked and what to do about each issue, **so that** I can fix or answer the issues without reading the whole review.

#### Acceptance Criteria

- [ ] **Given** a published verdict, **when** the engineer opens the pull request, **then** the first line says whether the pull request is blocked or clear to merge, followed by the open count per severity.
- [ ] **Given** a verdict with open and answered items, **when** it is read, **then** the items appear in sections in this order: needs action, worth a look, already answered, no longer found.
- [ ] **Given** an open item, **when** it is read, **then** it shows its ID, severity and subject, then what is wrong, a link to the location, and how to resolve it.
- [ ] **Given** an open item that can be answered on the pull request, **when** it is read, **then** its resolution shows the exact answer line to paste and the command to run afterwards.
- [ ] **Given** an accepted or waived item, **when** it is read, **then** its subject comes first, followed by the answer, who gave it, and the reason.

### Story #926: Supporting detail is collapsed so the issues stay on top

- **story_type:** user
- **size:** S

**As a** lead, **I want** the per-story evidence and the run bookkeeping folded away, **so that** the issues are what I see first and the detail is still one click away.

#### Acceptance Criteria

- [ ] **Given** a verdict, **when** it is read, **then** the stories table shows counts only, and the evidence per criterion sits in a section that stays collapsed until the reader opens it.
- [ ] **Given** a verdict, **when** it is read, **then** the epic-level results appear in one table with one row per check.
- [ ] **Given** a section with nothing to report, **when** the verdict is read, **then** that section is not shown.
- [ ] **Given** a verdict, **when** it is read, **then** the mode, the record and its hash, the head commit and the key decisions sit in a collapsed run-details section.

## Assumptions

- Verdicts already published are not rewritten. They keep the old layout until a new analyze run publishes a new verdict.
- The fields and meaning of the receipt block stay as they are. The judgments block keeps its fields and their meaning, and gains optional fields that carry what the visible text shows; a reader from an earlier release ignores them. Where both blocks sit in the review changes.
- The change ships as one minor release with a CHANGELOG entry.
- Hidden data still counts toward GitHub's 65,536-character comment limit, so hiding it does not make room for more text.

## Out of Scope

- Changing what analyze judges, how it assigns severity, or how answers are applied.
- Changing the reports of close, distill or any other stage.
- Upgrading Nexus in adopter repositories so their verdicts change.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #924 | none |
| #925 | #924 |
| #926 | #924 |
