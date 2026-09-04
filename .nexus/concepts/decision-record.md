---
title: "Approvable Decision Record"
aliases: ["decision record", "record sub-issue", "record approval", "needs-design gate", "record revision flow"]
touches: ["issue-sourced-planning", "epic-approval-gate", "publishing-config-resolution", "nexus-pipeline", "committed-queue", "distiller", "record-digest", "conformance-gate", "discovery-graduation", "scope-razor", "cut-gate", "derived-filing-body"]
last_updated_by: "#284"
status: active
verification: verified
---

# Approvable Decision Record

An epic's decision record — the architectural why the design stage produces — lives as a sub-issue of the epic issue: one copy, born durable, addressable by the provenance reference form. Approval is closing that sub-issue; the timeline supplies who and when, and Nexus writes no approval field anywhere.

## How It Works

The design-warrant is read from the issue graph, never remembered: a medium-or-larger complexity rollup labels the epic needs-design at filing; a no-design-needed outcome removes the label without filing anything; a hand-filed epic with neither has none. The design stage files the record as pure human prose — no frontmatter, no machine block — and swaps needs-design for in-progress, asserting existence, not approval; a re-run targets the existing sub-issue, never a second. Once approved the record can still be corrected without being edited: when close's diff shows a decision it no longer holds, close posts one advisory comment naming the decision, what shipped, and why — a conformant close posts nothing, and a pre-implementation change instead reopens and revises the record directly. The stage now drafts under the scope razor, labelling every invariant and every risk, and stops at a pre-filing checkpoint of its own — the first point in its life at which the body can be reduced before it becomes durable. A refuted alternative is offered rather than required there: no template carries a standing slot for one, and an alternative whose stated reason names no trade-off is reported to the reviewer as an observation that blocks nothing. What is filed and hashed is derived from the draft the reviewer approved, cuts included, never from the labelled draft itself.

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
- [discovery-graduation](discovery-graduation.md) — writes the marked comment this stage reads as an authoritative input before it analyses.
- [scope-razor](scope-razor.md) — the rule set this stage drafts under, invoking the shared checker directly since it has no gate agent.
- [cut-gate](cut-gate.md) — the convention behind the pre-filing checkpoint, whose cuttable list is the refuted alternatives.
- [derived-filing-body](derived-filing-body.md) — what is filed and hashed, derived after the checkpoint so it matches what was approved.

## Decision Log

### 2026-07-26 — #139 — The decision record becomes an approvable sub-issue

The record had no durable home — it lived in the drain buffer the distiller deletes, or latterly in an ignored scratch path — so its home moved to a sub-issue of the epic issue, with approval the native act of closing it: one copy, born durable, with the approving account and time read from the timeline instead of a Nexus-authored field. The needs-design label makes the design-warrant explicit and revisable, so a simple epic completes the pipeline with no record and no waiver, and a hand-filed epic works with no remembered state. A closed body is frozen because the hash means nothing against a moving target; revision reopens, embeds the superseded body and its hash in a dated comment, and re-closes, since the platform's edit history is not reliably retrievable by tooling. Refuted alternative: keep authoring the record as a committed file and mirror it onto an issue — durable, but it re-creates the two-copy drift issue-sourced planning removed and leaves which copy is hashed unanswerable.

### 2026-07-28 — manual — Reciprocal link from conformance-gate

Mechanical reciprocity fan-out: the conformance-gate page names this record's approval state
as what makes the gate meaningful — unapproved blocks analyze outright.

### 2026-07-28 — #157 — Close may amend a superseded record with one advisory comment

An approved record left standing after implementation refuted one of its decisions was wrong in a way nothing else corrected — the close record states the deviation but is deleted by the drain, and the epic-issue close comment is filed under the epic, not the design. Close's existing close-from-diff pass now marks the subset of deviations that supersede an approved decision and posts exactly one comment on the record sub-issue naming what the record decided, what shipped, and why; nothing marked means no comment, and silence means conformance. The comment is advisory — it gates nothing — and never edits the body, title, labels, or state, so the digest every stage stamps stays valid. Refuted alternative: reopen and revise the record from close — right for a design that changes before implementation, wrong here, since it re-litigates an approved gate after the code has shipped and invalidates the stamped digest. Refuted alternative: one comment per superseding decision — makes the comment count a function of how eventful the implementation was.

### 2026-08-11 — #228 — The design stage reads the discovery gists off the epic issue

An epic promoted from a discovery-filed stub carries the decisions that discovery resolved, in a comment that survived the stub body being rewritten. The design stage now fetches the epic issue's comments before it analyses and keeps only the ones carrying the discovery marker, so the record is designed on top of what was already settled instead of re-deriving it. The gists are an input and never a substitute: the stage still designs the epic itself, and it still checks that every story is covered. A gist that states a decision without its reasoning becomes an open clarification for the human, exactly as an unexplained decision in an imported design document does. An epic with no marked comment behaves as it did before, with no new prompt and no empty section, and the stage never edits or removes the comments it reads. Refuted alternative: route the gists through the existing design-document import, which already extracts decisions, refuted alternatives, and invariants — rejected because import treats its document as the design and replaces the architectural analysis, whereas a gist settles what to build and at what scope, and carries none of the invariants the conformance gate later checks against. Refuted alternative: read every comment on the epic issue and let the architect judge which ones carry decisions — it would also capture decisions recorded outside any command, which is a real gap, but an epic issue accumulates ordinary discussion and feeding all of it degrades the input.


### 2026-09-04 — #284 — A checkpoint before filing, and a refuted alternative that is offered rather than required

The stage had no point at which a body could be reduced: its approval gate ran after the sub-issue was already filed and offered only approve-now or leave-open, so the only ways to remove a decision after drafting were an edit to a published body or a reopen. A pre-filing checkpoint now sits ahead of every path that creates or updates the record, including revision, and the body is derived from what the reviewer approved rather than from the labelled draft — which matters more here than anywhere, since the body is the artifact the record hash is taken over and a surviving label would report a design that did not change as changed. The template's standing refuted-alternative slot was removed rather than re-worded, because a fixed line with permission-to-omit in an adjacent comment is the same shape as a personas heading with a deviations-only rule beside it, and it produces the same outcome: the slot gets filled. Viability is judged by the stage formatting the record rather than the architect who wrote it, since a model asked to judge its own additions answers in its own favour. Refuted alternative: label refuted alternatives with the same two-valued provenance vocabulary the invariants carry — it lost because an alternative is the model's own by construction, so the label would discriminate nothing.
