import { describe, expect, it, vi } from "vitest";

import { type AuthDependencies } from "./auth.js";
import { type RendererConfig } from "./config.js";
import { handleRequest } from "./handler.js";
import { SESSION_COOKIE, seal } from "./session.js";

const COMMIT = "e".repeat(40);
const CONFIG: RendererConfig = { stores: ["acme/assets"], sizeCap: 1024 };
const KEY = new Uint8Array(32).fill(8);
const NOW = 1_700_000_000_000;

const AUTH: AuthDependencies = {
    clientId: "Iv1.rendererapp",
    sealingKey: KEY,
    exchange: async () => null,
    nonce: () => "the-random-value",
    now: () => NOW,
};

const NAVIGATION = { "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" };

function pinned(): string {
    return `https://github.com/acme/assets/blob/${COMMIT}/features/issue-assets/flow.html`;
}

function asReader(token?: string): Request {
    const cookie =
        token === undefined
            ? {}
            : { cookie: `${SESSION_COOKIE}=${seal(KEY, { token, expiresAt: NOW + 60_000 })}` };
    return new Request(`https://renderer.example/?url=${encodeURIComponent(pinned())}`, {
        headers: { ...NAVIGATION, ...cookie },
    });
}

/** A private store that shows each reader only what that reader may see. */
function storeShowing(byReader: Record<string, string>) {
    return vi.fn(async (_input: string, init?: RequestInit) => {
        const sent = new Headers(init?.headers);
        const token = (sent.get("authorization") ?? "").replace(/^Bearer /, "");
        const body = byReader[token];
        if (body === undefined) return new Response("Not Found", { status: 404 });
        return new Response(body, { status: 200 });
    });
}

describe("a private mockup is served by reading the store as the reader", () => {
    it("shows the signed-in reader the file rendered as a page", async () => {
        const fetch = storeShowing({ ghu_dana: "<!doctype html><h1>A private mockup</h1>" });

        const response = await handleRequest(asReader("ghu_dana"), {
            config: CONFIG,
            fetch,
            auth: AUTH,
        });

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toMatch(/^text\/html/);
        expect(await response.text()).toBe("<!doctype html><h1>A private mockup</h1>");
    });

    it("shows the reader what the store shows that same reader, and nothing else", async () => {
        const fetch = storeShowing({ ghu_dana: "<p>what Dana can open</p>" });

        const response = await handleRequest(asReader("ghu_dana"), {
            config: CONFIG,
            fetch,
            auth: AUTH,
        });

        expect(await response.text()).toBe("<p>what Dana can open</p>");
    });

    it("spends the reader's own token on the fetch, at the pinned commit", async () => {
        const fetch = storeShowing({ ghu_dana: "<p>ok</p>" });

        await handleRequest(asReader("ghu_dana"), { config: CONFIG, fetch, auth: AUTH });

        const [address, init] = fetch.mock.calls[0] as [string, RequestInit];
        expect(new Headers(init.headers).get("authorization")).toBe("Bearer ghu_dana");
        expect(new URL(address).searchParams.get("ref")).toBe(COMMIT);
    });

    it("answers a second reader's own access again, rather than reusing the first's", async () => {
        const fetch = storeShowing({ ghu_dana: "<p>Dana's</p>", ghu_sam: "<p>Sam's</p>" });

        const dana = await handleRequest(asReader("ghu_dana"), { config: CONFIG, fetch, auth: AUTH });
        const sam = await handleRequest(asReader("ghu_sam"), { config: CONFIG, fetch, auth: AUTH });

        expect(await dana.text()).toBe("<p>Dana's</p>");
        expect(await sam.text()).toBe("<p>Sam's</p>");
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("lets nothing store a mockup that a credential was involved in fetching", async () => {
        const fetch = storeShowing({ ghu_dana: "<p>private</p>" });

        const response = await handleRequest(asReader("ghu_dana"), {
            config: CONFIG,
            fetch,
            auth: AUTH,
        });

        expect(response.headers.get("cache-control") ?? "").toMatch(/no-store/);
    });

    it("lets nothing store it even when the store turns out to be public", async () => {
        const fetch = vi.fn(async () => new Response("<p>public after all</p>", { status: 200 }));

        const response = await handleRequest(asReader("ghu_dana"), {
            config: CONFIG,
            fetch,
            auth: AUTH,
        });

        expect(await response.text()).toBe("<p>public after all</p>");
        expect(response.headers.get("cache-control") ?? "").toMatch(/no-store/);
    });

    it("still lets a mockup fetched with no credential be kept as unchanging", async () => {
        const fetch = vi.fn(async () => new Response("<p>public</p>", { status: 200 }));

        const response = await handleRequest(
            new Request(`https://renderer.example/?url=${encodeURIComponent(pinned())}`, {
                headers: NAVIGATION,
            }),
            { config: CONFIG, fetch, auth: AUTH },
        );

        const cache = response.headers.get("cache-control") ?? "";
        expect(cache).toMatch(/\bimmutable\b/);
        expect(cache).not.toMatch(/no-store/);
    });

    it("keeps the mockup on an origin of its own, credential or not", async () => {
        const fetch = storeShowing({ ghu_dana: "<script>document.cookie</script>" });

        const response = await handleRequest(asReader("ghu_dana"), {
            config: CONFIG,
            fetch,
            auth: AUTH,
        });

        const policy = response.headers.get("content-security-policy") ?? "";
        expect(policy).toMatch(/\bsandbox\b/);
        expect(policy).not.toMatch(/allow-same-origin/);
    });

    it("writes the reader's token into no part of what it sends back", async () => {
        const fetch = storeShowing({ ghu_dana: "<p>private</p>" });

        const response = await handleRequest(asReader("ghu_dana"), {
            config: CONFIG,
            fetch,
            auth: AUTH,
        });
        const body = await response.text();

        expect(body).not.toContain("ghu_dana");
        expect([...response.headers.values()].join(" ")).not.toContain("ghu_dana");
    });

    it("sends the reader's token to no store but the one the address named", async () => {
        const fetch = storeShowing({ ghu_dana: "<p>ok</p>" });

        await handleRequest(asReader("ghu_dana"), { config: CONFIG, fetch, auth: AUTH });

        const [address] = fetch.mock.calls[0] as [string];
        expect(new URL(address).origin).toBe("https://api.github.com");
        expect(new URL(address).pathname).toContain("/repos/acme/assets/");
    });

    it("forwards no cookie or credential the reader's browser attached for another host", async () => {
        const fetch = storeShowing({ ghu_dana: "<p>ok</p>" });
        const session = seal(KEY, { token: "ghu_dana", expiresAt: NOW + 60_000 });

        await handleRequest(
            new Request(`https://renderer.example/?url=${encodeURIComponent(pinned())}`, {
                headers: {
                    ...NAVIGATION,
                    cookie: `${SESSION_COOKIE}=${session}; elsewhere=someone-elses`,
                },
            }),
            { config: CONFIG, fetch, auth: AUTH },
        );

        const sent = new Headers((fetch.mock.calls[0][1] as RequestInit).headers);
        expect(sent.get("cookie")).toBeNull();
        expect(sent.get("authorization")).toBe("Bearer ghu_dana");
    });
});
