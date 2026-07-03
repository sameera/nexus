---
title: "Gold-plating"
aliases: ["over-generation anti-pattern", "over-generation disease", "speculative generality", "YAGNI violation", "speculative over-geneation]
touches: ["forcing-function-razor", "concept-store", "two-store-split"]
last_updated_by: "manual"
status: active
---

# Gold-plating

Gold-plating is the production of heavy, elaborate artifacts ahead of validated need — volume manufactured on speculation about what might matter rather than distilled from what has been decided. Its cost is not tokens but attention: maximal artifacts at every stage drown the human judgment the process exists to inject. It is the documentation analogue of speculative generality and YAGNI, with the harm landing on review capacity rather than code maintainability.

## How It Works

A stage is given a fixed, maximal output shape and fills it regardless of whether the content is load-bearing, because filling is cheap and the template demands it. Reviewers then face uniform bulk with no salience gradient: the decisions that needed a human are indistinguishable from the boilerplate around them, so judgment defaults to rubber-stamping and unvalidated artifacts accrete as debt.

In Nexus it appears as 16-section HLDs, per-task LLDs, and prose PIRs generated before scope is validated — the original epicenter. It also relocates rather than disappears: moving generation into a curation queue that only grows is the same pattern hidden in the knowledge store. A distiller emitting thousands of pages for a system whose genuine concept inventory is ~10² is over-generating — a curation failure that masquerades as a retrieval-tech gap. The same dynamic recurs at toolkit scale, where skills, hooks, and workflows multiply past justified need.

## Key Invariants

1. Every artifact must be a forcing function for a decision a human must make, or it is cut scaffolding — the forcing-function razor.
2. Artifact shape scales to complexity by explicit rule, not by the model's discretion; smaller work emits a smaller contract.
3. Anything staged for later review expires if unpromoted, so deferred volume cannot quietly become permanent volume.
4. The razor is applied as a named, recurring audit with fixed verdict categories, never a one-time pass.
5. Relocating generation without curbing it does not count as removal; the pattern must be curbed wherever it lands.

## Integration Points

- [forcing-function-razor](forcing-function-razor.md) — the primary test that bounds this pattern; an artifact survives only if it forces a human decision.
- [concept-store](concept-store.md) — the machine surface where over-generation reappears as an unbounded curation queue or distiller bloat.
- [two-store-split](two-store-split.md) — the structural constraint that makes the razor physical by separating judgment artifacts from regenerable volume.

## Decision Log

### 2026-06-20 — manual — Initial concept page

Distilled from [0001](../decisions/0001-refactor-direction.md) (refactor direction) and [0002](../decisions/0002-pipeline-audit.md) (pipeline audit), which name speculative over-generation as Nexus's core weakness and define the forcing-function razor that bounds it stage by stage. The two-store split makes the constraint physical: judgment artifacts live in `docs/`, regenerable volume lives in the concept store, and the two never share an artifact. Considered keeping this as inline prose inside the decision records instead of a standalone page; rejected because the diagnosis is referenced from multiple decisions and prior-art notes and needs one stable named anchor so it cannot drift per-document.

### 2026-06-19 — 0002 §b — Razor-relaxation guardrail

The `decision_log_entry` body cap was relaxed to carry a refuted _viable_ alternative (the anti-relitigation payload). A viability guardrail was added — record an alternative only if a competent engineer might genuinely have chosen it, never a first-glance strawman — specifically so the relaxation does not reopen speculative over-generation.
