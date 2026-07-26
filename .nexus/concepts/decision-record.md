---
title: "Approvable Decision Record"
aliases: ["decision record", "record sub-issue", "record approval", "needs-design gate", "record revision flow"]
touches: ["issue-sourced-planning", "epic-approval-gate", "publishing-config-resolution", "nexus-pipeline", "committed-queue", "distiller", "record-digest"]
last_updated_by: "#139"
status: active
verification: verified
---

# Approvable Decision Record

An epic's decision record — the architectural why the design stage produces — lives as a sub-issue of the epic issue: one copy, born durable, addressable by the provenance reference form. Approval is the native act of closing that sub-issue; the timeline supplies who approved and when, and Nexus writes no approval field anywhere.

## How It Works

The design-warrant is read from the issue graph, never remembered: filing labels the epic needs-design when its complexity rollup is medium or larger; the design stage's no-design-needed outcome removes the label without filing anything; a hand-filed epic with neither is simply an epic without one. The design stage files the record body as pure human prose — no frontmatter or machine block, so nothing churns for a non-design reason — and swaps needs-design for in-progress, asserting the record exists, not that it is approved. A re-run targets the existing sub-issue, never filing a second. A closed record is frozen: a revision reopens it, embeds the superseded body and hash in a dated comment, updates, and re-closes, so every approved state stays reconstructible from the trail. A record closed as not planned is withdrawn, not approved; it blocks like an open one.

## Key Invariants

1. The record lives only as a sub-issue of the epic issue; no record file is written.
2. Approval is the close of the record sub-issue and nothing else; actor and time come from the timeline.
3. A record closed as not planned is withdrawn, not approved.
4. At most one record sub-issue per epic; a second candidate aborts.
5. The design-warrant is answered from the issue graph alone, never remembered state.
6. A closed body is editable only through a reopen; every revision embeds the superseded body and hash.
7. The body is pure human prose.

## Integration Points

- [issue-sourced-planning](issue-sourced-planning.md) — classified out of the story set, surfaced as a recoverable field.
- [epic-approval-gate](epic-approval-gate.md) — applies the needs-design label at filing, from the complexity rollup.
- [publishing-config-resolution](publishing-config-resolution.md) — resolves the record marker and gate labels; classification gets no second reader.
- [nexus-pipeline](nexus-pipeline.md) — the design stage files and revises it; downstream gates block while unapproved.
- [committed-queue](committed-queue.md) — old-contract entries keep a committed record file until they clear.
- [distiller](distiller.md) — the drain sources an entry's why from the record body, hash-verified.
- [record-digest](record-digest.md) — the canonical digest of the approved body.

## Decision Log

### 2026-07-26 — #139 — The decision record becomes an approvable sub-issue

The record had no durable home — it lived in the drain buffer the distiller deletes, or latterly in an ignored scratch path — so its home moved to a sub-issue of the epic issue, with approval the native act of closing it: one copy, born durable, with the approving account and time read from the timeline instead of a Nexus-authored field. The needs-design label makes the design-warrant explicit and revisable, so a simple epic completes the pipeline with no record and no waiver, and a hand-filed epic works with no remembered state. A closed body is frozen because the hash means nothing against a moving target; revision reopens, embeds the superseded body and its hash in a dated comment, and re-closes, since the platform's edit history is not reliably retrievable by tooling. Refuted alternative: keep authoring the record as a committed file and mirror it onto an issue — durable, but it re-creates the two-copy drift issue-sourced planning removed and leaves which copy is hashed unanswerable.
