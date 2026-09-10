---
feature: "Multi-Repo Workspaces"
feature_path: docs/features/multi-repo-workspaces
epic: "Analyze a Member Story Pull Request From the Hub"
slug: analyze-member-pr-per-story
created: 2026-09-08
type: enhancement
complexity: M
complexity_drivers: [cross-repo resolution, per-story scoping of an epic-level gate, a published verdict two later stages consume]
concepts: []
link: "#211"
record: "#495"
record_state: closed
---

# Epic: Analyze a Member Story Pull Request From the Hub

## Description

A multi-repo workspace plans an epic in the hub and ships its code in a member repository. The stories of one epic arrive as several pull requests in that member. Today the conformance gate cannot look at any of them: the pull-request flow refuses a member outright, and when it does run it checks a whole epic at once rather than the one story a pull request implements.

This epic makes the gate work at the grain the work actually arrives in. The lead stands in the hub, names a member's pull request, and gets a conformance verdict for the single story that pull request implements — checked against that story's acceptance criteria and the epic's decision record, at the code the pull request actually proposes. The verdict is published on the pull request, where the reviewer sees it in the merge box.

The verdict also has to survive the run, because two later stages consume it: the epic-level receipt is aggregated from the story verdicts, and close is gated on that aggregate. So the published verdict names which story it covers. Nothing is committed here. Under issue-sourced planning the queue entry is born at close, so at the time a story pull request is analyzed there is no entry to write a file into.

## Success Metrics

- A story pull request in a declared member repository is analyzed from the hub with no step the lead performs outside the gate.
- Every story pull request of one epic carries its own verdict, and each verdict is attributable to exactly one story.
- No conformance run is refused on the grounds that the code is in a member repository.

## Personas

Per `docs/product/context.md`. The actor throughout is the delivery lead: the person who plans the epic in the hub and gates its stories, and who does not write the story's code.

## Smallest Usable Version

Analyze a member repository's pull request from the hub; Check the one story the pull request implements.

## User Stories

### Story #492: Analyze a member repository's pull request from the hub

- **story_type:** system
- **size:** M

**As a** delivery lead, **I want** the conformance gate to run against a pull request in a declared member repository while I am standing in the hub, **so that** I can gate a member epic's stories from the place the epic was planned.

## Acceptance Criteria

- [ ] **Given** a hub checkout whose workspace declares a member repository, **when** the lead runs the conformance gate against a pull request in that member, **then** the gate reads that member's code at the commit the pull request proposes.
- [ ] **Given** that run, **when** the gate reports which repository and which commits it read, **then** it names the member repository, not the hub.
- [ ] **Given** a hub checkout, **when** the lead names a pull request in a repository the workspace does not declare, **then** the run stops and says that repository is not a declared member.
- [ ] **Given** a declared member that is not checked out where the workspace expects it, **when** the lead runs the gate against one of its pull requests, **then** the run stops and names where the checkout was expected.

## Notes

The refusal this removes is the one that rejects a member outright. It was correct while a member's close ran on its feature branch and migrated its entry to the hub; that path is retired separately by #215.

### Story #493: Check the one story the pull request implements

- **story_type:** user
- **size:** M

**As a** delivery lead, **I want** the verdict on a story pull request to cover that story and no other, **so that** a pull request is not marked failing for work its siblings have not landed yet.

## Acceptance Criteria

- [ ] **Given** an epic whose stories ship as separate pull requests, **when** the lead runs the conformance gate against one of them, **then** the findings cover that pull request's story's acceptance criteria and no other story's.
- [ ] **Given** that same run, **when** the gate reports, **then** it also reports the code against the epic's decision record invariants.
- [ ] **Given** a pull request that resolves to no story of the epic, **when** the lead runs the gate against it, **then** the run stops and says which story it could not determine.
- [ ] **Given** an epic whose decision record is not approved, **when** the lead runs the gate against one of its story pull requests, **then** the run stops and publishes nothing.

## Notes

The engineer's committed scratch is read where it exists and changes no verdict where it does not.

### Story #494: The published verdict names the story it covers

- **story_type:** system
- **size:** S

**As a** delivery lead, **I want** each story's verdict to be separately identifiable, **so that** the epic-level receipt can be aggregated from the story verdicts rather than re-derived.

## Acceptance Criteria

- [ ] **Given** a completed per-story run, **when** the verdict is published on the pull request, **then** the published verdict states the story, the pull request, the commit that was read, and the finding counts by severity.
- [ ] **Given** several story pull requests on one epic, **when** each has been analyzed, **then** each story's verdict is readable from its own pull request and attributable to that story alone.
- [ ] **Given** a story pull request analyzed more than once, **when** its verdict is read, **then** the most recent verdict for that story is the one that is read.

## Assumptions

- The story verdict's only durable home is the verdict published on the pull request. No per-story file is committed, because the queue entry is born at close and there is no entry to write into while the stories are still shipping.
- The epic issue and its story issues live in the hub's issue repository while the code pull requests live in the member repository, so resolving a pull request's story crosses repositories.
- Reading the engineer's committed scratch stays soft.

## Out of Scope

- Aggregating the story verdicts into one epic-level receipt, which is #212.
- Closing an epic over several story pull requests, which is #213.
- Retiring the member close-and-migrate path, which is #215.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #492 | none |
| #493 | #492 |
| #494 | #493 |
