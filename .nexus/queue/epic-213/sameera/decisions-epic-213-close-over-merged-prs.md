## 2026-09-08 — Merge-state gating is a separate check, not folded into `checkEpicCurrency`
- **Choice:** Added a new `checkEpicMergeGate` (in `libs/epic-verdicts/src/merge-gate.ts`) that checks
  each story pull request's merge state on its own, run before `checkEpicCurrency` in the close gate,
  rather than adding a merged/unmerged field onto `StoryCurrency`.
- **Why:** Merge state is a hard block with no waiver (per story #500's acceptance criteria), while
  currency is a reported staleness the lead can choose to waive — merging them would either force a
  waiver path onto an unmerged PR (which the acceptance criteria forbid) or drop currency's waiver
  for a case that should keep it.
- **Refuted alternative:** Extending `StoryCurrency`/`checkEpicCurrency` with a `merged` field and one
  combined report.

## 2026-09-08 — `nexus pr-worktree range` takes a comma-separated `--pr` list, not repeated flags
- **Choice:** Extended the existing `range --pr <N>` subcommand to also accept `--pr
  <N1,N2,...>` (`deriveRangeList` in `libs/pr-worktree/src/range-list.ts`), rather than adding a
  repeatable `--pr` flag or a brand-new subcommand for the multi-PR case.
- **Why:** One flag that takes either a bare number or a list keeps the CLI surface and the
  singular JSON output shape byte-identical for every existing caller, while `nxs.close.md`'s
  Phase 4 only ever needs to pass one already-known list of story PR numbers in one shot — a
  repeated flag or a second subcommand would add surface area no caller needs.
- **Refuted alternative:** A repeatable `--pr <N>` flag (argv-order-dependent parsing for no
  benefit here); a separate `range-list` subcommand (splits one read-only derivation across two
  entry points for a single caller).
