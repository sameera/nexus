import * as fs from "node:fs";
import * as path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { deriveRange } from "./range.js";
import { type PrInfo } from "./pr.js";
import { defaultRunner, git } from "./run.js";
import { buildMergeCommit, buildRebase, buildSquash, initRepo, makeParent, sh, writeCommit, type Topology } from "./git-fixtures.js";

const tracked: string[] = [];
afterAll(() => {
    for (const d of tracked) fs.rmSync(d, { recursive: true, force: true });
});

function prFor(t: Topology): PrInfo {
    return {
        number: 1,
        state: "MERGED",
        merged: true,
        base: t.baseRefOid,
        head: t.prHead,
        mergeCommitOid: t.mergeCommit,
        commitCount: t.prCommitCount,
        headRef: "feature",
        url: "https://example.com/pr/1",
        crossRepo: false,
        authorLogin: "dev",
    };
}

function changedFiles(repo: string, base: string, head: string): string[] {
    const out = git(defaultRunner, repo, "diff", "--name-only", `${base}...${head}`, "--", ".", ":(exclude).nexus/queue", ":(exclude).nexus/discovery") ?? "";
    return out.split("\n").filter(Boolean).sort();
}

describe("deriveRange", () => {
    it("uses the mainline parent for a true merge commit", () => {
        const t = buildMergeCommit(makeParent(tracked));
        const r = deriveRange(defaultRunner, t.repo, prFor(t));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.range.head).toBe(t.mergeCommit);
        expect(changedFiles(t.repo, r.range.base, r.range.head)).toEqual(t.expectedFiles);
    });

    it("picks mergeCommit^1 for a squash of a multi-commit PR (verified)", () => {
        const t = buildSquash(makeParent(tracked));
        const r = deriveRange(defaultRunner, t.repo, prFor(t), { verifyAgainstPrHead: t.prHead });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.range.head).toBe(t.mergeCommit);
        expect(r.range.base).toBe(git(defaultRunner, t.repo, "rev-parse", `${t.mergeCommit}^1`));
        expect(changedFiles(t.repo, r.range.base, r.range.head)).toEqual(t.expectedFiles);
    });

    it("picks mergeCommit~N for a rebase merge (verified)", () => {
        const t = buildRebase(makeParent(tracked));
        const r = deriveRange(defaultRunner, t.repo, prFor(t), { verifyAgainstPrHead: t.prHead });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.range.head).toBe(t.mergeCommit);
        // The full feature set, NOT just the last commit (which mergeCommit^1 would give).
        expect(changedFiles(t.repo, r.range.base, r.range.head)).toEqual(t.expectedFiles);
        expect(r.range.base).toBe(git(defaultRunner, t.repo, "rev-parse", `${t.mergeCommit}~${t.prCommitCount}`));
    });

    it("refuses an ambiguous multi-commit 1-parent merge with no PR head to verify", () => {
        const t = buildSquash(makeParent(tracked));
        const r = deriveRange(defaultRunner, t.repo, prFor(t));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("range-ambiguous");
    });

    it("errors when the PR has no merge commit", () => {
        const t = buildSquash(makeParent(tracked));
        const pr = { ...prFor(t), mergeCommitOid: null };
        const r = deriveRange(defaultRunner, t.repo, pr);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("pr-no-merge-commit");
    });

    it("treats a range whose only non-queue content is under .nexus/discovery as an empty diff (record #235, invariant 2)", () => {
        const parent = makeParent(tracked);
        const repo = path.join(parent, "discovery-only-repo");
        initRepo(repo);
        const c0 = writeCommit(repo, "base.txt", "base\n", "C0");
        sh(repo, "git", "checkout", "-q", "-b", "feature", c0);
        const prHead = writeCommit(
            repo,
            ".nexus/discovery/foggy-thing-ab12cd34/ticket-01-pick-a-store.md",
            "# undecided reasoning\n",
            "F1",
        );
        sh(repo, "git", "checkout", "-q", "main");
        sh(repo, "git", "merge", "--no-ff", "-q", "-m", "Merge feature", "feature");
        const mergeCommit = sh(repo, "git", "rev-parse", "HEAD");
        const t: Topology = { repo, mergeCommit, prHead, baseRefOid: c0, prCommitCount: 1, expectedFiles: [] };

        const r = deriveRange(defaultRunner, t.repo, prFor(t));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("range-empty-diff");
    });
});
