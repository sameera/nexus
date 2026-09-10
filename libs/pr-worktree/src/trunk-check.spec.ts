import * as fs from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { verifyTrunkContainsHeads } from "./trunk-check.js";
import { defaultRunner, type Runner } from "./run.js";
import { initRepo, makeParent, sh, writeCommit } from "./git-fixtures.js";

const tracked: string[] = [];
afterAll(() => {
    for (const d of tracked) fs.rmSync(d, { recursive: true, force: true });
});

/** Wraps `defaultRunner`, recording every `git merge-base --is-ancestor` invocation's args. */
function recordingRunner(calls: string[][]): Runner {
    return (cmd, args, opts) => {
        if (cmd === "git" && args[0] === "merge-base") calls.push(args);
        return defaultRunner(cmd, args, opts);
    };
}

describe("verifyTrunkContainsHeads", () => {
    it("reports ok when every head is an ancestor of the trunk ref", () => {
        const parent = makeParent(tracked);
        const repo = `${parent}/repo`;
        initRepo(repo);
        const c0 = writeCommit(repo, "a.txt", "a\n", "C0");
        const c1 = writeCommit(repo, "b.txt", "b\n", "C1");
        const trunk = sh(repo, "git", "rev-parse", "HEAD");

        const result = verifyTrunkContainsHeads(defaultRunner, repo, trunk, [
            { pr: 1, head: c0 },
            { pr: 2, head: c1 },
        ]);

        expect(result.ok).toBe(true);
    });

    it("stops on the first head that is not an ancestor of the trunk ref, naming its pull request and head", () => {
        const parent = makeParent(tracked);
        const repo = `${parent}/repo`;
        initRepo(repo);
        const c0 = writeCommit(repo, "a.txt", "a\n", "C0");
        sh(repo, "git", "checkout", "-q", "-b", "never-merged", c0);
        const strandedHead = writeCommit(repo, "stray.txt", "stray\n", "STRAY");
        sh(repo, "git", "checkout", "-q", "main");
        const c2 = writeCommit(repo, "b.txt", "b\n", "C2");
        const trunk = sh(repo, "git", "rev-parse", "HEAD");
        const calls: string[][] = [];

        const result = verifyTrunkContainsHeads(recordingRunner(calls), repo, trunk, [
            { pr: 1, head: c0 },
            { pr: 2, head: strandedHead },
            { pr: 3, head: c2 },
        ]);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.problem).toBe("trunk-missing-head");
        expect(result.error.message).toContain("#2");
        expect(result.error.message).toContain(strandedHead);
        // Short-circuits: the first (ok) item and the failing second item were checked, and the
        // whole call stopped there — the third item's own ancestor check never ran.
        expect(calls).toHaveLength(2);
    });

    it("is trivially ok for an empty item list", () => {
        const parent = makeParent(tracked);
        const repo = `${parent}/repo`;
        initRepo(repo);
        writeCommit(repo, "a.txt", "a\n", "C0");
        const trunk = sh(repo, "git", "rev-parse", "HEAD");

        const result = verifyTrunkContainsHeads(defaultRunner, repo, trunk, []);

        expect(result.ok).toBe(true);
    });
});
