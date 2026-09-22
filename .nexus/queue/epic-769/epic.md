---
feature: "Multi-Repo Workspaces"
feature_path: docs/features/multi-repo-workspaces
epic: "The Epic Issue Carries the Ledger of What Shipped"
slug: epic-shipped-ledger
created: 2026-09-22
type: enhancement
complexity: L
complexity_drivers: [a new durable record on the epic issue that two stages read and write, a seven-story chain in which the first observable outcome arrives at the third story, removal of the superseded reader across three libraries and two stage contracts]
concepts: [multi-pr-close, aggregated-epic-receipt, pr-story-resolution, conformance-gate, durable-close-record, pr-driven-flow]
link: "#769"
record: "#777"
record_state: closed
---

# Epic: The Epic Issue Carries the Ledger of What Shipped

> ⚠️ **Utilization risk:** assessed L (1–2 weeks). Fills the sprint with no slack for overruns. Watch for scope creep.

## Description

When a pull request that implements a story merges, the epic issue gains a record of it: which story it shipped, which repository it merged in, and the commit range it covers. Closing the epic reads those records. Nothing has to be rediscovered, because the epic issue already holds the list of what shipped.

Today that list is rebuilt from scratch every time a gate runs, and it comes back wrong in four separate ways. A story's pull requests are searched for only in repositories the lead happens to hold a copy of. A pull request's state is asked of the wrong repository, so merged work reads back as unmerged. One pull request per story is kept, so a later fix displaces the feature it fixed and the displaced code never reaches the close range. The commit that was analysed is compared against a branch that kept moving afterwards, and the result is called stale. Each of those makes a gate state something false, and a person has to notice the tool is wrong and overrule it.

The value is that the lead stops adjudicating tool output. A gate that has to be fact-checked is worse than no gate: it costs attention and still ends in a waiver. Recording what shipped at the moment it shipped, on the issue that owns the work, is also the last thing standing between this pipeline and running conformance, closure and distillation with nobody watching.

## Success Metrics

- An epic whose stories merged as pull requests in a repository other than the one holding the epic issue closes with no waiver and no manual override.
- Every merged pull request that closed a story reaches the close range, including the second pull request of a story that shipped in two.
- The close gate asks the lead no question whose only correct answer is that the check itself is wrong.
- Exactly one reader answers what an epic shipped, so a defect in that answer has one place to be fixed.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

A story's merged pull requests come from the issue graph; The conformance gate records a merged pull request on the epic issue; The conformance gate reports what an epic has shipped and what it has not; The close gate decides merge state and range from the epic's record; A story that shipped as several pull requests contributes all of them

## User Stories

### Story #770: A story's merged pull requests come from the issue graph

- **story_type:** system
- **size:** S

**As a** delivery lead, **I want** every pull request that closed a story to be found wherever it merged, **so that** a story whose code lives elsewhere is never reported as unimplemented.

#### Acceptance Criteria

- [ ] **Given** a story issue closed by a pull request that merged in a different repository, **when** that story's merged pull requests are resolved, **then** the pull request is returned and names the repository it merged in.
- [ ] **Given** a story closed by two merged pull requests, **when** that story's merged pull requests are resolved, **then** both are returned.
- [ ] **Given** a repository the caller holds no local copy of, **when** a story whose pull request merged there is resolved, **then** the result is identical to the result when a local copy is present.
- [ ] **Given** a story closed by no merged pull request, **when** that story's merged pull requests are resolved, **then** none is returned and the story is named.

#### Notes

What this replaces is not removed here. Two readers stand between this story and the removal story, which is what lets each one be checked against live work before anything is deleted.

### Story #771: The conformance gate records a merged pull request on the epic issue

- **story_type:** user
- **size:** M

**As a** delivery lead, **I want** each merged pull request's conformance result recorded on the epic issue itself, **so that** closing the epic never depends on reading pull requests in repositories I may not hold.

#### Acceptance Criteria

- [ ] **Given** a merged pull request implementing a story of an epic, **when** the conformance gate runs against it, **then** the epic issue carries a record naming that pull request, the story it implements, the repository it merged in, and the commit range it shipped.
- [ ] **Given** the conformance gate has already recorded that pull request, **when** it runs against it again, **then** the epic issue carries one record for it rather than two, and no other pull request's record changes.
- [ ] **Given** an open pull request, **when** the conformance gate runs against it, **then** it publishes its review for the engineer and the epic issue gains no record.
- [ ] **Given** an epic issue in a different repository from the pull request, **when** the conformance gate records the result, **then** it writes on the epic issue and asks the lead nothing about which repository the story numbers belong to.

#### Notes

The record carries the commit range because the gate has the merged code in hand at the moment it writes. Every later reader is then spared needing that repository at all.

### Story #772: The conformance gate reports what an epic has shipped and what it has not

- **story_type:** user
- **size:** M

**As a** delivery lead, **I want** to ask an epic what it has shipped and be told which stories have not, **so that** I learn a story is unshipped while I can still act on it rather than at the close.

#### Acceptance Criteria

- [ ] **Given** an epic every one of whose stories has at least one recorded merged pull request, **when** the conformance gate runs against the epic, **then** it reports the epic as fully shipped and names every recorded pull request.
- [ ] **Given** an epic where one story has no recorded pull request, **when** the conformance gate runs against the epic, **then** it names that story as unshipped and does not report the epic as fully shipped.
- [ ] **Given** a story whose merged pull request is linked on the issue but carries no record, **when** the conformance gate runs against the epic, **then** it names that pull request as unrecorded and does not report the epic as fully shipped.
- [ ] **Given** a story added to the epic after a record was already written, **when** the conformance gate runs against the epic, **then** the added story is reported as unshipped.
- [ ] **Given** a story marked as having shipped without a pull request of its own, **when** the conformance gate runs against the epic, **then** it is left out of the count rather than reported unshipped.

**Reason for five:** the third criterion is the one that catches a record which is present but incomplete, and it cannot be merged into the second, which catches a story with nothing recorded at all.

### Story #773: The close gate decides merge state and range from the epic's record

- **story_type:** user
- **size:** M

**As a** delivery lead, **I want** the close gate to take merge state and the close range from the epic's record, **so that** it stops reporting merged work as unmerged and stops asking me to waive a check I cannot verify.

#### Acceptance Criteria

- [ ] **Given** an epic whose stories merged in a repository other than the one holding the epic issue, **when** the close gate runs, **then** it reports every one of those pull requests as merged.
- [ ] **Given** a close run started from one repository over pull requests that merged in another, **when** the close record is written, **then** its range names the repository each pull request merged in, and none is attributed to the repository the close was started from.
- [ ] **Given** a recorded pull request whose merge commit no longer matches what the platform reports for it, **when** the close gate runs, **then** it blocks and names that pull request.
- [ ] **Given** an epic with a story that has no recorded merged pull request, **when** the close gate runs, **then** it blocks and names that story.

### Story #774: A story that shipped as several pull requests contributes all of them

- **story_type:** system
- **size:** S

**As a** delivery lead, **I want** every merged pull request that shipped part of a story to reach the close range, **so that** a later fix does not displace the feature it was fixing.

#### Acceptance Criteria

- [ ] **Given** a story that shipped as two merged pull requests, **when** the close record is written, **then** its range covers the commits of both, and the earlier one is not displaced by the later.
- [ ] **Given** two of one story's merged pull requests in the same repository, **when** the close record is written, **then** the two are ordered by which came first in the history.
- [ ] **Given** a story that shipped as two merged pull requests, **when** the epic's conformance findings are summed, **then** each pull request's findings are counted once.

#### Notes

This is the case that fails quietly rather than loudly, which is why it is a story of its own. Story 117 of the live epic shipped as a feature and then a fix, and the rule in place today keeps only the fix.

### Story #775: The superseded search and the retired checks are removed

- **story_type:** system
- **size:** M

**As a** maintainer, **I want** one way to answer what an epic shipped, **so that** a later correction cannot fix one reader and leave the other one wrong.

#### Acceptance Criteria

- [ ] **Given** the close gate now reads the epic's record, **when** a story's pull requests are resolved anywhere in the toolkit, **then** no branch name and no same-repository link is consulted.
- [ ] **Given** a lead invoking the retired merge-state and currency checks by name, **when** the commands run, **then** they report that they no longer exist.
- [ ] **Given** a pull request carrying a published review, **when** any gate establishes what an epic shipped, **then** it does not read that review to do so.
- [ ] **Given** the tests that pinned the removed selection rules, **when** the removal lands, **then** the behaviours they pinned are covered against the epic's record instead.

#### Notes

The review a pull request carries is kept as the engineer's read surface. What is removed is its use as the thing a gate establishes shipped state from.

### Story #776: The close gate stops offering a waiver for a commit that moved

- **story_type:** system
- **size:** S

**As a** delivery lead, **I want** the close gate to stop offering me a waiver for an analysis whose commit moved, **so that** the one remaining judgment at close is about findings rather than about whether a check can be believed.

#### Acceptance Criteria

- [ ] **Given** the close gate classifying a conformance result, **when** it reports the state, **then** no state describes the analysed commit as stale against a branch that moved.
- [ ] **Given** a close run over an epic whose analysis preceded further commits on the branch, **when** the gate runs, **then** the lead is offered no waiver about the analysed commit.
- [ ] **Given** the close gate classifying a conformance result, **when** the epic's decision record has been revised since the analysis, **then** that is still reported and still takes its own waiver.

## Assumptions

- Whoever runs the conformance gate can write on the epic issue.
- Every story of an epic is a sub-issue of that epic issue.
- Reviews already published on pull requests that merged before this epic stay as history and are never read to establish what shipped.

## Out of Scope

- The unattended runner that drives the conformance gate, the close and the distillation with nobody watching.
- Turning the judgments a person still makes at close into durable markers on the story issue.
- Re-running the conformance gate over pull requests that merged before this epic exists.
- Obtaining a copy of a repository the caller does not already hold. This one was asked for and this epic declines it: the record carries the commit range, written while the conformance gate held the merged code, so neither the close gate nor the range it stamps ever needs that repository again. The one reader that does still need it already refuses and names what is missing.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #770 | none |
| #771 | #770 |
| #772 | #771 |
| #773 | #772 |
| #774 | #773 |
| #775 | #773, #774 |
| #776 | #773 |
