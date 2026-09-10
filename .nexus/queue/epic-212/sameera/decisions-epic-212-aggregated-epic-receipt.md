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

## 2026-09-08 — Carry every surviving verdict into the combined change set, not just the newest per story

- **Choice:** `resolveStoryVerdict` now returns `survivors: StoryVerdict[]` — every open-or-merged
  candidate that passed the trust checks — alongside the single newest `verdict` it already
  returned. `resolveEpicVerdicts` sums these into a new `changeSetVerdicts` field, kept separate
  from `verdicts` (the one-per-story set the receipt and currency check still use). The CLI's
  `epic-verdicts combined` subverb now diffs `changeSetVerdicts` instead of `verdicts`.
- **Why:** invariant 3 (record #505) requires the combined change set to be the union of every
  open-or-merged trusted verdict, including one superseded by a later verdict for the same story
  after its code already shipped (e.g. a story reopened and fixed by a follow-up PR, both merged).
  The one-verdict-per-story set the receipt uses is the wrong input for that: it discards a merged
  PR's diff the moment a newer verdict supersedes it. Story #496's own AC3 ("only the newest
  verdict ... is used") is about the receipt, not the combined set, so `verdicts` keeps that
  behaviour unchanged.
- **Refuted alternative:** Have `combinedChangeSet` re-derive survivors itself by re-querying `gh`.
  Rejected — `resolveStoryVerdict` already does that collection/trust work once; a second query
  path would duplicate the trust and recency rules record #495/#505 centralized here.
