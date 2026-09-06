## 2026-09-05 — Run the range-only derivation in the checkout, not a worktree

- **Choice:** `readRange` resolves the role, looks the PR up, fetches `pull/<N>/head` into the shared object store and runs the existing `deriveRange` with the checkout itself as the derivation cwd.
- **Why:** The derivation reads only the object store, so the checkout and a worktree are interchangeable for it, and the story requires that no worktree is created.
- **Refuted alternative:** Create a throwaway worktree so the close path's cwd shape is reused verbatim — rejected because building and tearing down a checkout for one JSON object is the cost the story exists to remove.

## 2026-09-05 — Give the range read its own module rather than inlining it in the dispatcher

- **Choice:** `libs/pr-worktree/src/range-read.ts` holds `readRange` and the extracted `fetchPrHead`; the CLI's `range` subcommand and its `open --mode close` path both call into it.
- **Why:** The dispatcher is not reachable from a spec with an injected runner, so logic left there cannot be tested against real git topologies; extracting also removes the duplicated best-effort fetch.
- **Refuted alternative:** Inline the three calls in `runPrWorktree` — rejected because the squash-versus-rebase file-set criterion then has no test that exercises it through the new entry point.

## 2026-09-05 — Build the razor's status map from the index and the working tree together

- **Choice:** `gitStatusMap` merges untracked paths (as added), the base-versus-working-tree diff, and the base-versus-index diff, with the index winning.
- **Why:** A page the drain wrote but has not staged is invisible to `git diff`, and a rename is only ever reported as one once both halves are staged; either gap alone would let a forbidden status pass as unchanged.
- **Refuted alternative:** Read only the staged diff, since the drain stages before validating — rejected because the mode is then a silent no-op for anyone running it by hand against an unstaged tree.
