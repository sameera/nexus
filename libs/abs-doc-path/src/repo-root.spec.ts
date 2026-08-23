import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findRepoRoot } from "./repo-root.js";

let tmpDirs: string[] = [];

function makeTmpDir(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "abs-doc-path-root-"));
    tmpDirs.push(dir);
    return dir;
}

afterEach(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});

describe("findRepoRoot", () => {
    it("stops at a directory carrying .git", () => {
        const root: string = makeTmpDir();
        fs.mkdirSync(path.join(root, ".git"));
        const nested: string = path.join(root, "a", "b");
        fs.mkdirSync(nested, { recursive: true });
        expect(findRepoRoot(nested)).toBe(root);
    });

    it("stops at a directory carrying .nexus/config/settings.yml with no .git", () => {
        const root: string = makeTmpDir();
        fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(path.join(root, ".nexus", "config", "settings.yml"), "");
        const nested: string = path.join(root, "a");
        fs.mkdirSync(nested, { recursive: true });
        expect(findRepoRoot(nested)).toBe(root);
    });

    it("falls back to the start directory when no marker is found up to the filesystem root", () => {
        const root: string = makeTmpDir();
        const nested: string = path.join(root, "a", "b");
        fs.mkdirSync(nested, { recursive: true });
        expect(findRepoRoot(nested)).toBe(nested);
    });
});
