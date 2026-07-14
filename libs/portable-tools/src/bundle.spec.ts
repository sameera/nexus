import { execFileSync } from "node:child_process";
import { builtinModules } from "node:module";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildBundle, type BuiltBundle } from "./bundle";
import { generateAtlas } from "./generate-atlas";

const REPO_ROOT: string = path.resolve(__dirname, "../../..");
const SRC_DIR: string = __dirname;
const TSX_BIN: string = path.join(REPO_ROOT, "node_modules", ".bin", "tsx");
const GENERATE_ATLAS_SRC: string = path.join(SRC_DIR, "generate-atlas.ts");
const VALIDATE_CONCEPTS_SRC: string = path.join(SRC_DIR, "validate-concepts.ts");

let atlasBundle: BuiltBundle;
let validatorBundle: BuiltBundle;

beforeAll(async () => {
    atlasBundle = await buildBundle(GENERATE_ATLAS_SRC);
    validatorBundle = await buildBundle(VALIDATE_CONCEPTS_SRC);
});

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

interface ConceptSpec {
    title: string;
    touches?: string[];
    lead?: string;
}

function writeConcept(conceptsDir: string, slug: string, spec: ConceptSpec): void {
    const touches: string[] = spec.touches ?? [];
    const touchesYaml: string = touches.length > 0 ? `[${touches.map((t) => `"${t}"`).join(", ")}]` : "[]";
    const integrationBullets: string = touches.map((t) => `- [${t}](${t}.md) — interacts with ${t}.`).join("\n");
    const content = `---
title: "${spec.title}"
aliases: []
touches: ${touchesYaml}
last_updated_by: "bootstrap"
status: active
verification: verified
---

# ${spec.title}

${spec.lead ?? `${spec.title} does the thing.`}

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

function writeValidatorPage(conceptsDir: string, slug: string, title: string, extraLog?: string): string {
    const content = `---
title: "${title}"
aliases: []
touches: []
last_updated_by: "bootstrap"
status: active
verification: verified
---

# ${title}

${title} does the thing well.

## How It Works

Behaves predictably.

## Key Invariants

1. Never breaks.

## Integration Points

## Decision Log

### 2026-07-04 — #1 — Seed
Why it exists.
${extraLog ?? ""}`;
    const file: string = path.join(conceptsDir, `${slug}.md`);
    fs.writeFileSync(file, content);
    return file;
}

function isBuiltinSpecifier(spec: string): boolean {
    const bare: string = spec.startsWith("node:") ? spec.slice("node:".length) : spec;
    return builtinModules.includes(bare);
}

describe("bundle self-containment (AC3 / Invariant 5)", () => {
    it.each([
        ["generate-atlas", () => atlasBundle],
        ["validate-concepts", () => validatorBundle],
    ])("the %s bundle's only external imports are Node builtins", (_name, getBundle) => {
        const { metafile } = getBundle();
        const outputs = Object.values(metafile.outputs);
        expect(outputs).toHaveLength(1);
        const [output] = outputs;
        expect(output.imports.length).toBeGreaterThan(0);
        for (const imp of output.imports) {
            expect(imp.external).toBe(true);
            expect(isBuiltinSpecifier(imp.path)).toBe(true);
        }
    });

    it.each([
        ["generate-atlas", () => atlasBundle],
        ["validate-concepts", () => validatorBundle],
    ])("the %s bundle's source has no bare non-builtin import specifier", (_name, getBundle) => {
        const { code } = getBundle();
        const specifiers: string[] = [...code.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
        for (const spec of specifiers) {
            const isRelativeOrAbsolute: boolean = spec.startsWith(".") || spec.startsWith("/");
            expect(isRelativeOrAbsolute || isBuiltinSpecifier(spec)).toBe(true);
        }
    });
});

describe("bundle entry guard (Invariant 6)", () => {
    it("does not execute main() when the atlas bundle is imported", () => {
        const dir = makeTmpDir("portable-tools-import-");
        const bundlePath = path.join(dir, "generate-atlas.mjs");
        fs.writeFileSync(bundlePath, atlasBundle.code);
        execFileSync("node", ["--input-type=module", "-e",
            `import(${JSON.stringify(pathToFileURL(bundlePath).href)}).then(()=>console.log("imported-ok"));`,
        ], { cwd: dir, encoding: "utf8" });
        expect(fs.existsSync(path.join(dir, "docs"))).toBe(false);
    });

    it("executes main() when the atlas bundle is launched via plain node", () => {
        const dir = makeTmpDir("portable-tools-run-");
        const bundlePath = path.join(dir, "generate-atlas.mjs");
        fs.writeFileSync(bundlePath, atlasBundle.code);
        const conceptsDir = makeTmpDir("portable-tools-fixture-");
        writeConcept(conceptsDir, "alpha", { title: "Alpha" });
        const outPath = path.join(dir, "out", "concepts.md");
        execFileSync("node", [bundlePath, "--concepts-dir", conceptsDir, "--out", outPath], { cwd: dir });
        expect(fs.existsSync(outPath)).toBe(true);
    });
});

describe("AC1 — atlas bundle parity", () => {
    it("the built atlas bundle, run via plain node outside the repo, matches the in-repo generator byte-for-byte", () => {
        const conceptsDir = makeTmpDir("portable-tools-fixture-");
        writeConcept(conceptsDir, "hub", { title: "Hub", touches: ["leaf-a", "leaf-b"] });
        writeConcept(conceptsDir, "leaf-a", { title: "Leaf A", touches: ["hub"] });
        writeConcept(conceptsDir, "leaf-b", { title: "Leaf B", touches: ["hub"] });
        writeConcept(conceptsDir, "pair-a", { title: "Pair A", touches: ["pair-b"] });
        writeConcept(conceptsDir, "pair-b", { title: "Pair B", touches: ["pair-a"] });
        writeConcept(conceptsDir, "solo", { title: "Solo" });

        const fromSource: string = generateAtlas(conceptsDir);

        const outsideDir = makeTmpDir("portable-tools-outside-");
        const bundlePath = path.join(outsideDir, "generate-atlas.mjs");
        fs.writeFileSync(bundlePath, atlasBundle.code);
        const outPath = path.join(outsideDir, "out", "concepts.md");

        execFileSync("node", [bundlePath, "--concepts-dir", conceptsDir, "--out", outPath], { cwd: outsideDir });

        expect(fs.readFileSync(outPath, "utf8")).toBe(fromSource);
    });
});

describe("AC2 — validator bundle parity", () => {
    function runSource(args: string[], cwd: string): { status: number; stdout: string; stderr: string } {
        try {
            const stdout: string = execFileSync(TSX_BIN, [VALIDATE_CONCEPTS_SRC, ...args], { cwd, encoding: "utf8" });
            return { status: 0, stdout, stderr: "" };
        } catch (error) {
            const err = error as { status: number; stdout: string; stderr: string };
            return { status: err.status, stdout: err.stdout, stderr: err.stderr };
        }
    }

    function runBundle(bundlePath: string, args: string[], cwd: string): { status: number; stdout: string; stderr: string } {
        try {
            const stdout: string = execFileSync("node", [bundlePath, ...args], { cwd, encoding: "utf8" });
            return { status: 0, stdout, stderr: "" };
        } catch (error) {
            const err = error as { status: number; stdout: string; stderr: string };
            return { status: err.status, stdout: err.stdout, stderr: err.stderr };
        }
    }

    function writeBundle(): string {
        const dir = makeTmpDir("portable-tools-validator-bundle-");
        const bundlePath = path.join(dir, "validate-concepts.mjs");
        fs.writeFileSync(bundlePath, validatorBundle.code);
        return bundlePath;
    }

    it("matches findings and exit code 0 for a clean fixture", () => {
        const conceptsDir = makeTmpDir("portable-tools-clean-");
        writeValidatorPage(conceptsDir, "alpha", "Alpha");
        const bundlePath = writeBundle();

        // Both invocations share the same (non-git) cwd, so neither is advantaged or
        // disadvantaged by ambient git-repo presence — isolating this to a pure source/bundle
        // comparison rather than an artifact of where each happens to run from.
        const source = runSource(["--concepts-dir", conceptsDir], conceptsDir);
        const bundle = runBundle(bundlePath, ["--concepts-dir", conceptsDir], conceptsDir);

        expect(source.status).toBe(0);
        expect(bundle.status).toBe(0);
        expect(bundle.stdout).toBe(source.stdout);
        expect(bundle.stderr).toBe(source.stderr);
    });

    it("matches findings and non-zero exit code for a finding-triggering fixture", () => {
        const conceptsDir = makeTmpDir("portable-tools-dirty-");
        const file = path.join(conceptsDir, "alpha.md");
        fs.writeFileSync(file, "# No frontmatter here\n");
        const bundlePath = writeBundle();

        const source = runSource(["--concepts-dir", conceptsDir], conceptsDir);
        const bundle = runBundle(bundlePath, ["--concepts-dir", conceptsDir], conceptsDir);

        expect(source.status).not.toBe(0);
        expect(bundle.status).toBe(source.status);
        expect(bundle.stderr).toBe(source.stderr);
    });

    it("matches --base append-only findings against a scratch git repo", () => {
        const gitRepoDir = makeTmpDir("portable-tools-base-");
        execFileSync("git", ["init", "-q"], { cwd: gitRepoDir, stdio: "ignore" });
        execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: gitRepoDir, stdio: "ignore" });
        execFileSync("git", ["config", "user.name", "Test"], { cwd: gitRepoDir, stdio: "ignore" });
        writeValidatorPage(gitRepoDir, "alpha", "Alpha");
        execFileSync("git", ["add", "-A"], { cwd: gitRepoDir, stdio: "ignore" });
        execFileSync("git", ["commit", "-q", "-m", "seed"], { cwd: gitRepoDir, stdio: "ignore" });
        const sha: string = execFileSync("git", ["rev-parse", "HEAD"], { cwd: gitRepoDir, encoding: "utf8" }).trim();

        // Changed page that gained zero new Decision Log entries — a --base finding.
        writeValidatorPage(gitRepoDir, "alpha", "Alpha (updated)");
        const bundlePath = writeBundle();

        const source = runSource(["--concepts-dir", gitRepoDir, "--base", sha], gitRepoDir);
        const bundle = runBundle(bundlePath, ["--concepts-dir", gitRepoDir, "--base", sha], gitRepoDir);

        expect(source.status).not.toBe(0);
        expect(bundle.status).toBe(source.status);
        expect(bundle.stderr).toBe(source.stderr);
    });
});
