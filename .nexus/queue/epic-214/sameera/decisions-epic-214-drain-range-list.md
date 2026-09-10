## 2026-09-08 — Base the branch on epic #213's unmerged work, not on main
- **Choice:** Branched off `main`, then fast-forward merged `epic-213-close-over-merged-prs` (commits `ea2b048`..`d24edb7`) in before writing any #214 code.
- **Why:** Epic #214's decision record (#513) assumes `deriveRangeList`'s `pr`-stamped range list already exists (record #509's revision); that code ships only on epic #213's branch, which is not yet merged to `main`. Implementing #214 against `main` alone would mean building against a range-list shape that doesn't exist yet.
- **Refuted alternative:** Implement #214 assuming #213 lands separately and rebase later — rejected because there is nothing on `main` to build on today, and the merge is a clean fast-forward (no divergence), so deferring it gains nothing.
