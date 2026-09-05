---
title: "Scope Provenance"
aliases: ["asked versus inferred", "provenance label", "citation check", "source text materialization", "two-valued vocabulary"]
touches: ["scope-razor", "derived-filing-body", "cut-gate"]
last_updated_by: "#284"
status: active
verification: verified
---

# Scope Provenance

Every acceptance criterion, assumption and out-of-scope item in a draft says where it came from: either the lead asked for it, carrying a verbatim fragment quoted from what they actually said, or the drafting model added it. There is no third value. The rule turns a judgment the drafting model is motivated to answer in its own favour into a comparison anyone can check.

## How It Works

Before anything is labelled, the run writes the text it was given — the capability description the lead typed, the stub issue's body, or the discovery document with its resolved tickets — verbatim into one file in session scratch, and every citation in that run is compared against that copy alone. Three things make it a copy rather than a re-read: the gate is a separate reviewer handed only a draft, typed intent has no durable home to fetch again, and a stub edited between drafting and the gate would otherwise be checked against a source the draft was never written from. The comparison is normalized containment — whitespace collapsed, case folded, typographic quotes and dashes mapped to plain forms — and a fragment shorter than four words fails as though absent. The slack is deliberate, since blocking on a curly apostrophe teaches the lead to reword until the gate relents; the word floor is its counterweight, since one common word would otherwise satisfy every item. An item carrying no label at all blocks, because it is the third state the vocabulary denies and the one state no other check can see.

## Key Invariants

1. The vocabulary has exactly two values, and an item carrying neither is a blocking finding.
2. The run's source text is written out once, before any item is labelled, and every citation is compared against that copy alone.
3. The comparison is normalized containment, never a fuzzy or semantic match, so the verdict is reproducible run to run.
4. A quoted fragment shorter than four words fails as if it were absent.
5. The source text is session scratch and may hold anything the lead typed, including a pasted credential, so no part of it is ever posted to an issue, a comment or a report.
6. The check proves the quote exists; whether it licenses the item it is attached to is the reviewer's to judge.

## Integration Points

- [scope-razor](scope-razor.md) — the rule set this is the load-bearing rule of, and the source of the numbers the comparison uses.
- [derived-filing-body](derived-filing-body.md) — strips these labels and asserts none survived, before anything is filed.
- [cut-gate](cut-gate.md) — builds its cut list from these labels, so an addition is deletable in one action.

## Decision Log

### 2026-09-04 — #284 — Two values, checked against a copy of what the lead actually said

A third value such as partly asked would restore exactly the judgment the rule exists to remove: the model would label its own additions with the softest value that survives review. Comparing against a materialized copy rather than the live source is what makes the rule work in the mode that needs it most, since typed intent exists nowhere else, and it stops a stub edited after drafting from being checked as though it were the source the draft came from. The normalization and the word floor are a matched pair — slack in the direction a re-typed quote actually drifts, hard in the direction that would make citing one word satisfy everything. Refuted alternative: a fuzzy or semantic comparison, which would catch the real gaming case of a true quote that does not license the item attached to it — it lost because it reintroduces the judgment the rule removes and makes the verdict irreproducible run to run.
