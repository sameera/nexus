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

## 2026-08-29 — The retrying runner throws, mirroring the Python wrapper
- **Choice:** `retryingRunner` returns a successful `RunResult` or throws `GhError`; each platform method catches and reports.
- **Why:** Keeps the call sites a one-to-one read against the Python original, where the same distinction (raise vs. report) is what decides which failures are fatal and which only warn.
- **Refuted alternative:** Return a result union and branch at every call site — no exceptions, but it re-shapes twelve call sites the port is meant to preserve.

## 2026-08-29 — Project membership enters pass 1 through a `ProjectAssignment` collaborator
- **Choice:** Pass 1 takes an `idFor`/`add` pair, wired inert (`NO_PROJECT`) until story #370 supplies the real one.
- **Why:** #370 is blocked_by #369, so pass 1 has to exist and be fully tested before project targeting is resolvable; the seam keeps #370 a wiring change rather than a rewrite of pass 1.
- **Refuted alternative:** Thread the resolved project ids through pass 1's parameters directly, as the Python original does.

## 2026-08-29 — The resume hint is rebuilt from the parsed arguments, not from the raw vector
- **Choice:** `reconstructFlags(FilerArgs)` renders one canonical spelling per flag; the raw argv is not retained.
- **Why:** Invariant 13 requires a flag added to the capability to be added to the hint with it — deriving from the parsed shape makes that a single edit, and normalises `--retries=5` and `--retries 5` to one line.
- **Refuted alternative:** Echo the argv verbatim, which reproduces the operator's exact typing but re-echoes nothing when a default was applied and cannot be checked for completeness.

## 2026-08-29 — The no-interpreter assertion mocks the process module, not the filer's own seam
- **Choice:** `cutover.spec.ts` mocks `node:child_process` and asserts every recorded spawn is `gh`, running the batch through the real default environment.
- **Why:** The filer's injected seam is exactly what a test could use to *hide* a spawn; asserting one layer below it is the only level at which "no interpreter is spawned on any path" is actually checked.
- **Refuted alternative:** Assert that the registry row's handler is the ported function — cheap, but it tests the binding rather than the behaviour the criterion names.

## 2026-08-29 — The bundle fingerprint is re-pinned in the cut-over commit
- **Choice:** `pnpm nexus:pin-bundles` runs as part of #374, not the earlier stories.
- **Why:** Until the row flips, the filer's modules are unreachable from the entry point and tree-shaking keeps them out of the bundle; the flip is the first change that alters the released artifact's bytes.
- **Refuted alternative:** Re-pin on every story, which would have churned the fingerprint seven times for one real change.
