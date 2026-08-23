/** Locating the repository root the doc-path resolver reads settings from. */

import { existsSync } from "node:fs";
import { dirname, join, parse } from "node:path";

/** Find the repository root by walking up from `startDir` looking for common markers. */
export function findRepoRoot(startDir: string): string {
    let current = startDir;
    const { root } = parse(current);

    while (true) {
        if (existsSync(join(current, ".git"))) {
            return current;
        }
        if (existsSync(join(current, ".nexus", "config", "settings.yml"))) {
            return current;
        }
        if (current === root) {
            break;
        }
        current = dirname(current);
    }

    return startDir;
}
