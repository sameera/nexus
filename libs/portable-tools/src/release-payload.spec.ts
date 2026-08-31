/**
 * The payload is a stated set (story #309). These tests pin the three properties that follow
 * from stating it: nothing incidental ships, the fingerprint is a property of the commit rather
 * than of the machine, and the build produces one executable.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ENTRY_POINTS } from "./build-bundles";
import { BIN_NAMES, buildReleaseTree } from "./pack-release";
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
    // Story #392: every entry the filter carried excluded an interpreter's byte-code or an
    // interpreter's tests, and the payload no longer walks a tree that can hold either.
    it("names no category that can never match again", () => {
        expect([...PAYLOAD_IGNORE]).toEqual([]);
    });

    it("excludes nothing the payload would otherwise ship", () => {
        for (const kept of ["nxs.epic.md", "SKILL.md", "nxs-architect.md", "tests", "__pycache__"]) {
            expect(isIgnoredPayloadEntry(kept), kept).toBe(false);
        }
    });
});

describe("the shipped payload carries nothing incidental (AC1)", () => {
    it("carries no interpreter artefact and nothing under the withdrawn toolkit directory", () => {
        const staged: string[] = listPayloadFiles(REPO_ROOT).map((f) => f.staged);
        expect(staged.filter((f) => f.startsWith("gh-toolkit/"))).toEqual([]);
        expect(staged.filter((f) => f.endsWith(".py"))).toEqual([]);
        expect(staged.filter((f) => f.endsWith(".pyc"))).toEqual([]);
        expect(staged.filter((f) => f.includes("__pycache__"))).toEqual([]);
    });

    it("carries the component tree", () => {
        const staged: string[] = listPayloadFiles(REPO_ROOT).map((f) => f.staged);
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
    it("is unchanged by a re-walk, and changes when a shipped file changes", () => {
        expect(hashPayload(REPO_ROOT)).toBe(hashPayload(REPO_ROOT));
        const staged: string[] = listPayloadFiles(REPO_ROOT).map((f) => f.staged);
        expect(staged).toEqual([...staged].sort());
    });
});

describe("the release builds one bundle per declared toolkit name (AC5, story #355)", () => {
    it("declares one JavaScript entry point per binary the manifest names", () => {
        expect(Object.keys(ENTRY_POINTS).sort()).toEqual([...BIN_NAMES].sort());
    });

    it("pins one entry per bundle plus the payload entry", () => {
        const pinned: Record<string, string> = JSON.parse(fs.readFileSync(PIN_PATH, "utf8"));
        expect(Object.keys(pinned).sort()).toEqual([...BIN_NAMES.map((n) => `${n}.mjs`), PAYLOAD_KEY].sort());
    });
});
