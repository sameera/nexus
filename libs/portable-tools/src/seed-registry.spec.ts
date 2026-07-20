import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAdjacency, type ConceptPage } from "./generate-atlas";
import {
    assembleDomains,
    buildSeedDraft,
    DRAFT_REGISTRY_FILENAME,
    DRAFT_SUGGESTIONS_FILENAME,
    pageSuggestions,
    parseArgs,
    renderDraftRegistry,
    renderFilingSuggestions,
    runCli,
    shouldGroupCommunities,
    type SeedDraft,
} from "./seed-registry";

function pg(slug: string, touches: string[] = []): ConceptPage {
    // Seed mode runs on a store with NO registry, so pages carry no `domain:` (Invariant 12).
    return { slug, title: slug[0].toUpperCase() + slug.slice(1), touches, hook: `${slug} hook.`, domain: "" };
}

let tmpDirs: string[] = [];

function makeTmpDir(prefix: string): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmpDirs.push(dir);
    return dir;
}

afterEach(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});

/** Writes a valid, registry-free concept page — the state seed mode is designed to read. */
function writeConceptFile(conceptsDir: string, slug: string, touches: string[] = []): void {
    const touchesYaml: string = touches.length > 0 ? `[${touches.map((t) => `"${t}"`).join(", ")}]` : "[]";
    const content = `---
title: "${slug}"
aliases: []
touches: ${touchesYaml}
last_updated_by: "bootstrap"
status: active
verification: verified
---

# ${slug}

${slug} hook line.

## How It Works

Body prose.

## Key Invariants

## Integration Points

## Decision Log

### 2026-07-04 — #1 — Seed
Why it exists.
`;
    fs.writeFileSync(path.join(conceptsDir, `${slug}.md`), content);
}

/** Two disjoint triangles + one isolated page — a store detectCommunities partitions predictably. */
function twoTrianglesPlusLoner(): ConceptPage[] {
    return [
        pg("xa", ["xb", "xc"]),
        pg("xb", ["xa", "xc"]),
        pg("xc", ["xa", "xb"]),
        pg("ya", ["yb", "yc"]),
        pg("yb", ["ya", "yc"]),
        pg("yc", ["ya", "yb"]),
        pg("lone"),
    ];
}

// ---------------------------------------------------------------------------------------------
// AC1 — draft registry (candidate domains from communities) + per-page filing suggestions
// ---------------------------------------------------------------------------------------------
describe("AC1 — candidate domains and per-page suggestions from link communities", () => {
    it("turns each qualifying link community into a candidate domain and lists sub-threshold pages as ungrouped", () => {
        const draft: SeedDraft = buildSeedDraft(twoTrianglesPlusLoner());

        expect(draft.domains).toHaveLength(2);
        expect(draft.domains[0].slug).toBe("candidate-domain-1");
        expect(draft.domains[0].members).toEqual(["xa", "xb", "xc"]);
        expect(draft.domains[0].subdomains).toEqual([]);
        expect(draft.domains[1].slug).toBe("candidate-domain-2");
        expect(draft.domains[1].members).toEqual(["ya", "yb", "yc"]);
        expect(draft.ungrouped).toEqual(["lone"]);
    });

    it("renders a draft registry in the registry's own grammar (H2 domain, backticked slug)", () => {
        const rendered: string = renderDraftRegistry(buildSeedDraft(twoTrianglesPlusLoner()));
        expect(rendered).toContain("## Candidate Domain 1");
        expect(rendered).toContain("`candidate-domain-1`");
        expect(rendered).toContain("## Candidate Domain 2");
        // The detected member pages are surfaced as evidence for the curator to name/scope the domain.
        expect(rendered).toContain("`xa`");
    });

    it("renders a per-page suggestion for every grouped page and an ungrouped section for the rest", () => {
        const draft: SeedDraft = buildSeedDraft(twoTrianglesPlusLoner());
        const suggestions = pageSuggestions(draft);
        expect(suggestions).toContainEqual({ slug: "xa", path: "candidate-domain-1" });
        expect(suggestions).toContainEqual({ slug: "ya", path: "candidate-domain-2" });
        expect(suggestions.some((s) => s.slug === "lone")).toBe(false);

        const rendered: string = renderFilingSuggestions(draft);
        expect(rendered).toContain("`xa` → `candidate-domain-1`");
        expect(rendered).toContain("Ungrouped");
        expect(rendered).toContain("`lone`");
    });

    it("runCli writes both draft files and touches no page, no registry, and no atlas", () => {
        const dir: string = makeTmpDir("seed-cli-");
        const conceptsDir: string = path.join(dir, "concepts");
        const outDir: string = path.join(dir, "docs");
        fs.mkdirSync(conceptsDir);
        for (const [slug, touches] of [
            ["xa", ["xb", "xc"]],
            ["xb", ["xa", "xc"]],
            ["xc", ["xa", "xb"]],
        ] as [string, string[]][]) {
            writeConceptFile(conceptsDir, slug, touches);
        }
        const before: string = fs.readFileSync(path.join(conceptsDir, "xa.md"), "utf8");

        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const exit: number = runCli(["--concepts-dir", conceptsDir, "--out-dir", outDir]);
        logSpy.mockRestore();

        expect(exit).toBe(0);
        // Both drafts written under the out dir.
        expect(fs.existsSync(path.join(outDir, DRAFT_REGISTRY_FILENAME))).toBe(true);
        expect(fs.existsSync(path.join(outDir, DRAFT_SUGGESTIONS_FILENAME))).toBe(true);
        // The registry location, the atlas, and every concept page are untouched (Invariant 12).
        expect(fs.existsSync(path.join(outDir, "domains.md"))).toBe(false);
        expect(fs.existsSync(path.join(outDir, "concepts.md"))).toBe(false);
        expect(fs.readFileSync(path.join(conceptsDir, "xa.md"), "utf8")).toBe(before);
    });
});

// ---------------------------------------------------------------------------------------------
// AC1 (two-level) — candidate parent groupings where cross-community density rivals internal
// ---------------------------------------------------------------------------------------------
describe("AC1 — candidate parent groupings (two-level draft)", () => {
    // Two 3-page communities, each internally sparse (one edge, density 1/3), cross-linked at the
    // same 1/3 density — cross rivals internal, so they belong under one parent domain.
    const RIVAL_ADJ = (): Map<string, Set<string>> =>
        buildAdjacency([
            pg("a1", ["a2", "b1"]),
            pg("a2", ["a1", "b2"]),
            pg("a3", ["b3"]),
            pg("b1", ["b2", "a1"]),
            pg("b2", ["b1", "a2"]),
            pg("b3", ["a3"]),
        ]);

    it("groups two communities whose cross-density rivals internal density under one parent", () => {
        const adjacency = RIVAL_ADJ();
        const grouped: boolean = shouldGroupCommunities(adjacency, ["a1", "a2", "a3"], ["b1", "b2", "b3"]);
        expect(grouped).toBe(true);

        const domains = assembleDomains(adjacency, [
            ["a1", "a2", "a3"],
            ["b1", "b2", "b3"],
        ]);
        expect(domains).toHaveLength(1);
        expect(domains[0].slug).toBe("candidate-domain-1");
        expect(domains[0].members).toEqual([]);
        expect(domains[0].subdomains).toHaveLength(2);
        expect(domains[0].subdomains[0].slug).toBe("subdomain-1");
        expect(domains[0].subdomains[0].members).toEqual(["a1", "a2", "a3"]);
        expect(domains[0].subdomains[1].members).toEqual(["b1", "b2", "b3"]);

        const rendered: string = renderDraftRegistry({ domains, ungrouped: [] });
        expect(rendered).toContain("## Candidate Domain 1");
        expect(rendered).toContain("### Candidate Subdomain 1.1");
        expect(rendered).toContain("`subdomain-1`");

        // Per-page suggestions carry the full two-level path.
        expect(pageSuggestions({ domains, ungrouped: [] })).toContainEqual({
            slug: "a1",
            path: "candidate-domain-1/subdomain-1",
        });
    });

    it("does not group two communities linked below their internal density", () => {
        const adjacency = buildAdjacency([
            pg("a1", ["a2", "a3", "b1"]),
            pg("a2", ["a1", "a3"]),
            pg("a3", ["a1", "a2"]),
            pg("b1", ["b2", "b3", "a1"]),
            pg("b2", ["b1", "b3"]),
            pg("b3", ["b1", "b2"]),
        ]);
        // Two triangles (internal density 1) bridged by a single edge (cross density 1/9).
        expect(shouldGroupCommunities(adjacency, ["a1", "a2", "a3"], ["b1", "b2", "b3"])).toBe(false);

        const domains = assembleDomains(adjacency, [
            ["a1", "a2", "a3"],
            ["b1", "b2", "b3"],
        ]);
        expect(domains).toHaveLength(2);
        expect(domains[0].subdomains).toEqual([]);
        expect(domains[1].subdomains).toEqual([]);
    });

    it("groups on either community's internal density (rivals the sparser side)", () => {
        // A is a dense triangle (density 1), B is sparse (one edge, density 1/3); the cross links
        // rival B's density but not A's — the OR still groups them.
        const adjacency = buildAdjacency([
            pg("a1", ["a2", "a3", "b1"]),
            pg("a2", ["a1", "a3", "b2"]),
            pg("a3", ["a1", "a2", "b3"]),
            pg("b1", ["b2", "a1"]),
            pg("b2", ["b1", "a2"]),
            pg("b3", ["a3"]),
        ]);
        expect(shouldGroupCommunities(adjacency, ["a1", "a2", "a3"], ["b1", "b2", "b3"])).toBe(true);
    });

    it("never groups communities with no cross links", () => {
        const adjacency = buildAdjacency([
            pg("a1", ["a2", "a3"]),
            pg("a2", ["a1", "a3"]),
            pg("a3", ["a1", "a2"]),
            pg("b1", ["b2", "b3"]),
            pg("b2", ["b1", "b3"]),
            pg("b3", ["b1", "b2"]),
        ]);
        expect(shouldGroupCommunities(adjacency, ["a1", "a2", "a3"], ["b1", "b2", "b3"])).toBe(false);
    });
});

// ---------------------------------------------------------------------------------------------
// AC2 — byte-identical on repeat runs
// ---------------------------------------------------------------------------------------------
describe("AC2 — deterministic, byte-identical drafts on repeat runs", () => {
    it("renderDraftRegistry / renderFilingSuggestions are byte-identical across repeated calls", () => {
        const pages: ConceptPage[] = twoTrianglesPlusLoner();
        expect(renderDraftRegistry(buildSeedDraft(pages))).toBe(renderDraftRegistry(buildSeedDraft(pages)));
        expect(renderFilingSuggestions(buildSeedDraft(pages))).toBe(renderFilingSuggestions(buildSeedDraft(pages)));
    });

    it("runCli writes byte-identical files on a second run over an unchanged store", () => {
        const dir: string = makeTmpDir("seed-det-");
        const conceptsDir: string = path.join(dir, "concepts");
        fs.mkdirSync(conceptsDir);
        for (const [slug, touches] of [
            ["xa", ["xb", "xc"]],
            ["xb", ["xa", "xc"]],
            ["xc", ["xa", "xb"]],
            ["lone", []],
        ] as [string, string[]][]) {
            writeConceptFile(conceptsDir, slug, touches);
        }
        const outA: string = path.join(dir, "a");
        const outB: string = path.join(dir, "b");

        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        runCli(["--concepts-dir", conceptsDir, "--out-dir", outA]);
        runCli(["--concepts-dir", conceptsDir, "--out-dir", outB]);
        logSpy.mockRestore();

        for (const name of [DRAFT_REGISTRY_FILENAME, DRAFT_SUGGESTIONS_FILENAME]) {
            expect(fs.readFileSync(path.join(outA, name), "utf8")).toBe(fs.readFileSync(path.join(outB, name), "utf8"));
        }
    });
});

// ---------------------------------------------------------------------------------------------
// AC3 — explicitly marked as a draft requiring human curation before commit
// ---------------------------------------------------------------------------------------------
describe("AC3 — both drafts are explicitly marked draft-requiring-curation", () => {
    it("the draft registry and the suggestions both announce DRAFT and human curation before commit", () => {
        const draft: SeedDraft = buildSeedDraft(twoTrianglesPlusLoner());
        for (const rendered of [renderDraftRegistry(draft), renderFilingSuggestions(draft)]) {
            expect(rendered).toContain("DRAFT");
            expect(rendered.toLowerCase()).toContain("curation");
            expect(rendered.toLowerCase()).toContain("before commit");
        }
    });
});

// ---------------------------------------------------------------------------------------------
// Precondition — seed mode is for a store with NO registry
// ---------------------------------------------------------------------------------------------
describe("precondition — refuses when a registry already exists", () => {
    it("returns non-zero, writes no draft, when a domains.md already exists at the out dir", () => {
        const dir: string = makeTmpDir("seed-existing-");
        const conceptsDir: string = path.join(dir, "concepts");
        const outDir: string = path.join(dir, "docs");
        fs.mkdirSync(conceptsDir);
        fs.mkdirSync(outDir);
        fs.writeFileSync(path.join(outDir, "domains.md"), "## Existing\n`existing`\n\nA rubric.\n");
        writeConceptFile(conceptsDir, "xa", ["xb", "xc"]);

        const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const exit: number = runCli(["--concepts-dir", conceptsDir, "--out-dir", outDir]);
        errSpy.mockRestore();

        expect(exit).not.toBe(0);
        expect(fs.existsSync(path.join(outDir, DRAFT_REGISTRY_FILENAME))).toBe(false);
    });
});

// ---------------------------------------------------------------------------------------------
// Edge cases + engine reuse + coverage
// ---------------------------------------------------------------------------------------------
describe("edge cases and shared-engine reuse", () => {
    it("an empty store yields a draft with no domains and no ungrouped pages, still writing files", () => {
        const draft: SeedDraft = buildSeedDraft([]);
        expect(draft.domains).toEqual([]);
        expect(draft.ungrouped).toEqual([]);

        const rendered: string = renderDraftRegistry(draft);
        expect(rendered).toContain("DRAFT");
        // A store with no detectable communities is stated explicitly, not rendered as a blank file.
        expect(rendered.toLowerCase()).toContain("no ");

        const dir: string = makeTmpDir("seed-empty-");
        const conceptsDir: string = path.join(dir, "concepts");
        const outDir: string = path.join(dir, "docs");
        fs.mkdirSync(conceptsDir);
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const exit: number = runCli(["--concepts-dir", conceptsDir, "--out-dir", outDir]);
        logSpy.mockRestore();
        expect(exit).toBe(0);
        expect(fs.existsSync(path.join(outDir, DRAFT_REGISTRY_FILENAME))).toBe(true);
    });

    it("a store whose only communities are below the member threshold lists every page ungrouped", () => {
        // A single 2-page community (below MIN_COMMUNITY_MEMBERS) — no candidate domain.
        const draft: SeedDraft = buildSeedDraft([pg("pa", ["pb"]), pg("pb", ["pa"])]);
        expect(draft.domains).toEqual([]);
        expect(draft.ungrouped).toEqual(["pa", "pb"]);

        const rendered: string = renderFilingSuggestions(draft);
        expect(rendered).toContain("Ungrouped");
        expect(rendered).toContain("`pa`");
    });

    it("uses the shared detectCommunities engine: a 3-clique is one candidate domain", () => {
        const draft: SeedDraft = buildSeedDraft([
            pg("a", ["b", "c"]),
            pg("b", ["a", "c"]),
            pg("c", ["a", "b"]),
        ]);
        expect(draft.domains).toHaveLength(1);
        expect(draft.domains[0].members).toEqual(["a", "b", "c"]);
    });

    it("parseArgs parses --concepts-dir and --out-dir, defaulting the concepts dir", () => {
        expect(parseArgs([])).toEqual({ conceptsDir: ".nexus/concepts", outDir: undefined });
        expect(parseArgs(["--concepts-dir", "foo", "--out-dir", "bar/docs"])).toEqual({
            conceptsDir: "foo",
            outDir: "bar/docs",
        });
    });

    it("runCli never throws over a nonexistent concepts dir", () => {
        const dir: string = makeTmpDir("seed-nodir-");
        const outDir: string = path.join(dir, "docs");
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        expect(() => runCli(["--concepts-dir", path.join(dir, "no-such"), "--out-dir", outDir])).not.toThrow();
        logSpy.mockRestore();
    });
});
