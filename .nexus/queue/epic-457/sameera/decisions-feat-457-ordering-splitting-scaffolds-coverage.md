## 2026-09-12 — The rewrite is its own module and its own subverb

- **Choice:** The whole pass lives in `plan-rewrite.ts` behind `nexus workbook rewrite <name>`, which replaces the draft whole rather than editing it.
- **Why:** Record #457 orders six rewrites that all read the same draft, so one module holding the fixed sequence is what makes "nothing iterates" checkable.
- **Refuted alternative:** Fold each rewrite into `concept-extraction.ts` beside the draft write, which would put ordering in the module that holds every story's checked list.

## 2026-09-12 — Ownership is assigned by the traversal, over the arriving order until #556
- **Choice:** #554 walks the slices in the order the roadmap gave them and assigns each concept to the first slice that proposes it; #556 replaces that order with the greedy selection.
- **Why:** Record #457 decision 1 forbids a separate subtraction pass, and the roadmap already arrives in one dependency-respecting order, so the traversal is correct before the selection rule lands.
- **Refuted alternative:** Land #554 as a standalone subtraction over the arriving order, then rewrite it at #556 — two implementations of the same invariant.
