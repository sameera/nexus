---
title: "Issue-Sourced Planning"
aliases: ["issues as source of truth", "epic resolver", "materialized epic", "resolve from issue number", "no-commit planning", "epic-meta round-trip"]
touches: ["nexus-pipeline", "committed-queue", "epic-approval-gate", "distiller", "workspace-resolution", "decision-record", "story-identity", "backlog-stub"]
last_updated_by: "manual"
status: active
verification: verified
---

# Issue-Sourced Planning

Issue-Sourced Planning makes GitHub issues the single source of truth for epic and story planning: nothing is committed at planning, and one deterministic resolver reconstructs the epic from its issue number. The number is the only join key, so any epic filed as issues enters the pipeline through the resolver.

## How It Works

At approval the epic stage files the epic issue and its story sub-issues as children, committing nothing. The resolver later rebuilds the epic from its issue number, fetching the body, sub-issues, and native dependency graph into the existing epic field shape, outside version control. Reconstruction is byte-identical on an unchanged issue graph and fail-closed — an unfetchable sub-issue aborts with no output. A sub-issue carrying the configured record marker — from the shared publishing resolver, matched case-insensitively — is the decision record: kept out of the story set, surfaced as a recoverable field; a second candidate aborts. Frontmatter the issue body cannot carry rides a hidden machine comment the resolver reads back, falling back to recoverable fields alone for a hand-filed epic. Downstream stages resolve the number instead of reading a committed file; the entry is deferred to close.

## Key Invariants

1. GitHub issues are the single source of truth; nothing is committed at planning time.
2. The issue number is the sole join key; the epic reconstructs from the issue graph alone.
3. One deterministic resolver is the only producer — byte-identical on an unchanged graph, fail-closed on any unfetchable sub-issue.
4. The materialized epic is outside version control; a run reports no new tracked file.
5. Output reuses the existing epic field shape and reproduces the native dependency graph exactly; the record is its own field, never a story.
6. Frontmatter round-trips through a hidden machine comment; a hand-filed epic resolves from recoverable fields alone.
7. Stages validate against live issue state; no baseline snapshot is pinned.

## Integration Points

- [nexus-pipeline](nexus-pipeline.md) — stages resolve the epic by number, not committed file.
- [committed-queue](committed-queue.md) — its entry is born at close.
- [epic-approval-gate](epic-approval-gate.md) — files the epic and story issues and commits nothing.
- [distiller](distiller.md) — drains the born-at-close entry.
- [workspace-resolution](workspace-resolution.md) — selects the resolver's target: hub issues, else the local repo.
- [decision-record](decision-record.md) — the record sub-issue classified record-positively and reported beside the stories.
- [story-identity](story-identity.md) — the per-story naming and withdrawal rules this resolver renders.
- [backlog-stub](backlog-stub.md) — the unplanned epic this resolver refuses by name, rather than emitting one whose story set is empty.

## Decision Log

### 2026-07-22 — #114 — Issues become the single source of truth; a resolver reconstructs the epic

Epic and story planning moved entirely onto GitHub issues, and one deterministic resolver reconstructs the epic from its issue number, so the story text, acceptance criteria, and dependency graph live in one place instead of two copies that drift — the issue humans edit and a committed file the gates validated against. The resolver is the sole producer so every stage sees one reconstruction; it is byte-identical on an unchanged graph to stay safe to re-run and diff; and it fails closed so a dropped story never becomes a silently missing design or close obligation. Frontmatter the issue body cannot hold round-trips through a hidden machine comment, because the filing step strips it while downstream parsers still need it. Refuted alternative: keep the committed planning file as the source of truth and treat issues as a derived mirror — fewer commands to touch, but it fights GitHub's grain (the approval gate, dependency wiring, and sub-issue relationships all live issue-side) and any sync step re-introduces the exact two-copy drift being removed.

### 2026-07-26 — #139 — The record sub-issue is classified out of the story set

Filing the decision record as a sub-issue of the epic made the sub-issue set heterogeneous, so classification became a resolver obligation: a sub-issue is the record only when it carries the configured record marker — record-positive, so an epic with no record (or a hand-filed one) resolves byte-identically to before. The marker comes only from the shared publishing resolver, never a second config reader, so the reading side cannot disagree with what the filing side applied; label names match case-insensitively because the platform treats them as case-insensitively unique and preserves stored casing, so an exact match would silently classify the record as a story — the precise corruption this exists to prevent. More than one record candidate aborts fail-closed: at most one record per epic is an identity conformance, close, and the drain all depend on. Refuted alternative: a title-prefix or body-marker heuristic — zero configuration, but it disagrees with what the filing side actually applied the moment a repository switches classification mode.

### 2026-07-28 — manual — Reciprocal link from story-identity

Mechanical reciprocity fan-out: the story-identity page names this resolver as what renders a
story's issue-number identity and drops a withdrawn one from the materialized epic.

### 2026-08-06 — manual — Reciprocal link from backlog-stub

Mechanical reciprocity fan-out: the backlog-stub page names this resolver's refusal — an epic carrying the unplanned label is rejected by name rather than reconstructed into an epic that plans nothing. Declared by hand because both epics involved had already drained; the edge was dropped at distillation only because a reciprocal bullet did not fit under the pre-#220 body cap.
