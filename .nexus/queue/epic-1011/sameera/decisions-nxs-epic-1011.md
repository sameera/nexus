## 2026-11-11 — Context-block markers and locate rule live in delivery-config
- **Choice:** `@nexus/delivery-config/context-block` holds the markers and the one rule that finds the block; the story filer's ref rewrite, the stub rewrite and the store's readers all use it.
- **Why:** portable-tools depends on delivery-config, so only the lower library can serve both, and editors and readers must agree on the block.
- **Refuted alternative:** Copy the markers into the story filer.

## 2026-11-11 — Context parts go to gh on standard input
- **Choice:** The shared Runner takes an optional `input`; `postParts` runs `gh issue comment --body-file -` with the part on stdin.
- **Why:** No file is staged anywhere, so an interrupted run leaves nothing in the adopter's checkout and a sandboxed gh needs no path of ours.
- **Refuted alternative:** Stage the part under `os.tmpdir()`, which a snap-confined gh cannot read.

## 2026-11-11 — The story filer neither rewrites nor reports refs inside the context
- **Choice:** Pass 3 skips the collapsed context entirely.
- **Why:** The context is planning text kept as filed; reporting its refs would make every re-run end ⚠️ INCOMPLETE.
- **Refuted alternative:** Skip rewriting but still report unresolved refs inside the context.
