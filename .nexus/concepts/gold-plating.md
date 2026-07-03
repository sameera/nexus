---
title: "Gold-plating"
aliases: ["speculative over-generation", "over-generation anti-pattern", "speculative generality", "YAGNI violation"]
touches: ["two-store-split", "forcing-function-razor", "concept-store"]
last_updated_by: "bootstrap"
status: active
verification: unverified
---

# Gold-plating

Gold-plating is the production of heavy, elaborate artifacts ahead of validated need — volume manufactured on speculation about what might matter rather than distilled from what has been decided. Its cost is not tokens but attention: maximal artifacts at every stage drown the human judgment the process exists to inject. It is the documentation analogue of speculative generality and premature optimization, with the harm landing on review capacity rather than code maintainability.

## How It Works

A stage is given a fixed, maximal output shape and fills it regardless of whether the content is load-bearing, because filling is cheap and the template demands it. Reviewers then face uniform bulk with no salience gradient: the decisions that needed a human are indistinguishable from the boilerplate around them, so judgment defaults to rubber-stamping and unvalidated artifacts accrete as debt. In Nexus it first appeared as sixteen-section designs, per-task low-level plans, and prose post-implementation reports generated before scope was validated. It also relocates rather than disappears: moving generation into a curation queue that only grows is the same pattern hidden in the knowledge store, and a distiller emitting thousands of pages for a system whose genuine concept inventory is a few hundred is over-generating just as surely.

## Key Invariants

1. Every artifact must force a human decision, or it is cut scaffolding.
2. Artifact shape scales to complexity by explicit rule, not by the model's discretion.
3. Anything staged for later review expires if unpromoted, so deferred volume cannot become permanent volume.
4. The razor is applied as a named, recurring audit with fixed verdicts, never a one-time pass.
5. Relocating generation without curbing it does not count as removal; the pattern must be curbed wherever it lands.

## Integration Points

- [two-store-split](two-store-split.md) — the structural constraint that walls regenerable volume off from judgment.
- [forcing-function-razor](forcing-function-razor.md) — the primary test that bounds this pattern.
- [concept-store](concept-store.md) — the machine surface where over-generation reappears as an unbounded queue or distiller bloat.

## Decision Log

### 2026-06-20 — bootstrap — Initial concept page

Distilled from 0001 (refactor direction) and 0002 (pipeline audit), which name speculative over-generation as Nexus's core weakness and define the forcing-function razor that bounds it stage by stage. The two-store split makes the constraint physical. The considered alternative — keeping this diagnosis as inline prose inside each decision record — was rejected because it is referenced from many records and prior-art notes and needs one stable named anchor so it cannot drift per document.

### 2026-06-19 — bootstrap — Razor-relaxation guardrail

The Decision Log entry body was relaxed to carry a refuted viable alternative — the anti-relitigation payload. A viability guardrail was added — record an alternative only if a competent engineer might genuinely have chosen it, never a first-glance strawman — specifically so the relaxation does not reopen over-generation.
