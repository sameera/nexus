/**
 * Analyze judges the whole epic on the pull request that completes it (epic #829, story #859,
 * decision record #871, D9–D11). Each case drives the completion check through the reads and git
 * operations it depends on and asserts what analyze is told.
 */

import { describe, expect, it } from "vitest";
import { type RepoCheckoutResult } from "@nexus/pr-worktree/repo-checkout";
import { type DeriveOutcome } from "./close-ranges.js";
import { epicCompletion, epicPrTarget, type EpicCompletionDeps, type EpicCompletionInput } from "./epic-completion.js";
import { type StoryClaimingPr, type StoryClaimsRead } from "./story-prs.js";

function merged(story: number, pr: number, mergedAt: string, repo = "acme/web"): StoryClaimingPr {
    return { story, pr, repo, state: "merged", mergeCommit: `merge-${pr}`, mergedAt, edge: "closing" };
}

function open(story: number, pr: number, repo = "acme/web"): StoryClaimingPr {
    return { story, pr, repo, state: "open", mergeCommit: null, mergedAt: "", edge: "closing" };
}

interface World {
    claims?: Record<number, StoryClaimingPr[] | string>;
    /** Merge commits the analyzed head does not contain. */
    notInHead?: string[];
    /** Repositories with no checkout, mapped to the path it was expected at. */
    missing?: Record<string, string>;
    /** Commits a member checkout does not hold. */
    absent?: string[];
    /** Merge commits a member checkout holds but its trunk does not reach. */
    offTrunk?: string[];
    /** Derivation outcome per pull request; defaults to a derived range. */
    derive?: Record<number, DeriveOutcome>;
    /** Changed files per range head; defaults to one file named for the pull request. */
    files?: Record<string, string[]>;
}

interface Seen {
    claims: number[];
    derivedIn: Array<{ pr: number; checkout: string }>;
}

function deps(world: World, seen: Seen = { claims: [], derivedIn: [] }): EpicCompletionDeps {
    return {
        readClaims(story): StoryClaimsRead {
            seen.claims.push(story);
            const c = world.claims?.[story] ?? [];
            if (typeof c === "string") return { ok: false, failure: { story, cause: c } };
            return { ok: true, result: { story, prs: c } };
        },
        checkoutFor(repo): RepoCheckoutResult {
            const expected = world.missing?.[repo];
            if (expected !== undefined) return { ok: false, expectedPath: expected, error: { problem: "member-checkout-missing", message: `expected it at ${expected}` } };
            return { ok: true, checkout: `/co/${repo}` };
        },
        inHead: (sha) => ({ ok: true, contained: !(world.notInHead ?? []).includes(sha) }),
        hasCommit: (_checkout, sha) => !(world.absent ?? []).includes(sha),
        onTrunk: (_checkout, sha) => ({ ok: true, onTrunk: !(world.offTrunk ?? []).includes(sha), trunkRef: "origin/main" }),
        fetchCommand: (checkout) => `git -C ${checkout} fetch origin`,
        derive(checkout, pr) {
            seen.derivedIn.push({ pr: pr.pr, checkout });
            return world.derive?.[pr.pr] ?? { ok: true, base: `base-${pr.pr}`, head: `head-${pr.pr}` };
        },
        changedFiles: (_checkout, _base, head) => world.files?.[head] ?? [`src/${head}.ts`],
    };
}

const PR = { repo: "acme/web", pr: 50 };

function input(over: Partial<EpicCompletionInput> = {}): EpicCompletionInput {
    return { stories: [1, 2, 3], excluded: [], pr: PR, covered: [3], worktree: "/wt", issuesRepo: "acme/web", ...over };
}

function completionOf(world: World, over: Partial<EpicCompletionInput> = {}) {
    const out = epicCompletion(deps(world), input(over));
    if (!out.ok) throw new Error(`expected a completion answer, got ${out.problem}`);
    return out.completion;
}

describe("epicCompletion — whether the pull request completes its epic (D9, G30, G31)", () => {
    it("completes the epic when the pull request covers every live story, and judges it", () => {
        const c = completionOf({}, { covered: [1, 2, 3] });
        expect(c.completes).toBe(true);
        expect(c.basis).toBe("covers-every-story");
        expect(c.epicLevel).toBe("judge");
    });

    it("completes the epic when every other live story has merged and none has an open claiming pull request", () => {
        const c = completionOf({ claims: { 1: [merged(1, 10, "2026-10-01T00:00:00Z")], 2: [merged(2, 11, "2026-10-02T00:00:00Z")] } });
        expect(c.completes).toBe(true);
        expect(c.basis).toBe("last");
        expect(c.epicLevel).toBe("judge");
        expect(c.siblings.map((s) => s.pr)).toEqual([10, 11]);
    });

    it("judges no success metric when another live story has no merged pull request, and names it", () => {
        const c = completionOf({ claims: { 1: [merged(1, 10, "2026-10-01T00:00:00Z")] } });
        expect(c.completes).toBe(false);
        expect(c.epicLevel).toBe("skip");
        expect(c.unshipped).toEqual([{ story: 2, open: [] }]);
        expect(c.lines.join("\n")).toContain("acme/web#2");
    });

    it("judges no success metric when another live story still has an open claiming pull request, even beside a merged one", () => {
        const c = completionOf({ claims: { 1: [merged(1, 10, "2026-10-01T00:00:00Z")], 2: [merged(2, 11, "2026-10-01T00:00:00Z"), open(2, 12)] } });
        expect(c.completes).toBe(false);
        expect(c.unshipped).toEqual([{ story: 2, open: [{ repo: "acme/web", pr: 12 }] }]);
    });

    it("leaves a story carrying the storyless marker out of both tests", () => {
        const c = completionOf({ claims: { 1: [merged(1, 10, "2026-10-01T00:00:00Z")] } }, { excluded: [2] });
        expect(c.completes).toBe(true);
        expect(c.basis).toBe("last");
    });

    it("never counts the analyzed pull request as its own sibling", () => {
        const c = completionOf({ claims: { 1: [merged(1, 10, "2026-10-01T00:00:00Z")], 2: [merged(2, 11, "2026-10-01T00:00:00Z")], 3: [merged(3, 50, "2026-10-03T00:00:00Z")] } });
        expect(c.completes).toBe(true);
        expect(c.siblings.map((s) => s.pr)).toEqual([10, 11]);
    });

    it("keeps a merged pull request of a covered story as a sibling the head must contain", () => {
        const c = completionOf({ claims: { 3: [merged(3, 9, "2026-09-30T00:00:00Z")] } }, { covered: [1, 2, 3] });
        expect(c.siblings.map((s) => ({ pr: s.pr, stories: s.stories }))).toEqual([{ pr: 9, stories: [3] }]);
    });
});

describe("epicCompletion — a failed claiming read stops the run (D9, G34)", () => {
    it("fails, naming every story whose read failed, rather than reading as not last", () => {
        const seen: Seen = { claims: [], derivedIn: [] };
        const out = epicCompletion(deps({ claims: { 1: "rate limited", 2: "unknown issue" } }, seen), input());
        expect(out.ok).toBe(false);
        if (out.ok) return;
        expect(out.problem).toBe("story-read-failed");
        expect(out.failures.map((f) => f.story)).toEqual([1, 2]);
        expect(seen.derivedIn).toEqual([]);
    });

    it("reads every live story, even one the pull request covers", () => {
        const seen: Seen = { claims: [], derivedIn: [] };
        epicCompletion(deps({}, seen), input({ covered: [1, 2, 3] }));
        expect(seen.claims).toEqual([1, 2, 3]);
    });
});

describe("epicCompletion — the head must already contain every merged sibling (D10, G33)", () => {
    const claims = { 1: [merged(1, 10, "2026-10-01T00:00:00Z")], 2: [merged(2, 11, "2026-10-02T00:00:00Z")] };

    it("reports the epic-level check as not run when a same-repository sibling's merge is not in the head, naming the branch update", () => {
        const c = completionOf({ claims, notInHead: ["merge-11"] });
        expect(c.completes).toBe(true);
        expect(c.epicLevel).toBe("not-run");
        expect(c.notRun).toHaveLength(1);
        expect(c.notRun[0]).toMatchObject({ repo: "acme/web", pr: 11 });
        expect(c.notRun[0].remedy).toMatch(/up to date with trunk/);
        expect(c.lines.join("\n")).toMatch(/epic-level check not run/i);
    });

    it("accepts a sibling in another member whose merge commit is on that member checkout's trunk", () => {
        const c = completionOf({ claims: { ...claims, 2: [merged(2, 7, "2026-10-02T00:00:00Z", "acme/api")] } });
        expect(c.epicLevel).toBe("judge");
        expect(c.siblings.find((s) => s.pr === 7)).toMatchObject({ repo: "acme/api", contained: true });
    });

    it("reports not run, naming the fetch, when the member checkout does not hold the sibling's merge commit", () => {
        const c = completionOf({ claims: { ...claims, 2: [merged(2, 7, "2026-10-02T00:00:00Z", "acme/api")] }, absent: ["merge-7"] });
        expect(c.epicLevel).toBe("not-run");
        expect(c.notRun[0].remedy).toContain("git -C /co/acme/api fetch origin");
    });

    it("reports not run when the member checkout's trunk does not reach the sibling's merge commit", () => {
        const c = completionOf({ claims: { ...claims, 2: [merged(2, 7, "2026-10-02T00:00:00Z", "acme/api")] }, offTrunk: ["merge-7"] });
        expect(c.epicLevel).toBe("not-run");
        expect(c.notRun[0].remedy).toContain("origin/main");
    });

    it("reports not run, naming the expected path, when another member has no checkout", () => {
        const c = completionOf({ claims: { ...claims, 2: [merged(2, 7, "2026-10-02T00:00:00Z", "acme/api")] }, missing: { "acme/api": "/src/api" } });
        expect(c.epicLevel).toBe("not-run");
        expect(c.notRun[0].remedy).toContain("/src/api");
    });

    it("does not check containment for a pull request that does not complete the epic", () => {
        const c = completionOf({ claims: { 1: claims[1] }, notInHead: ["merge-10"] });
        expect(c.epicLevel).toBe("skip");
        expect(c.notRun).toEqual([]);
    });
});

describe("epicCompletion — the reading scope is this change plus each sibling's landed files (D10, Mechanism step 4)", () => {
    it("lists each contained sibling's landed files from its range, derived where it merged", () => {
        const seen: Seen = { claims: [], derivedIn: [] };
        const out = epicCompletion(
            deps({ claims: { 1: [merged(1, 10, "2026-10-01T00:00:00Z")], 2: [merged(2, 7, "2026-10-02T00:00:00Z", "acme/api")] }, files: { "head-10": ["src/a.ts", "src/b.ts"] } }, seen),
            input(),
        );
        if (!out.ok) throw new Error("expected ok");
        expect(out.completion.siblings.find((s) => s.pr === 10)?.files).toEqual(["src/a.ts", "src/b.ts"]);
        expect(seen.derivedIn).toEqual([
            { pr: 10, checkout: "/wt" },
            { pr: 7, checkout: "/co/acme/api" },
        ]);
    });

    it("names a sibling whose range cannot be derived, without stopping the judgment", () => {
        const c = completionOf({
            claims: { 1: [merged(1, 10, "2026-10-01T00:00:00Z")], 2: [merged(2, 11, "2026-10-02T00:00:00Z")] },
            derive: { 11: { ok: false, problem: "range-empty-diff", message: "nothing attributable" } },
        });
        expect(c.epicLevel).toBe("judge");
        expect(c.siblings.find((s) => s.pr === 11)).toMatchObject({ files: null, filesCause: "nothing attributable" });
    });
});

describe("epicPrTarget — analyze addressed by epic number combines nothing once a story has merged (D11, G35)", () => {
    function targetOf(claims: Record<number, StoryClaimingPr[] | string>, excluded: number[] = []) {
        const out = epicPrTarget(deps({ claims }), { stories: [1, 2, 3], excluded, issuesRepo: "acme/web" });
        if (!out.ok) throw new Error("expected ok");
        return out.target;
    }

    it("runs the ordinary local check when no live story has a merged claiming pull request", () => {
        expect(targetOf({ 1: [open(1, 20)] }).state).toBe("local");
    });

    it("names the open pull request that completes the epic", () => {
        const t = targetOf({ 1: [merged(1, 10, "2026-10-01T00:00:00Z")], 2: [open(2, 20)], 3: [open(3, 20)] });
        expect(t).toMatchObject({ state: "redirect", target: { repo: "acme/web", pr: 20, why: "open-completing" } });
        expect(t.lines.join("\n")).toContain("/nxs.analyze --pr acme/web#20");
    });

    it("names the most recently merged pull request when every live story has merged", () => {
        const t = targetOf({ 1: [merged(1, 10, "2026-10-03T00:00:00Z")], 2: [merged(2, 11, "2026-10-01T00:00:00Z")], 3: [merged(3, 12, "2026-10-02T00:00:00Z")] });
        expect(t).toMatchObject({ state: "redirect", target: { pr: 10, why: "most-recent-merged" } });
    });

    it("names no target, and lists the open pull requests, when none completes the epic yet", () => {
        const t = targetOf({ 1: [merged(1, 10, "2026-10-01T00:00:00Z")], 2: [open(2, 20)] });
        expect(t).toMatchObject({ state: "redirect", target: null });
        expect(t.state === "redirect" && t.open).toEqual([{ repo: "acme/web", pr: 20, stories: [2] }]);
    });

    it("stops on a failed claiming read", () => {
        const out = epicPrTarget(deps({ claims: { 2: "rate limited" } }), { stories: [1, 2, 3], excluded: [] });
        expect(out).toMatchObject({ ok: false, failures: [{ story: 2, cause: "rate limited" }] });
    });
});
