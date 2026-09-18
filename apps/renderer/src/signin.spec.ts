import { describe, expect, it, vi } from "vitest";

import { CALLBACK_PATH, type AuthDependencies } from "./auth.js";
import { type RendererConfig } from "./config.js";
import { handleRequest } from "./handler.js";
import { FLOW_COOKIE, SESSION_COOKIE, open, seal, sealedCookie } from "./session.js";

const COMMIT = "c".repeat(40);
const PATH = "features/issue-assets/flow.html";
const CONFIG: RendererConfig = { stores: ["acme/assets"], sizeCap: 1024 };
const KEY = new Uint8Array(32).fill(3);
const NOW = 1_700_000_000_000;

function auth(overrides: Partial<AuthDependencies> = {}): AuthDependencies {
    return {
        clientId: "Iv1.rendererapp",
        sealingKey: KEY,
        exchange: vi.fn(async () => ({ token: "ghu_reader", expiresInSeconds: 28_800 })),
        nonce: () => "the-random-value",
        now: () => NOW,
        ...overrides,
    };
}

function pinned(path = PATH): string {
    return `https://github.com/acme/assets/blob/${COMMIT}/${path}`;
}

/** What a browser sends when a reader clicks a link: a top-level document navigation. */
const NAVIGATION = { "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" };

function opened(address: string, headers: Record<string, string> = {}): Request {
    return new Request(`https://renderer.example/?url=${encodeURIComponent(address)}`, {
        headers: { ...NAVIGATION, ...headers },
    });
}

/** A store that answers only readers carrying a credential. */
function privateStore(body: string) {
    return vi.fn(async (_input: string, init?: RequestInit) => {
        const sent = new Headers(init?.headers);
        if (sent.get("authorization") === null) return new Response("Not Found", { status: 404 });
        return new Response(body, { status: 200 });
    });
}

function setCookies(response: Response): string[] {
    return response.headers.getSetCookie();
}

function named(response: Response, cookie: string): string | undefined {
    return setCookies(response).find((value) => value.startsWith(`${cookie}=`));
}

describe("the reader signs in before a private mockup is served", () => {
    it("sends a reader who has not signed in to sign in, rather than refusing them", async () => {
        const response = await handleRequest(opened(pinned()), {
            config: CONFIG,
            fetch: privateStore("<p>private</p>"),
            auth: auth(),
        });

        expect(response.status).toBe(302);
        const location = new URL(response.headers.get("location") ?? "");
        expect(location.origin).toBe("https://github.com");
        expect(location.searchParams.get("client_id")).toBe("Iv1.rendererapp");
    });

    it("returns the reader to the address they originally opened, not to a page of its own", async () => {
        const started = await handleRequest(opened(pinned()), {
            config: CONFIG,
            fetch: privateStore("<p>private</p>"),
            auth: auth(),
        });
        const flow = named(started, FLOW_COOKIE) ?? "";
        const state = new URL(started.headers.get("location") ?? "").searchParams.get("state");

        const returned = await handleRequest(
            new Request(`https://renderer.example${CALLBACK_PATH}?code=the-code&state=${state}`, {
                headers: { ...NAVIGATION, cookie: flow.split(";")[0] },
            }),
            { config: CONFIG, fetch: privateStore("<p>private</p>"), auth: auth() },
        );

        expect(returned.status).toBe(302);
        const back = new URL(returned.headers.get("location") ?? "", "https://renderer.example");
        expect(back.searchParams.get("url")).toBe(pinned());
    });

    it("hands the reader a sealed session once the sign-in completes", async () => {
        const exchange = vi.fn(async () => ({ token: "ghu_reader", expiresInSeconds: 3_600 }));
        const flow = seal(KEY, {
            store: "acme/assets",
            commit: COMMIT,
            path: PATH,
            nonce: "the-random-value",
        });

        const returned = await handleRequest(
            new Request(
                `https://renderer.example${CALLBACK_PATH}?code=the-code&state=the-random-value`,
                { headers: { ...NAVIGATION, cookie: `${FLOW_COOKIE}=${flow}` } },
            ),
            { config: CONFIG, fetch: privateStore("<p>private</p>"), auth: auth({ exchange }) },
        );

        expect(exchange).toHaveBeenCalledWith("the-code");
        const session = named(returned, SESSION_COOKIE) ?? "";
        const sealed = session.slice(`${SESSION_COOKIE}=`.length).split(";")[0];
        expect(open(KEY, sealed)).toMatchObject({ token: "ghu_reader" });
        expect(session).toMatch(/HttpOnly/i);
        expect(named(returned, FLOW_COOKIE) ?? "").toMatch(/Max-Age=0\b/i);
    });

    it("does not ask a reader still within their session to sign in again", async () => {
        const session = seal(KEY, { token: "ghu_reader", expiresAt: NOW + 60_000 });

        const response = await handleRequest(
            opened(pinned(), { cookie: `${SESSION_COOKIE}=${session}` }),
            { config: CONFIG, fetch: privateStore("<p>private</p>"), auth: auth() },
        );

        expect(response.status).not.toBe(302);
    });

    it("asks a reader whose session has run out to sign in again", async () => {
        const session = seal(KEY, { token: "ghu_reader", expiresAt: NOW - 1 });

        const response = await handleRequest(
            opened(pinned(), { cookie: `${SESSION_COOKIE}=${session}` }),
            { config: CONFIG, fetch: privateStore("<p>private</p>"), auth: auth() },
        );

        expect(response.status).toBe(302);
    });

    it("serves a public store with no sign-in at all, exactly as it is served today", async () => {
        const fetch = vi.fn(async () => new Response("<p>public</p>", { status: 200 }));

        const response = await handleRequest(opened(pinned()), {
            config: CONFIG,
            fetch,
            auth: auth(),
        });

        expect(response.status).toBe(200);
        expect(await response.text()).toBe("<p>public</p>");
        expect(setCookies(response)).toEqual([]);
    });

    it("lets nothing store the sign-in redirect", async () => {
        const response = await handleRequest(opened(pinned()), {
            config: CONFIG,
            fetch: privateStore("<p>private</p>"),
            auth: auth(),
        });

        expect(response.headers.get("cache-control") ?? "").toMatch(/no-store/);
    });
});

describe("what the sign-in flow refuses", () => {
    it("begins a sign-in at most once, refusing a reader whose session is still turned away", async () => {
        const session = seal(KEY, { token: "ghu_stale", expiresAt: NOW + 60_000 });
        const fetch = vi.fn(async () => new Response("Not Found", { status: 404 }));

        const response = await handleRequest(
            opened(pinned(), { cookie: `${SESSION_COOKIE}=${session}` }),
            { config: CONFIG, fetch, auth: auth() },
        );

        expect(response.status).not.toBe(302);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("refuses a return whose random value does not match the one the flow began with", async () => {
        const flow = seal(KEY, {
            store: "acme/assets",
            commit: COMMIT,
            path: PATH,
            nonce: "the-random-value",
        });
        const exchange = vi.fn(async () => ({ token: "ghu_reader", expiresInSeconds: 3_600 }));

        const returned = await handleRequest(
            new Request(`https://renderer.example${CALLBACK_PATH}?code=the-code&state=someone-else`, {
                headers: { ...NAVIGATION, cookie: `${FLOW_COOKIE}=${flow}` },
            }),
            { config: CONFIG, fetch: privateStore("<p>x</p>"), auth: auth({ exchange }) },
        );

        expect(returned.status).toBe(400);
        expect(exchange).not.toHaveBeenCalled();
        expect(named(returned, SESSION_COOKIE)).toBeUndefined();
    });

    it("refuses a return that carries no flow of its own", async () => {
        const returned = await handleRequest(
            new Request(`https://renderer.example${CALLBACK_PATH}?code=c&state=the-random-value`, {
                headers: NAVIGATION,
            }),
            { config: CONFIG, fetch: privateStore("<p>x</p>"), auth: auth() },
        );

        expect(returned.status).toBe(400);
        expect(named(returned, SESSION_COOKIE)).toBeUndefined();
    });

    it("refuses a return the browser did not mark a top-level navigation", async () => {
        const flow = seal(KEY, {
            store: "acme/assets",
            commit: COMMIT,
            path: PATH,
            nonce: "the-random-value",
        });

        const returned = await handleRequest(
            new Request(`https://renderer.example${CALLBACK_PATH}?code=c&state=the-random-value`, {
                headers: { cookie: `${FLOW_COOKIE}=${flow}` },
            }),
            { config: CONFIG, fetch: privateStore("<p>x</p>"), auth: auth() },
        );

        expect(returned.status).toBe(403);
        expect(named(returned, SESSION_COOKIE)).toBeUndefined();
    });

    it("refuses a return sent back to it from a sandboxed document", async () => {
        const returned = await handleRequest(
            new Request(`https://renderer.example${CALLBACK_PATH}?code=c&state=s`, {
                headers: { ...NAVIGATION, origin: "null" },
            }),
            { config: CONFIG, fetch: privateStore("<p>x</p>"), auth: auth() },
        );

        expect(returned.status).toBe(403);
    });

    it("refuses when the store's host will not complete the sign-in", async () => {
        const flow = seal(KEY, {
            store: "acme/assets",
            commit: COMMIT,
            path: PATH,
            nonce: "the-random-value",
        });

        const returned = await handleRequest(
            new Request(
                `https://renderer.example${CALLBACK_PATH}?code=the-code&state=the-random-value`,
                { headers: { ...NAVIGATION, cookie: `${FLOW_COOKIE}=${flow}` } },
            ),
            {
                config: CONFIG,
                fetch: privateStore("<p>x</p>"),
                auth: auth({ exchange: async () => null }),
            },
        );

        expect(returned.status).toBe(502);
        expect(named(returned, SESSION_COOKIE)).toBeUndefined();
    });

    it("carries no part of a returned value into the page it renders on refusal", async () => {
        const returned = await handleRequest(
            new Request(
                `https://renderer.example${CALLBACK_PATH}?code=c&state=${encodeURIComponent(
                    "<script>alert(1)</script>",
                )}`,
                { headers: NAVIGATION },
            ),
            { config: CONFIG, fetch: privateStore("<p>x</p>"), auth: auth() },
        );

        expect(await returned.text()).not.toContain("alert(1)");
    });
});

describe("what the renderer does with a credential it was handed", () => {
    it("ignores a session cookie on a request the browser did not mark a navigation", async () => {
        const session = seal(KEY, { token: "ghu_reader", expiresAt: NOW + 60_000 });
        const fetch = vi.fn(async () => new Response("<p>public</p>", { status: 200 }));

        await handleRequest(
            new Request(`https://renderer.example/?url=${encodeURIComponent(pinned())}`, {
                headers: { cookie: `${SESSION_COOKIE}=${session}` },
            }),
            { config: CONFIG, fetch, auth: auth() },
        );

        const sent = new Headers((fetch.mock.calls[0][1] as RequestInit).headers);
        expect(sent.get("authorization")).toBeNull();
    });

    it("writes no token into the address it sends the reader to, nor into the page", async () => {
        const started = await handleRequest(opened(pinned()), {
            config: CONFIG,
            fetch: privateStore("<p>private</p>"),
            auth: auth(),
        });

        expect(started.headers.get("location") ?? "").not.toContain("ghu_");
        expect(await started.text()).not.toContain("ghu_");
    });

    it("never begins a sign-in for a store it does not serve", async () => {
        const fetch = privateStore("<p>x</p>");

        const response = await handleRequest(
            opened(`https://github.com/attacker/pages/blob/${COMMIT}/a.html`),
            { config: CONFIG, fetch, auth: auth() },
        );

        expect(response.status).toBe(403);
        expect(fetch).not.toHaveBeenCalled();
    });

    it("redirects only to the store's host or to an address it built itself", async () => {
        const flow = seal(KEY, {
            store: "acme/assets",
            commit: COMMIT,
            path: "a b/c.html",
            nonce: "the-random-value",
        });

        const returned = await handleRequest(
            new Request(
                `https://renderer.example${CALLBACK_PATH}?code=the-code&state=the-random-value`,
                { headers: { ...NAVIGATION, cookie: `${FLOW_COOKIE}=${flow}` } },
            ),
            { config: CONFIG, fetch: privateStore("<p>x</p>"), auth: auth() },
        );

        const back = new URL(returned.headers.get("location") ?? "", "https://renderer.example");
        expect(back.origin).toBe("https://renderer.example");
        expect(back.searchParams.get("url")).toBe(
            `https://github.com/acme/assets/blob/${COMMIT}/a%20b/c.html`,
        );
    });
});

describe("the cookie the flow is carried in", () => {
    it("is short-lived, kept from script and sent when GitHub returns the reader", async () => {
        const started = await handleRequest(opened(pinned()), {
            config: CONFIG,
            fetch: privateStore("<p>private</p>"),
            auth: auth(),
        });

        const flow = named(started, FLOW_COOKIE) ?? "";
        expect(flow).toMatch(/HttpOnly/i);
        expect(flow).toMatch(/Secure/i);
        expect(flow).toMatch(/SameSite=Lax/i);
        const maxAge = Number(/Max-Age=(\d+)/i.exec(flow)?.[1]);
        expect(maxAge).toBeGreaterThan(0);
        expect(maxAge).toBeLessThanOrEqual(600);
    });

    it("keeps the address in the flow and not in the value GitHub echoes back", async () => {
        const started = await handleRequest(opened(pinned()), {
            config: CONFIG,
            fetch: privateStore("<p>private</p>"),
            auth: auth(),
        });

        const state = new URL(started.headers.get("location") ?? "").searchParams.get("state") ?? "";
        expect(state).toBe("the-random-value");
        expect(state).not.toContain("flow.html");
        expect(sealedCookie(FLOW_COOKIE, "x", 600)).toContain(FLOW_COOKIE);
    });
});
