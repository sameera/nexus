## 2026-09-05 — Run the range-only derivation in the checkout, not a worktree

- **Choice:** `readRange` resolves the role, looks the PR up, fetches `pull/<N>/head` into the shared object store and runs the existing `deriveRange` with the checkout itself as the derivation cwd.
- **Why:** The derivation reads only the object store, so the checkout and a worktree are interchangeable for it, and the story requires that no worktree is created.
- **Refuted alternative:** Create a throwaway worktree so the close path's cwd shape is reused verbatim — rejected because building and tearing down a checkout for one JSON object is the cost the story exists to remove.

## 2026-09-05 — Give the range read its own module rather than inlining it in the dispatcher

- **Choice:** `libs/pr-worktree/src/range-read.ts` holds `readRange` and the extracted `fetchPrHead`; the CLI's `range` subcommand and its `open --mode close` path both call into it.
- **Why:** The dispatcher is not reachable from a spec with an injected runner, so logic left there cannot be tested against real git topologies; extracting also removes the duplicated best-effort fetch.
- **Refuted alternative:** Inline the three calls in `runPrWorktree` — rejected because the squash-versus-rebase file-set criterion then has no test that exercises it through the new entry point.
