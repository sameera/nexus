## 2026-09-18 — Where the dangling-edge check lives

- **Choice:** a per-page check, given the store's page set by the CLI and absent otherwise.
- **Why:** `/nxs.distill` validates the handful of changed pages by path, so a check that only ran
  on the full-store scan would never see the drain that writes a dead edge.
- **Refuted alternative:** put it in the store-level pass beside the capacity triggers, which needs
  no new parameter and breaks no fixture — it loses on missing the one caller that matters.

## 2026-09-18 — The check is off unless a store is supplied

- **Choice:** the store set is a nullable parameter; null skips the check.
- **Why:** a caller validating one page in isolation has no store, and resolving against an empty
  one would condemn every edge on the page.
- **Refuted alternative:** always resolve against the page's own directory, which needs no
  parameter — it loses on the isolated-page case, where the directory holds one file by design.
