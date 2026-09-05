---
title: "Cut Gate"
aliases: ["approve with cuts", "cut list", "scope reduction at approval", "pre-filing checkpoint"]
touches: ["scope-razor", "scope-provenance", "epic-approval-gate", "decision-record"]
last_updated_by: "#284"
status: active
verification: verified
---

# Cut Gate

A gate that shows a reviewer what the model added must also let them delete it in one action, or the labelling is decoration. The cut gate is that convention: one numbered list of everything cuttable, three coarse actions beside whatever exits the gate already owes, and a selection typed as a list of numbers. Two gates share the convention and neither implements it — what is mechanically decidable already lives in the shared checker, and the rest is prose one stage renders and a selection it parses.

## How It Works

Entries are numbered stably and grouped under the story or the decision each belongs to, never rendered as one control per item: five stories easily yield twenty cuttable items, and paginating them into batches turns one action into several rounds, which is no longer cheaper than approving as drafted. At the epic gate the list holds every item the drafting model added, every story that is wholly its own, and each fully asked-for story the necessity answer leaves outside the smallest usable version. Those excluded asked-for stories sort first and are rendered as asked-for, because cutting one removes something the lead requested and the reviewer has to see that. Naming nothing is identical to plain approval, with no re-derivation and no second confirmation. Removing a whole story re-derives what that story set determined — the complexity rollup, the design-warrant that follows from it, and any banner quoting the pre-cut sizing — and re-parents the story's dependents onto its own blockers, because an under-constrained order breaks work while an over-constrained one merely delays it.

## Key Invariants

1. A gate that renders the model's additions offers a one-action way to delete them.
2. Cuts apply only to content not yet filed; a cut naming already-filed content is refused with its reason, never silently ignored.
3. An empty selection is identical to plain approval.
4. At least one story survives; an all-stories cut is a revise, not an approval.
5. A whole-story cut re-derives the complexity rollup, the design-warrant that follows from it, and any banner quoting the pre-cut sizing.
6. A dependent of a cut story is re-parented onto that story's own blockers rather than left unconstrained.
7. An asked-for story is offered on necessity grounds only and is never rendered as an addition.

## Integration Points

- [scope-razor](scope-razor.md) — the rule set this convention belongs to, and the necessity answer that orders the list.
- [scope-provenance](scope-provenance.md) — the labels the cut list is built from, which is what makes an addition separable from the lead's own words.
- [epic-approval-gate](epic-approval-gate.md) — renders the list under its digest, gaining a third action beside approve and revise.
- [decision-record](decision-record.md) — gained a pre-filing checkpoint of its own, whose cuttable list is the refuted alternatives.

## Decision Log

### 2026-09-04 — #284 — Removing scope becomes the cheap action, not the expensive one

Labelling a model's additions changes nothing while the only route to less scope is revise, hand-edit the draft, and re-run — expensive enough that approving as drafted is always cheaper, which is the opposite of what the labelling is for. The list is numbered prose with a typed selection rather than a control per item because the interactive surface cannot hold twenty items at once, and splitting them across rounds costs more than the accepting it was meant to undercut. The design-record stage needed this most and had it least: its approval gate ran after the sub-issue was already filed, so there was no point at which a body could be reduced, and a cut afterwards is either an edit to a published body or a reopen. Refuted alternative: one interactive control per cuttable item, which is unambiguous and needs no parsing — it lost to the pagination it forces.
