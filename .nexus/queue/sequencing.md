# Sequencing: "Less committed files, more GitHub-issue-based"

Backlog items from **PR-Driven Delivery** and **Multi-Repo Workspaces** that move
Nexus from committed queue/scratch files toward GitHub issues + PRs as the state
model. One dependency chain rooted at **issue-sourced-planning (#114)**, plus two
substrate items feeding a later CLI consolidation.

## The one decision behind all of it

Committing to this sequence commits to **GitHub issues as the source of truth** —
`/nxs.epic` commits nothing at planning, a resolver materializes the epic from the
issue graph, and the committed queue entry is born at *close*. This supersedes both
the older migrate-at-close model and the interim hub-born-at-planning model (#109,
abandoned 2026-07-21; replaced by #114, filed with stories #115–#119). Consequence:
the already-promoted `close-entry-migration` (#49) and `distill-multi-repo` (#54)
machinery becomes the legacy path that Wave 4 retires. State this before spending
Wave 3.

## Wave 1 — foundations (start now / in flight)

| Item | Size | blocked_by | Why first |
|---|---|---|---|
| **issue-sourced-planning** (#114) | L | none | Filed (#115–#119). The root: GitHub issues become the source of truth, `/nxs.epic` commits nothing at planning, the resolver (#115) materializes the epic from the issue graph, and the committed entry is born at *close*. Everything below reads the epic through the resolver. |
| **github-publishing-config** | M | none | The `github:` config resolver (types/labels/project). Ship before hld-subissue-record and pipeline-gh-cli so they consume it instead of hardcoding label maps and getting reworked. Build the resolver **once** here — hld-subissue-record, pipeline-gh-cli, and workspace-setup-cli all want it. |
| **pr-flow-live-acceptance-dry-run** | S | none | Cheap de-risking. The whole issue-sourced analyze/close/distill chain rides on `--pr` worktree mechanics never run against a real `gh`. Do it before betting Wave 3 on them. |

## Wave 2 — the file→issue core (after issue-sourced-planning lands)

| Item | Size | blocked_by |
|---|---|---|
| **hld-subissue-record** | M | wants #114 (no committed `epic.md`) + github-publishing-config's `hld` type/label mapping |

`hld-subissue-record` is the sharpest remaining file→issue move: `decision-record.md`
→ an `hld` sub-issue, where closing the issue *is* approval. Supersedes
`hub-design-gate` outright, and pairs with #114 — once planning commits no `epic.md`,
the record's `hld: "#n"` linkage lives on the epic issue, not a frontmatter stamp.
(`entry-abandonment` dropped from this wave — #114 dissolves it: with nothing
committed at planning there is no entry to delete, so abandoning is just closing the
epic issue.)

## Wave 3 — per-story PR chain (strict linear line)

```
nxs-pr-command → story-analyze-hub → epic-analyze-receipt → hub-close-multi-pr → multi-range-distill
```

| Item | Size | blocked_by |
|---|---|---|
| **nxs-pr-command** | M | issue-sourced-planning (#114) |
| **story-analyze-hub** | M | issue-sourced-planning (#114), nxs-pr-command |
| **epic-analyze-receipt** | S | story-analyze-hub |
| **hub-close-multi-pr** | M | epic-analyze-receipt |
| **multi-range-distill** | M | hub-close-multi-pr |

The bulk of the work and a hard dependency chain. `nxs-pr-command` deletes branch
scratch before PR open ("nothing needs cleanup on member main"). `story-analyze-hub`
must reconcile where its per-story analyze record lands — under #114 there is no
planning-time entry, so the record either aggregates at born-at-close or rides the
PR-review machine block. `hub-close-multi-pr` absorbs the producer side of
`cross-repo-range-recording`.

## Wave 4 — consolidate + retire

| Item | Size | blocked_by |
|---|---|---|
| **pipeline-gh-cli** | M | hld-subissue-record — can start once Wave 2 lands, in parallel with the Wave 3 tail |
| **legacy-flow-retirement** | S | hub-close-multi-pr, multi-range-distill |

`pipeline-gh-cli` turns each state transition into an idempotent `nexus` verb + a
CI-callable gate. `legacy-flow-retirement` is where "less committed files" is fully
realized: it deletes the member close-and-migrate choreography and the migration
helper, leaving the distillation-PR merge as the *only* cleanup anywhere.

## Pulled out of the line

- **member-pr-post-merge-flow** (PR-Driven backlog) — **drop.** Its premise is
  reconciling `--pr` with the member's pre-merge close-and-migrate. Issue-sourced
  planning runs analyze/close from the hub against member PRs and deletes the
  member-unsupported gate; `legacy-flow-retirement` then removes close-and-migrate
  entirely. Building this invests in the path being retired.
- **hub-design-gate** — already `superseded` by hld-subissue-record. Don't build.
- **entry-abandonment** — `superseded` by #114. With nothing committed at planning,
  abandoning is just closing the epic issue (and its hld sub-issue); "abandoned epics
  never distill" is automatic (no close record → never enters the queue). Don't build.
- **hub-born-queue** (#109) — `superseded` by #114; epic abandoned before any
  implementation. The interim "born at planning, delivered via queue PR" model.
