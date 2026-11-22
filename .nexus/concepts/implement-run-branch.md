---
title: "Implement Run Branch"
aliases: ["run branch", "implement resume", "resume an implement run", "story commit push"]
touches: ["unattended-epic-implementation"]
last_updated_by: "#1041"
status: active
verification: verified
---

# Implement Run Branch

The unattended implement command builds on one branch named for the epic. A later run continues that branch rather than starting over. Each story commit reaches the remote only after the command has checked it.

## How It Works

The command reads the run branch from the remote and the local copy. A missing branch is created, and an existing branch is continued, and the first output line says the run is resuming. A remote-only branch is copied down, and a local copy behind the remote is brought up to date. Stories that already have their own commit on the branch count as built, so only the remaining stories go to the implementation agent.

## Key Invariants

1. A story commit is pushed only after it passes the story commit check. A failed check ends the agent stage and stops the run.
2. Pushed commits are never rewritten. Every push is a plain push, and a run branch that no longer descends from its last checked commit stops the run.
3. A finished story is on the remote before the build stage ends. A stop after that keeps every story already published.

## Integration Points

- [unattended-epic-implementation](unattended-epic-implementation.md) — the command whose preflight takes up this branch and whose build stage pushes each checked story commit to it.

## Decision Log

### 2026-11-22 — #1041 — Split from unattended-epic-implementation

Epic #1041 narrowed the preflight's record refusal and took unattended-epic-implementation over its word cap. How the run branch is created, resumed and brought up to date, which stories count as built, and the push rules moved here. A task that changes resuming or pushing does not need the preflight's refusals, and a task that changes the preflight does not need the branch rules. The branch behaviour did not change.
