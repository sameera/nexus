---
title: "Plan Draft"
aliases: ["plan stub", "uncommitted draft", "draft of slices", "stub contract", "assumed concepts", "several slices per story", "draft verdict"]
touches: ["teaching-plan", "story-concept-extraction", "concept-vocabulary-merge", "focus-marking", "plan-rewrite", "prior-knowledge-declaration", "scaffold-slice", "coverage-check", "plan-approval-gate"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Plan Draft

Plan Draft is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

## How It Works

Nothing here asserts the concept any more. The teaching stage left Nexus as its own package,
and its knowledge left with it — one page, one decision log, one place it can be wrong. What
stayed is this stub, because two things still need the name. A reader who greps an old slug
gets an answer instead of silence. And the pages here that name this one keep a live edge: an
edge whose other end is gone is a dead edge, which reads as though the interaction lapsed when
in fact it only moved.

The bullets below are the interactions as they stood when the page left. They are a map to
follow, not a claim about today; the page in the teaching repository is what is current.

## Key Invariants

1. This entry asserts nothing about behaviour; the page in the teaching repository is the one that does.
2. The name keeps resolving here, so a reader who searches the old slug is told where it went.
3. Edges from pages that stayed keep resolving, so no page here carries an edge whose other end is gone.

## Integration Points

- [teaching-plan](teaching-plan.md) — the shipped contract a stub adopts rather than re-deriving, and what this draft becomes at approval.
- [story-concept-extraction](story-concept-extraction.md) — the checked lists this write needs for every story before it writes anything.
- [concept-vocabulary-merge](concept-vocabulary-merge.md) — the mapping applied here, and the vocabulary the draft keeps beside its slices.
- [focus-marking](focus-marking.md) — the mark every stub carries, and why a handed-off one carries nothing besides its story.
- [plan-rewrite](plan-rewrite.md) — the pass that reads this draft and replaces it whole with an ordered one.
- [prior-knowledge-declaration](prior-knowledge-declaration.md) — the removed concepts and quoted phrases this draft keeps for the reviewer.
- [scaffold-slice](scaffold-slice.md) — the slice with no story, which only this draft admits.
- [coverage-check](coverage-check.md) — the verdict this draft carries beside its slices.
- [plan-approval-gate](plan-approval-gate.md) — the checkpoint that prints this draft, refuses it when its coverage is not clean, and turns it into the committed plan.

## Decision Log

### 2026-09-11 — #456 — Stubs stay an uncommitted draft until approval

A stub cannot carry the state its story was pinned to, a branch or a pinning test, because those are set when the plan is approved, and both shipped readers refuse a slice without them. Putting stubs in the committed plan would therefore break every render, drift check and session on that workbook from the end of planning until approval, and it would also make an unapproved plan teachable. The draft is written beside the resolved roadmap, in the derived area that is already excluded from the commit, so one document describes the plan rather than two. The stub adopts the shipped plan's own names for the story, the mark and the introduced concepts, and adds only the concepts a slice assumes, because the shipped field already means introduced here and feeds the drill history. Refuted alternative: write stubs straight into the committed plan and fill the unknown fields with placeholders, which is better for durability — the stubs survive a change of machine and a teammate sees them before approval. It lost because a placeholder pinned state, branch or pinning test is a made-up fact the shipped session would act on, handing the learner a branch name and running a probe against invented text.

### 2026-09-12 — #457 — A story may become several slices, and a slice may have no story

The rule that one story is one slice was enforced in code, so it was replaced rather than relaxed. Without a replacement, nothing tells a legitimate split from a duplicated stub. A split slice carries a plain part number, and a story's parts must run from one with no gap. A scaffold names its concept instead of a story, because it builds nothing on the roadmap. The draft also keeps the declared concepts beside the learner's phrases, the unmatched phrases and the coverage verdict, so the reviewer and the approval gate read them from the plan itself. Once the rewrite has run, the draft no longer keeps the roadmap's arriving order. This entry also records the reciprocal links from plan-rewrite, prior-knowledge-declaration, scaffold-slice and coverage-check. Refuted alternative: keep one slice per story and hold a split as ordered chunks inside it. Every reader keyed on the story keeps working, but a chunk is invisible to ordering, to coverage and to the learner's progress, so the plan would describe its sequence in two places.

### 2026-09-13 — #458 — The draft survives approval, because it holds the judgements a rebuild reuses

Approval was expected to consume the draft. It does not: the draft stays where it is, and beside it now sit three derived records — the concept merge the draft was built from, the reviewer's mark overrides, and a fingerprint of the digest the gate last printed. A mark change at the gate rebuilds the draft from the checked lists under all three rather than asking the learner-word match again, which is what makes changing a mark and changing it back give the same draft. Discarding the draft at approval was refused for that reason: the rebuild would either put removed concepts back silently or ask the learner a question they already answered. None of these records is committed, and the learner's quoted phrases stay in the draft and reach no committed file. This entry also records the reciprocal link from plan-approval-gate.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
