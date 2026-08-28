## 2026-08-27 — Story #319 builds the version read-out it was going to merely verify

- **Choice:** Add the install-location report (`installLocation: {path, source, content, checkout}`) to `nexus version` inside story #319 rather than treating AC3 as already satisfied.
- **Why:** The epic assumes #251 already made the version verb report which content is present; it does not, so AC3 was unverifiable as filed and the gate would have been recorded as passed on an unmet criterion.
- **Refuted alternative:** Record AC3 as blocked and carry it into story #321 with the other call sites — refused because the gate story is the one that has to be true before the tree moves.

## 2026-08-27 — The authored root is `components/`, and the old helper name survives one story

- **Choice:** The authored tree moves to `components/` at the repository root — an ordinary tracked directory — and `AUTHORED_ROOT_DIRNAME` in `vendor-components.ts` is its single definition. `liveClaudeDir` stays for one story as a deprecated alias that already resolves the new root.
- **Why:** The rename is atomic across every consumer, so keeping the alias is what lets the move land green without dragging story #321's call-site sweep into the same commit.
- **Refuted alternative:** Rename every call site in the move commit — refused because it merges the two stories and leaves nothing for the derived-inventory check to catch.

## 2026-08-27 — The move fixes the sites the move itself breaks

- **Choice:** Story #320 repoints the four hand-written test sites that read `<repo-root>/.claude` (writer-stamp, version-verb, migrate-components, install/uninstall/install-location fixtures) rather than leaving them for story #321.
- **Why:** They fail the moment the tree moves; a red commit between two stories is worse than a slightly wider one, and story #321's actual deliverable is the standing check that finds the *next* such site, not this hand-made list.
- **Refuted alternative:** Land the move red and repair in #321 — refused: the epic's whole point is that a mis-ordered move leaves the repository unusable, so its own commit must be verifiable.
