import * as fs from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { findEpicDistillBranch, openAnalyzeWorktree, openCloseWorktree, openEpicDistillWorktree, pushEpicDistillBranch, removeWorktree } from "./worktree.js";
import { defaultRunner, git } from "./run.js";
import { buildForkWithUpstream, buildRepoWithOrigin, makeParent, sh } from "./git-fixtures.js";

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

// Epic #830, story #864 (decision record #872, Mechanism step 4, D11): close reuses the distill
// branch an earlier run cut for the same epic, local or pushed, and never cuts a second one.
describe("openEpicDistillWorktree", () => {
    it("cuts a fresh distill branch named for the epic from the trunk when no earlier run cut one", () => {
        const { repo, mainSha } = buildRepoWithOrigin(makeParent(tracked));
        const r = openEpicDistillWorktree(defaultRunner, repo, 830, "2026-10-04");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        worktrees.push({ repo, path: r.wtPath });
        expect(r.branch).toBe("distill/2026-10-04-epic-830");
        expect(r.source).toBe("new");
        expect(git(defaultRunner, r.wtPath, "rev-parse", "HEAD")).toBe(mainSha);
    });

    it("reuses the branch an earlier run cut on another day, and its worktree", () => {
        const { repo } = buildRepoWithOrigin(makeParent(tracked));
        const first = openEpicDistillWorktree(defaultRunner, repo, 830, "2026-10-03");
        expect(first.ok).toBe(true);
        if (!first.ok) return;
        worktrees.push({ repo, path: first.wtPath });
        const second = openEpicDistillWorktree(defaultRunner, repo, 830, "2026-10-04");
        expect(second.ok).toBe(true);
        if (!second.ok) return;
        expect(second.branch).toBe("distill/2026-10-03-epic-830");
        expect(second.source).toBe("local");
        expect(second.wtPath).toBe(first.wtPath);
        const branches = sh(repo, "git", "for-each-ref", "--format=%(refname:short)", "refs/heads/distill/").split("\n");
        expect(branches).toEqual(["distill/2026-10-03-epic-830"]);
    });

    it("reuses a branch an earlier run only pushed, with the commits it carries", () => {
        const { repo, origin } = buildRepoWithOrigin(makeParent(tracked));
        // Another machine's earlier run: a pushed distill branch with a commit on it.
        sh(repo, "git", "checkout", "-q", "-b", "distill/2026-10-02-epic-830");
        fs.writeFileSync(`${repo}/entry.md`, "entry\n");
        sh(repo, "git", "add", "-A");
        sh(repo, "git", "commit", "-qm", "close: earlier run");
        const pushedSha = git(defaultRunner, repo, "rev-parse", "HEAD");
        sh(repo, "git", "push", "-q", "origin", "distill/2026-10-02-epic-830");
        sh(repo, "git", "checkout", "-q", "main");
        sh(repo, "git", "branch", "-q", "-D", "distill/2026-10-02-epic-830");
        expect(origin).toBeTruthy();

        const r = openEpicDistillWorktree(defaultRunner, repo, 830, "2026-10-04");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        worktrees.push({ repo, path: r.wtPath });
        expect(r.branch).toBe("distill/2026-10-02-epic-830");
        expect(r.source).toBe("pushed");
        expect(git(defaultRunner, r.wtPath, "rev-parse", "HEAD")).toBe(pushedSha);
    });

    it("ignores a distill branch another epic's close cut", () => {
        const { repo } = buildRepoWithOrigin(makeParent(tracked));
        sh(repo, "git", "branch", "distill/2026-10-01-epic-8300");
        sh(repo, "git", "branch", "distill/2026-10-01-epic-83");
        const r = openEpicDistillWorktree(defaultRunner, repo, 830, "2026-10-04");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        worktrees.push({ repo, path: r.wtPath });
        expect(r.branch).toBe("distill/2026-10-04-epic-830");
    });

    it("creates nothing when the push remote cannot be read, because a fresh branch could be the second one", () => {
        const { repo, origin } = buildRepoWithOrigin(makeParent(tracked));
        fs.rmSync(origin, { recursive: true, force: true });
        const r = openEpicDistillWorktree(defaultRunner, repo, 830, "2026-10-04");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.message).toContain("origin");
        expect(sh(repo, "git", "for-each-ref", "--format=%(refname:short)", "refs/heads/distill/")).toBe("");
    });
});

// Epic #830, story #867 (decision record #872, D13): recovery asks, before any write, whether an
// earlier close left a distill branch for the epic, and creates nothing to find out.
describe("findEpicDistillBranch", () => {
    it("finds a local branch, then a pushed one, and fetches or creates nothing", () => {
        const { repo } = buildRepoWithOrigin(makeParent(tracked));
        expect(findEpicDistillBranch(defaultRunner, repo, 830)).toEqual({ ok: true, branch: null });

        sh(repo, "git", "push", "-q", "origin", "main:refs/heads/distill/2026-10-02-epic-830");
        expect(findEpicDistillBranch(defaultRunner, repo, 830)).toEqual({ ok: true, branch: "distill/2026-10-02-epic-830", source: "pushed" });
        expect(sh(repo, "git", "for-each-ref", "--format=%(refname:short)", "refs/heads/distill/")).toBe("");

        sh(repo, "git", "branch", "distill/2026-10-01-epic-830");
        expect(findEpicDistillBranch(defaultRunner, repo, 830)).toEqual({ ok: true, branch: "distill/2026-10-01-epic-830", source: "local" });
    });

    it("fails, rather than reporting no branch, when the push remote cannot be read", () => {
        const { repo, origin } = buildRepoWithOrigin(makeParent(tracked));
        fs.rmSync(origin, { recursive: true, force: true });
        expect(findEpicDistillBranch(defaultRunner, repo, 830).ok).toBe(false);
    });
});

// Epic #830, story #866 (decision record #872, D11, G24): the branch is pushed before anything
// is posted, and a failed push is returned so close can stop on it.
describe("pushEpicDistillBranch", () => {
    it("pushes the distill branch to the remote an earlier run's branch is found on, so a re-run reuses it", () => {
        const { repo } = buildRepoWithOrigin(makeParent(tracked));
        const r = openEpicDistillWorktree(defaultRunner, repo, 830, "2026-10-04");
        if (!r.ok) throw new Error(r.error.message);
        worktrees.push({ repo, path: r.wtPath });
        fs.writeFileSync(`${r.wtPath}/close-record.md`, "record\n");
        sh(r.wtPath, "git", "add", "-A");
        sh(r.wtPath, "git", "commit", "-qm", "close: epic-830 — close record");
        expect(pushEpicDistillBranch(defaultRunner, r.wtPath, r.branch)).toEqual({ ok: true });
        expect(sh(repo, "git", "ls-remote", "--heads", "origin", r.branch)).toContain(git(defaultRunner, r.wtPath, "rev-parse", "HEAD"));
    });

    it("returns the cause when the push fails", () => {
        const { repo, origin } = buildRepoWithOrigin(makeParent(tracked));
        const r = openEpicDistillWorktree(defaultRunner, repo, 830, "2026-10-04");
        if (!r.ok) throw new Error(r.error.message);
        worktrees.push({ repo, path: r.wtPath });
        fs.rmSync(origin, { recursive: true, force: true });
        const pushed = pushEpicDistillBranch(defaultRunner, r.wtPath, r.branch);
        expect(pushed.ok).toBe(false);
        expect(pushed.ok ? "" : pushed.message).not.toBe("");
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

describe("a fork checkout, where origin is the lead's own copy", () => {
    it("fetches the PR head from upstream, which is the only remote that has it", () => {
        const { repo, upstream } = buildForkWithUpstream(makeParent(tracked));
        // The pull request exists on the canonical repository only; the fork has no such ref.
        sh(repo, "git", "checkout", "-q", "-b", "feature");
        fs.writeFileSync(`${repo}/pr.txt`, "pr\n");
        sh(repo, "git", "add", "-A");
        sh(repo, "git", "commit", "-qm", "PR work");
        const prSha = git(defaultRunner, repo, "rev-parse", "HEAD");
        sh(repo, "git", "push", "-q", "upstream", "feature:refs/pull/7/head");
        sh(repo, "git", "checkout", "-q", "main");
        sh(repo, "git", "branch", "-qD", "feature");
        expect(upstream).toBeTruthy();

        const r = openAnalyzeWorktree(defaultRunner, repo, 7);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        worktrees.push({ repo, path: r.wtPath });
        expect(r.head).toBe(prSha);
        expect(git(defaultRunner, r.wtPath, "rev-parse", "HEAD")).toBe(prSha);
    });

    it("cuts the distill branch from the upstream trunk, not the fork's stale main", () => {
        const { repo, forkMainSha, upstreamMainSha } = buildForkWithUpstream(makeParent(tracked));
        expect(forkMainSha).not.toBe(upstreamMainSha);

        const r = openCloseWorktree(defaultRunner, repo, "distill/2026-09-14-fork");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        worktrees.push({ repo, path: r.wtPath });
        expect(git(defaultRunner, r.wtPath, "rev-parse", "HEAD")).toBe(upstreamMainSha);
    });
});
