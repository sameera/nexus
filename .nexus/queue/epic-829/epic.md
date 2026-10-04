---
feature: "PR-Driven Delivery"
feature_path: docs/features/pr-driven-delivery
epic: "Analyze owns every judgment, and the engineer answers on the pull request"
slug: analyze-owns-every-judgment
created: 2026-10-03
type: enhancement
complexity: L
complexity_drivers: [five M stories, three stories change what the pull-request verdict carries, the answer mechanism reuses #828's waiver reader]
concepts: []
link: "#829"
record: "#871"
record_state: closed
---

# Epic: Analyze owns every judgment, and the engineer answers on the pull request

> ⚠️ **Utilization risk:** assessed L (1–2 weeks). Fills the sprint with no slack for overruns. Watch for scope creep.

## Description

Today close re-reads the diff, the decision record and the decision stubs that analyze already read on the pull request. It then asks the lead why the code departs from the record, after the merge, when the engineer who made each choice has moved on. Close makes judgments analyze could have made before the merge.

This epic moves every judgment into `/nxs.analyze --pr`. Analyze names each place the code departs from the approved decision record and gives it an ID. The engineer answers on the pull request with a comment that names the ID. A decision stub may explain a departure, but only a trusted person's comment or a record revision accepts it. Analyze then publishes a new verdict with the answers copied in, without judging the whole pull request again.

The pull request's verdict then carries everything close writes into its record: the key decisions, every departure with its answer and who accepted it, which record decisions the code supersedes, and the deferred scope the lead approved. When the pull request completes the epic, analyze also judges the success metrics and the guarantees that span stories. #830 then makes close read the verdict instead of the diff.

## Success Metrics

- Close can write its key decisions and deviation rationale from the pull request's verdict alone, with no read of the diff.
- Every departure from the decision record in a merged pull request was answered on the pull request before the merge.
- Answering a departure with no code change takes an analyze run that reads no code.
- An epic's success metrics are judged on a pull request before the epic's last merge.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Analyze names every departure from the decision record; Analyze judges the whole epic on the pull request that completes it; An engineer answers a departure or a finding on the pull request; Analyze records answers without judging unchanged code again; The pull request's verdict carries what close writes into its record; Analyze run without a pull request reports in the terminal only

## User Stories

### Story #858: Analyze names every departure from the decision record

- **story_type:** user
- **size:** M

**As a** lead reviewing a pull request, **I want** analyze to name each place the code departs from the approved decision record, **so that** the engineer explains it before the merge instead of the lead after it.

## Acceptance Criteria

- [ ] **Given** a pull request whose code departs from the record's described design or from one of its guarantees, **when** I run analyze on it, **then** the verdict lists the departure with an ID that stays the same when analyze runs again on the same head
- [ ] **Given** a decision stub that explains a departure, **when** analyze reviews the pull request, **then** the verdict shows the stub's reason beside the departure
- [ ] **Given** a departure where the code does the opposite of what a record decision chose, **when** analyze reviews the pull request, **then** the verdict marks the departure as superseding that decision and names it
- [ ] **Given** a pull request whose code matches the record, **when** analyze reviews it, **then** the verdict lists no departure

### Story #859: Analyze judges the whole epic on the pull request that completes it

- **story_type:** user
- **size:** M

**As a** lead, **I want** the epic's success metrics and the guarantees that span stories judged before the epic's last merge, **so that** the epic-level verdict lands on a pull request the engineer can still change.

## Acceptance Criteria

- [ ] **Given** a pull request that covers every live story of its epic, **when** analyze runs on it, **then** it judges each success metric and each guarantee that spans stories, and reports one it cannot decide as unverifiable, naming what would decide it
- [ ] **Given** a pull request whose stories are the last unshipped ones of an epic whose other stories have merged, **when** analyze runs on it, **then** it makes the same judgment over this pull request's change together with the changes the merged pull requests landed
- [ ] **Given** a pull request that leaves another story of its epic unshipped, **when** analyze runs on it, **then** it judges no success metric
- [ ] **Given** an epic analyzed by its issue number, **when** its stories already carry their own verdicts, **then** analyze no longer combines those verdicts into an epic verdict, and names running analyze on the epic's last pull request
- [ ] **Given** a pull request that completes its epic but does not contain a merged sibling's change, **when** analyze runs on it, **then** it reports the epic-level check as not run, as a blocking finding that names bringing the branch up to date

### Story #860: An engineer answers a departure or a finding on the pull request

- **story_type:** user
- **size:** M

**As an** engineer, **I want** to answer a named departure or finding with a comment on my pull request, **so that** my reason is recorded next to the work while I still remember it.

## Acceptance Criteria

**Reason for six:** the sixth criterion guards who may answer, a different actor from the five that define what an answer does, so it merges with none of them.

- [ ] **Given** a departure and a trusted person's comment that names its ID and accepts it with a reason, **when** analyze next runs on the pull request, **then** the departure counts as accepted and the verdict names who accepted it and links the comment
- [ ] **Given** a departure that only a decision stub explains, **when** analyze next runs, **then** the departure is still unanswered
- [ ] **Given** a departure nobody has answered, **when** analyze publishes its verdict, **then** the verdict counts it as a blocking finding
- [ ] **Given** a critical or high finding and a trusted person's comment that names its ID and waives it with a reason, **when** analyze next runs, **then** the finding no longer blocks and the verdict names who waived it
- [ ] **Given** a comment that names an ID from an author who cannot speak for the repository, **when** analyze next runs, **then** nothing is accepted or waived and the verdict names the comment
- [ ] **Given** an unattended implement run, **when** a fix round posts a comment that answers an ID on the pull request, **then** the run stops and names the comment

## Notes

Answering and accepting are one act when the author can speak for the repository, as a lead working alone or an engineer with write access can. A comment from anyone else is named in the verdict and accepts nothing; a trusted person must accept the departure. The verdict published on the pull request is the one artifact these criteria call the verdict.

The waiver answer replaces close's blocking-findings override at its checkpoint. The comment reader is the one #828 builds for waivers.

### Story #861: Analyze records answers without judging unchanged code again

- **story_type:** user
- **size:** M

**As a** lead, **I want** analyze to record the answers on a pull request without judging the whole pull request again, **so that** answering a departure costs a short run, not a full review.

## Acceptance Criteria

- [ ] **Given** answers posted on a pull request whose head has not moved since its last verdict, **when** I run analyze to record them, **then** it publishes a new verdict with each answer copied in and reads no code
- [ ] **Given** a head that moved since the last verdict, **when** I run analyze to record answers, **then** it re-checks the answered departures and every criterion and guarantee the changed files can affect, and carries every other result forward
- [ ] **Given** a decision record revised since the last verdict, **when** I run analyze to record answers, **then** it judges the whole pull request again
- [ ] **Given** a pull request with no earlier verdict, **when** I run analyze to record answers, **then** it stops and names a full analyze run
- [ ] **Given** a head that moved since a verdict that cannot say which results a change affects, **when** I run analyze to record answers, **then** it judges the whole pull request again and says why

## Notes

The new verdict supersedes the earlier one, so close and the merge pre-check read the answers with no change to how they pick a verdict.

### Story #862: The pull request's verdict carries what close writes into its record

- **story_type:** user
- **size:** M

**As a** lead closing an epic, **I want** the pull request's verdict to carry the key decisions, every departure with its answer, and the deferred scope, **so that** close can write its record without reading the diff or asking me.

## Acceptance Criteria

- [ ] **Given** a reviewed pull request, **when** analyze publishes its verdict, **then** the verdict carries the key decisions: each record decision by its ID, tied to the record revision the verdict stamps, plus each decision stub the diff confirms with its reason and the alternative it beat
- [ ] **Given** an answered departure, **when** analyze publishes its verdict, **then** the verdict carries the answer, who accepted it and the link to the answering comment
- [ ] **Given** a departure marked as superseding, **when** analyze publishes its verdict, **then** the verdict names the record decision it supersedes and what the code does instead
- [ ] **Given** scope a story or the record called for that the pull request leaves out, **when** analyze publishes its verdict, **then** the verdict proposes it as deferred scope with an ID, and a trusted person's comment naming that ID approves it
- [ ] **Given** a verdict published before this change, **when** close or the merge pre-check reads it, **then** the read succeeds

### Story #863: Analyze run without a pull request reports in the terminal only

- **story_type:** user
- **size:** S

**As a** lead running analyze without a pull request, **I want** the result reported in the terminal only, **so that** no file is left behind that no stage reads.

## Acceptance Criteria

- [ ] **Given** an epic analyzed without a pull request, **when** analyze finishes, **then** it reports the result in the terminal and writes no file
- [ ] **Given** the fix lane, the intake lane, close, the issue-reference rules and the implement scripts, **when** a lead reads them, **then** none of them names the local analysis file, and the implement scripts' fix rounds work from the result analyze reported in the terminal
- [ ] **Given** a local analysis run, **when** close runs afterwards, **then** close behaves exactly as it would with no local run

## Assumptions

- #828 has shipped, so the trusted comment reader and the widened read of a story's pull requests exist.
- A trusted person is an author who can speak for the repository, as the existing trusted-author filter decides.

## Out of Scope

- Close reading the verdict to write its record, and the removal of close's own diff reading (#830).
- Any change to distill.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #858 | none |
| #859 | #841, #847 |
| #860 | #856, #858 |
| #861 | #846, #860 |
| #862 | #857, #860 |
| #863 | #859 |
