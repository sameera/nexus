import * as fs from "node:fs";
import * as path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
    RECEIPT_MARKER,
    changedFileSet,
    deriveRangeViaHelper,
    parseReceiptBlock,
    prChangedFiles,
    prEndpoints,
    verifyRange,
    verifyReceipt,
    verifyResidue,
} from "./verify.js";
import { type Route, fakeRunner, initRepo, makeTempDir, sh, writeCommit } from "./harness-fixtures.js";
import { defaultRunner } from "./run.js";

const tracked: string[] = [];
afterAll(() => {
    for (const d of tracked) fs.rmSync(d, { recursive: true, force: true });
});

/**
 * A squash-merged PR as it looks post-merge with the branch gone: main carries one
 * new commit reproducing a two-commit feature, and the PR head is still reachable
 * only because GitHub keeps `pull/N/head` (which the helper fetches).
 */
function squashed(): { repo: string; mergeCommit: string; prBase: string; prHead: string; files: string[] } {
    const repo = path.join(makeTempDir(tracked), "clone");
    initRepo(repo);
    const c0 = writeCommit(repo, "base.txt", "base\n", "C0");
    sh(repo, "git", "checkout", "-q", "-b", "feature", c0);
    writeCommit(repo, "docs/f1.md", "f1\n", "F1");
    const prHead = writeCommit(repo, "docs/f2.md", "f2\n", "F2");
    sh(repo, "git", "checkout", "-q", "main");
    sh(repo, "git", "merge", "--squash", "feature");
    sh(repo, "git", "commit", "-qm", "Squash feature (#13)");
    const mergeCommit = sh(repo, "git", "rev-parse", "HEAD");
    // The trunk ref the range must stay reachable on, and the branch is gone.
    sh(repo, "git", "update-ref", "refs/remotes/origin/main", mergeCommit);
    sh(repo, "git", "branch", "-D", "feature");
    return { repo, mergeCommit, prBase: c0, prHead, files: ["docs/f1.md", "docs/f2.md"] };
}

describe("changedFileSet", () => {
    it("excludes the queue path, which the distiller's own diff also excludes", () => {
        const s = squashed();
        sh(s.repo, "git", "checkout", "-q", "-b", "tmp");
        fs.mkdirSync(path.join(s.repo, ".nexus/queue/e"), { recursive: true });
        fs.writeFileSync(path.join(s.repo, ".nexus/queue/e/epic.md"), "x\n");
        fs.writeFileSync(path.join(s.repo, "docs/f3.md"), "f3\n");
        const tip = writeCommit(s.repo, "docs/f4.md", "f4\n", "more");
        const set = changedFileSet(defaultRunner, s.repo, s.mergeCommit, tip);
        expect(set).toEqual(["docs/f3.md", "docs/f4.md"]);
    });

    it("returns null when git cannot diff the range", () => {
        const s = squashed();
        expect(changedFileSet(defaultRunner, s.repo, "0".repeat(40), s.mergeCommit)).toBeNull();
    });

    it("excludes the discovery path, which the distiller's own diff also excludes (record #235, invariant 2)", () => {
        const s = squashed();
        sh(s.repo, "git", "checkout", "-q", "-b", "tmp2");
        fs.mkdirSync(path.join(s.repo, ".nexus/discovery/foggy-thing-ab12cd34"), { recursive: true });
        fs.writeFileSync(path.join(s.repo, ".nexus/discovery/foggy-thing-ab12cd34/ticket-01-x.md"), "x\n");
        fs.writeFileSync(path.join(s.repo, "docs/f3.md"), "f3\n");
        const tip = writeCommit(s.repo, "docs/f4.md", "f4\n", "more");
        const set = changedFileSet(defaultRunner, s.repo, s.mergeCommit, tip);
        expect(set).toEqual(["docs/f3.md", "docs/f4.md"]);
    });
});

describe("verifyRange", () => {
    function parentOf(repo: string, rev: string): string {
        return sh(repo, "git", "rev-parse", `${rev}^1`);
    }

    it("passes a squash range whose file set equals the PR's own", () => {
        const s = squashed();
        const r = verifyRange(defaultRunner, s.repo, {
            prNumber: 13,
            base: parentOf(s.repo, s.mergeCommit),
            head: s.mergeCommit,
            prBase: s.prBase,
            prHead: s.prHead,
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.pass).toBe(true);
        expect(r.value.fileSetsEqual).toBe(true);
        expect(r.value.derivedFiles).toEqual(s.files);
        expect(r.value.notes).toEqual([]);
    });

    it("requires both endpoints to be full 40-character SHAs", () => {
        const s = squashed();
        const r = verifyRange(defaultRunner, s.repo, {
            prNumber: 13,
            base: parentOf(s.repo, s.mergeCommit).slice(0, 7),
            head: s.mergeCommit,
            prBase: s.prBase,
            prHead: s.prHead,
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.fullShas).toBe(false);
        expect(r.value.pass).toBe(false);
    });

    it("requires both endpoints to stay reachable on the trunk after the branch delete", () => {
        const s = squashed();
        // The PR branch tip is NOT on the trunk — anchoring there is exactly the mistake.
        const r = verifyRange(defaultRunner, s.repo, {
            prNumber: 13,
            base: s.prBase,
            head: s.prHead,
            prBase: s.prBase,
            prHead: s.prHead,
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.headReachableOnTrunk).toBe(false);
        expect(r.value.pass).toBe(false);
        expect(r.value.notes.join(" ")).toContain("not reachable");
    });

    it("fails a range whose file set differs from the PR's, and says how", () => {
        const s = squashed();
        const r = verifyRange(defaultRunner, s.repo, {
            prNumber: 13,
            base: s.mergeCommit, // an empty range against itself
            head: s.mergeCommit,
            prBase: s.prBase,
            prHead: s.prHead,
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.fileSetsEqual).toBe(false);
        expect(r.value.nonEmptyDiff).toBe(false);
        expect(r.value.pass).toBe(false);
        expect(r.value.notes.join(" ")).toContain("docs/f1.md");
    });

    it("cross-checks against GitHub's own file list when it is supplied", () => {
        const s = squashed();
        const base = parentOf(s.repo, s.mergeCommit);
        const good = verifyRange(defaultRunner, s.repo, {
            prNumber: 13,
            base,
            head: s.mergeCommit,
            prBase: s.prBase,
            prHead: s.prHead,
            ghFiles: s.files,
        });
        expect(good.ok && good.value.ghFileSetsEqual).toBe(true);

        const bad = verifyRange(defaultRunner, s.repo, {
            prNumber: 13,
            base,
            head: s.mergeCommit,
            prBase: s.prBase,
            prHead: s.prHead,
            ghFiles: ["docs/f1.md"],
        });
        expect(bad.ok).toBe(true);
        if (!bad.ok) return;
        expect(bad.value.ghFileSetsEqual).toBe(false);
    });

    it("errors when the authoritative PR diff cannot be computed at all", () => {
        const s = squashed();
        const r = verifyRange(defaultRunner, s.repo, {
            prNumber: 13,
            base: parentOf(s.repo, s.mergeCommit),
            head: s.mergeCommit,
            prBase: "0".repeat(40),
            prHead: s.prHead,
        });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("git-failed");
    });
});

describe("deriveRangeViaHelper", () => {
    const toolRoot = "/nexus";
    const clonePath = "/clone";

    it("reads the range the close record would be stamped with", () => {
        const run = fakeRunner([
            {
                match: "pr_worktree.ts open",
                result: {
                    stdout: JSON.stringify({
                        command: "open",
                        mode: "close",
                        wtPath: "/tmp/wt",
                        range: { repo: "github.com/o/r", base: "a".repeat(40), head: "b".repeat(40) },
                    }),
                },
            },
        ]);
        const r = deriveRangeViaHelper({ run, clonePath, toolRoot }, 13, "distill/2026-07-25-x");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.base).toBe("a".repeat(40));
        expect(r.value.head).toBe("b".repeat(40));
        expect(r.value.wtPath).toBe("/tmp/wt");
    });

    it("carries the helper's named diagnostic through verbatim, for the record to quote", () => {
        const run = fakeRunner([
            {
                match: "pr_worktree.ts open",
                result: { status: 1, stderr: "pr-worktree range-ambiguous: PR #13 landed as 1 commit-parent\n" },
            },
        ]);
        const r = deriveRangeViaHelper({ run, clonePath, toolRoot }, 13, "distill/x");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.message).toContain("range-ambiguous");
    });

    it("refuses output it cannot read as a range rather than inventing one", () => {
        const run = fakeRunner([{ match: "pr_worktree.ts open", result: { stdout: "{}" } }]);
        const r = deriveRangeViaHelper({ run, clonePath, toolRoot }, 13, "distill/x");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("range-mismatch");
    });

    it("runs the helper with the working directory inside the clone", () => {
        const run = fakeRunner([
            {
                match: "pr_worktree.ts open",
                result: { stdout: JSON.stringify({ wtPath: "/w", range: { repo: "r", base: "a", head: "b" } }) },
            },
        ]);
        deriveRangeViaHelper({ run, clonePath, toolRoot }, 13, "distill/x");
        expect(run.cwds[0]).toBe(clonePath);
    });
});

describe("prEndpoints / prChangedFiles", () => {
    it("reports the PR's own base, head, merge commit, and commit count", () => {
        const run = fakeRunner([
            {
                match: "gh pr view",
                result: {
                    stdout: JSON.stringify({
                        state: "MERGED",
                        mergedAt: "2026-07-25T00:00:00Z",
                        baseRefOid: "a".repeat(40),
                        headRefOid: "b".repeat(40),
                        mergeCommit: { oid: "c".repeat(40) },
                        commits: [{}, {}, {}],
                    }),
                },
            },
        ]);
        const r = prEndpoints(run, "/clone", 13);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value).toMatchObject({ merged: true, commitCount: 3, mergeCommitOid: "c".repeat(40) });
    });

    it("surfaces a gh failure", () => {
        const run = fakeRunner([{ match: "gh pr view", result: { status: 1, stderr: "no such PR" } }]);
        expect(prEndpoints(run, "/clone", 13).ok).toBe(false);
        expect(prChangedFiles(run, "/clone", 13).ok).toBe(false);
    });

    it("surfaces unparseable gh output", () => {
        const run = fakeRunner([{ match: "gh pr view", result: { stdout: "<html>" } }]);
        const r = prEndpoints(run, "/clone", 13);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("gh-failed");
    });

    it("reports GitHub's own changed-file list with the queue excluded", () => {
        const run = fakeRunner([
            { match: "gh pr view", result: { stdout: "docs/b.md\ndocs/a.md\n.nexus/queue/e/epic.md\n" } },
        ]);
        const r = prChangedFiles(run, "/clone", 13);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value).toEqual(["docs/a.md", "docs/b.md"]);
    });
});

describe("parseReceiptBlock", () => {
    const block = (head: string) =>
        [
            "Conformance summary…",
            "",
            RECEIPT_MARKER,
            "```yaml",
            'epic: "#10"',
            "pr: 13",
            "date: 2026-07-25",
            `head: ${head}`,
            "mode: full",
            "findings: { critical: 0, high: 0, medium: 1, low: 2 }",
            "```",
        ].join("\n");

    it("reads the verdict fields the close-side reader needs", () => {
        const r = parseReceiptBlock(block("d".repeat(40)));
        expect(r).not.toBeNull();
        expect(r?.head).toBe("d".repeat(40));
        expect(r?.epic).toBe("#10");
        expect(r?.pr).toBe(13);
        expect(r?.mode).toBe("full");
        expect(r?.findings).toEqual({ critical: 0, high: 0, medium: 1, low: 2 });
    });

    it("ignores a body with no receipt marker", () => {
        expect(parseReceiptBlock("just a comment")).toBeNull();
    });

    it("ignores a marker with no machine block behind it", () => {
        expect(parseReceiptBlock(`${RECEIPT_MARKER}\nno fence here`)).toBeNull();
    });

    it("rejects a block with no analyzed head, since currency could not be judged", () => {
        expect(parseReceiptBlock(`${RECEIPT_MARKER}\n\`\`\`yaml\nmode: full\n\`\`\``)).toBeNull();
    });
});

describe("verifyReceipt", () => {
    const head = "d".repeat(40);
    const body = (h: string) =>
        `summary\n\n${RECEIPT_MARKER}\n\`\`\`yaml\nepic: "#10"\npr: 13\ndate: 2026-07-25\nhead: ${h}\nmode: full\nfindings: { critical: 0, high: 0, medium: 0, low: 1 }\n\`\`\``;

    const view = (doc: unknown): Route => ({ match: "gh pr view", result: { stdout: JSON.stringify(doc) } });

    it("finds the receipt published as a comment — the documented single-account fallback", () => {
        const run = fakeRunner([
            view({ reviews: [], comments: [{ body: body(head), createdAt: "2026-07-25T10:00:00Z" }], headRefOid: head }),
        ]);
        const r = verifyReceipt(run, "/clone", 13);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.found).toBe(true);
        expect(r.value.source).toBe("comment");
        expect(r.value.current).toBe(true);
    });

    it("finds the receipt published as a review when that path is available", () => {
        const run = fakeRunner([
            view({ reviews: [{ body: body(head), submittedAt: "2026-07-25T10:00:00Z" }], comments: [], headRefOid: head }),
        ]);
        const r = verifyReceipt(run, "/clone", 13);
        expect(r.ok && r.value.source).toBe("review");
    });

    it("takes the newest receipt when analyze was re-run", () => {
        const newer = "e".repeat(40);
        const run = fakeRunner([
            view({
                reviews: [],
                comments: [
                    { body: body(head), createdAt: "2026-07-25T10:00:00Z" },
                    { body: body(newer), createdAt: "2026-07-25T12:00:00Z" },
                ],
                headRefOid: newer,
            }),
        ]);
        const r = verifyReceipt(run, "/clone", 13);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.receipt?.head).toBe(newer);
        expect(r.value.current).toBe(true);
    });

    it("detects staleness when a commit landed after analysis — never silently accepts it", () => {
        const later = "f".repeat(40);
        const run = fakeRunner([
            view({ reviews: [], comments: [{ body: body(head), createdAt: "2026-07-25T10:00:00Z" }], headRefOid: later }),
        ]);
        const r = verifyReceipt(run, "/clone", 13);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.current).toBe(false);
        expect(r.value.staleNote).toContain(head);
        expect(r.value.staleNote).toContain(later);
    });

    it("reports a PR with no receipt at all rather than failing", () => {
        const run = fakeRunner([view({ reviews: [], comments: [{ body: "nice work", createdAt: "x" }], headRefOid: head })]);
        const r = verifyReceipt(run, "/clone", 13);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.found).toBe(false);
        expect(r.value.current).toBe(false);
    });

    it("errors on a receipt block the close-side reader could not parse", () => {
        const run = fakeRunner([
            view({ reviews: [], comments: [{ body: `${RECEIPT_MARKER}\ngarbage`, createdAt: "x" }], headRefOid: head }),
        ]);
        const r = verifyReceipt(run, "/clone", 13);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("receipt-malformed");
    });

    it("surfaces a gh failure", () => {
        const run = fakeRunner([{ match: "gh pr view", result: { status: 1, stderr: "boom" } }]);
        expect(verifyReceipt(run, "/clone", 13).ok).toBe(false);
    });

    it("surfaces unparseable gh output", () => {
        const run = fakeRunner([{ match: "gh pr view", result: { stdout: "<html>" } }]);
        const r = verifyReceipt(run, "/clone", 13);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("gh-failed");
    });
});

describe("verifyResidue", () => {
    it("calls a checkout clean when no worktree, branch, or clone survives", () => {
        const host = path.join(makeTempDir(tracked), "host");
        initRepo(host);
        writeCommit(host, "a.txt", "a\n", "C0");
        const r = verifyResidue(defaultRunner, host, path.join(makeTempDir(tracked), "gone"));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.clean).toBe(true);
    });

    it("enumerates a worktree left registered in the host checkout", () => {
        const host = path.join(makeTempDir(tracked), "host");
        initRepo(host);
        writeCommit(host, "a.txt", "a\n", "C0");
        const wt = path.join(makeTempDir(tracked), "leftover-wt");
        sh(host, "git", "worktree", "add", "--detach", wt, "HEAD");
        const r = verifyResidue(defaultRunner, host, path.join(makeTempDir(tracked), "gone"));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.hostWorktrees.length).toBe(1);
        expect(r.value.clean).toBe(false);
    });

    it("enumerates harness-created branches left in the host checkout", () => {
        const host = path.join(makeTempDir(tracked), "host");
        initRepo(host);
        writeCommit(host, "a.txt", "a\n", "C0");
        sh(host, "git", "branch", "acceptance/leftover");
        const r = verifyResidue(defaultRunner, host, path.join(makeTempDir(tracked), "gone"));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.hostBranches).toEqual(["acceptance/leftover"]);
        expect(r.value.clean).toBe(false);
    });

    it("counts a surviving clone as residue, and its worktrees with it", () => {
        const host = path.join(makeTempDir(tracked), "host");
        initRepo(host);
        writeCommit(host, "a.txt", "a\n", "C0");
        const clone = path.join(makeTempDir(tracked), "clone");
        initRepo(clone);
        writeCommit(clone, "a.txt", "a\n", "C0");
        const wt = path.join(makeTempDir(tracked), "clone-wt");
        sh(clone, "git", "worktree", "add", "--detach", wt, "HEAD");
        const r = verifyResidue(defaultRunner, host, clone);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.cloneExists).toBe(true);
        expect(r.value.cloneWorktrees.length).toBe(1);
        expect(r.value.clean).toBe(false);
    });
});

describe("the analyze receipt's writer stamp (story #306)", () => {
    const block = (lines: string[]): string =>
        ["Conformance summary…", "", RECEIPT_MARKER, "```yaml", ...lines, "```"].join("\n");

    const head: string = "d".repeat(40);
    const stamped: string[] = ['epic: "#10"', "nexus_version: 0.1.0", "pr: 13", `head: ${head}`, "mode: full", "record_hash: " + "f".repeat(64)];
    const unstamped: string[] = ['epic: "#10"', "pr: 13", `head: ${head}`, "mode: full", "record_hash: " + "f".repeat(64)];

    it("reports which toolkit wrote the receipt", () => {
        expect(parseReceiptBlock(block(stamped))?.nexusVersion).toBe("0.1.0");
    });

    it("reads a receipt written before the stamp existed, treating the writer as unknown (AC2)", () => {
        const r = parseReceiptBlock(block(unstamped));
        expect(r).not.toBeNull();
        expect(r?.nexusVersion).toBeNull();
        expect(r?.head).toBe(head);
    });

    it("leaves every value a later stage verifies unchanged when the receipt is stamped (AC3)", () => {
        const withStamp = parseReceiptBlock(block(stamped));
        const withoutStamp = parseReceiptBlock(block(unstamped));
        expect({ ...withStamp, nexusVersion: null }).toEqual(withoutStamp);
    });

    it("reads a receipt stamped by a different release exactly as it reads its own (AC4)", () => {
        const other = parseReceiptBlock(block(['epic: "#10"', "nexus_version: 99.0.0", "pr: 13", `head: ${head}`, "mode: full", "record_hash: " + "f".repeat(64)]));
        expect(other?.head).toBe(head);
        expect(other?.nexusVersion).toBe("99.0.0");
    });
});
