/**
 * "Was this module run directly?" — the guard every executable entry point uses (story #308).
 *
 * Comparing `import.meta.url` against `process.argv[1]` as strings answers that question only
 * when the caller named the file by its real path. A package manager links a declared binary
 * onto the caller's path as a symlink, so an installed run names the link while the module knows
 * its own resolved location; the two never match and the program silently does nothing. Resolving
 * both sides to their real path is what makes the installed shape and the checkout shape agree.
 */

import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

export function isDirectRun(moduleUrl: string, invokedPath: string | undefined): boolean {
    if (!invokedPath) {
        return false;
    }
    try {
        return fs.realpathSync(fileURLToPath(moduleUrl)) === fs.realpathSync(invokedPath);
    } catch {
        return false;
    }
}
