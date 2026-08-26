## 2026-08-26 — The Python toolkit's name and its home

- **Choice:** `nexus-gh`, an executable entry point at `libs/gh-toolkit/bin/nexus-gh` over a
  package `libs/gh-toolkit/nexus_gh/`, dispatching three capabilities (`config`, `create-epic`,
  `create-story`).
- **Why:** `nexus` is already the TypeScript executable, so a hyphenated sibling reads as the same
  toolkit's other half; `libs/` is where toolkit code lives, and #252 ships the Python files as a
  payload part distinct from the component payload, so `.claude/` was the wrong home for it.
- **Refuted alternative:** keeping the package under `.claude/skills/` — the three modules sit in
  three different skill directories, none of which is an importable package name, and #256 moves
  that whole tree out from under the harness anyway.

## 2026-08-26 — The old script paths are not kept as shims

- **Choice:** the three `.py` files move; no compatibility shim is left at
  `.claude/skills/nxs-gh-*/`.
- **Why:** a shim in `nxs-gh-create-epic/scripts/` could only reach the package through a
  repository-relative hop — the exact addressing #298 exists to delete. Component bodies still
  naming the old paths are #250's job, and #250 is blocked by this epic precisely so the name
  exists first.
- **Refuted alternative:** shims until #250 lands.

## 2026-08-26 — The story sequence leaves the TypeScript suite red between stories 1 and 4

- **Choice:** commits for #297 and #298 leave `libs/epic-resolve` and `libs/pr-worktree` pointing at
  the moved resolver; #300 repairs them.
- **Why:** #300 is the story that replaces those three lookups and is sequenced last (blocked_by
  #297, #298). Repairing them earlier would do #300's work out of order.
- **Refuted alternative:** none — the ordering is the epic's.
