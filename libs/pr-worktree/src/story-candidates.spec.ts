import { describe, expect, it } from "vitest";
import { resolveStories } from "./story-candidates.js";
import { type RunResult, type Runner } from "./run.js";

/** A minimal fake `gh api graphql` responder for fetchParentNumber / fetchSubIssueNumbers. */
function makeGraphRunner(opts: { parents: Record<number, number | null>; subIssues: Record<number, number[]> }): Runner {
    return (cmd: string, args: string[]): RunResult => {
        if (cmd !== "gh") return { status: 1, stdout: "", stderr: `unexpected command ${cmd}` };
        const queryArg = args.find((a) => a.startsWith("query=")) ?? "";
        const numMatch = args.find((a) => a.startsWith("num="));
        const num = numMatch ? Number(numMatch.slice(4)) : NaN;

        if (queryArg.includes("parent{number}")) {
            const parent = opts.parents[num];
            return { status: 0, stdout: parent === undefined || parent === null ? "" : `${parent}\n`, stderr: "" };
        }
        if (queryArg.includes("subIssues")) {
            const numbers = opts.subIssues[num] ?? [];
            return { status: 0, stdout: numbers.length ? numbers.join("\n") + "\n" : "", stderr: "" };
        }
        return { status: 1, stdout: "", stderr: "unrecognized graphql query" };
    };
}

const SLUG = { owner: "acme", repo: "widget" };

describe("resolveStories", () => {
    it("resolves a single explicit story candidate validated against its epic", () => {
        const run = makeGraphRunner({ parents: { 493: 211 }, subIssues: { 211: [492, 493, 494] } });
        const r = resolveStories(run, "/repo", SLUG, { explicitStory: 493, closingIssues: [] });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.epic).toBe(211);
        expect(r.stories).toEqual([493]);
    });

    it("falls through the ladder to the branch name when closing issues yield nothing", () => {
        const run = makeGraphRunner({ parents: { 493: 211 }, subIssues: { 211: [492, 493, 494] } });
        const r = resolveStories(run, "/repo", SLUG, {
            closingIssues: [],
            branchName: "story-493-check-the-story",
            prBody: "no references here",
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.stories).toEqual([493]);
    });

    it("reads repo-qualified issue references out of the PR body", () => {
        const run = makeGraphRunner({ parents: { 493: 211 }, subIssues: { 211: [492, 493, 494] } });
        const r = resolveStories(run, "/repo", SLUG, {
            closingIssues: [],
            prBody: "Implements acme/hub#493 per the epic.",
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.stories).toEqual([493]);
    });

    it("covers every surviving candidate when several validate against the same epic", () => {
        const run = makeGraphRunner({ parents: { 492: 211, 493: 211 }, subIssues: { 211: [492, 493, 494] } });
        const r = resolveStories(run, "/repo", SLUG, { closingIssues: [492, 493] });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.stories).toEqual([492, 493]);
        expect(r.epic).toBe(211);
    });

    it("drops a candidate that is not a sub-issue of anything", () => {
        const run = makeGraphRunner({ parents: { 493: 211, 999: null }, subIssues: { 211: [492, 493, 494] } });
        const r = resolveStories(run, "/repo", SLUG, { closingIssues: [999, 493] });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.stories).toEqual([493]);
    });

    it("stops and names the candidates when zero survive", () => {
        const run = makeGraphRunner({ parents: { 999: null }, subIssues: {} });
        const r = resolveStories(run, "/repo", SLUG, { closingIssues: [999] });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("no-story-candidates");
        expect(r.error.message).toContain("#999");
    });

    it("stops when surviving candidates resolve to more than one epic", () => {
        const run = makeGraphRunner({
            parents: { 493: 211, 501: 300 },
            subIssues: { 211: [492, 493, 494], 300: [500, 501] },
        });
        const r = resolveStories(run, "/repo", SLUG, { closingIssues: [493, 501] });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("story-candidates-multiple-epics");
    });

    it("rejects a candidate whose parent is not really its epic's declared sub-issue list", () => {
        // The candidate claims parent 211, but 211's own sub-issue graph doesn't list it back
        // (a defensive cross-check against a stale/incorrect parent link).
        const run = makeGraphRunner({ parents: { 493: 211 }, subIssues: { 211: [492, 494] } });
        const r = resolveStories(run, "/repo", SLUG, { explicitStory: 493, closingIssues: [] });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("no-story-candidates");
    });
});
