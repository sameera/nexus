## 2026-10-16 — Share close's PR-to-epic resolution as one exported function
- **Choice:** Extracted `resolveEpicOfPr` (and its issues-repo helper) out of `runCloseCommand`; close and `nexus distill` both call it.
- **Why:** D2 requires the two commands to resolve a pull request's epic the same way, and a copy would drift.
- **Refuted alternative:** Calling `runCloseCommand` in a read-only mode, which would mix distill's checks into close's gate.

## 2026-10-16 — Run folder named distill-run-pr-<N>
- **Choice:** `.nexus/tmp/distill-run-pr-<N>/` in the main checkout, resolved from git's shared folder.
- **Why:** G18 needs a name that can never read as `epic-<n>`, `fix-<n>` or `intake-<n>`, and the distillation's own run folder lives under `.nexus/tmp/runs/`.
- **Refuted alternative:** Reusing the script's `close-epic-<N>`, which names the script, not the command.

## 2026-10-16 — close-epic.sh exits with nexus distill's status
- **Choice:** The script `exec`s `nexus distill`, so a stopped distillation now exits non-zero; under `--background` it detaches `nexus distill` itself until the command gains `--background`.
- **Why:** The outcome rule belongs to the command (D4, D13), and the exit status is part of it.
- **Refuted alternative:** Keeping the script's exit 0 on a stop, which would report success the command does not.

## 2026-10-17 — The already-open pull request check reads GitHub from the worktree
- **Choice:** The pre-start open-PR check uses the same `gh pr list --head <branch>` read from the worktree as the outcome check.
- **Why:** D4 needs the start refusal and the success read to ask the same repository, or a PR seen by one could be missed by the other.
- **Refuted alternative:** Asking the issues repository, which in a split-repo setup is not where the distillation opens its pull request.

## 2026-10-17 — The detached runner gets its plan through the environment
- **Choice:** The background run starts this same executable as `distill --detached-runner`, with the checked plan as JSON in `NEXUS_DISTILL_PLAN`.
- **Why:** The checks already passed in the parent; re-running them in the child would repeat the GitHub reads and trip over the parent's own live-run marker.
- **Refuted alternative:** Re-invoking `distill --pr <N>` in the child, which re-checks everything and cannot tell its own marker from another run's.

## 2026-10-17 — The worktree form selects the continuation contract through its existing row
- **Choice:** The base stage classifies a path argument and resolves a close worktree as run mode `continuation`; the existing continuation row loads the worktree rules, with no new selection row.
- **Why:** The selection table keeps one row per contract named once outside it, and the ordinary-load ceiling left about 1 KB for the base stage.
- **Refuted alternative:** A second row that loads the continuation contract at run-shape resolution, which breaks the one-row-per-contract rule.
