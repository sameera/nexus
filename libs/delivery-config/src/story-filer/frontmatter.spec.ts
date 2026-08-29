/**
 * Story #367 — what a work item says, as the filer reads it.
 *
 * The reader is the shallow, line-oriented one the Python filer has always used (D8): a work item
 * that parses one way today parses the same way after the port, quirks included.
 */

import { describe, expect, it } from "vitest";
import { normalizeRef, parseFrontmatter, readWorkItem } from "./frontmatter";

const FULL = `---
ref: STORY-353.01
title: "Work items are discovered and parsed"
labels: [story, backlog]
blocked_by: [STORY-353.00]
parent: "#353"
project: "sameera/1"
---

The body of the work item.

More body.
`;

describe("reading a work item's frontmatter", () => {
    it("carries every declared key with its declared value", () => {
        const item = readWorkItem("STORY-353.01.md", FULL);
        expect(item.ref).toBe("353.01");
        expect(item.title).toBe("Work items are discovered and parsed");
        expect(item.labels).toEqual(["story", "backlog"]);
        expect(item.blockedBy).toEqual(["353.00"]);
        expect(item.parent).toBe("#353");
        expect(item.project).toBe("sameera/1");
    });

    it("hands GitHub the content after the frontmatter block, with no frontmatter in it", () => {
        const item = readWorkItem("STORY-353.01.md", FULL);
        expect(item.body).toBe("The body of the work item.\n\nMore body.");
        expect(item.body).not.toContain("ref:");
        expect(item.body).not.toContain("---");
    });

    it("reads a labels value written as a bare string as a one-item list", () => {
        const item = readWorkItem("STORY-1.md", `---\ntitle: One\nlabels: backlog\n---\n\nBody\n`);
        expect(item.labels).toEqual(["backlog"]);
    });

    it("reads an absent labels value as no labels", () => {
        expect(readWorkItem("STORY-1.md", `---\ntitle: One\n---\n\nBody\n`).labels).toEqual([]);
    });

    it("uses the filename stem as the ref when the work item declares none", () => {
        expect(readWorkItem("STORY-353.04.md", `---\ntitle: One\n---\n\nBody\n`).ref).toBe("353.04");
    });

    it("compares refs with the STORY- prefix dropped and case ignored", () => {
        expect(normalizeRef("STORY-353.01")).toBe("353.01");
        expect(normalizeRef("story-353.01")).toBe("353.01");
        expect(normalizeRef("  353.01  ")).toBe("353.01");
        expect(normalizeRef("STORY-ABC")).toBe("abc");
    });

    it("carries no blockers when blocked_by is declared none, or absent", () => {
        expect(readWorkItem("STORY-1.md", `---\ntitle: t\nblocked_by: none\n---\n\nB\n`).blockedBy).toEqual([]);
        expect(readWorkItem("STORY-1.md", `---\ntitle: t\nblocked_by: None\n---\n\nB\n`).blockedBy).toEqual([]);
        expect(readWorkItem("STORY-1.md", `---\ntitle: t\n---\n\nB\n`).blockedBy).toEqual([]);
        expect(readWorkItem("STORY-1.md", `---\ntitle: t\nblocked_by: [none]\n---\n\nB\n`).blockedBy).toEqual([]);
    });

    it("reads a blocked_by written as one bare ref as a one-item list", () => {
        expect(readWorkItem("STORY-1.md", `---\ntitle: t\nblocked_by: STORY-2\n---\n\nB\n`).blockedBy).toEqual(["2"]);
    });

    it("keeps a document with no frontmatter block whole, as its own body", () => {
        const { frontmatter, body } = parseFrontmatter("No frontmatter here.\n");
        expect(frontmatter).toEqual({});
        expect(body).toBe("No frontmatter here.\n");
    });

    it("trims one layer of surrounding quotes from a declared value", () => {
        const { frontmatter } = parseFrontmatter(`---\ntitle: "Quoted"\nparent: '#7'\n---\n\nB\n`);
        expect(frontmatter["title"]).toBe("Quoted");
        expect(frontmatter["parent"]).toBe("#7");
    });
});
