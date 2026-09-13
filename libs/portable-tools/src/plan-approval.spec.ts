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
