## 2026-09-22 — the record's ordering key comes from the fetch the path already made

- **Choice:** deleted `prMergedAt` and exposed `mergedAt` on `PrInfo`, so `epic-verdicts record` stamps the timestamp from the repository-qualified `gh pr view` it had already issued.
- **Why:** that one query already asks for `mergedAt` and already names the repository, so the ordering key costs nothing extra and can never be empty on a merged pull request.
- **Refuted alternative:** keep `prMergedAt` and give it `--repo <repo>`. It satisfies invariant 14 and matches its siblings, but leaves a second round trip and the `""`-on-failure fallback that drops a record to the repo/PR-number tiebreak `close-ledger.ts:110` states is not the order.
