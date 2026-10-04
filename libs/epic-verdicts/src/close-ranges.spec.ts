/**
 * Close derives each story's commit ranges itself (epic #828, story #841, decision record #849,
 * D1–D3). Each case drives the derivation through the reads and git operations it depends on and
 * asserts what close is told.
 */

import { describe, expect, it } from "vitest";
import { type RepoCheckoutResult } from "@nexus/pr-worktree/repo-checkout";
import { deriveCloseRanges, type CloseRangesDeps, type DeriveOutcome } from "./close-ranges.js";
import { type ShippedRecord } from "./ledger.js";
import { type StoryMergedPr } from "./story-prs.js";

const SHA = (c: string) => c.repeat(40).slice(0, 40);

function merged(story: number, pr: number, mergedAt: string, repo = "acme/web"): StoryMergedPr {
    return { story, pr, repo, mergeCommit: `merge-${pr}`, mergedAt, edge: "closing" };
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
    claims?: Record<number, StoryMergedPr[] | string>;
    /** Repositories with no checkout, mapped to the path it was expected at (null: undeclared). */
    missing?: Record<string, string | null>;
    /** Commits absent from the checkout. */
    absent?: string[];
    /** Derivation outcome per pull request; defaults to a derived range. */
    derive?: Record<number, DeriveOutcome>;
}

interface Seen {
    claims: number[];
    checkouts: string[];
    derived: number[];
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
