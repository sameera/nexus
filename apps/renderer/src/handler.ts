/**
 * The renderer: one request in, one response out, nothing kept between calls. The fetch it
 * performs is supplied to it rather than reached for, so the whole handler is exercisable
 * end to end without a network and without a process.
 */
import { parsePinnedAddress, type PinnedAddress } from "./address.js";
import {
    CALLBACK_PATH,
    beginSignIn,
    completeSignIn,
    isNavigation,
    sessionOf,
    type AuthDependencies,
} from "./auth.js";
import { type RendererConfig } from "./config.js";
import { refuse, sandboxedHtml } from "./refusal.js";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface HandlerDependencies {
    readonly config: RendererConfig;
    readonly fetch: FetchLike;
    readonly auth: AuthDependencies;
}

/** A mockup at a fixed commit cannot change, so it is cacheable for as long as anything keeps it. */
const IMMUTABLE = "public, max-age=31536000, immutable";

/** What GitHub answers a reader it will not hand the file to, whether or not it exists. */
function turnedAway(status: number): boolean {
    return status === 401 || status === 403 || status === 404;
}

export async function handleRequest(
    request: Request,
    { config, fetch, auth }: HandlerDependencies,
): Promise<Response> {
    // A document the renderer sandboxed presents an opaque origin. Refusing it here is what
    // keeps a mockup from calling back into the renderer at all, so no endpoint of the
    // renderer's ever sees a request a mockup's markup sent.
    if (request.headers.get("origin") === "null") return refuse("opaque-origin");

    if (new URL(request.url).pathname === CALLBACK_PATH) return completeSignIn(request, auth);

    const value = new URL(request.url).searchParams.get("url");
    if (value === null || value.trim().length === 0) return refuse("no-address");

    const parsed = parsePinnedAddress(value.trim());
    if (!parsed.ok) return refuse(parsed.refusal);

    const address = parsed.address;
    if (!config.stores.includes(address.store)) return refuse("store-not-served");

    // No cookie or credential the reader's browser attached is forwarded: the only credential
    // that ever goes upstream is the token this reader's own sign-in produced.
    const session = sessionOf(request, auth);
    const upstream = await fetch(contentsAddress(address), {
        headers: { accept: "application/vnd.github.raw", "user-agent": "nexus-renderer" },
    });

    if (turnedAway(upstream.status)) {
        // The renderer holds no statement of any store's visibility: GitHub's refusal of an
        // uncredentialed request is the only signal that a sign-in is what this reader needs.
        // A request that already carried a session is refused finally, so no loop is possible.
        if (session === null && isNavigation(request)) return beginSignIn(address, auth);
        return refuse("not-found");
    }
    if (!upstream.ok) return refuse("store-unreachable");

    const declared = upstream.headers.get("content-length");
    if (declared !== null && Number(declared) > config.sizeCap) {
        await discard(upstream);
        return refuse("too-large");
    }

    const body = await readCapped(upstream, config.sizeCap);
    if (body === null) return refuse("too-large");

    return sandboxedHtml(new TextDecoder().decode(body), 200, IMMUTABLE);
}

/**
 * The store's own interface, asked for the file's raw form at exactly this commit. Epic #614
 * adds a reader's credential to this same request; nothing about the host or the parsing moves.
 */
function contentsAddress({ store, commit, path }: PinnedAddress): string {
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    return `https://api.github.com/repos/${store}/contents/${encoded}?ref=${commit}`;
}

async function discard(response: Response): Promise<void> {
    try {
        await response.body?.cancel();
    } catch {
        // A store that will not even be cancelled changes nothing about the refusal.
    }
}

/** Reads at most `cap` bytes, abandoning the response the moment it passes the cap. */
async function readCapped(response: Response, cap: number): Promise<Uint8Array | null> {
    const stream = response.body;
    if (stream === null) return new Uint8Array();

    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > cap) {
            await reader.cancel();
            return null;
        }
        chunks.push(value);
    }

    const body = new Uint8Array(total);
    let at = 0;
    for (const chunk of chunks) {
        body.set(chunk, at);
        at += chunk.byteLength;
    }
    return body;
}
