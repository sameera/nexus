## 2026-08-29 — The filer's modules land in a `story-filer/` folder inside the toolkit library
- **Choice:** `libs/delivery-config/src/story-filer/`, one module per phase, imported by relative path.
- **Why:** The decision record puts the filer inside the library holding the registry and dispatcher (to avoid a package cycle); a subfolder keeps fourteen modules out of that library's flat root without changing packaging.
- **Refuted alternative:** Flat files with a `filer-` name prefix, matching the library's existing layout.

## 2026-08-29 — Preflight returns a discriminated outcome rather than exiting
- **Choice:** `preflight()` returns `ready | empty | refused`; only the handler turns that into an exit code.
- **Why:** Keeps the empty-folder case (exit 0) and the refusal cases (non-zero) distinguishable at the seam the tests drive, with no process-level exit anywhere in the library.
- **Refuted alternative:** Throw a typed error per refusal and catch it in the handler.

## 2026-08-29 — Invariant 10 is asserted structurally, over the filer's own sources
- **Choice:** A spec reads every `story-filer/*.ts` source and asserts none defines a function named for a shared capability, and that each such symbol is imported from the shared module that owns it.
- **Why:** The success metric asks for a test that the filer defines no equivalent of its own; a behavioural test cannot see a private re-implementation that happens to agree today.
- **Refuted alternative:** Assert only behaviourally, that resolved values match the shared resolver's, and leave the no-second-copy rule to review.
