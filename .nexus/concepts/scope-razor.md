---
title: "The Scope Razor"
aliases: ["scope razor", "the razor", "counted limits", "necessity question", "scope discipline", "gate conventions", "content rules"]
touches: ["forcing-function-razor", "scope-provenance", "cut-gate", "derived-filing-body", "epic-approval-gate", "decision-record", "pre-epic-discovery", "addition-gate", "draft-ordering-block", "set-closure-check", "razor-enforcement", "citation-check"]
last_updated_by: "#576"
status: active
verification: verified
---

# The Scope Razor

The scope razor is the axis every other planning gate was missing: not how big the work is or whether a criterion can be tested, but whether anyone asked for the scope in the first place. It is one rule set with a single normative home that every drafting stage loads, and where a stage's own wording disagrees with that home, the home governs.

## How It Works

The razor holds five kinds of rule, and three of them carry a page of their own below: a provenance rule labelling every acceptance criterion, assumption, out-of-scope item and story heading; a necessity question, made checkable by a title-keyed block naming what each story waits on; and two gate conventions over one shared gate shape.

The other two are stated here and nowhere else. Counted limits bound how much a draft may hold: three to five acceptance criteria per story, an overage admitted only against one stated reason, and at most five assumptions and five out-of-scope items with no escape at all. Content rules forbid a personas table where the canonical personas already apply, forbid an acceptance criterion that names a mechanism, and forbid any template slot standing ready for a refuted alternative.

## Key Invariants

1. Only a ceiling is ever checked. No rule anywhere requires an item to be generated to satisfy a minimum count, because a floor is a mandate to pad.
2. The acceptance-criteria ceiling admits one stated reason per story; the counted section limits admit none.
3. The necessity answer reaches the filed body; the rest of the razor's bookkeeping does not.
4. The two gates share a shape and no convention; each convention names the set its own plain approval files.

## Integration Points

- [forcing-function-razor](forcing-function-razor.md) — the sibling test: that one asks whether an artifact forces a decision, this one whether its scope was ever asked for.
- [razor-enforcement](razor-enforcement.md) — what keeps this the single normative home: one implementation, a pinning conformance test, and an assertion shipped with its rule.
- [scope-provenance](scope-provenance.md) — the load-bearing rule, and the comparison that makes it checkable rather than asserted.
- [cut-gate](cut-gate.md) — the shape both gates render, and the removal convention the design-record checkpoint keeps.
- [addition-gate](addition-gate.md) — the planning gate's convention, where a plain approval files the smallest usable version and nothing else.
- [draft-ordering-block](draft-ordering-block.md) — the title-keyed graph a drafted epic carries, which this rule set requires and the filing body removes.
- [set-closure-check](set-closure-check.md) — the rule that makes the necessity answer checked rather than asserted, run twice inside the shared checker.
- [derived-filing-body](derived-filing-body.md) — keeps this rule set's drafting-time vocabulary out of every issue body a stage files.
- [epic-approval-gate](epic-approval-gate.md) — the stage whose gate runs the shared checker and whose digest carries the observations.
- [decision-record](decision-record.md) — drafts under the same rules with no gate agent of its own, invoking the shared checker directly.
- [pre-epic-discovery](pre-epic-discovery.md) — labels its document and tickets under the same rules; a resolution is exempt, being a decision made in session.

- [citation-check](citation-check.md) — the evidence rule behind the `asked` value, and where this rule set's word floor is applied.
## Decision Log

### 2026-09-04 — #284 — One normative home, and a checker rather than a prompt

Every gate in the epic stage measured effort or testability, and none asked whether the lead had requested the scope at all, so additions that looked defensible on the page were filed as binding acceptance criteria. The rules are written down once because three restatements diverge and the divergence is undetectable — a gate would check one stage's copy while another stage drafted under its own. The counted limits and the citation comparison live in one checker that four stages invoke, and a conformance test pins its numbers to the normative table so the two fail a build rather than drifting in silence. One stage that adopts the rules has no gate agent at all, which is what settles the question: a check living in a gate's prompt would mean either a second implementation or an unchecked rule elsewhere. Refuted alternative: have the checker read the numbers out of the rule set at run time, which is one literal source of truth — it lost because it makes a prose file load-bearing at run time and couples the toolkit to wherever that file happens to ship.

### 2026-09-13 — #576 — Two conventions over one shape, a checked necessity answer, and a split

The necessity answer was a line of prose nobody verified, so a smallest usable version that could not actually run read the same as one that could. It became a named set whose closure the shared checker walks, which needed a dependency graph inside the draft, keyed on story titles because a story has no issue number yet. The cut-gate section then split, since the two gates share a shape after this change and no longer share a rule: the planning gate offers addition and names the set a plain approval files, while the design-record checkpoint offers removal and states why it has nothing to add to. The provenance vocabulary extended to the story heading, because a label that decides whether a story is filed is a claim the reviewer must be able to reject at the granularity it governs. Deriving a story's provenance from its criteria was considered and refused: it adds no labelling surface and the two levels cannot disagree, but one loosely attached citation would promote a wholly invented story into the set filed by default, and the reviewer would never see the story-level claim as a claim at all. This page was at its own-content capacity, so what makes a restatement fail a build moved out to razor-enforcement: the one normative home, the single implementation, the pinning conformance test, the rule that judgments never block, and the new rule that a rule and its assertion ship in the same story. The counted limits, the content rules and the necessity answer stayed here.
