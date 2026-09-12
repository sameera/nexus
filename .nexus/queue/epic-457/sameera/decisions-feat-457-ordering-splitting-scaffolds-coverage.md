## 2026-09-12 — The rewrite is its own module and its own subverb

- **Choice:** The whole pass lives in `plan-rewrite.ts` behind `nexus workbook rewrite <name>`, which replaces the draft whole rather than editing it.
- **Why:** Record #457 orders six rewrites that all read the same draft, so one module holding the fixed sequence is what makes "nothing iterates" checkable.
- **Refuted alternative:** Fold each rewrite into `concept-extraction.ts` beside the draft write, which would put ordering in the module that holds every story's checked list.

## 2026-09-12 — Ownership is assigned by the traversal, over the arriving order until #556
- **Choice:** #554 walks the slices in the order the roadmap gave them and assigns each concept to the first slice that proposes it; #556 replaces that order with the greedy selection.
- **Why:** Record #457 decision 1 forbids a separate subtraction pass, and the roadmap already arrives in one dependency-respecting order, so the traversal is correct before the selection rule lands.
- **Refuted alternative:** Land #554 as a standalone subtraction over the arriving order, then rewrite it at #556 — two implementations of the same invariant.

## 2026-09-12 — A declaration entry names its slot and quotes the answer verbatim
- **Choice:** Each `declared` entry carries `slot`, `phrase` and `concepts`; code refuses an ineligible slot and a phrase the slot's recorded answer does not hold verbatim, and reads an alias as the identifier the merge kept.
- **Why:** Invariant 6 is only enforceable if the entry says which slot it came from, and the verbatim check (record #562) is what makes the unmatched set the exact complement of the mapping.
- **Refuted alternative:** A bare `phrase → concepts` map, leaving slot eligibility to the session's instructions — an instruction nothing checks.

## 2026-09-12 — Declared concepts leave `assumes` alone
- **Choice:** A declared concept is filtered out of every slice's `concepts` and left wherever a slice `assumes` it.
- **Why:** Invariant 5 counts a declared concept satisfied where a later slice assumes it, so #557 needs the assumption still present to count it.
- **Refuted alternative:** Strip it from `assumes` too, which reads cleaner but erases what the coverage check has to reason about.

## 2026-09-12 — Handoffs are placed as early as permitted at #556, and moved late at #560
- **Choice:** #556 orders learner slices alone and re-inserts each handoff as soon as its blockers are placed; #560 replaces that placement with "immediately before the slice it unblocks".
- **Why:** Invariant 11 has to hold the moment ordering lands, and placing a zero-cost slice as early as permitted is precisely the waste story #560 exists to remove — so #560's criteria genuinely fail before it lands.
- **Refuted alternative:** Leave every handoff at the end until #560, which would let a learner slice precede the handoff that blocks it in the meantime.
