/**
 * What the renderer refuses, and the page it renders when it does. Each refusal names a
 * reason from the fixed set the decision record states; nothing from the request is echoed
 * back into the page, so the page can carry no markup an address chose.
 */
export type RefusalKind =
    | "no-address"
    | "unpinned-reference"
    | "not-html"
    | "store-not-served"
    | "not-found"
    | "too-large"
    | "opaque-origin"
    | "store-unreachable";

interface Refusal {
    readonly status: number;
    readonly reason: string;
}

const REFUSALS: Record<RefusalKind, Refusal> = {
    "no-address": { status: 400, reason: "This request names no pinned mockup address." },
    "unpinned-reference": {
        status: 400,
        reason: "A mockup is served only at a full commit identifier.",
    },
    "not-html": { status: 400, reason: "Only an HTML page is served." },
    "store-not-served": { status: 403, reason: "That store is not one this renderer serves." },
    "not-found": { status: 404, reason: "No such file at that commit." },
    "too-large": { status: 413, reason: "That file is larger than this renderer serves." },
    "opaque-origin": { status: 403, reason: "This renderer answers no cross-origin request." },
    "store-unreachable": { status: 502, reason: "The store could not be read." },
};

/**
 * Every response the renderer sends carries the sandbox, so no document it produces — a
 * mockup or a refusal page — shares an origin with the renderer's own endpoints.
 */
export const SANDBOX_POLICY = "sandbox allow-scripts";

export function sandboxedHtml(body: string, status: number, cache: string): Response {
    return new Response(body, {
        status,
        headers: {
            "content-type": "text/html; charset=utf-8",
            "content-security-policy": SANDBOX_POLICY,
            "x-content-type-options": "nosniff",
            "referrer-policy": "no-referrer",
            "cache-control": cache,
        },
    });
}

export function refuse(kind: RefusalKind): Response {
    const { status, reason } = REFUSALS[kind];
    return sandboxedHtml(
        `<!doctype html><meta charset="utf-8"><title>Not served</title><p>${reason}</p>`,
        status,
        "no-store",
    );
}
