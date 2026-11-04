## 2026-11-04 — Clean-verdict match allows only emphasis and a closing full stop
- **Choice:** `isCleanVerdict` compares the verdict exactly to "All acceptance criteria achievable, no decision violated" after removing wrapping `*`/`_` emphasis and one trailing full stop.
- **Why:** /nxs.hld's preview prints the clean verdict in italics and the comment copies "the one-line verdict from Phase 4", so a strict byte match would ignore a clean page for formatting alone, while any other word still fails closed (D3).
- **Refuted alternative:** a byte-exact match with no normalisation, which would ignore a clean page posted as `*All acceptance criteria achievable, no decision violated*`.
