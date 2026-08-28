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

## 2026-08-27 — The inventory of authoring sites is derived, and the waiver set is five files

- **Choice:** `authoring-source-sites.spec.ts` scans every tracked, non-test, non-archive TypeScript source for the loaded directory's name and fails on anything outside an enumerated waiver map; the epic's hand-measured list is not implemented as a checklist.
- **Why:** The filed inventory was already stale — the three test-suite mechanisms it named no longer existed, and several sites it did not name did. A derived check catches the next site; a list does not.
- **Refuted alternative:** Work the filed inventory as written — it produces a green suite and a wrong result.

## 2026-08-27 — Waivers are whole files, matched on the directory name rather than on path construction

- **Choice:** The check matches the plain text of the loaded directory's name anywhere in a file, and waives whole files with a stated reason, rather than trying to recognise only path-building uses.
- **Why:** A syntactic "is this a path join" test is the kind of check that quietly stops matching; matching text and forcing a named waiver makes every mention a decision someone wrote down. `nexus-cli.ts` was rewritten to derive its usage text from the existing constants so it needs no waiver at all.
- **Refuted alternative:** Match only `path.join`/`path.resolve` arguments — narrower, and it would have missed the invocation gate's regex, which is precisely the kind of site worth seeing.
