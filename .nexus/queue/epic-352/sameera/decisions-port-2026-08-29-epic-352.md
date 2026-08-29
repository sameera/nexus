## 2026-08-29 — The version-control client gets its own runner on the environment record

- **Choice:** `EpicEnvironment` carries `gitFor(root)` beside `runnerFor(root)`, the same runner contract bound to `git` instead of `gh`.
- **Why:** Invariant 2 puts every platform *and version-control* command at the resolved root, and the repository check is the only git call — one more seam is cheaper than teaching the gh runner to dispatch on a sentinel argument.
- **Refuted alternative:** Probe for `.git` on the filesystem instead of running git — rejected because it answers a different question than `rev-parse --is-inside-work-tree` (worktrees, submodules, `$GIT_DIR`).

## 2026-08-29 — The golden corpus is four drafts, recorded through the Python transforms directly

- **Choice:** The corpus is one real epic (#352's own materialization, copied into the test tree), one synthetic draft exercising every transform at once, one with no frontmatter and one with no stories; goldens were recorded by importing `create_epic`'s transform functions rather than by driving the whole filer.
- **Why:** The transforms are the whole derivation and are pure, so importing them records the same bytes the filer would file, without a fake `gh` on PATH or an issue being created to read a body back from.
- **Refuted alternative:** Drive the Python entry point against a fake `gh` and capture the `--body-file` it wrote — closer to the real path, but it records the same function's output through three more moving parts.
