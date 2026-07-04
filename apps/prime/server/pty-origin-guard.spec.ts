import { describe, expect, it } from "vitest";
import { isOriginAllowed } from "./pty-origin-guard";

describe("isOriginAllowed", () => {
    it("allows an absent Origin header (non-browser clients)", () => {
        expect(isOriginAllowed("localhost:3000", undefined)).toBe(true);
    });

    it("allows an Origin whose host matches the request Host", () => {
        expect(isOriginAllowed("localhost:3000", "http://localhost:3000")).toBe(true);
    });

    it("rejects an Origin whose host differs from the request Host", () => {
        expect(isOriginAllowed("localhost:3000", "http://evil.example:9999")).toBe(false);
    });

    it("rejects a malformed Origin header", () => {
        expect(isOriginAllowed("localhost:3000", "not-a-url")).toBe(false);
    });

    it("rejects when the Host header itself is missing", () => {
        expect(isOriginAllowed(undefined, "http://localhost:3000")).toBe(false);
    });
});
