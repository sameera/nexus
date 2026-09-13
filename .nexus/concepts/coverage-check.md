---
title: "Coverage Check"
aliases: ["coverage verdict", "coverage gap", "clean verdict", "focus boundary gap", "gap names the handed-off story", "plan with gaps"]
touches: ["plan-rewrite", "plan-draft", "scaffold-slice", "prior-knowledge-declaration", "focus-marking", "story-concept-extraction"]
last_updated_by: "#457"
status: active
verification: verified
---

# Coverage Check

The last pass of the rewrite checks the finished plan and names every gap, not only the first. A gap is a learner slice assuming a concept that no earlier learner slice introduces and the learner did not declare. The plan is written whatever the verdict and carries it, but a plan with any gap does not go to approval.

## How It Works

A gap is a bug in the plan, and the check catches it before any lesson is written. Two readings are deliberately not gaps. A concept no story on the roadmap introduces is background the plan teaches for itself. A concept an earlier learner slice already introduced is covered, whatever order produced that.

When the missing concept is one only a handed-off story would introduce, the gap names that story. Such a gap says the focus boundary is in the wrong place, because a learner slice assumes something the plan decided the learner will not build. A handed-off stub carries no concepts, so the check reads that story's checked list and joins it to the kept identifiers through the names the merge folded away.

Scaffolds already remove most late-introduction gaps. The check still looks for them, so it holds for whatever sequence it is handed. A verdict that is not clean makes the command fail after writing the plan, so the planning session stops in code rather than on instruction.

## Key Invariants

1. The check runs last, over the finished plan, and names every gap.
2. A learner slice assuming a concept that no earlier learner slice introduces, and the learner did not declare, is a gap.
3. A concept no story on the roadmap introduces is not a gap.
4. A gap whose concept only a handed-off story introduces names that story.
5. The plan is written whatever the verdict, and the verdict travels with it.
6. A plan whose verdict is not clean stops the planning pass before approval.
7. The check reads no story text; a handed-off story's concepts come from its checked list.

## Integration Points

- [plan-rewrite](plan-rewrite.md) — the pass sequence this check ends, run over the order it produced.
- [plan-draft](plan-draft.md) — where the verdict is recorded, beside the slices it judges.
- [scaffold-slice](scaffold-slice.md) — removes late-introduction gaps, and never covers a gap this check must report.
- [prior-knowledge-declaration](prior-knowledge-declaration.md) — the declared concepts this check counts as satisfied wherever a slice assumes them.
- [focus-marking](focus-marking.md) — the boundary a gap naming a handed-off story says is drawn in the wrong place.
- [story-concept-extraction](story-concept-extraction.md) — the handed-off story's checked list, the only record of what that story would introduce.

## Decision Log

### 2026-09-12 — #457 — Every gap is named, the plan is still written, and the command fails

A gap is diagnosed by reading the plan, because the reviewer needs to see which slice assumes what and where its introducer went. So the rewritten plan is written with its verdict, and the command then fails so the session stops without relying on its instructions. A gap from a handed-off story is reported rather than scaffolded, because it means the focus boundary is wrong, and a scaffold would teach theory for work the learner is not building. The check keeps looking for concepts no earlier slice introduces, even though scaffolds remove that case whenever dependency edges are supplied, because the check must not depend on the scaffold pass having run. Refuted alternative: write nothing when coverage fails, as the draft write does for incomplete input. That keeps one rule for writes, but here the input is complete and the plan itself is the finding, so discarding the plan discards the evidence.
