## 2026-10-06 — Compare answer lines through a new `pr-answers --lines` mode
- **Choice:** Add `--lines` (one tab-separated row per answer line: comment link, ID, verb, reason) and diff those rows in the implement script; leave `--urls` unchanged.
- **Why:** An edit keeps the comment's link, so only the answer line content shows an added or changed answer, and a new mode keeps `--urls` callers working.
- **Refuted alternative:** Stop on any comment whose `updatedAt` moved — it would stop a round that edits only other text in a comment holding answers (#884 AC3).

## 2026-10-06 — Leave trust and time out of the compared row
- **Choice:** The row carries link, ID, verb and reason only, not `trusted` or `at`.
- **Why:** `at` is the creation time and never moves on an edit, and a trust change alone posts no answer but would stop the run.
- **Refuted alternative:** Fingerprint the whole `PrAnswer` record.
