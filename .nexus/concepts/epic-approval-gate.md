---
title: "Epic Approval Gate"
aliases: ["approval digest gate", "epic filing gate", "decision-grade digest", "stub decomposition"]
touches: ["nexus-pipeline", "story-as-unit", "issue-sourced-planning", "publishing-config-resolution"]
last_updated_by: "#121"
status: active
verification: verified
---

# Epic Approval Gate

The epic stage files the epic and its story issues together, gated by a single decision-grade digest the human approves. The digest — not the full epic document — is the read surface at the one checkpoint that matters, and open questions block it.

## How It Works

The epic stage takes a natural-language capability description directly, with no separate brief as a precondition. It produces a right-sized epic and presents a digest: the feature line, the epic prose, the stories as sized one-liners, and the assumptions and out-of-scope boundary. Approval is the single forcing function; open questions are the only pre-filing safeguard and must be resolved first. On approval, the stage files the epic issue and one issue per story, sequences them, and writes the feature navigation index linking to the filed issue. Under issue-sourced planning it commits nothing to the queue at planning — the draft stays in session scratch — files issue-first, and reuses an already-filed epic issue on a re-run rather than creating a second. Scope too large to ship as one epic decomposes into backlog stubs — a slug, functional goal, candidate story-group titles, and complexity — rather than several fully generated epics, which would be over-generation. Each stub is promoted to a full epic later, on demand.

## Key Invariants

1. The epic and its story issues are filed together, gated by one approval.
2. The decision-grade digest, not the full epic document, is the read surface at the gate.
3. Open questions block filing; they are the only pre-filing safeguard.
4. Oversized scope becomes backlog stubs, not multiple fully generated epics.
5. The epic stage takes intent directly; no separate brief is a precondition.
6. Filing commits nothing to the queue at planning: the epic issue is created before its story children, and a re-run reuses an already-filed epic issue rather than creating a second.
7. The epic and its stories resolve their target repository independently; later stages address the epic where it was filed.

## Integration Points

- [nexus-pipeline](nexus-pipeline.md) — the stage of the pipeline where planning is gated and filed.
- [story-as-unit](story-as-unit.md) — the unit the gate files one issue per.
- [issue-sourced-planning](issue-sourced-planning.md) — the source-of-truth model this gate files into: issues, not a committed planning file.
- [publishing-config-resolution](publishing-config-resolution.md) — decides the repository, classification, and project for every issue this gate files.

## Decision Log

### 2026-06-29 — bootstrap — 0010: file epic and stories at one approval digest

Folded story-issue filing into the epic stage behind a single decision-grade digest, replacing a separate decomposition stage and reducing what the human reads at the gate. The considered alternative — keeping a distinct stage to sequence and file stories, or filing one document per story — was rejected: the extra stage was a consumer-less hop, and per-story files fragmented the single epic artifact for no gain the digest does not already deliver.

### 2026-06-28 — bootstrap — 0008: direct intent and stub decomposition

Dropped the feature-brief precondition so the stage takes intent directly, and made oversized scope emit backlog stubs instead of full epics. The considered alternative — generating a full epic per oversized branch up front — was rejected as the multi-epic over-generation the razor forbids; stubs defer the heavy artifact until a branch is actually promoted.

### 2026-07-22 — #114 — Filing commits nothing at planning; issue-first and idempotent

The gate still files the epic and its story issues at one approval, but now commits nothing to the queue at planning — the draft and working notes stay in session scratch, so no planning-time file can drift from the issues that are the source of truth. Filing is issue-first (the epic issue before any story child, the stories created as its children) and idempotent (a re-run reuses an epic issue already filed in the session draft rather than creating a second). I re-verified the page against the shipped stage: it still takes intent directly, gates on the digest, and writes the feature navigation index, so this flips the page from unverified to verified. Refuted alternative: keep committing the epic document at planning as before — one fewer moving part, but it re-creates the committed copy that drifts from the issue humans edit, the exact drift issue-sourced planning removes.

### 2026-07-24 — #121 — Filing targets are resolved per issue kind, not assumed to be the current repo

Where an issue lands became a resolved decision rather than an implicit one, and the epic and the stories resolve it separately. Separate targeting is what expresses the real shape of a multi-repo product — epics are cross-cutting planning artifacts while stories belong beside the code — and it is the only form that handles a repo with no primary code repo of its own, which files its epic into the hub. Resolving the target also fixes a concrete asymmetry: filing honoured a configured target while close ignored it and always acted on the repo it ran in, so an epic filed elsewhere could not be closed. The epic's fallback label became epic-specific in the same pass, made safe by upserting the label before applying it, since the previous generic label neither classified the issue as an epic nor matched what the sibling story path applied. Refuted alternative: one target for both the epic and its stories — simpler to declare and one fewer key, but it cannot express epics in the hub with stories in the code repo, and it strands the no-code-repo case entirely.
