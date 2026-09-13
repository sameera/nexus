---
title: "Addition Gate"
aliases: ["addition default", "opt-in scope", "offer list", "plain approval files the smallest usable version", "additions not cuts", "smallest usable version default"]
touches: ["cut-gate", "scope-razor", "scope-provenance", "epic-approval-gate", "draft-ordering-block", "set-closure-check", "backlog-stub", "design-warrant"]
last_updated_by: "#576"
status: active
verification: verified
---

# Addition Gate

At the planning gate a plain approval files the smallest usable version and nothing else. Every other story is offered, and reaches an issue only when the reviewer types its number. Scope nobody asked for now takes an act of will to acquire, rather than an act of vigilance to avoid.

## How It Works

The gate renders three sections. The first names the set a plain approval files, unnumbered, because a number against it would name an action the selection cannot perform. Below it sit two acted-on groups sharing one stably numbered list, and one typed selection covers both. A number under *Additions* adds that story. A number under *Removals* deletes a model-added acceptance criterion, assumption or out-of-scope item from a story already being filed.

The offer list holds every story the smallest usable version excludes. The stories the lead asked for sort first, each carrying its quoted fragment verbatim, so the reviewer can reject a claim about their own words where they are already deciding. Within each group the order follows the dependency graph, never a ranking by predicted value, because ranking would have the drafting model score its own additions.

Only stories are opt-in. A model-added criterion on a filed story stays opt-out, because a criterion cannot stand alone and an asked-for story filed with no criteria at all would be unverifiable.

What the reviewer leaves is treated by where it came from. An asked-for story defers as one unplanned epic issue. A model-added story is discarded, because regenerating it later costs less than carrying an open item somebody must answer for.

## Key Invariants

1. A plain approval files the smallest usable version and nothing else.
2. Only a story is opt-in; a model-added item on a filed story stays opt-out.
3. Additions and removals share one stably numbered list and one typed selection; the filed set carries no numbers.
4. An asked-for story sorts before every model-added one and is rendered as asked-for, carrying its cited fragment verbatim.
5. Order within a group follows the dependency graph and never a ranking by predicted value.
6. Asked-for scope the reviewer does not take defers; model-added scope the reviewer does not take is discarded and leaves no trace.
7. At least one story is always filed; a selection that would file none is a revise, not an approval.

## Integration Points

- [cut-gate](cut-gate.md) — the shape both gates share, and the removal convention this one departs from.
- [scope-razor](scope-razor.md) — the rule set that states this convention, and governs where a stage's wording disagrees with it.
- [scope-provenance](scope-provenance.md) — the story-level label that decides which side of the default a story falls on.
- [epic-approval-gate](epic-approval-gate.md) — the gate that renders this list and files the set the reviewer assembled.
- [draft-ordering-block](draft-ordering-block.md) — supplies the order each group is listed in and the blockers shown beside each offer.
- [set-closure-check](set-closure-check.md) — blocks an assembled set that waits on a story the reviewer did not take.
- [backlog-stub](backlog-stub.md) — where asked-for scope the reviewer declined goes, as one unplanned epic issue.

- [design-warrant](design-warrant.md) — re-derived whenever this gate's filed set differs from the drafted one.
## Decision Log

### 2026-09-13 — #576 — A plain approval files the smallest usable version, and nothing else

Removing scope was already cheap, but accepting it was cheaper still: approving cost one keystroke while cutting cost reading a numbered list and typing a selection. A reviewer who is tired or merely trusting therefore shipped scope nobody asked for, because the default decided the outcome and the default was maximal. Filing every asked-for story by default was considered and rejected: it honours the request as literally written and never surprises a lead whose scope did not arrive, but it leaves the deferral producer firing only when a reviewer actively declines something, which is the same act of vigilance under a new name. The inversion stops at the story because a story is a unit of scope that can stand alone, while a criterion is a statement about scope already being filed; inverting criteria too would let an asked-for story file with none, and the razor admits no minimum-count rule to patch that. Declined model-added scope is discarded rather than banked, so a rejected suggestion costs nobody a later triage.
