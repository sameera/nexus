---
title: "Prior Knowledge Declaration"
aliases: ["declaration match", "declared concepts", "what the learner already knows", "knowledge slots", "declared phrase", "unmatched phrases", "recorded mapping"]
touches: ["plan-rewrite", "plan-draft", "concept-vocabulary-merge", "coverage-check"]
last_updated_by: "#457"
status: active
verification: verified
---

# Prior Knowledge Declaration

The interview records, in the learner's own words, what they already know. The planning session matches those words to concept identifiers, and code applies the match by removing each matched concept from every slice that would introduce it. The mapping is recorded on the draft, so a later rewrite reuses it instead of judging again.

## How It Works

Matching is the one judgement in the rewrite. The session already reads every identifier with its one-line gloss to merge synonyms, and a match is made against that same gloss. Code refuses a match to an identifier the merged vocabulary does not hold. Code also refuses a phrase that the named slot's recorded answer does not contain word for word. Because every match quotes its phrase, the phrases that matched nothing are exactly the rest, and they are reported when the plan is written.

Only the slots that record prior knowledge are read. What the learner came to learn is focus, not knowledge. What they recently found hard is the slot most likely to name a concept while meaning the opposite of knowing it.

A removed concept leaves what every slice introduces and stays wherever a slice assumes it, because the learner holding it satisfies that assumption. The learner is told nothing. Writing the draft again drops the recorded mapping, and declaring again replaces it whole.

## Key Invariants

1. The session proposes the mapping, and code applies it and refuses an identifier the merged vocabulary does not hold.
2. Only the slots recording prior knowledge feed the match. The answers for what the learner came to learn and what they recently found hard remove no concept.
3. Every match quotes the learner's phrase exactly as the named slot recorded it.
4. Every declared phrase that matched no concept is reported when the plan is written.
5. A removed concept is dropped from what slices introduce and counts as satisfied wherever a slice assumes it.
6. Each removed concept is kept on the uncommitted draft beside its quoted phrase, and nothing is reported to the learner.
7. A rewrite given no new declaration reuses the recorded mapping unchanged.

## Integration Points

- [plan-rewrite](plan-rewrite.md) — the pass sequence this removal opens, before scaffolds and ordering.
- [plan-draft](plan-draft.md) — where the removed concepts, their quoted phrases and the unmatched phrases are kept.
- [concept-vocabulary-merge](concept-vocabulary-merge.md) — the kept identifiers, folded names and glosses a match is made against.
- [coverage-check](coverage-check.md) — counts a declared concept as satisfied wherever a learner slice assumes it.

## Decision Log

### 2026-09-12 — #457 — The session matches the learner's words, and code applies the match

A gloss is a sentence and an interview answer is prose, so a lexical match produces false positives. A false positive deletes teaching the learner needed, and the learner cannot notice a lesson they were never shown. A missed match only teaches something they already knew, which they can notice and skip. So the session judges the match where it already holds every gloss, and code applies it under refusals that make a wrong match visible. Each entry names its slot, because slot eligibility is only checkable when the entry says where the phrase came from. The phrase is kept beside each removed concept, against the record's wording that only identifiers are recorded, because the phrase is what lets the reviewer at approval see a wrong match. The draft is uncommitted, so no learner's words reach a commit. Refuted alternative: match in code by normalizing the answer and scoring it against each identifier and gloss. That is deterministic and needs no judgement, but it trades the error a learner can notice for the one they cannot.
