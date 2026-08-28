/**
 * Where the --pr flow's worktrees are created (epic #178).
 *
 * The base is declared config resolved through the shared publishing resolver, so these specs
 * drive it the way an operator does — a `worktree-path` key in the repo's settings.yml — and assert
 * on the location the flow actually opens a worktree at, not on the resolution internals.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { builtinWorktreeBase, openAnalyzeWorktree, openCloseWorktree, removeWorktree } from "./worktree.js";
import { type Runner, defaultRunner } from "./run.js";
import { buildRepoWithOrigin, declareGithubKey, makeParent, sh } from "./git-fixtures.js";

const tracked: string[] = [];
const worktrees: Array<{ repo: string; path: string }> = [];
afterAll(() => {
    for (const w of worktrees) removeWorktree(defaultRunner, w.repo, w.path);
    for (const d of tracked) fs.rmSync(d, { recursive: true, force: true });
});

/** Register a worktree for teardown and return its path. */
function opened(repo: string, wtPath: string): string {
    worktrees.push({ repo, path: wtPath });
    return wtPath;
}

/** A repo whose origin carries `pull/1/head`, so the analyze worktree can be opened against it. */
function repoWithPr(): string {
    const { repo } = buildRepoWithOrigin(makeParent(tracked));
    sh(repo, "git", "checkout", "-q", "-b", "feature");
    fs.writeFileSync(path.join(repo, "pr.txt"), "pr\n");
    sh(repo, "git", "add", "-A");
    sh(repo, "git", "commit", "-qm", "PR work");
    sh(repo, "git", "push", "-q", "origin", "feature:refs/pull/1/head");
    sh(repo, "git", "checkout", "-q", "main");
    return repo;
}

/** A directory outside any repo, cleaned up with the rest of the fixtures. */
function outsideDir(name: string): string {
    const dir = path.join(makeParent(tracked), name);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

describe("a repo declares where its --pr worktrees are created", () => {
    it("creates the analyze worktree inside a declared absolute base", () => {
        const repo = repoWithPr();
        const base = outsideDir("declared-base");
        declareGithubKey(repo, "worktree-path", base);

        const r = openAnalyzeWorktree(defaultRunner, repo, 1);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        opened(repo, r.wtPath);
        expect(r.wtPath.startsWith(base + path.sep)).toBe(true);
        expect(fs.existsSync(r.wtPath)).toBe(true);
    });

    it("resolves a relative base against the repo root, not the working directory", () => {
        const repo = repoWithPr();
        // A sibling of the repo, named relatively: only a repo-root anchor lands here.
        declareGithubKey(repo, "worktree-path", "../relative-base");
        const expected = path.resolve(repo, "../relative-base");

        const r = openAnalyzeWorktree(defaultRunner, repo, 1);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        opened(repo, r.wtPath);
        expect(r.wtPath.startsWith(expected + path.sep)).toBe(true);
        expect(r.wtPath.startsWith(path.resolve(process.cwd(), "../relative-base"))).toBe(false);
    });

    it("falls back to the system-temp base, character for character, when nothing is declared", () => {
        const repo = repoWithPr();
        // The location this flow has always used: <tmp>/nexus-pr-worktrees/<per-checkout slug>.
        const slug = path.resolve(repo).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        const expected = path.join(os.tmpdir(), "nexus-pr-worktrees", slug, "pr-1-analyze");

        const r = openAnalyzeWorktree(defaultRunner, repo, 1);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        opened(repo, r.wtPath);
        expect(r.wtPath).toBe(expected);
    });

    it("keeps two checkouts pointed at one base from colliding", () => {
        const base = outsideDir("shared-base");
        const first = repoWithPr();
        const second = repoWithPr();
        declareGithubKey(first, "worktree-path", base);
        declareGithubKey(second, "worktree-path", base);

        const a = openAnalyzeWorktree(defaultRunner, first, 1);
        const b = openAnalyzeWorktree(defaultRunner, second, 1);
        expect(a.ok && b.ok).toBe(true);
        if (!a.ok || !b.ok) return;
        opened(first, a.wtPath);
        opened(second, b.wtPath);
        expect(a.wtPath).not.toBe(b.wtPath);
    });

    it("opens the close worktree inside the same declared base as analyze", () => {
        const repo = repoWithPr();
        const base = outsideDir("whole-flow-base");
        declareGithubKey(repo, "worktree-path", base);

        const analyze = openAnalyzeWorktree(defaultRunner, repo, 1);
        const close = openCloseWorktree(defaultRunner, repo, "distill/2026-07-31-a");
        expect(analyze.ok && close.ok).toBe(true);
        if (!analyze.ok || !close.ok) return;
        opened(repo, analyze.wtPath);
        opened(repo, close.wtPath);
        expect(path.dirname(close.wtPath)).toBe(path.dirname(analyze.wtPath));
        expect(close.wtPath.startsWith(base + path.sep)).toBe(true);
    });

    it("reuses a worktree already created under the declared base, and still removes it", () => {
        const repo = repoWithPr();
        const base = outsideDir("reuse-base");
        declareGithubKey(repo, "worktree-path", base);

        const first = openCloseWorktree(defaultRunner, repo, "distill/2026-07-31-b");
        expect(first.ok).toBe(true);
        if (!first.ok) return;
        const second = openCloseWorktree(defaultRunner, repo, "distill/2026-07-31-b");
        expect(second.ok).toBe(true);
        if (!second.ok) return;
        expect(second.wtPath).toBe(first.wtPath);

        const removed = removeWorktree(defaultRunner, repo, first.wtPath);
        expect(removed.ok).toBe(true);
        expect(fs.existsSync(first.wtPath)).toBe(false);
    });

    it("expands a quoted, home-relative base rather than creating a literal directory for it", () => {
        const repo = repoWithPr();
        const home = outsideDir("fake-home");
        const r = openCloseWorktreeWithHome(repo, home, `  "~/wt"  `);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        opened(repo, r.wtPath);
        expect(r.wtPath.startsWith(path.join(home, "wt") + path.sep)).toBe(true);
    });

    it("takes the built-in base from a checkout that declares nothing, spawning no resolver", () => {
        const repo = repoWithPr();
        const spawned: string[] = [];
        const watched: Runner = (cmd, args, opts) => {
            spawned.push(cmd);
            return defaultRunner(cmd, args, opts);
        };

        const r = openAnalyzeWorktree(watched, repo, 1);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        opened(repo, r.wtPath);
        expect(r.wtPath.startsWith(builtinWorktreeBase() + path.sep)).toBe(true);
        expect(spawned).not.toContain("python3");
        expect(spawned).not.toContain("nexus-gh");
    });
});

describe("an unusable configured base stops the run", () => {
    /** Everything git can see about the checkout — the "left as it was found" evidence. */
    function snapshot(repo: string): { status: string; worktrees: string } {
        return {
            status: sh(repo, "git", "status", "--porcelain"),
            worktrees: sh(repo, "git", "worktree", "list", "--porcelain"),
        };
    }

    it("refuses a base inside the repo that git does not ignore, creating nothing", () => {
        const repo = repoWithPr();
        const base = path.join(repo, "build", "worktrees");
        declareGithubKey(repo, "worktree-path", base);
        const before = snapshot(repo);

        const r = openAnalyzeWorktree(defaultRunner, repo, 1);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("worktree-base-in-repo");
        expect(r.error.message).toContain(base);
        expect(fs.existsSync(base)).toBe(false);
        expect(snapshot(repo)).toEqual(before);
    });

    it("allows a base inside the repo once git ignores it", () => {
        const repo = repoWithPr();
        const base = path.join(repo, "ignored-worktrees");
        fs.writeFileSync(path.join(repo, ".gitignore"), "ignored-worktrees/\n");
        declareGithubKey(repo, "worktree-path", base);

        const r = openAnalyzeWorktree(defaultRunner, repo, 1);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        opened(repo, r.wtPath);
        expect(r.wtPath.startsWith(base + path.sep)).toBe(true);
        expect(fs.existsSync(r.wtPath)).toBe(true);
    });

    it("reports why a base cannot be created instead of throwing", () => {
        const repo = repoWithPr();
        const blocker = path.join(makeParent(tracked), "not-a-directory");
        fs.writeFileSync(blocker, "I am a file\n");
        const base = path.join(blocker, "worktrees");
        declareGithubKey(repo, "worktree-path", base);
        const before = snapshot(repo);

        const r = openCloseWorktree(defaultRunner, repo, "distill/2026-07-31-d");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("worktree-base-uncreatable");
        expect(r.error.message).toContain(base);
        expect(r.error.message).toContain("ENOTDIR");
        expect(snapshot(repo)).toEqual(before);
    });

    it("reports a permission failure the same way", () => {
        if (process.getuid?.() === 0) return; // root ignores the mode bits; nothing to observe
        const repo = repoWithPr();
        const locked = path.join(makeParent(tracked), "locked");
        fs.mkdirSync(locked, { recursive: true, mode: 0o500 });
        const base = path.join(locked, "worktrees");
        declareGithubKey(repo, "worktree-path", base);

        const r = openCloseWorktree(defaultRunner, repo, "distill/2026-07-31-e");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("worktree-base-uncreatable");
        expect(r.error.message).toContain("EACCES");
        expect(sh(repo, "git", "worktree", "list", "--porcelain")).not.toContain(base);
    });
});

/**
 * Open a close worktree with `$HOME` pointed at `home`, so home-shorthand expansion is observable
 * without depending on the developer's real home directory.
 */
function openCloseWorktreeWithHome(repo: string, home: string, declared: string) {
    declareGithubKey(repo, "worktree-path", declared);
    const realHome = process.env.HOME;
    process.env.HOME = home;
    try {
        return openCloseWorktree(defaultRunner, repo, "distill/2026-07-31-c");
    } finally {
        if (realHome === undefined) delete process.env.HOME;
        else process.env.HOME = realHome;
    }
}
