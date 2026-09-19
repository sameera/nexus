---
title: "Concept Vocabulary Merge"
aliases: ["one identifier per concept", "synonym merge", "proposed identifier", "concept gloss", "merged vocabulary", "folded-away name"]
touches: ["story-concept-extraction", "plan-draft", "prior-knowledge-declaration"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Concept Vocabulary Merge

Concept Vocabulary Merge is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [story-concept-extraction](story-concept-extraction.md) — the independent reads whose proposed names this step reconciles into one vocabulary.
- [plan-draft](plan-draft.md) — where the mapping lands, and which keeps the merged vocabulary beside its slices.
- [prior-knowledge-declaration](prior-knowledge-declaration.md) — matches the learner's words against these glosses, and reads a folded name as the identifier kept.

## Decision Log

### 2026-09-11 — #456 — A merge after extraction, judged on glosses and applied by code

Units run independently, so divergent names are certain and normalization in code reaches only spelling and case. The planning session is the one place every list is visible at once, and because the lists are small and each name carries a gloss, two names can be compared without reading either story. Code applies what the session decides and refuses anything that is not a combination, so a merge can never invent or split a concept. The mapping is applied to the stubs rather than written back into the checked lists, because a list is kept against the text it came from and rewriting it would force every story to be read again; the folded-away names are kept instead, which is what joins a handed-off story's list to the identifier a learner slice assumes. Refuted alternative: run the units one after another, each given the vocabulary so far, so it reuses an existing name instead of inventing one. That stops divergence at the source and needs no merge step, but extraction becomes serial, so a large roadmap takes as many times as long as it has stories, and the first story to run names every concept. A unit can still invent a synonym it did not recognize, so a merge would be needed anyway.

### 2026-09-12 — #457 — Reciprocal link from prior-knowledge-declaration

The merged vocabulary now has a second reader. The declaration match is made against these glosses, and a match naming a folded-away name is read as the identifier the merge kept.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
