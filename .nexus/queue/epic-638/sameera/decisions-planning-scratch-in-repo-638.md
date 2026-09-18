## 2026-09-17 — RUN_DIR naming per entry mode

- **Choice:** `RUN_NAME` is the stub issue number in promotion mode, the discovery folder's slug in
  discovery mode, and the feature slug (resolved in Phase 1, before the right-size gate) in intent
  mode — including the decomposition-to-stubs path, which has no epic slug yet.
- **Why:** Decision record #646 states the run folder is named from "the epic slug, or the source
  issue number in promotion and discovery modes," but a decomposition run (Phase 2b) has no epic
  slug and no source issue — the feature slug is the only stable identifier Phase 1 has already
  resolved by the time the folder must exist (before the Phase 2 gate).
- **Refuted alternative:** Defer creating the run folder until Phase 3/4, once an epic slug (or none,
  on the decomposition path) is known. Refuted because decision record #646 requires the folder to
  exist before the right-size gate, specifically so the decomposition path's stub work items land in
  it too (story #642).
