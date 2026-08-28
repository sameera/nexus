/**
 * `nexus migrate-components` (story #315): a repository owner removes the committed Nexus
 * components deliberately, and is never surprised by tracked files disappearing from a branch they
 * were working on.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CONFIG_DIR_VAR } from "./install-location";
import { runNexusCli, type CliIo } from "./nexus-cli";

let tmpDirs: string[] = [];
function makeTmpDir(prefix: string): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmpDirs.push(dir);
    return dir;
}

let priorConfigDir: string | undefined;
beforeEach(() => {
    priorConfigDir = process.env[CONFIG_DIR_VAR];
});
afterEach(() => {
    if (priorConfigDir === undefined) {
        delete process.env[CONFIG_DIR_VAR];
    } else {
        process.env[CONFIG_DIR_VAR] = priorConfigDir;
    }
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});

interface CapturedIo extends CliIo {
    out: string[];
    err: string[];
}
function makeIo(cwd: string): CapturedIo {
    const out: string[] = [];
    const err: string[] = [];
    return {
        cwd,
        out,
        err,
        stdout: (s: string): void => {
            out.push(s);
        },
        stderr: (s: string): void => {
            err.push(s);
        },
    };
}

function git(repo: string, ...args: string[]): string {
    return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" });
}

/** A repository whose `.claude/` carries a committed component set, plus files Nexus does not own. */
function makeRepo(): string {
    const repo: string = makeTmpDir("migrate-repo-");
    git(repo, "init", "--quiet", "--initial-branch", "main");
    git(repo, "config", "user.email", "owner@example.com");
    git(repo, "config", "user.name", "Owner");
    fs.mkdirSync(path.join(repo, ".claude", "commands"), { recursive: true });
    fs.mkdirSync(path.join(repo, ".claude", "skills", "nxs-setup"), { recursive: true });
    fs.writeFileSync(path.join(repo, ".claude", "commands", "nxs.epic.md"), "epic\n");
    fs.writeFileSync(path.join(repo, ".claude", "commands", "my-own.md"), "mine\n");
    fs.writeFileSync(path.join(repo, ".claude", "skills", "nxs-setup", "SKILL.md"), "setup\n");
    // A Nexus-named file at the component directory's own root — the widening this verb needs.
    fs.writeFileSync(path.join(repo, ".claude", "nxs-abs-doc-path.md"), "root-level\n");
    fs.writeFileSync(path.join(repo, ".claude", "settings.local.json"), '{"local":true}');
    fs.writeFileSync(path.join(repo, "README.md"), "readme\n");
    git(repo, "add", "-A");
    git(repo, "commit", "--quiet", "-m", "initial");
    return repo;
}

/** An install location holding a copied component set, so the verb's gate is satisfied. */
function makeInstalled(): string {
    const location: string = makeTmpDir("migrate-location-");
    fs.mkdirSync(path.join(location, "commands"), { recursive: true });
    fs.writeFileSync(path.join(location, "commands", "nxs.epic.md"), "epic\n");
    process.env[CONFIG_DIR_VAR] = location;
    return location;
}

describe("nexus migrate-components", () => {
    it("removes nothing and says to install first when the install location is empty (AC1)", async () => {
        const repo: string = makeRepo();
        process.env[CONFIG_DIR_VAR] = makeTmpDir("migrate-empty-location-");
        const io: CapturedIo = makeIo(repo);

        const code: number = await runNexusCli(["migrate-components"], io);

        expect(code).toBe(1);
        expect(fs.existsSync(path.join(repo, ".claude", "commands", "nxs.epic.md"))).toBe(true);
        expect(io.err.join("\n")).toContain("nexus install");
    });

    it("removes nothing when the configuration-directory value is unusable (AC1)", async () => {
        const repo: string = makeRepo();
        process.env[CONFIG_DIR_VAR] = "relative/config";

        const io: CapturedIo = makeIo(repo);
        const code: number = await runNexusCli(["migrate-components"], io);

        expect(code).toBe(1);
        expect(fs.existsSync(path.join(repo, ".claude", "commands", "nxs.epic.md"))).toBe(true);
    });

    it("reports the location and which content it holds before removing anything (AC2)", async () => {
        const repo: string = makeRepo();
        const location: string = makeInstalled();
        const io: CapturedIo = makeIo(repo);

        await runNexusCli(["migrate-components"], io);

        const before: string = io.out.slice(0, 2).join("\n");
        expect(before).toContain(location);
        expect(before.toLowerCase()).toContain("copied release");
    });

    it("names the checkout when the install location points at one (AC2)", async () => {
        const repo: string = makeRepo();
        const checkout: string = makeTmpDir("migrate-checkout-");
        fs.mkdirSync(path.join(checkout, ".claude", "commands"), { recursive: true });
        fs.writeFileSync(path.join(checkout, ".claude", "commands", "nxs.epic.md"), "authored\n");
        const location: string = makeTmpDir("migrate-pointing-");
        process.env[CONFIG_DIR_VAR] = location;
        await runNexusCli(["install", "--from-checkout", checkout], makeIo(makeTmpDir("migrate-cwd-")));

        const io: CapturedIo = makeIo(repo);
        await runNexusCli(["migrate-components"], io);

        expect(io.out.join("\n")).toContain(checkout);
    });

    it("removes namespaced files under the subtrees and at the component root (AC3)", async () => {
        const repo: string = makeRepo();
        makeInstalled();

        const code: number = await runNexusCli(["migrate-components"], makeIo(repo));

        expect(code).toBe(0);
        expect(fs.existsSync(path.join(repo, ".claude", "commands", "nxs.epic.md"))).toBe(false);
        expect(fs.existsSync(path.join(repo, ".claude", "skills", "nxs-setup"))).toBe(false);
        expect(fs.existsSync(path.join(repo, ".claude", "nxs-abs-doc-path.md"))).toBe(false);
    });

    it("leaves files under .claude/ that Nexus does not own untouched (AC4)", async () => {
        const repo: string = makeRepo();
        makeInstalled();

        await runNexusCli(["migrate-components"], makeIo(repo));

        expect(fs.readFileSync(path.join(repo, ".claude", "commands", "my-own.md"), "utf8")).toBe("mine\n");
        expect(fs.readFileSync(path.join(repo, ".claude", "settings.local.json"), "utf8")).toBe('{"local":true}');
    });

    it("leaves the removals unstaged, makes no commit, and prints scoped git commands (AC5)", async () => {
        const repo: string = makeRepo();
        makeInstalled();
        const headBefore: string = git(repo, "rev-parse", "HEAD").trim();
        const io: CapturedIo = makeIo(repo);

        await runNexusCli(["migrate-components"], io);

        expect(git(repo, "rev-parse", "HEAD").trim()).toBe(headBefore);
        // Every removal shows in the working tree, none in the index.
        expect(git(repo, "diff", "--name-only", "--cached").trim()).toBe("");
        expect(git(repo, "diff", "--name-only").trim()).toContain(".claude/commands/nxs.epic.md");
        const printed: string = io.out.join("\n");
        expect(printed).toContain("git add -- .claude .gitignore");
        expect(printed).toContain("git commit");
        // Nothing that would sweep the owner's other work into the same commit.
        expect(printed).not.toMatch(/git add\s+(-A\s*$|\.\s*$)/m);
    });

    it("adds namespaced ignore entries for the three subtrees and no blanket ignore (AC6)", async () => {
        const repo: string = makeRepo();
        makeInstalled();

        await runNexusCli(["migrate-components"], makeIo(repo));

        const ignore: string = fs.readFileSync(path.join(repo, ".gitignore"), "utf8");
        for (const subtree of ["commands", "agents", "skills"]) {
            expect(ignore).toContain(`.claude/${subtree}/nxs.*`);
            expect(ignore).toContain(`.claude/${subtree}/nxs-*`);
        }
        expect(ignore.split("\n").map((line) => line.trim())).not.toContain(".claude/");
        expect(ignore.split("\n").map((line) => line.trim())).not.toContain(".claude");
    });

    it("appends the ignore entries once and rewrites nothing already there", async () => {
        const repo: string = makeRepo();
        makeInstalled();
        fs.writeFileSync(path.join(repo, ".gitignore"), "node_modules\n.claude/commands/nxs.*\n");

        await runNexusCli(["migrate-components"], makeIo(repo));
        const afterFirst: string = fs.readFileSync(path.join(repo, ".gitignore"), "utf8");
        await runNexusCli(["migrate-components"], makeIo(repo));

        expect(fs.readFileSync(path.join(repo, ".gitignore"), "utf8")).toBe(afterFirst);
        expect(afterFirst.startsWith("node_modules\n.claude/commands/nxs.*\n")).toBe(true);
        expect(afterFirst.split("\n").filter((line) => line === ".claude/commands/nxs.*")).toHaveLength(1);
    });

    it("leaves untracked namespaced files in place and names the command that would remove them", async () => {
        const repo: string = makeRepo();
        makeInstalled();
        fs.writeFileSync(path.join(repo, ".claude", "commands", "nxs.scratch.md"), "untracked\n");
        const io: CapturedIo = makeIo(repo);

        await runNexusCli(["migrate-components"], io);

        expect(fs.existsSync(path.join(repo, ".claude", "commands", "nxs.scratch.md"))).toBe(true);
        expect(io.out.join("\n")).toContain("commands/nxs.scratch.md");
    });

    it("refuses outside a git work tree", async () => {
        const notARepo: string = makeTmpDir("migrate-bare-");
        fs.mkdirSync(path.join(notARepo, ".claude", "commands"), { recursive: true });
        fs.writeFileSync(path.join(notARepo, ".claude", "commands", "nxs.epic.md"), "epic\n");
        makeInstalled();
        const io: CapturedIo = makeIo(notARepo);

        const code: number = await runNexusCli(["migrate-components"], io);

        expect(code).toBe(1);
        expect(fs.existsSync(path.join(notARepo, ".claude", "commands", "nxs.epic.md"))).toBe(true);
        expect(io.err.join("\n")).toContain("git work tree");
    });
});
