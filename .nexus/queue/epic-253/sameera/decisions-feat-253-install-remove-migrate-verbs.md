## 2026-08-27 — The mirror's payload argument becomes a tagged union

- **Choice:** `deployComponents(payload, componentRoot, options)` where `payload` is `{ kind: "directory", dir } | { kind: "empty" }`.
- **Why:** Invariant 3 needs "deliberately empty" to be unrepresentable by accident, and a tagged union makes the throw on an unresolvable payload dir survive for every other caller.
- **Refuted alternative:** Keep `payloadDir: string` and add a separate `removeComponents` entry point — two implementations of one mirror, which the record explicitly rules out.

## 2026-08-27 — The checkout-pointing content is written with filesystem symlinks

- **Choice:** Pointer mode writes one `fs.symlinkSync` per payload file, and every write unlinks the destination first.
- **Why:** The record fixes one pointer per payload file; unlinking first is what stops a later copying install writing *through* a surviving pointer into the maintainer's checkout (invariant 6).
- **Refuted alternative:** Hard links — cheaper to reason about for the loader, but they do not track a file the maintainer rewrites in place with a new inode, which is the whole point of the mode.

## 2026-08-27 — The allowlist text lives in one module, not in the verb

- **Choice:** `allowlist.ts` exports `ALLOWLIST_BLOCK`; the verb prints its lines and the story-#318 test asserts the README carries the same string.
- **Why:** Invariant 17 wants drift across the three surfaces to be a failing build, and a shared constant makes the comparison a single equality rather than a fuzzy match.
- **Refuted alternative:** Generate the README region from the constant — refuted in the record itself (a generated region inside hand-written prose).

## 2026-08-27 — The removal verb is named `uninstall`

- **Choice:** `nexus uninstall`, a leaf verb with no flags.
- **Why:** It pairs with `install` at the same scope (the account's one component set) and reads correctly in the ordering notice it has to print — "run uninstall before removing the package".
- **Refuted alternative:** `nexus install --remove`, keeping one verb for one location; refuted because the ordering notice and the "must run before the package goes" warning belong to a verb a user reaches for deliberately, not to a flag.
