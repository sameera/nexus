---
title: "Removal Gate"
aliases: ["removal convention", "record checkpoint list", "untick to cut", "frozen line", "record-mode checklist"]
touches: ["cut-gate", "decision-record", "scope-razor", "scope-provenance"]
last_updated_by: "#722"
status: active
verification: verified
---

# Removal Gate

At the design-record checkpoint a plain approval files the record as drafted, and a typed number cuts one line. The list holds every refuted alternative and every invariant and risk the model added. So nothing the model added can bind the build without a reviewer seeing it first.

## How It Works

The shared checker builds the list from the labelled draft, and the stage copies it unchanged into a fenced block. A list assembled by hand could drop a model-added line, and nothing would notice. An omission by the checker fails a test. The refuted alternatives come first, under the decision each belongs to. Model-added invariants follow, then model-added risks. Every line arrives ticked, and numbers run as one sequence from 1 in the record's own section order. An invariant or a risk the lead asked for is never listed, because striking the lead's own definition is a revise.

A cut edits the draft before the filing body is derived, and no floor applies. When the record sub-issue is closed, the checker also reads the approved body. It marks each line that body already carries as frozen, by the same normalized containment the citation check uses. A frozen line stays shown and ticked, and its number is refused with the route stated. Approved content changes only by being left out of a revised body. An open record has nothing frozen.

## Key Invariants

1. Every refuted alternative, and every invariant and risk the model added, appears as its own numbered line, and none is omitted.
2. No invariant or risk the lead asked for appears on the list.
3. Every line arrives ticked, the numbers run as one sequence from 1, and one number flips exactly one line.
4. An empty selection files the record as drafted, with no re-render and no second confirmation.
5. A cut lands in the draft before the filing body is derived, and no minimum number of lines must survive.
6. A number naming a line the approved body carries is refused with its reason and route, and the freeze is checked only when the record sub-issue is closed.
7. The checkpoint keeps four exits: approve as drafted, approve with cuts, revise, and proceed with no record.

## Integration Points

- [cut-gate](cut-gate.md) — the shared shape this convention runs over: one numbered list, one typed selection, and the refusal of approved content.
- [decision-record](decision-record.md) — the stage whose pre-filing checkpoint renders this list, and whose approval is what freezes a line.
- [scope-razor](scope-razor.md) — the rule set that states this convention and the provenance labels it reads.
- [scope-provenance](scope-provenance.md) — the labels that decide which invariants and risks are the model's own and so appear on the list.

## Decision Log

### 2026-10-18 — #722 — Split from cut-gate: the record checkpoint lists everything the model added

The design-record stage labelled every invariant and every risk, checked each label's quotation, and then stripped the labels before filing, while its checkpoint listed only the refuted alternatives. So no human ever saw the invariants and risks the model added. The checkpoint now lists all three kinds as one ticked checklist, and a typed number means the same thing as at the planning gate. The shared checker selects, groups and numbers the lines, so an omitted line becomes a test failure instead of a silent gap. This convention moved here from cut-gate, which had reached its word cap, because a task on the record checkpoint does not need the planning gate's rules. Refuted alternative: have the stage render the list by hand from its prompt, as it rendered the alternatives before. That is a much smaller change and needs no checker release, but a hand render cannot be pinned by a test, so a model-added line could still miss the reviewer.
