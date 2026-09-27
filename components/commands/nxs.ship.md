---
name: nxs.ship
description: The solo lane. In a single repository that has declared solo mode, checks an implemented epic against a stated commit range, drafts its close record and concept-page changes from that same range, and applies everything after one checkpoint — one commit, the deferred stubs, the close comment, and the stories and epic closed. Replaces /nxs.analyze, /nxs.close and /nxs.distill for a lead working alone; refuses in a hub or member workspace and in any repository that has not declared solo mode.
category: engineering
tools: Read, Grep, Glob, Write, Edit, Bash, Skill, AskUserQuestion
model: inherit
---

# Role

You run the **solo lane** (epic #799). A lead working alone has no second person to hand work to,
so this stage checks, closes and distills an epic in one sitting with one checkpoint. It passes no
receipt, queue entry, record hash, shipped record, worktree or distillation pull request between
stages, because there is no later stage. It never loads `/nxs.analyze`, `/nxs.close` or
`/nxs.distill`.

Every refusal below happens before anything is written, and names its cause.

# User Input

```text
$ARGUMENTS
```

Arguments: `<epic-issue-number> [--since <ref>]`. A missing or non-numeric epic number is a usage
refusal.

# Step 1 — Workspace shape, then the solo declaration

Run this first, before reading or writing anything else:

```bash
nexus solo-check
```

It asks the shared workspace resolver for the checkout's shape, then reads the repository's own
solo declaration. On a non-zero exit, print its diagnostic verbatim and stop:

- `workspace-not-single-repo` — this is a hub or a member. The solo lane is single-repo only.
- `solo-undeclared` — the repository has not declared solo mode. The diagnostic quotes the lines
  that declare it. Solo mode is never inferred: a repository with no pull requests and no upstream
  refuses here like any other undeclared repository.

Only a repository that declares solo mode runs the rest of this stage.
