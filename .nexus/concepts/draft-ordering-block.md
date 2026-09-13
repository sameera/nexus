---
title: "Draft-Time Ordering Block"
aliases: ["implementation order block", "ordering block", "title-keyed dependency graph", "draft-time graph", "waits on"]
touches: ["scope-razor", "set-closure-check", "addition-gate", "derived-filing-body", "epic-approval-gate", "story-identity"]
last_updated_by: "#576"
status: active
verification: verified
---

# Draft-Time Ordering Block

A drafted epic carries one block naming what each story waits on, keyed on story titles. The graph has to exist while the reviewer is still deciding, because the question of whether a chosen set can actually run is a question about dependencies. The block is removed when the filing body is derived and is never read again.

## How It Works

The block sits above the story sections and names each story's blockers, or `none`. It is keyed on titles because a title is the only stable name a story has before its issue number exists. A positional key would shift exactly when the story set is re-scoped at the gate, which is the one moment anything relies on it.

It is one epic-level block rather than a line inside each story's section. Each story's section is transcribed verbatim into that story's issue body, so a blockers line would land there as a second and never-updated statement of a graph the tracker's own dependency edges own.

Matching between the block, the necessity answer and the story headings uses the same normalization the citation check uses. A story with no row, a row naming no story, a blocker naming no story, and a cycle are each blocking. A draft that declares no story raises nothing, because the record and discovery stages share the checker and write no stories.

Filing walks the block to assign the sequence and to translate each row's blocker titles into dependency references. After that the tracker's native edges are the only authoritative ordering, and the block is never read again.

## Key Invariants

1. The block is keyed on story titles, never on positions.
2. There is one epic-level block, never a blockers line inside a story's own section.
3. Name matching uses the same normalization the citation check uses, and an unmatched name blocks.
4. A missing row blocks only once the draft declares at least one story.
5. A cycle among the rows blocks.
6. The block is removed when the filing body is derived, and the assertion against surviving drafting-time tokens covers it.
7. The filed sequence is derived from this block; after filing, the tracker's native dependency edges are the only authoritative ordering and the block is never read again.

## Integration Points

- [scope-razor](scope-razor.md) — the rule set that requires this block and states where it is written.
- [set-closure-check](set-closure-check.md) — the rule that walks this graph, at drafting time and again over the approved set.
- [addition-gate](addition-gate.md) — orders both offer groups from this graph and shows each story's blockers beside it.
- [derived-filing-body](derived-filing-body.md) — removes the whole block when it derives the body that is filed.
- [epic-approval-gate](epic-approval-gate.md) — shows each story's blockers in the digest, then walks the block to sequence the filed issues.
- [story-identity](story-identity.md) — the references the walk assigns, which replace these titles once the issues exist.

## Decision Log

### 2026-09-13 — #576 — The dependency graph moves into the draft, keyed on titles

The smallest usable version became a checked set rather than a line of prose, and checking it needs a graph. Assigning the order after approval left the reviewer deciding without one, and left nothing for a checker to read before an issue existed. Titles won over positions because a story set re-scoped at the gate shifts every position, and that re-scoping is the only moment the key matters. A blockers line inside each story's section was considered and refused: it is better at locality, since the drafter and the reviewer see a story's blockers beside it, but each story's section is transcribed verbatim into its issue body, so the line would ship on every story issue as a second statement of a graph the native edges already own, and no existing rule would drop it.
