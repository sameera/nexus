## 2026-10-04 — A failed record amendment is handed to the lead, not retried by a re-run
- **Choice:** When the amendment post fails, `nexus close` prints the exact amendment text and the record issue to post it on by hand, and no longer says a re-run will post it.
- **Why:** Once the close comment exists a re-run regenerates nothing (G27), so it never had the content to post a missing amendment.
- **Refuted alternative:** Have the re-run path rebuild the content from the verdicts and post the missing amendment, which restores G28 automatically but adds the full verdict reads to every re-run.
