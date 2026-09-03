import { describe, expect, it } from "vitest";
import { renderVerifyResult } from "./render";
import { type VerifyResult } from "./verify";

describe("renderVerifyResult", () => {
    it("states how many regions it proved unchanged and how many items it proved preserved", () => {
        const result: VerifyResult = { ok: true, regions: 4, tracked: 12 };
        const rendered: string = renderVerifyResult(result);
        expect(rendered).toContain("4");
        expect(rendered).toContain("12");
    });

    it("names every changed region on its own line", () => {
        const result: VerifyResult = {
            ok: false,
            problem: "changed",
            problems: [
                { kind: "changed", region: "frontmatter", line: 2, detail: "slug: b" },
                { kind: "added", region: "html-comment", line: 14, detail: "<!-- added -->" },
            ],
            findings: [],
        };
        const rendered: string = renderVerifyResult(result);
        expect(rendered).toContain("frontmatter");
        expect(rendered).toContain("html-comment");
        expect(rendered.split("\n")).toHaveLength(3);
    });

    it("says which region the translated copy removed", () => {
        const result: VerifyResult = {
            ok: false,
            problem: "changed",
            problems: [{ kind: "removed", region: "fenced-block", line: 7, detail: "```json" }],
            findings: [],
        };
        const rendered: string = renderVerifyResult(result);
        expect(rendered).toContain("removed");
        expect(rendered).toContain("fenced-block");
    });

    it("names a missing tracked item and the line it stood on", () => {
        const result: VerifyResult = {
            ok: false,
            problem: "changed",
            problems: [],
            findings: [{ kind: "missing", item: "numeric", label: "95%", lines: [12] }],
        };
        const rendered: string = renderVerifyResult(result);
        expect(rendered).toContain("95%");
        expect(rendered).toContain("line 12");
    });

    it("names every line a missing item stood on", () => {
        const result: VerifyResult = {
            ok: false,
            problem: "changed",
            problems: [],
            findings: [{ kind: "missing", item: "name", label: "nexus", lines: [3, 9] }],
        };
        expect(renderVerifyResult(result)).toContain("lines 3, 9");
    });

    it("says an introduced item was grounded in no named source", () => {
        const result: VerifyResult = {
            ok: false,
            problem: "changed",
            problems: [],
            findings: [{ kind: "introduced", item: "name", label: "Postgres", lines: [4] }],
        };
        const rendered: string = renderVerifyResult(result);
        expect(rendered).toContain("introduced");
        expect(rendered).toContain("Postgres");
    });

    it("prints both sections when the pair failed both comparisons", () => {
        const result: VerifyResult = {
            ok: false,
            problem: "changed",
            problems: [{ kind: "changed", region: "frontmatter", line: 2, detail: "slug: b" }],
            findings: [{ kind: "missing", item: "modal", label: "must", lines: [8] }],
        };
        const rendered: string = renderVerifyResult(result);
        expect(rendered).toContain("region-changed");
        expect(rendered).toContain("not-preserved");
    });

    it("names the copy it could not read", () => {
        const result: VerifyResult = { ok: false, problem: "unreadable", message: "cannot read draft.md" };
        expect(renderVerifyResult(result)).toContain("draft.md");
    });
});
