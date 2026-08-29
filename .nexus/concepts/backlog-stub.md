---
title: "Backlog Stub"
aliases: ["backlog stub", "unplanned epic", "stub decomposition", "stub promotion", "unplanned label", "cross-feature backlog", "deferred scope filing"]
touches: ["epic-approval-gate", "publishing-config-resolution", "issue-sourced-planning", "durable-close-record", "discovery-graduation", "fog-referral-gate", "resumable-batch-filing"]
last_updated_by: "#353"
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
- [publishing-config-resolution](publishing-config-resolution.md) — supplies the unplanned label and the classification the batch filing path stamps, as resolved keys rather than hard-coded values.
- [issue-sourced-planning](issue-sourced-planning.md) — its resolver refuses an unplanned epic by name instead of emitting one whose story set is empty.
- [durable-close-record](durable-close-record.md) — carries the numbers deferred scope was filed under, so the stubs are filed before that comment is composed.
- [discovery-graduation](discovery-graduation.md) — files stubs from a finished discovery through this same contract, adding the decisions each goal hangs on.
- [fog-referral-gate](fog-referral-gate.md) — separates fog from oversized scope, so only scope that is big but clear reaches this decomposition path.
- [resumable-batch-filing](resumable-batch-filing.md) — the one batch path both stub writers file through, whose preflight refuses a parented stub before anything is created.

## Decision Log

### 2026-08-02 — #185 — A stub is an epic born unplanned, and its number survives promotion

Deferred and oversized scope stopped being markdown blocks in per-feature committed files and became epic issues marked unplanned, because a stub already is an epic — a functional goal sized at or below the epic ceiling, destined to become exactly one epic. Modelling it as its own kind would force every consumer to learn a third species and would answer the classification question twice, once per classification mode, where no suitable issue type exists and none can be minted without organisation-level administration. The identity consequence is the load-bearing one: because promotion populates the issue in place rather than creating a successor, every reference written when the scope was deferred — a dependency edge between siblings, a mention from the epic that spawned it, a line in a sequencing table — stays valid for the life of the work instead of being orphaned the moment the stub is promoted. Retiring the per-feature files collapses the backlog to one query and its exclusion to one negated filter; carrying that negation on every epic-enumerating query is the accepted price of the durable identity, named here rather than discovered later as a defect. Refuted alternative: a distinct backlog kind with its own label and its own issue type — it reads cleanly in a triage list and keeps unplanned work out of the epic query by construction, but the issue type cannot be created where the organisation has not defined one, so that mode degrades to filing stubs unmarked, and it forces a second identity at promotion, orphaning every reference to the first. Refuted alternative: create the epic fresh and close the stub as completed naming its successor — needs no change to the filing path, but it reintroduces an identity hop on every promotion and leaves a permanent trail of closed placeholders every reader and every dependency edge must indirect through.

### 2026-08-06 — manual — Three interactions the cap had suppressed become declared edges

When this page was distilled, three real interactions were left as prose rather than declared as edges: the resolver that supplies the unplanned label and the stub classification, the epic resolver that refuses an unplanned epic by name, and the durable close comment that names the numbers deferred scope was filed under. None of the three was a judgement about the concept. Each neighbour sat within two words of the body cap, a reciprocal bullet cost more than the headroom, and compressing still-true content on a neighbour to make room is not a legal move — so the drain dropped the edges and recorded them in prose, flagging the loss for review. Epic #220 re-cut the cap to measure a page's own content and to bound the neighbour list per entry, which removed the constraint entirely: the fan-out can no longer fail, and a real interaction is always declarable. The three edges are declared here by hand, since both epics had already drained and there was no queue entry left to carry them. Refuted alternative: leave the relationships as prose and let the next drain touching one of the four pages declare them — it keeps the store single-writer, but it makes blast-radius retrieval on this page wrong for as long as no such drain happens, which is exactly the silent degradation the flag was raised about.

### 2026-08-11 — #228 — A discovery-filed stub is an ordinary stub carrying its decisions

Graduating a discovery files one stub per functional goal through the same batch path, with the same classification, the same unplanned label, and the same body meta every decomposition stub carries, so nothing here learns a second stub shape. What a discovery adds is content rather than contract: each stub body gains the resolved decisions its goal hangs on, in full, and the same text is posted once more as a marked comment. Promotion stays exactly as it was, rewriting the body on the issue the stub was filed under, and it neither reads nor moves that comment. The referral gate is what keeps this path honest, because only scope that is big but clear now decomposes here, while scope nobody can yet state goes to discovery first. Refuted alternative: give a discovery-produced stub its own shape or its own marker so it is recognisable in the backlog — rejected because a second shape would be a third copy of the stub contract, which is exactly what routing graduation through the existing path removes.

### 2026-08-29 — #353 — Reciprocal link from resumable-batch-filing

Mechanical reciprocity fan-out: the resumable-batch-filing page names this page's stub contract as what its preflight enforces — a work item marked unplanned that also asks for a parent refuses the whole batch, which is the never-a-sub-issue rule stopping a stub that would deadlock the stage that filed it.
