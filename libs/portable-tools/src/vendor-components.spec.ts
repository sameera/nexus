/**
 * Component-payload vendoring (STORY-60.01). The vendored `.claude/` payload is a derived copy
 * of the live root component tree; these specs pin the behaviors that make it safe to ship:
 * the managed set covers exactly the component subtrees (never user-owned files), the payload
 * fingerprint changes whenever any managed byte changes (the drift gate), and a copied payload
 * hashes identically to its source (copy/pin lockstep).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
    COMPONENT_PAYLOAD_KEY,
    COMPONENT_SUBTREES,
    copyComponentTree,
    hashComponentTree,
    listComponentFiles,
    liveClaudeDir,
} from "./vendor-components";

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

/** A miniature live-tree fixture: three managed subtrees plus user-owned files to exclude. */
function makeClaudeFixture(): string {
    const dir: string = makeTmpDir("vendor-components-");
    fs.mkdirSync(path.join(dir, "commands"), { recursive: true });
    fs.mkdirSync(path.join(dir, "agents"), { recursive: true });
    fs.mkdirSync(path.join(dir, "skills", "nxs-setup"), { recursive: true });
    fs.writeFileSync(path.join(dir, "commands", "nxs.epic.md"), "epic command\n");
    fs.writeFileSync(path.join(dir, "agents", "nxs-pm.md"), "pm agent\n");
    fs.writeFileSync(path.join(dir, "skills", "nxs-setup", "SKILL.md"), "setup skill\n");
    // User-owned / non-component files that must never enter the payload:
    fs.writeFileSync(path.join(dir, "settings.local.json"), "{}\n");
    fs.mkdirSync(path.join(dir, "plans"), { recursive: true });
    fs.writeFileSync(path.join(dir, "plans", "scratch.md"), "scratch\n");
    return dir;
}

describe("listComponentFiles", () => {
    it("lists exactly the files under the managed subtrees, sorted, with posix-relative paths", () => {
        const dir: string = makeClaudeFixture();
        expect(listComponentFiles(dir)).toEqual([
            "agents/nxs-pm.md",
            "commands/nxs.epic.md",
            "skills/nxs-setup/SKILL.md",
        ]);
    });

    it("excludes user-owned files outside the managed subtrees (settings.local.json, plans/)", () => {
        const dir: string = makeClaudeFixture();
        const listed: string[] = listComponentFiles(dir);
        expect(listed.some((p) => p.includes("settings.local.json"))).toBe(false);
        expect(listed.some((p) => p.startsWith("plans"))).toBe(false);
    });

    it("tolerates a missing subtree (a payload need not carry all three)", () => {
        const dir: string = makeTmpDir("vendor-components-");
        fs.mkdirSync(path.join(dir, "commands"), { recursive: true });
        fs.writeFileSync(path.join(dir, "commands", "nxs.epic.md"), "x\n");
        expect(listComponentFiles(dir)).toEqual(["commands/nxs.epic.md"]);
    });
});

describe("hashComponentTree", () => {
    it("is deterministic for an unchanged tree", () => {
        const dir: string = makeClaudeFixture();
        expect(hashComponentTree(dir)).toBe(hashComponentTree(dir));
        expect(hashComponentTree(dir)).toMatch(/^[0-9a-f]{64}$/);
    });

    it("changes when a managed file's content changes (the drift gate)", () => {
        const dir: string = makeClaudeFixture();
        const before: string = hashComponentTree(dir);
        fs.writeFileSync(path.join(dir, "commands", "nxs.epic.md"), "doctored\n");
        expect(hashComponentTree(dir)).not.toBe(before);
    });

    it("changes when a managed file is added or removed", () => {
        const dir: string = makeClaudeFixture();
        const before: string = hashComponentTree(dir);
        fs.writeFileSync(path.join(dir, "commands", "nxs.new.md"), "new\n");
        const added: string = hashComponentTree(dir);
        expect(added).not.toBe(before);
        fs.rmSync(path.join(dir, "commands", "nxs.new.md"));
        expect(hashComponentTree(dir)).toBe(before);
    });

    it("ignores changes to user-owned files outside the managed subtrees", () => {
        const dir: string = makeClaudeFixture();
        const before: string = hashComponentTree(dir);
        fs.writeFileSync(path.join(dir, "settings.local.json"), '{"changed":true}\n');
        expect(hashComponentTree(dir)).toBe(before);
    });
});

describe("copyComponentTree", () => {
    it("copies exactly the managed set and the copy hashes identically to its source", () => {
        const src: string = makeClaudeFixture();
        const dest: string = path.join(makeTmpDir("vendor-payload-"), "claude-components");

        const copied: string[] = copyComponentTree(src, dest);

        expect(copied.sort()).toEqual(listComponentFiles(src));
        expect(listComponentFiles(dest)).toEqual(listComponentFiles(src));
        expect(hashComponentTree(dest)).toBe(hashComponentTree(src));
        // User-owned files did not travel.
        expect(fs.existsSync(path.join(dest, "settings.local.json"))).toBe(false);
    });

    it("overwrites a previously vendored payload in place (re-vendor refreshes)", () => {
        const src: string = makeClaudeFixture();
        const dest: string = path.join(makeTmpDir("vendor-payload-"), "claude-components");
        copyComponentTree(src, dest);
        fs.writeFileSync(path.join(dest, "commands", "nxs.epic.md"), "stale\n");

        copyComponentTree(src, dest);

        expect(fs.readFileSync(path.join(dest, "commands", "nxs.epic.md"), "utf8")).toBe("epic command\n");
    });
});

describe("the live component source", () => {
    it("liveClaudeDir points at the repo-root .claude tree and it carries the managed subtrees", () => {
        const live: string = liveClaudeDir(__dirname);
        expect(path.basename(live)).toBe(".claude");
        for (const subtree of COMPONENT_SUBTREES) {
            expect(fs.existsSync(path.join(live, subtree)), `${live}/${subtree}`).toBe(true);
        }
        // The set the retired update script installed: nxs-prefixed components are present.
        const files: string[] = listComponentFiles(live);
        expect(files.some((p) => p === "commands/nxs.setup.md")).toBe(true);
        expect(files.some((p) => p.startsWith("skills/nxs-workspace-status/"))).toBe(true);
    });

    it("exposes the payload pin key", () => {
        expect(COMPONENT_PAYLOAD_KEY).toBe("claude-components");
    });
});
