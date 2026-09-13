---
title: "Rule Set Enforcement"
aliases: ["normative home", "conformance test", "pinned constants", "one implementation", "judgment never blocks", "rule ships with its assertion"]
touches: ["scope-razor", "scope-provenance", "set-closure-check", "epic-approval-gate", "decision-record", "citation-check", "design-warrant"]
last_updated_by: "#576"
status: active
verification: verified
---

# Rule Set Enforcement

A rule set is the single normative home for its rules only while a build fails when a restatement drifts from it. The scope razor is kept honest by four things: one home, one implementation of the mechanically decidable half, a conformance test pinning the two together, and an assertion that ships in the same story as the rule it pins.

## How It Works

The rules split by decidability. Counts, presence tests, citation comparisons, name matching and the closure walk go to one shared checker every stage invokes, and they block. The two judgments, whether a phrase names a mechanism and whether an alternative was genuinely viable, are prevented while the draft is written and surfaced to the reviewer as observations that never block.

Three restatements would diverge, and the divergence would be undetectable: a gate would check one stage's copy while another stage drafted under its own. The checker's constants are therefore pinned to the normative prose by a conformance test, so the two fail a build rather than drifting in silence.

A rule and the assertion pinning it ship in the same story. Shipping the rule in one story and its assertion in another leaves a window in which the claim is unenforced. A check living in a gate's prompt would mean either a second implementation or an unchecked rule elsewhere, because one stage that adopted the rules has no gate agent at all.

## Key Invariants

1. The rule set has one normative home; a stage's restatement is a pointer, and the home governs on conflict.
2. The mechanically decidable rules have exactly one implementation, and a conformance test pins its numbers to the normative statement so the two cannot drift apart without failing a build.
3. A judgment rule never blocks: it is prevented while drafting and reported to the reviewer as an observation.
4. An observation about an item is produced by a party other than the one that wrote it.
5. A rule and the assertion that pins its wording ship in the same story, so no window exists in which the claim is unenforced.

## Integration Points

- [scope-razor](scope-razor.md) — the rule set this enforces, whose counted limits and content rules supply the pinned constants.
- [scope-provenance](scope-provenance.md) — the load-bearing rule, whose citation comparison is one of the mechanically decidable checks.
- [set-closure-check](set-closure-check.md) — a rule placed in the shared checker rather than a gate's prose for exactly this reason.
- [epic-approval-gate](epic-approval-gate.md) — invokes the shared checker and carries the non-blocking observations into its digest.
- [decision-record](decision-record.md) — the stage with no gate agent of its own, which is what settles where a check must live.

- [citation-check](citation-check.md) — one of the mechanically decidable checks, comparing a fragment against a materialized copy.
- [design-warrant](design-warrant.md) — a rollup rule placed in the shared checker rather than a gate's prose, for the same reason.
## Decision Log

### 2026-09-13 — #576 — Split from the scope razor: how the rules are kept honest

Split from scope-razor, which was at its own-content capacity and was describing two things: what the rules are, and what makes a restatement of them fail a build. The seam holds because each half is loadable alone. A question about how many out-of-scope items a draft may hold never needs the pinning mechanism, and a question about why a check lives in the shared checker rather than a gate's prompt never needs the counts. This epic is what forced the seam: it added a rule that a rule ships with its assertion in the same story, and the rules it added were placed in the shared checker precisely because a gate instruction is something a model can drop. The parent's Decision Log stays whole and is not copied here.
