/**
 * The one rule for validating a checkout directory name in the workspace artifacts.
 *
 * A manifest member `name` and a hub pointer `name` are BARE SIBLING DIRECTORY names: a single
 * path component under the shared parent folder, never a path. The resolver joins such a name
 * onto the parent (`path.join(parent, name)`) to locate a checkout, so a name carrying a path
 * separator or a `..` traversal token could redirect resolution to an arbitrary filesystem
 * location outside the workspace. This module enforces the "bare sibling name" security boundary
 * in one place — applied identically on the manifest side and the pointer side — so the guarantee
 * is not copy-pasted and cannot drift between them.
 */

import * as path from "node:path";

/**
 * True if `name` is a bare directory segment — a single path component that cannot escape its
 * parent. Rejects path separators (`/` or `\`) and the `.` / `..` traversal tokens. Dots that are
 * merely embedded in a name (e.g. `a..b`) are fine: only a name that IS `.` or `..` traverses.
 */
export function isBareSegment(name: string): boolean {
    if (name.includes("/") || name.includes("\\")) {
        return false;
    }
    return name !== "." && name !== "..";
}

/**
 * True if `p` is a safe repo-relative path: never absolute, never escaping via a `..` segment.
 * Unlike {@link isBareSegment} (a single bare directory name), this accepts multi-segment paths
 * and the bare `.` token (meaning "the repo root itself") — the shape a docs-root override needs,
 * since a docs root can be a nested directory or the root, never a name that redirects outside
 * the repo it configures.
 */
export function isSafeRelativePath(p: string): boolean {
    if (p === "") {
        return false;
    }
    if (p.includes("\\")) {
        return false;
    }
    if (path.isAbsolute(p)) {
        return false;
    }
    return p.split("/").every((segment) => segment !== "..");
}
