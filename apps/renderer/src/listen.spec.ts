import { createServer } from "node:http";

import { describe, expect, it } from "vitest";

import { DEFAULT_ADDRESS } from "./config.js";
import { startFromEnvironment, startListener } from "./listen.js";

const COMMIT = "c".repeat(40);

const DEPENDENCIES = {
    config: { stores: ["acme/assets"], sizeCap: 1024 },
    fetch: async () => new Response("<h1>A mockup</h1>", { status: 200 }),
};

/** A port nothing is listening on, so the designation under test is the one that matters. */
async function freePort(): Promise<number> {
    const probe = createServer();
    await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
    const bound = probe.address();
    const port = typeof bound === "object" && bound !== null ? bound.port : 0;
    await new Promise<void>((resolve, reject) =>
        probe.close((error) => (error ? reject(error) : resolve())),
    );
    return port;
}

describe("the listener a developer runs", () => {
    it("answers at the address the team designated", async () => {
        const port = await freePort();
        const listener = await startListener({
            ...DEPENDENCIES,
            address: { host: "127.0.0.1", port },
        });

        try {
            expect(listener.url).toBe(`http://127.0.0.1:${port}/`);

            const address = `https://github.com/acme/assets/blob/${COMMIT}/a.html`;
            const response = await fetch(
                `http://127.0.0.1:${port}/?url=${encodeURIComponent(address)}`,
            );

            expect(response.status).toBe(200);
            expect(await response.text()).toBe("<h1>A mockup</h1>");
            expect(response.headers.get("content-security-policy")).toMatch(/\bsandbox\b/);
        } finally {
            await listener.close();
        }
    });

    it("starts at the stated default when nothing is designated", async () => {
        const listener = await startListener(DEPENDENCIES);

        try {
            expect(listener.url).toBe(`http://${DEFAULT_ADDRESS.host}:${DEFAULT_ADDRESS.port}/`);
        } finally {
            await listener.close();
        }
    });

    it("starts from the environment alone, at the address it designates", async () => {
        const port = await freePort();
        const listener = await startFromEnvironment(
            {
                NEXUS_RENDERER_ADDRESS: `127.0.0.1:${port}`,
                NEXUS_RENDERER_STORES: "acme/assets",
            },
            DEPENDENCIES.fetch,
        );

        try {
            const address = `https://github.com/acme/assets/blob/${COMMIT}/a.html`;
            const response = await fetch(
                `${listener.url}?url=${encodeURIComponent(address)}`,
            );

            expect(response.status).toBe(200);
            expect(await response.text()).toBe("<h1>A mockup</h1>");
        } finally {
            await listener.close();
        }
    });
});
