---
title: "Distill Command"
aliases: ["nexus distill", "one-command distill", "distill a closed epic", "background distillation", "live-run marker", "outcome record"]
touches: ["drain-invocation", "close-and-distill-command", "pr-driven-flow"]
last_updated_by: "#909"
status: active
verification: verified
---

# Distill Command

The distill command takes a merged pull request whose epic close has closed, and runs the drain unattended in the worktree close prepared. It refuses before any session starts when close's result does not hold. It reports success only when the platform shows an open distillation pull request.

## How It Works

The lead names any merged pull request of the epic. The command finds the epic the same way close does, then the newest distillation branch for that epic, then the worktree git has registered on that branch. Nothing is handed over from close. Before any session starts, the command checks in a fixed order: a single-repo checkout, a merged pull request, a closed epic issue, a branch with a worktree, a branch on the push remote, no distillation pull request already open, no live run for the same pull request, and an installed harness. Each refusal names its remedy and changes nothing. The command prints the permission mode, then starts one session in the worktree with a fixed prompt and the unattended flag. It never commits, pushes or resets the branch. When the session ends, it asks the platform for an open pull request from the branch. One open pull request is success. Anything else is a stop. In the background, a detached process runs the same steps and writes a status line to the starting terminal every few minutes.

## Key Invariants

1. Every refusal happens before any session starts, exits non-zero, and leaves the branch, the worktree, the platform and the main checkout's tracked files unchanged.
2. Success is read only from the platform, as an open pull request whose head is the distillation branch; the session's exit status and its final message never decide it.
3. A distillation pull request already open before the run refuses the start.
4. The session prompt is fixed text; nothing read from a pull request, an issue or the worktree is placed in it.
5. Every file the command writes lies in ignored scratch space in the main checkout, and no file it writes can be read as a drainable entry.
6. A second start for the same pull request refuses while the first run's process still exists.
7. Foreground and background runs share one path, so their log and outcome have the same content.

## Integration Points

- [drain-invocation](drain-invocation.md) — the unattended drain this command starts; the command adds the flag, the drain decides everything.
- [close-and-distill-command](close-and-distill-command.md) — the maintainer command whose distill stage now runs through this command.
- [pr-driven-flow](pr-driven-flow.md) — the post-merge flow whose shared worktree this command finds from the pull request and drains in.

## Decision Log

### 2026-10-17 — #909 — One shipped command distills a closed epic

After close, the lead had to open a session inside the worktree and run the drain by hand, and that step was easy to forget. The command ships in the executable adopters install, because the maintainer script that did this was not in the package. Refuted alternative: ship the distill half of that script as a packaged shell script. It was the faster port, but it depends on bash, parses close's text output and a hand-off note, and has no tests. The command finds close's state from the pull request through close's own resolution, because a lead who ran close by hand has no hand-off note, and a note goes stale when the worktree is removed. Refuted alternative: have close always write the note and read it here. Success is read only from the platform, because a session that stopped cleanly still exits with success. The command keeps the maintainer script's permission default, bypass for one harness and a workspace sandbox for the other, because a session nobody watches cannot answer a permission prompt. It prints the mode before every session, and the lead can choose another mode for one run.
