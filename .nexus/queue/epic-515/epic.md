---
feature: "Landed Change Intake"
feature_path: docs/features/landed-change-intake
epic: "The epic-classification and cross-kind collision refusals move into nxs-landed-reference"
slug: landed-reference-shared-refusals
created: 2026-09-11
type: enhancement
complexity: M
complexity_drivers: [shared rule consumed by two independent commands (/nxs.fix, /nxs.intake), new same-kind vs cross-kind distinction must hold consistently across both lanes]
concepts: []
link: "#515"
record: "#544"
record_state: closed
---

# Epic: The epic-classification and cross-kind collision refusals move into nxs-landed-reference

## Description

`/nxs.fix` already refuses two situations before it writes anything: a reference that carries the repository's epic classification, and a reference whose number already has an entry recorded as an epic's own materialization. `/nxs.intake` has neither refusal today, so it can be run against an epic reference, or against a number that already has a fix entry, and it proceeds to draft an intake entry anyway.

The two lanes share almost every other rule through the `nxs-landed-reference` skill, but this pair of refusals still lives only inside `/nxs.fix`'s own command file. A rule stated in one place can drift from a rule stated in another without either author noticing.

This epic gives `/nxs.intake` the same two refusals `/nxs.fix` already has, generalized so a lane refuses when the same number already carries an entry of the other lane's kind, a cross-kind collision, rather than only checking against an epic. The rule moves into `nxs-landed-reference` once, so both lanes load it instead of restating it, and `/nxs.fix` gains the same cross-kind check against an existing intake entry that it does not have today. Running a lane again against a number that already has an entry of its own kind is not a collision. It rewrites that entry in place, so correcting or refreshing a recorded entry never requires deleting it first.

## Success Metrics

- `/nxs.intake` refuses a reference already classified as an epic, the same way `/nxs.fix` already does.
- `/nxs.intake` refuses a reference whose number already has a `/nxs.fix` entry, and `/nxs.fix` refuses a reference whose number already has an `/nxs.intake` entry.
- Re-running either lane against a reference that already has an entry of its own kind rewrites that entry in place, producing no collision refusal and no duplicate entry.
- The epic-classification refusal and the collision refusal are stated once, in `nxs-landed-reference`, and neither lane's command file restates them inline.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

Story 1: Shared refusal rules move into nxs-landed-reference; Story 2: `/nxs.intake` refuses an epic reference and a cross-kind collision; Story 3: Re-recording the same kind rewrites the entry in place.

## User Stories

### Story #541: Shared refusal rules move into nxs-landed-reference

**As a** maintainer of the landed-change lanes, **I want** the epic-classification refusal and the same-number collision refusal stated once in `nxs-landed-reference`, **so that** `/nxs.fix` and `/nxs.intake` load the same rule instead of each restating it.

## Acceptance Criteria

- [ ] **Given** `nxs-landed-reference`'s existing sections A through D, **when** this story lands, **then** the skill also states, in one new section, the epic-classification refusal and the same-number collision refusal, worded so either lane applies it by substituting its own command name.
- [ ] **Given** a reference whose number already has an entry of the caller's own kind and one whose number already has an entry of the other lane's kind, **when** the new section states the collision rule, **then** it states these as two distinct outcomes: a same-kind match and a cross-kind collision.
- [ ] **Given** `/nxs.fix`'s own Phase 2, **when** it is refactored to load the new shared section instead of restating its refusal inline, **then** it also refuses when the same number already has an `/nxs.intake` entry, a case it does not check today.
- [ ] **Given** `/nxs.fix`'s refusal for a reference already classified as an epic, or already colliding with an existing epic materialization, **when** this story lands, **then** that refusal is unchanged from before this story.
- [ ] **Given** two entries in a hub checkout that share a number but belong to different member repositories, **when** the new section states the collision rule, **then** it states that a slot is occupied only when the candidate entry's recorded reference resolves to the same repository as the reference being checked, and that an entry with no readable recorded reference is still treated as occupying the slot.
- [ ] **Given** an issue with a merged closing pull request, or a pull request that closes an issue, **when** the new section states the collision rule, **then** it states the check also covers the closing pull request's number or the closed issue's number, within the same repository, not only the reference's own number.

## Notes

Follow Section A's existing pattern of substituting `<lane-command>` for the calling lane's own command name, rather than inventing a second substitution convention for the new section.

### Story #542: /nxs.intake refuses an epic reference and a cross-kind collision

**As a** developer, **I want** `/nxs.intake` to refuse a reference that is an epic, and refuse a reference whose number already has a fix entry, **so that** I get the same guardrails `/nxs.fix` already gives me, instead of an intake entry silently colliding with either.

## Acceptance Criteria

- [ ] **Given** a reference that carries the repository's declared epic classification, **when** I run `/nxs.intake` against it, **then** it stops and writes nothing, reporting that the reference is an epic and naming `/nxs.epic` as the owning lane.
- [ ] **Given** a reference whose number already has a `/nxs.fix` entry recorded, **when** I run `/nxs.intake` against that same number, **then** it stops and writes nothing, reporting the colliding fix entry.
- [ ] **Given** a reference whose number already has an epic materialization recorded, **when** I run `/nxs.intake` against that same number, **then** it stops and writes nothing, reporting the colliding materialization.
- [ ] **Given** either refusal applies, **when** `/nxs.intake` runs, **then** it reports the refusal before Phase 3's diff check runs, so no partial work happens first.
- [ ] **Given** a pull request that closes an issue already carrying a `/nxs.fix` entry or an epic materialization, **when** I run `/nxs.intake` against that pull request, **then** it stops and writes nothing, reporting the collision reached through the closed issue.

### Story #543: Re-recording the same kind rewrites the entry in place

**As a** developer, **I want** re-running `/nxs.fix` or `/nxs.intake` against a reference that already has an entry of that lane's own kind to rewrite the entry in place, **so that** I can correct or refresh a recorded entry without a collision refusal blocking me.

## Acceptance Criteria

- [ ] **Given** a number that already has a `/nxs.fix` entry, **when** I run `/nxs.fix` again against that same number, **then** it rewrites the existing entry in place instead of refusing it as a collision.
- [ ] **Given** a number that already has an `/nxs.intake` entry, **when** I run `/nxs.intake` again against that same number, **then** it rewrites the existing entry in place instead of refusing it as a collision.
- [ ] **Given** a number whose existing entry is of the other kind, **when** the lane is run against it, **then** it still refuses as a cross-kind collision, and rewriting never happens across kinds.
- [ ] **Given** a rewrite, **when** it completes, **then** the entry's directory holds the same two files it always holds, replaced with freshly derived content, and carries no leftover content from the version it replaced.
- [ ] **Given** a number whose existing entry of the caller's own kind records a different reference than the one being checked, **when** the lane is run against it, **then** it refuses rather than rewriting.
- [ ] **Given** a match found through a closing pull request or a closed issue rather than through the reference's own number, **when** the lane is run against it, **then** it always refuses, whatever kind the matched entry is, and rewriting never happens through a linked number.
- [ ] **Given** an existing `/nxs.intake` entry that already recorded filed deferred-scope issues, **when** I run `/nxs.intake` again against that same reference, **then** it refuses the rewrite, naming the already-filed issues and the remove-and-re-run alternative.

## Assumptions

- The refusal wording the new skill section states matches `/nxs.fix`'s current wording, substituting the lane name and the colliding kind.
- Rewriting an entry in place means regenerating both its files from a fresh derivation, using the same phases the lane already runs, not patching the old files.

## Out of Scope

- Migrating or reconciling entries recorded before this story ships.
- Any change to `/nxs.epic`'s own handling of a reference that collides with a fix or intake entry.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #541 | none |
| #542 | #541 |
| #543 | #541 |
