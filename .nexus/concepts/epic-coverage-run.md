---
title: "Epic Coverage Run"
aliases: ["coverage run", "shipped coverage states", "four coverage states", "failed story read", "story-read-failed"]
touches: ["shipped-ledger", "aggregated-epic-receipt", "story-evidence-report", "close-and-distill-command"]
last_updated_by: "#827"
status: active
verification: verified
---

# Epic Coverage Run

Analyze, addressed at an epic, reports each story as shipped, unrecorded, unshipped or excluded, read from the records on the epic issue. A story whose pull requests could not be read is never put in any of those states. The run names every such story, prints no coverage and exits with an error.

## How It Works

The run re-reads the live story set every time. A story added after a record was written is therefore reported without invalidating the records already there. A story marked on its issue as shipping without a pull request of its own is excluded rather than reported unshipped. Unrecorded and unshipped stay apart because their remedies differ. Unrecorded means a merge skipped the gate. Unshipped means the work is not done yet.

For each story that is not excluded, the run reads the merged pull requests that claim it. When any story's read fails, the run still reads every other story first. It then exits with an error that names each failed story and its cause, and it prints no coverage. The one-command close script checks coverage mechanically, so the error stops that script before close starts. The remedy is a plain re-run once the read succeeds.

## Key Invariants

1. Coverage is reported in exactly four states, over the live story set read on this run.
2. A failed read of a story's pull requests is never reported as unshipped or as any other coverage state.
3. A run with any failed read prints no coverage and exits with an error naming every failed story and its cause.
4. Every remaining story is read before the run exits, so one run names every unreadable story.

## Integration Points

- [shipped-ledger](shipped-ledger.md) — the records each coverage state is read from. Split out of that page.
- [aggregated-epic-receipt](aggregated-epic-receipt.md) — the same epic-addressed stage, and the complete read of each story's pull requests this run performs. Split out of that page.
- [story-evidence-report](story-evidence-report.md) — the close-side report built on the same read, which stops close on a failed read in the same way.
- [close-and-distill-command](close-and-distill-command.md) — the script that stops before close when this run exits with an error.

## Decision Log

### 2026-10-01 — #827 — Split from shipped-ledger and aggregated-epic-receipt, and a failed read prints no coverage

Both parent pages stated the four coverage states, and the new failed-read rule took both over the 400-word cap. The states moved here as one statement, so the two parents keep only how a record is written and how the epic receipt is derived. The new rule: when any story's pull requests cannot be read, the run reads the rest, names every failed story with its cause, prints no coverage and exits with an error. The one-command close script is the only program that reads coverage mechanically, and it checks only that the pull request it just analyzed has a record. Refuted alternative: add a fifth state, "unread", and keep reporting the stories that did resolve. The lead would still see the rest of the epic. It lost because every reader, including stage instructions that read the output as prose, would have to learn the new state, and a reader that ignores it reads a gap as no gap. The cost is that one unreadable story hides the coverage of every other story until the read succeeds.
