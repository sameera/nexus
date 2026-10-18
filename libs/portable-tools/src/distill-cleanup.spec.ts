/**
 * `nexus distill cleanup <epic>` (epic #952, story #954, decision record #956: D5, D6, D9).
 *
 * Every spec runs against a real git repository, so what a lead sees is real: the worktrees git
 * lists afterwards, the branches that still exist, the run folder and the printed lines.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { cleanupDeps, runDistillCleanup } from "./distill-cleanup.js";
import { runFiles, type DistillIo } from "./distill-command.js";
import { runNexusCli } from "./nexus-cli.js";

const tmp: string[] = [];
afterEach(() => {
    for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
function makeDir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-distill-cleanup-"));
    tmp.push(d);
    return fs.realpathSync(d);
}

const EPIC = 830;
const BRANCH = `distill/2026-10-04-epic-${EPIC}`;

function git(cwd: string, ...args: string[]): string {
    return spawnSync("git", args, { cwd, encoding: "utf8" }).stdout;
}

/** A single-repo checkout with one commit and the run folder ignored, as close leaves it. */
function makeRepo(): string {
    const repo = makeDir();
    git(repo, "init", "-q", "-b", "main");
    fs.writeFileSync(path.join(repo, ".gitignore"), ".nexus/tmp/\n");
    git(repo, "add", ".gitignore");
    git(repo, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init");
    return repo;
}

/** A worktree on `branch`, created the way close creates the distillation worktree. */
function addWorktree(repo: string, branch: string): string {
    const wt = path.join(makeDir(), "wt");
    git(repo, "worktree", "add", "-q", "-b", branch, wt);
    return fs.realpathSync(wt);
}

/** The worktrees git lists for the repository, the main one included. */
function listed(repo: string): string[] {
    return git(repo, "worktree", "list", "--porcelain")
        .split("\n")
        .filter((l) => l.startsWith("worktree "))
        .map((l) => fs.realpathSync(l.slice("worktree ".length)));
}

function branches(repo: string): string[] {
    return git(repo, "branch", "--list", "--format=%(refname:short)").split("\n").filter((b) => b !== "");
}

function recordOf(repo: string, epic: number): string {
    const dir = runFiles(repo, epic).dir;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "outcome.txt"), "earlier outcome\n");
    return dir;
}

function cleanup(epic: number, cwd: string): { code: number; out: string; err: string } {
    const out: string[] = [];
    const err: string[] = [];
    const io: DistillIo = { stdout: (l) => out.push(l), stderr: (l) => err.push(l) };
    const code = runDistillCleanup(
        cleanupDeps((cmd, args, opts) => {
            const r = spawnSync(cmd, args, { cwd: opts.cwd, encoding: "utf8" });
            return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
        }),
        epic,
        cwd,
        io,
    );
    return { code, out: out.join("\n"), err: err.join("\n") };
}

describe("nexus distill cleanup — the epic's distill worktree is removed by its number (AC1, AC2, AC4, G9, G12, G13)", () => {
    it("removes the worktree, says which path it removed, and leaves the branch and the main checkout alone", () => {
        const repo = makeRepo();
        const wt = addWorktree(repo, BRANCH);
        const { code, out } = cleanup(EPIC, repo);
        expect(code).toBe(0);
        expect(out).toContain(wt);
        expect(listed(repo)).not.toContain(wt);
        expect(listed(repo)).toContain(repo);
        expect(branches(repo)).toContain(BRANCH);
    });

    it("removes a worktree that has uncommitted changes", () => {
        const repo = makeRepo();
        const wt = addWorktree(repo, BRANCH);
        fs.writeFileSync(path.join(wt, "scratch.txt"), "unsaved\n");
        expect(cleanup(EPIC, repo).code).toBe(0);
        expect(listed(repo)).not.toContain(wt);
    });

    it("removes it when run from inside the worktree", () => {
        const repo = makeRepo();
        const wt = addWorktree(repo, BRANCH);
        const { code, err } = cleanup(EPIC, wt);
        expect(code).toBe(0);
        expect(err).toBe("");
        expect(listed(repo)).not.toContain(wt);
    });

    it("removes every worktree on any of the epic's distillation branches, and no other branch's", () => {
        const repo = makeRepo();
        const earlier = addWorktree(repo, "distill/2026-10-03-epic-830");
        const later = addWorktree(repo, BRANCH);
        const other = addWorktree(repo, "distill/2026-10-04-epic-8301");
        const feature = addWorktree(repo, "feature/x");
        cleanup(EPIC, repo);
        expect(listed(repo)).not.toContain(earlier);
        expect(listed(repo)).not.toContain(later);
        expect(listed(repo)).toContain(other);
        expect(listed(repo)).toContain(feature);
    });
});

describe("nexus distill cleanup — nothing to remove is not a failure (AC3, G11)", () => {
    it("says no worktree was found and exits 0, with no network read", () => {
        const repo = makeRepo();
        git(repo, "remote", "add", "origin", path.join(makeDir(), "gone.git"));
        const { code, out, err } = cleanup(EPIC, repo);
        expect(code).toBe(0);
        expect(out).toMatch(/no distill worktree was found for epic 830/);
        expect(err).toBe("");
    });
});

describe("nexus distill cleanup — a live run is never disturbed (AC6, G14)", () => {
    it("removes nothing, names the running process, and exits non-zero", () => {
        const repo = makeRepo();
        const wt = addWorktree(repo, BRANCH);
        const files = runFiles(repo, EPIC);
        fs.mkdirSync(files.dir, { recursive: true });
        fs.writeFileSync(files.marker, `${process.pid}\n`);
        const { code, err } = cleanup(EPIC, repo);
        expect(code).not.toBe(0);
        expect(err).toContain(`process ${process.pid}`);
        expect(listed(repo)).toContain(wt);
        expect(fs.existsSync(files.marker)).toBe(true);
    });

    it("is not blocked by a marker whose process no longer exists", () => {
        const repo = makeRepo();
        const wt = addWorktree(repo, BRANCH);
        const files = runFiles(repo, EPIC);
        fs.mkdirSync(files.dir, { recursive: true });
        fs.writeFileSync(files.marker, "2147483646\n");
        expect(cleanup(EPIC, repo).code).toBe(0);
        expect(listed(repo)).not.toContain(wt);
    });
});

describe("nexus distill cleanup — the run record goes with the worktree, and only the epic's own (AC7, G11, G16)", () => {
    it("deletes this epic's run record after the worktree, and no other epic's", () => {
        const repo = makeRepo();
        addWorktree(repo, BRANCH);
        const mine = recordOf(repo, EPIC);
        const theirs = recordOf(repo, 831);
        const { code, out } = cleanup(EPIC, repo);
        expect(code).toBe(0);
        expect(out).toContain(mine);
        expect(fs.existsSync(mine)).toBe(false);
        expect(fs.existsSync(theirs)).toBe(true);
    });

    it("removes a left-over run record even when no worktree remains", () => {
        const repo = makeRepo();
        const mine = recordOf(repo, EPIC);
        expect(cleanup(EPIC, repo).code).toBe(0);
        expect(fs.existsSync(mine)).toBe(false);
    });
});

describe("nexus distill cleanup — arguments (G10)", () => {
    async function cli(argv: string[]): Promise<{ code: number; err: string }> {
        const err: string[] = [];
        const code = await runNexusCli(["distill", "cleanup", ...argv], { cwd: makeRepo(), stdout: () => undefined, stderr: (l) => err.push(l) });
        return { code, err: err.join("\n") };
    }

    it("needs one epic number, and accepts #N", async () => {
        expect((await cli([])).code).toBe(2);
        expect((await cli(["owner/repo#830"])).code).toBe(2);
        expect((await cli(["abc"])).code).toBe(2);
        expect((await cli(["#830"])).code).toBe(0);
    });
});
