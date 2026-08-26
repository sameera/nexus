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

## 2026-08-26 — Where the by-name locator lives, and its from-source fallback

- **Choice:** `libs/workspace/src/gh-toolkit.ts`, exported as `@nexus/workspace/gh-toolkit`.
  Resolution order is PATH first, then the entry point beside these libraries driven on `python3`.
- **Why:** `@nexus/workspace` is the one package both `@nexus/epic-resolve` and `@nexus/pr-worktree`
  already depend on, so a new package would have bought nothing but nx/pnpm wiring. The from-source
  fallback is the same maintainer affordance #247 gave the TypeScript half, and it is resolved from
  the *library's* own location — never from the repository being acted on, which is what #300 AC2
  forbids.
- **Refuted alternative:** a new `@nexus/gh-toolkit-locate` package.

## 2026-08-26 — Fixture repos stop carrying a seeded resolver

- **Choice:** `seedResolver` is deleted from `libs/pr-worktree/src/git-fixtures.ts` and from
  `parity.spec.ts`; the parity harness instead puts `libs/gh-toolkit/bin` on PATH beside the `gh`
  stand-in.
- **Why:** the resolver is no longer read from the repo under test, so seeding one made fixtures
  unlike every real repo after the components stop being committed. A bundle built into a scratch
  directory has no checkout to fall back into, so source and bundle only agree if the toolkit is
  reachable by name for both — which is also how #297 says these ACs are demonstrated before #252.
- **Refuted alternative:** teaching the locator to find a bundle-relative install layout.
