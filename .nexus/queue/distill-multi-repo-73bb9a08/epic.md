---
feature: "Multi-Repo Workspaces"
feature_path: docs/features/multi-repo-workspaces
epic: "Distill Across a Multi-Repo Workspace"
slug: distill-multi-repo
created: 2026-07-15
type: enhancement
complexity: M
complexity_drivers: [cross-repo diff derivation in member checkouts, per-repo anchor and provenance qualification, workspace-wide drain-SLO aggregation]
concepts: [distiller, code-anchors, provenance-reference, workspace-resolution, close-entry-migration, committed-queue]
link: "#54"
---

# Epic: Distill Across a Multi-Repo Workspace

## Description

In a multi-repo Nexus workspace, code repos plan and close locally while a hub docs repo holds the
concept store and drains the queue. At close, each entry is migrated from its code repo to the hub
queue with its originating repo and landed SHA range stamped in. The distiller then runs from the
hub — but the code the entry describes lives in a *member* checkout, not beside the queue.

Today `/nxs.distill` still assumes the queue and the code share one repo. It derives the diff with
`git` in its own repo, writes anchors with a single source SHA, defaults provenance to the terse
`#n` home-repo form, and reports drain health for one repo only. Run from a hub, every one of those
assumptions is wrong: the diff comes out empty or wrong, anchors point at the hub instead of the
code, `#n` resolves to the wrong repo, and the drain report cannot see the workspace.

This epic makes the distiller workspace-aware. Each entry's diff is recomputed from its recorded
repo and range inside the correct member checkout; anchors qualify their paths by repo and stamp a
source SHA per repo; provenance defaults to the qualified `<owner>/<repo>#n` form; and a single hub
drain reports drain-SLO across every member repo represented in the queue. The judgment stays the
same — the distiller still maps a diff to concept deltas — only the *what* is now sourced correctly
across repos.

## Success Metrics

- A hub drain of an entry recorded against member repo R derives a diff identical (same file/hunk
  set) to `git diff <base>...<head>` run in R's checkout, for 100% of drainable entries.
- Every anchor file a hub drain writes carries a source SHA for each repo the concept's code is
  attributed to; no listed path lacks a repo-qualified SHA.
- 100% of provenance references a hub drain emits use the qualified `<owner>/<repo>#n` form; the
  terse `#n` form never appears in a workspace drain's output.
- One hub drain's report accounts for every undrained hub-queue entry, attributed to its
  originating repo, and flags each entry undrained past 30 days as a drain-SLO breach.

## Personas

Per `docs/product/context.md`. The operator here is the Engineer adopting Nexus, running the drain
from the hub on behalf of the workspace.

## User Stories

### Story 1: Recorded-range diff derivation in the member checkout

- **story_type:** system
- **size:** M

**As a** distiller operator running the drain from the hub, **I want** each queue entry's diff
recomputed from its recorded repo and SHA range inside the correct member checkout, **so that** the
*what* of every concept delta is grounded in the actual landed code even though the entry now lives
in the hub, not the code repo.

#### Acceptance Criteria

- [ ] **Given** a hub workspace and a queue entry whose close-record `range:` names member repo R
  with base/head SHAs, **when** distill derives that entry's diff, **then** the diff equals
  `git diff <base>...<head>` run in R's resolved member checkout (identical file/hunk set), with
  `.nexus/queue/**` paths excluded from the behavioral analysis.
- [ ] **Given** an entry whose recorded range spans two member repos, **when** distill derives the
  diff, **then** it produces one diff per repo, each computed in that repo's own checkout, and no
  paths are attributed to the wrong repo.
- [ ] **Given** a recorded range whose member checkout cannot be resolved (missing sibling
  checkout), **when** distill runs that entry, **then** it stops with an explicit missing-checkout
  error naming the repo and the expected path, and never falls back to the hub repo or fabricates
  an empty diff.
- [ ] **Given** a recorded head SHA absent from the resolved member checkout (checkout behind),
  **when** distill runs that entry, **then** it reports the unreachable SHA for that repo and does
  not derive a partial diff.

#### Notes

Replaces the single-repo diff derivation (the introducing-commit `git log` path and the home-repo
`git diff`) with member-checkout resolution when a hub manifest is present. Depends on
close-entry-migration stamping `range: [{repo, base, head}]` into the close record and on
workspace-resolution resolving each member's sibling checkout.

### Story 2: Repo-qualified code anchors with per-repo source SHAs

- **story_type:** system
- **size:** S

**As a** maintainer reading the concept store, **I want** each anchor file to qualify its paths by
member repo and stamp a source SHA per repo, **so that** a concept whose code spans repos records
exactly where each path lives and at which revision — not one ambiguous SHA against the hub.

#### Acceptance Criteria

- [ ] **Given** a concept whose attributable diff paths come from member repo R, **when** distill
  refreshes that concept's anchors during a hub drain, **then** each anchor path is qualified by its
  repo and the anchor file records R's head SHA as that repo's source SHA.
- [ ] **Given** a concept whose code spans two member repos, **when** its anchors are refreshed,
  **then** the anchor file records a distinct source SHA per repo and every listed path is
  attributed to exactly one of those repos.
- [ ] **Given** a hub drain, **when** anchors are regenerated, **then** they stay fully derived
  (regenerated whole from the member diffs plus alias-grep, never hand-edited) and the emitted
  anchor format passes validation.

#### Notes

Extends the R1 anchor format from a single `source_sha` to a per-repo mapping. Depends on Story 1
for the per-repo diffs and head SHAs.

### Story 3: Qualified provenance as the multi-repo default

- **story_type:** system
- **size:** S

**As a** maintainer reading the concept store, **I want** provenance references in a workspace
drain to default to the qualified `<owner>/<repo>#n` form, **so that** every decision-log entry,
page frontmatter, and anchor names the repo the issue actually lives in — because in a hub the issue
never lives in the drain's own repo.

#### Acceptance Criteria

- [ ] **Given** a hub workspace, **when** distill writes any provenance reference (page
  `last_updated_by`, Decision Log heading, or PR body), **then** the reference uses the qualified
  `<owner>/<repo>#n` form resolved from the entry's originating repo, and the terse `#n` form is not
  emitted.
- [ ] **Given** single-repo mode (no hub manifest present), **when** distill runs, **then**
  provenance still defaults to the terse `#n` home-repo form, unchanged by this epic.

#### Notes

Inverts today's default (terse `#n`, qualify only on an issue-title mismatch) for the workspace
case. The originating repo comes from the entry's recorded `repo` (close-entry-migration).

### Story 4: Workspace-wide drain-SLO reporting

- **story_type:** system
- **size:** S

**As a** distiller operator, **I want** one hub drain to report undrained entries across every
originating repo in the queue — each with its age and a breach flag past 30 days — **so that** I see
the whole workspace's drain health in one report instead of one repo at a time.

#### Acceptance Criteria

- [ ] **Given** a hub queue with undrained entries originating from two or more member repos,
  **when** I run distill from the hub, **then** the completion report lists every undrained entry,
  each attributed to its originating repo, and none is omitted.
- [ ] **Given** an undrained entry older than 30 days, **when** the report is produced, **then** the
  entry is flagged as a drain-SLO breach and is not auto-deleted.
- [ ] **Given** a workspace where every queue entry is drainable, **when** distill runs, **then** the
  report shows zero skipped entries and no breach flags.

#### Notes

Extends the single-repo skip/age report to span the hub queue, keyed by each entry's originating
repo. C12 (undrained entries are never auto-deleted) is preserved.

## Assumptions

- The workspace shape is resolved from workspace-resolution's own committed artifacts
  (`.nexus/config/workspace.yml` = hub) — the distiller re-derives no workspace shape of its own,
  matching the existing invocation-selection step in `/nxs.distill`.
- Each hub-queue entry carries its originating repo and SHA range in the close-record `range:` list
  (delivered by close-entry-migration); this epic consumes that stamp rather than recording it.
- Member checkouts are siblings resolvable via the workspace manifest; portable tooling already runs
  in the hub (portable-nexus-tools).
- Drain-SLO is measured against the hub queue — the entries that have actually landed there.

## Out of Scope

- Scanning member checkouts for closed-but-not-yet-migrated entries — that is migration-lag, owned
  by close-entry-migration / workspace-status, not the drain-SLO report here.
- Single-repo distill behavior — diff derivation, anchors, provenance, and reporting stay unchanged
  when no hub manifest is present.
- Recording the repo+range stamp at close time (close-entry-migration) and manifest/checkout
  resolution itself (workspace-manifest); this epic depends on both and does not re-implement them.

## Open Questions

<!-- none -->

## Implementation Sequence

| STORY | Issue | blocked_by |
|---|---|---|
| STORY-54.01 | #55 | none |
| STORY-54.02 | #56 | STORY-54.01 |
| STORY-54.03 | #57 | STORY-54.01 |
| STORY-54.04 | #58 | none |
