/**
 * The release identity (story #305). One semantic version covers the TypeScript executable, the
 * Python toolkit and the component payload together, because they ship as one artifact and
 * cannot be at different versions.
 *
 * That version is declared exactly once, in a `VERSION` file at the release root, and both
 * toolkits reach it the same way: walk up from the reader's own file position until a
 * declaration appears. The walk is what makes the one declaration serve both layouts without a
 * build step — in a source checkout it lands on the repository root, and in a distributable it
 * lands on the package root the two toolkits are installed under. Neither half carries a version
 * literal of its own, so there is nothing to keep in step.
 *
 * An unresolved declaration is reported as `null`, never as a guessed or default version: a
 * fabricated version in a writer stamp is worse than an absent one, which a reader already knows
 * how to treat as "written by an unknown toolkit".
 */

import * as fs from "node:fs";
import * as path from "node:path";

/** The file that carries the one declaration, at the release root. */
export const RELEASE_VERSION_FILE = "VERSION";

/** The nearest declaration at or above `startDir`, or null when there is none. */
export function resolveReleaseVersion(startDir: string): string | null {
    let dir: string = path.resolve(startDir);
    for (;;) {
        const candidate: string = path.join(dir, RELEASE_VERSION_FILE);
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            const declared: string = fs.readFileSync(candidate, "utf8").trim();
            return declared === "" ? null : declared;
        }
        const parent: string = path.dirname(dir);
        if (parent === dir) {
            return null;
        }
        dir = parent;
    }
}

/** The release this executable is part of, resolved from where this module itself sits. */
export function releaseVersion(): string | null {
    return resolveReleaseVersion(import.meta.dirname);
}
