import { describe, expect, it } from "vitest";
import { extractUrlDocsRoot, normalizeRelativePath, toAbsoluteUrl } from "./normalize.js";

describe("normalizeRelativePath", () => {
    it("strips a leading ./ and leading slashes", () => {
        expect(normalizeRelativePath("./docs/features/x.md", "docs")).toBe("features/x.md");
        expect(normalizeRelativePath("/docs/features/x.md", "docs")).toBe("features/x.md");
    });

    it("strips exactly the resolved docs root once", () => {
        expect(normalizeRelativePath("docs/features/x.md", "docs")).toBe("features/x.md");
    });

    it("strips nothing when the docs root is the repo root (\".\")", () => {
        expect(normalizeRelativePath("docs/features/x.md", ".")).toBe("docs/features/x.md");
    });

    it("leaves parent references as-is", () => {
        expect(normalizeRelativePath("../other/x.md", "docs")).toBe("../other/x.md");
    });
});

describe("extractUrlDocsRoot", () => {
    it("returns the trailing path after /blob/<ref>/", () => {
        expect(extractUrlDocsRoot("https://github.com/acme/app/blob/main/docs")).toBe("docs");
    });

    it("returns the trailing path after /tree/<ref>/", () => {
        expect(extractUrlDocsRoot("https://github.com/acme/app/tree/main/docs")).toBe("docs");
    });

    it("returns \".\" when there is no trailing path after the ref", () => {
        expect(extractUrlDocsRoot("https://github.com/acme/app/blob/main")).toBe(".");
    });

    it("returns null when the URL carries no recognizable blob/tree path", () => {
        expect(extractUrlDocsRoot("https://example.com/not-github")).toBeNull();
    });
});

describe("toAbsoluteUrl", () => {
    it("appends the normalized path onto the doc root", () => {
        expect(toAbsoluteUrl("docs/features/x.md", "https://github.com/acme/app/blob/main/docs/", "docs")).toBe(
            "https://github.com/acme/app/blob/main/docs/features/x.md",
        );
    });
});
