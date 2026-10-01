---
feature: "PR-Driven Delivery"
feature_path: docs/features/pr-driven-delivery
epic: "Complete, error-aware evidence from stories to pull requests for close"
slug: complete-error-aware-pr-evidence
created: 2026-09-30
type: enhancement
complexity: M
complexity_drivers: [three stories, one M, one pull request read shared by analyze and close, receipt format change read by close]
concepts: []
link: "#827"
record: "#837"
record_state: closed
---

# Epic: Complete, error-aware evidence from stories to pull requests for close

## Description

Close decides whether an epic shipped by reading, for each story, the pull requests that claim it and the analyze receipts on those pull requests. Today that evidence can be incomplete in three ways, and close cannot tell any of them apart from a clean result.

First, the read of the pull requests that claim a story stops after a fixed number of results. A story with many linked or mentioning pull requests can lose the one that shipped it. The same read returns an empty list when the read itself failed, so a network or permission error looks exactly like "no pull request shipped this story". Second, a story's text can be edited after its pull request was analyzed. The receipt records nothing about the text it was checked against, so close cannot see that the acceptance criteria moved. Third, close must count a receipt only for the stories that receipt actually names, so a story added to the epic later is never treated as covered by a receipt written before it existed.

This epic makes the evidence complete, makes a failed read visible as a failure, and makes each receipt state exactly which story text it checked. It does not change what close does with stale evidence. That decision belongs to the epics that follow (#828, #830).

## Success Metrics

- For a story with more claiming pull requests than fit in one page of results, close sees every one of them.
- A failed read of a story's pull requests is reported to the lead as an error that names the story, in every run where it happens.
- For every story whose text changed after its receipt was written, close reports that story as changed.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Every pull request claiming a story is read, and a failed read is an error; The receipt names the exact stories it covers; The receipt records each story's text, and close sees when it changed

## User Stories

### Story #834: Every pull request claiming a story is read, and a failed read is an error

- **story_type:** system
- **size:** M

**As a** lead closing an epic, **I want** close to see every pull request that claims each story and to stop on a failed read, **so that** a story is never reported as unshipped because its evidence was cut short or never arrived.

#### Acceptance Criteria

- [ ] **Given** a story with more claiming pull requests than one page of results holds, **when** close reads its pull requests, **then** every merged pull request that claims the story is returned.
- [ ] **Given** a story whose pull request read fails, **when** close reads its pull requests, **then** close reports an error that names the story and the failure, and does not treat the story as having no pull request.
- [ ] **Given** a story whose read succeeds and finds no merged pull request, **when** close reads its pull requests, **then** close reports the story as having no pull request, distinct from the error case.
- [ ] **Given** analyze and close both read a story's pull requests, **when** either one reads them, **then** both see the same complete set and the same error behaviour.

### Story #835: The receipt names the exact stories it covers

- **story_type:** system
- **size:** S

**As a** lead closing an epic, **I want** each analyze receipt to count only for the stories it names, **so that** a story added to the epic after the receipt was written is never treated as checked.

#### Acceptance Criteria

- [ ] **Given** an analyze receipt written before a story was added to the epic, **when** close checks coverage, **then** the added story is reported as having no receipt.
- [ ] **Given** a receipt that names stories A and B, **when** close checks coverage, **then** the receipt counts for A and B and for no other story of the epic.
- [ ] **Given** a receipt that names no story, **when** close reads it, **then** close reports it as covering no story rather than as covering the whole epic.

### Story #836: The receipt records each story's text, and close sees when it changed

- **story_type:** system
- **size:** M

**As a** lead closing an epic, **I want** each receipt to record the story text it was checked against, **so that** close can tell me when a story changed after its pull request was analyzed.

#### Acceptance Criteria

- [ ] **Given** analyze checks a pull request against stories A and B, **when** it writes the receipt, **then** the receipt records a fingerprint of each story's text, one per story it names.
- [ ] **Given** a story whose text was edited after its receipt was written, **when** close reads the receipt, **then** close reports that story as changed since analysis.
- [ ] **Given** a story whose text is unchanged since its receipt was written, **when** close reads the receipt, **then** close reports nothing about it.
- [ ] **Given** a receipt written before this change, with no recorded story text, **when** close reads it, **then** close reports the story as unknown rather than as changed or unchanged.

## Assumptions

- A change to a story's text that only alters whitespace is still reported as a change.
- Receipts already on pull requests are not rewritten.

## Out of Scope

- What close does with a story reported as changed or unknown, such as blocking or re-checking it. That belongs to #828 and #830.
- Re-running analyze automatically when a story changed.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #834 | none |
| #835 | none |
| #836 | #835 |
