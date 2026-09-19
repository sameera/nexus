/**
 * The shared library sources the release publishes (epic #677, goal #690).
 *
 * The teaching stage is leaving for a package of its own, and it reads roadmaps out of Nexus epic
 * issues, resolves the delivery config, verifies decision-record digests and resolves a multi-repo
 * workspace. Those four capabilities are Nexus's, held in workspace libraries that were private
 * because nothing outside this checkout ever needed them. One thing does now.
 *
 * The refuted alternative was vendoring a copy into the teaching repository: 2,860 lines of
 * workspace resolution, epic resolution and config-key handling, duplicated across two repositories
 * that both keep changing, with no mechanism able to notice when the copies stop agreeing. A
 * published source surface keeps one definition. The teaching package consumes it at BUILD time
 * only — its executable is a self-contained bundle, exactly as this one is — so an adopter installs
 * two packages that share no runtime code and cannot reach different versions of it.
 *
 * Source is published rather than a compiled artifact because that is how these libraries are
 * already consumed: their own `exports` point straight at `src/`, there is no per-library build
 * step, and a consumer's bundler compiles them. Publishing a build output here would invent a
 * second shape for one library and leave the checkout's shape untested.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/** Directory the shared sources travel under, inside the staged release tree. */
export const SHARED_LIBRARY_DIRNAME = "lib";

/**
 * The libraries whose source ships. This is the transitive closure of what the teaching stage
 * imports, and it is stated rather than derived: publishing a library is a commitment to a
 * consumer outside this repository, and that is a decision, not a side effect of an import.
 */
export const SHARED_LIBRARIES: readonly string[] = [
    "delivery-config",
    "epic-resolve",
    "record-digest",
    "release-identity",
    "workspace",
];

/** One staged source file: where it lands in the release tree, and where it came from. */
export interface SharedLibraryFile {
    /** Path relative to the release tree root, posix-style. */
    staged: string;
    /** Absolute path in the checkout. */
    source: string;
}

/** True for a file that is part of the library rather than part of testing it. */
function isPublishedSource(name: string): boolean {
    return name.endsWith(".ts") && !name.endsWith(".spec.ts") && !name.endsWith("-fixtures.ts");
}

/**
 * Every shared source the release stages, sorted by staged path.
 *
 * The staged layout drops the `src/` segment, so a library's declared subpath maps to its staged
 * file by name alone: `@nexus/workspace/resolve` is `lib/workspace/resolve.ts`. Every one of these
 * libraries already maps `./<name>` to `./src/<name>.ts`, and the spec beside this module pins that
 * it stays that way — the flattening is what lets a consumer resolve a subpath without a table.
 */
export function listSharedLibraryFiles(repoRoot: string): SharedLibraryFile[] {
    const files: SharedLibraryFile[] = [];
    const walk = (dir: string, stagedPrefix: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
            const abs: string = path.join(dir, entry.name);
            // A library may hold a nested directory of its own; the nesting is kept, because a
            // subpath like `@nexus/delivery-config/epic-filer/run` names it.
            if (entry.isDirectory()) {
                walk(abs, `${stagedPrefix}/${entry.name}`);
            } else if (isPublishedSource(entry.name)) {
                files.push({ staged: `${stagedPrefix}/${entry.name}`, source: abs });
            }
        }
    };
    for (const lib of SHARED_LIBRARIES) {
        const srcDir: string = path.join(repoRoot, "libs", lib, "src");
        if (fs.existsSync(srcDir)) {
            walk(srcDir, `${SHARED_LIBRARY_DIRNAME}/${lib}`);
        }
    }
    return files.sort((a, b) => (a.staged < b.staged ? -1 : a.staged > b.staged ? 1 : 0));
}
