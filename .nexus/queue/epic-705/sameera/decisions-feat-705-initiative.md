## 2026-10-10 — The finishing rewrite is a run step, not a new nexus verb
- **Choice:** `/nxs.epic` reads the initiative's body back, replaces each `STUB-<NN>` from the stubs' ledger, and writes it with `gh issue edit`.
- **Why:** The record's mechanism names it "the run's single edit", and the filer's own rewrite pass stays scoped to one batch.
- **Refuted alternative:** A `nexus` capability that performs the rewrite deterministically; it adds a registered verb for one substitution.

## 2026-10-10 — The initiative's number is recorded by the filer's kept ledger
- **Choice:** The initiative batch and the stubs batch both run with `--keep-manifest`; the ledgers in the run folder are the record of what was filed.
- **Why:** A repeat then reuses the filed issues through the filer's existing resume path, with no second bookkeeping file to drift from it.
- **Refuted alternative:** A separate `initiative.json` the command writes by hand after filing.

## 2026-10-10 — An issue marked as an epic stays an epic where the markers share a name
- **Choice:** The kind rule tests the initiative marker last, after epic, story and record.
- **Why:** A repository whose `epic-label` is `initiative` would otherwise have every epic refused as an initiative.
- **Refuted alternative:** Test the initiative marker first, so an issue carrying both markers is refused as an initiative.

## 2026-10-10 — An initiative marked the undeclared way raises no mode mismatch
- **Choice:** Under `types`, a label-only initiative reads as `other`, as it did before the kind existed.
- **Why:** The record says the initiative kind adds no failure for an issue that is not an initiative under the declared marker.
- **Refuted alternative:** Extend `classification-mode-mismatch` to initiatives, which would fail hand-labelled initiatives in a types-mode repository.
