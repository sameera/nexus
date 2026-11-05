---
title: "Unattended Epic Implementation"
aliases: ["nexus implement", "implement command", "implement-epic command", "nexus implement-epic", "unattended implementation", "implement an epic unattended"]
touches: ["nexus-pipeline", "scope-claim", "publishing-config-resolution", "implement-fix-loop", "hld-build-input"]
last_updated_by: "#971"
status: active
verification: verified
---

# Unattended Epic Implementation

An optional command implements an approved epic with no one watching. It builds each story in its own commit, opens a draft pull request, and repeats analyze and fix rounds until no Critical, High or Medium item is open. It then marks the pull request ready. The lead chooses to run it. No pipeline stage runs it or writes code.

## How It Works

Before any agent runs, the command resolves the epic and refuses unless the decision record is approved, the working tree is clean and the run's branch, named for the epic, does not exist. When the record's newest trusted HLD comment is current, it also refuses unless the page that comment links can be read, unless the lead chose to build from the record alone. The command creates that branch itself. An implementation agent builds the stories in blocked-by order, or ends with a blocked outcome when a "Before implementation" item cannot be done from the checkout. With a current HLD page, the agent is also told to build from that page. The command checks that each story has its own commit, pushes, and opens a draft pull request that claims every live story. The analyze and fix rounds then run on that pull request. Every stop rewrites a status section of the pull request body and exits non-zero.

## Key Invariants

1. Every refusal that can be decided from the issue graph and the checkout comes before any agent runs.
2. Claude stages default to auto permission mode. The command refuses when auto mode is unavailable and never widens the mode silently.

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
