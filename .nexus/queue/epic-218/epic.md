---
feature: "Issue-Sourced Planning"
feature_path: docs/features/issue-sourced-planning
epic: "Retire the Sequencing Page Into Issue State"
slug: sequencing-page-retirement
created: 2026-08-30
type: enhancement
complexity: S
complexity_drivers: [documentation-only change, no code paths touched, three independent single-surface stories]
concepts: []
link: "#218"
---

# Epic: Retire the Sequencing Page Into Issue State

## Description

`docs/delivery/sequencing.md` was written when the backlog lived in seven committed per-feature files with no cross-feature view. It carried the inventory, the wave ordering, and the editorial rationale for one dependency chain. Epic #185 replaced the inventory with a single issue query, and the epic filer now wires wave ordering as native `blocked_by` edges on the issues themselves — so two of the page's three jobs are already done elsewhere. What remains is a hand-maintained surface that has drifted: its Wave 1 and Wave 2 rows read as future work while #114, #121, #139 and #157 are closed, it covers roughly ten of the thirty-nine open stubs, and it declares #197 dropped while the authoritative backlog query still lists #197 as live work.

This epic retires the page by moving each surviving piece of it to the durable surface that already owns that piece. Ordering needs no move — it is already on the issues. The per-item rationale moves into the stub bodies it describes, where a reader promoting a stub will actually encounter it. The drop and supersession verdicts stop being prose and become issue state, which resolves the standing disagreement between the page and the query by applying the page's verdict to the issues — the page is right about #197 and the query is merely uncorrected, so the query becomes accurate and thereafter is the only surface anyone need read. Then the file is deleted.

The value is one fewer surface that must be hand-reconciled on every promotion or re-scope, and the removal of an active contradiction between two views of the same backlog. The page's transcription cost is already visible — #185 numbered every wave-table entry, so each promotion touches the page as well as the issue — and that cost buys nothing the issues do not now carry.

## Success Metrics

- The repository contains no `docs/delivery/sequencing.md` and no reference to it from any tracked file.
- Every verdict the page recorded about a still-open stub is reflected in that issue's state or body, so the backlog query alone is sufficient to know what is live.
- The backlog query returns no issue the retired page declared dropped or superseded.
- No wave-ordering edge the page described is lost: each remains readable as a native `blocked_by` dependency on the issues.

## Personas

Per `docs/product/context.md`.

## User Stories

### Story #402: Surviving rationale moves onto the stubs it describes

**As a** delivery lead promoting a backlog stub, **I want** the ordering rationale that explains why that stub sits where it does to be in the stub's own issue body, **so that** I do not need the sequencing page to understand the item I am about to plan.

## Acceptance Criteria

- [ ] **Given** the sequencing page records a "why first" or wave rationale for a still-open stub, **when** that rationale is not already present in the stub's issue body, **then** it is added to that body as a note attributed to its source epic and date.
- [ ] **Given** a rationale line that names a dependency already expressed as a `blocked_by` edge, **when** the move is made, **then** the edge is not restated as prose — only the reasoning the edge cannot express is carried.
- [ ] **Given** the page's "one decision behind all of it" narrative describes what #215 retires, **when** the move is made, **then** #215's body carries that supersession context.
- [ ] **Given** a rationale line describes an item that is now closed, **when** the move is made, **then** it is dropped rather than relocated.
- [ ] **Given** every rationale line in the page, **when** this story completes, **then** each has been either moved to an open issue or explicitly dropped, with no line left unaccounted for.

## Notes

The still-open stubs the page carries rationale for are #132, #209, #211, #212, #213, #214, #215 and #216.

The Wave 3 note that #213 absorbs the producer side of #209 is already present in #209's body and needs no move — verify rather than duplicate.

Rationale attached to already-closed items (#114, #121, #139, #157, #109) is dropped by design: a closed item's ordering no longer informs any decision.

### Story #403: The drop and supersession verdicts become issue state

**As a** delivery lead reading the backlog query, **I want** work the sequencing page declared dead to be absent from the query, **so that** the query is trustworthy on its own and does not need the sequencing page to correct it.

## Acceptance Criteria

- [ ] **Given** #197 is an open backlog stub that the page declares dropped, **when** this story completes, **then** #197 is closed as not planned with a comment stating why the drop was decided.
- [ ] **Given** the page names items superseded before they were ever filed, **when** this story completes, **then** each has been confirmed to have no open issue, so no verdict is left without a home.
- [ ] **Given** the backlog query after this story, **when** it is run, **then** it returns no issue the page declared dropped or superseded.
- [ ] **Given** an item is closed as a result of this story, **when** the close is made, **then** the reason is not planned rather than completed, because nothing was delivered.

## Notes

#197's drop rationale, per the page: its premise is reconciling the post-merge worktree flow with the member's pre-merge close-and-migrate choreography, but issue-sourced planning runs analyze/close from the hub against member PRs and deletes the member-unsupported gate, and #215 then removes close-and-migrate entirely — so building it invests in the path being retired.

The two never-filed items are `hub-design-gate` (superseded by #139) and `entry-abandonment` (superseded by #114). Both supersessions are already recorded on closed issues, so confirming they carry no open issue is the whole of the work — nothing new is written for them.

Ask for the backlog query rather than spelling the label out: `nexus-gh config backlog-query`.

### Story #404: The page is deleted and nothing dangles

**As a** contributor browsing the delivery-planning space, **I want** the sequencing page gone rather than narrowed, **so that** no stale wave table is reachable and the backlog query is the only inventory.

## Acceptance Criteria

- [ ] **Given** the repository after this story, **when** searching tracked files for the path `docs/delivery/sequencing.md`, **then** zero matches are returned.
- [ ] **Given** the repository after this story, **when** searching tracked markdown for a link whose target resolves to the deleted file, **then** zero matches are returned.
- [ ] **Given** an existing lesson file mentions the page by name in past tense as a historical record, **when** this story completes, **then** that mention is left unchanged, because a lesson describes what happened rather than pointing at a live surface.

## Notes

This story is blocked by #402 and #403: the page is the source both of them read from, so it is deleted last.

A link check confirmed at planning time that no tracked markdown links to the page; the only textual mentions are past-tense prose in `docs/delivery/lessons/`. The acceptance criteria assert this rather than assume it, so a link added between planning and implementation is caught.

## Assumptions

- The wave ordering the page transcribes is fully expressed by the native `blocked_by` edges already wired on #211 through #216 and #209; a verification pass is part of Story 1 rather than a separate story.
- No milestone or project convention is introduced. The repository runs with `github.project: none`, and adding a wave-to-milestone mapping would be new machinery this epic explicitly does not build.
- The rationale moved in Story 1 is copied as it stands, not rewritten. Re-deriving why an item was ordered where it was is out of scope; the goal is that nothing load-bearing dies with the file.
- Rationale attached to already-closed items is dropped rather than relocated, because a closed item's ordering no longer informs any decision.

## Out of Scope

- Re-sequencing the remaining work. This epic moves and deletes; it does not revisit whether the wave order is still correct.
- Any replacement for the sequencing page, in any form — a narrowed page, a milestone view, or a project board.
- Promoting, re-scoping or re-estimating any of the stubs whose rationale is moved.
- Rationale belonging to closed items, which is dropped by design rather than archived.
- Editing the historical lesson files that mention the page in past tense.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #402 | none |
| #403 | none |
| #404 | #402, #403 |
