---
title: "Issue-Sourced Planning"
aliases: ["issues as source of truth", "epic resolver", "materialized epic", "resolve from issue number", "no-commit planning", "epic-meta round-trip"]
touches: ["nexus-pipeline", "committed-queue", "epic-approval-gate", "distiller", "workspace-resolution"]
last_updated_by: "#114"
status: active
verification: verified
---

# Issue-Sourced Planning

Issue-Sourced Planning makes GitHub issues the single source of truth for epic and story planning: nothing is committed to the queue at planning time, and one deterministic resolver reconstructs the epic from its issue number on demand. The number is the only join key, so any epic filed as issues — even one Nexus never planned — enters the pipeline through the resolver.

## How It Works

At approval the epic stage files the epic issue, then its story sub-issues as children, and commits nothing. The resolver later rebuilds the epic from its issue number, fetching the body, the sub-issues, and their native dependency graph into the existing epic field shape at a path outside version control the working tree never reports as new. Reconstruction is byte-identical on an unchanged issue graph and fail-closed — an unfetchable sub-issue aborts with no output. Frontmatter the issue body cannot carry rides a hidden machine comment the resolver reads back, falling back to recoverable fields alone for a hand-filed epic. Downstream stages resolve the number instead of reading a committed file, validating against live issue state; the committed entry is deferred to close.

## Key Invariants

1. GitHub issues are the single source of truth; nothing is committed at planning time.
2. The issue number is the sole join key; the epic reconstructs from the issue graph alone.
3. One deterministic resolver is the only producer — byte-identical on an unchanged graph, fail-closed on any unfetchable sub-issue.
4. The materialized epic is outside version control; a run leaves the tree reporting no new tracked file.
5. Output reuses the existing epic field shape and reproduces the native dependency graph exactly.
6. Frontmatter round-trips through a hidden machine comment; a hand-filed epic resolves from recoverable fields alone, never fabricated ones.
7. Stages validate against live issue state; no approved-baseline snapshot is pinned.

## Integration Points

- [nexus-pipeline](nexus-pipeline.md) — stages resolve the epic by its issue number, not from a committed file.
- [committed-queue](committed-queue.md) — with nothing committed at planning, its entry is born at close.
- [epic-approval-gate](epic-approval-gate.md) — files the epic and story issues and commits nothing.
- [distiller](distiller.md) — drains the born-at-close entry, taking its why from the close record.
- [workspace-resolution](workspace-resolution.md) — selects the resolver's target: hub issues in a workspace, else the local repo.

## Decision Log

### 2026-07-22 — #114 — Issues become the single source of truth; a resolver reconstructs the epic

Epic and story planning moved entirely onto GitHub issues, and one deterministic resolver reconstructs the epic from its issue number, so the story text, acceptance criteria, and dependency graph live in one place instead of two copies that drift — the issue humans edit and a committed file the gates validated against. The resolver is the sole producer so every stage sees one reconstruction; it is byte-identical on an unchanged graph to stay safe to re-run and diff; and it fails closed so a dropped story never becomes a silently missing design or close obligation. Frontmatter the issue body cannot hold round-trips through a hidden machine comment, because the filing step strips it while downstream parsers still need it. Refuted alternative: keep the committed planning file as the source of truth and treat issues as a derived mirror — fewer commands to touch, but it fights GitHub's grain (the approval gate, dependency wiring, and sub-issue relationships all live issue-side) and any sync step re-introduces the exact two-copy drift being removed.
