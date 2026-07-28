---
title: "Approvable Decision Record"
aliases: ["decision record", "record sub-issue", "record approval", "needs-design gate", "record revision flow"]
touches: ["issue-sourced-planning", "epic-approval-gate", "publishing-config-resolution", "nexus-pipeline", "committed-queue", "distiller", "record-digest", "conformance-gate"]
last_updated_by: "#157"
status: active
verification: verified
---

# Approvable Decision Record

An epic's decision record — the architectural why the design stage produces — lives as a sub-issue of the epic issue: one copy, born durable, addressable by the provenance reference form. Approval is closing that sub-issue; the timeline supplies who and when, and Nexus writes no approval field anywhere.

## How It Works

The design-warrant is read from the issue graph, never remembered: a medium-or-larger complexity rollup labels the epic needs-design at filing; a no-design-needed outcome removes the label without filing anything; a hand-filed epic with neither has none. The design stage files the record as pure human prose — no frontmatter, no machine block — and swaps needs-design for in-progress, asserting existence, not approval; a re-run targets the existing sub-issue, never a second. Once approved the record can still be corrected without being edited: when close's diff shows a decision it no longer holds, close posts one advisory comment naming the decision, what shipped, and why — a conformant close posts nothing, and a pre-implementation change instead reopens and revises the record directly.

## Key Invariants

1. The record lives only as a sub-issue of the epic issue; no record file is written.
2. Approval is the close of the record sub-issue and nothing else; actor and time come from the timeline.
3. A record closed as not planned is withdrawn, not approved.
4. At most one record sub-issue per epic; a second candidate aborts.
5. The design-warrant is answered from the issue graph alone, never remembered state.
6. A closed body is editable only by reopen-and-revise, or amendable by an advisory comment that never touches body, title, labels, or state; every revision embeds the superseded body and hash.
7. The body is pure human prose.

## Integration Points

- [issue-sourced-planning](issue-sourced-planning.md) — classified out of the story set, surfaced as a recoverable field.
- [epic-approval-gate](epic-approval-gate.md) — applies the needs-design label at filing, from the complexity rollup.
- [publishing-config-resolution](publishing-config-resolution.md) — resolves the record marker and gate labels for classification.
- [nexus-pipeline](nexus-pipeline.md) — the design stage files and revises it; gates block while unapproved.
- [committed-queue](committed-queue.md) — old-contract entries keep a committed record file until they clear.
- [distiller](distiller.md) — the drain sources an entry's why from the body, hash-verified.
- [record-digest](record-digest.md) — the canonical digest of the approved body.
- [conformance-gate](conformance-gate.md) — blocked entirely, emitting nothing, while this record is unapproved.

## Decision Log

### 2026-07-26 — #139 — The decision record becomes an approvable sub-issue

The record had no durable home — it lived in the drain buffer the distiller deletes, or latterly in an ignored scratch path — so its home moved to a sub-issue of the epic issue, with approval the native act of closing it: one copy, born durable, with the approving account and time read from the timeline instead of a Nexus-authored field. The needs-design label makes the design-warrant explicit and revisable, so a simple epic completes the pipeline with no record and no waiver, and a hand-filed epic works with no remembered state. A closed body is frozen because the hash means nothing against a moving target; revision reopens, embeds the superseded body and its hash in a dated comment, and re-closes, since the platform's edit history is not reliably retrievable by tooling. Refuted alternative: keep authoring the record as a committed file and mirror it onto an issue — durable, but it re-creates the two-copy drift issue-sourced planning removed and leaves which copy is hashed unanswerable.

### 2026-07-28 — manual — Reciprocal link from conformance-gate

Mechanical reciprocity fan-out: the conformance-gate page names this record's approval state
as what makes the gate meaningful — unapproved blocks analyze outright.

### 2026-07-28 — #157 — Close may amend a superseded record with one advisory comment

An approved record left standing after implementation refuted one of its decisions was wrong in a way nothing else corrected — the close record states the deviation but is deleted by the drain, and the epic-issue close comment is filed under the epic, not the design. Close's existing close-from-diff pass now marks the subset of deviations that supersede an approved decision and posts exactly one comment on the record sub-issue naming what the record decided, what shipped, and why; nothing marked means no comment, and silence means conformance. The comment is advisory — it gates nothing — and never edits the body, title, labels, or state, so the digest every stage stamps stays valid. Refuted alternative: reopen and revise the record from close — right for a design that changes before implementation, wrong here, since it re-litigates an approved gate after the code has shipped and invalidates the stamped digest. Refuted alternative: one comment per superseding decision — makes the comment count a function of how eventful the implementation was.
