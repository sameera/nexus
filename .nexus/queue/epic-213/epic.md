---
feature: "Multi-Repo Workspaces"
feature_path: docs/features/multi-repo-workspaces
epic: "Close an Epic Over Several Merged Pull Requests"
slug: close-epic-over-merged-prs
created: 2026-09-08
type: enhancement
complexity: M
complexity_drivers: [a gate that must hold over a set rather than one pull request, per-pull-request range derivation that a wrong value silently corrupts, an exception path the lead must be able to take]
concepts: []
link: "#213"
record: "#509"
record_state: closed
---

# Epic: Close an Epic Over Several Merged Pull Requests

## Description

Close today speaks for one pull request. It waits for that pull request to merge, derives the exact commits it landed, cuts a branch, writes the close artifacts, and hands off to the drain. An epic whose stories shipped as several pull requests has no such single pull request, so close has nothing to anchor on.

This epic teaches close to speak for a set. The close artifacts are what a close writes; the close record is the one among them that carries the commits and the rationale. The gate now asks its questions of every story: is the story closed, did its pull request merge, and is the epic receipt current. The commits close records become a list, one entry per story pull request, each anchored on that pull request's own merge commit. That list shape is the one a cross-repository epic will need later, so it is built once here rather than twice.

The reason each entry is anchored on its own merge commit is that the obvious shortcut is wrong. A single span from the first pull request's base to the last one's head would sweep in every unrelated commit that landed between them, and the drain would then rewrite pages that this epic never touched.

Not every story ships its own pull request. A story implemented inside a sibling's pull request has none, and the gate must not treat that as a missing merge. The lead waives it explicitly, story by story, and the waiver is recorded.

## Success Metrics

- An epic whose stories shipped as several pull requests closes without the lead assembling anything by hand.
- The commits recorded for the epic are exactly those its own pull requests landed, and no commit that landed between them.
- A story that shipped without its own pull request is closed only through a waiver the lead gave, and the close record names it.

## Personas

Per `docs/product/context.md`. The actor throughout is the delivery lead, who runs the close gate and decides whether to waive.

## Smallest Usable Version

Gate the close on every story pull request being merged; Record one range entry per story pull request; Write the close artifacts on one branch for the whole epic.

## User Stories

### Story #500: Gate the close on every story pull request being merged

- **story_type:** system
- **size:** M

**As a** delivery lead, **I want** the close gate to ask its questions of every story rather than of one pull request, **so that** an epic cannot close while part of it is still unmerged or unchecked.

## Acceptance Criteria

- [ ] **Given** an epic whose stories shipped as several pull requests, **when** the lead runs the close gate, **then** it proceeds only if every story is closed and every one of those pull requests is merged.
- [ ] **Given** one story pull request still open, **when** the lead runs the close gate, **then** the run stops and names that pull request and its story.
- [ ] **Given** every story pull request merged but the epic receipt out of date, **when** the lead runs the close gate, **then** the existing choice between stopping and waiving is offered, and the waiver the lead gives is recorded.

### Story #501: Record one range entry per story pull request

- **story_type:** system
- **size:** M

**As a** delivery lead, **I want** the close record to hold one entry per story pull request, each anchored on that pull request's own merge, **so that** the drain later reads exactly what this epic landed and nothing that landed beside it.

## Acceptance Criteria

- [ ] **Given** an epic closed over three story pull requests, **when** the close record is written, **then** it holds three entries, one per pull request, each naming the pull request it came from.
- [ ] **Given** each entry, **when** it is written, **then** it covers only what that pull request landed, anchored on that pull request's own merge rather than on its branch tip.
- [ ] **Given** three story pull requests in the same repository, **when** the close record is written, **then** all three entries are kept, rather than one entry standing for the repository.
- [ ] **Given** a story pull request whose landed commits cannot be determined unambiguously, **when** the close record would be written, **then** the run stops rather than recording a range it could not verify.
- [ ] **Given** a close record holding several entries for one repository, **when** a drain that cannot yet read that shape encounters it, **then** it refuses the entry by name rather than draining one entry and dropping the rest.

### Story #502: Waive a story that shipped without its own pull request

- **story_type:** user
- **size:** S

**As a** delivery lead, **I want** to waive a story that shipped inside a sibling story's pull request, **so that** a real delivery pattern does not read to the gate as an unmerged story.

## Acceptance Criteria

- [ ] **Given** a closed story with no pull request of its own, **when** the lead runs the close gate, **then** the run stops, names that story, and offers to waive it.
- [ ] **Given** the lead waives that story, **when** the close record is written, **then** it names the story that was waived and the date of the waiver.
- [ ] **Given** the lead does not waive it, **when** the close gate runs, **then** the epic does not close.

### Story #503: Write the close artifacts on one branch for the whole epic

- **story_type:** system
- **size:** S

**As a** delivery lead, **I want** one branch carrying the close artifacts for the whole epic, **so that** the drain has a single thing to continue from however many pull requests the epic took.

## Acceptance Criteria

- [ ] **Given** an epic closed over four story pull requests, **when** the close artifacts are written, **then** there is one branch carrying them all, not one branch per pull request.
- [ ] **Given** that branch, **when** the close run finishes, **then** it is pushed and the drain continues from that same branch.
- [ ] **Given** an epic whose engineers left notes on four different pull requests, **when** the close run gathers the rationale, **then** every one of those notes is present in that branch.

## Assumptions

- The epic receipt the gate reads is the one #212 derives, and this epic changes neither its shape nor where it lives.
- The list of range entries is the shape a cross-repository epic will use later, so it is not a form specific to one repository.
- A member epic's close still takes the older feature-branch path until #215 retires it, so both paths exist while this epic ships.

## Out of Scope

- Aggregating the story verdicts into the epic receipt, which is #212.
- Draining an entry whose range is a list, which is #214.
- Retiring the member close-and-migrate path, which is #215.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #500 | none |
| #501 | #500 |
| #502 | #500 |
| #503 | #501 |
