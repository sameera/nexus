import { describe, expect, it } from "vitest";
import { refuseUncleanCoverage } from "./plan-approval";
import { type PlanDraft } from "./plan-draft";

const CLEAN: PlanDraft = {
    slices: [
        { story: 10, builds: "learner", concepts: ["alpha"], assumes: [] },
        { story: 11, builds: "learner", concepts: ["beta"], assumes: ["alpha"] },
    ],
    coverage: { clean: true, gaps: [] },
};

describe("a plan whose coverage verdict is not clean cannot be approved (story #585)", () => {
    it("refuses a draft whose verdict names a gap, and names every gap", () => {
        const draft: PlanDraft = {
            slices: [
                { story: 10, builds: "learner", concepts: [], assumes: ["alpha"] },
                { story: 11, builds: "learner", concepts: [], assumes: ["gamma"] },
            ],
            coverage: { clean: false, gaps: [{ concept: "alpha", story: 10 }, { concept: "gamma", story: 11 }] },
        };

        const refusal = refuseUncleanCoverage(draft);

        expect(refusal.refused).toBe(true);
        const report: string = refusal.refused ? refusal.report : "";
        expect(report).toMatch(/#10 assumes alpha/);
        expect(report).toMatch(/#11 assumes gamma/);
    });

    it("refuses a draft that carries no coverage verdict in the same way", () => {
        const { coverage: _dropped, ...withoutVerdict } = CLEAN;

        expect(refuseUncleanCoverage(withoutVerdict).refused).toBe(true);
    });

    it("refuses a hand-set clean verdict that a fresh check contradicts, naming the hidden gap", () => {
        const handSet: PlanDraft = {
            slices: [
                { story: 10, builds: "learner", concepts: [], assumes: ["alpha"] },
                { story: 11, builds: "learner", concepts: ["alpha"], assumes: [] },
            ],
            coverage: { clean: true, gaps: [] },
        };

        const refusal = refuseUncleanCoverage(handSet);

        expect(refusal.refused && refusal.report).toMatch(/#10 assumes alpha/);
    });

    it("lets a clean draft through with nothing refused", () => {
        expect(refuseUncleanCoverage(CLEAN)).toEqual({ refused: false });
    });
});

import { rebuildDraft, renderGateDigest } from "./plan-approval";
import { renderPlanDraft } from "./plan-draft";

const TITLES = new Map<number, string>([[10, "Pin a story"], [11, "Split a story"], [20, "Hand a story off"]]);

const SHOWN: PlanDraft = {
    slices: [
        { story: 10, builds: "learner", concepts: ["alpha"], assumes: [] },
        { scaffold: "bridge", need: 11, builds: "learner", concepts: ["bridge"], assumes: [] },
        { story: 11, part: 1, builds: "learner", concepts: ["beta"], assumes: ["alpha", "bridge"] },
        { story: 11, part: 2, builds: "learner", concepts: ["gamma"], assumes: ["beta"] },
        { story: 20, builds: "handoff", concepts: [], assumes: [] },
    ],
    declared: [{ concept: "delta", phrase: "I have used queues at work" }],
    unmatched: ["kubernetes"],
    coverage: { clean: true, gaps: [] },
};

describe("the reviewer approves the sequence, splits, scaffolds and focus boundary at one gate (story #586)", () => {
    it("shows every slice in order with its mark, each split story with its parts, and each scaffold beside its need", () => {
        const digest: string = renderGateDigest(SHOWN, { titles: TITLES, focusMatchedNothing: false });

        expect(digest).toMatch(/1\. #10 — learner — "Pin a story"/);
        expect(digest).toMatch(/2\. scaffold bridge — learner — .*#11/);
        expect(digest).toMatch(/#11 — split — "Split a story"\n\s+3\.\s+part 1 — learner\n\s+4\.\s+part 2 — learner/);
        expect(digest).toMatch(/5\. #20 — handoff — "Hand a story off"/);
    });

    it("shows each removed concept beside its phrase, the unmatched phrases, and whether the focus matched no story", () => {
        const digest: string = renderGateDigest(SHOWN, { titles: TITLES, focusMatchedNothing: true });

        expect(digest).toMatch(/delta — "I have used queues at work"/);
        expect(digest).toMatch(/"kubernetes"/);
        expect(digest).toMatch(/focus matched no story/);
    });

    it("approves a roadmap of several epics at one gate, with slices of every epic on one digest", () => {
        const titles = new Map<number, string>([[10, "From the first epic"], [20, "From the second epic"]]);
        const digest: string = renderGateDigest(SHOWN, { titles, focusMatchedNothing: false });

        expect(digest).toMatch(/From the first epic[\s\S]*From the second epic/);
        expect(digest.match(/^The plan:/gm)).toHaveLength(1);
    });

    it("carries no lesson prose, no story body and no pinned state", () => {
        const digest: string = renderGateDigest(SHOWN, { titles: TITLES, focusMatchedNothing: false });

        expect(digest).not.toMatch(/pinned|body|theory|source/i);
    });

    it("reflects a changed mark in the rebuilt draft, keeps the declaration, and changing it back gives the same draft", () => {
        const stubs = (mark: "learner" | "handoff"): PlanDraft => ({
            slices: [
                { story: 10, builds: "learner", concepts: ["alpha", "delta"], assumes: [] },
                mark === "learner"
                    ? { story: 20, builds: "learner", concepts: ["epsilon"], assumes: ["alpha"] }
                    : { story: 20, builds: "handoff", concepts: [], assumes: [] },
            ],
        });
        const options = { edges: [{ story: 10, blockedBy: [] }, { story: 20, blockedBy: [10] }] };
        const before: PlanDraft = rebuildDraft(SHOWN, stubs("handoff"), options);
        const changed: PlanDraft = rebuildDraft(before, stubs("learner"), options);
        const back: PlanDraft = rebuildDraft(changed, stubs("handoff"), options);

        expect(changed.slices.find((stub) => stub.story === 20)?.builds).toBe("learner");
        expect(changed.slices.flatMap((stub) => stub.concepts)).not.toContain("delta");
        expect(changed.declared).toEqual(SHOWN.declared);
        expect(renderPlanDraft(back)).toBe(renderPlanDraft(before));
    });
});
