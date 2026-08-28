/**
 * Where the retained Python entry point sits, relative to this module's own position.
 *
 * Two capabilities — the epic filer and the story filer — are still Python until epics #352 and
 * #353 land, and they are reached by running that entry point as a child process (decision record
 * #362, Invariant 3). It is located from this file's own position, the same self-locating rule the
 * release-version reader uses, so a source checkout and an installed release both resolve without
 * either layout being written down at a call site.
 *
 * In the release the dispatcher is bundled to `<root>/dist/nexus-gh.mjs` and the Python files are
 * staged at `<root>/dist/gh-toolkit/`; in a checkout this module sits at
 * `libs/delivery-config/src/` and the toolkit at `libs/gh-toolkit/`. Both are stated here as
 * candidates because there is nothing else that distinguishes them.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/** The interpreter the retained entry declares. Never a bare `python`. */
export const PYTHON_INTERPRETER = "python3";

/** Candidate locations of the retained entry, relative to a module directory, in order. */
export const PYTHON_ENTRY_CANDIDATES: readonly string[] = [
    path.join("gh-toolkit", "bin", "nexus-gh"),
    path.join("..", "..", "gh-toolkit", "bin", "nexus-gh"),
];

/** The retained Python entry point, or null when this layout carries none. */
export function pythonEntryPoint(moduleDir: string = import.meta.dirname): string | null {
    for (const relative of PYTHON_ENTRY_CANDIDATES) {
        const candidate: string = path.resolve(moduleDir, relative);
        if (fs.existsSync(candidate)) return candidate;
    }
    return null;
}
