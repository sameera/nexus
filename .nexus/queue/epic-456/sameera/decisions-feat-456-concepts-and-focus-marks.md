## 2026-09-11 — The assumed-concept field is named `assumes`
- **Choice:** A stub's new field is `assumes`, a plain identifier list beside the shipped `concepts`.
- **Why:** It reads as the complement of the shipped field's "introduced here" meaning without renaming `concepts`, which record #469 fixed.
- **Refuted alternative:** `assumed_concepts`, matching the plan's snake_case compound keys — longer, and nothing else in a slice qualifies `concepts` with its role.

## 2026-09-11 — The draft is `plan-draft.yml` beside `roadmap.json`, replaced by rename
- **Choice:** The draft materializes at `.nexus/tmp/roadmap-<name>/plan-draft.yml`, validated whole and landed by write-then-rename.
- **Why:** The roadmap's own derived directory is already gitignored and keyed on the roadmap name, and a rename is the one-step replacement invariant 23 asks for.
- **Refuted alternative:** A `plan.yml` under the workbook folder with a draft flag — it would sit in the committed tree, which decision 1 refused.
