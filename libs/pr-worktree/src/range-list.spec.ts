import * as fs from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { deriveRangeList } from "./range-list.js";
import { defaultRunner, type RunResult, type Runner } from "./run.js";
import { initRepo, makeParent, sh, writeCommit } from "./git-fixtures.js";

const tracked: string[] = [];
afterAll(() => {
    for (const d of tracked) fs.rmSync(d, { recursive: true, force: true });
});

interface PrFixture {
    number: number;
    merged: boolean;
    baseRefOid: string;
    prHead: string;
    mergeCommit: string | null;
    commitCount: number;
}

function prDoc(f: PrFixture): Record<string, unknown> {
    return {
        state: f.merged ? "MERGED" : "OPEN",
        mergedAt: f.merged ? "2026-09-08T00:00:00Z" : null,
        baseRefOid: f.baseRefOid,
        headRefOid: f.prHead,
        mergeCommit: f.mergeCommit ? { oid: f.mergeCommit } : null,
        commits: Array.from({ length: f.commitCount }, () => ({})),
        headRefName: `feature-${f.number}`,
        url: `https://example.com/pr/${f.number}`,
        isCrossRepository: false,
        author: { login: "dev" },
    };
}

/** A runner that answers `gh pr view <n>` from a canned per-PR fixture map, recording every PR number it was asked about. */
function runnerWithPrs(docs: Record<number, Record<string, unknown>>, calls: number[]): Runner {
    return (cmd: string, args: string[], opts): RunResult => {
        if (cmd === "gh" && args[0] === "pr" && args[1] === "view") {
            const n = Number(args[2]);
            calls.push(n);
            const doc = docs[n];
            if (doc === undefined) {
                return { status: 1, stdout: "", stderr: `gh: no pull requests found for #${n}` };
            }
            return { status: 0, stdout: JSON.stringify(doc), stderr: "" };
        }
        return defaultRunner(cmd, args, opts);
    };
}

/** A repo with a bare origin and `n` sequential squash-merged PRs landed on main, each pushed to its own pull ref. */
function buildSequentialSquashPrs(parent: string, n: number): { repo: string; fixtures: PrFixture[] } {
    const origin = `${parent}/origin.git`;
    fs.mkdirSync(origin, { recursive: true });
    sh(origin, "git", "init", "-q", "--bare", "-b", "main");
    const repo = `${parent}/repo`;
    initRepo(repo, origin);
    let trunk = writeCommit(repo, "base.txt", "base\n", "C0");
    sh(repo, "git", "push", "-q", "-u", "origin", "main");

    const fixtures: PrFixture[] = [];
    for (let i = 1; i <= n; i++) {
        const baseRefOid = trunk;
        sh(repo, "git", "checkout", "-q", "-b", `feature-${i}`, trunk);
        writeCommit(repo, `f${i}a.txt`, `${i}a\n`, `F${i}A`);
        const prHead = writeCommit(repo, `f${i}b.txt`, `${i}b\n`, `F${i}B`);
        sh(repo, "git", "push", "-q", "origin", `feature-${i}:refs/pull/${i}/head`);
        sh(repo, "git", "checkout", "-q", "main");
        sh(repo, "git", "merge", "-q", "--squash", `feature-${i}`);
        sh(repo, "git", "commit", "-qm", `Squash feature ${i} (#${i})`);
        const mergeCommit = sh(repo, "git", "rev-parse", "HEAD");
        trunk = mergeCommit;
        fixtures.push({ number: i, merged: true, baseRefOid, prHead, mergeCommit, commitCount: 2 });
    }
    return { repo, fixtures };
}

describe("deriveRangeList", () => {
    it("derives one ordered, correctly-attributed RangeListItem per merged pull request", () => {
        const parent = makeParent(tracked);
        const { repo, fixtures } = buildSequentialSquashPrs(parent, 3);
        const docs = Object.fromEntries(fixtures.map((f) => [f.number, prDoc(f)]));
        const calls: number[] = [];

        const result = deriveRangeList(runnerWithPrs(docs, calls), repo, [1, 2, 3]);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.ranges).toHaveLength(3);
        expect(result.ranges.map((r) => r.pr)).toEqual([1, 2, 3]);
        for (const [i, range] of result.ranges.entries()) {
            expect(range.repo.length).toBeGreaterThan(0);
            expect(range.base).toMatch(/^[0-9a-f]{40}$/);
            expect(range.head).toBe(fixtures[i].mergeCommit);
        }
        // All three land in the same repository, but no entry is merged/deduplicated per repo.
        expect(new Set(result.ranges.map((r) => r.repo)).size).toBe(1);
    });

    it("stops on the first unmerged pull request and never reaches a later one", () => {
        const parent = makeParent(tracked);
        const { repo, fixtures } = buildSequentialSquashPrs(parent, 1);
        const docs: Record<number, Record<string, unknown>> = {
            1: prDoc(fixtures[0]),
            2: {
                state: "OPEN",
                mergedAt: null,
                baseRefOid: fixtures[0].mergeCommit,
                headRefOid: "0".repeat(40),
                mergeCommit: null,
                commits: [{}],
                headRefName: "feature-2",
                url: "https://example.com/pr/2",
                isCrossRepository: false,
                author: { login: "dev" },
            },
        };
        const calls: number[] = [];

        const result = deriveRangeList(runnerWithPrs(docs, calls), repo, [1, 2, 3]);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.problem).toBe("pr-not-merged");
        expect(result.error.message).toContain("#2");
        expect(calls).toEqual([1, 2]);
        expect(calls).not.toContain(3);
    });

    it("derives duplicate PR numbers independently, with no dedup logic", () => {
        const parent = makeParent(tracked);
        const { repo, fixtures } = buildSequentialSquashPrs(parent, 1);
        const docs = { 1: prDoc(fixtures[0]) };
        const calls: number[] = [];

        const result = deriveRangeList(runnerWithPrs(docs, calls), repo, [1, 1]);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.ranges).toHaveLength(2);
        expect(result.ranges[0]).toEqual(result.ranges[1]);
        expect(calls).toEqual([1, 1]);
    });

    it("refuses an empty PR-number list with a usage diagnostic", () => {
        const parent = makeParent(tracked);
        initRepo(parent);
        const result = deriveRangeList(defaultRunner, parent, []);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.problem).toBe("usage");
    });
});
