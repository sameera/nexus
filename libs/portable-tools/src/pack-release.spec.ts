/**
 * The publishable package (story #308). Nexus ships as one package carrying the bundled
 * TypeScript executable, the Python toolkit's files and the component payload under the single
 * version `VERSION` declares. These tests pin that shape from the outside — the manifest a
 * registry would read, the tarball `npm pack` produces, and a real global install of that
 * tarball into an isolated prefix, invoked from a directory that is not a Nexus checkout.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BIN_NAMES, buildReleaseTree, RELEASE_TREE_DIRNAME } from "./pack-release";

const REPO_ROOT: string = path.resolve(__dirname, "../../..");
const MANIFEST_PATH: string = path.join(REPO_ROOT, "package.json");
const VERSION_PATH: string = path.join(REPO_ROOT, "VERSION");

interface Manifest {
    name: string;
    version: string;
    private?: boolean;
    bin?: Record<string, string>;
    files?: string[];
    dependencies?: Record<string, string>;
    publishConfig?: { access?: string };
}

const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const declaredVersion: string = fs.readFileSync(VERSION_PATH, "utf8").trim();

describe("the manifest declares a publishable package (AC2, AC3)", () => {
    it("is no longer marked private", () => {
        expect(manifest.private).toBeUndefined();
    });

    it("publishes under the single version VERSION declares, off its never-bumped initial value", () => {
        expect(manifest.version).toBe(declaredVersion);
        expect(manifest.version).not.toBe("1.0.0");
    });

    it("declares exactly the two toolkit names as binaries", () => {
        expect(Object.keys(manifest.bin ?? {}).sort()).toEqual([...BIN_NAMES].sort());
    });

    it("carries a published-files allowlist and public publish configuration", () => {
        expect(manifest.files ?? []).toContain(RELEASE_TREE_DIRNAME);
        expect(manifest.files ?? []).toContain("VERSION");
        expect(manifest.publishConfig?.access).toBe("public");
    });

    it("fetches nothing at install time beyond the package itself", () => {
        expect(manifest.dependencies ?? {}).toEqual({});
    });
});

// ---------------------------------------------------------------------------------------------
// The packed tarball, and a real global install of it into an isolated prefix.
// ---------------------------------------------------------------------------------------------

let scratch: string;
let tarball: string;
let packedFiles: string[];
let prefix: string;

/** Runs a binary from the isolated global prefix, from a directory that is not a checkout. */
function runInstalled(bin: string, args: string[]): { status: number; stdout: string; stderr: string } {
    const elsewhere: string = fs.mkdtempSync(path.join(scratch, "elsewhere-"));
    try {
        const stdout: string = execFileSync(path.join(prefix, "bin", bin), args, {
            cwd: elsewhere,
            encoding: "utf8",
            env: { ...process.env, NODE_ENV: "production" },
        });
        return { status: 0, stdout, stderr: "" };
    } catch (error) {
        const err = error as { status: number; stdout: string; stderr: string };
        return { status: err.status, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
    }
}

beforeAll(async () => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-pack-"));
    await buildReleaseTree(REPO_ROOT);
    const packDir: string = path.join(scratch, "pack");
    fs.mkdirSync(packDir);
    // --ignore-scripts: the release tree is already built above; re-running prepack here would
    // only rebuild the same bytes.
    const packOut: string = execFileSync(
        "npm",
        ["pack", "--ignore-scripts", "--pack-destination", packDir, "--json"],
        { cwd: REPO_ROOT, encoding: "utf8" },
    );
    const packed = JSON.parse(packOut)[0] as { filename: string; files: { path: string }[] };
    tarball = path.join(packDir, packed.filename);
    packedFiles = packed.files.map((f) => f.path);
    prefix = path.join(scratch, "prefix");
    execFileSync("npm", ["install", "-g", "--prefix", prefix, "--no-audit", "--no-fund", tarball], {
        cwd: scratch,
        encoding: "utf8",
    });
}, 300_000);

afterAll(() => {
    fs.rmSync(scratch, { recursive: true, force: true });
});

describe("the packed package carries all three parts (AC2)", () => {
    it("contains every binary the manifest declares", () => {
        for (const [name, relPath] of Object.entries(manifest.bin ?? {})) {
            expect(packedFiles, `${name} -> ${relPath}`).toContain(relPath);
        }
    });

    it("contains the Python toolkit's importable package files", () => {
        const pythonModules: string[] = packedFiles.filter((f) => f.endsWith(".py"));
        expect(pythonModules).toContain(`${RELEASE_TREE_DIRNAME}/gh-toolkit/nexus_gh/cli.py`);
        expect(pythonModules).toContain(`${RELEASE_TREE_DIRNAME}/gh-toolkit/nexus_gh/release.py`);
        expect(pythonModules).toContain(`${RELEASE_TREE_DIRNAME}/gh-toolkit/nexus_gh/delivery_config.py`);
    });

    it("contains the component payload", () => {
        const payload: string[] = packedFiles.filter((f) => f.includes("/claude-components/"));
        expect(payload.some((f) => f.endsWith("commands/nxs.epic.md"))).toBe(true);
        expect(payload.some((f) => f.includes("/skills/"))).toBe(true);
        expect(payload.some((f) => f.includes("/agents/"))).toBe(true);
    });

    it("carries the one version declaration both toolkits read", () => {
        expect(packedFiles).toContain("VERSION");
    });
});

describe("both toolkits run from a machine with no Nexus checkout (AC1, AC4)", () => {
    it.each([...BIN_NAMES])("`%s version` runs from any directory and reports the release version", (bin) => {
        const result = runInstalled(bin, ["version"]);
        expect(result.status, result.stderr).toBe(0);
        expect(JSON.parse(result.stdout).version).toBe(declaredVersion);
    });

    it("resolves no workspace package — the installed tree carries no node_modules", () => {
        const installed: string = path.join(prefix, "lib", "node_modules", manifest.name);
        expect(fs.existsSync(installed)).toBe(true);
        expect(fs.existsSync(path.join(installed, "node_modules"))).toBe(false);
    });
});
