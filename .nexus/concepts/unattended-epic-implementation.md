---
title: "Unattended Epic Implementation"
aliases: ["implement-epic command", "nexus implement-epic", "unattended implementation", "implement an epic unattended", "implement-epic fix loop"]
touches: ["nexus-pipeline", "pr-verdict-answers", "published-verdict-selection", "scope-claim", "publishing-config-resolution"]
last_updated_by: "#928"
status: active
verification: verified
---

# Unattended Epic Implementation

An optional command implements an approved epic with no one watching. It builds each story in its own commit, opens a draft pull request, and repeats analyze and fix rounds until no Critical, High or Medium item is open. It then marks the pull request ready. The lead chooses to run it. No pipeline stage runs it or writes code.

## How It Works

Before any agent runs, the command resolves the epic and refuses unless the decision record is approved, the working tree is clean and the run's branch, named for the epic, does not exist. The command creates that branch itself. An implementation agent builds the stories in blocked-by order, or ends with a blocked outcome when a "Before implementation" item cannot be done from the checkout. The command checks that each story has its own commit, pushes, and opens a draft pull request that claims every live story. Each round then runs analyze against the pull request and publishes a verdict. The command reads the open items from the newest trusted verdict, and a fix agent works only Critical, High and Medium items. The command posts an answer only when a person's earlier text implies it. Every stop rewrites a status section of the pull request body and exits non-zero.

## Key Invariants

1. Every refusal that can be decided from the issue graph and the checkout comes before any agent runs.
2. A fix round sorts every item before it edits. If any item would contradict a record decision or guarantee, or is architectural, the round changes nothing and the run stops with each reason.
3. Low items are never fixed.
4. Progress is a change in the set of open Critical, High and Medium item IDs. A round that leaves the set unchanged, the round cap, or an analyze run with no verdict stops the run.
5. Only the command posts answers, only from text written before the run, and each names its source. An answer line that appears during an agent stage stops the run.
6. The pull request is marked ready only on a trusted verdict for its current head with nothing open.
7. Claude stages default to auto permission mode. The command refuses when auto mode is unavailable and never widens the mode silently.

## Integration Points

- [nexus-pipeline](nexus-pipeline.md) — the one exception to implementation staying with engineers. No stage calls this command.
- [pr-verdict-answers](pr-verdict-answers.md) — supplies the item IDs the loop tracks and the answer lines the command posts.
- [published-verdict-selection](published-verdict-selection.md) — picks the newest trusted verdict every round reads.
- [scope-claim](scope-claim.md) — the grammar the draft pull request body uses to claim each story.
- [publishing-config-resolution](publishing-config-resolution.md) — resolves the test command and the issues repository.

## Decision Log

### 2026-10-31 — #928 — Implementation becomes an optional verb that loops on the published verdict

The unattended flow became a verb of the shipped command-line tool, replacing two repository-only scripts, so an adopter can run it and it calls the one verdict reader and the one answer reader. The loop reads the published verdict on the pull request every round, fixes only Critical, High and Medium items, and stops instead of editing when a fix would contradict the record or is architectural. Refuted alternative: ship the existing shell script inside the package behind a thin verb. It matches verdict text with its own trust filter, which is a second copy of the reader close uses and can drift from it. The same change reverses the reasoning of the pipeline's decision 0001, which kept the code-generation step outside Nexus. The exception is limited to this command, which no stage calls.
