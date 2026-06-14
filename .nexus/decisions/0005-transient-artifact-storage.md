# 0005 — Transient artifact storage: `.nexus/temp/`

**Status:** Decided.
**Date:** 2026-06-14
**Builds on:** [`0001-refactor-direction.md`](./0001-refactor-direction.md) (two-store split),
[`0002-pipeline-audit.md`](./0002-pipeline-audit.md) (transient vs durable classification),
[`0004-implementation-plan.md`](./0004-implementation-plan.md) (Phase A1 artifact shape, close BLOCKER).

---

## Decision

Pipeline artifacts that are **transient by lifecycle** (epic, decision record, task index,
close record) live in `.nexus/temp/<branch>/<local-id>/` — gitignored, never committed to
the source repo, deleted by `/nxs.close` when the epic concludes.

**This supersedes the implicit 0004 assumption that these files live in `docs/`.**

`docs/` is now reserved exclusively for *permanent* human artifacts. The transient pipeline
workspace is a third surface, distinct from both `docs/` (permanent human) and
`.nexus/library/` (machine knowledge).

---

## Why `.nexus/temp/` over the alternatives

Three alternatives were evaluated:

| | NWD (external dir) | Git worktree | `.nexus/temp/` |
|---|---|---|---|
| Config required | Yes (`~/.nexus/config.json` + `wip.json`) | None | None |
| Files enter git objects | No | Yes (orphan branch) | No |
| Library access | Absolute path to source repo | Cross-worktree path | Sibling dir, relative |
| Cleanup | Manual delete | `worktree remove + branch -d` | `rm -rf` in `/nxs.close` |
| Path resolution | Config + wip.json lookup | `git worktree list` | `git branch` + glob |

`.nexus/temp/` wins on simplicity: zero config, no git ceremony, library access is a
relative sibling read, cleanup is one `rm -rf`. The only meaningful tradeoff vs. the
worktree approach is no optional commit history on planning artifacts — acceptable for the
single-operator transient model.

---

## Key decisions

### 1. Path: `.nexus/temp/<branch>/<local-id>/`

`<owner>/<repo>` levels dropped — implicit in the source repo. `<branch>` gives
human-readable organisation. `<local-id>` is a random key generated at `/nxs.epic` time —
it handles multiple concurrent epics on the same branch and decouples the folder from the
GitHub issue ID, which does not exist yet at epic creation.

**Discovery at command runtime:** `git branch --show-current` + `glob .nexus/temp/<branch>/*/`.
Common case (one epic per branch) returns exactly one match. Multiple matches prompt the
user to select.

### 2. `.nexus/temp/` is gitignored from init

`/nxs.init` writes the entry to `.gitignore`. Mandatory, not optional — a bare `git add .`
must never stage planning artifacts.

### 3. All transient artifacts deleted at close

`/nxs.close` deletes `.nexus/temp/<branch>/<local-id>/` as its final step, after:
1. The close record has been reviewed and approved by the human.
2. The `LibraryDelta` block has been written to `.nexus/staged/<local-id>.json`.
3. The GH epic comment has been posted and the issue closed.

### 4. Staged `LibraryDelta`s go to `.nexus/staged/<local-id>.json`

The staged delta is **not** transient — it is the durable output System B's distiller (B1)
consumes. It is committed to the feature branch and travels to main with the PR. This
resolves the BLOCKER from 0004 (close emission durability): the delta is written before the
temp folder is deleted.

### 5. Close record is also transient

The close record (key decisions + `LibraryDelta` block) lives in
`.nexus/temp/<branch>/<local-id>/close-record.md`. The human gates the delta at the close
review from this temp file. After approval the `LibraryDelta` moves to `.nexus/staged/` and
the GH comment captures the human-readable summary. The file is then deleted with the rest
of temp.

This keeps `docs/` free of any machine block, even a human-gated one.

### 6. `docs/` scope narrowed to permanent human artifacts

| Path | Content |
|---|---|
| `docs/system/stack.md`, `docs/system/standards/*.md` | Human-maintained ground truth |
| `docs/product/context.md` | Personas, strategy, anti-goals |
| `docs/features/<name>/README.md` | Feature brief — human-authored input to `/nxs.epic` |
| `docs/decisions/*.md` | Council decision records, ad hoc |

The GitHub epic issue and GH close comment are the permanent human-readable record of what
was specced and what shipped. The transient pipeline workspace (temp) leaves no trace in the
committed tree.
