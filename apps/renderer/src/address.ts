/**
 * The pinned address the renderer answers about: the whole commit-pinned address a team's
 * link template produced, parsed into the store, the commit and the path inside it. The
 * renderer defines no address form of its own (decision record #653).
 */
import { type RefusalKind } from "./refusal.js";

export interface PinnedAddress {
    readonly store: string;
    readonly commit: string;
    readonly path: string;
}

export type ParseResult =
    | { readonly ok: true; readonly address: PinnedAddress }
    | { readonly ok: false; readonly refusal: RefusalKind };

/** The host the pinned address form belongs to. */
const STORE_HOST = "github.com";
const FULL_COMMIT = /^[0-9a-f]{40}$|^[0-9a-f]{64}$/;
const HTML_PAGE = /\.html?$/i;

export function parsePinnedAddress(value: string): ParseResult {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return { ok: false, refusal: "no-address" };
    }
    if (url.protocol !== "https:" || url.hostname !== STORE_HOST) {
        return { ok: false, refusal: "no-address" };
    }

    const segments = url.pathname.split("/").filter((segment) => segment.length > 0);
    const [owner, repo, marker, ref, ...rest] = segments;
    if (marker !== "blob" || owner === undefined || repo === undefined || ref === undefined) {
        return { ok: false, refusal: "no-address" };
    }
    if (rest.length === 0) return { ok: false, refusal: "no-address" };

    if (!FULL_COMMIT.test(ref)) return { ok: false, refusal: "unpinned-reference" };

    let path: string;
    try {
        path = rest.map(decodeURIComponent).join("/");
    } catch {
        return { ok: false, refusal: "no-address" };
    }
    if (!HTML_PAGE.test(path)) return { ok: false, refusal: "not-html" };

    return { ok: true, address: { store: `${owner}/${repo}`, commit: ref, path } };
}
