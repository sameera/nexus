---
title: "Unattended Epic Implementation"
aliases: ["nexus implement", "implement command", "implement-epic command", "nexus implement-epic", "unattended implementation", "implement an epic unattended"]
touches: ["nexus-pipeline", "scope-claim", "publishing-config-resolution", "implement-fix-loop", "hld-build-input"]
last_updated_by: "#991"
status: active
verification: verified
---

# Unattended Epic Implementation

An optional command implements an approved epic with no one watching. It builds each story in its own commit, opens a draft pull request, and repeats analyze and fix rounds until no Critical, High or Medium item is open. It then marks the pull request ready. The lead chooses to run it. No pipeline stage runs it or writes code.

## How It Works

Before any agent runs, the command resolves the epic and refuses unless the decision record is approved and the working tree is clean. It reads the run branch, named for the epic, from the remote and the local copy. A missing branch is created, and an existing branch is continued, and the first output line says the run is resuming. A remote-only branch is copied down, and a local copy behind the remote is brought up to date. When the record's newest trusted HLD comment is current, the command refuses unless the page it links can be read, unless the lead chose to build from the record alone. Stories that already have their own commit on the branch count as built. One implementation agent builds the remaining stories in blocked-by order. While it works, the command checks each new story commit, pushes it, and opens the draft pull request at the first one. The status section lists built and pending stories. When no story remains, no agent builds, and the pull request says this run did not run the test suite.

## Key Invariants

1. Every refusal that can be decided from the issue graph and the checkout comes before any agent runs. This includes diverged branch copies, a merge commit on the run branch, a branch not made on top of the base, and earlier commits that break the story commit check.
2. Claude stages default to auto permission mode. The command refuses when auto mode is unavailable and never widens the mode silently.
3. A story commit is pushed only after it passes the story commit check. A failed check ends the agent stage and stops the run.
4. Pushed commits are never rewritten. Every push is a plain push, and a run branch that no longer descends from its last checked commit stops the run.
5. A finished story is on the remote before the build stage ends. A stop after that keeps every story already published.

## Integration Points

- [nexus-pipeline](nexus-pipeline.md) — the one exception to implementation staying with engineers. No stage calls this command.
- [scope-claim](scope-claim.md) — the grammar the draft pull request body uses to claim each story.
- [publishing-config-resolution](publishing-config-resolution.md) — resolves the test command and the issues repository.
- [implement-fix-loop](implement-fix-loop.md) — the analyze and fix rounds that run on the draft pull request this command opens.
- [hld-build-input](hld-build-input.md) — decides in the preflight whether the implementation agent builds from a high-level design page.

## Decision Log

### 2026-10-31 — #928 — Implementation becomes an optional verb that loops on the published verdict

The unattended flow became a verb of the shipped command-line tool, replacing two repository-only scripts, so an adopter can run it and it calls the one verdict reader and the one answer reader. The loop reads the published verdict on the pull request every round, fixes only Critical, High and Medium items, and stops instead of editing when a fix would contradict the record or is architectural. Refuted alternative: ship the existing shell script inside the package behind a thin verb. It matches verdict text with its own trust filter, which is a second copy of the reader close uses and can drift from it. The same change reverses the reasoning of the pipeline's decision 0001, which kept the code-generation step outside Nexus. The exception is limited to this command, which no stage calls.

### 2026-11-03 — #970 — An optional high-level design page lets the lead preview the build before the agent starts

A lead may now render an approved epic's design as a high-level design page before running this command. The page shows how the design will be built, in diagrams and prose derived from the decision record. The lead reads it, fine-tunes the design, and only then starts the unattended run. The step is optional, and this command does not require it.

### 2026-11-04 — #979 — The command is named implement, with no alias for the old name

The verb was called implement-epic, which repeated what its argument already says. It is now called implement and takes the same arguments with the same behaviour. A call to the old name gets an unknown-command error. The page keeps both names as aliases so a search for either finds it. The hidden status markers in pull request bodies keep the old name, so pull requests opened by earlier runs still match. Refuted alternative: keep the old verb as an alias for the new one. The pull request declines an alias outright, and a second name for one command would leave two spellings in every document that names it.

### 2026-11-05 — #971 — Preflight refuses an unreadable current HLD page; the fix loop moves to its own page

When the record's newest trusted HLD comment is current, the preflight now also refuses unless the page it links can be read, unless the lead chose to build from the record alone. The stop comes before the branch exists, because the command refuses to run when its branch already exists, and a stop after that would block the very re-run that answers it. Refuted alternative: continue from the record alone with a warning, as for a stale page. It needs no new option, but the lead approved a current design, and building without it silently is the outcome the epic rejects. The page went over its word cap with this change, so the analyze and fix rounds, their four loop invariants and the ready rule moved to the implement-fix-loop page. The links to pr-verdict-answers and published-verdict-selection moved with them, and the "implement-epic fix loop" alias now finds that page. How the new page is chosen, checked and read is on the hld-build-input page.

### 2026-11-22 — #991 — A re-run continues an interrupted run from the branch and the pull request

The command no longer refuses when the run branch exists. A re-run continues on it from any clone and builds only the stories that have no commit yet. The commits on the branch are the record of progress, so no progress file is written. Each story commit is pushed while the build stage runs, so finished work is never held on one machine. The local and remote copies are brought together before any agent stage, and a diverged pair stops the run, because settling it would rewrite one side. "Made on top of the base" means a shared fork point with the remote base and no merge commit after it. That keeps stubs committed to the base after the run started from passing as written before the run. Refuted alternative: treat the local branch as the only truth and push with force-with-lease. It needs no step to bring the copies together, but a stale clone would overwrite stories another machine already published. Refuted alternative: one build stage per story, with check and push after each. It needs no watcher, but every story's session would read the record, the design page and the epic again and lose the context of the dependent chain. The story commit made in the agent's last few seconds is pushed right after the stage ends, a departure the lead accepted.
