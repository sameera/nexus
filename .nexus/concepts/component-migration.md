---
title: "Component Migration"
aliases: ["migrate-components", "committed component set", "repository component migration", "tracked-only removal", "unstaged removals", "ignore entries", "widened namespace match"]
touches: ["component-mirror", "install-location", "authored-component-root"]
last_updated_by: "#256"
status: active
verification: verified
---

# Component Migration

A repository that still carries a committed component set is emptied of it by a gated verb — never automatically, and never as a side effect of another command. Only files git already tracks are removed, and the removals are left unstaged for the owner to review; untracked ones are listed and left in place. Ignore entries are appended so the next stale command cannot re-commit what was just removed.

## How It Works

The verb refuses outside a git work tree, and refuses until the account's install location resolves and holds a component set, so no repository is emptied while there is nothing to replace it. It reports that location and which of its two contents it holds before removing anything.

It drives the one mirror by declaring an empty payload and vetoing every file git does not track. Its ownership match is widened by one level, so Nexus-named files sitting directly at the repository's component-directory top level are caught too — a migration that leaves them has not removed Nexus. That widening belongs to this caller alone: at an account's install location the same rule would enlarge a blast radius that covers the account's own harness state.

Removals are plain deletions landing as unstaged changes; nothing is staged and nothing is committed. Every git command the verb prints names explicit paths, because it runs against a branch its owner was already working on and a sweeping command would offer them a commit of the rest of their work.

## Key Invariants

1. The verb refuses outside a git work tree, and refuses until the install location resolves and holds a component set.
2. Only Nexus-owned files git tracks are removed; untracked ones are listed, left in place, and reported with the command that would remove them.
3. No git index is mutated and no commit is created; every removal is an unstaged working-tree change.
4. Every git command the verb prints is scoped to explicit paths, never to the whole working tree.
5. The widened top-level ownership match belongs to this caller alone and is never inherited by an account-scoped caller.
6. Ignore entries are appended idempotently, match only namespace-prefixed names within the managed subtrees, and never blanket-ignore the component directory.
7. The resolved location and which of its two contents it holds are reported before anything is removed.

## Integration Points

- [component-mirror](component-mirror.md) — the one operation this verb drives, with a declared empty payload and a veto on every untracked file.
- [install-location](install-location.md) — must resolve and hold a component set before this verb removes anything, and is reported first.
- [authored-component-root](authored-component-root.md) — never the target of this verb: an authored original is relocated with its history, not emptied as a mirrored copy would be.

## Decision Log

### 2026-08-27 — #253 — Tracked files only, because git is the entire undo story

The verb buys out of a dry run, per-file confirmation and backups with one argument: the files are tracked, so git is the remedy. That argument is simply false for an untracked file, where deleting it leaves no recourse at all in a design that deliberately built none. The epic's own success metric was amended to match rather than left claiming something the build could not honour safely. Refuted: remove every namespaced file regardless of tracking — what the metric literally asked for, and one fewer command for the owner; it loses because it makes the safety argument untrue in the one case where safety is actually needed.

### 2026-08-28 — #256 — Reciprocal link from authored-component-root

Mechanical reciprocity fan-out: the authored-component-root page names this verb as the one thing never pointed at a repository holding the authored original, so the two operations' different safety arguments stay visible from both sides.
