/**
 * The one git-remote normalization rule for the workspace resolver.
 *
 * A single remote appears in several equivalent spellings (SSH scp-form, `ssh://`,
 * `https://`, with or without a trailing `.git`). Matching raw strings would silently
 * break workspace parity when two checkouts present different spellings. This module
 * defines the canonical form once — compare host plus path, ignore the protocol and the
 * `.git` suffix — so every consumer (manifest here, the member pointer and cross-entry
 * parity in later stories) compares the same normalized identity.
 */

interface HostPath {
    host: string;
    path: string;
}

/** Split a `.git`-and-slash-trimmed remote into its host and repository path. */
function splitHostPath(s: string): HostPath {
    // scheme://[user@]host[:port]/path — http(s), ssh, git, …
    const scheme = /^[a-z][a-z0-9+.-]*:\/\/(.*)$/i.exec(s);
    if (scheme) {
        const afterUser = scheme[1].replace(/^[^@/]+@/, "");
        const slash = afterUser.indexOf("/");
        const hostSeg = slash === -1 ? afterUser : afterUser.slice(0, slash);
        const path = slash === -1 ? "" : afterUser.slice(slash + 1);
        return { host: hostSeg.split(":")[0], path };
    }

    // scp-like SSH: [user@]host:owner/repo (a ':' before any '/')
    const scp = /^[^@]+@([^:/]+):(.*)$/.exec(s);
    if (scp) {
        return { host: scp[1], path: scp[2] };
    }

    // bare host/owner/repo (already-normalized form, or a plain path)
    const slash = s.indexOf("/");
    if (slash === -1) {
        return { host: s, path: "" };
    }
    return { host: s.slice(0, slash), path: s.slice(slash + 1) };
}

/**
 * Normalize a git remote to `host/owner/repo` for identity comparison.
 *
 * Total and best-effort: it never throws. The host is lowercased (DNS is
 * case-insensitive); the repository path's case is preserved (some self-hosted forges
 * are path-case-sensitive, and two spellings of the same remote share their casing).
 */
export function normalizeRemote(url: string): string {
    const trimmed = url
        .trim()
        .replace(/\/+$/, "") // drop trailing slashes
        .replace(/\.git$/i, ""); // drop the .git suffix

    const { host, path } = splitHostPath(trimmed);
    const cleanPath = path.replace(/^\/+/, "");
    return cleanPath ? `${host.toLowerCase()}/${cleanPath}` : host.toLowerCase();
}
