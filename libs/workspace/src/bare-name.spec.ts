import { describe, expect, it } from "vitest";
import { isBareSegment, isSafeRelativePath } from "./bare-name";

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

describe("isSafeRelativePath", () => {
    it("accepts the current-directory token (repo root)", () => {
        expect(isSafeRelativePath(".")).toBe(true);
    });

    it("accepts a single-segment relative path", () => {
        expect(isSafeRelativePath("docs")).toBe(true);
    });

    it("accepts a multi-segment relative path", () => {
        expect(isSafeRelativePath("docs/handbook")).toBe(true);
    });

    it("rejects an absolute path", () => {
        expect(isSafeRelativePath("/docs")).toBe(false);
        expect(isSafeRelativePath("/")).toBe(false);
    });

    it("rejects any path carrying a '..' traversal segment", () => {
        expect(isSafeRelativePath("..")).toBe(false);
        expect(isSafeRelativePath("../docs")).toBe(false);
        expect(isSafeRelativePath("docs/../..")).toBe(false);
    });

    it("rejects a backslash path", () => {
        expect(isSafeRelativePath("docs\\handbook")).toBe(false);
    });

    it("rejects an empty string", () => {
        expect(isSafeRelativePath("")).toBe(false);
    });
});
