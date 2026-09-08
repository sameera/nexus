import { describe, expect, it } from "vitest";
import { resolveEpicVerdicts } from "./aggregate.js";
import { type Runner } from "./run.js";

const SLUG = { owner: "acme", repo: "widget" };

function block(story: number, pr: number, head: string): string {
    return [
        "<!-- nexus:analyze-receipt -->",
        "```yaml",
        `epic: "#212"`,
        `pr: ${pr}`,
        `date: 2026-09-01`,
        `head: ${head}`,
        `mode: full`,
        `findings: { critical: 0, high: 0, medium: 0, low: 0 }`,
        `stories: [${story}]`,
        "```",
    ].join("\n");
}

function ghRunner(prVerdicts: Record<number, { state: string; head: string; story: number }>): Runner {
    return (cmd, args) => {
        if (cmd === "gh" && args[0] === "pr" && args[1] === "view") {
            const n = Number(args[2]);
            const pr = prVerdicts[n];
            if (!pr) return { status: 1, stdout: "", stderr: "not found" };
            return {
                status: 0,
                stdout: JSON.stringify({
                    state: pr.state,
                    headRefOid: pr.head,
                    baseRefOid: "b".repeat(40),
                    reviews: [{ body: block(pr.story, n, pr.head), submittedAt: "2026-09-01T00:00:00Z" }],
                    comments: [],
                }),
                stderr: "",
            };
        }
        return { status: 1, stdout: "", stderr: `unexpected: ${cmd} ${args.join(" ")}` };
    };
}

describe("resolveEpicVerdicts — derive the epic receipt from the story verdicts, or stop and name a gap (decision record #505)", () => {
    it("derives an epic receipt when every story carries a verdict", () => {
        const run = ghRunner({
            501: { state: "OPEN", head: "a".repeat(40), story: 496 },
            502: { state: "OPEN", head: "c".repeat(40), story: 497 },
        });
        const r = resolveEpicVerdicts(run, "/repo", {
            slug: SLUG,
            epic: 212,
            stories: [496, 497],
            candidatesByStory: { 496: [501], 497: [502] },
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.state).toBe("aggregate");
        if (r.state !== "aggregate") return;
        expect(r.receipt.stories.map((s) => s.story)).toEqual([496, 497]);
    });

    it("stops as partial and names the story with no verdict, without deriving a receipt, when some stories do carry one", () => {
        const run = ghRunner({ 501: { state: "OPEN", head: "a".repeat(40), story: 496 } });
        const r = resolveEpicVerdicts(run, "/repo", {
            slug: SLUG,
            epic: 212,
            stories: [496, 497],
            candidatesByStory: { 496: [501], 497: [] },
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.state).toBe("partial");
        if (r.state !== "partial") return;
        expect(r.missing).toEqual([497]);
        expect(r.present).toEqual([496]);
    });

    it("falls back to 'none' — today's full-epic conformance — when not a single story carries a verdict", () => {
        const run = ghRunner({});
        const r = resolveEpicVerdicts(run, "/repo", {
            slug: SLUG,
            epic: 212,
            stories: [496, 497],
            candidatesByStory: { 496: [], 497: [] },
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.state).toBe("none");
    });

    it("excludes a story marked as shipping without its own pull request from the coverage requirement", () => {
        const run = ghRunner({ 501: { state: "OPEN", head: "a".repeat(40), story: 496 } });
        const r = resolveEpicVerdicts(run, "/repo", {
            slug: SLUG,
            epic: 212,
            stories: [496, 497],
            candidatesByStory: { 496: [501], 497: [] },
            excludedStories: [497],
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.state).toBe("aggregate");
        if (r.state !== "aggregate") return;
        expect(r.receipt.excluded).toEqual([497]);
        expect(r.receipt.stories.map((s) => s.story)).toEqual([496]);
    });

    it("falls back to 'none' when every non-excluded story carries no verdict", () => {
        const run = ghRunner({});
        const r = resolveEpicVerdicts(run, "/repo", {
            slug: SLUG,
            epic: 212,
            stories: [496, 497],
            candidatesByStory: { 496: [], 497: [] },
            excludedStories: [497],
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.state).toBe("none");
    });
});
