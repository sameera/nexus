---
title: "Epic Completion Judgment"
aliases: ["completing pull request", "epic-level judgment", "cross-story guarantees"]
touches: ["conformance-gate"]
last_updated_by: "#896"
status: active
verification: verified
---

# Epic Completion Judgment

The conformance gate judges an epic's success metrics and its cross-story guarantees on the pull request that completes the epic. Earlier story pull requests are judged on their own stories only.

## How It Works

On the pull request that completes its epic, analyze also judges the success metrics and the cross-story guarantees, but only once that pull request's code contains every merged sibling. An earlier story pull request is checked against the criteria of its own stories, because the sibling stories have not landed yet. No epic-wide receipt combines story verdicts. The epic-level judgment sits on the completing pull request's own verdict.

## Key Invariants

1. Success metrics and cross-story guarantees are judged only on the pull request that completes the epic.
2. That judgment waits until the pull request's code contains every merged sibling.
3. No epic-wide receipt combines story verdicts.

## Integration Points

- [conformance-gate](conformance-gate.md) — the gate whose verdict carries this judgment.

## Decision Log

### 2026-10-09 — #896 — Split from conformance-gate
The gate page passed its own-content cap when it also began to check the invariants on the epic's listed pages. Epic-level judgment applies on one pull request in an epic, so it loads separately from the per-pull-request checks. The text moved without change. Refuted alternative: judge the metrics and cross-story guarantees on every story pull request, which marks each one failing for work nobody claimed to have shipped.
