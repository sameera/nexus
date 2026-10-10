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

## 2026-10-10 — The resolver asks "is this an initiative?" through a reading that cannot fail
- **Choice:** The shared kind module gains `readKindMarkers` and `isDeclaredInitiative`; the resolver's refusal and the filer's parent check both call them instead of `classifyIssueKind`.
- **Why:** `classifyIssueKind` can fail with a mode mismatch or an unresolved classification, and the record says the refusal adds no failure for an issue that is not an initiative.
- **Refuted alternative:** Call `resolveKindClassification` and `classifyIssueKind` on every resolve, which would fail a types-mode repository that declares no epic type on stages that resolve it today.

## 2026-10-10 — The parent check runs before a dry run's preview, not only before filing
- **Choice:** `nexus create-story --dry-run` makes the read-only parent read when a stub names a parent.
- **Why:** The old refusal applied to a dry run too, and a rehearsal that previews a batch the real run refuses is misleading.
- **Refuted alternative:** Skip the check on a dry run, so a rehearsal still reaches nothing at all.

## 2026-10-10 — A failed parent link still does not fail the filer's own report
- **Choice:** The filer keeps warning on a failed link and retries it on a repeat; `/nxs.epic` reads the initiative's children back and is what reports the run incomplete.
- **Why:** The record's D9 places the confirmation in the run, and the filer's end-of-run report is a frozen surface.
- **Refuted alternative:** Add a parent-link line to the filer's report and exit non-zero on a failed link, which changes every story batch.

## 2026-10-10 — The kind rule moved with the record classification it resolves through
- **Choice:** `resolveRecordClassification` and its types moved to the settings layer beside the kind rule; `classifySubIssue`, withdrawal and the unplanned-label helpers stayed in the resolver.
- **Why:** The kind rule calls the record resolution, so leaving it behind would keep the circular dependency the move exists to remove.
- **Refuted alternative:** Move only `classifyIssueKind` and pass the record markers in from each caller.

