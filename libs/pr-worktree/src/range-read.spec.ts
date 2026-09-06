import * as fs from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { readRange } from "./range-read.js";
import { defaultRunner, git, type RunResult, type Runner } from "./run.js";
import { buildRebase, buildSquash, initRepo, makeParent, sh, writeCommit, type Topology } from "./git-fixtures.js";

const tracked: string[] = [];
afterAll(() => {
    for (const d of tracked) fs.rmSync(d, { recursive: true, force: true });
});

/** A runner that answers `gh pr view` from a canned document and passes everything else through. */
function runnerWithPr(doc: Record<string, unknown>): Runner {
    return (cmd: string, args: string[], opts): RunResult => {
        if (cmd === "gh") {
            return { status: 0, stdout: JSON.stringify(doc), stderr: "" };
        }
        return defaultRunner(cmd, args, opts);
    };
}

function mergedPrDoc(t: Topology): Record<string, unknown> {
    return {
        state: "MERGED",
        mergedAt: "2026-08-20T00:00:00Z",
        baseRefOid: t.baseRefOid,
        headRefOid: t.prHead,
        mergeCommit: { oid: t.mergeCommit },
        commits: Array.from({ length: t.prCommitCount }, () => ({})),
        headRefName: "feature",
        url: "https://example.com/pr/1",
        isCrossRepository: false,
        author: { login: "dev" },
    };
}

/** Publish the PR branch tip on the conventional pull ref so the range read can fetch it. */
function publishPullRef(t: Topology, parent: string): void {
    const origin = `${parent}/origin.git`;
    fs.mkdirSync(origin, { recursive: true });
    sh(origin, "git", "init", "-q", "--bare", "-b", "main");
    sh(t.repo, "git", "remote", "add", "origin", origin);
    sh(t.repo, "git", "push", "-q", "origin", `${t.prHead}:refs/pull/1/head`);
}

function changedFiles(repo: string, base: string, head: string): string[] {
    const out = git(defaultRunner, repo, "diff", "--name-only", `${base}...${head}`) ?? "";
    return out.split("\n").filter(Boolean).sort();
}

function worktreeList(repo: string): string[] {
    const out = git(defaultRunner, repo, "worktree", "list", "--porcelain") ?? "";
    return out.split("\n").filter((line: string) => line.startsWith("worktree "));
}

describe("readRange", () => {
    it("reports repo, base and head as full SHAs for a merged pull request", () => {
        const parent = makeParent(tracked);
        const t = buildSquash(parent);
        publishPullRef(t, parent);
        const r = readRange(runnerWithPr(mergedPrDoc(t)), t.repo, 1);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.range.head).toBe(t.mergeCommit);
        expect(r.range.base).toMatch(/^[0-9a-f]{40}$/);
        expect(r.range.head).toMatch(/^[0-9a-f]{40}$/);
        expect(r.range.repo.length).toBeGreaterThan(0);
    });

    it("creates and removes no worktree", () => {
        const parent = makeParent(tracked);
        const t = buildSquash(parent);
        publishPullRef(t, parent);
        const before = worktreeList(t.repo);
        const r = readRange(runnerWithPr(mergedPrDoc(t)), t.repo, 1);
        expect(r.ok).toBe(true);
        expect(worktreeList(t.repo)).toEqual(before);
    });

    it("resolves a squash-merged range whose file set matches the pull request's", () => {
        const parent = makeParent(tracked);
        const t = buildSquash(parent);
        publishPullRef(t, parent);
        const r = readRange(runnerWithPr(mergedPrDoc(t)), t.repo, 1);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(changedFiles(t.repo, r.range.base, r.range.head)).toEqual(t.expectedFiles);
    });

    it("resolves a rebase-merged range whose file set matches the pull request's", () => {
        const parent = makeParent(tracked);
        const t = buildRebase(parent);
        publishPullRef(t, parent);
        const r = readRange(runnerWithPr(mergedPrDoc(t)), t.repo, 1);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(changedFiles(t.repo, r.range.base, r.range.head)).toEqual(t.expectedFiles);
    });

    it("refuses an open pull request with a named diagnostic and no range", () => {
        const parent = makeParent(tracked);
        const t = buildSquash(parent);
        const open = { ...mergedPrDoc(t), state: "OPEN", mergedAt: null, mergeCommit: null };
        const r = readRange(runnerWithPr(open), t.repo, 1);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("pr-not-merged");
    });

    it("refuses a pull request closed without merging", () => {
        const parent = makeParent(tracked);
        const t = buildSquash(parent);
        const closed = { ...mergedPrDoc(t), state: "CLOSED", mergedAt: null, mergeCommit: null };
        const r = readRange(runnerWithPr(closed), t.repo, 1);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("pr-not-merged");
    });

    it("refuses a member repository before it looks the pull request up", () => {
        const parent = makeParent(tracked);
        const repo = `${parent}/member`;
        initRepo(repo);
        writeCommit(repo, "base.txt", "base\n", "C0");
        fs.mkdirSync(`${repo}/.nexus/config`, { recursive: true });
        fs.writeFileSync(`${repo}/.nexus/config/hub.yml`, "hub:\n  name: hub\n");
        const r = readRange(runnerWithPr({}), repo, 1);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("member-unsupported");
    });
});
