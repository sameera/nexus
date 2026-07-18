import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
    buildClusters,
    generateAtlas,
    loadConceptPages,
    parseArgs,
    parseFrontmatter,
    renderAtlas,
    runCli,
} from "./generate-atlas";

const REPO_ROOT: string = path.resolve(__dirname, "../../..");

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
    const content = `---
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

    it("returns an empty list when the concepts directory doesn't exist", () => {
        const dir: string = makeTmpDir();
        expect(loadConceptPages(path.join(dir, "missing"))).toEqual([]);
    });

    it("skips a page with no frontmatter block at all", () => {
        const dir: string = makeTmpDir();
        fs.writeFileSync(path.join(dir, "alpha.md"), "# Alpha\n\nNo frontmatter here.\n");
        expect(loadConceptPages(dir)).toEqual([]);
    });

    it("skips a page whose frontmatter is never terminated", () => {
        const dir: string = makeTmpDir();
        fs.writeFileSync(path.join(dir, "alpha.md"), "---\ntitle: Alpha\n# never closed\n");
        expect(loadConceptPages(dir)).toEqual([]);
    });

    it("gives an empty hook when the body has no H1", () => {
        const dir: string = makeTmpDir();
        const content = `---
title: "Alpha"
aliases: []
touches: []
last_updated_by: "bootstrap"
status: active
verification: verified
---

No H1 here, just prose.
`;
        fs.writeFileSync(path.join(dir, "alpha.md"), content);
        const pages = loadConceptPages(dir);
        expect(pages[0].hook).toBe("");
    });
});

describe("parseFrontmatter", () => {
    it("ignores a frontmatter line that isn't shaped like key: value", () => {
        const fm = parseFrontmatter(["---", "not a valid line", "title: Alpha", "---", ""]);
        expect(fm?.fields.get("title")).toBe("Alpha");
    });

    it("parses a block list field", () => {
        const fm = parseFrontmatter(["---", "aliases:", "  - one", "  - two", "---", ""]);
        expect(fm?.fields.get("aliases")).toEqual(["one", "two"]);
    });

    it("returns null when the block is never terminated", () => {
        expect(parseFrontmatter(["---", "title: Alpha"])).toBeNull();
    });
});

describe("parseArgs", () => {
    it("defaults to .nexus/concepts, no --out (resolver-derived), and check: false", () => {
        expect(parseArgs([])).toEqual({ conceptsDir: ".nexus/concepts", out: undefined, check: false });
    });

    it("parses --concepts-dir, --out, and --check", () => {
        const options = parseArgs(["--concepts-dir", "a", "--out", "b", "--check"]);
        expect(options).toEqual({ conceptsDir: "a", out: "b", check: true });
    });
});

describe("runCli", () => {
    it("writes the atlas and returns 0", () => {
        const conceptsDir: string = makeTmpDir();
        const outPath: string = path.join(makeTmpDir(), "concepts.md");
        writeConcept(conceptsDir, "alpha", { title: "Alpha", lead: "Alpha lead." });

        const status = runCli(["--concepts-dir", conceptsDir, "--out", outPath]);

        expect(status).toBe(0);
        expect(fs.existsSync(outPath)).toBe(true);
    });

    it("--check returns 1 when the atlas is missing", () => {
        const conceptsDir: string = makeTmpDir();
        const outPath: string = path.join(makeTmpDir(), "concepts.md");
        writeConcept(conceptsDir, "alpha", { title: "Alpha", lead: "Alpha lead." });

        expect(runCli(["--concepts-dir", conceptsDir, "--out", outPath, "--check"])).toBe(1);
    });

    it("--check returns 0 when the atlas is in sync", () => {
        const conceptsDir: string = makeTmpDir();
        const outPath: string = path.join(makeTmpDir(), "concepts.md");
        writeConcept(conceptsDir, "alpha", { title: "Alpha", lead: "Alpha lead." });

        runCli(["--concepts-dir", conceptsDir, "--out", outPath]);
        expect(runCli(["--concepts-dir", conceptsDir, "--out", outPath, "--check"])).toBe(0);
    });

    it("--check returns 1 when the on-disk atlas no longer matches the source pages", () => {
        const conceptsDir: string = makeTmpDir();
        const outPath: string = path.join(makeTmpDir(), "concepts.md");
        writeConcept(conceptsDir, "alpha", { title: "Alpha", lead: "Alpha lead." });

        runCli(["--concepts-dir", conceptsDir, "--out", outPath]);
        writeConcept(conceptsDir, "beta", { title: "Beta", lead: "Beta lead." });
        expect(runCli(["--concepts-dir", conceptsDir, "--out", outPath, "--check"])).toBe(1);
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
        // Invariant 4: environment-neutral header — names no toolchain-specific path or command.
        expect(first).not.toContain("utils/");
        expect(first).not.toContain("pnpm");
    });

    it("renders clusters and bullets in the documented format", () => {
        const pages = [
            { slug: "alpha", title: "Alpha", touches: [], hook: "Alpha does the thing." },
        ];
        const clusters = buildClusters(pages);
        const rendered: string = renderAtlas(clusters, "../.nexus/concepts/");
        expect(rendered).toContain("## Standalone");
        expect(rendered).toContain("- [Alpha](../.nexus/concepts/alpha.md) — Alpha does the thing.");
    });

    it("computes the link prefix for a repo-root atlas one level shallower", () => {
        const pages = [
            { slug: "alpha", title: "Alpha", touches: [], hook: "Alpha does the thing." },
        ];
        const clusters = buildClusters(pages);
        const rendered: string = renderAtlas(clusters, ".nexus/concepts/");
        expect(rendered).toContain("- [Alpha](.nexus/concepts/alpha.md) — Alpha does the thing.");
    });
});

describe("CLI", () => {
    function runCli(args: string[]): { status: number; stdout: string; stderr: string } {
        try {
            const stdout: string = execFileSync("npx", ["tsx", "libs/portable-tools/src/generate-atlas.ts", ...args], {
                cwd: REPO_ROOT,
                encoding: "utf8",
            });
            return { status: 0, stdout, stderr: "" };
        } catch (error) {
            const err = error as { status: number; stdout: string; stderr: string };
            return { status: err.status, stdout: err.stdout, stderr: err.stderr };
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
        // Invariant 4: the --check stderr hint names no toolchain-specific command or path.
        expect(result.stderr).not.toContain("pnpm");
        expect(result.stderr).not.toContain("utils/");
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
        expect(result.stderr).not.toContain("pnpm");
        expect(result.stderr).not.toContain("utils/");
    });
});

// --- resolver-derived default output (epic #74, STORY-74.02) ----------------

describe("runCli — resolver-derived default output (no --out)", () => {
    let originalCwd: string;

    afterEach(() => {
        if (originalCwd) {
            process.chdir(originalCwd);
        }
    });

    function chdirTmp(): string {
        originalCwd = process.cwd();
        const dir = makeTmpDir();
        process.chdir(dir);
        return dir;
    }

    it("defaults to docs/concepts.md in single-repo mode, byte-identical to the pre-epic default", () => {
        const repo = chdirTmp();
        const conceptsDir = path.join(repo, ".nexus", "concepts");
        fs.mkdirSync(conceptsDir, { recursive: true });
        writeConcept(conceptsDir, "alpha", { title: "Alpha", lead: "Alpha lead." });

        const status = runCli([]);

        expect(status).toBe(0);
        const outPath = path.join(repo, "docs", "concepts.md");
        expect(fs.existsSync(outPath)).toBe(true);
        const atlas = fs.readFileSync(outPath, "utf8");
        expect(atlas).toContain("- [Alpha](../.nexus/concepts/alpha.md) — Alpha lead.");
    });

    it("defaults to concepts.md at the repo root for a hub with no docs-root override, no docs/ created", () => {
        const hub = chdirTmp();
        fs.mkdirSync(path.join(hub, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(
            path.join(hub, ".nexus", "config", "workspace.yml"),
            "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\nmembers: []\n",
        );
        const conceptsDir = path.join(hub, ".nexus", "concepts");
        fs.mkdirSync(conceptsDir, { recursive: true });
        writeConcept(conceptsDir, "alpha", { title: "Alpha", lead: "Alpha lead." });

        const status = runCli([]);

        expect(status).toBe(0);
        const outPath = path.join(hub, "concepts.md");
        expect(fs.existsSync(outPath)).toBe(true);
        expect(fs.existsSync(path.join(hub, "docs"))).toBe(false);
        const atlas = fs.readFileSync(outPath, "utf8");
        expect(atlas).toContain("- [Alpha](.nexus/concepts/alpha.md) — Alpha lead.");
    });

    it("defaults to <override>/concepts.md for a hub with an explicit docs-root override", () => {
        const hub = chdirTmp();
        fs.mkdirSync(path.join(hub, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(
            path.join(hub, ".nexus", "config", "workspace.yml"),
            "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\n  docs-root: handbook\nmembers: []\n",
        );
        const conceptsDir = path.join(hub, ".nexus", "concepts");
        fs.mkdirSync(conceptsDir, { recursive: true });
        writeConcept(conceptsDir, "alpha", { title: "Alpha", lead: "Alpha lead." });

        const status = runCli([]);

        expect(status).toBe(0);
        const outPath = path.join(hub, "handbook", "concepts.md");
        expect(fs.existsSync(outPath)).toBe(true);
        const atlas = fs.readFileSync(outPath, "utf8");
        expect(atlas).toContain("- [Alpha](../.nexus/concepts/alpha.md) — Alpha lead.");
    });

    it("an explicit --out always wins over the resolver-derived default", () => {
        const hub = chdirTmp();
        fs.mkdirSync(path.join(hub, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(
            path.join(hub, ".nexus", "config", "workspace.yml"),
            "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\nmembers: []\n",
        );
        const conceptsDir = path.join(hub, ".nexus", "concepts");
        fs.mkdirSync(conceptsDir, { recursive: true });
        writeConcept(conceptsDir, "alpha", { title: "Alpha", lead: "Alpha lead." });

        const status = runCli(["--out", "custom/atlas.md"]);

        expect(status).toBe(0);
        expect(fs.existsSync(path.join(hub, "custom", "atlas.md"))).toBe(true);
        expect(fs.existsSync(path.join(hub, "concepts.md"))).toBe(false);
    });

    it("--check resolves the identical default location write mode used", () => {
        const hub = chdirTmp();
        fs.mkdirSync(path.join(hub, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(
            path.join(hub, ".nexus", "config", "workspace.yml"),
            "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\nmembers: []\n",
        );
        const conceptsDir = path.join(hub, ".nexus", "concepts");
        fs.mkdirSync(conceptsDir, { recursive: true });
        writeConcept(conceptsDir, "alpha", { title: "Alpha", lead: "Alpha lead." });

        expect(runCli([])).toBe(0);
        expect(runCli(["--check"])).toBe(0);
    });
});
