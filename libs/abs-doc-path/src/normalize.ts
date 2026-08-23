/**
 * Path normalisation and the cross-ref URL agreement check (Invariant 7): the resolved docs root
 * and the configured cross-ref URL's trailing path segment must name the same thing, or a relative
 * path would silently resolve to a dead link.
 */

/**
 * Normalize the relative path: remove leading ./ or /, then strip exactly the resolved docs root
 * once. A "." docs root (repo root) strips nothing.
 */
export function normalizeRelativePath(path: string, docsRoot: string): string {
    let normalized = path.trim();

    // Handle relative path prefixes
    while (normalized.startsWith("./")) {
        normalized = normalized.slice(2);
    }
    // For parent references (../), we keep them as-is; the caller should
    // provide paths relative to the repo root.

    // Remove leading slash if present
    normalized = normalized.replace(/^\/+/, "");

    // Strip exactly the resolved docs root, once — never a hardcoded "docs/".
    if (docsRoot !== ".") {
        const prefix = `${docsRoot.replace(/\/+$/, "")}/`;
        if (normalized.startsWith(prefix)) {
            normalized = normalized.slice(prefix.length);
        }
    }

    return normalized;
}

/**
 * Extract the in-repo path the cross-ref URL points at — the segment after `/blob/<ref>/` or
 * `/tree/<ref>/` — normalized like a resolved docs root: "." for the repo root (no trailing path
 * after the ref), else the trailing path with no trailing slash. Returns null when the URL carries
 * no recognizable GitHub blob/tree path, in which case the agreement check is skipped rather than
 * guessed at.
 */
export function extractUrlDocsRoot(url: string): string | null {
    const match = url.replace(/\/+$/, "").match(/\/(?:blob|tree)\/[^/]+(?:\/(.*))?$/);
    if (!match) {
        return null;
    }
    return match[1] && match[1] !== "" ? match[1] : ".";
}

/** Convert a relative path to an absolute GitHub URL. */
export function toAbsoluteUrl(relativePath: string, docRoot: string, docsRoot: string): string {
    const normalizedPath = normalizeRelativePath(relativePath, docsRoot);
    return `${docRoot}${normalizedPath}`;
}
