---
title: "Initiative Filing"
aliases: ["stubs under an initiative", "initiative filing order", "initiative read-back", "filing under an initiative"]
touches: ["initiative", "resumable-batch-filing"]
last_updated_by: "#1011"
status: active
verification: verified
---

# Initiative Filing

Initiative filing is the run that files an accepted initiative and its stubs, in a fixed order. The initiative is filed first, with its planning context, and every stub is filed as its child afterward. A repeated run finishes an interrupted filing without filing a second copy of anything.

## How It Works

On accept, the run files the initiative with its planning context first, posting any context that does not fit in the body as numbered comments on it, then files the stubs as its children, then writes the stub numbers into its ordered list. It reads back the initiative's children and reports the run incomplete if any stub is missing. Repeating the run finishes it without filing a second copy of anything.

## Key Invariants

1. Every stub of an accepted set is a child of that initiative and of nothing else.
2. Every context part is posted and read back before the first stub is filed.

## Integration Points

- [initiative](initiative.md) — the parent issue this run files and whose ordered list it fills with the stub numbers.
- [resumable-batch-filing](resumable-batch-filing.md) — files the initiative as its own one-item batch before the stubs, and retries a failed parent link on a repeat.

## Decision Log

### 2026-11-14 — #1011 — split from initiative

The initiative page passed the word cap when its consent and no-table rules were narrowed to text outside the planning context. The filing order, the children read-back and the rule that every stub is a child of the initiative moved here, because a reader checking how a filing runs does not need the objective and reach rules. The filing now posts the planning context on the initiative before any stub, so no teammate can plan a stub while its context is incomplete.
