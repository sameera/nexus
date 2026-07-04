import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildClusters, generateAtlas, loadConceptPages, renderAtlas } from "./generate-atlas";

const REPO_ROOT: string = path.resolve(__dirname, "..");

interface FixtureSpec {
    title: string;
    touches?: string[];
    status?: string;
    lead: string;
}

let tmpDirs: string[] = [];

function makeTmpDir(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "generate-atlas-"));
    tmpDirs.push(dir);
    return dir;
}

function writeConcept(conceptsDir: string, slug: string, spec: FixtureSpec): void {
    const touches: string[] = spec.touches ?? [];
    const status: string = spec.status ?? "active";
    const touchesYaml: string = touches.length > 0 ? `[${touches.map((t: string) => `"${t}"`).join(", ")}]` : "[]";
    const integrationBullets: string = touches.map((t: string) => `- [${t}](${t}.md) — interacts with ${t}.`).join("\n");
    const content: string = `---
title: "${spec.title}"
aliases: []
touches: ${touchesYaml}
last_updated_by: "bootstrap"
status: ${status}
verification: verified
---

# ${spec.title}

${spec.lead}

## How It Works

Some body prose.

## Key Invariants

1. Something holds.

## Integration Points

${integrationBullets}

## Decision Log

### 2026-07-04 — #1 — Seed
Why it exists.
`;
    fs.writeFileSync(path.join(conceptsDir, `${slug}.md`), content);
}

afterEach(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});

describe("loadConceptPages", () => {
    it("extracts the first sentence of a multi-sentence lead as the hook line", () => {
        const dir: string = makeTmpDir();
        writeConcept(dir, "alpha", {
            title: "Alpha",
            lead: "Alpha does one thing well. It also does a second thing. And a third.",
        });
        const pages = loadConceptPages(dir);
        expect(pages).toHaveLength(1);
        expect(pages[0].hook).toBe("Alpha does one thing well.");
    });

    it("extracts the first sentence when the lead opens with linked text", () => {
        const dir: string = makeTmpDir();
        writeConcept(dir, "alpha", {
            title: "Alpha",
            lead: "[Alpha](alpha.md) is the entry point for the store. It has more to say.",
        });
        const pages = loadConceptPages(dir);
        expect(pages[0].hook).toBe("[Alpha](alpha.md) is the entry point for the store.");
    });

    it("collapses a lead spanning multiple source lines into one hook line", () => {
        const dir: string = makeTmpDir();
        writeConcept(dir, "alpha", {
            title: "Alpha",
            lead: "Alpha spans\nmultiple lines\nin the source file. It keeps going after that.",
        });
        const pages = loadConceptPages(dir);
        expect(pages[0].hook).toBe("Alpha spans multiple lines in the source file.");
    });

    it("skips README.md", () => {
        const dir: string = makeTmpDir();
        writeConcept(dir, "alpha", { title: "Alpha", lead: "Alpha lead." });
        fs.writeFileSync(path.join(dir, "README.md"), "# Not a concept page\n");
        const pages = loadConceptPages(dir);
        expect(pages.map((p) => p.slug)).toEqual(["alpha"]);
    });

    it("skips pages under an _archive subdirectory", () => {
        const dir: string = makeTmpDir();
        writeConcept(dir, "alpha", { title: "Alpha", lead: "Alpha lead." });
        const archiveDir: string = path.join(dir, "_archive");
        fs.mkdirSync(archiveDir);
        writeConcept(archiveDir, "retired", { title: "Retired", lead: "Retired lead." });
        const pages = loadConceptPages(dir);
        expect(pages.map((p) => p.slug)).toEqual(["alpha"]);
    });

    it("skips pages with status: deprecated", () => {
        const dir: string = makeTmpDir();
        writeConcept(dir, "alpha", { title: "Alpha", lead: "Alpha lead." });
        writeConcept(dir, "gone", { title: "Gone", lead: "Gone lead.", status: "deprecated" });
        const pages = loadConceptPages(dir);
        expect(pages.map((p) => p.slug)).toEqual(["alpha"]);
    });
});

describe("buildClusters", () => {
    it("ignores a touches reference to a nonexistent or deprecated slug", () => {
        const dir: string = makeTmpDir();
        writeConcept(dir, "alpha", { title: "Alpha", lead: "Alpha lead.", touches: ["missing", "gone"] });
        writeConcept(dir, "gone", { title: "Gone", lead: "Gone lead.", status: "deprecated" });
        const pages = loadConceptPages(dir);
        const clusters = buildClusters(pages);
        expect(clusters).toHaveLength(1);
        expect(clusters[0].name).toBe("Standalone");
        expect(clusters[0].pages.map((p) => p.slug)).toEqual(["alpha"]);
    });

    it("groups two disjoint components into two clusters, named by highest-degree node, largest first", () => {
        const dir: string = makeTmpDir();
        // Component 1: hub touches two leaves (degree 2); size 3.
        writeConcept(dir, "hub", { title: "Hub", lead: "Hub lead.", touches: ["leaf-a", "leaf-b"] });
        writeConcept(dir, "leaf-a", { title: "Leaf A", lead: "Leaf A lead.", touches: ["hub"] });
        writeConcept(dir, "leaf-b", { title: "Leaf B", lead: "Leaf B lead.", touches: ["hub"] });
        // Component 2: pair, size 2.
        writeConcept(dir, "pair-a", { title: "Pair A", lead: "Pair A lead.", touches: ["pair-b"] });
        writeConcept(dir, "pair-b", { title: "Pair B", lead: "Pair B lead.", touches: ["pair-a"] });

        const pages = loadConceptPages(dir);
        const clusters = buildClusters(pages);

        expect(clusters).toHaveLength(2);
        expect(clusters[0].name).toBe("Hub");
        expect(clusters[0].pages.map((p) => p.slug)).toEqual(["hub", "leaf-a", "leaf-b"]);
        expect(clusters[1].pages.map((p) => p.slug).sort()).toEqual(["pair-a", "pair-b"]);
    });

    it("merges every size-1 component into one trailing Standalone cluster, sorted alphabetically", () => {
        const dir: string = makeTmpDir();
        writeConcept(dir, "hub", { title: "Hub", lead: "Hub lead.", touches: ["leaf"] });
        writeConcept(dir, "leaf", { title: "Leaf", lead: "Leaf lead.", touches: ["hub"] });
        writeConcept(dir, "zeta-solo", { title: "Zeta Solo", lead: "Zeta lead." });
        writeConcept(dir, "alpha-solo", { title: "Alpha Solo", lead: "Alpha lead." });

        const pages = loadConceptPages(dir);
        const clusters = buildClusters(pages);

        expect(clusters).toHaveLength(2);
        expect(clusters[clusters.length - 1].name).toBe("Standalone");
        expect(clusters[clusters.length - 1].pages.map((p) => p.slug)).toEqual(["alpha-solo", "zeta-solo"]);
    });
});

describe("renderAtlas / generateAtlas determinism", () => {
    it("produces byte-identical output across repeated runs over the same input", () => {
        const dir: string = makeTmpDir();
        writeConcept(dir, "hub", { title: "Hub", lead: "Hub lead.", touches: ["leaf"] });
        writeConcept(dir, "leaf", { title: "Leaf", lead: "Leaf lead.", touches: ["hub"] });
        writeConcept(dir, "solo", { title: "Solo", lead: "Solo lead." });

        const first: string = generateAtlas(dir);
        const second: string = generateAtlas(dir);
        expect(first).toBe(second);
        expect(first).toContain("DERIVED");
        expect(first).toContain("# Concept Atlas");
    });

    it("renders clusters and bullets in the documented format", () => {
        const pages = [
            { slug: "alpha", title: "Alpha", touches: [], hook: "Alpha does the thing." },
        ];
        const clusters = buildClusters(pages);
        const rendered: string = renderAtlas(clusters);
        expect(rendered).toContain("## Standalone");
        expect(rendered).toContain("- [Alpha](../.nexus/concepts/alpha.md) — Alpha does the thing.");
    });
});

describe("CLI", () => {
    function runCli(args: string[]): { status: number; stdout: string } {
        try {
            const stdout: string = execFileSync("npx", ["tsx", "utils/generate-atlas.ts", ...args], {
                cwd: REPO_ROOT,
                encoding: "utf8",
            });
            return { status: 0, stdout };
        } catch (error) {
            const err = error as { status: number; stdout: string };
            return { status: err.status, stdout: err.stdout };
        }
    }

    it("writes the atlas file and reports the concept count in default mode", () => {
        const conceptsDir: string = makeTmpDir();
        const outDir: string = makeTmpDir();
        const outPath: string = path.join(outDir, "concepts.md");
        writeConcept(conceptsDir, "alpha", { title: "Alpha", lead: "Alpha lead." });

        const result = runCli(["--concepts-dir", conceptsDir, "--out", outPath]);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain(`Atlas written: ${outPath} (1 concepts)`);
        expect(fs.existsSync(outPath)).toBe(true);
    });

    it("--check exits 0 and prints OK when the atlas is in sync", () => {
        const conceptsDir: string = makeTmpDir();
        const outDir: string = makeTmpDir();
        const outPath: string = path.join(outDir, "concepts.md");
        writeConcept(conceptsDir, "alpha", { title: "Alpha", lead: "Alpha lead." });

        runCli(["--concepts-dir", conceptsDir, "--out", outPath]);
        const result = runCli(["--concepts-dir", conceptsDir, "--out", outPath, "--check"]);

        expect(result.status).toBe(0);
        expect(result.stdout.trim()).toBe("OK");
    });

    it("--check exits 1 when the atlas is missing", () => {
        const conceptsDir: string = makeTmpDir();
        const outDir: string = makeTmpDir();
        const outPath: string = path.join(outDir, "concepts.md");
        writeConcept(conceptsDir, "alpha", { title: "Alpha", lead: "Alpha lead." });

        const result = runCli(["--concepts-dir", conceptsDir, "--out", outPath, "--check"]);

        expect(result.status).toBe(1);
    });

    it("--check exits 1 when the on-disk atlas no longer matches the source pages", () => {
        const conceptsDir: string = makeTmpDir();
        const outDir: string = makeTmpDir();
        const outPath: string = path.join(outDir, "concepts.md");
        writeConcept(conceptsDir, "alpha", { title: "Alpha", lead: "Alpha lead." });

        runCli(["--concepts-dir", conceptsDir, "--out", outPath]);
        writeConcept(conceptsDir, "beta", { title: "Beta", lead: "Beta lead." });
        const result = runCli(["--concepts-dir", conceptsDir, "--out", outPath, "--check"]);

        expect(result.status).toBe(1);
    });
});
