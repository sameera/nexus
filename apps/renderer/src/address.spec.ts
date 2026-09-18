import { describe, expect, it } from "vitest";

import { parsePinnedAddress } from "./address.js";

const COMMIT = "0".repeat(39) + "a";

describe("parsePinnedAddress", () => {
    it("reads the store, the commit and the path out of a pinned blob address", () => {
        const parsed = parsePinnedAddress(
            `https://github.com/acme/assets/blob/${COMMIT}/features/issue-assets/flow.html`,
        );

        expect(parsed).toEqual({
            ok: true,
            address: {
                store: "acme/assets",
                commit: COMMIT,
                path: "features/issue-assets/flow.html",
            },
        });
    });

    it("reads a path whose segments need decoding", () => {
        const parsed = parsePinnedAddress(
            `https://github.com/acme/assets/blob/${COMMIT}/features/my%20mockups/a%20flow.html`,
        );

        expect(parsed).toEqual({
            ok: true,
            address: {
                store: "acme/assets",
                commit: COMMIT,
                path: "features/my mockups/a flow.html",
            },
        });
    });

    it("refuses a reference that is not a full commit identifier", () => {
        const parsed = parsePinnedAddress(
            "https://github.com/acme/assets/blob/main/features/issue-assets/flow.html",
        );

        expect(parsed).toEqual({ ok: false, refusal: "unpinned-reference" });
    });

    it("refuses an abbreviated commit identifier", () => {
        const parsed = parsePinnedAddress(
            "https://github.com/acme/assets/blob/0a1b2c3/features/issue-assets/flow.html",
        );

        expect(parsed).toEqual({ ok: false, refusal: "unpinned-reference" });
    });

    it("refuses a path that does not name an HTML page", () => {
        const parsed = parsePinnedAddress(
            `https://github.com/acme/assets/blob/${COMMIT}/features/issue-assets/flow.png`,
        );

        expect(parsed).toEqual({ ok: false, refusal: "not-html" });
    });

    it("accepts the .htm spelling", () => {
        const parsed = parsePinnedAddress(
            `https://github.com/acme/assets/blob/${COMMIT}/a.HTM`,
        );

        expect(parsed).toEqual({
            ok: true,
            address: { store: "acme/assets", commit: COMMIT, path: "a.HTM" },
        });
    });

    it.each([
        ["a value that is not an address at all", "not an address"],
        ["an address on another host", `https://example.com/acme/assets/blob/${COMMIT}/a.html`],
        ["an address that is not a blob reference", `https://github.com/acme/assets/raw/${COMMIT}/a.html`],
        ["an address naming no file", `https://github.com/acme/assets/blob/${COMMIT}/`],
        ["an address naming no store", `https://github.com/blob/${COMMIT}/a.html`],
        ["a path that climbs out of the store", `https://github.com/acme/assets/blob/${COMMIT}/../../a.html`],
    ])("refuses %s", (_label, value) => {
        expect(parsePinnedAddress(value)).toEqual({ ok: false, refusal: "no-address" });
    });
});
