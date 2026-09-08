## 2026-09-08 — Branch off epic #211's unmerged branch instead of main

- **Choice:** Created `epic-212-aggregated-epic-receipt` at the tip of `epic-211-analyze-member-pr`
  (draft PR #520) rather than off `main`.
- **Why:** Epic #212's decision record (#505) assumes #211's per-story `--pr` analyze machinery
  already exists (`story-candidates.ts`, the repo-scoped verdict trust rules in
  `pr-acceptance/verify.ts`) — #212's own Out of Scope names #211 as the thing that produces the
  per-story verdicts this epic aggregates. #211 is still open and unmerged on `main`, so building
  #212 against `main` would mean re-deriving that machinery a second time. #211's branch forks
  cleanly from `main`'s current tip with no divergence.
- **Refuted alternative:** Reimplement a local copy of the per-PR verdict/trust primitives inside
  #212's own library. Rejected — record #505 explicitly warns against a second copy of the trust
  and recency rules, calling that "the failure the digest helper and the range helper were both
  created to avoid."
