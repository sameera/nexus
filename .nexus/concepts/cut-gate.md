---
title: "Cut Gate"
aliases: ["approve with cuts", "cut list", "scope reduction at approval", "pre-filing checkpoint", "shared gate shape", "removal convention", "one typed selection"]
touches: ["scope-razor", "scope-provenance", "epic-approval-gate", "decision-record", "addition-gate", "design-warrant"]
last_updated_by: "#576"
status: active
verification: verified
---

# Cut Gate

A gate that shows a reviewer what the model added must also let them act on it in one action, or the labelling is decoration. Two gates share a shape and no implementation: one numbered list, coarse actions beside whatever exits the gate already owes, and a selection typed as a list of numbers. They no longer share a convention. The design-record checkpoint offers removal, and the planning gate offers addition.

## How It Works

Entries are numbered stably and grouped under the story or the decision each belongs to, never rendered as one control per item: five stories easily yield twenty items, and paginating them into batches turns one action into several rounds, which is no longer cheaper than approving as drafted. One typed selection covers every group the list holds. An empty selection is identical to a plain approval, with no re-derivation and no second confirmation. Nothing is applied to content a prior partial run already filed; a number naming such content is refused with its reason stated.

The design-record checkpoint's convention is removal. Its list holds every model-added invariant and risk, and every refuted alternative, and a plain approval files the record as drafted. That gate has nothing to add to. A refuted alternative is the model's own by construction, and an invariant or a risk describes an epic whose scope the planning gate has already settled, so there is no smaller usable record to default to and no remainder to defer.

## Key Invariants

1. A gate that renders the model's additions offers a one-action way to act on them.
2. Nothing is applied to content not yet filed; a number naming already-filed content is refused with its reason, never silently ignored.
3. An empty selection is identical to plain approval.
4. At least one story is always filed; a selection leaving none is a revise, not an approval.
5. A change to the filed story set, in either direction, re-derives the complexity rollup, the design warrant that follows from it, and any banner quoting the earlier sizing.
6. ~~A dependent of a cut story is re-parented onto that story's own blockers rather than left unconstrained.~~
7. An asked-for story is offered on necessity grounds only and is never rendered as an addition.

## Integration Points

- [scope-razor](scope-razor.md) — the rule set that states this shape and both conventions over it.
- [scope-provenance](scope-provenance.md) — the labels the list is built from, which is what makes an addition separable from the lead's own words.
- [epic-approval-gate](epic-approval-gate.md) — renders the list under its digest, under the addition convention rather than this page's removal one.
- [decision-record](decision-record.md) — the one gate still on the removal convention, whose list is the refuted alternatives.
- [addition-gate](addition-gate.md) — the other convention over this same shape, where a plain approval files the smallest usable version.
- [design-warrant](design-warrant.md) — one of the three outputs re-derived whenever the filed story set changes.

## Decision Log

### 2026-09-04 — #284 — Removing scope becomes the cheap action, not the expensive one

Labelling a model's additions changes nothing while the only route to less scope is revise, hand-edit the draft, and re-run — expensive enough that approving as drafted is always cheaper, which is the opposite of what the labelling is for. The list is numbered prose with a typed selection rather than a control per item because the interactive surface cannot hold twenty items at once, and splitting them across rounds costs more than the accepting it was meant to undercut. The design-record stage needed this most and had it least: its approval gate ran after the sub-issue was already filed, so there was no point at which a body could be reduced, and a cut afterwards is either an edit to a published body or a reopen. Refuted alternative: one interactive control per cuttable item, which is unambiguous and needs no parsing — it lost to the pagination it forces.

### 2026-09-13 — #576 — One shared shape, and two conventions that are no longer the same

The planning gate inverted its default, so the convention this page recorded stopped being shared. The shape survives the split intact, because numbered prose, coarse actions, one typed selection, an empty selection reading as plain approval, and the refusal to touch already-filed content are all indifferent to which direction the selection moves scope. What separated is the default: the planning gate now files the smallest usable version and offers the rest, while the design-record checkpoint still files as drafted and offers deletion, because a refuted alternative is not scope and there is nothing at that gate to add to. Re-parenting a dropped story's dependents onto its own blockers is retired rather than kept. Closure is now checked before any edge is edited, so no filed story can wait on a dropped one, and keeping the step would restore the rewrite that made the closure check unable to fire at all.
