---
feature: "Multi-Repo Workspaces"
feature_path: docs/features/multi-repo-workspaces
epic: "Close-Entry Migration to the Hub Queue"
slug: close-entry-migration
created: 2026-07-14
type: enhancement
complexity: M
complexity_drivers:
  [
    "cross-repo git operations at close (commit into the sibling hub checkout, remove from the code repo) with no partial or duplicate state",
    "consumes workspace resolution (hub/member, missing-checkout errors) from the manifest without re-deriving the workspace shape",
    "single-repo behavior must be preserved unchanged — the mode is gated, not assumed",
  ]
concepts: []
link: "#49"
---

# Epic: Close-Entry Migration to the Hub Queue

## Description

In a single-repo project, a closed epic's queue entry (`epic.md`, `decision-record.md`,
`close-record.md`) travels to `main` with the merge PR and `/nxs.distill` drains it from the
same repo. Two things make that work: the distiller derives the epic's diff from the commit that
introduced the entry (which shares history with the code), and it removes the drained entry in
the same PR that writes the concept pages, so the deletion and the writes land atomically.

A multi-repo workspace breaks both. Code repos plan and close locally, but a hub docs repo holds
the concept store and drains the queue. Once the entry lives in the hub, the hub's history no
longer contains the code change — deriving the diff from the entry's introducing commit yields
only the moved files. And a `git rm` in the hub can no longer be atomic with a code change that
lives in a different repo.

This epic makes `/nxs.close` migrate the closed entry to the hub at close time. It stamps the
exact diff range (repo + base + head) into the close record so the hub-side drain can recompute
the diff from the recorded range rather than from local history; it commits the entry into the
hub's queue where the concept store lives (restoring drain atomicity — entry and pages co-located
in one repo); and it removes the entry from the code repo so nothing is left to linger or be
drained twice. Single-repo projects are untouched.

## Success Metrics

- After an epic is closed in a workspace member repo, its queue entry exists in **exactly one**
  place: the hub queue — not the code repo.
- The close record carries a repo + base + head range sufficient to recompute the epic's diff:
  `git diff <base>...<head>` in the named repo reproduces the change `/nxs.close` derived in its
  close-from-diff pass.
- Closing an epic in a single-repo project produces the same artifacts and the same queue state
  as before the change (no regression).
- When the hub checkout cannot be resolved, `/nxs.close` performs no partial migration: the entry
  remains intact in the code repo and the failure is reported.

## Personas

Per `docs/product/context.md`. The actor throughout is the **engineer running `/nxs.close`** in a
workspace member repo; the downstream consumer of the migrated entry is the hub-side distiller.

## User Stories

### Story 1: Stamp the diff range into the close record

- **story_type:** system
- **size:** S

**As a** hub-side distiller, **I want** the close record to carry the exact diff range for the
closed epic, **so that** I can recompute the epic's diff from the recorded range without relying
on the queue entry sharing git history with the code change.

#### Acceptance Criteria

- [ ] **Given** an epic being closed on a branch, **when** `/nxs.close` writes the close record,
      **then** its frontmatter carries a range block with `repo` (the code repo identity, e.g.
      `owner/name`), `base` (the merge-base the branch forked from), and `head` (the branch head)
      — the same base/head `/nxs.close` already computes in its close-from-diff pass.
- [ ] **Given** the range block is written, **when** it records `base` and `head`, **then** both
      are **full commit SHAs**, not symbolic refs (`HEAD`, `main`), so they still resolve after
      the branch is deleted.
- [ ] **Given** the range is recorded as a **list** of `{repo, base, head}` entries (one per
      touched repo), **when** a single-code-repo epic is closed, **then** the list contains
      exactly one entry (the home repo) — the shape supports more; this epic populates one.
- [ ] **Given** the close-record template, **when** the range block is introduced, **then**
      `.nexus/config/templates/close-record-template.md` declares it with filling guidance, and a
      filled close record leaves no `{{PLACEHOLDER}}` behind.
- [ ] **Given** a recorded range, **when** the hub-side drain reads it, **then**
      `git diff <base>...<head>` in the named repo reproduces the epic's landed change (verifiable:
      the recorded range equals the range `/nxs.close` diffed against in its close-from-diff pass).

#### Notes

Range stamping is **unconditional** — it runs in single-repo projects too, where it simply
populates the recorded-range fallback the distiller already supports. It is the precondition for
migration: a migrated entry must already carry its range, because after migration the entry's
introducing commit no longer describes the code change.

### Story 2: Migrate the closed entry to the hub queue

- **story_type:** system
- **size:** M

**As an** engineer closing an epic in a workspace member repo, **I want** the closed queue entry
committed into the hub's queue, **so that** the hub-side distiller drains it where the concept
store lives and drain atomicity is preserved.

#### Acceptance Criteria

- [ ] **Given** the repo is a workspace member (workspace resolution artifacts present, hub
      resolvable), **when** `/nxs.close` has written the close record, **then** the full queue
      entry directory (`epic.md`, `decision-record.md`, `close-record.md`, and any siblings) is
      committed into the hub checkout's `.nexus/queue/` under the same `<epic-slug>-<local-id>`
      directory name.
- [ ] **Given** the migration must locate the hub, **when** it resolves the hub checkout, **then**
      it uses the workspace resolver delivered by the manifest epic (#38) and does **not**
      re-derive the workspace shape with a new heuristic.
- [ ] **Given** the hub checkout cannot be resolved or is missing, **when** `/nxs.close` reaches
      the migration step, **then** it writes **no** partial entry to the hub, reports a clear
      actionable error (which checkout is missing and how to supply it), and leaves the entry
      intact in the code repo — pass/fail: no partial hub state.
- [ ] **Given** the repo is single-repo (no workspace artifacts), **when** `/nxs.close` runs,
      **then** no hub write is attempted and the produced artifacts and queue state are identical
      to the pre-change behavior.
- [ ] **Given** a migrated entry, **when** the hub later runs `/nxs.distill`, **then** the entry
      and the concept-store pages reside in the same repo, so the drain's page writes and the
      entry's removal land in one PR (drain atomicity restored).

#### Notes

Migration is a cross-repo mutation; its placement relative to the existing Phase 7 closure
checkpoint (which today gates the GitHub writes) is an HLD decision, as is whether the hub-path
resolution and git operations are a `portable-nexus-tools` helper or inline command steps. This
story consumes the manifest resolver from #38 — the only declared blocker.

### Story 3: Remove the migrated entry from the code repo

- **story_type:** system
- **size:** S

**As an** engineer, **I want** the closed entry removed from the code repo once it has been
migrated, **so that** the code repo carries no dead entry that lingers or gets drained a second
time.

#### Acceptance Criteria

- [ ] **Given** the entry has been successfully migrated to the hub (Story 2), **when**
      `/nxs.close` continues, **then** the entry directory is removed from the code repo, committed
      on the current branch so it does not travel to the code repo's `main`.
- [ ] **Given** migration did **not** succeed (hub unresolvable, or migration aborted), **when**
      `/nxs.close` handles removal, **then** the entry is **not** removed — removal is strictly
      gated on a confirmed migration.
- [ ] **Given** single-repo mode, **when** `/nxs.close` runs, **then** the entry is **never**
      removed from the code repo (it must reach `main` for the local distiller) — pass/fail.
- [ ] **Given** a completed migrate-and-remove, **when** the workspace is inspected, **then** the
      entry exists in exactly one place: the hub queue, not the code repo.

#### Notes

Splitting the move into "migrate" (Story 2) and "remove" (Story 3) keeps each independently
reviewable; they ship together, so the transient duplicate entry between them never reaches a
shared `main`.

## Assumptions

- The workspace manifest and hub/member resolution (epic #38) are available; this epic **consumes**
  that resolver and does not re-implement workspace detection or missing-checkout errors.
- An epic is planned and closed in exactly **one** code repo (its home repo). An epic whose
  implementation spans multiple code repos is out of scope (see Out of Scope).
- Migration commits the entry into the hub checkout locally; pushing the hub commit follows the
  hub owner's existing workflow and is not automated by `/nxs.close`.
- The code-repo removal is committed on the current branch so the entry does not reach the code
  repo's `main`; the hub now owns the entry's durability.
- Whether the deterministic parts (hub-path resolution, the migrate/remove git operations) live in
  a portable-tools helper or as inline command steps is an HLD/engineer decision.

## Out of Scope

- **Cross-repo epics.** Recording more than one `{repo, base, head}` range for an epic that touched
  multiple code repos, plus detecting which repos were touched. This pairs with `distill-multi-repo`
  (the consumer that recomputes a diff in each member checkout) and is deferred to a backlog stub.
  The range block is shaped as a list now so it extends without a schema change.
- **Hub-side distillation across the workspace.** Recomputing diffs from recorded ranges in member
  checkouts, repo-qualified anchors, and qualified provenance are owned by `distill-multi-repo`.
  This epic only produces the migrated entry + range that `distill-multi-repo` consumes.
- **Pushing or PR-ing the hub commit**, and the hub repo's branch strategy.

## Open Questions

<!-- none -->

## Implementation Sequence

| STORY | Issue | blocked_by |
|---|---|---|
| STORY-49.01 | #50 | none |
| STORY-49.02 | #51 | STORY-49.01 |
| STORY-49.03 | #52 | STORY-49.02 |
