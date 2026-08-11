---
title: "Fog Referral Gate"
aliases: ["sharpness gate", "sharpness precondition", "underspecified intent", "oversized versus underspecified", "discovery referral"]
touches: ["pre-epic-discovery", "epic-approval-gate", "backlog-stub"]
last_updated_by: "#228"
status: active
verification: verified
---

# Fog Referral Gate

The epic stage tests whether an intent's functional goals can be stated at all, before it measures how big they are. An intent whose goals cannot be stated is underspecified rather than oversized, and it is referred to discovery instead of being cut into work-shaped stubs. The lead can override the referral, because the sharpness call is a judgement the lead owns.

## How It Works

The test is the stub shape itself. The gate attempts the decomposition the oversized path would perform, and asks whether each functional goal can be stated as a one-line goal, with an estimate of size S or M, and with candidate story titles. If the decomposition cannot produce that shape, the intent is underspecified. The gate then stops before sizing, presents discovery as the recommended path, and files nothing until the lead answers. The override continues to the sizing rubric unchanged. Because the shape it tests is already the output the decomposition step must produce, the gate adds no machinery of its own. It lives inside the right-size phase rather than beside it, which is how it inherits that phase's existing skip rules: it does not fire when a backlog stub is promoted, and it does not fire when a finished discovery is consumed. A promoted stub was already discovered, and a consumed discovery is the output of the very thing this gate refers people to. When every goal is sharp, the gate adds no interaction at all.

## Key Invariants

1. Sharpness is tested before size, because sizing an intent nobody can state is a guess dressed as a measurement.
2. The test is the stub shape itself, so the gate adds no machinery beyond what decomposition already produces.
3. An underspecified intent stops the stage, and nothing is filed before the lead chooses.
4. An override always exists; the sharpness call belongs to the lead, so a false positive stays recoverable.
5. The gate fires on a plain intent only, never on a promoted stub and never on a consumed discovery.
6. A sharp, right-sized intent sees no added interaction, and the oversized decomposition path is unchanged.

## Integration Points

- [pre-epic-discovery](pre-epic-discovery.md) — the stage this gate refers an underspecified intent to.
- [epic-approval-gate](epic-approval-gate.md) — the right-size phase this gate lives inside, and whose skip rules it inherits.
- [backlog-stub](backlog-stub.md) — what oversized but clear scope still becomes, which this gate exists to distinguish fog from.

## Decision Log

### 2026-08-11 — #228 — Underspecified is a different problem from oversized, and it is referred rather than sliced

The right-sizing gate measured size only, so a foggy initiative and a big-but-clear one got the same answer: decompose into stubs with candidate stories. That answer assumes the split is already knowable, and for an underspecified initiative the split itself hangs on unmade decisions, so pre-slicing it is the speculative over-generation Nexus exists to guard against. The gate's test is the stub shape because that shape is already what decomposition must produce, so no new machinery appears. The gate was placed inside the right-size phase so that it inherits the skip rules for a promoted stub and for a consumed discovery, rather than needing its own exemption written by hand. The stop offers an override because every other stop in the epic stage is a strong recommendation with an escape hatch, and a hard refusal would make a false positive unrecoverable: the lead would have to reword the intent until the model relented. Refuted alternative: a standalone phase ahead of sizing — it duplicates the gate scaffolding, it reads as a new pipeline stage that the story explicitly rejects, and it would need its own promotion exemption written by hand. Refuted alternative: a hard refusal with no override, which is how the acceptance criterion could be read literally — rejected on false positives, and nothing is gained by making the referral the only option rather than the recommended one.
