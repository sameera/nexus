---
title: "Plan Draft"
aliases: ["plan stub", "uncommitted draft", "draft of slices", "stub contract", "assumed concepts", "one story is one slice"]
touches: ["teaching-plan", "story-concept-extraction", "concept-vocabulary-merge", "focus-marking"]
last_updated_by: "#456"
status: active
verification: verified
---

# Plan Draft

A planning pass writes the plan's slices as stubs into an uncommitted draft beside the resolved roadmap, never into the committed workbook. A stub declares its story, whether the learner builds it, and the concepts it introduces and assumes — and nothing else. Approval is what turns the draft into the committed plan.

## How It Works

Both readers of the shipped plan refuse a slice missing the state its story was pinned to, a branch and a pinning test, and refuse a learner slice missing a lesson. A stub has none of those, because approval is where they are set. A stub written into the committed plan would therefore break every render, drift check and session from the end of planning until approval. Filling them with invented values instead was refused: the session would hand a learner a made-up branch and run a probe against text nobody wrote.

The stub uses the shipped plan's own names for the story, the mark and the introduced concepts rather than defining a second contract, and adds one thing beside them: the concepts the slice assumes. The shipped field already means introduced here, so an assumed concept placed in it would read as freshly taught. Anything else offered as a stub field is refused rather than carried.

## Key Invariants

1. Stubs are an uncommitted draft beside the resolved roadmap; nothing is written into the committed workbook or the issue graph.
2. A stub declares its story, its mark and its concepts; anything else offered as a stub field is refused.
3. A stub carries no lesson prose, no pinned story state, no sources, no branch and no pinning test.
4. Introduced concepts use the shipped plan's own field, and the concepts a slice assumes are the one thing a stub adds beside them.
5. No concept is both introduced and assumed by one slice.
6. One story is one slice at this stage, and the draft keeps the roadmap's dependency order.
7. The draft is written only when every story has a checked list, and then as one replacement of the whole file.

## Integration Points

- [teaching-plan](teaching-plan.md) — the shipped contract a stub adopts rather than re-deriving, and what this draft becomes at approval.
- [story-concept-extraction](story-concept-extraction.md) — the checked lists this write needs for every story before it writes anything.
- [concept-vocabulary-merge](concept-vocabulary-merge.md) — the mapping applied here, and the vocabulary the draft keeps beside its slices.
- [focus-marking](focus-marking.md) — the mark every stub carries, and why a handed-off one carries nothing besides its story.

## Decision Log

### 2026-09-11 — #456 — Stubs stay an uncommitted draft until approval

A stub cannot carry the state its story was pinned to, a branch or a pinning test, because those are set when the plan is approved, and both shipped readers refuse a slice without them. Putting stubs in the committed plan would therefore break every render, drift check and session on that workbook from the end of planning until approval, and it would also make an unapproved plan teachable. The draft is written beside the resolved roadmap, in the derived area that is already excluded from the commit, so one document describes the plan rather than two. The stub adopts the shipped plan's own names for the story, the mark and the introduced concepts, and adds only the concepts a slice assumes, because the shipped field already means introduced here and feeds the drill history. Refuted alternative: write stubs straight into the committed plan and fill the unknown fields with placeholders, which is better for durability — the stubs survive a change of machine and a teammate sees them before approval. It lost because a placeholder pinned state, branch or pinning test is a made-up fact the shipped session would act on, handing the learner a branch name and running a probe against invented text.
