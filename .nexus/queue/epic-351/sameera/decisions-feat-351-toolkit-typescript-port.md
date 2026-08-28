## 2026-08-28 — Capabilities move in-process one story at a time

- **Choice:** At story #355 the TypeScript dispatcher registers `version` and `config` as rows that delegate to the retained Python entry, exactly as the two filers do; #356–#361 replace each row with its in-process handler.
- **Why:** The dispatcher is one story and the ported capabilities are six; a dispatcher whose rows had no handlers would leave the toolkit broken between commits.
- **Refuted alternative:** Land the whole port in the dispatcher's commit — coherent at the end, but it collapses seven stories into one change set.

## 2026-08-28 — D6's library rewiring lands with the key defaults, not with the dispatcher

- **Choice:** Retiring `locateGhToolkit`/`ghToolkitCommand` and switching the epic-resolve and pr-worktree libraries to in-process resolution happens in story #358's commit, though the acceptance criterion sits on #355.
- **Why:** Those libraries read `record-label`, `record-type` and `unplanned-label`, which resolve to nothing until #358 ports the built-in defaults — rewiring them at #357 would leave the epic resolver broken for one commit.
- **Refuted alternative:** Rewire at #357 and port the three defaults early — that is #358's content moved, and it splits one catalogue across two commits.
