/**
 * The close-range derivation against a real checkout (epic #828, story #841). Only the platform is
 * stood in for — the claiming read and `gh pr view` — and any fetch is refused, so these cases
 * also show that the derivation needs nothing beyond the checkout it was given.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { closeRangesDeps, deriveCloseRanges } from "./close-ranges.js";
import { defaultRunner, type Runner } from "./run.js";

const tracked: string[] = [];
afterAll(() => {
    for (const d of tracked) fs.rmSync(d, { recursive: true, force: true });
});

function sh(cwd: string, ...args: string[]): string {
    const r = spawnSync("git", args, { cwd, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr}`);
    return r.stdout.trim();
}

function commitFile(repo: string, file: string, content: string, msg: string): void {
    fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    fs.writeFileSync(path.join(repo, file), content);
    sh(repo, "add", "-A");
    sh(repo, "commit", "-qm", msg);
}

/** Merge a one-commit branch touching `file` into main with a merge commit; return the PR's facts. */
function mergeBranch(repo: string, branch: string, file: string): { base: string; head: string; merge: string } {
    const base = sh(repo, "rev-parse", "main");
    sh(repo, "checkout", "-qb", branch);
    commitFile(repo, file, `${branch}\n`, `${branch} change`);
    const head = sh(repo, "rev-parse", "HEAD");
    sh(repo, "checkout", "-q", "main");
    sh(repo, "merge", "-q", "--no-ff", "-m", `merge ${branch}`, branch);
    return { base, head, merge: sh(repo, "rev-parse", "HEAD") };
}

function buildRepo(): string {
    const repo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "nexus-close-ranges-")), "web");
    tracked.push(path.dirname(repo));
    fs.mkdirSync(repo);
    sh(repo, "init", "-q", "-b", "main");
    sh(repo, "config", "user.email", "spec@example.com");
    sh(repo, "config", "user.name", "spec");
    sh(repo, "remote", "add", "origin", "git@github.com:acme/web.git");
    commitFile(repo, "README.md", "base\n", "init");
    return repo;
}

interface FakePr {
    number: number;
    story: number;
    mergedAt: string;
    base: string;
    head: string;
    merge: string;
    /** The head the pull request's trusted receipt says was analyzed; no receipt when absent. */
    analyzed?: string;
    /** An unmerged pull request's platform state; merged when absent. */
    state?: "OPEN" | "CLOSED";
    /** Extra receipt lines, verbatim — an older receipt's fields. */
    receiptExtra?: string;
}

function receiptReview(p: FakePr): Array<Record<string, string>> {
    if (p.analyzed === undefined) return [];
    const yaml = ["epic: \"#828\"", `pr: ${p.number}`, "date: 2026-09-01", `head: ${p.analyzed}`, "mode: full", `stories: [${p.story}]`, ...(p.receiptExtra === undefined ? [] : [p.receiptExtra])].join("\n");
    return [{ body: `<!-- nexus:analyze-receipt -->\n\`\`\`yaml\n${yaml}\n\`\`\`\n`, authorAssociation: "OWNER", submittedAt: "2026-09-01T00:00:00Z" }];
}

/** Real git for everything but fetches, which are refused; canned answers for the platform. */
function platform(prs: FakePr[], seen: string[]): Runner {
    return (cmd, args, opts) => {
        if (cmd === "git" && args[0] === "fetch") {
            seen.push(`fetch ${args.slice(1).join(" ")}`);
            return { status: 1, stdout: "", stderr: "fetch refused in spec" };
        }
        if (cmd === "git") return defaultRunner(cmd, args, opts);
        if (args[0] === "api") {
            const query = args.find((a) => a.startsWith("query=")) ?? "";
            const num = Number((args.find((a) => a.startsWith("num=")) ?? "").slice("num=".length));
            const pageInfo = { hasNextPage: false, endCursor: null };
            if (query.includes("closedByPullRequestsReferences")) {
                const nodes = prs
                    .filter((p) => p.story === num)
                    .map((p) =>
                        p.state === undefined
                            ? { number: p.number, state: "MERGED", merged: true, mergedAt: p.mergedAt, mergeCommit: { oid: p.merge }, body: "", repository: { nameWithOwner: "acme/web" } }
                            : { number: p.number, state: p.state, merged: false, mergedAt: null, mergeCommit: null, body: "", repository: { nameWithOwner: "acme/web" } },
                    );
                return { status: 0, stdout: JSON.stringify({ data: { repository: { issue: { closedByPullRequestsReferences: { pageInfo, nodes } } } } }), stderr: "" };
            }
            return { status: 0, stdout: JSON.stringify({ data: { repository: { issue: { timelineItems: { pageInfo, nodes: [] } } } } }), stderr: "" };
        }
        if (args[0] === "pr" && args[1] === "view") {
            const p = prs.find((x) => x.number === Number(args[2]));
            if (p === undefined) return { status: 1, stdout: "", stderr: "no pull requests found" };
            return {
                status: 0,
                stdout: JSON.stringify({
                    state: "MERGED",
                    mergedAt: p.mergedAt,
                    baseRefOid: p.base,
                    headRefOid: p.head,
                    mergeCommit: { oid: p.merge },
                    commits: [{ messageHeadline: "change" }],
                    headRefName: `b${p.number}`,
                    url: "",
                    isCrossRepository: false,
                    author: { login: "dev" },
                    body: "",
                    closingIssuesReferences: [],
                    reviews: receiptReview(p),
                    comments: [],
                }),
                stderr: "",
            };
        }
        return { status: 1, stdout: "", stderr: `unexpected ${cmd} ${args.join(" ")}` };
    };
}

describe("deriveCloseRanges in a real checkout (story #841)", () => {
    it("derives each range from the merge commit, and names a pull request that only touched pipeline stores as no range", () => {
        const repo = buildRepo();
        const feature = mergeBranch(repo, "b10", "src/feature.ts");
        const queueOnly = mergeBranch(repo, "b11", ".nexus/queue/epic-828/dev/notes-b11.md");
        const prs: FakePr[] = [
            { number: 10, story: 841, mergedAt: "2026-09-01T00:00:00Z", ...feature },
            { number: 11, story: 841, mergedAt: "2026-09-02T00:00:00Z", ...queueOnly },
        ];
        const seen: string[] = [];

        const out = deriveCloseRanges(closeRangesDeps(platform(prs, seen), repo, "acme/web"), { stories: [841], records: [] });
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.ranges.ok).toBe(true);
        expect(out.ranges.range).toEqual([{ repo: "acme/web", pr: 10, base: feature.base, head: feature.merge }]);
        expect(out.ranges.stories[0].ranges.map((r) => [r.pr, r.source])).toEqual([
            [10, "derived"],
            [11, "no-range"],
        ]);
        expect(seen.every((f) => f.includes("pull/"))).toBe(true);
    });

    it("reports a merge commit the checkout does not hold as checkout behind, and fetches no trunk", () => {
        const repo = buildRepo();
        const feature = mergeBranch(repo, "b10", "src/feature.ts");
        const missing = "d".repeat(40);
        const prs: FakePr[] = [{ number: 10, story: 841, mergedAt: "2026-09-01T00:00:00Z", ...feature, merge: missing }];
        const seen: string[] = [];

        const out = deriveCloseRanges(closeRangesDeps(platform(prs, seen), repo, "acme/web"), { stories: [841], records: [] });
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.ranges.ok).toBe(false);
        expect(out.ranges.blocking).toEqual([
            { kind: "checkout-behind", repo: "acme/web", pr: 10, mergeCommit: missing, checkout: repo, fetch: `git -C ${repo} fetch origin` },
        ]);
        expect(seen).toEqual([]);
    });
});

describe("the claiming read close classifies on (story #847, D7)", () => {
    it("sees an open claiming pull request and stops its story as unshipped, while ranging only the merged one", () => {
        const repo = buildRepo();
        const feature = mergeBranch(repo, "b10", "src/feature.ts");
        const prs: FakePr[] = [
            { number: 10, story: 841, mergedAt: "2026-09-01T00:00:00Z", ...feature, analyzed: feature.head },
            { number: 20, story: 841, mergedAt: "", base: "", head: "", merge: "", state: "OPEN" },
        ];
        const seen: string[][] = [];
        const base = platform(prs, []);
        const run: Runner = (cmd, args, opts) => (seen.push([cmd, ...args]), base(cmd, args, opts));

        const out = deriveCloseRanges(closeRangesDeps(run, repo, "acme/web"), { stories: [841], records: [] });
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.ranges.ok).toBe(true);
        expect(out.ranges.range.map((r) => r.pr)).toEqual([10]);
        expect(out.ranges.states).toEqual([{ story: 841, state: "unshipped", findings: [{ repo: "acme/web", pr: 20, finding: "open" }] }]);
        expect(out.ranges.closable).toBe(false);
        expect(seen.filter((c) => c[1] === "pr" && c[2] === "view").map((c) => c[3])).not.toContain("20");
    });
});

describe("deriveCloseRanges in a hub with a member not checked out (story #841, G5)", () => {
    it("stops naming the expected path, and fetches and creates nothing", () => {
        const parent = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-close-ranges-hub-"));
        tracked.push(parent);
        const hub = path.join(parent, "hub");
        fs.mkdirSync(path.join(hub, ".nexus", "config"), { recursive: true });
        sh(hub, "init", "-q", "-b", "main");
        sh(hub, "remote", "add", "origin", "git@github.com:acme/hub.git");
        fs.writeFileSync(
            path.join(hub, ".nexus", "config", "workspace.yml"),
            "hub:\n  name: hub\n  remote: git@github.com:acme/hub.git\nmembers:\n  - name: web\n    remote: git@github.com:acme/web.git\n",
        );
        const prs: FakePr[] = [{ number: 10, story: 841, mergedAt: "2026-09-01T00:00:00Z", base: "a".repeat(40), head: "b".repeat(40), merge: "c".repeat(40) }];
        const seen: string[] = [];

        const out = deriveCloseRanges(closeRangesDeps(platform(prs, seen), hub, "acme/hub"), { stories: [841], records: [] });
        expect(out.ok).toBe(false);
        if (out.ok || out.problem !== "checkout-missing") throw new Error("expected checkout-missing");
        expect(out.missing[0].expectedPath && path.resolve(out.missing[0].expectedPath)).toBe(path.resolve(parent, "web"));
        expect(out.missing[0].message).toContain(path.resolve(parent, "web"));
        expect(seen).toEqual([]);
        expect(fs.readdirSync(parent)).toEqual(["hub"]);
    });
});

/** Merge `branch`, already committed, into main with a merge commit; return the merge-anchored facts. */
function mergeExisting(repo: string, branch: string): { base: string; head: string; merge: string } {
    const base = sh(repo, "rev-parse", "main");
    const head = sh(repo, "rev-parse", branch);
    sh(repo, "merge", "-q", "--no-ff", "-m", `merge ${branch}`, branch);
    return { base, head, merge: sh(repo, "rev-parse", "HEAD") };
}

/** A branch off `from` with one commit writing `file`; leaves main checked out. */
function branchWith(repo: string, branch: string, from: string, file: string, content: string): void {
    sh(repo, "checkout", "-qb", branch, from);
    commitFile(repo, file, content, `${branch} change`);
    sh(repo, "checkout", "-q", "main");
}

describe("the landed check in a real checkout (story #846)", () => {
    const lines = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`);
    const withLine = (n: number, value: string) => `${lines.map((l, i) => (i === n - 1 ? value : l)).join("\n")}\n`;

    it("keeps both stories unchanged when sibling pull requests edit the same file, merged one after the other (G9)", () => {
        const repo = buildRepo();
        commitFile(repo, "src/shared.ts", withLine(0, ""), "shared");
        const fork = sh(repo, "rev-parse", "main");
        branchWith(repo, "b10", fork, "src/shared.ts", withLine(20, "story 841"));
        branchWith(repo, "b11", fork, "src/shared.ts", withLine(5, "story 842"));
        const first = mergeExisting(repo, "b11");
        const second = mergeExisting(repo, "b10");
        const prs: FakePr[] = [
            { number: 11, story: 842, mergedAt: "2026-09-01T00:00:00Z", ...first, analyzed: first.head },
            { number: 10, story: 841, mergedAt: "2026-09-02T00:00:00Z", ...second, analyzed: second.head },
        ];

        const out = deriveCloseRanges(closeRangesDeps(platform(prs, []), repo, "acme/web"), { stories: [841, 842], records: [] });
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.ranges.ok).toBe(true);
        expect(out.ranges.landed.map((s) => [s.story, s.result])).toEqual([
            [841, "unchanged"],
            [842, "unchanged"],
        ]);
        expect(out.ranges.landed[0].prs[0]).toMatchObject({ pr: 10, result: "unchanged", files: [{ path: "src/shared.ts", status: "unchanged" }] });
    });

    it("reports a reviewed file the merge landed deleted as changed, without blocking (G8)", () => {
        const repo = buildRepo();
        const fork = sh(repo, "rev-parse", "main");
        sh(repo, "checkout", "-qb", "b10", fork);
        commitFile(repo, "src/a.ts", "a\n", "a");
        commitFile(repo, "src/b.ts", "b\n", "b");
        sh(repo, "checkout", "-q", "main");
        const base = sh(repo, "rev-parse", "main");
        const head = sh(repo, "rev-parse", "b10");
        sh(repo, "merge", "-q", "--no-ff", "--no-commit", "b10");
        sh(repo, "rm", "-qf", "src/b.ts");
        sh(repo, "commit", "-qm", "merge b10 without b");
        const merge = sh(repo, "rev-parse", "HEAD");
        const prs: FakePr[] = [{ number: 10, story: 841, mergedAt: "2026-09-01T00:00:00Z", base, head, merge, analyzed: head }];

        const out = deriveCloseRanges(closeRangesDeps(platform(prs, []), repo, "acme/web"), { stories: [841], records: [] });
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.ranges.ok).toBe(true);
        expect(out.ranges.landed[0].result).toBe("changed");
        expect(out.ranges.landed[0].prs[0]).toMatchObject({
            files: [
                { path: "src/a.ts", status: "unchanged" },
                { path: "src/b.ts", status: "changed" },
            ],
        });
    });

    it("reports a merge commit the checkout holds but trunk does not reach as not landed, and blocks its story (G7)", () => {
        const repo = buildRepo();
        const fork = sh(repo, "rev-parse", "main");
        branchWith(repo, "stack-base", fork, "src/base.ts", "base\n");
        branchWith(repo, "b10", "stack-base", "src/stacked.ts", "stacked\n");
        sh(repo, "checkout", "-q", "stack-base");
        const base = sh(repo, "rev-parse", "HEAD");
        sh(repo, "merge", "-q", "--no-ff", "-m", "merge b10 into stack-base", "b10");
        const merge = sh(repo, "rev-parse", "HEAD");
        sh(repo, "checkout", "-q", "main");
        const head = sh(repo, "rev-parse", "b10");
        const prs: FakePr[] = [{ number: 10, story: 841, mergedAt: "2026-09-01T00:00:00Z", base, head, merge, analyzed: head }];

        const out = deriveCloseRanges(closeRangesDeps(platform(prs, []), repo, "acme/web"), { stories: [841], records: [] });
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.ranges.ok).toBe(false);
        expect(out.ranges.blocking).toEqual([{ kind: "not-landed", repo: "acme/web", pr: 10, mergeCommit: merge, trunkRef: "main", checkout: repo }]);
        expect(out.ranges.landed[0].result).toBe("not-landed");
    });
});

describe("deriveCloseRanges — a receipt that records story text (story #857; D12, G36, G37)", () => {
    it("reads a receipt written by 0.82.0 to 0.86.0 exactly as one without the story text, and never fetches the story", () => {
        const repo = buildRepo();
        const feature = mergeBranch(repo, "b10", "src/feature.ts");
        const pr = { number: 10, story: 841, mergedAt: "2026-09-01T00:00:00Z", ...feature, analyzed: feature.head };
        const calls: string[][] = [];
        const recording = (run: Runner): Runner => (cmd, args, opts) => (calls.push([cmd, ...args]), run(cmd, args, opts));

        const plain = deriveCloseRanges(closeRangesDeps(platform([pr], []), repo, "acme/web"), { stories: [841], records: [] });
        const old = deriveCloseRanges(
            closeRangesDeps(recording(platform([{ ...pr, receiptExtra: `story_fingerprints: { 841: ${"e".repeat(64)} }` }], [])), repo, "acme/web"),
            { stories: [841], records: [] },
        );
        expect(old).toEqual(plain);
        expect(old.ok && old.ranges.states.map((s) => [s.story, s.state])).toEqual([[841, "current"]]);
        expect(old.ok && old.ranges.closable).toBe(true);
        expect(calls.some((c) => c.some((a) => a.includes("issues/841")))).toBe(false);
    });
});
