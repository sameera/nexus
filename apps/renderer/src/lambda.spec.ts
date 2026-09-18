import { describe, expect, it, vi } from "vitest";

import { type AuthDependencies } from "./auth.js";
import { type RendererConfig } from "./config.js";
import { type HandlerDependencies } from "./handler.js";
import { answerEvent, type FunctionUrlEvent } from "./lambda.js";
import { SESSION_COOKIE, seal } from "./session.js";

const COMMIT = "e".repeat(40);
const PATH = "features/issue-assets/flow.html";
const CONFIG: RendererConfig = { stores: ["acme/assets"], sizeCap: 1024 };
const KEY = new Uint8Array(32).fill(7);
const NOW = 1_700_000_000_000;

/** What a browser sends when a reader clicks a link: a top-level document navigation. */
const NAVIGATION = { "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" };

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

/** The event a Function URL delivers for a reader opening a mockup link. */
function opened(
    address: string,
    { cookies, headers }: { cookies?: string[]; headers?: Record<string, string> } = {},
): FunctionUrlEvent {
    return {
        version: "2.0",
        rawPath: "/",
        rawQueryString: `url=${encodeURIComponent(address)}`,
        cookies,
        headers: { ...NAVIGATION, ...headers },
        requestContext: { http: { method: "GET" } },
    };
}

function publicStore(body: string) {
    return vi.fn(async () => new Response(body, { status: 200 }));
}

/** A store that answers only readers carrying a credential. */
function privateStore(body: string) {
    return vi.fn(async (_input: string, init?: RequestInit) => {
        const sent = new Headers(init?.headers);
        if (sent.get("authorization") === null) return new Response("Not Found", { status: 404 });
        return new Response(body, { status: 200 });
    });
}

function dependencies(fetch: HandlerDependencies["fetch"]): HandlerDependencies {
    return { config: CONFIG, fetch, auth: auth() };
}

describe("the renderer answering a Function URL event", () => {
    it("serves the pinned mockup as a rendered page", async () => {
        const result = await answerEvent(
            opened(pinned()),
            dependencies(publicStore("<!doctype html><h1>A mockup</h1>")),
        );

        expect(result.statusCode).toBe(200);
        expect(result.body).toBe("<!doctype html><h1>A mockup</h1>");
        expect(result.isBase64Encoded).toBe(false);
        expect(result.headers["content-type"]).toMatch(/^text\/html/);
    });

    it("carries the isolation of every response it returns", async () => {
        const result = await answerEvent(opened(pinned()), dependencies(publicStore("<p>x</p>")));

        expect(result.headers["content-security-policy"]).toMatch(/\bsandbox\b/);
    });

    it("reads the reader's session from the cookies the event carries separately", async () => {
        const session = seal(KEY, { token: "ghu_reader", expiresAt: NOW + 60_000 });
        const fetch = privateStore("<p>private</p>");

        const result = await answerEvent(
            opened(pinned(), { cookies: [`${SESSION_COOKIE}=${session}`, "other=value"] }),
            dependencies(fetch),
        );

        expect(result.statusCode).toBe(200);
        expect(result.body).toBe("<p>private</p>");
        expect(new Headers(fetch.mock.calls[0][1]?.headers).get("authorization")).toBe(
            "Bearer ghu_reader",
        );
    });

    it("returns what it sets on the browser where a Function URL takes cookies", async () => {
        const result = await answerEvent(
            opened(pinned()),
            dependencies(privateStore("<p>private</p>")),
        );

        expect(result.statusCode).toBe(302);
        expect(result.cookies.some((cookie) => cookie.startsWith("__Host-nexus-flow="))).toBe(true);
        expect(result.headers["set-cookie"]).toBeUndefined();
    });

    it("answers the sign-in callback at the one path GitHub returns a reader to", async () => {
        const flow = seal(KEY, { store: "acme/assets", commit: COMMIT, path: PATH, nonce: "n" });
        const result = await answerEvent(
            {
                version: "2.0",
                rawPath: "/auth/callback",
                rawQueryString: "code=the-code&state=n",
                cookies: [`__Host-nexus-flow=${flow}`],
                headers: { ...NAVIGATION },
                requestContext: { http: { method: "GET" } },
            },
            dependencies(publicStore("<p>x</p>")),
        );

        expect(result.statusCode).toBe(302);
        expect(result.headers.location).toBe(
            `/?url=${encodeURIComponent(`https://github.com/acme/assets/blob/${COMMIT}/${PATH}`)}`,
        );
    });

    it("refuses a request that names no mockup", async () => {
        const result = await answerEvent(
            {
                version: "2.0",
                rawPath: "/",
                rawQueryString: "",
                headers: { ...NAVIGATION },
                requestContext: { http: { method: "GET" } },
            },
            dependencies(publicStore("<p>x</p>")),
        );

        expect(result.statusCode).toBe(400);
    });

    it("answers an event whose headers the host left unstated", async () => {
        const result = await answerEvent(
            {
                version: "2.0",
                rawPath: "/",
                rawQueryString: `url=${encodeURIComponent(pinned())}`,
                requestContext: { http: { method: "GET" } },
            },
            dependencies(publicStore("<p>x</p>")),
        );

        expect(result.statusCode).toBe(200);
        expect(result.body).toBe("<p>x</p>");
    });
});
