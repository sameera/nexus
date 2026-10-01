import { describe, expect, it } from "vitest";
import { describeStoryReadFailures, readEveryStoryClaims, resolveStoryMergedPrs, type StoryMergedPr, type StoryMergedPrsRead } from "./story-prs.js";
import { type Runner } from "./run.js";

const SLUG = { owner: "acme", repo: "hub" };

interface FakePr {
    number: number;
    repo: string;
    merged?: boolean;
    mergedAt?: string;
    mergeCommit?: string | null;
    body?: string;
}

function pr(p: FakePr): Record<string, unknown> {
    return {
        number: p.number,
        merged: p.merged ?? true,
        mergedAt: p.mergedAt ?? "2026-09-01T00:00:00Z",
        mergeCommit: p.mergeCommit === null ? null : { oid: p.mergeCommit ?? `sha-${p.number}` },
        body: p.body ?? "",
        repository: { nameWithOwner: p.repo },
    };
}

interface GraphOpts {
    closing?: FakePr[];
    crossRefs?: FakePr[];
    fails?: boolean;
    garbage?: boolean;
    /** How many nodes the fake returns per page; every source pages at this size. */
    pageSize?: number;
    /** Fail the read of this page (1-based) of either source. */
    failPage?: number;
    /** Answer `issue: null`, the way GitHub answers for a number it does not know. */
    unknownIssue?: boolean;
}

function page<T>(items: T[], cursor: string | undefined, size: number): { nodes: T[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } {
    const from = cursor === undefined ? 0 : Number(cursor);
    const nodes = items.slice(from, from + size);
    const next = from + size;
    return { nodes, pageInfo: { hasNextPage: next < items.length, endCursor: nodes.length > 0 ? String(next) : null } };
}

function fakeGraph(opts: GraphOpts): Runner {
    const size = opts.pageSize ?? 100;
    return (cmd, args) => {
        if (cmd !== "gh" || args[0] !== "api" || args[1] !== "graphql") {
            return { status: 1, stdout: "", stderr: `unexpected: ${cmd} ${args.join(" ")}` };
        }
        if (opts.fails) return { status: 1, stdout: "", stderr: "gh: rate limited" };
        if (opts.garbage) return { status: 0, stdout: "not json", stderr: "" };
        if (opts.unknownIssue) return { status: 0, stdout: JSON.stringify({ data: { repository: { issue: null } } }), stderr: "" };
        const query = args.find((a) => a.startsWith("query=")) ?? "";
        const cursorArg = args.find((a) => a.startsWith("cursor="));
        const cursor = cursorArg === undefined ? undefined : cursorArg.slice("cursor=".length);
        const pageNo = cursor === undefined ? 1 : Number(cursor) / size + 1;
        if (opts.failPage !== undefined && pageNo === opts.failPage) return { status: 1, stdout: "", stderr: "HTTP 502: Bad Gateway" };
        const issue: Record<string, unknown> = {};
        if (query.includes("closedByPullRequestsReferences")) issue["closedByPullRequestsReferences"] = page((opts.closing ?? []).map(pr), cursor, size);
        if (query.includes("timelineItems")) {
            issue["timelineItems"] = page(
                (opts.crossRefs ?? []).map((p) => ({ source: pr(p) })),
                cursor,
                size,
            );
        }
        return { status: 0, stdout: JSON.stringify({ data: { repository: { issue } } }), stderr: "" };
    };
}

function prsOf(read: StoryMergedPrsRead): StoryMergedPr[] {
    if (!read.ok) throw new Error(`expected a complete read, got: ${read.failure.cause}`);
    return read.result.prs;
}

describe("resolveStoryMergedPrs — a story's merged pull requests, from the issue graph (epic #769)", () => {
    it("returns a pull request that merged in another repository, naming that repository", () => {
        const run = fakeGraph({ closing: [{ number: 12, repo: "acme/member", mergeCommit: "abc" }] });
        const out = prsOf(resolveStoryMergedPrs(run, "/hub", SLUG, 770));
        expect(out).toEqual([
            { story: 770, pr: 12, repo: "acme/member", mergeCommit: "abc", mergedAt: "2026-09-01T00:00:00Z", edge: "closing" },
        ]);
    });

    it("returns both merged pull requests when a story shipped in two", () => {
        const run = fakeGraph({
            closing: [
                { number: 21, repo: "acme/member", mergedAt: "2026-09-05T00:00:00Z" },
                { number: 9, repo: "acme/member", mergedAt: "2026-09-02T00:00:00Z" },
            ],
        });
        const out = prsOf(resolveStoryMergedPrs(run, "/hub", SLUG, 770));
        expect(out.map((p) => p.pr)).toEqual([9, 21]);
    });

    it("queries only the issues repository, so holding no copy of the code repository changes nothing", () => {
        const seen: string[] = [];
        const base = fakeGraph({ closing: [{ number: 12, repo: "acme/member" }] });
        const run: Runner = (cmd, args, opts) => {
            seen.push(args.filter((a) => a.startsWith("owner=") || a.startsWith("repo=")).join(","));
            return base(cmd, args, opts);
        };
        const fromHub = resolveStoryMergedPrs(run, "/hub", SLUG, 770);
        const fromElsewhere = resolveStoryMergedPrs(run, "/somewhere-with-no-member-checkout", SLUG, 770);
        expect(fromElsewhere).toEqual(fromHub);
        expect(new Set(seen)).toEqual(new Set(["owner=acme,repo=hub"]));
    });

    it("returns none and still names the story when nothing merged for it", () => {
        const run = fakeGraph({ closing: [{ number: 30, repo: "acme/hub", merged: false }] });
        const out = resolveStoryMergedPrs(run, "/hub", SLUG, 770);
        expect(out).toEqual({ ok: true, result: { story: 770, prs: [] } });
    });

    it("accepts a cross-referencing pull request only once it claims the story", () => {
        const claiming = { number: 40, repo: "acme/member", body: "Closes acme/hub#770" };
        const mentioning = { number: 41, repo: "acme/member", body: "see acme/hub#770 for background" };
        const out = prsOf(resolveStoryMergedPrs(fakeGraph({ crossRefs: [claiming, mentioning] }), "/hub", SLUG, 770));
        expect(out.map((p) => p.pr)).toEqual([40]);
        expect(out[0].edge).toBe("cross-reference");
    });

    it("does not read a bare number in another repository's pull request as a claim on this story", () => {
        const out = prsOf(
            resolveStoryMergedPrs(fakeGraph({ crossRefs: [{ number: 42, repo: "acme/member", body: "Closes #770" }] }), "/hub", SLUG, 770),
        );
        expect(out).toEqual([]);
    });

    it("reads a bare claim inside the issues repository itself", () => {
        const out = prsOf(
            resolveStoryMergedPrs(fakeGraph({ crossRefs: [{ number: 43, repo: "acme/hub", body: "Closes #770" }] }), "/hub", SLUG, 770),
        );
        expect(out.map((p) => p.pr)).toEqual([43]);
    });

    it("keeps the closing edge when a pull request arrives on both edges", () => {
        const both = { number: 50, repo: "acme/hub", body: "Closes #770" };
        const out = prsOf(resolveStoryMergedPrs(fakeGraph({ closing: [both], crossRefs: [both] }), "/hub", SLUG, 770));
        expect(out.map((p) => p.edge)).toEqual(["closing"]);
    });

    it("reports a failed read as a failure naming the story and the cause, never as no pull request", () => {
        for (const opts of [{ fails: true }, { garbage: true }]) {
            const out = resolveStoryMergedPrs(fakeGraph(opts), "/hub", SLUG, 770);
            expect(out.ok).toBe(false);
            if (out.ok) continue;
            expect(out.failure.story).toBe(770);
            expect(out.failure.cause.length).toBeGreaterThan(0);
        }
        const limited = resolveStoryMergedPrs(fakeGraph({ fails: true }), "/hub", SLUG, 770);
        expect(limited.ok ? "" : limited.failure.cause).toContain("rate limited");
    });

    it("reports a story GitHub does not know as a failure, not as no pull request", () => {
        const out = resolveStoryMergedPrs(fakeGraph({ unknownIssue: true }), "/hub", SLUG, 770);
        expect(out.ok).toBe(false);
        expect(out.ok ? "" : out.failure.cause).toMatch(/770/);
    });
});

describe("resolveStoryMergedPrs — the read is complete or it fails (epic #827, story #834)", () => {
    const many = (n: number, from: number, repo: string, body = ""): FakePr[] =>
        Array.from({ length: n }, (_, i) => ({ number: from + i, repo, body, mergedAt: `2026-09-01T00:00:${String(i % 60).padStart(2, "0")}Z` }));

    it("returns every closing pull request when they span more than one page", () => {
        const closing = many(7, 100, "acme/hub");
        const out = prsOf(resolveStoryMergedPrs(fakeGraph({ closing, pageSize: 3 }), "/hub", SLUG, 770));
        expect(out.map((p) => p.pr).sort((a, b) => a - b)).toEqual(closing.map((p) => p.number));
    });

    it("finds the claiming pull request behind a full page of mere mentions", () => {
        const mentions = many(5, 200, "acme/hub", "see #770");
        const shipped: FakePr = { number: 999, repo: "acme/member", body: "Closes acme/hub#770" };
        const out = prsOf(resolveStoryMergedPrs(fakeGraph({ crossRefs: [...mentions, shipped], pageSize: 5 }), "/hub", SLUG, 770));
        expect(out.map((p) => p.pr)).toEqual([999]);
    });

    it("fails the whole read when a later page fails, rather than returning the pages already read", () => {
        const closing = many(7, 100, "acme/hub");
        const out = resolveStoryMergedPrs(fakeGraph({ closing, pageSize: 3, failPage: 2 }), "/hub", SLUG, 770);
        expect(out.ok).toBe(false);
        expect(out.ok ? "" : out.failure.cause).toContain("502");
    });

    it("keeps the closing edge when the same pull request arrives on both edges across pages", () => {
        const both: FakePr = { number: 50, repo: "acme/hub", body: "Closes #770" };
        const out = prsOf(
            resolveStoryMergedPrs(fakeGraph({ closing: [...many(3, 1, "acme/hub"), both], crossRefs: [...many(3, 300, "acme/hub", "see #770"), both], pageSize: 3 }), "/hub", SLUG, 770),
        );
        expect(out.filter((p) => p.pr === 50).map((p) => p.edge)).toEqual(["closing"]);
    });
});

describe("readEveryStoryClaims — one run names every unreadable story (story #834)", () => {
    function perStory(byStory: Record<number, GraphOpts>): Runner {
        return (cmd, args, opts) => {
            const num = Number((args.find((a) => a.startsWith("num=")) ?? "num=0").slice(4));
            return fakeGraph(byStory[num] ?? {})(cmd, args, opts);
        };
    }

    it("returns each story's claiming pull requests when every read succeeds", () => {
        const out = readEveryStoryClaims(perStory({ 1: { closing: [{ number: 10, repo: "acme/hub" }] } }), "/hub", SLUG, [1, 2]);
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.byStory[1].map((p) => p.pr)).toEqual([10]);
        expect(out.byStory[2]).toEqual([]);
    });

    it("reads every story and names each one that failed, with its cause", () => {
        const out = readEveryStoryClaims(perStory({ 1: { fails: true }, 3: { unknownIssue: true } }), "/hub", SLUG, [1, 2, 3]);
        expect(out.ok).toBe(false);
        if (out.ok) return;
        expect(out.failures.map((f) => f.story)).toEqual([1, 3]);
        const told = describeStoryReadFailures(out.failures, "acme/hub");
        expect(told).toContain("acme/hub#1");
        expect(told).toContain("rate limited");
        expect(told).toContain("acme/hub#3");
        expect(told).toMatch(/re-run/i);
    });
});
