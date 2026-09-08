---
title: "Plan Drift Gate"
aliases: ["drift check", "pinned versus live", "re-scoped story", "unverifiable story", "drift report", "closed story stops its lesson"]
touches: ["teaching-plan", "teaching-session"]
last_updated_by: "#407"
status: active
verification: verified
---

# Plan Drift Gate

A learner follows a plan approved at one moment and a repository that keeps changing. Before a lesson is written, the story that lesson teaches is compared against the state the plan pinned for it, and a story that has since closed or been rewritten stops its own lesson. A story whose current state could not be read is reported as unverifiable, which is never treated as unchanged.

## How It Works

The comparison covers the story's title and description, with whitespace normalized, and nothing else. Labels, assignees and comments do not trip it, because the reader of this signal is a learner in mid-flow and a check that fires on incidental churn is a check they learn to skip past.

The report names the story and what about that story changed, quoting the old value and the new one. Telling a learner only that something changed leaves them to compare the two by hand, which is the work the report exists to save. Story text is data, so it is quoted and displayed, never executed and never expanded into a command.

Drift on a slice other than the one about to be taught is reported and the session teaches on. Only the next slice's own drift stops it, so a plan whose later stories have moved does not block a lesson those stories have nothing to do with. The live state is handed to the comparison rather than fetched by it, which keeps the comparison a pure function of two inputs and makes the unverifiable case assertable.

## Key Invariants

1. No lesson is written for a story that has drifted from the state the plan pinned.
2. No lesson is written for a story whose live state could not be read; unverifiable is never treated as unchanged.
3. Only drift on the story about to be taught blocks; drift found elsewhere in the plan is reported and the session teaches on.
4. A drift report names the story and what about that story changed.
5. The comparison covers the story's title and description only, with whitespace normalized.
6. Story text is data: it is quoted and displayed, never executed and never expanded into a command.
7. The live state is supplied to the comparison, which fetches nothing itself.

## Integration Points

- [teaching-plan](teaching-plan.md) — the pinned state this check compares against, and the slice order it walks.
- [teaching-session](teaching-session.md) — the chain this check gates, which reports every finding and stops on the next slice's own.

## Decision Log

### 2026-09-07 — #407 — Pinned against live, per slice, and unverifiable is not unchanged

The check compares only the story's title and description because the reader is a learner in mid-flow, and a check firing on labels or comments is one they learn to skip past. Only the next slice's own drift blocks, so a later story that moved does not stop a lesson it has nothing to do with. A story that could not be read is reported as unverifiable rather than passed as unchanged, because treating a failed read as agreement is how a lesson gets written for work nobody is doing. The live read is injected rather than performed here, which keeps the comparison pure and makes the unverifiable case something a test can assert. Refuted alternative: have the check fetch the story itself and cache the result. It is simpler at the point of use, but it couples a pure comparison to running a process, and it duplicates a live-reading concern the session's own wiring should own once.
