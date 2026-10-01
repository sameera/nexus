/**
 * Close's per-story evidence report (epic #827, decision record #837, D4). Each case drives the
 * report through the reads it depends on — the claiming read and the selected receipt of each
 * claiming pull request — and asserts what close is told.
 */

import { describe, expect, it } from "vitest";
import { type AnalyzeReceipt } from "@nexus/pr-acceptance/verify";
import { collectEvidence, evidenceDeps, type EvidenceDeps, type ReceiptRead } from "./evidence.js";
import { type Runner } from "./run.js";
import { type StoryMergedPr, type StoryMergedPrsRead } from "./story-prs.js";

function merged(story: number, pr: number, repo = "acme/hub"): StoryMergedPr {
    return { story, pr, repo, mergeCommit: `sha-${pr}`, mergedAt: "2026-09-01T00:00:00Z", edge: "closing" };
}

function receipt(stories: number[]): AnalyzeReceipt {
    return {
        epic: "#827",
        nexusVersion: null,
        pr: null,
        date: "2026-09-30",
        head: "abc",
        mode: "full",
        findings: {},
        repo: "acme/hub",
        stories,
        record: null,
        recordHash: null,
        issuesRepo: "acme/hub",
    };
}

interface FakeWorld {
    claims?: Record<number, StoryMergedPr[] | string>;
    receipts?: Record<number, AnalyzeReceipt | null | string>;
}

function deps(world: FakeWorld, seen: { claims: number[]; receipts: number[] } = { claims: [], receipts: [] }): EvidenceDeps {
    return {
        readClaims(story: number): StoryMergedPrsRead {
            seen.claims.push(story);
            const c = world.claims?.[story] ?? [];
            if (typeof c === "string") return { ok: false, failure: { story, cause: c } };
            return { ok: true, result: { story, prs: c } };
        },
        readReceipt(pr: StoryMergedPr): ReceiptRead {
            seen.receipts.push(pr.pr);
            const r = world.receipts?.[pr.pr] ?? null;
            if (typeof r === "string") return { ok: false, cause: r };
            return { ok: true, receipt: r };
        },
    };
}

describe("collectEvidence — the claiming read behind close's report (story #834)", () => {
    it("reads every live story's claiming pull requests and the receipt each one carries", () => {
        const seen = { claims: [] as number[], receipts: [] as number[] };
        const out = collectEvidence(deps({ claims: { 1: [merged(1, 10)], 2: [merged(2, 20)] }, receipts: { 10: receipt([1]) } }, seen), {
            stories: [2, 1],
        });
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.report.stories.map((s) => s.story)).toEqual([1, 2]);
        expect(out.report.stories[0].prs).toEqual([{ repo: "acme/hub", pr: 10, receipt: true }]);
        expect(out.report.stories[1].prs).toEqual([{ repo: "acme/hub", pr: 20, receipt: false }]);
        expect(seen.receipts.sort()).toEqual([10, 20]);
    });

    it("stops on a failed claiming read, naming the story and the cause, after reading every other story", () => {
        const seen = { claims: [] as number[], receipts: [] as number[] };
        const out = collectEvidence(deps({ claims: { 1: "HTTP 502 on page 2", 2: [], 3: "rate limited" } }, seen), { stories: [1, 2, 3] });
        expect(out.ok).toBe(false);
        if (out.ok) return;
        expect(out.failures).toEqual([
            { story: 1, cause: "HTTP 502 on page 2" },
            { story: 3, cause: "rate limited" },
        ]);
        expect(seen.claims).toEqual([1, 2, 3]);
    });

    it("stops when a claiming pull request's receipt cannot be selected, naming the story", () => {
        const out = collectEvidence(deps({ claims: { 4: [merged(4, 40)] }, receipts: { 40: "gh pr view 40 failed" } }), { stories: [4] });
        expect(out.ok).toBe(false);
        if (out.ok) return;
        expect(out.failures).toHaveLength(1);
        expect(out.failures[0].story).toBe(4);
        expect(out.failures[0].cause).toContain("#40");
        expect(out.failures[0].cause).toContain("gh pr view 40 failed");
    });

    it("does not read a story marked as shipping without its own pull request", () => {
        const seen = { claims: [] as number[], receipts: [] as number[] };
        const out = collectEvidence(deps({ claims: { 5: "would fail if read" } }, seen), { stories: [5, 6], excluded: [5] });
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(seen.claims).toEqual([6]);
        expect(out.report.stories.map((s) => s.story)).toEqual([6]);
        expect(out.report.excluded).toEqual([5]);
    });

    it("reads a pull request that claims two stories once", () => {
        const seen = { claims: [] as number[], receipts: [] as number[] };
        collectEvidence(deps({ claims: { 1: [merged(1, 10)], 2: [merged(2, 10)] } }, seen), { stories: [1, 2] });
        expect(seen.receipts).toEqual([10]);
    });
});

describe("evidenceDeps — the platform-backed reads (story #834)", () => {
    const block = (stories: string) =>
        "<!-- nexus:analyze-receipt -->\n```yaml\nepic: \"#827\"\npr: 12\nhead: abc\nmode: full\nrepo: acme/member\nissues_repo: acme/hub\nstories: " +
        stories +
        "\n```";

    function platform(opts: { claimFails?: boolean; prViewFails?: boolean }, seen: string[][] = []): Runner {
        return (cmd, args) => {
            seen.push([cmd, ...args]);
            if (cmd === "gh" && args[0] === "api" && args[1] === "graphql") {
                if (opts.claimFails) return { status: 1, stdout: "", stderr: "HTTP 403: rate limit exceeded" };
                const q = args.find((a) => a.startsWith("query=")) ?? "";
                const conn = (nodes: unknown[]) => ({ nodes, pageInfo: { hasNextPage: false, endCursor: null } });
                const pr = { number: 12, merged: true, mergedAt: "2026-09-01T00:00:00Z", mergeCommit: { oid: "m" }, body: "", repository: { nameWithOwner: "acme/member" } };
                const issue = q.includes("closedByPullRequestsReferences") ? { closedByPullRequestsReferences: conn([pr]) } : { timelineItems: conn([]) };
                return { status: 0, stdout: JSON.stringify({ data: { repository: { issue } } }), stderr: "" };
            }
            if (cmd === "gh" && args[0] === "pr" && args[1] === "view") {
                if (opts.prViewFails) return { status: 1, stdout: "", stderr: "HTTP 502" };
                return { status: 0, stdout: JSON.stringify({ reviews: [], comments: [{ body: block("[834]"), createdAt: "2026-09-02T00:00:00Z" }], headRefOid: "abc" }), stderr: "" };
            }
            return { status: 1, stdout: "", stderr: `unexpected: ${cmd} ${args.join(" ")}` };
        };
    }

    it("reads a story's claiming pull request and its receipt from the repository it merged in", () => {
        const seen: string[][] = [];
        const out = collectEvidence(evidenceDeps(platform({}, seen), "/hub", "acme/hub"), { stories: [834] });
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.report.stories[0].prs).toEqual([{ repo: "acme/member", pr: 12, receipt: true }]);
        const prView = seen.find((c) => c[1] === "pr");
        expect(prView).toEqual(expect.arrayContaining(["--repo", "acme/member"]));
        const graph = seen.find((c) => c[1] === "api") ?? [];
        expect(graph).toEqual(expect.arrayContaining(["owner=acme", "repo=hub"]));
    });

    it("turns a failed claiming read or receipt read into a failure naming the story", () => {
        for (const opts of [{ claimFails: true }, { prViewFails: true }]) {
            const out = collectEvidence(evidenceDeps(platform(opts), "/hub", "acme/hub"), { stories: [834] });
            expect(out.ok).toBe(false);
            if (out.ok) continue;
            expect(out.failures[0].story).toBe(834);
        }
    });
});
