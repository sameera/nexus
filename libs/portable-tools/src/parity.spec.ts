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
import { checkComponentComposition } from "./component-composition";
import { COMPONENT_COMPOSITION_WAIVERS } from "./component-composition-waivers";
import {
    checkComponentInvocations,
    formatInvocationProblems,
    type Invocation,
    type InvocationProblem,
    readToolkitSurfaces,
    scanComponentInvocations,
    type ToolkitSurfaces,
} from "./component-invocations";
import { listComponentFiles, liveClaudeDir } from "./vendor-components";
import { diffPayloadManifest, hashPayload, payloadManifest, PAYLOAD_KEY, PAYLOAD_MANIFEST_FILE, type PayloadManifest } from "./release-payload";

const REPO_ROOT: string = path.resolve(__dirname, "../../..");
const SRC_DIR: string = __dirname;
const LIB_ROOT: string = path.resolve(__dirname, "..");
const CORPUS: string = path.join(LIB_ROOT, "corpus");
const PIN_PATH: string = path.join(LIB_ROOT, "bundle-fingerprint.json");
const MANIFEST_PATH: string = path.join(LIB_ROOT, PAYLOAD_MANIFEST_FILE);
const TSX_BIN: string = path.join(REPO_ROOT, "node_modules", ".bin", "tsx");

const GH_STANDIN_DIR: string = path.join(CORPUS, "bin");
// The Python toolkit's entry point, placed on PATH under its own name — the install shape
// story #297 names, and what makes `nexus-gh` reachable identically from source and bundle.
const GH_TOOLKIT_BIN: string = path.join(REPO_ROOT, "libs", "gh-toolkit", "bin");

// Story #276: the dispatcher's own source form — `tsx nexus-cli.ts <verb>` — is "the one command
// shape" a maintainer runs any verb through with no build step. It is the only source-side entry
// point left: every capability now dispatches through it.
const NEXUS_CLI_SRC: string = path.join(SRC_DIR, "nexus-cli.ts");

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
    // The payload rides the same pin (STORY-60.01): a live component or toolkit edit that skips
    // the re-pin step fails the fingerprint test exactly like a stale bundle.
    freshFingerprint[PAYLOAD_KEY] = hashPayload(REPO_ROOT);
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
function runSource(srcAbs: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv): RunResult {
    return capture(() => execFileSync(TSX_BIN, [srcAbs, ...args], { cwd, encoding: "utf8", ...(env ? { env } : {}) }));
}

/** Runs a built bundle via plain node — the artifact a hub actually runs. */
function runBundle(bundlePath: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv): RunResult {
    return capture(() => execFileSync("node", [bundlePath, ...args], { cwd, encoding: "utf8", ...(env ? { env } : {}) }));
}

/**
 * A capability's parity axis, since story #309 built one executable instead of six. The bundle
 * side is that executable addressed by verb; the source side is the same dispatcher run through
 * tsx with the same verb. There is no standalone artifact left for either side to be.
 */
function runCapability(bundlePath: string, verb: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv): RunResult {
    return runBundle(bundlePath, [verb, ...args], cwd, env);
}

function runCapabilitySource(verb: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv): RunResult {
    return runSource(NEXUS_CLI_SRC, [verb, ...args], cwd, env);
}

/** Env that puts the hermetic `gh` stand-in ahead of the real one on PATH, pointed at one fixture. */
function ghStandInEnv(fixtureAbsPath: string): NodeJS.ProcessEnv {
    return {
        ...process.env,
        // `nexus-gh` joins `gh` on the path: since story #300 the Python toolkit is an external
        // program addressed by name, so source and bundle must reach the same one — a bundle
        // written to a scratch directory has no checkout to fall back into.
        PATH: [GH_STANDIN_DIR, GH_TOOLKIT_BIN, process.env.PATH].join(path.delimiter),
        NEXUS_PARITY_GH_FIXTURE: fixtureAbsPath,
    };
}

/** Real git, real merge topologies (story #273) — pr-worktree's parity must exercise real git. */
function sh(cwd: string, cmd: string, ...args: string[]): string {
    return execFileSync(cmd, args, { cwd, encoding: "utf8" }).trim();
}

function shIgnore(cwd: string, cmd: string, ...args: string[]): void {
    execFileSync(cmd, args, { cwd, stdio: "ignore" });
}

function writeCommit(dir: string, file: string, content: string, msg: string): string {
    fs.writeFileSync(path.join(dir, file), content);
    shIgnore(dir, "git", "add", "-A");
    shIgnore(dir, "git", "commit", "-q", "-m", msg);
    return sh(dir, "git", "rev-parse", "HEAD");
}

/**
 * A real repo + bare origin with a true merge-commit PR topology (2 parents — unambiguous range
 * base, no verifyAgainstPrHead disambiguation needed), and the PR branch pushed to the
 * conventional pull ref so `git fetch origin pull/<N>/head` resolves without a network.
 */
function buildPrWorktreeFixture(prNumber: number): { repo: string; mergeCommit: string; prHead: string; baseRefOid: string } {
    const parent: string = makeTmpDir("parity-pr-worktree-");
    const origin: string = path.join(parent, "origin.git");
    fs.mkdirSync(origin, { recursive: true });
    shIgnore(origin, "git", "init", "-q", "--bare", "-b", "main");
    const repo: string = path.join(parent, "work");
    fs.mkdirSync(repo, { recursive: true });
    shIgnore(repo, "git", "init", "-q", "-b", "main");
    shIgnore(repo, "git", "config", "user.email", "spec@example.com");
    shIgnore(repo, "git", "config", "user.name", "spec");
    shIgnore(repo, "git", "remote", "add", "origin", origin);
    writeCommit(repo, "base.txt", "base\n", "C0");
    const baseRefOid: string = writeCommit(repo, "m1.txt", "m1\n", "M1");
    shIgnore(repo, "git", "push", "-q", "-u", "origin", "main");
    shIgnore(repo, "git", "checkout", "-q", "-b", "feature");
    writeCommit(repo, "f1.txt", "f1\n", "F1");
    const prHead: string = writeCommit(repo, "f2.txt", "f2\n", "F2");
    shIgnore(repo, "git", "push", "-q", "origin", `feature:refs/pull/${prNumber}/head`);
    shIgnore(repo, "git", "checkout", "-q", "main");
    shIgnore(repo, "git", "merge", "--no-ff", "-q", "-m", "Merge feature", "feature");
    const mergeCommit: string = sh(repo, "git", "rev-parse", "HEAD");
    return { repo, mergeCommit, prHead, baseRefOid };
}

/** Writes a `gh pr view` fixture the stand-in answers, matching resolvePr's expected JSON shape. */
function writePrViewFixture(
    prNumber: number,
    fields: { state: string; merged: boolean; base: string; head: string; mergeCommitOid: string | null; commitCount: number },
): string {
    const stdout: string =
        JSON.stringify({
            state: fields.state,
            mergedAt: fields.merged ? "2026-08-23T00:00:00Z" : "",
            baseRefOid: fields.base,
            headRefOid: fields.head,
            mergeCommit: fields.mergeCommitOid ? { oid: fields.mergeCommitOid } : null,
            commits: Array.from({ length: fields.commitCount }, () => ({})),
            headRefName: "feature",
            url: `https://github.com/acme/app/pull/${prNumber}`,
            isCrossRepository: false,
            author: { login: "alice" },
        }) + "\n";
    const fixtureDir: string = makeTmpDir("parity-pr-worktree-fixture-");
    const fixturePath: string = path.join(fixtureDir, "pr-worktree-fixture.json");
    fs.writeFileSync(fixturePath, JSON.stringify({ prView: { [String(prNumber)]: { status: 0, stdout } } }));
    return fixturePath;
}

/** Count of `git worktree list --porcelain` lines registering exactly `wtPath`. */
function worktreeCount(fromDir: string, wtPath: string): number {
    return sh(fromDir, "git", "worktree", "list", "--porcelain")
        .split("\n")
        .filter((l) => l === `worktree ${wtPath}`).length;
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
// Fingerprint pin (Invariant 12) — catches "edited source but did not rebuild-and-re-pin".
// ---------------------------------------------------------------------------------------------
describe("fingerprint pin", () => {
    it("the freshly built executable and recomputed payload equal the committed pin", () => {
        const pinned: Fingerprint = JSON.parse(fs.readFileSync(PIN_PATH, "utf8"));
        const recorded: PayloadManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
        const differences: string[] = diffPayloadManifest(recorded, payloadManifest(REPO_ROOT));
        const mismatch: string | null = checkFingerprint(freshFingerprint, pinned, differences);
        // On failure the message names what differs and points at the re-pin procedure.
        expect(mismatch, mismatch ?? undefined).toBeNull();
    });

    it("compares against the pin alone — no copy of the artifact inside any repository", () => {
        // Both sides of the comparison are produced here: a fresh in-process build and a fresh
        // walk of the payload sources. Nothing reads a vendored or deployed copy (story #310).
        expect(Object.keys(freshFingerprint).sort()).toEqual(["nexus.mjs", PAYLOAD_KEY].sort());
        expect(freshFingerprint[PAYLOAD_KEY]).toBe(hashPayload(REPO_ROOT));
    });

    it("names the payload file that differs, not only that the digests differ", () => {
        const recorded: PayloadManifest = { "gh-toolkit/nexus_gh/cli.py": "aaaa", "claude-components/commands/nxs.epic.md": "bbbb" };
        const current: PayloadManifest = { "gh-toolkit/nexus_gh/cli.py": "cccc", "gh-toolkit/nexus_gh/new.py": "dddd" };
        const differences: string[] = diffPayloadManifest(recorded, current);
        const message: string | null = checkFingerprint({ [PAYLOAD_KEY]: "x" }, { [PAYLOAD_KEY]: "y" }, differences);
        expect(message).toContain("changed: gh-toolkit/nexus_gh/cli.py");
        expect(message).toContain("added: gh-toolkit/nexus_gh/new.py");
        expect(message).toContain("removed: claude-components/commands/nxs.epic.md");
    });

    it("the remediation names an action that writes into no repository", () => {
        const message: string | null = checkFingerprint({ "a.mjs": "aaaa" }, { "a.mjs": "bbbb" });
        expect(message).toContain("nexus:pin-bundles");
        expect(message).toContain("copies nothing into any repository");
        expect(message).not.toContain("--tools-dir");
    });

    it("the committed payload manifest describes the payload the pin covers", () => {
        const recorded: PayloadManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
        expect(diffPayloadManifest(recorded, payloadManifest(REPO_ROOT))).toEqual([]);
    });

    it("hashBundleCode is deterministic across repeated in-process builds", async () => {
        const [name, relEntry] = Object.entries(ENTRY_POINTS)[0];
        const rebuilt: BuiltBundle = await buildBundle(path.join(SRC_DIR, relEntry));
        expect(hashBundleCode(rebuilt.code)).toBe(freshFingerprint[`${name}.mjs`]);
    });

    it("checkFingerprint returns null when every entry matches", () => {
        expect(checkFingerprint({ "a.mjs": "abc" }, { "a.mjs": "abc" })).toBeNull();
    });

    it("checkFingerprint names a stale artifact and the re-pin procedure", () => {
        const message: string | null = checkFingerprint({ "a.mjs": "aaaa" }, { "a.mjs": "bbbb" });
        expect(message).toContain("STALE");
        expect(message).toContain("stale");
        expect(message).toContain("nexus:pin-bundles");
    });

    it("remediates without naming a vendoring operation or a repository-internal destination", () => {
        const message: string = checkFingerprint({ "a.mjs": "aaaa" }, { "a.mjs": "bbbb" }) ?? "";
        expect(message.toLowerCase()).not.toContain("vendor");
        expect(message).not.toContain(".nexus/tools");
    });

    it("checkFingerprint flags an unpinned bundle and an orphaned pin entry", () => {
        expect(checkFingerprint({ "new.mjs": "x" }, {})).toContain("no pin entry");
        expect(checkFingerprint({}, { "old.mjs": "y" })).toContain("no longer built");
    });
});

// ---------------------------------------------------------------------------------------------
// Payload boundary (story #275, decision record #277): the vendored set stays "the three
// component subtrees, whole" — no denylist — and a composition check with an enumerated waiver
// register is what keeps a checkout-bound file out of it instead.
// ---------------------------------------------------------------------------------------------
describe("component payload boundary (story #275)", () => {
    it("the live tree violates the composition check only at the enumerated waivers", () => {
        // No waivers passed here: this is the FULL set of files the check would flag, which must
        // equal the waiver register exactly — neither a live file the register fails to cover
        // (an unwaived violation would slip into the payload) nor a stale entry for a file that
        // no longer violates the check (the register "only ever shrinks" per decision record).
        const violations = checkComponentComposition(liveClaudeDir(SRC_DIR), []);
        const violatingPaths: string[] = violations.map((v) => v.relPath).sort();
        expect(violatingPaths).toEqual([...COMPONENT_COMPOSITION_WAIVERS].sort());
    });

    it("the acceptance harness is absent from the live component tree (moved beside its library)", () => {
        const files = listComponentFiles(liveClaudeDir(SRC_DIR));
        const harnessFiles = files.filter((f) => f.includes("pr-acceptance"));
        expect(harnessFiles, harnessFiles.join(", ")).toEqual([]);
    });
});

// ---------------------------------------------------------------------------------------------
// Component invocations (story #301, decision record #325): every toolkit invocation in a shipped
// body names a toolkit and a dispatch name that toolkit declares. This rides the same gate as
// parity, the fingerprint pin, and the payload-composition boundary — the one thing that already
// reads the shipped payload and already fails the source-repo test run.
// ---------------------------------------------------------------------------------------------
describe("component invocations name a declared toolkit verb (story #301)", () => {
    const surfaces: ToolkitSurfaces = readToolkitSurfaces(REPO_ROOT);
    const inventory: Invocation[] = scanComponentInvocations(liveClaudeDir(SRC_DIR), surfaces);

    it("reads each toolkit's declared surface from that surface, not from a duplicate", () => {
        // The executable's names come from the registry that composes its own usage text; the
        // Python toolkit's come from executing its entry point. Neither list is written down here.
        expect(surfaces.nexus).toContain("workspace docs-root");
        expect(surfaces.nexusGh.length).toBeGreaterThan(0);
        expect(surfaces.nexusGh).toEqual([...surfaces.nexusGh].sort());
    });

    it("no shipped body names a verb or capability the toolkit does not declare", () => {
        const undeclared: Invocation[] = inventory.filter((site) => site.classification === "undeclared");
        expect(undeclared.map((site) => `${site.relPath}:${site.line} ${site.name}`)).toEqual([]);
    });

    it("no shipped body addresses a toolkit by a repository-bound form", () => {
        // Unconditional since story #303 emptied and removed the pending register: a reintroduced
        // script path, bundle path, workspace alias or bare `python` fails the build immediately.
        const problems: InvocationProblem[] = checkComponentInvocations(inventory);
        expect(problems.length, problems.length > 0 ? formatInvocationProblems(problems) : undefined).toBe(0);
    });

    it("the inventory classifies every code-span invocation in every shipped body", () => {
        expect(inventory.length).toBeGreaterThan(0);
        for (const site of inventory) {
            expect(["resolving", "undeclared", "unmigrated"]).toContain(site.classification);
            expect(listComponentFiles(liveClaudeDir(SRC_DIR))).toContain(site.relPath);
        }
    });

    it("the gate fails, naming the body and the name, when a body names an undeclared verb", () => {
        // The self-test the gate needs: a doctored body must be reported, or the axis proves nothing.
        const doctored: Invocation[] = scanComponentInvocations(liveClaudeDir(SRC_DIR), {
            nexus: [],
            nexusGh: [],
        }).filter((site) => site.classification === "undeclared");
        const problems: InvocationProblem[] = checkComponentInvocations(doctored);
        expect(problems.length).toBeGreaterThan(0);
        const text: string = formatInvocationProblems(problems);
        expect(text).toContain(doctored[0].relPath);
        expect(text).toContain(doctored[0].name);
    });
});

// ---------------------------------------------------------------------------------------------
// Source run (story #276, decision record #277 — "The source run is the same dispatcher"): the
// one command shape a maintainer runs any verb through with no build step, `tsx nexus-cli.ts
// <verb>`, is byte-identical to the built executable — by construction (same `runNexusCli`
// function, same registry), which this axis proves rather than assumes.
// ---------------------------------------------------------------------------------------------
describe("source run vs built executable (story #276)", () => {
    it("`workspace status` agrees between the tsx source run and the built executable", () => {
        const repo: string = makeTmpDir("parity-source-run-");
        fs.mkdirSync(path.join(repo, ".git"));
        const bundlePath: string = writeBundle("nexus");

        const source: RunResult = runSource(NEXUS_CLI_SRC, ["workspace", "status"], repo);
        const bundle: RunResult = runBundle(bundlePath, ["workspace", "status"], repo);

        expect(source.status).toBe(0);
        const divergences = diffRunResults("nexus-cli (source run)", "workspace-status", source, bundle);
        expect(divergences, formatDivergences(divergences)).toEqual([]);
    });

    it("`generate-atlas` agrees between the tsx source run and the built executable, byte-for-byte", () => {
        const conceptsDir: string = path.join(CORPUS, "atlas");
        const sourceOut: string = path.join(makeTmpDir("parity-source-run-atlas-src-"), "concepts.md");
        const bundleOut: string = path.join(makeTmpDir("parity-source-run-atlas-bun-"), "concepts.md");
        const bundlePath: string = writeBundle("nexus");

        const source: RunResult = runSource(
            NEXUS_CLI_SRC,
            ["generate-atlas", "--concepts-dir", conceptsDir, "--out", sourceOut],
            CORPUS,
        );
        const bundle: RunResult = runBundle(
            bundlePath,
            ["generate-atlas", "--concepts-dir", conceptsDir, "--out", bundleOut],
            CORPUS,
        );

        // Not diffRunResults here: stdout legitimately embeds each run's own --out path (a
        // distinct tmp dir per side), so it diverges by construction — matching the "atlas
        // parity over the corpus" durable-axis convention above, which compares written bytes,
        // not stdout, for exactly this reason.
        expect(source.status).toBe(0);
        expect(bundle.status).toBe(0);
        const divergence = diffAtlasBytes(
            "nexus-cli (source run)",
            "generate-atlas",
            fs.readFileSync(sourceOut, "utf8"),
            fs.readFileSync(bundleOut, "utf8"),
        );
        expect(divergence, divergence ? formatDivergences([divergence]) : undefined).toBeNull();
    });

    it("AC4 — an unknown verb produces the same usage text and exit code in both forms", () => {
        const repo: string = makeTmpDir("parity-source-run-unknown-");
        const bundlePath: string = writeBundle("nexus");

        const source: RunResult = runSource(NEXUS_CLI_SRC, ["frobnicate"], repo);
        const bundle: RunResult = runBundle(bundlePath, ["frobnicate"], repo);

        expect(source.status).toBe(2);
        expect(source.stderr).toContain("frobnicate");
        const divergences = diffRunResults("nexus-cli (source run)", "unknown-verb", source, bundle);
        expect(divergences, formatDivergences(divergences)).toEqual([]);
    });

    it("AC4 — no verb at all produces the same usage text and exit code in both forms", () => {
        const repo: string = makeTmpDir("parity-source-run-no-verb-");
        const bundlePath: string = writeBundle("nexus");

        const source: RunResult = runSource(NEXUS_CLI_SRC, [], repo);
        const bundle: RunResult = runBundle(bundlePath, [], repo);

        expect(source.status).toBe(2);
        const divergences = diffRunResults("nexus-cli (source run)", "no-verb", source, bundle);
        expect(divergences, formatDivergences(divergences)).toEqual([]);
    });

    // AC3 — editing a capability in libs/ takes effect on the very next `tsx` run, no rebuild.
    // Structurally guaranteed by `tsx` (it transpiles-and-runs fresh, no cache), but demonstrated
    // concretely rather than merely asserted: edit a real library's exported behaviour on disk,
    // rerun the verb through the source-run command shape, and observe the edit take effect —
    // against the SAME `nexus-cli.ts` process invocation path exercised above.
    it("AC3 — an edit to a libs/ capability takes effect on the next source run, with no build step", () => {
        const libFile: string = path.join(LIB_ROOT, "..", "abs-doc-path", "src", "settings.ts");
        const original: string = fs.readFileSync(libFile, "utf8");
        const marker = "https://example.invalid/AC3-MARKER/";
        const edited: string = original.replace(
            'export const DEFAULT_DOC_ROOT = "https://github.com/{username|orgname}/{reponame}/blob/main/docs";',
            `export const DEFAULT_DOC_ROOT = "${marker}";`,
        );
        expect(edited).not.toBe(original);

        const repo: string = makeTmpDir("parity-source-run-ac3-");
        fs.mkdirSync(path.join(repo, ".git"));
        try {
            fs.writeFileSync(libFile, edited);
            const source: RunResult = runSource(NEXUS_CLI_SRC, ["abs-doc-path", "docs/a.md"], repo);
            expect(source.status).toBe(0);
            expect(source.stdout).toContain(marker);
        } finally {
            fs.writeFileSync(libFile, original);
        }
    });
});

// ---------------------------------------------------------------------------------------------
// AC1 / Invariant 3 — source vs fresh bundle over the committed corpus produce identical results.
// ---------------------------------------------------------------------------------------------
describe("validator parity over the corpus", () => {
    it("clean pages: both exit 0 with identical output", () => {
        const conceptsDir: string = path.join(CORPUS, "clean");
        const bundlePath: string = writeBundle("nexus");
        const source: RunResult = runCapabilitySource("validate-concepts", ["--concepts-dir", conceptsDir], CORPUS);
        const bundle: RunResult = runCapability(bundlePath, "validate-concepts", ["--concepts-dir", conceptsDir], CORPUS);

        expect(source.status).toBe(0);
        const divergences = diffRunResults("validate-concepts", "clean", source, bundle);
        expect(divergences, formatDivergences(divergences)).toEqual([]);
    });

    it("finding pages: both exit non-zero with identical findings, covering every category", () => {
        const conceptsDir: string = path.join(CORPUS, "findings");
        const bundlePath: string = writeBundle("nexus");
        const source: RunResult = runCapabilitySource("validate-concepts", ["--concepts-dir", conceptsDir], CORPUS);
        const bundle: RunResult = runCapability(bundlePath, "validate-concepts", ["--concepts-dir", conceptsDir], CORPUS);

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
        const bundlePath: string = writeBundle("nexus");
        const args: string[] = ["--concepts-dir", "concepts", "--base", sha];
        const source: RunResult = runCapabilitySource("validate-concepts", args, cwd);
        const bundle: RunResult = runCapability(bundlePath, "validate-concepts", args, cwd);

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
        const bundlePath: string = writeBundle("nexus");

        runCapabilitySource("generate-atlas", ["--concepts-dir", conceptsDir, "--out", sourceOut], CORPUS);
        runCapability(bundlePath, "generate-atlas", ["--concepts-dir", conceptsDir, "--out", bundleOut], CORPUS);

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

describe("atlas parity — registry mode (epic #89, Invariant 12)", () => {
    it("source and bundle render byte-identical curated atlas output", () => {
        const registryRoot: string = path.join(CORPUS, "registry");
        const conceptsDir: string = path.join(registryRoot, "concepts");
        const sourceOut: string = path.join(makeTmpDir("parity-reg-src-"), "concepts.md");
        const bundleOut: string = path.join(makeTmpDir("parity-reg-bun-"), "concepts.md");
        const bundlePath: string = writeBundle("nexus");

        runCapabilitySource("generate-atlas", ["--concepts-dir", conceptsDir, "--out", sourceOut], registryRoot);
        runCapability(bundlePath, "generate-atlas", ["--concepts-dir", conceptsDir, "--out", bundleOut], registryRoot);

        const sourceAtlas: string = fs.readFileSync(sourceOut, "utf8");
        const bundleAtlas: string = fs.readFileSync(bundleOut, "utf8");
        const divergence = diffAtlasBytes("generate-atlas", "registry", sourceAtlas, bundleAtlas);
        expect(divergence, divergence ? formatDivergences([divergence]) : undefined).toBeNull();

        // Guard: curated headings (registry projection), not link-density clusters.
        expect(sourceAtlas).toContain("## Connectors");
        expect(sourceAtlas).toContain("### Catalog");
        expect(sourceAtlas).not.toContain("## Standalone");
    });
});

describe("drift-advisory parity over the corpus (epic #94, STORY-94.02 — byte-identical)", () => {
    it("source and bundle produce byte-identical stdout over the corpus", () => {
        const driftRoot: string = path.join(CORPUS, "drift");
        const bundlePath: string = writeBundle("nexus");
        const args: string[] = ["--concepts-dir", "concepts", "--registry", "docs/domains.md"];

        const source: RunResult = runCapabilitySource("drift-advisory", args, driftRoot);
        const bundle: RunResult = runCapability(bundlePath, "drift-advisory", args, driftRoot);

        expect(source.status).toBe(0);
        expect(bundle.status).toBe(0);
        const divergences = diffRunResults("drift-advisory", "drift", source, bundle);
        expect(divergences, formatDivergences(divergences)).toEqual([]);

        // Guard the corpus itself: it exercises a real, stable finding, not just a clean store.
        expect(source.stdout).toContain("### Cross-domain misfiles");
    });
});

describe("seed-registry parity over the corpus (epic #94, STORY-94.03 — byte-identical drafts)", () => {
    it("source and bundle write byte-identical draft files over the corpus", () => {
        const seedRoot: string = path.join(CORPUS, "seed");
        const sourceOut: string = makeTmpDir("parity-seed-src-");
        const bundleOut: string = makeTmpDir("parity-seed-bun-");
        const bundlePath: string = writeBundle("nexus");
        const args = (out: string): string[] => ["--concepts-dir", "concepts", "--out-dir", out];

        const source: RunResult = runCapabilitySource("seed-registry", args(sourceOut), seedRoot);
        const bundle: RunResult = runCapability(bundlePath, "seed-registry", args(bundleOut), seedRoot);

        expect(source.status).toBe(0);
        expect(bundle.status).toBe(0);

        // Seed mode writes files (not stdout); compare each draft byte-for-byte across source/bundle.
        for (const name of ["domains.draft.md", "domain-filing-suggestions.draft.md"]) {
            const sourceDraft: string = fs.readFileSync(path.join(sourceOut, name), "utf8");
            const bundleDraft: string = fs.readFileSync(path.join(bundleOut, name), "utf8");
            const divergence = diffAtlasBytes("seed-registry", name, sourceDraft, bundleDraft);
            expect(divergence, divergence ? formatDivergences([divergence]) : undefined).toBeNull();
        }

        // Guard the corpus: a real, stable candidate-domain draft, not an empty store.
        const registryDraft: string = fs.readFileSync(path.join(sourceOut, "domains.draft.md"), "utf8");
        expect(registryDraft).toContain("## Candidate Domain 1");
    });
});

// ---------------------------------------------------------------------------------------------
// AC2 — the gate is enforced, not documented: a doctored bundle is caught and named.
// ---------------------------------------------------------------------------------------------
describe("the gate detects and names a synthetic divergence", () => {
    it("a doctored validator bundle diverges from the source, naming entry point / case / excerpt", () => {
        const conceptsDir: string = path.join(CORPUS, "findings");
        const doctored: string = freshBundles["nexus"].code.replace(
            "is not kebab-case",
            "is NOT-KEBAB-CASE",
        );
        expect(doctored).not.toBe(freshBundles["nexus"].code);
        const bundlePath: string = writeBundle("nexus", doctored);

        const source: RunResult = runCapabilitySource("validate-concepts", ["--concepts-dir", conceptsDir], CORPUS);
        const bundle: RunResult = runCapability(bundlePath, "validate-concepts", ["--concepts-dir", conceptsDir], CORPUS);

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
        const doctored: string = freshBundles["nexus"].code.replace(
            "# Concept Atlas",
            "# Concept Atlas (MUTATED)",
        );
        expect(doctored).not.toBe(freshBundles["nexus"].code);
        const bundlePath: string = writeBundle("nexus", doctored);

        runCapabilitySource("generate-atlas", ["--concepts-dir", conceptsDir, "--out", sourceOut], CORPUS);
        runCapability(bundlePath, "generate-atlas", ["--concepts-dir", conceptsDir, "--out", bundleOut], CORPUS);

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

// ---------------------------------------------------------------------------------------------
// derive-entry-diff has no executed-diff coverage prior to this story (decision record #277: "A
// usage-error case satisfies the requirement literally while proving nothing"), so this corpus
// case materialises a real scratch multi-repo workspace (a hub + one member) with a real
// recorded range, and compares an actual derived diff — not a bare usage error.
describe("migration axis — derive-entry-diff (story #274, real workspace corpus)", () => {
    it("source and verb derive an identical real diff over a scratch multi-repo workspace", () => {
        const parent: string = makeTmpDir("parity-derive-entry-diff-");

        const hubRoot: string = path.join(parent, "docs-hub");
        fs.mkdirSync(hubRoot, { recursive: true });
        shIgnore(hubRoot, "git", "init", "-q", "-b", "main");
        shIgnore(hubRoot, "git", "config", "user.email", "spec@example.com");
        shIgnore(hubRoot, "git", "config", "user.name", "spec");
        fs.mkdirSync(path.join(hubRoot, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(
            path.join(hubRoot, ".nexus", "config", "workspace.yml"),
            "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\n" +
                "members:\n  - name: web-app\n    remote: git@github.com:acme/web-app.git\n",
        );
        writeCommit(hubRoot, "README.md", "# hub\n", "init hub");

        const webRoot: string = path.join(parent, "web-app");
        fs.mkdirSync(webRoot, { recursive: true });
        shIgnore(webRoot, "git", "init", "-q", "-b", "main");
        shIgnore(webRoot, "git", "config", "user.email", "spec@example.com");
        shIgnore(webRoot, "git", "config", "user.name", "spec");
        shIgnore(webRoot, "git", "remote", "add", "origin", "git@github.com:acme/web-app.git");
        fs.mkdirSync(path.join(webRoot, "src"), { recursive: true });
        const webBase: string = writeCommit(webRoot, "src/app.ts", "export const v = 1;\n", "base");
        const webHead: string = writeCommit(webRoot, "src/app.ts", "export const v = 2;\n", "head");

        const entryDir: string = path.join(hubRoot, ".nexus", "queue", "demo-epic-ab12cd34");
        fs.mkdirSync(entryDir, { recursive: true });
        fs.writeFileSync(path.join(entryDir, "epic.md"), '---\nlink: "#3"\n---\n# epic\n');
        fs.writeFileSync(
            path.join(entryDir, "close-record.md"),
            `---\ntitle: "Close Record: Demo"\nepic: #3\nfeature: "Demo"\ndate: 2026-08-23\nrange:\n` +
                `  - repo: github.com/acme/web-app\n    base: ${webBase}\n    head: ${webHead}\n---\n\n# Close Record: Demo\n`,
        );

        const nexusBundlePath: string = writeBundle("nexus");
        const args: string[] = ["--entry", entryDir, "--hub", hubRoot];

        const source: RunResult = runCapabilitySource("derive-entry-diff", args, hubRoot);
        const verb: RunResult = runBundle(nexusBundlePath, ["derive-entry-diff", ...args], hubRoot);

        expect(source.status).toBe(0);
        expect(source.stdout).toContain("src/app.ts");
        const divergences = diffRunResults("derive-entry-diff", "real-workspace", source, verb);
        expect(divergences, formatDivergences(divergences)).toEqual([]);
    });
});
