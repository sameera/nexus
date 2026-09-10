---
feature: "Multi-Repo Workspaces"
feature_path: docs/features/multi-repo-workspaces
epic: "One Epic Receipt, Aggregated From the Story Verdicts"
slug: aggregated-epic-receipt
created: 2026-09-08
type: enhancement
complexity: M
complexity_drivers: [collection across several pull requests, two staleness axes over a set rather than one commit, cross-story assessment that no single story can carry]
concepts: []
link: "#212"
record: "#505"
record_state: closed
---

# Epic: One Epic Receipt, Aggregated From the Story Verdicts

## Description

The close gate asks one question: did conformance run, and is its answer still current? When an epic shipped as a single pull request, one verdict answered that. When an epic ships as several story pull requests, there are several verdicts and no single one that speaks for the epic.

This epic derives that missing answer. It gathers each story's verdict from the pull request where it was published, checks each one against its own pull request rather than against a single commit, and produces one epic receipt the close gate reads. Nothing is re-analyzed. The story verdicts already exist and are the input.

Two things can only be judged over the whole epic, and they are judged here. The epic's success metrics are properties of the finished capability, so no single story's pull request can be scored against them. A decision-record invariant that spans two stories is the same case. Both are assessed against the combined code of every story pull request.

An epic that never shipped story by story is unaffected. When no story carries a verdict, the full-epic conformance run happens exactly as it does today.

## Success Metrics

- A close over several story pull requests is gated on one derived epic receipt, with no re-run of conformance.
- A story whose verdict no longer matches its own pull request is named individually, never folded into a single statement about the epic.
- Every epic success metric and every cross-story invariant is judged against the combined code of the story pull requests, never against a single one.
- An epic with no story verdicts closes exactly as it does today.

## Personas

Per `docs/product/context.md`. The actor throughout is the delivery lead, who runs the close gate and decides whether to proceed on a stale verdict.

## Smallest Usable Version

Derive one epic receipt from the story verdicts; Name each story whose verdict is out of date.

## User Stories

### Story #496: Derive one epic receipt from the story verdicts

- **story_type:** system
- **size:** M

**As a** delivery lead, **I want** one epic receipt derived from the verdicts already published on the story pull requests, **so that** the close gate has something to read without me re-running conformance over the whole epic.

## Acceptance Criteria

- [ ] **Given** an epic whose stories were each analyzed on their own pull request, **when** the lead runs the conformance stage against that epic, **then** one epic receipt is derived from those story verdicts and no conformance run is repeated. The close gate consumes that receipt and never derives it.
- [ ] **Given** that derivation, **when** a story of the epic carries no verdict on any of its pull requests, **then** the derivation stops and names that story.
- [ ] **Given** more than one verdict for a single story across its pull requests, **when** the epic receipt is derived, **then** only the newest verdict on a pull request that is open or merged is used.
- [ ] **Given** the derived epic receipt, **when** the lead reads it, **then** it states the findings by severity summed over the stories, and names the pull requests it was derived from.

### Story #497: Name each story whose verdict is out of date

- **story_type:** user
- **size:** S

**As a** delivery lead, **I want** to be told which story's verdict has gone out of date, **so that** I re-run conformance on that one pull request rather than on the whole epic.

## Acceptance Criteria

- [ ] **Given** a story verdict whose analyzed commit is not the head of that story's pull request, **when** the epic receipt is derived, **then** that story is reported as out of date, by name.
- [ ] **Given** two stories whose verdicts are out of date, **when** the epic receipt is reported, **then** each is named separately rather than collapsed into one statement about the epic.
- [ ] **Given** every story verdict current against its own pull request, **when** the epic receipt is derived, **then** it is reported as current and the close gate proceeds without prompting.

### Story #498: Judge what only the whole epic can be judged against

- **story_type:** system
- **size:** M

**As a** delivery lead, **I want** the epic's success metrics and its cross-story invariants judged over the combined code, **so that** the things no single story could satisfy are actually checked before the epic closes.

## Acceptance Criteria

- [ ] **Given** the derived epic receipt, **when** it is produced, **then** it reports the epic's success metrics against the combined code of every story pull request.
- [ ] **Given** a decision-record invariant that spans two stories, **when** the epic receipt is produced, **then** that invariant is reported against the combined code rather than against either story alone.
- [ ] **Given** a finding that only the combined code shows, **when** the epic receipt is reported, **then** it is attributed to the epic and not to a single story.

### Story #499: An epic with no story verdicts closes as it does today

- **story_type:** user
- **size:** S

**As a** delivery lead, **I want** an epic that never shipped story by story to behave exactly as it does now, **so that** this change costs nothing to the flow I already use.

## Acceptance Criteria

- [ ] **Given** an epic none of whose stories carries a verdict, **when** the lead runs the close gate, **then** the full-epic conformance run happens as it does today.
- [ ] **Given** an epic where some stories carry a verdict and some do not, **when** the derivation runs, **then** it stops and names the stories without one, and the close gate reports that state rather than silently mixing the two paths.
- [ ] **Given** a story marked as shipping without a pull request of its own, **when** the derivation determines coverage, **then** that story is excluded from the coverage requirement and the epic receipt names it as excluded.

## Assumptions

- The derived epic receipt lives beside the epic's materialized planning copy, under the ignored scratch area, and is never committed.
- The story verdicts are read from the pull requests where they were published, under the trust rules already applied to a single pull request's verdict.
- Every story verdict of one epic stamps the same decision-record digest when it ran in full mode, so the design-staleness axis stays one comparison over the whole epic.

## Out of Scope

- Running conformance per story, which is #211.
- Closing an epic over several story pull requests, which is #213.
- Changing what a single story's verdict contains, which #211 settles.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #496 | none |
| #497 | #496 |
| #498 | #496 |
| #499 | #496 |
