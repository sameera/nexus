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
    | "unreadable"
    | "too-large"
    | "opaque-origin"
    | "store-unreachable"
    | "not-a-navigation"
    | "sign-in-not-begun"
    | "sign-in-unavailable"
    | "store-not-set-up";

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
    unreadable: { status: 404, reason: "That mockup could not be read as you." },
    "too-large": { status: 413, reason: "That file is larger than this renderer serves." },
    "opaque-origin": { status: 403, reason: "This renderer answers no cross-origin request." },
    "store-unreachable": { status: 502, reason: "The store could not be read." },
    "not-a-navigation": {
        status: 403,
        reason: "This renderer answers only a page a reader opened.",
    },
    "sign-in-not-begun": { status: 400, reason: "No sign-in of yours is waiting to finish." },
    "sign-in-unavailable": { status: 502, reason: "The sign-in could not be completed." },
    "store-not-set-up": {
        status: 502,
        reason: "That store is not set up for rendering: this renderer is not installed on it.",
    },
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
