---
title: "Implement Fix Loop"
aliases: ["implement-epic fix loop", "implement fix loop", "analyze and fix rounds", "fix round", "implement ready rule"]
touches: ["unattended-epic-implementation", "pr-verdict-answers", "published-verdict-selection"]
last_updated_by: "#971"
status: active
verification: verified
---

# Implement Fix Loop

After the unattended implement command opens its draft pull request, it repeats analyze and fix rounds until no Critical, High or Medium item is open. It then marks the pull request ready. Each round reads its open items from the newest trusted verdict on the pull request.

## How It Works

Each round runs analyze against the pull request and publishes a verdict. The command reads the open items from the newest trusted verdict. A fix agent then works only the Critical, High and Medium items. The command posts an answer only when a person's earlier text implies it. The fix agent's instructions do not change when the implementation agent built from a high-level design page. A fix that would contradict a record decision or guarantee still stops the run.

## Key Invariants

1. A fix round sorts every item before it edits. If any item would contradict a record decision or guarantee, or is architectural, the round changes nothing and the run stops with each reason.
2. Low items are never fixed.
3. Progress is a change in the set of open Critical, High and Medium item IDs. A round that leaves the set unchanged, the round cap, or an analyze run with no verdict stops the run.
4. Only the command posts answers, only from text written before the run, and each names its source. An answer line that appears during an agent stage stops the run.
5. The pull request is marked ready only on a trusted verdict for its current head with nothing open.

## Integration Points

- [unattended-epic-implementation](unattended-epic-implementation.md) — the command that opens the draft pull request these rounds run on.
- [pr-verdict-answers](pr-verdict-answers.md) — supplies the item IDs the loop tracks and the answer lines the command posts.
- [published-verdict-selection](published-verdict-selection.md) — picks the newest trusted verdict every round reads.

## Decision Log

### 2026-11-05 — #971 — Split from unattended-epic-implementation

The unattended-epic-implementation page went over its word cap when epic #971 added a preflight refusal for an unreadable high-level design page. The analyze and fix rounds moved here. A task that changes how a round reads the verdict, fixes items or posts answers does not need the preflight. A task that changes the preflight or the implementation agent's instructions does not need the rounds. The loop's behaviour did not change. Epic #971 kept the fix agent's instructions as they were, so a high-level design page never reaches a fix round.
