---
title: "Report-Free Shared Layer"
aliases: ["outcome-returning layer", "silent mechanism layer", "shared call outcome"]
touches: ["resumable-batch-filing", "epic-issue-filing"]
last_updated_by: "#352"
status: active
verification: verified
---

# Report-Free Shared Layer

A mechanism shared by more than one capability — a platform call, a lookup — never prints; it returns what happened, success value or failure detail included, so each caller renders its own line in its own vocabulary and its own stream. This is what lets a second capability reuse a first's lookups and platform calls without silently inheriting the first's wording.

## How It Works

A shared mechanism that prints picks one caller's voice for every future caller: on the day it is written it has exactly one consumer, so its wording matches that consumer by definition, and the mismatch stays invisible until a second, differently-voiced caller arrives. Returning the outcome instead removes the choice: a caller that succeeded gets its value, a caller that failed gets the reason as data rather than as a line already committed to a stream, and "found nothing" stays distinct from "could not check" rather than collapsing into one silent absence.

Where a lookup asks more than one candidate for the same question — an organisation's version of a name, then a person's — the fallback advances only when the current candidate refused to answer or answered in a shape that means it does not apply; an answer that plainly means "no match" ends the search there, and only the last candidate actually asked reports a failure.

## Key Invariants

1. A shared mechanism used by more than one caller prints nothing; it returns its outcome, success value or failure detail included, and the caller renders its own line.
2. "Ran and found nothing" and "could not run" are always distinguishable outcomes, never collapsed into the same empty answer.
3. A failure carries what stopped it as data, not a finished sentence, so two callers can each word the same failure in their own vocabulary.
4. Falling back from one candidate answer to the next happens only when the current candidate refused to answer or answered in a shape meaning it does not apply, never when it plainly answered "no match".
5. When several candidates are asked in sequence, only the last one actually asked reports its failure.

## Integration Points

- [resumable-batch-filing](resumable-batch-filing.md) — the first capability whose lookups and platform calls this layer generalised from, once a second caller needed them.
- [epic-issue-filing](epic-issue-filing.md) — the second caller, reusing every lookup and platform call this layer supplies without inheriting the first caller's wording.

## Decision Log

### 2026-08-30 — #352 — A second caller with its own vocabulary forced the layer to stop printing

The mechanism a first capability built for itself printed its own lines from inside, which was invisible as a defect until a second capability needed the same lookups and platform calls but speaks a different vocabulary — different wording, different emoji, some lines on a different stream entirely. Rather than let the second caller inherit the first's lines on exactly the calls it reused, or accept a permanent cosmetic mismatch on those lines, the mechanism itself stopped printing, and each caller started rendering its own line from the outcome it gets back. Refuted alternative: accept the mismatch as a bounded cosmetic divergence, since nothing downstream parses these lines and no existing check pins them — genuinely viable and cheaper, and kept in reserve as a fallback, but rejected because the divergence would recur, unbounded, with every future caller that reuses the same mechanism.
