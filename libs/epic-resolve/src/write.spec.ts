import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultOutPath, writeMaterializedEpic } from "./write.js";

let tmpDirs: string[] = [];

afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs = [];
});

/** A committed git repo whose .gitignore excludes `.nexus/tmp/` — the AC3 fixture. */
function scratchRepo(): string {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "epic-resolve-write-"));
    tmpDirs.push(repo);
    fs.writeFileSync(path.join(repo, ".gitignore"), ".nexus/tmp/\n");
    execFileSync("git", ["init", "-q"], { cwd: repo, stdio: "ignore" });
    execFileSync("git", ["config", "user.email", "t@example.com"], { cwd: repo, stdio: "ignore" });
    execFileSync("git", ["config", "user.name", "T"], { cwd: repo, stdio: "ignore" });
    execFileSync("git", ["add", "-A"], { cwd: repo, stdio: "ignore" });
    execFileSync("git", ["commit", "-q", "-m", "base"], { cwd: repo, stdio: "ignore" });
    return repo;
}

describe("defaultOutPath", () => {
    it("keys the path on the epic number under the gitignored .nexus/tmp dir", () => {
        expect(defaultOutPath("/repo", 115)).toBe(path.join("/repo", ".nexus", "tmp", "epic-115", "epic.md"));
    });
});

describe("writeMaterializedEpic — AC3: ephemeral / no new tracked file", () => {
    it("writes the epic and leaves git status clean (the output is gitignored)", () => {
        const repo = scratchRepo();
        const out = writeMaterializedEpic(repo, 115, "---\nepic: \"X\"\nlink: \"#115\"\n---\n");
        expect(out).toBe(defaultOutPath(repo, 115));
        expect(fs.readFileSync(out, "utf8")).toContain('link: "#115"');
        const status = execFileSync("git", ["status", "--porcelain"], { cwd: repo, encoding: "utf8" });
        expect(status.trim()).toBe("");
    });

    it("honors an explicit out path and creates parent directories", () => {
        const repo = scratchRepo();
        const explicit = path.join(repo, ".nexus", "tmp", "custom", "e.md");
        const out = writeMaterializedEpic(repo, 115, "content", explicit);
        expect(out).toBe(explicit);
        expect(fs.existsSync(explicit)).toBe(true);
    });
});
