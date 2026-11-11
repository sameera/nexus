## 2026-11-11 — The context trust check delegates to close's trustedComment
- **Choice:** `isTrustedAssociation` stays as the store's one entry point and calls `trustedComment` from `@nexus/epic-verdicts/close-record`.
- **Why:** The store and the lookup keep one call shape while the rule itself lives only in close (record #1016, D5).
- **Refuted alternative:** Import `MAINTAINER_ASSOCIATIONS` and compare locally, which would restate close's comparison a second time.
