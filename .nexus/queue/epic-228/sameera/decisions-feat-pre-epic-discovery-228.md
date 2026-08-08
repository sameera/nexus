## 2026-08-08 — Discovery store filenames and the unique key's shape

- **Choice:** The discovery doc is `discovery.md`; a ticket is `ticket-<nn>-<ticket-slug>.md`; the folder key is 8 lowercase hex characters.
- **Why:** `discovery.md` is a name no stage scans for, the numbered ticket prefix gives a stable listing order without encoding dependency order, and 8 hex matches the key shape the existing queue entries already use.
- **Refuted alternative:** Name the doc after the slug (`<slug>.md`) so the folder reads self-describing — rejected because every session would have to derive the doc's name from the folder's name before it could read it.
