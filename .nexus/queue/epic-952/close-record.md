---
title: "Close Record: Distill and Clean Up by Epic Number"
epic: "#952"
feature: "PR-Driven Delivery"
date: 2026-10-18
nexus_version: 0.119.0
analyze: ran 2026-10-18 @ 101d85776dc0658bf42bb945d5dcb97b9595f328
record: "#956"
record_hash: ba42cff9c6b46f70b100be270a4db5caaa7f6df41e27b050e3eb47e224969ac0
range:
  - repo: sameera/nexus
    pr: 958
    base: 7608878a605db865a85480e2fdf086a5536435b8
    head: bbadb4b9542f47fea48abc6290e4fcecbfcfe0eb
story_ranges:
  - story: "#953"
    ranges:
      - { repo: sameera/nexus, pr: 958, base: 7608878a605db865a85480e2fdf086a5536435b8, head: bbadb4b9542f47fea48abc6290e4fcecbfcfe0eb }
  - story: "#954"
    ranges:
      - { repo: sameera/nexus, pr: 958, base: 7608878a605db865a85480e2fdf086a5536435b8, head: bbadb4b9542f47fea48abc6290e4fcecbfcfe0eb }
  - story: "#955"
    ranges:
      - { repo: sameera/nexus, pr: 958, base: 7608878a605db865a85480e2fdf086a5536435b8, head: bbadb4b9542f47fea48abc6290e4fcecbfcfe0eb }
landed_check:
  - story: "#953"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 958, result: unchanged }
  - story: "#954"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 958, result: unchanged }
  - story: "#955"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 958, result: unchanged }
---

# Close Record: Distill and Clean Up by Epic Number

## Key Decisions

- **D1 — The run record and live-run marker are keyed by epic number, not pull request number (#956).** The run record, its marker, the background status label and the in-progress refusal are named for the epic. **Why:** #953 criterion 4 requires that starts by `--epic`, by bare number and by `--pr` count as the same run. The epic is the only identity all three share. It is also what lets cleanup see a live run (D6). **Refuted alternative:** Keep the per-pull-request record, and have the epic form look up a pull request of the epic so it can reuse the record. It is the smallest diff, but two pull requests of one epic still get two records, so criterion 4 fails for multi-pull-request epics. It also forces a platform read the epic form does not otherwise need.
- **D2 — The epic form reads the epic's state in the issues repository close uses, and skips the merged-pull-request check (#956).** `--epic` and the bare form take `N` or `#N` only. Branch naming and worktree discovery work from the epic number alone. **Why:** Distill runs only in a single-repo checkout, where configuration already fixes the issues repository. Close's own result, a closed epic plus a pushed branch with a worktree, is the precondition. The merged pull request was only the way to find the epic. **Refuted alternative:** Accept every form close's `--epic` takes (owner/repo#N, issue URL), for symmetry with close. It loses on cost: a second parse-and-validate path for a command whose repository is already fixed, with no story asking for it.
- **D3 — Missing-target refusals say that the shell may drop `#N` (#956).** A bare `nexus distill`, `--epic` with no value, and `cleanup` with no epic each refuse, name the number-only form, and name the quoted form for `#N`. Nothing runs. **Why:** With interactive comments on, an unquoted `#N` never reaches the command. The lead sees a target-missing refusal, so that refusal is the only place the cause can be explained. **Refuted alternative:** none
- **D4 — Re-run hints repeat the form the lead used, and a bare number is shown as `--epic N` (#956).** In the epic form, a remedy pointing at close names close by epic too. **Why:** #953 criterion 5 needs the epic form to print `--epic`. #953 criterion 3 needs `--pr` output unchanged. **Refuted alternative:** Switch every re-run hint to `--epic` once the epic is known, as close does. It is more consistent with close, but it changes `--pr` output, which criterion 3 freezes.
- **D5 — Cleanup finds worktrees from git's local worktree list (#956).** Cleanup takes every worktree on any distillation branch named for the epic, whatever the date, not only the newest. It reads no network and checks no checkout role. **Why:** #954 criterion 2 wants no distill worktree left, and an earlier close on another day can leave a second branch with its own worktree. #954 criterion 3 wants "not found" and exit 0, but distill's finder fails when the remote cannot be read and no local branch exists. The attended distillation also prints the cleanup instruction (D7), so cleanup must not refuse in a hub. **Refuted alternative:** Reuse distill's finder (newest branch, local then pushed, then the worktree on it), which is what the epic's Assumption describes. It is one shared lookup, but it errors offline and leaves older worktrees in place.
- **D6 — Cleanup refuses while the epic's distill run is live (#956).** Cleanup refuses before removing anything, with a non-zero exit, while the epic's live-run marker names a living process. **Why:** Removing the worktree under a running unattended session leaves that session unable to remove its own commits. That breaks the drain-invocation page's rule that a stopped run leaves the branch as close left it. D1 makes the live run visible by epic. **Refuted alternative:** Always remove, as #954 criterion 2 does for uncommitted changes. It is simpler and matches "still removed", but it destroys a run in progress, not just leftover edits.
- **D7 — The drain report's cleanup instruction changes to the cleanup command with the epic filled in (#956).** The instruction under "Blocked on me", which tells the lead to remove the worktree once the pull request is dealt with, names `nexus distill cleanup N`. **Why:** Every ending quotes the drain report word for word. If the report keeps the old line, #955 criterion 2 cannot pass. Attended distillations, including in a hub, print the same report, so the lead gets one cleanup instruction everywhere. **Refuted alternative:** Filter the old line out of the quoted report inside the distill command. That keeps the change out of the drain stage, but it edits the drain's words and leaves attended runs on the old command.
- **D8 — All three endings and a background run's final line print the cleanup command (#956).** The cleanup command replaces the old line in every ending. Refusals stay as they are. **Why:** #955 criterion 1 covers every ending. In a `--pr` run the epic number is resolved before any session starts. A refusal starts no run, and its remedy is a different action. **Refuted alternative:** none
- **D9 — Cleanup also deletes the epic's run record (#956).** After removing the worktrees, cleanup deletes the epic's log and outcome. It deletes no other epic's record and no tracked file. **Why:** The lead chose this at the clarification gate: one command should leave nothing of the run behind. Every ending names this command, so the lead does not clear scratch by hand. **Refuted alternative:** Keep the log after cleanup, so a stopped run stays diagnosable. The record is in ignored scratch and #954's Notes scope cleanup to the worktree. It lost because the lead wants one command to end the whole run.

## Deviation Rationale

none

## Waived Stories

none

## Deferred Scope

none
