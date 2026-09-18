import { describe, expect, it, vi } from "vitest";

import { type AuthDependencies } from "./auth.js";
import { type RendererConfig } from "./config.js";
import { handleRequest } from "./handler.js";
import { SESSION_COOKIE, seal } from "./session.js";

const COMMIT = "f".repeat(40);
const PATH = "features/issue-assets/secret-plan.html";
const CONFIG: RendererConfig = { stores: ["acme/assets"], sizeCap: 1024 };
const KEY = new Uint8Array(32).fill(6);
const NOW = 1_700_000_000_000;

const AUTH: AuthDependencies = {
    clientId: "Iv1.rendererapp",
    sealingKey: KEY,
    exchange: async () => null,
    nonce: () => "the-random-value",
    now: () => NOW,
};

const NAVIGATION = { "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" };

function asReader(token = "ghu_outsider"): Request {
    const session = seal(KEY, { token, expiresAt: NOW + 60_000 });
    return new Request(
        `https://renderer.example/?url=${encodeURIComponent(
            `https://github.com/acme/assets/blob/${COMMIT}/${PATH}`,
        )}`,
        { headers: { ...NAVIGATION, cookie: `${SESSION_COOKIE}=${session}` } },
    );
}

/** What GitHub answers a reader it will not hand a private repository's file to. */
function github(status: number, body = "") {
    return vi.fn(async () => new Response(body, { status }));
}

async function answerTo(fetch: ReturnType<typeof github>, token?: string) {
    const response = await handleRequest(asReader(token), { config: CONFIG, fetch, auth: AUTH });
    return { status: response.status, body: await response.text() };
}

describe("a reader without access to the store is refused, not shown the mockup", () => {
    it("refuses a signed-in reader the store will not hand the file to", async () => {
        const mockup = "<h1>The secret plan</h1>";
        const { status, body } = await answerTo(github(404, "Not Found"));

        expect(status).toBe(404);
        expect(body).not.toContain(mockup);
        expect(body).not.toContain("secret-plan");
    });

    it("answers a file that is not theirs exactly as it answers one that is not there", async () => {
        const missing = await answerTo(github(404, "Not Found"));
        const forbidden = await answerTo(github(403, '{"message":"Must have pull access."}'));

        expect(forbidden).toEqual(missing);
    });

    it("says nothing in that refusal about whether the file exists", async () => {
        const { body } = await answerTo(github(404, "Not Found"));

        expect(body).not.toMatch(/exists?|no such|missing|present/i);
    });

    it("makes the decision from the store's own answer and from no rule of its own", async () => {
        const refused = await answerTo(github(404, "Not Found"));
        const served = await answerTo(
            vi.fn(async () => new Response("<h1>The secret plan</h1>", { status: 200 })),
        );

        expect(refused.status).toBe(404);
        expect(served.status).toBe(200);
        expect(served.body).toBe("<h1>The secret plan</h1>");
    });

    it("asks the store again for each reader, keeping no answer about anyone's access", async () => {
        const fetch = github(404, "Not Found");

        await answerTo(fetch, "ghu_dana");
        await answerTo(fetch, "ghu_sam");

        expect(fetch).toHaveBeenCalledTimes(2);
        const tokens = fetch.mock.calls.map((call) =>
            new Headers((call[1] as RequestInit).headers).get("authorization"),
        );
        expect(tokens).toEqual(["Bearer ghu_dana", "Bearer ghu_sam"]);
    });

    it("lets nothing store that refusal", async () => {
        const fetch = github(404, "Not Found");
        const response = await handleRequest(asReader(), { config: CONFIG, fetch, auth: AUTH });

        expect(response.headers.get("cache-control") ?? "").toMatch(/no-store/);
    });

    it("keeps the refusal page on an origin of its own", async () => {
        const fetch = github(404, "Not Found");
        const response = await handleRequest(asReader(), { config: CONFIG, fetch, auth: AUTH });

        expect(response.headers.get("content-security-policy") ?? "").toMatch(/\bsandbox\b/);
    });

    it("echoes no part of the address into the refusal it renders", async () => {
        const fetch = github(403, '{"message":"<script>alert(1)</script>"}');
        const { body } = await answerTo(fetch);

        expect(body).not.toContain("alert(1)");
        expect(body).not.toContain("acme/assets");
    });
});

describe("a store the renderer is not set up on", () => {
    it("is told apart from a reader who cannot reach it", async () => {
        const notInstalled = await answerTo(
            github(403, '{"message":"Resource not accessible by integration"}'),
        );
        const notTheirs = await answerTo(github(404, "Not Found"));

        expect(notInstalled.status).not.toBe(notTheirs.status);
    });

    it("says the store is not set up, rather than hiding the team's own mistake from them", async () => {
        const { body } = await answerTo(
            github(403, '{"message":"Resource not accessible by integration"}'),
        );

        expect(body).toMatch(/set up/i);
    });
});
