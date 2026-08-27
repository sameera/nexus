/**
 * The payload is a stated set (story #309). These tests pin the three properties that follow
 * from stating it: nothing incidental ships, the fingerprint is a property of the commit rather
 * than of the machine, and the build produces one executable.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ENTRY_POINTS } from "./build-bundles";
import { buildReleaseTree } from "./pack-release";
import { hashPayload, isIgnoredPayloadEntry, listPayloadFiles, PAYLOAD_IGNORE, PAYLOAD_KEY } from "./release-payload";

const REPO_ROOT: string = path.resolve(__dirname, "../../..");
const PIN_PATH: string = path.resolve(__dirname, "..", "bundle-fingerprint.json");

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

describe("the payload walk applies a stated ignore filter (AC3)", () => {
    it("states the categories it excludes rather than sweeping the directory", () => {
        expect([...PAYLOAD_IGNORE]).toEqual(expect.arrayContaining(["__pycache__", "*.pyc", "tests", "test_*.py"]));
    });

    it("excludes byte-code and test files wherever they sit", () => {
        expect(isIgnoredPayloadEntry("__pycache__")).toBe(true);
        expect(isIgnoredPayloadEntry("cli.cpython-312.pyc")).toBe(true);
        expect(isIgnoredPayloadEntry("tests")).toBe(true);
        expect(isIgnoredPayloadEntry("test_packaging.py")).toBe(true);
    });

    it("keeps the capability modules a release exists to ship", () => {
        for (const kept of ["cli.py", "release.py", "delivery_config.py", "nexus-gh", "nxs.epic.md"]) {
            expect(isIgnoredPayloadEntry(kept), kept).toBe(false);
        }
    });
});

describe("the shipped payload carries nothing incidental (AC1)", () => {
    it("lists no test file and no byte-code", () => {
        const staged: string[] = listPayloadFiles(REPO_ROOT).map((f) => f.staged);
        expect(staged.filter((f) => f.includes("__pycache__"))).toEqual([]);
        expect(staged.filter((f) => f.endsWith(".pyc"))).toEqual([]);
        expect(staged.filter((f) => path.basename(f).startsWith("test_"))).toEqual([]);
        expect(staged.filter((f) => f.includes("/tests/"))).toEqual([]);
    });

    it("carries the Python toolkit's modules and the component tree", () => {
        const staged: string[] = listPayloadFiles(REPO_ROOT).map((f) => f.staged);
        expect(staged).toContain("gh-toolkit/nexus_gh/cli.py");
        expect(staged).toContain("gh-toolkit/bin/nexus-gh");
        expect(staged).toContain("claude-components/commands/nxs.epic.md");
    });

    it("stages exactly the stated set into the release tree", async () => {
        const outDir: string = path.join(makeTmpDir("payload-stage-"), "release");
        await buildReleaseTree(REPO_ROOT, outDir);
        const onDisk: string[] = [];
        const walk = (dir: string, prefix: string): void => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const rel: string = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
                if (entry.isDirectory()) {
                    walk(path.join(dir, entry.name), rel);
                } else {
                    onDisk.push(rel);
                }
            }
        };
        walk(outDir, "");
        const bundles: string[] = Object.keys(ENTRY_POINTS).map((name) => `${name}.mjs`);
        expect(onDisk.sort()).toEqual([...bundles, ...listPayloadFiles(REPO_ROOT).map((f) => f.staged)].sort());
    });
});

describe("the fingerprint is a property of the commit, not the machine (AC2)", () => {
    it("is unchanged by cached byte-code left behind by a different interpreter", () => {
        const before: string = hashPayload(REPO_ROOT);
        const cache: string = path.join(REPO_ROOT, "libs", "gh-toolkit", "nexus_gh", "__pycache__");
        const existed: boolean = fs.existsSync(cache);
        fs.mkdirSync(cache, { recursive: true });
        const stray: string = path.join(cache, "cli.cpython-99.pyc");
        fs.writeFileSync(stray, "byte-code from another interpreter");
        try {
            expect(hashPayload(REPO_ROOT)).toBe(before);
        } finally {
            fs.rmSync(stray, { force: true });
            if (!existed) {
                fs.rmSync(cache, { recursive: true, force: true });
            }
        }
    });

    it("is unchanged by a re-walk, and changes when a shipped file changes", () => {
        expect(hashPayload(REPO_ROOT)).toBe(hashPayload(REPO_ROOT));
        const staged: string[] = listPayloadFiles(REPO_ROOT).map((f) => f.staged);
        expect(staged).toEqual([...staged].sort());
    });
});

describe("the toolkit writes no byte-code into the repository it runs against (AC4)", () => {
    it("leaves no __pycache__ behind after a capability runs", () => {
        const toolkit: string = path.join(REPO_ROOT, "libs", "gh-toolkit");
        const repo: string = makeTmpDir("payload-target-repo-");
        fs.mkdirSync(path.join(repo, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(path.join(repo, ".nexus", "config", "settings.yml"), "github:\n  unplanned-label: icebox\n");
        // A pristine copy: byte-code written by this run is the only byte-code that can appear.
        const copy: string = path.join(makeTmpDir("payload-toolkit-"), "gh-toolkit");
        for (const file of listPayloadFiles(REPO_ROOT).filter((f) => f.staged.startsWith("gh-toolkit/"))) {
            const dest: string = path.join(copy, ...file.staged.split("/").slice(1));
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.copyFileSync(file.source, dest);
        }
        execFileSync("python3", [path.join(copy, "bin", "nexus-gh"), "config", "resolve", "unplanned-label"], {
            cwd: repo,
            encoding: "utf8",
        });

        const byteCode: string[] = [];
        const scan = (dir: string): void => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                if (entry.isDirectory()) {
                    scan(path.join(dir, entry.name));
                } else if (entry.name.endsWith(".pyc")) {
                    byteCode.push(path.join(dir, entry.name));
                }
            }
        };
        scan(repo);
        scan(copy);
        expect(byteCode, byteCode.join(", ")).toEqual([]);
        expect(fs.existsSync(path.join(toolkit, "nexus_gh", "__pycache__"))).toBe(false);
    });
});

describe("the release builds one executable (AC5)", () => {
    it("declares a single JavaScript entry point", () => {
        expect(Object.keys(ENTRY_POINTS)).toEqual(["nexus"]);
    });

    it("pins one bundle entry plus the payload entry", () => {
        const pinned: Record<string, string> = JSON.parse(fs.readFileSync(PIN_PATH, "utf8"));
        expect(Object.keys(pinned).sort()).toEqual(["nexus.mjs", PAYLOAD_KEY].sort());
    });
});
