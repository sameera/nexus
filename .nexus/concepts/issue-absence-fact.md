---
title: "Issue Absence as a Fact"
aliases: ["missing issue", "issue not found", "absent issue", "lookup failure", "fatal by default", "could not resolve to an issue"]
touches: ["pr-story-resolution", "issue-sourced-planning"]
last_updated_by: "#564"
status: active
verification: verified
---

# Issue Absence as a Fact

A number that names no issue is a fact the lookup reports, not a failure it raises. The platform answers a missing issue with a failed call, so absence is read only from a failure that says that issue lookup found nothing; an unreachable host, a rejected credential, a rate limit and a missing repository all stay failures and stop the run. Each caller then decides for itself whether absence is fatal for it.

## How It Works

The lookup that reads an issue's parent, kind and labels is the boundary between the pipeline and the platform, and it inspects what failed. A failure naming that issue lookup as not found becomes the fact that the number matches no issue. Every other failure is returned unchanged and stops the run. The decision sits at the boundary, so every caller inherits it.

The two callers treat absence differently, which is why it is a fact rather than an error. The ladder resolving a pull request to its stories sets an absent candidate aside and names it in the refusal, since a number lifted from a branch name may be anything. The resolver rebuilding an epic from its number reads absence as an issue not filed as an epic, so a mistyped epic number is still refused as a missing epic rather than reported as a reference that names no story.

Fatal is the safe default. Reading a rejected credential as absence would quietly shrink a story list and let a gate report a pass over code nobody read.

## Key Invariants

1. A failed issue lookup is read as absence only when the failure says that issue lookup found nothing.
2. Every other failure — an unreachable host, a rejected credential, a rate limit, a missing repository — stops the run and reports itself.
3. Absence is returned as a fact about the issue, never raised as an error.
4. Each caller decides whether absence is fatal for it; the boundary never decides on a caller's behalf.
5. An epic number that matches no issue is still refused as a missing epic, not as a reference that names no story.

## Integration Points

- [pr-story-resolution](pr-story-resolution.md) — sets an absent candidate aside and names it in its refusal, so one stray number cannot stop the gate.
- [issue-sourced-planning](issue-sourced-planning.md) — its epic resolver reads absence as an issue not filed as an epic, keeping a mistyped epic number refused by name.

## Decision Log

### 2026-09-12 — #564 — Absence is decided at the lookup boundary, and the default is fatal

The platform reports a missing issue as a failed call and never as a successful empty answer, so absence can only be drawn from the failure itself. Putting the decision at the boundary means every caller of the lookup inherits the repair, and returning absence as a fact rather than an error lets each caller decide what absence means for it. The match is deliberately narrow so that a rejected credential, an unreachable host and a rate limit all stay fatal. Refuted alternative: treat any failure of that lookup as absence and let the caller carry on. It is simpler, and it satisfies the first two acceptance criteria of the story that asked for this. It loses on the third, because a rejected credential would silently shrink a story list and the gate would then report a pass over stories it never read. This defect shipped green because the double standing in for the platform answered a missing issue with a successful empty response, which the platform never does; that double was corrected before the fix, turning a passing test red as the expected first step, because a double that can assert behaviour the platform cannot produce hides the next defect of this class in the same place.
