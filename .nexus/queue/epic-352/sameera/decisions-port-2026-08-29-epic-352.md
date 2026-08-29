## 2026-08-29 — The version-control client gets its own runner on the environment record

- **Choice:** `EpicEnvironment` carries `gitFor(root)` beside `runnerFor(root)`, the same runner contract bound to `git` instead of `gh`.
- **Why:** Invariant 2 puts every platform *and version-control* command at the resolved root, and the repository check is the only git call — one more seam is cheaper than teaching the gh runner to dispatch on a sentinel argument.
- **Refuted alternative:** Probe for `.git` on the filesystem instead of running git — rejected because it answers a different question than `rev-parse --is-inside-work-tree` (worktrees, submodules, `$GIT_DIR`).
