import { describe, expect, it } from "vitest";

import { DEFAULT_SIZE_CAP, configFromEnvironment } from "./config.js";

describe("configFromEnvironment", () => {
    it("takes the served stores from the environment", () => {
        const config = configFromEnvironment({
            NEXUS_RENDERER_STORES: "acme/assets, acme/mockups",
        });

        expect(config.stores).toEqual(["acme/assets", "acme/mockups"]);
    });

    it("serves no store when the environment names none", () => {
        expect(configFromEnvironment({}).stores).toEqual([]);
    });

    it("takes the size cap from the environment", () => {
        expect(configFromEnvironment({ NEXUS_RENDERER_SIZE_CAP: "1024" }).sizeCap).toBe(1024);
    });

    it("falls back to the stated size cap when the environment names none", () => {
        expect(configFromEnvironment({}).sizeCap).toBe(DEFAULT_SIZE_CAP);
    });

    it("falls back to the stated size cap when the environment's value is not a positive number", () => {
        expect(configFromEnvironment({ NEXUS_RENDERER_SIZE_CAP: "nonsense" }).sizeCap).toBe(
            DEFAULT_SIZE_CAP,
        );
        expect(configFromEnvironment({ NEXUS_RENDERER_SIZE_CAP: "0" }).sizeCap).toBe(
            DEFAULT_SIZE_CAP,
        );
    });
});
