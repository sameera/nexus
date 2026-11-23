
## 2026-11-23 — Final read-back confirms the filed feature issue is closed
- **Choice:** `check-related` gains `--filed`, which reads the feature issue's state and exits 1 while it is open; `/nxs.epic` passes it only when the run filed the issue.
- **Why:** Mechanism step 8 of record #1061 (D9) names the final read-back as what confirms the close.
- **Refuted alternative:** Revise D9 to name the close step's exit as the confirmation.

## 2026-11-23 — An unrecognised github.features value refuses
- **Choice:** A `github.features` value other than docs, types or labels makes lookup, listings and migration exit 1 as `unknown-mode`, naming the value; `resolveFeatureMode` itself is unchanged.
- **Why:** A typo silently fell back to the docs tree, so a repository meaning types or labels planned from the tree with no sign.
- **Refuted alternative:** Warn and continue on the docs tree.
