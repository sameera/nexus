---
title: "Scope Provenance"
aliases: ["asked versus inferred", "provenance label", "two-valued vocabulary", "story-level label", "story heading label", "no third value"]
touches: ["scope-razor", "derived-filing-body", "cut-gate", "addition-gate", "citation-check", "razor-enforcement"]
last_updated_by: "#576"
status: active
verification: verified
---

# Scope Provenance

Every acceptance criterion, assumption, out-of-scope item and story heading in a draft says where it came from: either the lead asked for it, carrying a verbatim fragment quoted from what they actually said, or the drafting model added it. There is no third value, at any granularity the rule reaches. The rule turns a judgment the drafting model is motivated to answer in its own favour into a comparison anyone can check.

## How It Works

A third value such as "partly asked" would restore exactly the judgment the rule exists to remove: the model would label its own additions with the softest value that survives review. An item carrying no label at all blocks, because it is the third state the vocabulary denies and the one state no other check can see.

The story heading is the granularity that decides filing. A story's own label settles whether the planning gate files that story by default, so it is a claim the reviewer has to be able to reject rather than a rendering hint. A heading carrying no label reads as model-added, which is never filed by default, and the checker blocks it.

The `asked` value rests on a quoted fragment, and the evidence rule that compares it against what the lead actually said is its own concept.

## Key Invariants

1. The vocabulary has exactly two values at every granularity it reaches, the story heading included, and an item carrying neither is a blocking finding.
2. No third value and no confidence score is added, at any granularity.
3. A story's own label decides whether that story is filed by default.
4. An unlabelled story heading reads as model-added, so it is never filed by default, and the checker blocks it.

## Integration Points

- [scope-razor](scope-razor.md) — the rule set this is the load-bearing rule of.
- [derived-filing-body](derived-filing-body.md) — strips these labels and asserts none survived, before anything is filed.
- [cut-gate](cut-gate.md) — builds its list from these labels, so an addition is actionable in one step.
- [addition-gate](addition-gate.md) — the gate whose default the story-level label decides, and which renders each asked fragment verbatim.
- [citation-check](citation-check.md) — the evidence rule behind the `asked` value, comparing each fragment against a materialized copy of the lead's own words.

- [razor-enforcement](razor-enforcement.md) — what keeps this rule's two values enforced rather than merely stated.
## Decision Log

### 2026-09-04 — #284 — Two values, checked against a copy of what the lead actually said

A third value such as partly asked would restore exactly the judgment the rule exists to remove: the model would label its own additions with the softest value that survives review. Comparing against a materialized copy rather than the live source is what makes the rule work in the mode that needs it most, since typed intent exists nowhere else, and it stops a stub edited after drafting from being checked as though it were the source the draft came from. The normalization and the word floor are a matched pair — slack in the direction a re-typed quote actually drifts, hard in the direction that would make citing one word satisfy everything. Refuted alternative: a fuzzy or semantic comparison, which would catch the real gaming case of a true quote that does not license the item attached to it — it lost because it reintroduces the judgment the rule removes and makes the verdict irreproducible run to run.

### 2026-09-13 — #576 — The label reaches the story heading, because it now decides filing

The planning gate's default became the smallest usable version, so whether a story reads as asked-for or model-added stopped being a rendering hint and became the rule deciding what is filed. A claim that decides filing has to be stated, cited and checked at the granularity it governs, so the two-valued vocabulary extended to the story heading with the citation rule unchanged. Deriving a story's provenance from its acceptance criteria was considered and refused: it adds no labelling surface, leaves the vocabulary untouched, and makes the two levels unable to disagree, but one loosely attached citation on one criterion would promote a wholly invented story into the set filed by default, and the reviewer would never see the story-level claim as something they could reject. This page was at its own-content capacity, so the evidence rule moved out to citation-check: the materialized source copy, the normalized containment comparison, the four-word floor, and the rule that the scratch copy never reaches an issue. The vocabulary, its two values and the granularities that carry it stayed here.
