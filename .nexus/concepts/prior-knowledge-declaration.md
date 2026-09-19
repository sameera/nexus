---
title: "Prior Knowledge Declaration"
aliases: ["declaration match", "declared concepts", "what the learner already knows", "knowledge slots", "declared phrase", "unmatched phrases", "recorded mapping"]
touches: ["plan-rewrite", "plan-draft", "concept-vocabulary-merge", "coverage-check"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Prior Knowledge Declaration

Prior Knowledge Declaration is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [plan-rewrite](plan-rewrite.md) — the pass sequence this removal opens, before scaffolds and ordering.
- [plan-draft](plan-draft.md) — where the removed concepts, their quoted phrases and the unmatched phrases are kept.
- [concept-vocabulary-merge](concept-vocabulary-merge.md) — the kept identifiers, folded names and glosses a match is made against.
- [coverage-check](coverage-check.md) — counts a declared concept as satisfied wherever a learner slice assumes it.

## Decision Log

### 2026-09-12 — #457 — The session matches the learner's words, and code applies the match

A gloss is a sentence and an interview answer is prose, so a lexical match produces false positives. A false positive deletes teaching the learner needed, and the learner cannot notice a lesson they were never shown. A missed match only teaches something they already knew, which they can notice and skip. So the session judges the match where it already holds every gloss, and code applies it under refusals that make a wrong match visible. Each entry names its slot, because slot eligibility is only checkable when the entry says where the phrase came from. The phrase is kept beside each removed concept, against the record's wording that only identifiers are recorded, because the phrase is what lets the reviewer at approval see a wrong match. The draft is uncommitted, so no learner's words reach a commit. Refuted alternative: match in code by normalizing the answer and scoring it against each identifier and gloss. That is deterministic and needs no judgement, but it trades the error a learner can notice for the one they cannot.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
