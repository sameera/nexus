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
