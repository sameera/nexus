import { describe, expect, it } from "vitest";
import { renderVerifyResult } from "./render";
import { type VerifyResult } from "./verify";

describe("renderVerifyResult", () => {
    it("states how many regions it proved unchanged", () => {
        const result: VerifyResult = { ok: true, regions: 4 };
        expect(renderVerifyResult(result)).toContain("4");
    });

    it("names every changed region on its own line", () => {
        const result: VerifyResult = {
            ok: false,
            problem: "region-changed",
            problems: [
                { kind: "changed", region: "frontmatter", line: 2, detail: "slug: b" },
                { kind: "added", region: "html-comment", line: 14, detail: "<!-- added -->" },
            ],
        };
        const rendered: string = renderVerifyResult(result);
        expect(rendered).toContain("frontmatter");
        expect(rendered).toContain("html-comment");
        expect(rendered.split("\n")).toHaveLength(3);
    });

    it("says which region the translated copy removed", () => {
        const result: VerifyResult = {
            ok: false,
            problem: "region-changed",
            problems: [{ kind: "removed", region: "fenced-block", line: 7, detail: "```json" }],
        };
        const rendered: string = renderVerifyResult(result);
        expect(rendered).toContain("removed");
        expect(rendered).toContain("fenced-block");
    });

    it("names the copy it could not read", () => {
        const result: VerifyResult = { ok: false, problem: "unreadable", message: "cannot read draft.md" };
        expect(renderVerifyResult(result)).toContain("draft.md");
    });
});
