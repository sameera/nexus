---
feature: "Ranked PR Review"
feature_path: docs/features/ranked-pr-review
epic: "Ranked Pull Request Review"
slug: ranked-pr-review
created: 2026-10-10
type: enhancement
complexity: M
complexity_drivers: [two stories, posting writes to a pull request other people read, pre-post checks need test fixtures]
concepts: []
link: "#918"
record: "#921"
record_state: closed
---

# Epic: Ranked Pull Request Review

## Description

The lead can run `/nxs.code-review` on a pull request. It reviews the pull request, rates each finding on four axes, and shows the lead a ranked list. After the lead picks a verdict, it posts the ranking as one pull request review, with one inline comment per finding.

A plain review gives the author a flat list of findings. The author cannot tell which ones must be fixed in this pull request and which can wait. Rating each finding on probability, severity, fix effort and regression risk, and sorting the findings into fix-now and follow-up groups, gives the author that order.

Posting is visible to the pull request author and to other people. So nothing is posted until the lead chooses a verdict, and nothing is posted if any inline comment would land on the wrong line.

## Success Metrics

- Every posted review carries one inline comment for each finding location inside the pull request's changed lines, each tagged with the finding's number in the ranking; every other finding is carried in the review body.
- No review is posted without the lead's choice of verdict in the same run.
- A run with a mis-anchored inline comment posts nothing.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Rank a Pull Request's Review Findings; Post the Approved Ranking as One Review

## User Stories

### Story #919: Rank a Pull Request's Review Findings

- **story_type:** user
- **size:** S

**As a** lead reviewing a pull request, **I want** each review finding rated and ranked, **so that** the author knows which findings to fix in this pull request and which can wait.

#### Acceptance Criteria

- [ ] **Given** a pull request reference, **when** the lead runs `/nxs.code-review`, **then** each review finding is shown rated on probability, severity, fix effort and regression risk.
- [ ] **Given** a finding whose line has moved at the pull request's head, **when** it is ranked, **then** the line shown is the line at the head.
- [ ] **Given** the rated findings, **when** they are shown, **then** they are numbered in priority order and sorted into four groups: fix in this pull request, fix if the author agrees, optional, and follow-up issues.
- [ ] **Given** a review that returns no findings, **when** ranking would start, **then** the lead is told so and the run ends.

### Story #920: Post the Approved Ranking as One Review

- **story_type:** user
- **size:** M

**As a** lead, **I want** the ranking posted as one pull request review only after I choose its verdict, **so that** the author gets the ranking where they work and nothing reaches them that I did not approve.

#### Acceptance Criteria

- [ ] **Given** a ranked list, **when** the lead has not chosen request changes, comment or approve, **then** nothing is posted to the pull request.
- [ ] **Given** the lead chose a verdict, **when** the review is posted, **then** the pull request gets one review that carries the ranking and one inline comment per finding location inside the changed lines, each tagged with its finding number, and any finding outside the changed lines is listed in the review body without an inline comment.
- [ ] **Given** an inline comment whose file is not in the pull request, whose line is outside the changed lines, or whose expected text is not on that line, **when** posting is attempted, **then** nothing is posted and every problem is listed.
- [ ] **Given** the lead already has a review on the same head commit, **when** posting is attempted, **then** nothing is posted unless the lead confirms a second review.
- [ ] **Given** a review was posted, **when** the run ends, **then** the lead sees the review link and the number of inline comments.

## Assumptions

- The review step reuses the review that Claude Code itself provides, and this epic adds only the ranking and the posting.
- The skill ships with Nexus under the name `nxs.code-review`, and a personal skill already installed under that name is replaced on install.

## Out of Scope

- Fixing the findings in the pull request.
- Opening the follow-up issues the ranking suggests.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #919 | none |
| #920 | #919 |
