/**
 * Convert repository-relative paths to absolute GitHub URLs.
 *
 * Reads `cross-ref.docs-root` from .nexus/config/settings.yml and appends each provided relative
 * path, after stripping exactly the resolved workspace docs root (epic #74) — `docs/` for a
 * single-repo checkout or a workspace member, or nothing for a hub whose docs root is the repo
 * root. The resolver (`@nexus/workspace/resolve`) is the sole producer of that value; this module
 * never re-derives it.
 *
 * The resolved docs root and the cross-ref URL must agree (Invariant 7): if the URL's trailing
 * path segment doesn't match the resolved docs root, that is an operator misconfiguration,
 * surfaced as an error rather than a dead link.
 */

import { localDocsRoot } from "@nexus/workspace/resolve";
import { findRepoRoot } from "./repo-root.js";
import { getDocRoot } from "./settings.js";
import { extractUrlDocsRoot, toAbsoluteUrl } from "./normalize.js";

export type AbsDocPathResult = { ok: true; urls: string[] } | { ok: false; message: string };

/** Describe a docs root for an error message: "the repo root" for ".", else a quoted segment. */
function describeRoot(root: string): string {
    return root === "." ? "the repo root" : `'${root}'`;
}

/** Resolve `relativePaths` (relative to a repo starting from `startDir`) to absolute GitHub URLs. */
export function resolveAbsDocPath(startDir: string, relativePaths: string[]): AbsDocPathResult {
    const repoRoot = findRepoRoot(startDir);
    const docsRootResult = localDocsRoot(repoRoot);
    if (!docsRootResult.ok) {
        return {
            ok: false,
            message: `Workspace resolution failed: ${docsRootResult.error.problem} — ${docsRootResult.error.message}`,
        };
    }
    const docsRoot = docsRootResult.docsRoot;

    const docRoot = getDocRoot(repoRoot);
    const urlDocsRoot = extractUrlDocsRoot(docRoot);
    if (urlDocsRoot !== null && urlDocsRoot !== docsRoot) {
        return {
            ok: false,
            message:
                `cross-ref.docs-root URL disagrees with the resolved docs root: the URL points at ` +
                `${describeRoot(urlDocsRoot)} but the resolved docs root is ${describeRoot(docsRoot)}. Fix ` +
                `.nexus/config/settings.yml's cross-ref.docs-root (or the workspace docs-root ` +
                `override) so they agree.`,
        };
    }

    return { ok: true, urls: relativePaths.map((relPath) => toAbsoluteUrl(relPath, docRoot, docsRoot)) };
}
