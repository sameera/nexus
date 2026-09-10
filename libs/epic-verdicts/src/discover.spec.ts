import { describe, expect, it } from "vitest";
import { discoverCandidatePrs } from "./discover.js";
import { type Runner } from "./run.js";

function fakeGh(opts: { closedBy?: number[]; prList?: Array<{ number: number; headRefName: string }>; closedByFails?: boolean; prListFails?: boolean }): Runner {
    return (cmd, args) => {
        if (cmd === "gh" && args[0] === "api" && args[1] === "graphql") {
            if (opts.closedByFails) return { status: 1, stdout: "", stderr: "gh: rate limited" };
            const nodes = (opts.closedBy ?? []).join("\n");
            return { status: 0, stdout: nodes.length > 0 ? nodes + "\n" : "", stderr: "" };
        }
        if (cmd === "gh" && args[0] === "pr" && args[1] === "list") {
            if (opts.prListFails) return { status: 1, stdout: "", stderr: "gh: not found" };
            return { status: 0, stdout: JSON.stringify(opts.prList ?? []), stderr: "" };
        }
        return { status: 1, stdout: "", stderr: `unexpected command: ${cmd} ${args.join(" ")}` };
    };
}

const SLUG = { owner: "acme", repo: "widget" };

describe("discoverCandidatePrs — the story-to-pull-request ladder (decision record #505)", () => {
    it("gathers the story's closing pull requests from the timeline rung", () => {
        const run = fakeGh({ closedBy: [501] });
        const out = discoverCandidatePrs(run, "/repo", SLUG, 496);
        expect(out).toEqual([{ pr: 501, source: "closing-issue" }]);
    });

    it("gathers a pull request whose head branch carries the story number as a whole segment", () => {
        const run = fakeGh({
            prList: [
                { number: 601, headRefName: "story/496-derive-receipt" },
                { number: 602, headRefName: "story/4960-unrelated" },
                { number: 603, headRefName: "fix/496" },
            ],
        });
        const out = discoverCandidatePrs(run, "/repo", SLUG, 496);
        expect(out.map((c) => c.pr)).toEqual([601, 603]);
        expect(out.every((c) => c.source === "branch-name")).toBe(true);
    });

    it("appends the lead-supplied explicit list last, in priority order behind the other two rungs", () => {
        const run = fakeGh({ closedBy: [501], prList: [{ number: 601, headRefName: "496-work" }] });
        const out = discoverCandidatePrs(run, "/repo", SLUG, 496, [701]);
        expect(out).toEqual([
            { pr: 501, source: "closing-issue" },
            { pr: 601, source: "branch-name" },
            { pr: 701, source: "explicit" },
        ]);
    });

    it("de-duplicates a candidate seen on more than one rung, keeping its first (highest-priority) source", () => {
        const run = fakeGh({ closedBy: [501], prList: [{ number: 501, headRefName: "496-x" }] });
        const out = discoverCandidatePrs(run, "/repo", SLUG, 496, [501]);
        expect(out).toEqual([{ pr: 501, source: "closing-issue" }]);
    });

    it("tolerates a failing rung, falling back to whatever the other rungs found", () => {
        const run = fakeGh({ closedByFails: true, prList: [{ number: 601, headRefName: "496-x" }] });
        const out = discoverCandidatePrs(run, "/repo", SLUG, 496);
        expect(out).toEqual([{ pr: 601, source: "branch-name" }]);
    });

    it("returns no candidates when every rung is empty", () => {
        const run = fakeGh({});
        expect(discoverCandidatePrs(run, "/repo", SLUG, 496)).toEqual([]);
    });
});
