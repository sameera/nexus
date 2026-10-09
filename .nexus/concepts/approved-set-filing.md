---
title: "Approved-Set Filing"
aliases: ["filing the approved set", "issue-first filing", "feature navigation index"]
touches: ["epic-approval-gate"]
last_updated_by: "#896"
status: active
verification: verified
---

# Approved-Set Filing

After the approval digest, the epic stage files the epic issue and one issue per approved story. It files the epic first and commits nothing, and a re-run reuses the epic already filed.

## How It Works

On approval, the stage files the epic issue and one issue per story for the approved set. It sequences them from the draft's ordering block and writes the feature navigation index linking to the filed issue. Filing declares the design warrant. Under issue-sourced planning it commits nothing, and the draft lives in the run's own folder. Filing is issue-first, and a re-run reuses the already-filed epic issue. The epic and its stories resolve their target repository independently, so later stages address the epic where it was filed.

## Key Invariants

1. Filing commits nothing at planning: the epic issue precedes its story children, and a re-run reuses an already-filed one.
2. The epic and its stories resolve their target repository independently; later stages address the epic where it was filed.
3. Stories are sequenced from the draft's ordering block.

## Integration Points

- [epic-approval-gate](epic-approval-gate.md) — the gate whose approval this filing follows.

## Decision Log

### 2026-10-09 — #896 — Split from epic-approval-gate
The gate page passed its own-content cap when the digest gained the reading list. What approval files, and in what order, does not depend on what the digest shows, so each half loads on its own. The text moved without change. Refuted alternative: drop the repository-resolution rule to fit, which would lose the reason later stages address the epic where it was filed.
