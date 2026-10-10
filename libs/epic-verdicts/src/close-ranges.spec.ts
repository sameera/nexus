/**
 * Close derives each story's commit ranges itself (epic #828, story #841, decision record #849,
 * D1–D3). Each case drives the derivation through the reads and git operations it depends on and
 * asserts what close is told.
 */

import { describe, expect, it } from "vitest";
import { type LandedChangeResult } from "@nexus/pr-worktree/landed-change";
import { type RepoCheckoutResult } from "@nexus/pr-worktree/repo-checkout";
import { type AnalyzeReceipt } from "@nexus/pr-acceptance/verify";
import { WAIVER_MARKER, parseWaiverBlock, type WaiverComment } from "@nexus/pr-acceptance/waiver";
import { closeRangesDeps, deriveCloseRanges, type CloseRangesDeps, type DeriveOutcome } from "./close-ranges.js";
import { type Runner } from "./run.js";
import { onIssuesHost } from "./verdict-repos.js";
import { type ShippedRecord } from "./ledger.js";
import { type StoryClaimingPr, type StoryMergedPr } from "./story-prs.js";

const SHA = (c: string) => c.repeat(40).slice(0, 40);

function merged(story: number, pr: number, mergedAt: string, repo = "acme/web"): StoryClaimingPr {
    return { story, pr, repo, state: "merged", mergeCommit: `merge-${pr}`, mergedAt, edge: "closing" };
}

function record(stories: number[], pr: number, repo = "acme/web", mergeCommit = `merge-${pr}`): ShippedRecord {
    return {
        epic: "#828",
        stories,
        repo,
        pr,
        mergeCommit,
        mergedAt: "2026-09-01T00:00:00Z",
        base: `rec-base-${pr}`,
        head: `rec-head-${pr}`,
        findings: { critical: 0, high: 0, medium: 0, low: 0 },
        recordHash: null,
        nexusVersion: null,
    };
}

interface World {
    claims?: Record<number, StoryClaimingPr[] | string>;
    /** Repositories with no checkout, mapped to the path it was expected at (null: undeclared). */
    missing?: Record<string, string | null>;
    /** Commits absent from the checkout. */
    absent?: string[];
    /** Derivation outcome per pull request; defaults to a derived range. */
    derive?: Record<number, DeriveOutcome>;
    /** Merge commits the checkout holds but trunk does not reach. */
    offTrunk?: string[];
    /** The analyzed head of each pull request's selected receipt, or a read failure; none by default. */
    receipts?: Record<number, { head: string; stories?: number[]; recordHash?: string } | { fail: string }>;
    /** The epic's decision record as read now: its digest, a read failure, or none (the default). */
    record?: { digest: string } | { fail: string } | null;
    /** Each pull request's head; defaults to `head-<pr>`. */
    prHeads?: Record<number, string>;
    /** The landed check's answer per pull request; defaults to every file unchanged. */
    landed?: Record<number, LandedChangeResult>;
    /** The waiver comments on each pull request, or a read failure; none by default. */
    waivers?: Record<number, PostedWaiver[] | { fail: string }>;
}

interface PostedWaiver {
    body: string;
    author?: string;
    trusted?: boolean;
    url?: string;
    at?: string;
}

interface Seen {
    claims: number[];
    checkouts: string[];
    derived: number[];
    compared?: Array<{ pr: number; analyzedHead: string; base: string; head: string }>;
    waiverReads?: number[];
}

function receipt(head: string, stories: number[] = [], recordHash: string | null = null): AnalyzeReceipt {
    return {
        epic: "#828",
        nexusVersion: null,
        pr: null,
        date: "2026-09-01",
        head,
        mode: "full",
        findings: {},
        repo: null,
        stories,
        record: recordHash === null ? null : "#849",
        recordHash,
        issuesRepo: null,
    };
}

function deps(world: World, seen: Seen = { claims: [], checkouts: [], derived: [] }): CloseRangesDeps {
    return {
        readClaims(story) {
            seen.claims.push(story);
            const c = world.claims?.[story] ?? [];
            if (typeof c === "string") return { ok: false, failure: { story, cause: c } };
            return { ok: true, result: { story, prs: c } };
        },
        checkoutFor(repo): RepoCheckoutResult {
            seen.checkouts.push(repo);
            const m = world.missing ?? {};
            if (repo in m) {
                const expected = m[repo];
                return expected === null
                    ? { ok: false, error: { problem: "repo-checkout-unknown", message: `'${repo}' is not declared` } }
                    : { ok: false, expectedPath: expected, error: { problem: "member-checkout-missing", message: `expected it at ${expected}` } };
            }
            return { ok: true, checkout: `/co/${repo}` };
        },
        hasCommit: (_checkout, sha) => !(world.absent ?? []).includes(sha),
        fetchCommand: (checkout) => `git -C ${checkout} fetch origin`,
        derive(_checkout, pr) {
            seen.derived.push(pr.pr);
            return world.derive?.[pr.pr] ?? { ok: true, base: SHA(String(pr.pr % 10)), head: SHA("f") };
        },
        onTrunk: (_checkout, sha) => ({ ok: true, onTrunk: !(world.offTrunk ?? []).includes(sha), trunkRef: "origin/main" }),
        readReceipt(pr) {
            const r = world.receipts?.[pr.pr];
            const prHead = world.prHeads?.[pr.pr] ?? `head-${pr.pr}`;
            if (r === undefined) return { ok: true, receipt: null, prHead };
            if ("fail" in r) return { ok: false, cause: r.fail };
            return { ok: true, receipt: receipt(r.head, r.stories, r.recordHash ?? null), prHead };
        },
        readRecord() {
            const r = world.record ?? null;
            if (r === null) return { ok: true, record: null };
            if ("fail" in r) return { ok: false, cause: r.fail };
            return { ok: true, record: { issue: 849, digest: r.digest } };
        },
        compareLanded(_checkout, pr, input) {
            seen.compared?.push({ pr: pr.pr, ...input });
            return world.landed?.[pr.pr] ?? { ok: true, files: [{ path: "src/a.ts", status: "unchanged" }] };
        },
        readWaivers(pr) {
            seen.waiverReads?.push(pr.pr);
            const w = world.waivers?.[pr.pr] ?? [];
            if ("fail" in w) return { ok: false, cause: w.fail };
            const comments: WaiverComment[] = w.map((c, i) => ({
                author: c.author ?? "lead",
                url: c.url ?? `https://github.com/${pr.repo}/pull/${pr.pr}#issuecomment-${i}`,
                at: c.at ?? `2026-10-0${i + 1}T00:00:00Z`,
                trusted: c.trusted ?? true,
                waiver: parseWaiverBlock(c.body) ?? { ok: false, problem: "no marker" },
            }));
            return { ok: true, waivers: { pr: pr.pr, comments } };
        },
    };
}

describe("deriveCloseRanges — ranges without a lead supplying one (D1, D2; G1)", () => {
    it("derives the range of every merged claiming pull request, with no range supplied", () => {
        const seen: Seen = { claims: [], checkouts: [], derived: [] };
        const out = deriveCloseRanges(deps({ claims: { 841: [merged(841, 12, "2026-09-02T00:00:00Z")] } }, seen), { stories: [841], records: [] });
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.ranges.ok).toBe(true);
        expect(out.ranges.stories).toEqual([
            { story: 841, ranges: [{ repo: "acme/web", pr: 12, source: "derived", base: SHA("2"), head: SHA("f"), checkout: "/co/acme/web" }] },
        ]);
        expect(out.ranges.range).toEqual([{ repo: "acme/web", pr: 12, base: SHA("2"), head: SHA("f") }]);
        expect(seen.derived).toEqual([12]);
    });

    it("lists a story claimed by several pull requests in merge order, not pull-request number order", () => {
        const out = deriveCloseRanges(
            deps({ claims: { 841: [merged(841, 30, "2026-09-01T00:00:00Z"), merged(841, 21, "2026-09-05T00:00:00Z")] } }),
            { stories: [841], records: [] },
        );
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.ranges.stories[0].ranges.map((r) => r.pr)).toEqual([30, 21]);
        expect(out.ranges.range.map((r) => r.pr)).toEqual([30, 21]);
    });

    it("stamps a pull request that implements two stories once in the range list, and names it under both stories", () => {
        const pr = (story: number) => merged(story, 40, "2026-09-03T00:00:00Z");
        const out = deriveCloseRanges(deps({ claims: { 1: [pr(1)], 2: [pr(2)] } }), { stories: [2, 1], records: [] });
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.ranges.stories.map((s) => [s.story, s.ranges.map((r) => r.pr)])).toEqual([
            [1, [40]],
            [2, [40]],
        ]);
        expect(out.ranges.range).toHaveLength(1);
    });

    it("never reads an excluded story", () => {
        const seen: Seen = { claims: [], checkouts: [], derived: [] };
        const out = deriveCloseRanges(deps({ claims: { 1: [merged(1, 10, "2026-09-01T00:00:00Z")] } }, seen), { stories: [1, 2], excluded: [2], records: [] });
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(seen.claims).toEqual([1]);
        expect(out.ranges.excluded).toEqual([2]);
        expect(out.ranges.stories.map((s) => s.story)).toEqual([1]);
    });

    it("a failed claiming read stops the derivation, names every unreadable story, and derives nothing", () => {
        const seen: Seen = { claims: [], checkouts: [], derived: [] };
        const out = deriveCloseRanges(deps({ claims: { 1: "gh: HTTP 502", 2: [merged(2, 20, "2026-09-01T00:00:00Z")], 3: "rate limited" } }, seen), {
            stories: [1, 2, 3],
            records: [],
        });
        expect(out.ok).toBe(false);
        if (out.ok || out.problem !== "story-read-failed") throw new Error("expected story-read-failed");
        expect(out.failures.map((f) => f.story)).toEqual([1, 3]);
        expect(seen.derived).toEqual([]);
    });
});

describe("deriveCloseRanges — a pull request with no attributable commits (G2)", () => {
    it("names that story as having no range instead of leaving it out", () => {
        const out = deriveCloseRanges(
            deps({
                claims: { 841: [merged(841, 12, "2026-09-01T00:00:00Z"), merged(841, 13, "2026-09-02T00:00:00Z")] },
                derive: { 13: { ok: false, problem: "range-empty-diff", message: "empty diff" } },
            }),
            { stories: [841], records: [] },
        );
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.ranges.ok).toBe(true);
        expect(out.ranges.stories[0].ranges).toContainEqual({ repo: "acme/web", pr: 13, source: "no-range", checkout: "/co/acme/web" });
        expect(out.ranges.range.map((r) => r.pr)).toEqual([12]);
        expect(out.ranges.lines.join("\n")).toMatch(/#841[\s\S]*acme\/web#13[^\n]*no range/);
    });

    it("keeps it in its merge-order place among every merged pull request (D6)", () => {
        const out = deriveCloseRanges(
            deps({
                claims: { 841: [merged(841, 12, "2026-09-02T00:00:00Z"), merged(841, 13, "2026-09-01T00:00:00Z")] },
                derive: { 13: { ok: false, problem: "range-empty-diff", message: "empty diff" } },
            }),
            { stories: [841], records: [] },
        );
        if (!out.ok) throw new Error("expected ranges");
        expect(out.ranges.merged).toEqual([
            { repo: "acme/web", pr: 13 },
            { repo: "acme/web", pr: 12 },
        ]);
    });

    it("blocks, naming the pull request, when the range cannot be derived for any other reason", () => {
        const out = deriveCloseRanges(
            deps({ claims: { 841: [merged(841, 12, "2026-09-01T00:00:00Z")] }, derive: { 12: { ok: false, problem: "range-ambiguous", message: "squash or rebase" } } }),
            { stories: [841], records: [] },
        );
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.ranges.ok).toBe(false);
        expect(out.ranges.blocking).toEqual([{ kind: "range-underivable", repo: "acme/web", pr: 12, problem: "range-ambiguous", message: "squash or rebase" }]);
    });
});

describe("deriveCloseRanges — a stamped range where a shipped record exists (D2; G18)", () => {
    it("uses the recorded range verbatim and derives nothing for that pull request", () => {
        const seen: Seen = { claims: [], checkouts: [], derived: [] };
        const out = deriveCloseRanges(
            deps({ claims: { 841: [merged(841, 12, "2026-09-01T00:00:00Z", "acme/web"), merged(841, 14, "2026-09-02T00:00:00Z")] } }, seen),
            { stories: [841], records: [record([841], 12, "github.com/acme/web")] },
        );
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.ranges.stories[0].ranges[0]).toMatchObject({ pr: 12, source: "record", base: "rec-base-12", head: "rec-head-12" });
        expect(out.ranges.range[0]).toEqual({ repo: "github.com/acme/web", pr: 12, base: "rec-base-12", head: "rec-head-12" });
        expect(seen.derived).toEqual([14]);
    });

    it("keeps the hard block when the platform no longer reports the merge commit the record stamped", () => {
        const out = deriveCloseRanges(deps({ claims: { 841: [merged(841, 12, "2026-09-01T00:00:00Z")] } }), {
            stories: [841],
            records: [record([841], 12, "acme/web", "merge-OLD")],
        });
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.ranges.ok).toBe(false);
        expect(out.ranges.blocking).toEqual([{ kind: "merge-commit-moved", repo: "acme/web", pr: 12, recorded: "merge-OLD", reported: "merge-12" }]);
        expect(out.ranges.range).toEqual([]);
    });
});

describe("deriveCloseRanges — checkouts (D3; G5, G6)", () => {
    it("stops before deriving or fetching anything when a member has no checkout, naming the expected path", () => {
        const seen: Seen = { claims: [], checkouts: [], derived: [] };
        const out = deriveCloseRanges(
            deps(
                {
                    claims: { 1: [merged(1, 10, "2026-09-01T00:00:00Z", "acme/web")], 2: [merged(2, 20, "2026-09-02T00:00:00Z", "acme/widget")] },
                    missing: { "acme/widget": "/work/widget" },
                },
                seen,
            ),
            { stories: [1, 2], records: [] },
        );
        expect(out.ok).toBe(false);
        if (out.ok || out.problem !== "checkout-missing") throw new Error("expected checkout-missing");
        expect(out.missing).toEqual([{ repo: "acme/widget", expectedPath: "/work/widget", problem: "member-checkout-missing", message: "expected it at /work/widget" }]);
        expect(seen.derived).toEqual([]);
    });

    it("stops on a missing checkout even for a pull request that carries a shipped record", () => {
        const out = deriveCloseRanges(deps({ claims: { 1: [merged(1, 10, "2026-09-01T00:00:00Z", "acme/widget")] }, missing: { "acme/widget": "/work/widget" } }), {
            stories: [1],
            records: [record([1], 10, "acme/widget")],
        });
        expect(out.ok).toBe(false);
        if (out.ok) return;
        expect(out.problem).toBe("checkout-missing");
    });

    it("names a repository once however many pull requests merged there", () => {
        const out = deriveCloseRanges(
            deps({
                claims: { 1: [merged(1, 10, "2026-09-01T00:00:00Z", "acme/widget"), merged(1, 11, "2026-09-02T00:00:00Z", "acme/widget")] },
                missing: { "acme/widget": "/work/widget" },
            }),
            { stories: [1], records: [] },
        );
        if (out.ok || out.problem !== "checkout-missing") throw new Error("expected checkout-missing");
        expect(out.missing).toHaveLength(1);
    });

    it("reports a merge commit the checkout does not hold as checkout behind, naming the fetch, never as not landed", () => {
        const seen: Seen = { claims: [], checkouts: [], derived: [] };
        const out = deriveCloseRanges(deps({ claims: { 1: [merged(1, 10, "2026-09-01T00:00:00Z")] }, absent: ["merge-10"] }, seen), { stories: [1], records: [] });
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.ranges.ok).toBe(false);
        expect(out.ranges.blocking).toEqual([
            { kind: "checkout-behind", repo: "acme/web", pr: 10, mergeCommit: "merge-10", checkout: "/co/acme/web", fetch: "git -C /co/acme/web fetch origin" },
        ]);
        expect(out.ranges.lines.join("\n")).toMatch(/checkout behind[\s\S]*git -C \/co\/acme\/web fetch origin/);
        expect(out.ranges.lines.join("\n")).not.toMatch(/not landed/);
        expect(seen.derived).toEqual([]);
    });
});

describe("deriveCloseRanges — a merge commit that did not reach trunk (D3; G7)", () => {
    it("reports the pull request as not landed and blocks its story, deriving nothing for it", () => {
        const seen: Seen = { claims: [], checkouts: [], derived: [] };
        const out = deriveCloseRanges(deps({ claims: { 1: [merged(1, 10, "2026-09-01T00:00:00Z")] }, offTrunk: ["merge-10"] }, seen), { stories: [1], records: [] });
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.ranges.ok).toBe(false);
        expect(out.ranges.blocking).toEqual([
            { kind: "not-landed", repo: "acme/web", pr: 10, mergeCommit: "merge-10", trunkRef: "origin/main", checkout: "/co/acme/web" },
        ]);
        expect(out.ranges.landed).toEqual([{ story: 1, result: "not-landed", prs: [{ repo: "acme/web", pr: 10, result: "not-landed", mergeCommit: "merge-10", trunkRef: "origin/main" }] }]);
        expect(out.ranges.lines.join("\n")).toMatch(/acme\/web#10[^\n]*not landed/);
        expect(seen.derived).toEqual([]);
    });

    it("applies to a pull request whose range a shipped record stamped", () => {
        const out = deriveCloseRanges(deps({ claims: { 1: [merged(1, 10, "2026-09-01T00:00:00Z")] }, offTrunk: ["merge-10"] }), {
            stories: [1],
            records: [record([1], 10)],
        });
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.ranges.blocking.map((b) => b.kind)).toEqual(["not-landed"]);
    });
});

describe("deriveCloseRanges — the landed check (D4; G8, G9)", () => {
    const one = { 1: [merged(1, 10, "2026-09-01T00:00:00Z")] };

    it("compares the reviewed change with the pull request's own range when the analyzed head is the merged head", () => {
        const seen: Seen = { claims: [], checkouts: [], derived: [], compared: [] };
        const out = deriveCloseRanges(
            deps(
                {
                    claims: one,
                    receipts: { 10: { head: "head-10" } },
                    landed: { 10: { ok: true, files: [{ path: "src/a.ts", status: "unchanged" }, { path: "src/b.ts", status: "changed" }] } },
                },
                seen,
            ),
            { stories: [1], records: [] },
        );
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(seen.compared).toEqual([{ pr: 10, analyzedHead: "head-10", base: SHA("0"), head: SHA("f") }]);
        expect(out.ranges.landed).toEqual([
            {
                story: 1,
                result: "changed",
                prs: [
                    {
                        repo: "acme/web",
                        pr: 10,
                        result: "changed",
                        analyzedHead: "head-10",
                        files: [
                            { path: "src/a.ts", status: "unchanged" },
                            { path: "src/b.ts", status: "changed" },
                        ],
                    },
                ],
            },
        ]);
        expect(out.ranges.lines.join("\n")).toMatch(/#1 — landed check:[^\n]*acme\/web#10 changed[^\n]*src\/b\.ts/);
    });

    it("reports a changed file as a landed result, not a range block (the stale gate stops on it)", () => {
        const out = deriveCloseRanges(deps({ claims: one, receipts: { 10: { head: "head-10" } }, landed: { 10: { ok: true, files: [{ path: "x", status: "changed" }] } } }), {
            stories: [1],
            records: [],
        });
        expect(out.ok && out.ranges.ok).toBe(true);
    });

    it("checks a recorded range against the record's base and head", () => {
        const seen: Seen = { claims: [], checkouts: [], derived: [], compared: [] };
        deriveCloseRanges(deps({ claims: one, receipts: { 10: { head: "head-10" } } }, seen), { stories: [1], records: [record([1], 10)] });
        expect(seen.compared).toEqual([{ pr: 10, analyzedHead: "head-10", base: "rec-base-10", head: "rec-head-10" }]);
    });

    it("does not check a pull request whose analyzed head is not its merged head", () => {
        const seen: Seen = { claims: [], checkouts: [], derived: [], compared: [] };
        const out = deriveCloseRanges(deps({ claims: one, receipts: { 10: { head: "old-head" } } }, seen), { stories: [1], records: [] });
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.ranges.ok).toBe(true);
        expect(seen.compared).toEqual([]);
        expect(out.ranges.landed[0]).toEqual({
            story: 1,
            result: "not-checked",
            prs: [{ repo: "acme/web", pr: 10, result: "not-checked", reason: "head-mismatch", analyzedHead: "old-head", mergedHead: "head-10" }],
        });
    });

    it("does not check a pull request with no receipt, and does not block on it", () => {
        const out = deriveCloseRanges(deps({ claims: one }), { stories: [1], records: [] });
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.ranges.ok).toBe(true);
        expect(out.ranges.landed[0].prs).toEqual([{ repo: "acme/web", pr: 10, result: "not-checked", reason: "no-receipt" }]);
        expect(out.ranges.lines.join("\n")).toMatch(/acme\/web#10 not checked \(no receipt\)/);
    });

    it("does not check a pull request with no range", () => {
        const out = deriveCloseRanges(
            deps({ claims: one, receipts: { 10: { head: "head-10" } }, derive: { 10: { ok: false, problem: "range-empty-diff", message: "empty" } } }),
            { stories: [1], records: [] },
        );
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.ranges.landed[0].prs).toEqual([{ repo: "acme/web", pr: 10, result: "not-checked", reason: "no-range" }]);
    });

    it("calls a story unchanged only when every pull request claiming it was checked and unchanged", () => {
        const two = { 1: [merged(1, 10, "2026-09-01T00:00:00Z"), merged(1, 11, "2026-09-02T00:00:00Z")] };
        const partly = deriveCloseRanges(deps({ claims: two, receipts: { 10: { head: "head-10" } } }), { stories: [1], records: [] });
        const fully = deriveCloseRanges(deps({ claims: two, receipts: { 10: { head: "head-10" }, 11: { head: "head-11" } } }), { stories: [1], records: [] });
        expect(partly.ok && partly.ranges.landed[0].result).toBe("not-checked");
        expect(fully.ok && fully.ranges.landed[0].result).toBe("unchanged");
    });

    it("blocks, naming the pull request, when its receipt cannot be read", () => {
        const out = deriveCloseRanges(deps({ claims: one, receipts: { 10: { fail: "gh: HTTP 502" } } }), { stories: [1], records: [] });
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.ranges.ok).toBe(false);
        expect(out.ranges.blocking).toEqual([{ kind: "landed-unreadable", repo: "acme/web", pr: 10, message: expect.stringContaining("gh: HTTP 502") }]);
        expect(out.ranges.landed[0].result).toBe("unknown");
    });

    it("blocks, naming the pull request, when the comparison itself fails", () => {
        const out = deriveCloseRanges(
            deps({ claims: one, receipts: { 10: { head: "head-10" } }, landed: { 10: { ok: false, error: { problem: "git-failed", message: "no such commit" } } } }),
            { stories: [1], records: [] },
        );
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.ranges.blocking.map((b) => b.kind)).toEqual(["landed-unreadable"]);
    });

    it("reads one receipt for a pull request that implements two stories, and states the result under both", () => {
        let reads = 0;
        const d = deps({ claims: { 1: [merged(1, 40, "2026-09-03T00:00:00Z")], 2: [merged(2, 40, "2026-09-03T00:00:00Z")] }, receipts: { 40: { head: "head-40" } } });
        const counted: CloseRangesDeps = { ...d, readReceipt: (pr) => (reads++, d.readReceipt(pr)) };
        const out = deriveCloseRanges(counted, { stories: [1, 2], records: [] });
        expect(reads).toBe(1);
        expect(out.ok && out.ranges.landed.map((s) => [s.story, s.result])).toEqual([
            [1, "unchanged"],
            [2, "unchanged"],
        ]);
    });
});

function claiming(story: number, pr: number, state: "open" | "closed", repo = "acme/web"): StoryClaimingPr {
    return { story, pr, repo, state, mergeCommit: null, mergedAt: "", edge: "closing" };
}

describe("deriveCloseRanges — each story's state (story #847; D5, D6, D7; G13, G14)", () => {
    const reviewed = (pr: number, ...stories: number[]) => ({ [pr]: { head: `head-${pr}`, stories } });

    it("calls a story current when a receipt on each merged pull request names it", () => {
        const out = deriveCloseRanges(deps({ claims: { 1: [merged(1, 10, "2026-09-02T00:00:00Z")] }, receipts: reviewed(10, 1) }), { stories: [1], records: [] });
        expect(out.ok && out.ranges.states).toEqual([{ story: 1, state: "current", findings: [] }]);
        expect(out.ok && out.ranges.closable).toBe(true);
    });

    it("stops on a story no receipt names, naming /nxs.analyze --pr on its pull request and offering no waiver", () => {
        const out = deriveCloseRanges(deps({ claims: { 1: [merged(1, 12, "2026-09-02T00:00:00Z")] } }), { stories: [1], records: [], issuesRepo: "acme/hub" });
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.ranges.states).toEqual([
            { story: 1, state: "never-reviewed", findings: [{ repo: "acme/web", pr: 12, finding: "no-receipt", remedy: "/nxs.analyze --pr 12" }] },
        ]);
        expect(out.ranges.closable).toBe(false);
        const line = out.ranges.lines.find((l) => l.includes("never reviewed")) ?? "";
        expect(line).toMatch(/^acme\/hub#1 — never reviewed/);
        expect(line).toContain("/nxs.analyze --pr 12");
        expect(line).toMatch(/no waiver/i);
    });

    it("counts a receipt only for the stories it names", () => {
        const out = deriveCloseRanges(deps({ claims: { 1: [merged(1, 12, "2026-09-02T00:00:00Z")] }, receipts: reviewed(12, 2) }), { stories: [1], records: [] });
        expect(out.ok && out.ranges.states[0].state).toBe("never-reviewed");
    });

    it("names only the merged pull request that carries no receipt naming the story", () => {
        const out = deriveCloseRanges(
            deps({ claims: { 1: [merged(1, 10, "2026-09-02T00:00:00Z"), merged(1, 11, "2026-09-03T00:00:00Z")] }, receipts: reviewed(10, 1) }),
            { stories: [1], records: [] },
        );
        expect(out.ok && out.ranges.states[0]).toEqual({
            story: 1,
            state: "never-reviewed",
            findings: [{ repo: "acme/web", pr: 11, finding: "no-receipt", remedy: "/nxs.analyze --pr 11" }],
        });
    });

    it("asks no receipt of a pull request with no attributable commits when another receipt names the story", () => {
        const out = deriveCloseRanges(
            deps({
                claims: { 1: [merged(1, 10, "2026-09-02T00:00:00Z"), merged(1, 11, "2026-09-03T00:00:00Z")] },
                receipts: reviewed(10, 1),
                derive: { 11: { ok: false, problem: "range-empty-diff", message: "empty" } },
            }),
            { stories: [1], records: [] },
        );
        expect(out.ok && out.ranges.states[0].state).toBe("current");
    });

    it("stops on a story with an open claiming pull request, naming it, even when another merged, with no analyze remedy", () => {
        const seen: Seen = { claims: [], checkouts: [], derived: [] };
        let receiptReads: number[] = [];
        const d = deps({ claims: { 1: [merged(1, 10, "2026-09-02T00:00:00Z"), claiming(1, 20, "open", "acme/other")] }, receipts: reviewed(10, 1) }, seen);
        const counted: CloseRangesDeps = { ...d, readReceipt: (pr) => ((receiptReads = [...receiptReads, pr.pr]), d.readReceipt(pr)) };
        const out = deriveCloseRanges(counted, { stories: [1], records: [] });
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.ranges.states[0]).toEqual({ story: 1, state: "unshipped", findings: [{ repo: "acme/other", pr: 20, finding: "open" }] });
        expect(out.ranges.closable).toBe(false);
        const line = out.ranges.lines.find((l) => l.includes("unshipped")) ?? "";
        expect(line).toContain("acme/other#20");
        expect(line).not.toContain("/nxs.analyze");
        // The open pull request is classified, never ranged, checked out or reviewed.
        expect(out.ranges.range.map((r) => r.pr)).toEqual([10]);
        expect(seen.derived).toEqual([10]);
        expect(seen.checkouts).toEqual(["acme/web"]);
        expect(receiptReads).toEqual([10]);
    });

    it("stops on a story whose only claiming pull request closed unmerged, naming it", () => {
        const seen: Seen = { claims: [], checkouts: [], derived: [] };
        const out = deriveCloseRanges(deps({ claims: { 1: [claiming(1, 21, "closed")] } }, seen), { stories: [1], records: [] });
        expect(out.ok).toBe(true);
        if (!out.ok) return;
        expect(out.ranges.states[0]).toEqual({ story: 1, state: "unshipped", findings: [{ repo: "acme/web", pr: 21, finding: "closed-unmerged" }] });
        const line = out.ranges.lines.find((l) => l.includes("unshipped")) ?? "";
        expect(line).toContain("acme/web#21");
        expect(line).not.toContain("/nxs.analyze");
        expect(out.ranges.range).toEqual([]);
        expect(seen.derived).toEqual([]);
    });

    it("stops on a story no pull request claims and no marker excludes", () => {
        const out = deriveCloseRanges(deps({}), { stories: [1], records: [] });
        expect(out.ok && out.ranges.states[0]).toEqual({ story: 1, state: "unshipped", findings: [] });
        expect(out.ok && out.ranges.closable).toBe(false);
    });

    it("lists an excluded story as excluded, never reads it, and lets the epic close (G25)", () => {
        const seen: Seen = { claims: [], checkouts: [], derived: [] };
        const out = deriveCloseRanges(deps({ claims: { 1: [merged(1, 10, "2026-09-02T00:00:00Z")] }, receipts: reviewed(10, 1) }, seen), {
            stories: [1, 2],
            excluded: [2],
            records: [],
        });
        expect(out.ok && out.ranges.states.map((s) => [s.story, s.state])).toEqual([
            [1, "current"],
            [2, "excluded"],
        ]);
        expect(out.ok && out.ranges.closable).toBe(true);
        expect(seen.claims).toEqual([1]);
    });

    it("calls a story unknown, before anything else, when a receipt could not be read", () => {
        const out = deriveCloseRanges(
            deps({ claims: { 1: [merged(1, 10, "2026-09-02T00:00:00Z"), claiming(1, 20, "open")] }, receipts: { 10: { fail: "gh: HTTP 502" } } }),
            { stories: [1], records: [] },
        );
        expect(out.ok && out.ranges.states[0].state).toBe("unknown");
        expect(out.ok && out.ranges.states[0].findings.map((f) => f.finding).sort()).toEqual(["open", "unreadable"]);
    });

    it("never treats a failed claiming read as a story with no pull request", () => {
        const out = deriveCloseRanges(deps({ claims: { 1: "HTTP 502" } }), { stories: [1], records: [] });
        expect(out.ok).toBe(false);
        expect(!out.ok && out.problem).toBe("story-read-failed");
    });

    it("keeps every range stop apart from the story states, and closes on neither", () => {
        const out = deriveCloseRanges(deps({ claims: { 1: [merged(1, 10, "2026-09-02T00:00:00Z")] }, receipts: reviewed(10, 1), offTrunk: ["merge-10"] }), {
            stories: [1],
            records: [],
        });
        expect(out.ok && out.ranges.ok).toBe(false);
        expect(out.ok && out.ranges.closable).toBe(false);
    });
});

describe("deriveCloseRanges — a story whose evidence is stale (story #842; D5, D6; G10, G11, G12)", () => {
    const one = { 1: [merged(1, 10, "2026-09-02T00:00:00Z")] };
    const stateOf = (out: ReturnType<typeof deriveCloseRanges>, story = 1) => (out.ok ? out.ranges.states.find((s) => s.story === story) : undefined);
    const lineOf = (out: ReturnType<typeof deriveCloseRanges>, story = 1) => (out.ok ? (out.ranges.lines.find((l) => l.startsWith(`#${story} — stale`)) ?? "") : "");

    it("stops on a story whose pull request landed a reviewed file differently, naming only a waiver on that pull request", () => {
        const out = deriveCloseRanges(
            deps({
                claims: one,
                receipts: { 10: { head: "head-10", stories: [1] } },
                landed: { 10: { ok: true, files: [{ path: "src/a.ts", status: "unchanged" }, { path: "src/b.ts", status: "changed" }] } },
            }),
            { stories: [1], records: [] },
        );
        expect(stateOf(out)).toEqual({
            story: 1,
            state: "stale",
            findings: [{ repo: "acme/web", pr: 10, finding: "landed-change", files: ["src/b.ts"], remedies: [expect.stringContaining("waiver")] }],
        });
        expect(out.ok && out.ranges.closable).toBe(false);
        const line = lineOf(out);
        expect(line).toContain("acme/web#10");
        expect(line).toContain("src/b.ts");
        expect(line).toMatch(/waiver/i);
        expect(line).not.toContain("/nxs.analyze");
    });

    it("stops on a story whose merged head is not the head its receipt analyzed, naming /nxs.analyze --pr on that pull request", () => {
        const out = deriveCloseRanges(deps({ claims: one, receipts: { 10: { head: "old-head", stories: [1] } } }), { stories: [1], records: [] });
        expect(stateOf(out)).toEqual({
            story: 1,
            state: "stale",
            findings: [{ repo: "acme/web", pr: 10, finding: "head-mismatch", analyzedHead: "old-head", mergedHead: "head-10", remedies: ["/nxs.analyze --pr 10"] }],
        });
        expect(out.ok && out.ranges.closable).toBe(false);
        const line = lineOf(out);
        expect(line).toContain("acme/web#10");
        expect(line).toContain("/nxs.analyze --pr 10");
        expect(line).not.toMatch(/waiver/i);
    });

    it("names every story a receipt covers as stale when the decision record was revised after it, with analyze or a waiver as the remedy", () => {
        const pr = (story: number) => merged(story, 40, "2026-09-03T00:00:00Z");
        const out = deriveCloseRanges(
            deps({ claims: { 1: [pr(1)], 2: [pr(2)] }, receipts: { 40: { head: "head-40", stories: [1, 2], recordHash: "old" } }, record: { digest: "new" } }),
            { stories: [1, 2], records: [] },
        );
        for (const story of [1, 2]) {
            expect(stateOf(out, story)).toEqual({
                story,
                state: "stale",
                findings: [
                    {
                        repo: "acme/web",
                        pr: 40,
                        finding: "record-revised",
                        record: 849,
                        stampedDigest: "old",
                        currentDigest: "new",
                        remedies: ["/nxs.analyze --pr 40", expect.stringContaining("waiver")],
                    },
                ],
            });
            const line = lineOf(out, story);
            expect(line).toContain("acme/web#40");
            expect(line).toContain("/nxs.analyze --pr 40");
            expect(line).toMatch(/waiver/i);
        }
        expect(out.ok && out.ranges.closable).toBe(false);
    });

    it("leaves a story current when its receipt's record digest is the record's current digest", () => {
        const out = deriveCloseRanges(deps({ claims: one, receipts: { 10: { head: "head-10", stories: [1], recordHash: "same" } }, record: { digest: "same" } }), {
            stories: [1],
            records: [],
        });
        expect(stateOf(out)?.state).toBe("current");
        expect(out.ok && out.ranges.closable).toBe(true);
    });

    it("does not make a story stale through a revised record behind a receipt that does not name it", () => {
        const out = deriveCloseRanges(
            deps({
                claims: { 1: [merged(1, 10, "2026-09-02T00:00:00Z")], 2: [merged(2, 11, "2026-09-03T00:00:00Z")] },
                receipts: { 10: { head: "head-10", stories: [1], recordHash: "new" }, 11: { head: "head-11", stories: [2], recordHash: "old" } },
                record: { digest: "new" },
            }),
            { stories: [1, 2], records: [] },
        );
        expect(stateOf(out, 1)?.state).toBe("current");
        expect(stateOf(out, 2)?.state).toBe("stale");
    });

    it("reads the current record once however many receipts stamp a digest, and not at all when none does", () => {
        let reads = 0;
        const counting = (world: World): CloseRangesDeps => {
            const d = deps(world);
            return { ...d, readRecord: () => (reads++, d.readRecord()) };
        };
        const two = { 1: [merged(1, 10, "2026-09-02T00:00:00Z"), merged(1, 11, "2026-09-03T00:00:00Z")] };
        deriveCloseRanges(
            counting({ claims: two, receipts: { 10: { head: "head-10", stories: [1], recordHash: "a" }, 11: { head: "head-11", stories: [1], recordHash: "a" } }, record: { digest: "a" } }),
            { stories: [1], records: [] },
        );
        expect(reads).toBe(1);
        reads = 0;
        deriveCloseRanges(counting({ claims: one, receipts: { 10: { head: "head-10", stories: [1] } } }), { stories: [1], records: [] });
        expect(reads).toBe(0);
    });

    it("names every cause of a story stale for more than one, across its pull requests", () => {
        const out = deriveCloseRanges(
            deps({
                claims: { 1: [merged(1, 10, "2026-09-02T00:00:00Z"), merged(1, 11, "2026-09-03T00:00:00Z")] },
                receipts: { 10: { head: "old-head", stories: [1], recordHash: "old" }, 11: { head: "head-11", stories: [1], recordHash: "new" } },
                record: { digest: "new" },
                landed: { 11: { ok: true, files: [{ path: "src/c.ts", status: "changed" }] } },
            }),
            { stories: [1], records: [] },
        );
        const s = stateOf(out);
        expect(s?.state).toBe("stale");
        expect(s?.findings.map((f) => [f.pr, f.finding])).toEqual([
            [10, "head-mismatch"],
            [10, "record-revised"],
            [11, "landed-change"],
        ]);
        const line = lineOf(out);
        for (const reason of [/analyzed head/, /record/, /src\/c\.ts/]) expect(line).toMatch(reason);
    });

    it("calls a story unknown, never stale or current, when the current record digest could not be read, and still names every other cause", () => {
        const out = deriveCloseRanges(
            deps({ claims: one, receipts: { 10: { head: "old-head", stories: [1], recordHash: "old" } }, record: { fail: "gh: HTTP 502" } }),
            { stories: [1], records: [] },
        );
        const s = stateOf(out);
        expect(s?.state).toBe("unknown");
        expect(s?.findings).toEqual([
            { repo: "acme/web", pr: 10, finding: "head-mismatch", analyzedHead: "old-head", mergedHead: "head-10", remedies: ["/nxs.analyze --pr 10"] },
            { repo: "acme/web", pr: 10, finding: "unreadable", evidence: "record", cause: expect.stringContaining("gh: HTTP 502") },
        ]);
        expect(out.ok && out.ranges.closable).toBe(false);
    });

    it("calls a story unknown when its receipt stamps a record digest but the epic has no decision record to compare it with", () => {
        const out = deriveCloseRanges(deps({ claims: one, receipts: { 10: { head: "head-10", stories: [1], recordHash: "old" } }, record: null }), {
            stories: [1],
            records: [],
        });
        expect(stateOf(out)?.state).toBe("unknown");
    });

    it("calls a story unknown, never current, when its pull request's landed check could not be read", () => {
        const out = deriveCloseRanges(
            deps({ claims: one, receipts: { 10: { head: "head-10", stories: [1] } }, landed: { 10: { ok: false, error: { problem: "git-failed", message: "no such commit" } } } }),
            { stories: [1], records: [] },
        );
        expect(stateOf(out)?.state).toBe("unknown");
        expect(stateOf(out)?.findings).toEqual([{ repo: "acme/web", pr: 10, finding: "unreadable", evidence: "landed-check", cause: expect.stringContaining("no such commit") }]);
    });

    it("decides never reviewed before stale, keeping the stale finding for the lead", () => {
        const out = deriveCloseRanges(
            deps({ claims: { 1: [merged(1, 10, "2026-09-02T00:00:00Z"), merged(1, 11, "2026-09-03T00:00:00Z")] }, receipts: { 10: { head: "old-head", stories: [1] } } }),
            { stories: [1], records: [] },
        );
        expect(stateOf(out)?.state).toBe("never-reviewed");
        expect(stateOf(out)?.findings.map((f) => f.finding)).toEqual(["head-mismatch", "no-receipt"]);
    });
});

describe("deriveCloseRanges — a waiver posted on the pull request (story #856; D11; G30–G35)", () => {
    const one = { 1: [merged(1, 10, "2026-09-02T00:00:00Z")] };
    const stateOf = (out: ReturnType<typeof deriveCloseRanges>, story = 1) => (out.ok ? out.ranges.states.find((s) => s.story === story) : undefined);
    const linesOf = (out: ReturnType<typeof deriveCloseRanges>) => (out.ok ? out.ranges.lines.join("\n") : "");
    const landedWaiver = (files: string[]) => `${WAIVER_MARKER}\n\`\`\`yaml\nwaive: landed-change\nfiles:\n${files.map((f) => `  - ${f}`).join("\n")}\n\`\`\``;
    const recordWaiver = (digest: string) => `${WAIVER_MARKER}\n\`\`\`yaml\nwaive: record-revised\nrecord: "#849"\ndigest: ${digest}\n\`\`\``;
    const changed = (...files: string[]): LandedChangeResult => ({ ok: true, files: files.map((path) => ({ path, status: "changed" as const })) });

    it("clears a landed-change stop with a trusted waiver naming every changed file, and states the waiver", () => {
        const out = deriveCloseRanges(
            deps({
                claims: one,
                receipts: { 10: { head: "head-10", stories: [1] } },
                landed: { 10: changed("src/a.ts", "src/b.ts") },
                waivers: { 10: [{ body: landedWaiver(["src/a.ts", "src/b.ts"]), author: "alice", url: "https://x/w1" }] },
            }),
            { stories: [1], records: [] },
        );
        expect(stateOf(out)).toEqual({ story: 1, state: "current", findings: [] });
        expect(out.ok && out.ranges.closable).toBe(true);
        expect(out.ok && out.ranges.waivers).toEqual([
            { repo: "acme/web", pr: 10, cause: "landed-change", files: ["src/a.ts", "src/b.ts"], author: "alice", url: "https://x/w1", at: expect.any(String), reason: null, stories: [1] },
        ]);
        // The landed check still states what landed; the waiver is stated beside it.
        expect(out.ok && out.ranges.landed[0].result).toBe("changed");
        expect(linesOf(out)).toMatch(/acme\/web#10.*waiver.*alice.*https:\/\/x\/w1/);
    });

    it("clears a revised-record stop with a trusted waiver accepting the record at its current digest", () => {
        const out = deriveCloseRanges(
            deps({
                claims: one,
                receipts: { 10: { head: "head-10", stories: [1], recordHash: "old" } },
                record: { digest: "new" },
                waivers: { 10: [{ body: recordWaiver("new"), author: "alice", url: "https://x/w2" }] },
            }),
            { stories: [1], records: [] },
        );
        expect(stateOf(out)?.state).toBe("current");
        expect(out.ok && out.ranges.closable).toBe(true);
        expect(out.ok && out.ranges.waivers).toEqual([
            { repo: "acme/web", pr: 10, cause: "record-revised", record: 849, digest: "new", author: "alice", url: "https://x/w2", at: expect.any(String), reason: null, stories: [1] },
        ]);
    });

    it("still stops on a waiver that leaves a changed file unnamed, naming the files it does not cover (G31)", () => {
        const out = deriveCloseRanges(
            deps({
                claims: one,
                receipts: { 10: { head: "head-10", stories: [1] } },
                landed: { 10: changed("src/a.ts", "src/b.ts") },
                waivers: { 10: [{ body: landedWaiver(["src/a.ts"]), url: "https://x/w3" }] },
            }),
            { stories: [1], records: [] },
        );
        expect(stateOf(out)?.state).toBe("stale");
        expect(stateOf(out)?.findings).toEqual([
            {
                repo: "acme/web",
                pr: 10,
                finding: "landed-change",
                files: ["src/a.ts", "src/b.ts"],
                remedies: [expect.stringContaining("waiver")],
                waivers: [{ author: "lead", url: "https://x/w3", why: "incomplete", uncovered: ["src/b.ts"] }],
            },
        ]);
        expect(out.ok && out.ranges.waivers).toEqual([]);
        expect(linesOf(out)).toMatch(/https:\/\/x\/w3[^\n]*does not name src\/b\.ts/);
    });

    it("names a waiver from an author who cannot speak for the repository, and still stops (G32)", () => {
        const out = deriveCloseRanges(
            deps({
                claims: one,
                receipts: { 10: { head: "head-10", stories: [1] } },
                landed: { 10: changed("src/a.ts") },
                waivers: { 10: [{ body: landedWaiver(["src/a.ts"]), author: "mallory", trusted: false, url: "https://x/w4" }] },
            }),
            { stories: [1], records: [] },
        );
        expect(stateOf(out)?.state).toBe("stale");
        expect(out.ok && out.ranges.closable).toBe(false);
        const line = linesOf(out).split("\n").find((l) => l.includes("https://x/w4")) ?? "";
        expect(line).toContain("mallory");
        expect(line).toContain("cannot speak for the repository");
    });

    it("names a waiver from an author who cannot speak for the repository even when a trusted waiver clears the stop (G32)", () => {
        const out = deriveCloseRanges(
            deps({
                claims: one,
                receipts: { 10: { head: "head-10", stories: [1] } },
                landed: { 10: changed("src/a.ts") },
                waivers: {
                    10: [
                        { body: landedWaiver(["src/a.ts"]), author: "mallory", trusted: false, url: "https://x/w6" },
                        { body: landedWaiver(["src/a.ts"]), author: "alice", url: "https://x/w7" },
                    ],
                },
            }),
            { stories: [1], records: [] },
        );
        expect(out.ok && out.ranges.closable).toBe(true);
        expect(out.ok && out.ranges.waivers[0]).toMatchObject({ author: "alice", rejected: [{ author: "mallory", url: "https://x/w6", why: "untrusted" }] });
        const line = linesOf(out).split("\n").find((l) => l.includes("https://x/w6")) ?? "";
        expect(line).toContain("mallory");
        expect(line).toContain("cannot speak for the repository");
    });

    it("clears a stop only on the pull request the waiver is posted on (G30)", () => {
        const out = deriveCloseRanges(
            deps({
                claims: { 1: [merged(1, 10, "2026-09-02T00:00:00Z"), merged(1, 11, "2026-09-03T00:00:00Z")] },
                receipts: { 10: { head: "head-10", stories: [1] }, 11: { head: "head-11", stories: [1] } },
                landed: { 10: changed("src/a.ts"), 11: changed("src/a.ts") },
                waivers: { 10: [{ body: landedWaiver(["src/a.ts"]) }] },
            }),
            { stories: [1], records: [] },
        );
        expect(stateOf(out)?.state).toBe("stale");
        expect(stateOf(out)?.findings.map((f) => [f.pr, f.finding])).toEqual([[11, "landed-change"]]);
        expect(out.ok && out.ranges.waivers.map((w) => w.pr)).toEqual([10]);
    });

    it("stops again on a later revision than the one a waiver accepted (G35)", () => {
        const out = deriveCloseRanges(
            deps({
                claims: one,
                receipts: { 10: { head: "head-10", stories: [1], recordHash: "first" } },
                record: { digest: "third" },
                waivers: { 10: [{ body: recordWaiver("second"), url: "https://x/w5" }] },
            }),
            { stories: [1], records: [] },
        );
        expect(stateOf(out)?.state).toBe("stale");
        expect(stateOf(out)?.findings[0]).toMatchObject({
            finding: "record-revised",
            currentDigest: "third",
            waivers: [{ url: "https://x/w5", why: "other-revision", digest: "second" }],
        });
        expect(linesOf(out)).toMatch(/https:\/\/x\/w5[^\n]*second/);
    });

    it("never waives a moved head: a record waiver clears its own cause only, and the story still stops", () => {
        const out = deriveCloseRanges(
            deps({
                claims: one,
                receipts: { 10: { head: "old-head", stories: [1], recordHash: "old" } },
                record: { digest: "new" },
                waivers: { 10: [{ body: recordWaiver("new") }] },
            }),
            { stories: [1], records: [] },
        );
        expect(stateOf(out)?.state).toBe("stale");
        expect(stateOf(out)?.findings.map((f) => f.finding)).toEqual(["head-mismatch"]);
        expect(out.ok && out.ranges.closable).toBe(false);
    });

    it("calls a story unknown, never current, when the waiver comments could not be read, and keeps the cause", () => {
        const out = deriveCloseRanges(
            deps({ claims: one, receipts: { 10: { head: "head-10", stories: [1] } }, landed: { 10: changed("src/a.ts") }, waivers: { 10: { fail: "gh: HTTP 502" } } }),
            { stories: [1], records: [] },
        );
        expect(stateOf(out)?.state).toBe("unknown");
        expect(stateOf(out)?.findings.map((f) => f.finding)).toEqual(["landed-change", "unreadable"]);
        expect(stateOf(out)?.findings[1]).toMatchObject({ evidence: "waiver", cause: expect.stringContaining("HTTP 502") });
        expect(out.ok && out.ranges.closable).toBe(false);
    });

    it("reads waivers once per pull request, and only for a cause a waiver can clear", () => {
        const seen: Seen = { claims: [], checkouts: [], derived: [], waiverReads: [] };
        const pr = (story: number) => merged(story, 40, "2026-09-03T00:00:00Z");
        deriveCloseRanges(
            deps(
                {
                    claims: { 1: [pr(1)], 2: [pr(2)], 3: [merged(3, 41, "2026-09-04T00:00:00Z")] },
                    receipts: { 40: { head: "head-40", stories: [1, 2], recordHash: "old" }, 41: { head: "old-head", stories: [3] } },
                    record: { digest: "new" },
                },
                seen,
            ),
            { stories: [1, 2, 3], records: [] },
        );
        expect(seen.waiverReads).toEqual([40]);
    });

    it("states one applied waiver for every story it cleared on that pull request", () => {
        const pr = (story: number) => merged(story, 40, "2026-09-03T00:00:00Z");
        const out = deriveCloseRanges(
            deps({
                claims: { 1: [pr(1)], 2: [pr(2)] },
                receipts: { 40: { head: "head-40", stories: [1, 2], recordHash: "old" } },
                record: { digest: "new" },
                waivers: { 40: [{ body: recordWaiver("new") }] },
            }),
            { stories: [1, 2], records: [] },
        );
        expect(out.ok && out.ranges.closable).toBe(true);
        expect(out.ok && out.ranges.waivers.map((w) => [w.pr, w.cause, w.stories])).toEqual([[40, "record-revised", [1, 2]]]);
    });
});

describe("closeRangesDeps — on the forge its caller picks (#906)", () => {
    it("reads the claims, the record and the verdicts on the issues host through a routed runner, never pasting the host into a path", () => {
        const calls: string[][] = [];
        const run: Runner = (cmd, args) => {
            calls.push([cmd, ...args]);
            return { status: 1, stdout: "", stderr: "stop" };
        };
        const deps = closeRangesDeps(onIssuesHost(run, "ghe.corp/acme/plan"), "/repo", "ghe.corp/acme/plan", 5);
        deps.readClaims(10);
        deps.readRecord();
        deps.readReceipt({ repo: "acme/code", pr: 7 } as StoryMergedPr);
        const gh = calls.filter((c) => c[0] === "gh");
        const onHost = (c: string[]): boolean => (c.includes("--hostname") ? c.includes("ghe.corp") : c.some((a) => a.startsWith("ghe.corp/") || a.includes("=ghe.corp/")));
        expect(gh.some((c) => c.join(" ").includes("7"))).toBe(true);
        expect(gh.every(onHost)).toBe(true);
        expect(gh.every((c) => !c.join(" ").includes("repos/ghe.corp"))).toBe(true);
    });

    it("leaves every read to gh's own host on a plain runner, as analyze's completion check passes", () => {
        const calls: string[][] = [];
        const run: Runner = (cmd, args) => {
            calls.push([cmd, ...args]);
            return { status: 1, stdout: "", stderr: "stop" };
        };
        const deps = closeRangesDeps(run, "/repo", "ghe.corp/acme/plan", 5);
        deps.readClaims(10);
        deps.readReceipt({ repo: "acme/code", pr: 7 } as StoryMergedPr);
        expect(calls.some((c) => c.includes("--hostname") || c.some((a) => a.startsWith("ghe.corp/")))).toBe(false);
    });
});
