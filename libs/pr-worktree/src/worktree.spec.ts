import * as fs from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { openAnalyzeWorktree, openCloseWorktree, removeWorktree } from "./worktree.js";
import { defaultRunner, git } from "./run.js";
import { buildRepoWithOrigin, makeParent, sh } from "./git-fixtures.js";

const tracked: string[] = [];
const worktrees: Array<{ repo: string; path: string }> = [];
afterAll(() => {
    for (const w of worktrees) removeWorktree(defaultRunner, w.repo, w.path);
    for (const d of tracked) fs.rmSync(d, { recursive: true, force: true });
});

describe("openCloseWorktree", () => {
    it("creates a worktree on a fresh distill branch cut from the trunk", () => {
        const { repo, mainSha } = buildRepoWithOrigin(makeParent(tracked));
        const branch = "distill/2026-07-20-x";
        const r = openCloseWorktree(defaultRunner, repo, branch);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        worktrees.push({ repo, path: r.wtPath });
        expect(fs.existsSync(r.wtPath)).toBe(true);
        expect(git(defaultRunner, r.wtPath, "rev-parse", "HEAD")).toBe(mainSha);
        expect(git(defaultRunner, r.wtPath, "rev-parse", "--abbrev-ref", "HEAD")).toBe(branch);
    });

    it("is idempotent on re-run (reuses the existing worktree)", () => {
        const { repo } = buildRepoWithOrigin(makeParent(tracked));
        const branch = "distill/2026-07-20-y";
        const first = openCloseWorktree(defaultRunner, repo, branch);
        expect(first.ok).toBe(true);
        if (!first.ok) return;
        worktrees.push({ repo, path: first.wtPath });
        const second = openCloseWorktree(defaultRunner, repo, branch);
        expect(second.ok).toBe(true);
        if (!second.ok) return;
        expect(second.wtPath).toBe(first.wtPath);
    });
});

describe("openAnalyzeWorktree", () => {
    it("checks out the PR head fetched via pull/<N>/head", () => {
        const { repo } = buildRepoWithOrigin(makeParent(tracked));
        // Simulate a PR: a branch pushed to the conventional pull ref on the origin.
        sh(repo, "git", "checkout", "-q", "-b", "feature");
        const prSha = (() => {
            fs.writeFileSync(`${repo}/pr.txt`, "pr\n");
            sh(repo, "git", "add", "-A");
            sh(repo, "git", "commit", "-qm", "PR work");
            return git(defaultRunner, repo, "rev-parse", "HEAD");
        })();
        sh(repo, "git", "push", "-q", "origin", "feature:refs/pull/1/head");
        sh(repo, "git", "checkout", "-q", "main");

        const r = openAnalyzeWorktree(defaultRunner, repo, 1);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        worktrees.push({ repo, path: r.wtPath });
        expect(r.head).toBe(prSha);
        expect(git(defaultRunner, r.wtPath, "rev-parse", "HEAD")).toBe(prSha);
    });
});

describe("removeWorktree", () => {
    it("removes a worktree and is safe to call twice", () => {
        const { repo } = buildRepoWithOrigin(makeParent(tracked));
        const r = openCloseWorktree(defaultRunner, repo, "distill/2026-07-20-z");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const rm1 = removeWorktree(defaultRunner, repo, r.wtPath);
        expect(rm1.ok).toBe(true);
        expect(fs.existsSync(r.wtPath)).toBe(false);
        const rm2 = removeWorktree(defaultRunner, repo, r.wtPath);
        expect(rm2.ok).toBe(true);
    });
});
