import { describe, expect, it, vi } from "vitest";

import { type AuthDependencies } from "./auth.js";
import { type RendererConfig } from "./config.js";
import { handleRequest } from "./handler.js";

const COMMIT = "a".repeat(40);
const OTHER_COMMIT = "b".repeat(40);

const CONFIG: RendererConfig = { stores: ["acme/assets"], sizeCap: 1024 };

const AUTH: AuthDependencies = {
    clientId: "Iv1.rendererapp",
    sealingKey: new Uint8Array(32).fill(1),
    exchange: async () => null,
    nonce: () => "the-random-value",
    now: () => 1_700_000_000_000,
};

function pinned(commit = COMMIT, path = "features/issue-assets/flow.html"): string {
    return `https://github.com/acme/assets/blob/${commit}/${path}`;
}

function mockupRequest(address: string, init?: RequestInit): Request {
    return new Request(`https://renderer.example/?url=${encodeURIComponent(address)}`, init);
}

/** An upstream that answers one body per commit, and refuses anything else. */
function upstream(bodies: Record<string, string>) {
    return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(typeof input === "string" ? input : input.toString());
        const ref = url.searchParams.get("ref") ?? "";
        void init;
        const body = bodies[ref];
        if (body === undefined) return new Response("Not Found", { status: 404 });
        return new Response(body, {
            status: 200,
            headers: { "content-length": String(new TextEncoder().encode(body).length) },
        });
    });
}

describe("the renderer serves a pinned mockup as a rendered page", () => {
    it("returns the published file as a document the browser renders", async () => {
        const fetch = upstream({ [COMMIT]: "<!doctype html><h1>A mockup</h1>" });

        const response = await handleRequest(mockupRequest(pinned()), { config: CONFIG, fetch, auth: AUTH });

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toMatch(/^text\/html/);
        expect(await response.text()).toBe("<!doctype html><h1>A mockup</h1>");
    });

    it("asks the store for the file at exactly the commit the address pinned", async () => {
        const fetch = upstream({ [COMMIT]: "<p>then</p>", [OTHER_COMMIT]: "<p>now</p>" });

        const earlier = await handleRequest(mockupRequest(pinned()), { config: CONFIG, fetch, auth: AUTH });
        const later = await handleRequest(mockupRequest(pinned(OTHER_COMMIT)), {
            config: CONFIG,
            fetch,
            auth: AUTH,
        });

        expect(await earlier.text()).toBe("<p>then</p>");
        expect(await later.text()).toBe("<p>now</p>");
    });

    it("accepts the pinned address whether or not the link template encoded it", async () => {
        const fetch = upstream({ [COMMIT]: "<p>ok</p>" });

        const raw = await handleRequest(
            new Request(`https://renderer.example/?url=${pinned()}`),
            { config: CONFIG, fetch, auth: AUTH },
        );

        expect(raw.status).toBe(200);
        expect(await raw.text()).toBe("<p>ok</p>");
    });

    it("answers the same however it was reached, building no address of its own", async () => {
        const fetch = upstream({ [COMMIT]: "<p>ok</p>" });

        const first = await handleRequest(mockupRequest(pinned()), { config: CONFIG, fetch, auth: AUTH });
        const second = await handleRequest(
            new Request(`http://localhost:8787/?url=${encodeURIComponent(pinned())}`),
            { config: CONFIG, fetch, auth: AUTH },
        );

        expect(await second.text()).toBe(await first.text());
        expect(second.status).toBe(first.status);
    });

    it("keeps nothing between requests, asking the store again each time", async () => {
        const fetch = upstream({ [COMMIT]: "<p>ok</p>" });

        await handleRequest(mockupRequest(pinned()), { config: CONFIG, fetch, auth: AUTH });
        await handleRequest(mockupRequest(pinned()), { config: CONFIG, fetch, auth: AUTH });

        expect(fetch).toHaveBeenCalledTimes(2);
    });
});

describe("the served mockup is isolated from the renderer", () => {
    it("places the mockup on an origin of its own, with no same-origin privilege", async () => {
        const fetch = upstream({ [COMMIT]: "<script>document.cookie</script>" });

        const response = await handleRequest(mockupRequest(pinned()), { config: CONFIG, fetch, auth: AUTH });

        const policy = response.headers.get("content-security-policy") ?? "";
        expect(policy).toMatch(/\bsandbox\b/);
        expect(policy).toMatch(/\ballow-scripts\b/);
        expect(policy).not.toMatch(/allow-same-origin/);
    });

    it("carries the sandbox on a refusal page too", async () => {
        const fetch = upstream({});

        const response = await handleRequest(mockupRequest(pinned()), { config: CONFIG, fetch, auth: AUTH });

        expect(response.status).toBe(404);
        expect(response.headers.get("content-security-policy") ?? "").toMatch(/\bsandbox\b/);
    });

    it("refuses a request sent back to it from a sandboxed document", async () => {
        const fetch = upstream({ [COMMIT]: "<p>ok</p>" });

        const response = await handleRequest(
            mockupRequest(pinned(), { headers: { origin: "null" } }),
            { config: CONFIG, fetch, auth: AUTH },
        );

        expect(response.status).toBe(403);
        expect(fetch).not.toHaveBeenCalled();
    });

    it("sends no credential upstream, whatever the reader's browser attached", async () => {
        const fetch = upstream({ [COMMIT]: "<p>ok</p>" });

        await handleRequest(
            mockupRequest(pinned(), {
                headers: { cookie: "session=secret", authorization: "Bearer secret" },
            }),
            { config: CONFIG, fetch, auth: AUTH },
        );

        const sent = new Headers((fetch.mock.calls[0][1] as RequestInit).headers);
        expect(sent.get("cookie")).toBeNull();
        expect(sent.get("authorization")).toBeNull();
    });
});

describe("what the renderer refuses", () => {
    it("refuses a request that names no address", async () => {
        const fetch = upstream({});

        const response = await handleRequest(new Request("https://renderer.example/"), {
            config: CONFIG,
            fetch,
            auth: AUTH,
        });

        expect(response.status).toBe(400);
        expect(fetch).not.toHaveBeenCalled();
    });

    it("refuses a store it was not configured to serve", async () => {
        const fetch = upstream({ [COMMIT]: "<p>ok</p>" });

        const response = await handleRequest(
            mockupRequest(`https://github.com/attacker/pages/blob/${COMMIT}/a.html`),
            { config: CONFIG, fetch, auth: AUTH },
        );

        expect(response.status).toBe(403);
        expect(fetch).not.toHaveBeenCalled();
    });

    it("refuses a reference that is not a full commit identifier", async () => {
        const fetch = upstream({ [COMMIT]: "<p>ok</p>" });

        const response = await handleRequest(
            mockupRequest("https://github.com/acme/assets/blob/main/a.html"),
            { config: CONFIG, fetch, auth: AUTH },
        );

        expect(response.status).toBe(400);
        expect(fetch).not.toHaveBeenCalled();
    });

    it("refuses a path that does not name an HTML page", async () => {
        const fetch = upstream({ [COMMIT]: "<p>ok</p>" });

        const response = await handleRequest(mockupRequest(pinned(COMMIT, "a.png")), {
            config: CONFIG,
            fetch,
            auth: AUTH,
        });

        expect(response.status).toBe(400);
        expect(fetch).not.toHaveBeenCalled();
    });

    it("refuses a file that is not present at that commit", async () => {
        const response = await handleRequest(mockupRequest(pinned()), {
            config: CONFIG,
            fetch: upstream({}),
            auth: AUTH,
        });

        expect(response.status).toBe(404);
    });

    it("refuses a file the store declares to be above the cap before a byte of it arrives", async () => {
        let cancelled = false;
        const fetch = vi.fn(
            async () =>
                new Response(
                    new ReadableStream({
                        // Yields nothing, ever: reading this body would never finish.
                        pull: () => new Promise<void>(() => undefined),
                        cancel: () => {
                            cancelled = true;
                        },
                    }),
                    { status: 200, headers: { "content-length": "2048" } },
                ),
        );

        const response = await handleRequest(mockupRequest(pinned()), { config: CONFIG, fetch, auth: AUTH });

        expect(response.status).toBe(413);
        expect(cancelled).toBe(true);
    });

    it("refuses a file that passes the cap only once it is being read", async () => {
        const fetch = vi.fn(
            async () => new Response("x".repeat(4096), { status: 200 }),
        );

        const response = await handleRequest(mockupRequest(pinned()), { config: CONFIG, fetch, auth: AUTH });

        expect(response.status).toBe(413);
    });

    it("refuses when the store itself answers with an error", async () => {
        const fetch = vi.fn(async () => new Response("boom", { status: 500 }));

        const response = await handleRequest(mockupRequest(pinned()), { config: CONFIG, fetch, auth: AUTH });

        expect(response.status).toBe(502);
    });

    it("echoes no part of the request back into the page it renders", async () => {
        const fetch = upstream({});

        const response = await handleRequest(
            mockupRequest("https://github.com/acme/<script>alert(1)</script>/blob/main/a.html"),
            { config: CONFIG, fetch, auth: AUTH },
        );

        const body = await response.text();
        expect(body).not.toContain("<script>alert(1)</script>");
        expect(body).not.toContain("alert(1)");
    });
});

describe("what the renderer caches", () => {
    it("marks a mockup served from a public store as unchanging", async () => {
        const fetch = upstream({ [COMMIT]: "<p>ok</p>" });

        const response = await handleRequest(mockupRequest(pinned()), { config: CONFIG, fetch, auth: AUTH });

        const cache = response.headers.get("cache-control") ?? "";
        expect(cache).toMatch(/\bpublic\b/);
        expect(cache).toMatch(/\bimmutable\b/);
    });

    it("lets nothing cache a refusal", async () => {
        const fetch = upstream({});

        const response = await handleRequest(mockupRequest(pinned()), { config: CONFIG, fetch, auth: AUTH });

        expect(response.headers.get("cache-control") ?? "").toMatch(/no-store/);
    });
});
