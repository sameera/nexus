import { describe, expect, it } from "vitest";
import { extractRegions, type Region } from "./regions";

function kinds(content: string): string[] {
    return extractRegions(content).map((region: Region) => region.kind);
}

describe("extractRegions — the machine-read regions of an artifact", () => {
    it("reads the leading frontmatter block, delimiters included", () => {
        const regions: Region[] = extractRegions("---\nslug: a\n---\n\nprose\n");
        expect(regions).toHaveLength(1);
        expect(regions[0].kind).toBe("frontmatter");
        expect(regions[0].line).toBe(1);
        expect(regions[0].lines).toEqual(["---", "slug: a", "---"]);
    });

    it("does not read a horizontal rule further down the body as frontmatter", () => {
        expect(kinds("prose\n\n---\n\nmore prose\n")).toEqual([]);
    });

    it("does not read an unclosed leading delimiter as frontmatter", () => {
        expect(kinds("---\nslug: a\n\nprose\n")).toEqual([]);
    });

    it("reads a fenced block including its fence lines", () => {
        const regions: Region[] = extractRegions("intro\n\n```json\n{ }\n```\n");
        expect(regions).toHaveLength(1);
        expect(regions[0].kind).toBe("fenced-block");
        expect(regions[0].line).toBe(3);
        expect(regions[0].lines).toEqual(["```json", "{ }", "```"]);
    });

    it("treats a shorter fence inside a longer one as block content, not a second block", () => {
        const regions: Region[] = extractRegions("````md\n```\ninner\n```\n````\n");
        expect(regions).toHaveLength(1);
        expect(regions[0].lines).toHaveLength(5);
    });

    it("reads a tilde fence", () => {
        expect(kinds("~~~\ncode\n~~~\n")).toEqual(["fenced-block"]);
    });

    it("runs an unclosed fence to the end of the file rather than dropping it", () => {
        const regions: Region[] = extractRegions("```\ncode\nmore\n");
        expect(regions).toHaveLength(1);
        expect(regions[0].lines).toEqual(["```", "code", "more"]);
    });

    it("reads a single-line HTML comment", () => {
        const regions: Region[] = extractRegions("prose\n<!-- nexus:meta epic: 1 -->\n");
        expect(regions).toHaveLength(1);
        expect(regions[0].kind).toBe("html-comment");
        expect(regions[0].line).toBe(2);
    });

    it("reads a multi-line HTML comment as one region", () => {
        const regions: Region[] = extractRegions("a\n<!-- nexus:epic-meta\nslug: x\n-->\nb\n");
        expect(regions).toHaveLength(1);
        expect(regions[0].kind).toBe("html-comment");
        expect(regions[0].lines).toEqual(["<!-- nexus:epic-meta", "slug: x", "-->"]);
    });

    it("reads an emphasised acceptance-criteria line", () => {
        const regions: Region[] = extractRegions("- [ ] **Given** a draft, **when** it runs, **then** it passes.\n");
        expect(regions).toHaveLength(1);
        expect(regions[0].kind).toBe("criteria-line");
        expect(regions[0].line).toBe(1);
    });

    it("reads a plain acceptance-criteria line carrying all three keywords", () => {
        expect(kinds("Given a draft, when it runs, then it passes.\n")).toEqual(["criteria-line"]);
    });

    it("leaves ordinary prose that merely uses one keyword alone", () => {
        expect(kinds("Given the cost, the skill was retired.\n")).toEqual([]);
    });

    it("does not read a criteria line inside a fenced block as its own region", () => {
        expect(kinds("```\n- [ ] **Given** x, **when** y, **then** z\n```\n")).toEqual(["fenced-block"]);
    });

    it("does not read a criteria line inside frontmatter as its own region", () => {
        expect(kinds("---\nnote: Given x, when y, then z\n---\n")).toEqual(["frontmatter"]);
    });

    it("returns the regions in document order", () => {
        expect(kinds("---\na: 1\n---\n\n<!-- m -->\n\n```\nc\n```\n\n- **Given** a, **when** b, **then** c\n")).toEqual([
            "frontmatter",
            "html-comment",
            "fenced-block",
            "criteria-line",
        ]);
    });

    it("finds nothing in an empty body", () => {
        expect(kinds("")).toEqual([]);
    });

    it("finds nothing in a body that carries no machine-read region", () => {
        expect(kinds("# Title\n\nOrdinary prose only.\n")).toEqual([]);
    });
});
