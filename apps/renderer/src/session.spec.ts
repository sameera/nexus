import { describe, expect, it } from "vitest";

import {
    FLOW_COOKIE,
    SESSION_COOKIE,
    cleared,
    cookieFrom,
    open,
    seal,
    sealedCookie,
} from "./session.js";

const KEY = new Uint8Array(32).fill(7);
const OTHER_KEY = new Uint8Array(32).fill(9);

describe("what the reader's browser carries the session in", () => {
    it("gives back what was sealed, under the key it was sealed with", () => {
        const sealedValue = seal(KEY, { token: "ghu_secret", expiresAt: 1_000 });

        expect(open(KEY, sealedValue)).toEqual({ token: "ghu_secret", expiresAt: 1_000 });
    });

    it("never shows the sealed value's contents to anyone holding only the cookie", () => {
        const sealedValue = seal(KEY, { token: "ghu_secret", expiresAt: 1_000 });

        expect(sealedValue).not.toContain("ghu_secret");
    });

    it("gives back nothing when the sealed value was altered", () => {
        const sealedValue = seal(KEY, { token: "ghu_secret", expiresAt: 1_000 });
        const altered = `${sealedValue.slice(0, -2)}${sealedValue.endsWith("A") ? "B" : "A"}=`;

        expect(open(KEY, altered)).toBeNull();
    });

    it("gives back nothing to a reader holding a value sealed under another key", () => {
        expect(open(OTHER_KEY, seal(KEY, { token: "ghu_secret", expiresAt: 1_000 }))).toBeNull();
    });

    it("gives back nothing for a value that is not a sealed one at all", () => {
        expect(open(KEY, "not-sealed")).toBeNull();
        expect(open(KEY, "")).toBeNull();
    });

    it("seals the same value differently each time, so two cookies cannot be compared", () => {
        expect(seal(KEY, { token: "same" })).not.toBe(seal(KEY, { token: "same" }));
    });
});

describe("how the session cookie is set", () => {
    const attributes = sealedCookie(SESSION_COOKIE, "sealed-value", 3600);

    it("is kept from script, sent only over a secure connection, and bound to its host", () => {
        expect(attributes).toMatch(/HttpOnly/i);
        expect(attributes).toMatch(/Secure/i);
        expect(attributes).toMatch(/Path=\//i);
        expect(attributes).not.toMatch(/Domain=/i);
        expect(SESSION_COOKIE.startsWith("__Host-")).toBe(true);
        expect(FLOW_COOKIE.startsWith("__Host-")).toBe(true);
    });

    it("still arrives when the reader followed a mockup link from another site", () => {
        expect(attributes).toMatch(/SameSite=Lax/i);
    });

    it("lasts no longer than it was given", () => {
        expect(attributes).toMatch(/Max-Age=3600\b/i);
    });

    it("is ended by clearing it", () => {
        expect(cleared(FLOW_COOKIE)).toMatch(/Max-Age=0\b/i);
    });
});

describe("reading a cookie the browser sent", () => {
    it("finds the named cookie among the others the browser attached", () => {
        const header = `other=1; ${SESSION_COOKIE}=sealed-value; another=2`;

        expect(cookieFrom(header, SESSION_COOKIE)).toBe("sealed-value");
    });

    it("finds nothing when the browser attached none", () => {
        expect(cookieFrom(null, SESSION_COOKIE)).toBeNull();
        expect(cookieFrom("other=1", SESSION_COOKIE)).toBeNull();
    });
});
