## 2026-09-22 — the record's ordering key comes from the fetch the path already made

- **Choice:** deleted `prMergedAt` and exposed `mergedAt` on `PrInfo`, so `epic-verdicts record` stamps the timestamp from the repository-qualified `gh pr view` it had already issued.
- **Why:** that one query already asks for `mergedAt` and already names the repository, so the ordering key costs nothing extra and can never be empty on a merged pull request.
- **Refuted alternative:** keep `prMergedAt` and give it `--repo <repo>`. It satisfies invariant 14 and matches its siblings, but leaves a second round trip and the `""`-on-failure fallback that drops a record to the repo/PR-number tiebreak `close-ledger.ts:110` states is not the order.

## 2026-09-22 — A close worktree opens with no pull requests at all
- **Choice:** `nexus pr-worktree open --mode close` now accepts an absent `--pr`, cutting the distillation branch with an empty range list, rather than rewording the close contract to name an invocation that exists.
- **Why:** the contract's instruction was the correct one — decision record #777 narrows trunk verification to the repository the branch is cut in, and the epic's headline shape is a hub holding the epic issue while every story merged in a member, so the no-PR case is the case the epic exists for.
- **Refuted alternative:** change `nxs.close.md` to always pass at least one pull request; it loses because there is no pull request to pass in that shape, so the close could never write its record.

## 2026-09-22 — The record subverb loses its range override flags
- **Choice:** removed `--range-base` / `--range-head` from `nexus epic-verdicts record` rather than documenting and testing them.
- **Why:** invariant 4 says the range comes from the one merge-anchored derivation, and a caller-supplied range would disagree with the diff the distiller recomputes from it, one stage after the branch was cut. No contract passed them and no test covered them.
- **Refuted alternative:** keep them for a caller that already derived the range in the same run; it loses because no such caller exists and the flags were an untested way to violate the invariant.
