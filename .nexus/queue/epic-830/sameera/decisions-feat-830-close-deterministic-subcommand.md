## 2026-10-04 — A failed record amendment is handed to the lead, not retried by a re-run
- **Choice:** When the amendment post fails, `nexus close` prints the exact amendment text and the record issue to post it on by hand, and no longer says a re-run will post it.
- **Why:** Once the close comment exists a re-run regenerates nothing (G27), so it never had the content to post a missing amendment.
- **Refuted alternative:** Have the re-run path rebuild the content from the verdicts and post the missing amendment, which restores G28 automatically but adds the full verdict reads to every re-run.

## 2026-10-04 — A re-run posts a missing amendment from the stamped verdicts
- **Choice:** Once the close comment exists, a re-run checks the record issue for the amendment key and, only when it is missing, rebuilds the amendment from the verdicts of the pull requests the close comment stamped and posts it; any failed read is a report line, never a stop.
- **Why:** It restores G28 without relying on the lead, and the key check first means a clean re-run reads no verdict.
- **Refuted alternative:** Print the amendment for the lead to post by hand (the earlier choice above), which leaves G28 to a manual step.
