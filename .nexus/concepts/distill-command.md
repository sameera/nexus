---
title: "Distill Command"
aliases: ["nexus distill", "one-command distill", "distill a closed epic", "background distillation", "distill by epic number"]
touches: ["drain-invocation", "close-and-distill-command", "pr-driven-flow", "distill-run-record"]
last_updated_by: "#952"
status: active
verification: verified
---

# Distill Command

The distill command takes a closed epic, named by its number or by any merged pull request of it, and runs the drain unattended in the worktree close prepared. It refuses before any session starts when close's result does not hold. It reports success only when the platform shows an open distillation pull request.

## How It Works

The lead names the epic by its number, or any merged pull request of the epic, from which the command finds the epic the same way close does. It then finds the newest distillation branch for that epic, then the worktree git has registered on that branch. Nothing is handed over from close. Before any session starts, the command checks in a fixed order: a single-repo checkout, a merged pull request when one was named, a closed epic issue, a branch with a worktree, a branch on the push remote, no distillation pull request already open, no live run for the same epic, and an installed harness. Each refusal names its remedy and changes nothing. The command prints the permission mode, then starts one session in the worktree with a fixed prompt and the unattended flag. It never commits, pushes or resets the branch. When the session ends, it asks the platform for an open pull request from the branch. One open pull request is success. Anything else is a stop. In the background, a detached process runs the same steps and writes a status line to the starting terminal every few minutes.

## Key Invariants

1. Every refusal happens before any session starts, exits non-zero, and leaves the branch, the worktree, the platform and the main checkout's tracked files unchanged.
2. Success is read only from the platform, as an open pull request whose head is the distillation branch; the session's exit status and its final message never decide it.
3. A distillation pull request already open before the run refuses the start.
4. The session prompt is fixed text; nothing read from a pull request, an issue or the worktree is placed in it.
5. Foreground and background runs share one path, so their log and outcome have the same content.

## Integration Points

- [drain-invocation](drain-invocation.md) — the unattended drain this command starts; the command adds the flag, the drain decides everything.
- [close-and-distill-command](close-and-distill-command.md) — the maintainer command whose distill stage now runs through this command.
- [pr-driven-flow](pr-driven-flow.md) — the post-merge flow whose shared worktree this command finds from the epic number or a pull request, drains in, and later removes by epic number.
- [distill-run-record](distill-run-record.md) — the run record and live-run marker this command writes per epic, and the cleanup command every ending names.

## Decision Log

### 2026-10-17 — #909 — One shipped command distills a closed epic

After close, the lead had to open a session inside the worktree and run the drain by hand, and that step was easy to forget. The command ships in the executable adopters install, because the maintainer script that did this was not in the package. Refuted alternative: ship the distill half of that script as a packaged shell script. It was the faster port, but it depends on bash, parses close's text output and a hand-off note, and has no tests. The command finds close's state from the pull request through close's own resolution, because a lead who ran close by hand has no hand-off note, and a note goes stale when the worktree is removed. Refuted alternative: have close always write the note and read it here. Success is read only from the platform, because a session that stopped cleanly still exits with success. The command keeps the maintainer script's permission default, bypass for one harness and a workspace sandbox for the other, because a session nobody watches cannot answer a permission prompt. It prints the mode before every session, and the lead can choose another mode for one run.

### 2026-10-18 — #952 — Distill and clean up by epic number

Distill runs once per epic, so the lead now names the epic by its number instead of looking up one of its pull requests. The epic form skips the merged-pull-request check, because a closed epic with a pushed branch and a worktree is close's own result and the pull request was only the way to find the epic. It takes `N` or `#N` only. Refuted alternative: accept every form close takes, such as `owner/repo#N` or an issue URL. That adds a second parsing path for a command whose repository is already fixed. The run record and the live-run marker are now keyed by epic number, so a start by epic number and a start by any pull request of the same epic refuse each other. This replaces "one run per pull request". Refuted alternative: keep the per-pull-request record and look up a pull request from the epic. Two pull requests of one epic would still get two records. Re-run hints repeat the form the lead used, so `--pr` output stays unchanged. A shell drops an unquoted `#N` as a comment, so the missing-target refusal says so and names the number-only form. A new cleanup command removes every local worktree on any of the epic's distillation branches, whatever their date, then deletes the epic's run record. The run record, the one-run-per-epic rule and the cleanup command moved to the new distill-run-record page, because a task about cleanup or the live-run marker does not need the start checks, and the page would otherwise exceed its size cap. It reads only git's local worktree list, so it works offline, in a hub, and from inside the worktree. Refuted alternative: reuse the start command's finder. That finder fails offline and leaves older worktrees in place. Cleanup refuses while the epic's run is live, because removing the worktree under a running session would stop that session from undoing its own commits. Every ending, and a background run's final line, names the cleanup command with the epic number filled in.
