## 2026-09-30 — One query per edge, each paged on its own cursor
- **Choice:** The claiming read sends one GraphQL query per edge (closing links, cross-references) and pages each to its last page on its own cursor, reading the closing edge in full first.
- **Why:** The two connections end on different pages, and reading closing first keeps "the closing edge wins" true however the pages fall.
- **Refuted alternative:** One combined query paging both connections together, which needs per-connection cursor bookkeeping and re-fetches the shorter edge.

## 2026-09-30 — The receipt read targets the pull request's own repository only when asked
- **Choice:** `verifyReceipt` / `readPrVerdict` take an optional `ghRepo`; only the evidence report passes it, with the repository the issue graph says the pull request merged in.
- **Why:** The evidence report reads pull requests from any repository, while `nexus pr-verdict` keeps its existing checkout-relative read untouched (G19).
- **Refuted alternative:** Always pass `--repo` from `expectedRepo`, which changes the existing reader's fetch for every caller.

## 2026-09-30 — Rely on gh's own paging for the receipt read (R1)
- **Choice:** Keep `gh pr view --json reviews,comments`, which follows every page of both connections, and pin with a test that selection over a payload larger than one page picks the newest receipt.
- **Why:** gh already preloads every review and comment page for those fields, so a hand-written paged query would duplicate it.
- **Refuted alternative:** Replace the read with a paged `gh api graphql` query of reviews and comments.

## 2026-09-30 — Fix two failures already on main in the first story commit
- **Choice:** Re-wrap two distill lines a codex spec matches literally, and re-record the distill load ceiling at 53024 bytes.
- **Why:** The suite was red on main before this branch (run-summary rules from 0.79.0 grew distill), and the epic's goal requires a green suite.
- **Refuted alternative:** Trim 136 bytes of distill prose, which edits a stage this epic does not own.

## 2026-09-30 — A receipt naming no story is listed once, not once per claimed story
- **Choice:** The evidence report keeps receipts that name no story in one `coversNone` list keyed by pull request, with one line each.
- **Why:** A pull request claiming several stories would otherwise repeat the same "counts for none" line for each story.
- **Refuted alternative:** Attach a "names no story" line to every story the pull request claims.
