/**
 * Story #379 — the filed body carries the epic's content and nothing that rots.
 *
 * The corpus cases are the load-bearing ones: draft in, filed body out, compared byte-for-byte
 * against output recorded from the Python filer while it still runs. That recording is the only
 * form the success metric's evidence can survive in, since the implementation it compares against
 * is deleted one epic later.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { deriveFiledBody, parseDraft, rawFrontmatter } from "./document";

const CORPUS: string = path.join(import.meta.dirname, "corpus");

function corpusNames(): string[] {
    return fs
        .readdirSync(CORPUS)
        .filter((name) => name.endsWith(".md"))
        .sort();
}

describe("the derivation over the recorded corpus", () => {
    it("has a golden body for every draft, and a draft for every golden body", () => {
        expect(corpusNames()).toEqual(fs.readdirSync(path.join(CORPUS, "golden")).sort());
        expect(corpusNames().length).toBeGreaterThan(0);
    });

    for (const name of corpusNames()) {
        it(`derives ${name} byte-identically to the recorded output`, () => {
            const content: string = fs.readFileSync(path.join(CORPUS, name), "utf8");
            const golden: string = fs.readFileSync(path.join(CORPUS, "golden", name), "utf8");
            expect(deriveFiledBody(content)).toBe(golden);
        });
    }
});

describe("what the filed body drops", () => {
    const body: string = deriveFiledBody(fs.readFileSync(path.join(CORPUS, "pointers.md"), "utf8"));

    it("does not carry the draft's frontmatter as part of its prose", () => {
        // The raw frontmatter reaches the issue only inside the hidden meta block, never as text.
        const prose: string = body.slice(0, body.indexOf("<!-- nexus:epic-meta"));
        expect(prose.startsWith("---")).toBe(false);
        expect(prose).not.toContain("feature_path:");
    });

    it("drops a queue-path line wherever in the body it appeared", () => {
        expect(body).not.toContain(".nexus/queue/");
    });

    it("drops pointer preamble before the title but keeps a line of the same shape after it", () => {
        expect(body).not.toContain("**Feature:** Component Distribution");
        expect(body).toContain("Feature work continues below");
    });

    it("drops the user-stories section without letting its subsections terminate the removal", () => {
        expect(body).not.toContain("## User Stories");
        expect(body).not.toContain("### Story #1");
        expect(body).not.toContain("#### Acceptance Criteria");
        expect(body).toContain("## Assumptions");
        expect(body).toContain("- The section after the stories is kept intact.");
    });

    it("ends with a meta block carrying the raw frontmatter verbatim", () => {
        const content: string = fs.readFileSync(path.join(CORPUS, "pointers.md"), "utf8");
        expect(body.trimEnd().endsWith("-->")).toBe(true);
        expect(body).toContain(`<!-- nexus:epic-meta\n${rawFrontmatter(content)}\n-->`);
    });
});

describe("the issue stays re-resolvable from its number alone", () => {
    it("carries the draft's frontmatter back out of the meta block unchanged", () => {
        for (const name of corpusNames()) {
            const content: string = fs.readFileSync(path.join(CORPUS, name), "utf8");
            const golden: string = fs.readFileSync(path.join(CORPUS, "golden", name), "utf8");
            // The shape the resolver reads: the marker, then the raw frontmatter, verbatim.
            const carried: string | null = /<!--\s*nexus:epic-meta\b\s*\n([\s\S]*?)\n?-->/.exec(golden)?.[1] ?? null;
            const declared: string = rawFrontmatter(content);
            expect(carried ?? "").toBe(declared === "" ? "" : declared);
        }
    });
});

describe("a draft with nothing to strip", () => {
    it("yields its whole content as the body and gets no meta block, with no frontmatter", () => {
        const content = "# Epic: Bare\n\nJust prose.\n";
        expect(deriveFiledBody(content)).toBe(content);
    });

    it("is unchanged by the story step when it has no user-stories section", () => {
        const content: string = fs.readFileSync(path.join(CORPUS, "no-stories.md"), "utf8");
        const { body } = parseDraft(content);
        expect(deriveFiledBody(content)).toContain(body.trim());
    });
});

describe("the draft reader", () => {
    it("reads declared values with one layer of quotes trimmed and no type coercion", () => {
        const { frontmatter } = parseDraft('---\nepic: "A Title"\ncomplexity: M\nconcepts: []\n---\n\nBody\n');
        expect(frontmatter).toEqual({ epic: "A Title", complexity: "M", concepts: "[]" });
    });

    it("reads a draft with no frontmatter as its own untrimmed body", () => {
        expect(parseDraft("\n# Epic\n")).toEqual({ frontmatter: {}, body: "\n# Epic\n" });
    });
});

describe("a draft whose derived body is empty", () => {
    it("derives nothing at all, which is what the run refuses on", () => {
        expect(deriveFiledBody("   \n\n").trim()).toBe("");
    });

    it("still carries the meta block when the draft declared frontmatter", () => {
        // The emptiness test is applied to the derived body, meta block included, exactly as it is
        // today — which is why a draft with frontmatter and no prose is filed rather than refused.
        expect(deriveFiledBody('---\nepic: "Empty"\n---\n\n')).toContain("nexus:epic-meta");
    });
});
