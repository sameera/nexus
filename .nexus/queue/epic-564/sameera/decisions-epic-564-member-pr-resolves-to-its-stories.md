## 2026-09-12 — The pull request's own repository is read from the checkout, not from the target's identity

- **Choice:** `nexus pr-worktree stories` resolves the pull request's `owner/repo` with
  `resolveRepoSlug` against the target checkout, and passes that to the resolver as `prRepo`.
- **Why:** The analyze target already carries a `repoIdentity`, but it is a normalized remote
  (`github.com/acme/widget`) that falls back to a directory basename when a checkout has no
  origin — comparing that against the issues repo would need a heuristic that can answer wrong.
- **Refuted alternative:** Reuse `target.repoIdentity` and suffix-match it against the issues repo.

## 2026-09-12 — The near-miss list is gathered beside the candidates, not recovered from them

- **Choice:** `gather` returns `{ candidates, nearMisses }`; a same-repository body reference that
  claims no scope is recorded as a near miss and printed only by a refusal.
- **Why:** A near miss must never be looked up — that lookup is what stops runs — so it cannot be
  a dropped candidate. Collecting it at the same pass over the body keeps one reading of the text.
- **Refuted alternative:** Keep it a candidate and drop it during validation with a stated reason.
  Refused by the decision record: it performs the lookup this epic exists to avoid.

## 2026-09-12 — Absence is read from the failure's own words, matched narrowly

- **Choice:** `fetchIssueFacts` reads `exists: false` only from a GraphQL failure matching
  "could not resolve to an issue with the number/name"; every other failure stays fatal.
- **Why:** GitHub reports a missing issue as a failed call, so absence can only be drawn from the
  failure itself. A narrow match keeps a rejected credential or a missing *repository* fatal.
- **Refuted alternative:** Treat any failure of that lookup as absence — refused by the record,
  because it would silently shrink a story list.
