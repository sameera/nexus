import { describe, expect, it } from "vitest";

import {
    DEFAULT_ADDRESS,
    DEFAULT_SIZE_CAP,
    addressFromEnvironment,
    configFromEnvironment,
} from "./config.js";

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

describe("addressFromEnvironment", () => {
    it("takes the address the team designated", () => {
        expect(addressFromEnvironment({ NEXUS_RENDERER_ADDRESS: "0.0.0.0:9090" })).toEqual({
            host: "0.0.0.0",
            port: 9090,
        });
    });

    it("takes a designated port alone, on the default host", () => {
        expect(addressFromEnvironment({ NEXUS_RENDERER_ADDRESS: ":9090" })).toEqual({
            host: DEFAULT_ADDRESS.host,
            port: 9090,
        });
    });

    it("takes a designated host alone, on the default port", () => {
        expect(addressFromEnvironment({ NEXUS_RENDERER_ADDRESS: "0.0.0.0" })).toEqual({
            host: "0.0.0.0",
            port: DEFAULT_ADDRESS.port,
        });
    });

    it("answers at the stated default when the team designated nothing", () => {
        expect(addressFromEnvironment({})).toEqual(DEFAULT_ADDRESS);
        expect(addressFromEnvironment({ NEXUS_RENDERER_ADDRESS: "  " })).toEqual(DEFAULT_ADDRESS);
    });

    it("answers at the stated default port rather than failing on a port it cannot read", () => {
        expect(addressFromEnvironment({ NEXUS_RENDERER_ADDRESS: "0.0.0.0:not-a-port" })).toEqual({
            host: "0.0.0.0",
            port: DEFAULT_ADDRESS.port,
        });
    });
});
