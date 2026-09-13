---
title: "Plan Draft"
aliases: ["plan stub", "uncommitted draft", "draft of slices", "stub contract", "assumed concepts", "several slices per story", "draft verdict"]
touches: ["teaching-plan", "story-concept-extraction", "concept-vocabulary-merge", "focus-marking", "plan-rewrite", "prior-knowledge-declaration", "scaffold-slice", "coverage-check", "plan-approval-gate"]
last_updated_by: "#458"
status: active
verification: verified
---

# Plan Draft

A planning pass writes the plan's slices as stubs into an uncommitted draft beside the resolved roadmap, never into the committed workbook. A stub declares its story, or the concept a scaffold teaches, whether the learner builds it, and the concepts it introduces and assumes. Approval turns the draft into the committed plan and leaves the draft in place.

## How It Works

Both readers of the shipped plan refuse a slice missing the state its story was pinned to, a branch and a pinning test, and refuse a learner slice missing a lesson. A stub has none of those, because approval is where they are set. A stub written into the committed plan would therefore break every render, drift check and session from the end of planning until approval. Filling them with invented values instead was refused: the session would hand a learner a made-up branch and run a probe against text nobody wrote.

The stub uses the shipped plan's own names for the story, the mark and the introduced concepts rather than defining a second contract. Beside them it adds the concepts the slice assumes, because the shipped field already means introduced and an assumed concept placed in it would read as freshly taught. Anything else offered as a stub field is refused rather than carried.

## Key Invariants

1. Stubs are an uncommitted draft beside the resolved roadmap; nothing is written into the committed workbook or the issue graph.
2. ~~A stub declares its story, its mark and its concepts; anything else offered as a stub field is refused.~~ A stub declares its story or scaffold concept, its mark, its part when split, and its concepts; nothing else.
3. A stub carries no lesson prose, no pinned story state, no sources, no branch and no pinning test.
4. ~~Introduced concepts use the shipped plan's own field, and the concepts a slice assumes are the one thing a stub adds beside them.~~
5. No concept is both introduced and assumed by one slice.
6. ~~One story is one slice at this stage, and the draft keeps the roadmap's dependency order.~~ A story is one slice or consecutive parts from one; a slice with no story is a scaffold.
7. The draft is written only when every story has a checked list, and then as one replacement of the whole file.

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
