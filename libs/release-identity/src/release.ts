/**
 * The release identity (story #305). One semantic version covers the executable and the
 * component payload together, because they ship as one artifact and cannot be at different
 * versions.
 *
 * That version is declared exactly once, as the `version` of the release's own package manifest,
 * and every reader reaches it the same way: walk up from the reader's own file position until a
 * manifest naming this release appears. The walk is what makes the one declaration serve both
 * layouts without a build step — in a source checkout it lands on the repository root, and in a
 * distributable it lands on the package root the release is installed under. No part carries a
 * version literal of its own, so there is nothing to keep in step.
 *
 * The walk matches on the package name because it cannot match on position: a workspace member's
 * own manifest sits between this file and the release root, and those members are pinned at a
 * placeholder version they never publish under. Naming the release here is the cost of having one
 * declaration rather than two — it replaces a second version file, not a second name.
 *
 * An unresolved declaration is reported as `null`, never as a guessed or default version: a
 * fabricated version in a writer stamp is worse than an absent one, which a reader already knows
 * how to treat as "written by an unknown toolkit". A manifest that cannot be parsed is passed
 * over rather than raised on, because this reader feeds the read-out a user runs when something
 * is already broken.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/** The manifest that carries the one declaration, at the release root. */
export const RELEASE_MANIFEST_FILE = "package.json";

/** The name that identifies the release's own manifest among the manifests the walk passes. */
export const RELEASE_PACKAGE_NAME = "@sameeraperera/nexus";

/** The `version` of the manifest at `dir` when it names this release, else null. */
function declaredAt(dir: string): string | null {
    const candidate: string = path.join(dir, RELEASE_MANIFEST_FILE);
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) {
        return null;
    }
    let manifest: { name?: unknown; version?: unknown };
    try {
        manifest = JSON.parse(fs.readFileSync(candidate, "utf8"));
    } catch {
        return null;
    }
    if (manifest.name !== RELEASE_PACKAGE_NAME || typeof manifest.version !== "string") {
        return null;
    }
    const declared: string = manifest.version.trim();
    return declared === "" ? null : declared;
}

/** The nearest declaration at or above `startDir`, or null when there is none. */
export function resolveReleaseVersion(startDir: string): string | null {
    let dir: string = path.resolve(startDir);
    for (;;) {
        const declared: string | null = declaredAt(dir);
        if (declared !== null) {
            return declared;
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
