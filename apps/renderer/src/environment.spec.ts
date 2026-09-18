import { describe, expect, it, vi } from "vitest";

import { dependenciesFromEnvironment } from "./environment.js";

const SIGN_IN = {
    NEXUS_RENDERER_CLIENT_ID: "Iv1.rendererapp",
    NEXUS_RENDERER_CLIENT_SECRET: "the-secret",
    NEXUS_RENDERER_SESSION_KEY: Buffer.alloc(32, 8).toString("base64"),
};

describe("what an instance takes from its environment", () => {
    it("serves the stores its environment named, under the app it named", () => {
        const dependencies = dependenciesFromEnvironment({
            ...SIGN_IN,
            NEXUS_RENDERER_STORES: "acme/assets, acme/other",
        });

        expect(dependencies.config.stores).toEqual(["acme/assets", "acme/other"]);
        expect(dependencies.auth.clientId).toBe("Iv1.rendererapp");
    });

    it("refuses to start rather than sealing sessions with a value of its own", () => {
        expect(() =>
            dependenciesFromEnvironment({
                NEXUS_RENDERER_CLIENT_ID: SIGN_IN.NEXUS_RENDERER_CLIENT_ID,
                NEXUS_RENDERER_CLIENT_SECRET: SIGN_IN.NEXUS_RENDERER_CLIENT_SECRET,
                NEXUS_RENDERER_STORES: "acme/assets",
            }),
        ).toThrow(/NEXUS_RENDERER_SESSION_KEY/);
    });

    it("trades a returned code for the reader's own token through the fetch it was given", async () => {
        const fetcher = vi.fn(
            async () =>
                new Response(JSON.stringify({ access_token: "ghu_reader", expires_in: 28_800 }), {
                    status: 200,
                }),
        );

        const { auth } = dependenciesFromEnvironment(
            { ...SIGN_IN, NEXUS_RENDERER_STORES: "acme/assets" },
            fetcher,
        );

        expect(await auth.exchange("the-code")).toEqual({
            token: "ghu_reader",
            expiresInSeconds: 28_800,
        });
    });
});
