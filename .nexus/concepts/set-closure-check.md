---
title: "Story Set Closure"
aliases: ["closure rule", "closure check", "unmet blocker", "usable version check", "apply-time arm", "smallest usable version closure"]
touches: ["scope-razor", "draft-ordering-block", "addition-gate", "epic-approval-gate", "story-as-unit", "razor-enforcement"]
last_updated_by: "#576"
status: active
verification: verified
---

# Story Set Closure

A set of stories that cannot run without a story it excludes is not a usable version. The named smallest usable version, and the set the reviewer actually approves, are each checked for closure under their blockers. One rule runs in two places, both of them inside the shared mechanical checker rather than a gate's prose.

## How It Works

The drafting-time arm reads the necessity answer. A name matching no story blocks, and a story in the set waiting on a story outside it blocks, naming both stories. It runs before the gate renders, so the reviewer is never shown a set that cannot run.

The apply-time arm reads the set the reviewer assembled, before any issue is created and before any edge in the graph is edited. Its position is the whole of it. A gate that first deletes a dropped story's row, or re-parents that story's dependents onto its own blockers, leaves every approved set closed by construction: the edge the rule exists to catch is the edge that was rewritten. The rule then cannot fire in the direction additions move.

A set that fails the apply-time arm returns to the reviewer's choice with the pair the finding named. They take the blocker too, or they drop the addition. Nothing is re-parented on their behalf, because the selection names exactly what joins the filed set, and a set silently re-wired to run is a set nobody approved. No edit has happened at that point, so there is nothing to undo.

A draft carrying no necessity section raises nothing, and the rule adds no minimum-count check.

## Key Invariants

1. One rule has two arms and one implementation, and both arms live in the shared checker rather than in a gate's prose.
2. The drafting-time arm blocks before the gate renders.
3. The apply-time arm reads the graph as the drafter wrote it, before any edge is edited and before any issue is created.
4. A failing apply-time arm returns to the gate's choice; nothing is re-parented and nothing is added on the reviewer's behalf.
5. A finding names both stories: the one in the set, and the excluded one it waits on.
6. A name in a chosen set that matches no story heading blocks.
7. A draft with no necessity section raises no finding, and the rule adds no minimum-count check.

## Integration Points

- [scope-razor](scope-razor.md) — the rule set that states this rule and the shared checker both arms run inside.
- [draft-ordering-block](draft-ordering-block.md) — the graph both arms walk, read as the drafter wrote it.
- [addition-gate](addition-gate.md) — the gate whose assembled set the apply-time arm checks, and which a failure returns to.
- [epic-approval-gate](epic-approval-gate.md) — runs both arms, and files nothing until the second one passes.
- [story-as-unit](story-as-unit.md) — the unit the set is counted in, whose sizes the same apply-time check reads for the rollup.

- [razor-enforcement](razor-enforcement.md) — why both arms live in the shared checker instead of a gate's prompt.
## Decision Log

### 2026-09-13 — #576 — One rule, two arms, and the apply-time arm's position is the whole of it

Making the smallest usable version a checked set rather than a line of prose needed a name match and a walk over a graph, neither of which is a judgment, so the rule belongs where the mechanical rules already are. Implementing it in the planning gate's own agent was considered and refused: it needs no new parsing in a component three stages share and cannot misfire on a draft shape it was not written for, but a gate instruction is something a model can drop, which is the failure this feature's first close recorded. The apply-time arm shipped and could not fire, because the gate re-parented a dropped story's dependents before calling it, which left every approved set closed by construction. The repair moved the call ahead of every edit and removed re-parenting outright rather than reordering it, because once closure blocks no filed story can wait on a dropped one and the step would be unreachable prose a later reader would put back.
