---
title: "Backlog Stub"
aliases: ["backlog stub", "unplanned epic", "stub decomposition", "stub promotion", "unplanned label", "cross-feature backlog", "deferred scope filing"]
touches: ["epic-approval-gate"]
last_updated_by: "#185"
status: active
verification: verified
---

# Backlog Stub

A backlog stub is an epic identified but not yet planned — an epic issue carrying the repository's declared epic classification plus exactly one label denoting that unplanned state. Planning populates that same issue in place, so the number scope is deferred under is the number it ships under. The whole cross-feature backlog is therefore one query, and excluding unplanned work one negated filter.

## How It Works

Two writers create stubs: the epic stage when scope exceeds one epic, and the close stage when it defers scope. Both author transient work-items and file them through the one batch filing path, which takes its canonical classification from the caller instead of stamping everything a story. That path upserts every label it will apply before creating anything, and a label it can neither create nor find stops the run with nothing created. A stub is never a sub-issue — its link to the epic that spawned it is a body mention — because the close gate that blocks on open sub-issues has no exemptions and would deadlock on a stub it just filed. Feature, estimate, candidate stories and provenance live in the body, never in labels. Planning a stub fills in that same issue, files its story children beneath it, and clears the label; nothing is created and nothing is closed. A stub too large to become one epic is closed as not planned, naming its successors.

## Key Invariants

1. A stub is an epic issue carrying the declared epic classification; no third kind of issue exists.
2. Exactly one label denotes the unplanned state; feature, estimate, candidate stories and provenance are body content.
3. The issue number is a stub's only identifier; no second lookup key is recorded or accepted as input.
4. Promotion populates that same issue and clears the label — never a second issue, never a close.
5. A stub too large for one epic is closed as not planned naming its successors, never as completed.
6. No stub is ever a sub-issue, and no stub enters an epic's sub-issue set.
7. Because a stub is an epic, every query enumerating epics for planned work carries the one negated filter, and every stage reconstructing an epic refuses an unplanned one by name.

## Integration Points

- [epic-approval-gate](epic-approval-gate.md) — what oversized scope becomes, and what a promotion re-enters this gate as.

## Decision Log

### 2026-08-02 — #185 — A stub is an epic born unplanned, and its number survives promotion

Deferred and oversized scope stopped being markdown blocks in per-feature committed files and became epic issues marked unplanned, because a stub already is an epic — a functional goal sized at or below the epic ceiling, destined to become exactly one epic. Modelling it as its own kind would force every consumer to learn a third species and would answer the classification question twice, once per classification mode, where no suitable issue type exists and none can be minted without organisation-level administration. The identity consequence is the load-bearing one: because promotion populates the issue in place rather than creating a successor, every reference written when the scope was deferred — a dependency edge between siblings, a mention from the epic that spawned it, a line in a sequencing table — stays valid for the life of the work instead of being orphaned the moment the stub is promoted. Retiring the per-feature files collapses the backlog to one query and its exclusion to one negated filter; carrying that negation on every epic-enumerating query is the accepted price of the durable identity, named here rather than discovered later as a defect. Refuted alternative: a distinct backlog kind with its own label and its own issue type — it reads cleanly in a triage list and keeps unplanned work out of the epic query by construction, but the issue type cannot be created where the organisation has not defined one, so that mode degrades to filing stubs unmarked, and it forces a second identity at promotion, orphaning every reference to the first. Refuted alternative: create the epic fresh and close the stub as completed naming its successor — needs no change to the filing path, but it reintroduces an identity hop on every promotion and leaves a permanent trail of closed placeholders every reader and every dependency edge must indirect through.
