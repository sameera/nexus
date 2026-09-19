/**
 * The teaching stage's read of the authored component tree — the one definition on this side of the
 * boundary epic #677 draws.
 *
 * Two checks read the teaching stage's own shipped bodies: the phase-boundary check, which compares
 * what each phase declares it loads, and the extraction check, which reads the subagent's body. Both
 * need the authored root, and neither may reach for the pipeline library's copy of it — that import
 * would be the one edge that stops this library from moving out on its own.
 */

import * as path from "node:path";

/** The repository-root directory holding the authored component tree. */
export const AUTHORED_ROOT_DIRNAME = "components";

/** The authored component tree of the checkout whose sources live under `srcDir`. */
export function teachingComponentRoot(srcDir: string): string {
    return path.resolve(srcDir, "..", "..", "..", AUTHORED_ROOT_DIRNAME);
}
