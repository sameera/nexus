import { describe, expect, it } from "vitest";
import { withIssuesRepo, withLink } from "./link.js";

const DRAFT = ['---', 'epic: "Sample"', 'complexity: M', 'link: ""', "---", "", "# Epic: Sample"].join("\n");

describe("withIssuesRepo", () => {
    it("inserts issues_repo before the closing frontmatter fence", () => {
        const written = withIssuesRepo(DRAFT, "geo-nexus/docs");
        expect(written.content).not.toBeNull();
        expect(written.content).toContain('issues_repo: "geo-nexus/docs"');
        const lines = written.content?.split("\n") ?? [];
        const closingFence = lines.lastIndexOf("---");
        const repoLine = lines.findIndex((l) => l.startsWith("issues_repo:"));
        expect(repoLine).toBeGreaterThan(-1);
        expect(repoLine).toBeLessThan(closingFence);
    });

    it("replaces an existing issues_repo line in place, rather than duplicating it", () => {
        const already = withIssuesRepo(DRAFT, "old/repo").content ?? "";
        const rewritten = withIssuesRepo(already, "geo-nexus/docs");
        expect(rewritten.content?.match(/issues_repo:/g)?.length).toBe(1);
        expect(rewritten.content).toContain('issues_repo: "geo-nexus/docs"');
        expect(rewritten.content).not.toContain("old/repo");
    });

    it("is a no-op when the epic was not filed into a separate repository — single-repo stays unchanged", () => {
        const written = withIssuesRepo(DRAFT, null);
        expect(written.content).toBe(DRAFT);
    });

    it("touches nothing else in the draft (the same Invariant 7 guarantee withLink makes)", () => {
        const written = withIssuesRepo(DRAFT, "geo-nexus/docs");
        expect(written.content).toContain('epic: "Sample"');
        expect(written.content).toContain("complexity: M");
        expect(written.content).toContain('link: ""');
        expect(written.content).toContain("# Epic: Sample");
    });

    it("returns null when the frontmatter has no closing fence, the same failure withLink reports", () => {
        expect(withIssuesRepo("no frontmatter here", "geo-nexus/docs").content).toBeNull();
    });

    it("leaves withLink's own behavior unchanged", () => {
        const linked = withLink(DRAFT, "492");
        expect(linked.content).toContain('link: "#492"');
    });
});
