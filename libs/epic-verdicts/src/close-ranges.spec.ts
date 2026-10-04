/**
 * Close derives each story's commit ranges itself (epic #828, story #841, decision record #849,
 * D1–D3). Each case drives the derivation through the reads and git operations it depends on and
 * asserts what close is told.
 */

import { describe, expect, it } from "vitest";
import { type LandedChangeResult } from "@nexus/pr-worktree/landed-change";
import { type RepoCheckoutResult } from "@nexus/pr-worktree/repo-checkout";
import { type AnalyzeReceipt } from "@nexus/pr-acceptance/verify";
import { deriveCloseRanges, type CloseRangesDeps, type DeriveOutcome } from "./close-ranges.js";
import { type ShippedRecord } from "./ledger.js";
import { type StoryClaimingPr } from "./story-prs.js";

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
    receipts?: Record<number, { head: string; stories?: number[] } | { fail: string }>;
    /** Each pull request's head; defaults to `head-<pr>`. */
    prHeads?: Record<number, string>;
    /** The landed check's answer per pull request; defaults to every file unchanged. */
    landed?: Record<number, LandedChangeResult>;
}

interface Seen {
    claims: number[];
    checkouts: string[];
    derived: number[];
    compared?: Array<{ pr: number; analyzedHead: string; base: string; head: string }>;
}

function receipt(head: string, stories: number[] = []): AnalyzeReceipt {
    return { epic: "#828", nexusVersion: null, pr: null, date: "2026-09-01", head, mode: "full", findings: {}, repo: null, stories, record: null, recordHash: null, issuesRepo: null, storyFingerprints: {} };
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
            return { ok: true, receipt: receipt(r.head, r.stories), prHead };
        },
        compareLanded(_checkout, pr, input) {
            seen.compared?.push({ pr: pr.pr, ...input });
            return world.landed?.[pr.pr] ?? { ok: true, files: [{ path: "src/a.ts", status: "unchanged" }] };
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

    it("reports a changed file without blocking close on it", () => {
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
