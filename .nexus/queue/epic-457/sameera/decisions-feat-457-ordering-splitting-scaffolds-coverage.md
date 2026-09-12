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

## 2026-09-12 — A failing coverage verdict is a non-zero exit that still writes the plan
- **Choice:** `nexus workbook rewrite` writes the rewritten draft with its verdict and then exits 1 when the verdict is not clean.
- **Why:** Invariant 33 wants the plan withheld from the gate but the evidence kept; the exit code is what stops the calling phase in code rather than on instruction.
- **Refuted alternative:** Exit 0 and rely on the command's prose to stop the session — an instruction nothing enforces.

## 2026-09-12 — A part is a plain 1-based `part` field, checked as a consecutive run
- **Choice:** `PlanStub.part?: number`, absent on an unsplit slice; `validateDraft` requires a story's group to be exactly 1..n.
- **Why:** Record #562 makes a slice's identity "story plus which part", and the consecutive-run check is what distinguishes a legitimate split from a duplicated stub without a second key.
- **Refuted alternative:** A composite `{ index, of }` object, which states the total on every part and so can disagree with itself.

## 2026-09-12 — Scaffolds are emitted inside the ordering traversal, not inserted afterwards
- **Choice:** `decideScaffolds` runs before ordering and returns story → concepts; `orderLearnerSlices` emits each scaffold at the moment its needing slice is chosen, adding the concept to the owned set.
- **Why:** A scaffold introduces a concept a later slice also proposed; emitting it inside the one traversal is what keeps invariant 2 (one owner per concept) without a second ownership pass.
- **Refuted alternative:** Splice scaffolds into the finished order, then re-run ownership assignment — an extra pass over the same data, and the iteration record #562 forbids.

## 2026-09-12 — The non-handed-off coverage gap stays, exercised through the edge-less rewrite
- **Choice:** `checkCoverage` keeps the "no earlier slice introduces it" gap even though #559's scaffolds now remove that class whenever the roadmap's edges are supplied.
- **Why:** The check is the last pass over the finished plan and must be true of whatever sequence it is handed; it is reachable through `rewritePlan` without edges, which the tests use.
- **Refuted alternative:** Reduce coverage to the handed-off case only, which would make the check silently depend on the scaffolding pass having run.

## 2026-09-12 — Left the pre-existing store-level concepts failure alone
- **Choice:** Did not trim `.nexus/concepts/distiller.md` to clear the 25-bullet revisit advisory.
- **Why:** It fails identically on `origin/main`, and `concept-page-capacity` invariant 4 forbids dropping an interaction for neighbour-list pressure; the trigger is invariant 7's prompt for a human revisit, which is the lead's call.
- **Refuted alternative:** Drop a bullet from distiller.md, or raise `DEGREE_REVISIT_TRIGGER`, to make the suite exit 0.

## 2026-09-12 — M1's fix (analyze-receipt) touches only `teaching-plan.ts`, not `workbook-plan.ts`
- **Choice:** `PlanSlice.story`/`.pinned` became optional and a `scaffold` field was added, with `checkPlanDrift` skipping a storyless slice. `workbook-plan.ts`'s `PlanSliceRecord` (the committed `plan.yml` contract) was left untouched.
- **Why:** Relaxing `PlanSliceRecord` the same way would force `pinned`/`branch`/`pinningTest` optional too, and `teaching-session.ts`/`lesson-writer.ts` read those unconditionally at ~15 sites (`briefFor`, `isFinished`, handoff resolution) — fixing the fallout means deciding what a scaffold's branch/pinning-test/lesson are, which is #559's own notes calling that "a decision the record owes," i.e. #458's scope, not a mechanical type relax.
- **Refuted alternative:** Relax `PlanSliceRecord` too and patch every call site with guards or assertions to keep the compiler green — makes the same design call #458 owns, under cover of "just relaxing a type."
