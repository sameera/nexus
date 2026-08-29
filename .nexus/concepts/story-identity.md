---
title: "Story Identity"
aliases: ["story naming", "story withdrawal", "withdrawn story", "issue-number identity", "one name per story"]
touches: ["issue-sourced-planning", "story-as-unit", "resumable-batch-filing"]
last_updated_by: "#353"
status: active
verification: verified
---

# Story Identity

A filed story is identified by its issue number alone, and nothing else — the pipeline's pre-filing sequence ref never survives filing, so a re-scope that withdraws stories never renames a survivor. A story is withdrawn from the epic's resolved scope, not from the epic itself, by an exact label or a cancelling closure reason; the record sub-issue is never withdrawn either way.

## How It Works

The materialized epic identifies every story by its issue number, in the story heading and in the sequence table's dependency cells alike, so an in-epic and an out-of-epic blocker read the same notation. The pipeline's positional sequence ref lives only inside the pre-filing batch, where no issue numbers exist yet; it names a sibling in the dependency graph and in prose alike, and filing resolves both, so no ref reaches a reader. A story sub-issue is withdrawn from the resolved epic — dropped from the story set and every dependency edge onto it, while staying attached on GitHub as a closed sub-issue — by an exact, case-folded `wontfix`/`invalid` label, or by closure with a reason of not-planned or duplicate, either signal alone sufficing. Closure as completed never withdraws; reopening a withdrawn story restores it to live scope. The record sub-issue is never withdrawn by either signal — its own withdrawal is a state question, decided separately.

## Key Invariants

1. A filed story's only identifier is its issue number; no positional sequence ref appears in a materialized epic.
2. The pre-filing sequence ref is confined to the batch being filed; filing resolves it wherever it appears — dependency graph or prose — so none survives.
3. A re-scope that withdraws stories never renames a surviving story's identifier.
4. A story is withdrawn by an exact, case-folded `wontfix`/`invalid` label, or by closure with a reason of not-planned or duplicate — either alone sufficing.
5. Closure as completed never withdraws; reopening a withdrawn story restores live scope.
6. A withdrawn story is dropped from the resolved story set and every dependency edge onto it, but stays attached to the epic as a closed sub-issue.
7. The record sub-issue is never withdrawn by a label or a closure reason.

## Integration Points

- [issue-sourced-planning](issue-sourced-planning.md) — the resolver that renders this identity and drops a withdrawn story from the materialized epic.
- [story-as-unit](story-as-unit.md) — the terminal planning unit this identity and lifecycle attach to.
- [resumable-batch-filing](resumable-batch-filing.md) — the filing path whose later passes resolve every pre-filing ref, in the dependency graph and in prose alike, into the issue number.

## Decision Log

### 2026-07-28 — #157 — A story's only name is its issue number; withdrawal removes it from scope, not from the epic

A filed story already had a name — its issue number — but the materialized epic also stamped it with a positional sequence ref re-derived from sort order on every resolve: withdraw a story and every survivor after it silently renamed, while the issue number beside it stayed correct. The positional ref now confines to the pre-filing batch, where no issue numbers exist yet to name a blocker by. Separately, a re-scoped epic's cancelled stories stayed attached as closed sub-issues with no way to tell them from delivered ones, so every stage iterating stories checked acceptance criteria for work that would never ship; withdrawal now reads an exact label or a closure reason of not-planned or duplicate, either alone sufficing, since closure alone cannot carry the signal — a delivered story is closed too. Refuted alternative: pin the sequence number at filing to keep it stable — reintroduces durable planning-time state that issue-sourced planning removed. Refuted alternative: detach cancelled stories from the epic — severs the supersession trail to fix a filter that costs a few lines. Refuted alternative: take the closure reason as the only withdrawal signal — a story can be withdrawn while still open, where only the label can say so.

### 2026-07-29 — manual — A prose ref is resolved at filing, not made permanent

The ref that lets a story name a sibling before any issue number exists was resolved only where the dependency graph consumed it; the same ref written into a story's own prose was filed verbatim and orphaned the moment the batch ended, since nothing downstream re-derives it — a filed epic carries exactly that dead text today. Filing now resolves prose refs too, rewriting each to the issue number it named, so the ref's stated confinement to the pre-filing batch holds everywhere rather than only in the graph. Each body is read back from the live issue rather than re-pushed from the authored file, so a human edit made between a failed filing run and its resume is never reverted; only the ref itself changes. A ref naming a story outside the batch fails filing closed instead of resolving to a guess, because the correction belongs in the source the author controls. Refuted alternative: carry an epic-scoped ordinal in every story title so a prose ref stays valid forever — it hands each story a second name, which one name per story exists to prevent; it is less stable than the issue number, since a title is editable and an issue number is not; and it does not resolve as a link, leaving it worse than the reference it replaces. Refuted alternative: leave prose refs for the author to fill in after filing — the numbers arrive as a batch the author never reviews issue by issue, so the dead-ref state stays invisible until a reader hits it.

### 2026-08-29 — #353 — Reciprocal link from resumable-batch-filing

Mechanical reciprocity fan-out: the resumable-batch-filing page names the two passes that carry out this page's rule that no pre-filing ref survives filing — one wiring the dependency edges a ref declared, the other rewriting a ref written in prose to the issue number it named.
