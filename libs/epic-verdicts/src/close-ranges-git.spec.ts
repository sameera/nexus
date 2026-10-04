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
                    .map((p) => ({ number: p.number, merged: true, mergedAt: p.mergedAt, mergeCommit: { oid: p.merge }, body: "", repository: { nameWithOwner: "acme/web" } }));
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
