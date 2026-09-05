---
title: "The Scope Razor"
aliases: ["scope razor", "the razor", "provenance rule", "counted limits", "necessity question", "scope discipline"]
touches: ["forcing-function-razor", "scope-provenance", "cut-gate", "derived-filing-body", "epic-approval-gate", "decision-record", "pre-epic-discovery"]
last_updated_by: "#284"
status: active
verification: verified
---

# The Scope Razor

The scope razor is the axis every other planning gate was missing: not how big the work is or whether a criterion can be tested, but whether anyone asked for the scope in the first place. It is one rule set with a single normative home that every drafting stage loads, and where a stage's own wording disagrees with that home, the home governs.

## How It Works

The razor holds four kinds of rule. A provenance rule makes every acceptance criterion, assumption and out-of-scope item say whether the lead asked for it. Counted limits bound how much a draft may hold: three to five acceptance criteria per story, an overage admitted only against one stated reason, and at most five assumptions and five out-of-scope items with no escape at all. Content rules forbid a personas table where the canonical personas already apply, forbid an acceptance criterion that names a mechanism, and forbid any template slot standing ready for a refuted alternative. A necessity question asks which stories the smallest usable version needs. The rules then split by decidability: counts, presence tests and citation comparisons go to one shared checker every stage invokes, and they block. The two judgments — whether a phrase names a mechanism, whether an alternative was genuinely viable — are prevented while the draft is written and surfaced to the reviewer as observations that never block.

## Key Invariants

1. The rule set has one normative home; a stage's restatement is a pointer, and the home governs on conflict.
2. The mechanically decidable rules have exactly one implementation, and a conformance test pins its numbers to the normative statement so the two cannot drift apart without failing a build.
3. Only a ceiling is ever checked. No rule anywhere requires an item to be generated to satisfy a minimum count, because a floor is a mandate to pad.
4. A judgment rule never blocks: it is prevented while drafting and reported to the reviewer as an observation.
5. An observation about an item is produced by a party other than the one that wrote it.
6. The acceptance-criteria ceiling admits one stated reason per story; the counted section limits admit none.
7. The necessity answer reaches the filed body; the rest of the razor's bookkeeping does not.

## Integration Points

- [forcing-function-razor](forcing-function-razor.md) — the sibling test: that one asks whether an artifact forces a decision, this one whether its scope was ever asked for.
- [scope-provenance](scope-provenance.md) — the load-bearing rule, and the comparison that makes it checkable rather than asserted.
- [cut-gate](cut-gate.md) — the convention that lets a reviewer delete what the razor exposed; without it the labelling is decoration.
- [derived-filing-body](derived-filing-body.md) — keeps this rule set's drafting-time vocabulary out of every issue body a stage files.
- [epic-approval-gate](epic-approval-gate.md) — the stage whose gate runs the shared checker and whose digest carries the observations.
- [decision-record](decision-record.md) — drafts under the same rules with no gate agent of its own, invoking the shared checker directly.
- [pre-epic-discovery](pre-epic-discovery.md) — labels its document and tickets under the same rules; a resolution is exempt, being a decision made in session.

## Decision Log

### 2026-09-04 — #284 — One normative home, and a checker rather than a prompt

Every gate in the epic stage measured effort or testability, and none asked whether the lead had requested the scope at all, so additions that looked defensible on the page were filed as binding acceptance criteria. The rules are written down once because three restatements diverge and the divergence is undetectable — a gate would check one stage's copy while another stage drafted under its own. The counted limits and the citation comparison live in one checker that four stages invoke, and a conformance test pins its numbers to the normative table so the two fail a build rather than drifting in silence. One stage that adopts the rules has no gate agent at all, which is what settles the question: a check living in a gate's prompt would mean either a second implementation or an unchecked rule elsewhere. Refuted alternative: have the checker read the numbers out of the rule set at run time, which is one literal source of truth — it lost because it makes a prose file load-bearing at run time and couples the toolkit to wherever that file happens to ship.
