import { describe, expect, it } from "vitest";
import { extractMeta, withLink } from "./meta.js";

const RAW = ['feature: "Multi-Repo Workspaces"', "feature_path: docs/features/mrw", "complexity: L", 'link: ""'].join("\n");

function bodyWithMeta(): string {
    return `# Epic: X\n\n## Description\n\nD.\n\n<!-- nexus:epic-meta\n${RAW}\n-->\n`;
}

describe("extractMeta", () => {
    it("returns null and the untouched body when there is no meta block", () => {
        const r = extractMeta("# Epic: X\n\n## Description\n\nD.");
        expect(r.rawFrontmatter).toBeNull();
        expect(r.body).toContain("## Description");
    });

    it("lifts the raw frontmatter and removes the block from the body", () => {
        const r = extractMeta(bodyWithMeta());
        expect(r.rawFrontmatter).toContain('feature: "Multi-Repo Workspaces"');
        expect(r.rawFrontmatter).toContain("complexity: L");
        expect(r.body).not.toContain("nexus:epic-meta");
        expect(r.body).toContain("## Description");
    });

    it("collapses the blank lines left where the block was removed", () => {
        const r = extractMeta(bodyWithMeta());
        expect(r.body).not.toMatch(/\n{3,}/);
    });
});

describe("withLink", () => {
    it("replaces an existing empty link line with the issue number", () => {
        expect(withLink(RAW, 115)).toContain('link: "#115"');
        expect(withLink(RAW, 115)).not.toContain('link: ""');
    });

    it("appends a link line when the frontmatter has none", () => {
        const out = withLink("feature: X\ncomplexity: M", 42);
        expect(out.split("\n").at(-1)).toBe('link: "#42"');
    });

    it("overwrites a stale link with the authoritative issue number", () => {
        expect(withLink('complexity: M\nlink: "#9"', 115)).toContain('link: "#115"');
        expect(withLink('complexity: M\nlink: "#9"', 115)).not.toContain('"#9"');
    });
});
