/**
 * The parity gate (STORY-44.03). Builds fresh bundles in-process, then runs the in-repo source
 * (via `tsx`) and the fresh bundle (via plain `node`, the artifact a hub actually runs) over the
 * committed corpus, asserting identical validator findings, identical exit codes, and byte-identical
 * atlas output. It also asserts the fresh build's hash equals the committed fingerprint pin, and
 * self-tests that the comparator fails — naming the divergence — when the bundle is doctored.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildBundle, type BuiltBundle } from "./bundle";
import { ENTRY_POINTS } from "./build-bundles";
import {
    checkFingerprint,
    diffAtlasBytes,
    diffRunResults,
    type Fingerprint,
    formatDivergences,
    hashBundleCode,
    type RunResult,
} from "./parity";
import { COMPONENT_PAYLOAD_KEY, hashComponentTree, liveClaudeDir } from "./vendor-components";

const REPO_ROOT: string = path.resolve(__dirname, "../../..");
const SRC_DIR: string = __dirname;
const LIB_ROOT: string = path.resolve(__dirname, "..");
const CORPUS: string = path.join(LIB_ROOT, "corpus");
const PIN_PATH: string = path.join(LIB_ROOT, "bundle-fingerprint.json");
const TSX_BIN: string = path.join(REPO_ROOT, "node_modules", ".bin", "tsx");
const ATLAS_SRC: string = path.join(SRC_DIR, "generate-atlas.ts");
const VALIDATOR_SRC: string = path.join(SRC_DIR, "validate-concepts.ts");

let freshBundles: Record<string, BuiltBundle>;
let freshFingerprint: Fingerprint;

beforeAll(async () => {
    freshBundles = {};
    freshFingerprint = {};
    for (const [name, relEntry] of Object.entries(ENTRY_POINTS)) {
        const built: BuiltBundle = await buildBundle(path.join(SRC_DIR, relEntry));
        freshBundles[name] = built;
        freshFingerprint[`${name}.mjs`] = hashBundleCode(built.code);
    }
    // The vendored component payload rides the same pin (STORY-60.01): a live `.claude/` edit
    // that skips the re-vendor step fails the fingerprint test exactly like a stale bundle.
    freshFingerprint[COMPONENT_PAYLOAD_KEY] = hashComponentTree(liveClaudeDir(SRC_DIR));
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

/** Writes a bundle's code (fresh, or a doctored override) to a temp `.mjs` and returns its path. */
function writeBundle(name: string, codeOverride?: string): string {
    const dir: string = makeTmpDir(`parity-bundle-${name}-`);
    const bundlePath: string = path.join(dir, `${name}.mjs`);
    fs.writeFileSync(bundlePath, codeOverride ?? freshBundles[name].code);
    return bundlePath;
}

function capture(fn: () => string): RunResult {
    try {
        return { status: 0, stdout: fn(), stderr: "" };
    } catch (error) {
        const err = error as { status: number; stdout: string; stderr: string };
        return { status: err.status, stdout: err.stdout, stderr: err.stderr };
    }
}

/** Runs the in-repo source via tsx — how single-repo distill runs it. */
function runSource(srcAbs: string, args: string[], cwd: string): RunResult {
    return capture(() => execFileSync(TSX_BIN, [srcAbs, ...args], { cwd, encoding: "utf8" }));
}

/** Runs a built bundle via plain node — the artifact a hub actually runs. */
function runBundle(bundlePath: string, args: string[], cwd: string): RunResult {
    return capture(() => execFileSync("node", [bundlePath, ...args], { cwd, encoding: "utf8" }));
}

/** Builds a scratch git repo: commit `base/`, overlay `head/`, return {repo, sha}. */
function scratchBaseRepo(): { repo: string; conceptsDir: string; sha: string } {
    const repo: string = makeTmpDir("parity-base-");
    const conceptsDir: string = path.join(repo, "concepts");
    fs.mkdirSync(conceptsDir);
    for (const f of fs.readdirSync(path.join(CORPUS, "base"))) {
        fs.copyFileSync(path.join(CORPUS, "base", f), path.join(conceptsDir, f));
    }
    execFileSync("git", ["init", "-q"], { cwd: repo, stdio: "ignore" });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: repo, stdio: "ignore" });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: repo, stdio: "ignore" });
    execFileSync("git", ["add", "-A"], { cwd: repo, stdio: "ignore" });
    execFileSync("git", ["commit", "-q", "-m", "base"], { cwd: repo, stdio: "ignore" });
    const sha: string = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
    for (const f of fs.readdirSync(path.join(CORPUS, "head"))) {
        fs.copyFileSync(path.join(CORPUS, "head", f), path.join(conceptsDir, f));
    }
    return { repo, conceptsDir, sha };
}

// ---------------------------------------------------------------------------------------------
// Fingerprint pin (Invariant 12) — catches "edited source but did not rebuild-and-re-vendor".
// ---------------------------------------------------------------------------------------------
describe("fingerprint pin", () => {
    it("the freshly built bundle hash equals the committed pin", () => {
        const pinned: Fingerprint = JSON.parse(fs.readFileSync(PIN_PATH, "utf8"));
        const mismatch: string | null = checkFingerprint(freshFingerprint, pinned);
        // On failure the message names each stale bundle and points at the re-vendor procedure.
        expect(mismatch, mismatch ?? undefined).toBeNull();
    });

    it("hashBundleCode is deterministic across repeated in-process builds", async () => {
        const [name, relEntry] = Object.entries(ENTRY_POINTS)[0];
        const rebuilt: BuiltBundle = await buildBundle(path.join(SRC_DIR, relEntry));
        expect(hashBundleCode(rebuilt.code)).toBe(freshFingerprint[`${name}.mjs`]);
    });

    it("checkFingerprint returns null when every entry matches", () => {
        expect(checkFingerprint({ "a.mjs": "abc" }, { "a.mjs": "abc" })).toBeNull();
    });

    it("checkFingerprint names a stale bundle and the re-vendor procedure", () => {
        const message: string | null = checkFingerprint({ "a.mjs": "aaaa" }, { "a.mjs": "bbbb" });
        expect(message).toContain("STALE");
        expect(message).toContain("stale");
        expect(message).toContain("nexus:vendor-tools");
    });

    it("checkFingerprint flags an unpinned bundle and an orphaned pin entry", () => {
        expect(checkFingerprint({ "new.mjs": "x" }, {})).toContain("no pin entry");
        expect(checkFingerprint({}, { "old.mjs": "y" })).toContain("no longer built");
    });
});

// ---------------------------------------------------------------------------------------------
// AC1 / Invariant 3 — source vs fresh bundle over the committed corpus produce identical results.
// ---------------------------------------------------------------------------------------------
describe("validator parity over the corpus", () => {
    it("clean pages: both exit 0 with identical output", () => {
        const conceptsDir: string = path.join(CORPUS, "clean");
        const bundlePath: string = writeBundle("validate-concepts");
        const source: RunResult = runSource(VALIDATOR_SRC, ["--concepts-dir", conceptsDir], CORPUS);
        const bundle: RunResult = runBundle(bundlePath, ["--concepts-dir", conceptsDir], CORPUS);

        expect(source.status).toBe(0);
        const divergences = diffRunResults("validate-concepts", "clean", source, bundle);
        expect(divergences, formatDivergences(divergences)).toEqual([]);
    });

    it("finding pages: both exit non-zero with identical findings, covering every category", () => {
        const conceptsDir: string = path.join(CORPUS, "findings");
        const bundlePath: string = writeBundle("validate-concepts");
        const source: RunResult = runSource(VALIDATOR_SRC, ["--concepts-dir", conceptsDir], CORPUS);
        const bundle: RunResult = runBundle(bundlePath, ["--concepts-dir", conceptsDir], CORPUS);

        expect(source.status).not.toBe(0);
        const divergences = diffRunResults("validate-concepts", "findings", source, bundle);
        expect(divergences, formatDivergences(divergences)).toEqual([]);

        // Guard the corpus itself: every Invariant-11 finding category is present.
        for (const marker of [
            "is not kebab-case",
            "§8.3: fenced code block",
            "§8.3: file path",
            "§8.3: code identifier",
            "missing `title`",
            "missing list field",
            "`status` must be",
            "exceeds the 400-word cap",
            "has no Integration Points bullet",
        ]) {
            expect(source.stderr).toContain(marker);
        }
    });

    it("--base append-only mode: both exit non-zero with identical findings", () => {
        const { conceptsDir, sha } = scratchBaseRepo();
        const cwd: string = path.dirname(conceptsDir);
        const bundlePath: string = writeBundle("validate-concepts");
        const args: string[] = ["--concepts-dir", "concepts", "--base", sha];
        const source: RunResult = runSource(VALIDATOR_SRC, args, cwd);
        const bundle: RunResult = runBundle(bundlePath, args, cwd);

        expect(source.status).not.toBe(0);
        const divergences = diffRunResults("validate-concepts", "base", source, bundle);
        expect(divergences, formatDivergences(divergences)).toEqual([]);

        // Guard: the --base corpus exercises both the one-new-entry and append-only checks.
        expect(source.stderr).toContain("gained 0 entries");
        expect(source.stderr).toContain("append-only");
        expect(source.stderr).toContain("new page must carry exactly one entry");
    });
});

describe("atlas parity over the corpus (Invariant 3 — byte-identical)", () => {
    it("source and bundle write byte-identical atlas output", () => {
        const conceptsDir: string = path.join(CORPUS, "atlas");
        const sourceOut: string = path.join(makeTmpDir("parity-atlas-src-"), "concepts.md");
        const bundleOut: string = path.join(makeTmpDir("parity-atlas-bun-"), "concepts.md");
        const bundlePath: string = writeBundle("generate-atlas");

        runSource(ATLAS_SRC, ["--concepts-dir", conceptsDir, "--out", sourceOut], CORPUS);
        runBundle(bundlePath, ["--concepts-dir", conceptsDir, "--out", bundleOut], CORPUS);

        const sourceAtlas: string = fs.readFileSync(sourceOut, "utf8");
        const bundleAtlas: string = fs.readFileSync(bundleOut, "utf8");
        const divergence = diffAtlasBytes("generate-atlas", "atlas", sourceAtlas, bundleAtlas);
        expect(divergence, divergence ? formatDivergences([divergence]) : undefined).toBeNull();

        // Guard the corpus: it exercises multiple components + Standalone (non-trivial clustering).
        expect(sourceAtlas).toContain("## Beta");
        expect(sourceAtlas).toContain("## Pair A");
        expect(sourceAtlas).toContain("## Standalone");
    });
});

// ---------------------------------------------------------------------------------------------
// AC2 — the gate is enforced, not documented: a doctored bundle is caught and named.
// ---------------------------------------------------------------------------------------------
describe("the gate detects and names a synthetic divergence", () => {
    it("a doctored validator bundle diverges from the source, naming entry point / case / excerpt", () => {
        const conceptsDir: string = path.join(CORPUS, "findings");
        const doctored: string = freshBundles["validate-concepts"].code.replace(
            "is not kebab-case",
            "is NOT-KEBAB-CASE",
        );
        expect(doctored).not.toBe(freshBundles["validate-concepts"].code);
        const bundlePath: string = writeBundle("validate-concepts", doctored);

        const source: RunResult = runSource(VALIDATOR_SRC, ["--concepts-dir", conceptsDir], CORPUS);
        const bundle: RunResult = runBundle(bundlePath, ["--concepts-dir", conceptsDir], CORPUS);

        const divergences = diffRunResults("validate-concepts", "findings", source, bundle);
        expect(divergences.length).toBeGreaterThan(0);
        const message: string = formatDivergences(divergences);
        expect(message).toContain("validate-concepts");
        expect(message).toContain("findings");
        expect(message).toContain("NOT-KEBAB-CASE");
    });

    it("a doctored atlas bundle diverges byte-wise, naming the divergence", () => {
        const conceptsDir: string = path.join(CORPUS, "atlas");
        const sourceOut: string = path.join(makeTmpDir("parity-atlas-src-"), "concepts.md");
        const bundleOut: string = path.join(makeTmpDir("parity-atlas-bun-"), "concepts.md");
        const doctored: string = freshBundles["generate-atlas"].code.replace(
            "# Concept Atlas",
            "# Concept Atlas (MUTATED)",
        );
        expect(doctored).not.toBe(freshBundles["generate-atlas"].code);
        const bundlePath: string = writeBundle("generate-atlas", doctored);

        runSource(ATLAS_SRC, ["--concepts-dir", conceptsDir, "--out", sourceOut], CORPUS);
        runBundle(bundlePath, ["--concepts-dir", conceptsDir, "--out", bundleOut], CORPUS);

        const divergence = diffAtlasBytes(
            "generate-atlas",
            "atlas",
            fs.readFileSync(sourceOut, "utf8"),
            fs.readFileSync(bundleOut, "utf8"),
        );
        expect(divergence).not.toBeNull();
        const message: string = formatDivergences(divergence === null ? [] : [divergence]);
        expect(message).toContain("generate-atlas");
        expect(message).toContain("MUTATED");
    });
});

describe("comparator unit behavior", () => {
    const base: RunResult = { status: 0, stdout: "out", stderr: "err" };

    it("names an exit-code divergence", () => {
        const divergences = diffRunResults("e", "c", base, { ...base, status: 1 });
        expect(divergences).toHaveLength(1);
        expect(divergences[0].kind).toBe("exit-code");
        expect(divergences[0].diffExcerpt).toContain("source exited 0, bundle exited 1");
    });

    it("names a stdout divergence with a line excerpt", () => {
        const divergences = diffRunResults("e", "c", base, { ...base, stdout: "different" });
        expect(divergences[0].kind).toBe("stdout");
        expect(divergences[0].diffExcerpt).toContain("first difference at line 1");
    });

    it("names a stderr divergence", () => {
        const divergences = diffRunResults("e", "c", base, { ...base, stderr: "boom" });
        expect(divergences[0].kind).toBe("stderr");
    });

    it("reports no divergence for identical results", () => {
        expect(diffRunResults("e", "c", base, { ...base })).toEqual([]);
    });

    it("diffAtlasBytes returns null when identical and a divergence otherwise", () => {
        expect(diffAtlasBytes("e", "c", "same", "same")).toBeNull();
        expect(diffAtlasBytes("e", "c", "a", "b")?.kind).toBe("atlas-bytes");
    });

    it("falls back gracefully when strings differ only in length", () => {
        const divergences = diffRunResults("e", "c", { ...base, stdout: "x" }, { ...base, stdout: "x\n" });
        expect(divergences[0].diffExcerpt).toContain("line 2");
    });

    it("formatDivergences returns empty string for no divergences", () => {
        expect(formatDivergences([])).toBe("");
    });
});
