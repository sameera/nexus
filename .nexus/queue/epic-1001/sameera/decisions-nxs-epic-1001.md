## 2026-11-07 — Hub-supplied keys skipped inside the shared add-only writer
- **Choice:** `writeGithubBlock` itself drops any key `readHubDefaults` supplies, so setup's `write-github` and both filers' write-back skip it through one check.
- **Why:** One writer serves both write-back paths; filtering there means no producer can freeze a hub value into a member by bypassing a caller-side check.
- **Refuted alternative:** Filter separately in `writeBackDecisions` and in `runConfigWriteGithub`.

## 2026-11-07 — Test command marked repo-specific on the key catalogue row
- **Choice:** A `repoSpecific` flag on the catalogue's `test-command` row; the hub layer drops every flagged key.
- **Why:** Keeps the catalogue the single schema declaration, so a future repository-specific key is excluded by flagging its row.
- **Refuted alternative:** A hard-coded `testCommand` exclusion inside `hub.ts`.
