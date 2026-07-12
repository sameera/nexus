import { describe, expect, it } from "vitest";
import { isBareSegment } from "./bare-name";

describe("isBareSegment", () => {
    it("accepts a plain directory name", () => {
        expect(isBareSegment("docs-hub")).toBe(true);
        expect(isBareSegment("web-app")).toBe(true);
        expect(isBareSegment("web.app")).toBe(true);
    });

    it("accepts a name with embedded dots that is not a traversal token", () => {
        expect(isBareSegment("a..b")).toBe(true);
        expect(isBareSegment("...")).toBe(true);
    });

    it("rejects a forward-slash path", () => {
        expect(isBareSegment("nested/app")).toBe(false);
        expect(isBareSegment("/abs")).toBe(false);
        expect(isBareSegment("../evil")).toBe(false);
    });

    it("rejects a backslash path", () => {
        expect(isBareSegment("a\\b")).toBe(false);
        expect(isBareSegment("..\\evil")).toBe(false);
    });

    it("rejects the current- and parent-directory traversal tokens", () => {
        expect(isBareSegment(".")).toBe(false);
        expect(isBareSegment("..")).toBe(false);
    });
});
