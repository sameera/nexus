---
feature: "Multi-Repo Workspaces"
feature_path: docs/features/multi-repo-workspaces
epic: "Issue-Sourced Planning: Nothing Commits Until Close"
slug: issue-sourced-planning
created: 2026-07-21
type: enhancement
complexity: L
complexity_drivers:
  - New resolver tooling reconstructs the epic from the issue graph (story sub-issues + blocked_by) and must be deterministic and idempotent
  - End-to-end storage-model change across four commands (epic, hld, analyze, close) where the pipeline must not break mid-migration
  - Rewrites committed-queue invariants — the queue becomes a closed-only post-merge drain buffer, not a planning-time artifact
  - No pinned approved-baseline — downstream stages validate against live issue state; the staleness axis is deferred to sibling stubs
concepts: ["committed-queue", "epic-approval-gate", "distiller", "nexus-pipeline", "workspace-resolution"]
link: "#114"
---

# Epic: Issue-Sourced Planning: Nothing Commits Until Close

> ⚠️ **Utilization risk:** assessed L (1–2 weeks). Fills the sprint with no slack for overruns. Watch for scope creep — the migration across four commands is the risk surface; keep the pipeline runnable between merges.

## Description

Today a planned epic is a committed file. `/nxs.epic` writes `epic.md` into `.nexus/queue/` at
planning time, and every later stage — `/nxs.hld`, `/nxs.analyze`, `/nxs.close`, the distiller —
finds the epic by reading that committed file. The GitHub issues carry the same content a second
time, so the story text and acceptance criteria live in two places that drift: the issue is the
surface humans edit, the committed file is what the gates actually validate against.

This epic makes GitHub issues the single source of truth for epic and story planning. `/nxs.epic`
drafts in session scratch, runs the epic gate on the draft, and at approval files the epic issue
first and then the story sub-issues — committing nothing to the queue. A new resolver takes an epic
issue number and reconstructs the epic (body, story sub-issues, and the `blocked_by` graph) into an
ephemeral, gitignored `epic.md` that every downstream stage reads. The issue number is the
deterministic join key. Because nothing is committed at planning, the committed queue entry is born
at close: `/nxs.close` materializes the epic and writes the entry alongside its close record, so the
queue holds only closed, drainable entries.

The result collapses the two-copy drift, deletes the planned-entry lifecycle (there is no such thing
as a committed-but-unclosed entry), and lets any epic filed by hand — or by an engineer who never
ran `/nxs.epic` — enter the pipeline through the resolver. The change is pipeline-wide: single-repo
and workspace planning both stop committing at planning time, so there is one storage model, not
two.

## Success Metrics

- After `/nxs.epic` files an epic, the working tree shows **zero** new files under `.nexus/queue/` —
  planning writes only to session scratch.
- `/nxs.hld` and `/nxs.analyze` obtain the epic by resolving its issue number with **zero** reads of
  a committed planning-time queue file.
- Running the resolver twice against an unchanged issue graph produces **byte-identical**
  `epic.md` output (deterministic and idempotent).
- **100%** of entries present in `.nexus/queue/` on the trunk carry a close record — there are no
  planning-time (close-record-absent) entries.
- `/nxs.epic --from #<issue>` against an epic never planned in the current checkout produces an
  `epic.md` that `/nxs.hld` accepts as input.

## Personas

Per `docs/product/context.md` for the canonical set. This epic's actors are pipeline **roles**, not
end-user personas: the **PM** runs `/nxs.epic` to plan and file; the **Lead** runs `/nxs.hld`,
`/nxs.analyze`, and `/nxs.close`; an **Engineer** may run `/nxs.epic --from` to pull an epic they did
not plan. No new persona is introduced.

## User Stories

### Story 1: The resolver rebuilds an epic from its issue number

- **story_type:** system
- **size:** M

**As a** pipeline stage that needs the planned epic, **I want** a resolver that takes an epic issue
number and returns the epic body, its story sub-issues, and the `blocked_by` graph as a materialized
`epic.md`, **so that** every stage reads one consistent epic without a committed planning file.

#### Acceptance Criteria

- [ ] **Given** an epic issue with N story sub-issues, **when** the resolver runs against its number,
  **then** it emits a single `epic.md` containing the epic body and all N stories, and exits non-zero
  writing no `epic.md` if any referenced sub-issue cannot be fetched (no partial silent output).
- [ ] **Given** an unchanged issue graph, **when** the resolver runs twice, **then** the two
  materialized `epic.md` outputs are byte-identical.
- [ ] **Given** the resolver writes its output, **when** the working tree is inspected afterward,
  **then** the `epic.md` path is outside version control (gitignored / session scratch) and
  `git status` reports no new tracked file from the run.
- [ ] **Given** story sub-issues carrying native GitHub dependencies, **when** the resolver builds
  the graph, **then** the materialized `## Implementation Sequence` `blocked_by` column reproduces
  those dependencies exactly — every dependency edge appears and none is invented.

#### Notes

The resolver is the shared substrate every other story depends on. It ships independently and breaks
nothing (a stage can call it without any other change landing). Where a workspace is resolved it
targets the hub repo via the existing workspace resolver (#38); in single-repo it targets the local
repo. It reuses the same field shape `/nxs.epic` writes today so downstream parsers are unchanged.

### Story 2: Planning files issues and commits nothing

- **story_type:** system
- **size:** M

**As a** PM planning an epic, **I want** `/nxs.epic` to file the epic and story issues at approval
while committing nothing to the queue, **so that** GitHub issues are the single source of truth and
no planning-time file can drift from them.

#### Acceptance Criteria

- [ ] **Given** an approved epic draft, **when** `/nxs.epic` files, **then** the epic issue is
  created before any story sub-issue and the stories are created as its children (issue-first order).
- [ ] **Given** `/nxs.epic` has completed filing, **when** the working tree is inspected, **then**
  there is no new file under `.nexus/queue/` — the draft and all working notes were written only to
  session scratch.
- [ ] **Given** an epic issue was already filed in a prior run (its number is recorded in the
  session draft), **when** `/nxs.epic` is re-run, **then** no second epic issue is created and the
  existing number is reused.
- [ ] **Given** a filed epic, **when** it is addressed later, **then** it is fully re-resolvable from
  its issue number alone, with no dependency on a branch name or a committed queue path.

#### Notes

The digest approval remains the single scope gate and the epic gate still runs on the draft — this
story changes only what happens *after* approval (file, don't commit). Idempotency here covers the
retry case; the abandon case (issue filed, epic never pursued) is `entry-abandonment`'s scope and is
simpler under this model — abandoning is just closing the issue, since there is no committed entry to
delete.

### Story 3: `/nxs.epic --from #<issue>` pulls an existing epic

- **story_type:** user
- **size:** S

**As an** engineer or lead holding an epic already filed as GitHub issues (by Nexus or by hand),
**I want** `/nxs.epic --from #<issue>` to fetch it into a materialized `epic.md`, **so that** I can
run downstream stages against an epic I did not plan in this session.

#### Acceptance Criteria

- [ ] **Given** a filed epic issue with story sub-issues that was never planned via `/nxs.epic` in
  this checkout, **when** I run `/nxs.epic --from #<issue>`, **then** a materialized `epic.md` is
  produced that `/nxs.hld` accepts as input.
- [ ] **Given** an issue number that is not an epic (a story issue, or a non-existent number),
  **when** I run `/nxs.epic --from` against it, **then** it fails with a clear diagnostic naming why
  and produces no `epic.md`.
- [ ] **Given** `--from` resolves an epic, **when** it runs, **then** it commits nothing (the same
  no-commit contract as planning).

#### Notes

Thin wrapper over Story 1's resolver — its value is exercising the resolver against a hand-filed
epic, proving issues-as-source-of-truth works for epics Nexus did not author.

### Story 4: `hld` and `analyze` read the epic through the resolver

- **story_type:** system
- **size:** M

**As** the `hld` and `analyze` stages, **I want** to obtain the epic by resolving its issue number
rather than globbing a committed queue entry, **so that** they run correctly when nothing was
committed at planning.

#### Acceptance Criteria

- [ ] **Given** no committed queue entry exists for an epic, **when** `/nxs.hld` runs for that epic's
  issue number, **then** it obtains the epic via the resolver and proceeds — it does not fail with a
  "queue entry not found" error.
- [ ] **Given** the same, **when** `/nxs.analyze` runs, **then** it obtains the epic's stories,
  acceptance criteria, and success metrics via the resolver.
- [ ] **Given** a resolved epic, **when** a stage reads it, **then** the story set and success
  metrics it sees equal those on the GitHub issues at resolve time — no stale committed copy is
  consulted.

#### Notes

Scope is the **read** path only. Where `/nxs.hld`'s decision record *lives* (there is no committed
`epic.md` for it to sit beside) is the sibling stub `hld-subissue-record` and is out of scope here;
likewise `/nxs.analyze` reading that record. This story assumes the decision-record home is handled
there — see Assumptions.

### Story 5: The queue entry is born at close

- **story_type:** system
- **size:** M

**As** the distiller, **I want** `/nxs.close` to create the committed queue entry — the materialized
epic plus the close record — at close time, **so that** the queue holds only closed, drainable
entries and I have a complete entry to drain.

#### Acceptance Criteria

- [ ] **Given** an epic being closed, **when** `/nxs.close` runs, **then** it materializes the epic
  via the resolver and writes the committed queue entry (`epic.md` + `close-record.md`) as part of
  close.
- [ ] **Given** the trunk queue, **when** it is scanned, **then** every entry present carries a close
  record — no planning-time / close-record-absent entry exists.
- [ ] **Given** an entry created at close, **when** the distiller drains it, **then** it finds a
  complete `epic.md` and close record without requiring any planning-time commit.

#### Notes

Covers the single-PR / single-repo born-at-close case. The list-shaped range over N story PRs and
cross-repo close are `hub-close-multi-pr` / `multi-range-distill` and stay out of scope. The
PR-driven close (#101) already commits close artifacts post-merge on a distill branch; this story
adds materializing the epic into that same flow — it is not a second close mechanism.

## Assumptions

- The workspace resolver (#38) and the issue-filing skills (`nxs-gh-create-epic`,
  `nxs-gh-create-story`) exist and are reused; this epic does not rebuild them.
- **Decision-record home.** This epic changes how `/nxs.hld` and `/nxs.analyze` *read* the epic. It
  assumes the decision record has moved off the committed planning file (sibling stub
  `hld-subissue-record`, where the record becomes an `hld` sub-issue). Until that lands, `/nxs.hld`'s
  output home is an unresolved coherence dependency — the decision record for *this* epic should
  record the intended ordering.
- **No pinned approved-baseline.** With issues as the source of truth, downstream stages validate
  against issue state at resolve time, not a frozen approval snapshot. The "scope/design changed
  after approval" staleness axis is provided by the sibling stubs' content-hash mechanism
  (`hld_hash`), not by this epic. This trade is deliberate and belongs in the decision record.
- This epic is itself planned under the current commit-at-planning contract (its own queue entry is
  committed as normal) — the new contract does not exist until this epic ships.

## Out of Scope

- The decision-record home as an `hld` sub-issue — stub `hld-subissue-record`.
- The `nxs.pr` command and the scratch-derived deviation block — stub `nxs-pr-command`.
- Per-story analyze from the hub against member PRs and the epic-level receipt — stubs
  `story-analyze-hub`, `epic-analyze-receipt`.
- Multi-PR close and multi-range distill over a list-shaped range — stubs `hub-close-multi-pr`,
  `multi-range-distill`. Story 5 covers only single-PR / single-repo born-at-close.
- Retiring the member close-and-migrate path — stub `legacy-flow-retirement`.
- Extracting the GitHub transaction layer into the `nexus` CLI — stub `pipeline-gh-cli`.
- A pinned approved-baseline / snapshot-at-approval mechanism — deferred; downstream validates
  against live issue state (see Assumptions).

## Open Questions

<!-- None. The storage model (issues as source of truth, entry born at close) and the pipeline-wide
     scope were settled at the right-size gate before generation. -->

## Implementation Sequence

| STORY | Issue | blocked_by |
|---|---|---|
| STORY-114.01 | #115 | none |
| STORY-114.02 | #116 | STORY-114.01 |
| STORY-114.03 | #117 | STORY-114.01 |
| STORY-114.04 | #118 | STORY-114.01 |
| STORY-114.05 | #119 | STORY-114.01, STORY-114.02, STORY-114.03 |
