---
title: "Concept Vocabulary Merge"
aliases: ["one identifier per concept", "synonym merge", "proposed identifier", "concept gloss", "merged vocabulary", "folded-away name"]
touches: ["story-concept-extraction", "plan-draft"]
last_updated_by: "#456"
status: active
verification: verified
---

# Concept Vocabulary Merge

Extraction units run independently, so none can know what another called the same idea. Code settles how an identifier is written, and the planning session — reading every proposed identifier with its one-line gloss and no story text — decides which names are one concept. Code applies that decision, so a concept two stories need carries one identifier in both.

## How It Works

Settling spelling and case in code catches names that differ only in how they are written; it cannot catch a synonym. A missed synonym means one idea is taught twice and nothing notices, so the judgement is put where every list is visible at once. The lists are small, and a gloss lets two names be compared without reading either story.

Every proposed identifier is placed in exactly one group, singletons included, so a deliberate singleton reads differently from a name nobody looked at. The merge combines only: a name no list proposed, a name left out, or a name placed in two groups refuses the write entirely.

The mapping lands on the stubs, not on the checked lists. Each list keeps the name its own unit proposed, and the kept vocabulary leads from a folded-away name to the one now used. Rewriting the lists would invalidate the digest each is kept against, forcing every story to be read again on every merge.

## Key Invariants

1. After the merge, a concept carries one identifier in every list that names it.
2. The merge only combines proposed identifiers; it never invents or splits a concept.
3. Every proposed identifier belongs to exactly one group, singletons included.
4. An identifier is a plain lower-case hyphenated token, and one a reader would take for true, false or null is refused.
5. A checked list keeps the names its own unit proposed; the kept vocabulary leads from a folded-away name to the identifier now used.
6. A concept a merge leaves both introduced and assumed by one story stays introduced.
7. The merge covers every story, handed-off ones included, and runs before any mark removes concepts from a stub.

## Integration Points

- [story-concept-extraction](story-concept-extraction.md) — the independent reads whose proposed names this step reconciles into one vocabulary.
- [plan-draft](plan-draft.md) — where the mapping lands, and which keeps the merged vocabulary beside its slices.

## Decision Log

### 2026-09-11 — #456 — A merge after extraction, judged on glosses and applied by code

Units run independently, so divergent names are certain and normalization in code reaches only spelling and case. The planning session is the one place every list is visible at once, and because the lists are small and each name carries a gloss, two names can be compared without reading either story. Code applies what the session decides and refuses anything that is not a combination, so a merge can never invent or split a concept. The mapping is applied to the stubs rather than written back into the checked lists, because a list is kept against the text it came from and rewriting it would force every story to be read again; the folded-away names are kept instead, which is what joins a handed-off story's list to the identifier a learner slice assumes. Refuted alternative: run the units one after another, each given the vocabulary so far, so it reuses an existing name instead of inventing one. That stops divergence at the source and needs no merge step, but extraction becomes serial, so a large roadmap takes as many times as long as it has stories, and the first story to run names every concept. A unit can still invent a synonym it did not recognize, so a merge would be needed anyway.
