---
title: "Story Concept Extraction"
aliases: ["per-story extraction", "extraction unit", "checked concept list", "concepts a story introduces", "concepts a story assumes", "no readable list"]
touches: ["concept-vocabulary-merge", "plan-draft", "focus-marking", "coverage-check"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Story Concept Extraction

Story Concept Extraction is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [concept-vocabulary-merge](concept-vocabulary-merge.md) — reads every checked list at once, because no unit can know what another called the same idea.
- [plan-draft](plan-draft.md) — the one write these lists feed, which needs a readable list for every story before it writes anything.
- [focus-marking](focus-marking.md) — the verdict a unit returns from this same single read, which decides its slice's mark.
- [coverage-check](coverage-check.md) — reads a handed-off story's checked list to name that story behind a coverage gap.

## Decision Log

### 2026-09-11 — #456 — One story per unit, and the check is the only way in

A session carrying every story's full text could not plan a roadmap of any size, so each story is read by a unit with its own context and the session keeps only the short list that comes back. That saving is only real if the text does not pass through the session on the way in, which is why a unit is started with a number rather than a prompt built from the story. The code check is what makes "a short structured list" testable, and it is also what stops a story's own words from changing the shape of what reaches the session. An empty list needs the unit to say so outright, because a bare empty return and a silent failure look identical. Refuted alternative: have the toolkit start one headless model run per story and collect the output, which would put concurrency, retries and timeouts in code and make the fan-out repeatable. It lost because the toolkit decides facts and calls no model, so this would give a local command its own model dependency and credentials, outside the session the learner is already in.

### 2026-09-12 — #457 — Reciprocal link from coverage-check

A handed-off stub carries no concepts, so a handed-off story's checked list is the only record of what that story would introduce. The coverage check reads that list to name the story when a learner slice assumes one of its concepts.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
