---
feature: "Multi-Repo Workspaces"
feature_path: docs/features/multi-repo-workspaces
epic: "Retire the Member Close-and-Migrate Path"
slug: retire-member-close-and-migrate
created: 2026-09-08
type: enhancement
complexity: M
complexity_drivers: [a deletion spanning a command a helper and a library, a one-time relocation of work already in flight that must not strand an entry, a refusal an approved decision record deliberately kept]
concepts: []
link: "#215"
record: "#514"
record_state: closed
---

# Epic: Retire the Member Close-and-Migrate Path

## Description

A member repository has two ways to close an epic. The close-and-migrate path runs the close on the feature branch and then moves the resulting entry into the hub, so the hub can drain it later. The hub-born path closes over the epic's merged pull requests and needs no move at all, because the entry is born in the hub in the first place.

Keeping both is what makes the member case hard to reason about. Close still refuses a member, because the close-and-migrate path is what a member close means today, and that refusal is what stops a lead from silently taking the wrong one. Once the hub-born path is proven end to end, the close-and-migrate path has no case left, and the refusal it justified goes with it.

This epic deletes the close-and-migrate path. The member-specific close steps go, the helper that performed the move goes, and the refusal that pointed at it is lifted. Something is left behind, though: an entry already sitting in a member's queue when this lands has no owner once the move that would have collected it no longer exists. Those entries are relocated once, deliberately, as part of this change.

After this, the merge of the drain's own pull request is the only thing anywhere in the system that removes a queue entry.

## Success Metrics

- A member repository closes an epic the same way a single repository and a hub do, with no member-specific step.
- No entry is stranded in a member queue by the deletion; every one that existed when this landed is drainable from the hub.
- The merge of the drain's pull request is the only remaining way a queue entry is removed.

## Personas

Per `docs/product/context.md`. The actor throughout is the delivery lead, who closes epics and runs the drain.

## Smallest Usable Version

Relocate the entries already sitting in member queues; Retire the close-and-migrate path.

## User Stories

### Story #510: Relocate the entries already sitting in member queues

- **story_type:** system
- **size:** M

**As a** delivery lead, **I want** every entry already waiting in a member's queue moved into the hub before the old path is deleted, **so that** closed work is not stranded where nothing will ever collect it.

## Acceptance Criteria

- [ ] **Given** a workspace whose members hold entries in their queues, **when** the relocation runs, **then** every one of those entries is in the hub queue afterwards and drainable from there.
- [ ] **Given** an entry that names the repository it came from, **when** it is relocated, **then** it still names that repository, so the drain reads its changes in the right place.
- [ ] **Given** the relocation has already run, **when** it is run again, **then** it moves nothing and says so.
- [ ] **Given** an entry the relocation cannot move, **when** the relocation runs, **then** it stops and names that entry rather than deleting the old path with work still behind it.

### Story #511: Retire the close-and-migrate path

- **story_type:** user
- **size:** M

**As a** delivery lead, **I want** the close-and-migrate path gone and a member epic closing exactly as a hub epic does, **so that** I stop having to know which kind of repository I am standing in, and nobody reaches for a path that no longer has a case.

## Acceptance Criteria

- [ ] **Given** a member epic whose pull requests have merged, **when** the lead closes it, **then** the close runs the same way it does for a hub epic, with no member-specific step, and is not refused on the grounds that the repository is a member.
- [ ] **Given** a completed close, **when** the lead looks for the entry, **then** it is drainable from the hub and nothing moved it there.
- [ ] **Given** this change has landed, **when** anyone looks for the member close steps or the helper that performed the move, **then** both are gone rather than left dormant.
- [ ] **Given** a lead who invokes the close-and-migrate path by name, **when** they do so, **then** they are told it no longer exists and which path replaces it.
- [ ] **Given** the deletion, **when** a queue entry is removed by any code path in the pipeline, **then** the path that removed it is the merge of the drain's pull request.

**Reason for five:** the deletion, the refusal it lifts, and the replacement behaviour are one change that cannot ship in parts, so the criteria that pin each of them belong to one story.

## Assumptions

- The hub-born path is proven end to end before this epic ships, which is why it is held behind #213 and #214 rather than behind the code merely compiling.
- What the close-and-migrate path is today is legacy rather than live, because issue-sourced planning already superseded it.
- The relocation is run once by the lead as part of this change, not automatically on every close.

## Out of Scope

- Closing an epic over several merged pull requests, which is #213.
- Draining an entry whose range is a list, which is #214.
- Changing how the drain removes an entry, which is already the merge of its own pull request.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #510 | none |
| #511 | #510 |
