import { describe, expect, it } from "vitest";

import { startListener } from "./listen.js";

const COMMIT = "c".repeat(40);

describe("the listener a developer runs", () => {
    it("serves a mockup over HTTP through the same handler", async () => {
        const listener = await startListener({
            config: { stores: ["acme/assets"], sizeCap: 1024 },
            fetch: async () => new Response("<h1>A mockup</h1>", { status: 200 }),
        });

        try {
            const address = `https://github.com/acme/assets/blob/${COMMIT}/a.html`;
            const response = await fetch(
                `${listener.url}?url=${encodeURIComponent(address)}`,
            );

            expect(response.status).toBe(200);
            expect(await response.text()).toBe("<h1>A mockup</h1>");
            expect(response.headers.get("content-security-policy")).toMatch(/\bsandbox\b/);
        } finally {
            await listener.close();
        }
    });
});
