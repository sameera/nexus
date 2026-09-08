import { describe, expect, it } from "vitest";
import { checkPlanDrift, gateNextLesson, type IssueReader, type LiveStory, type TeachingPlan } from "./teaching-plan.js";

const PLAN: TeachingPlan = {
    slices: [
        { story: 460, learnerBuilds: true, pinned: { title: "A re-scoped or closed story stops before its lesson is taught", body: "Original body." } },
        { story: 461, learnerBuilds: true, pinned: { title: "Predict-then-reveal", body: "Original body." } },
    ],
};

function readerOf(live: Record<number, LiveStory | null>): IssueReader {
    return (story) => (story in live ? live[story] : null);
}

describe("checkPlanDrift", () => {
    it("reports no drift when every story still matches its pinned state", () => {
        const read = readerOf({
            460: { title: PLAN.slices[0].pinned.title, body: PLAN.slices[0].pinned.body, closed: false },
            461: { title: PLAN.slices[1].pinned.title, body: PLAN.slices[1].pinned.body, closed: false },
        });
        expect(checkPlanDrift(PLAN, read)).toEqual([]);
    });

    it("names a story that has been closed since the plan was pinned", () => {
        const read = readerOf({
            460: { title: PLAN.slices[0].pinned.title, body: PLAN.slices[0].pinned.body, closed: true },
            461: { title: PLAN.slices[1].pinned.title, body: PLAN.slices[1].pinned.body, closed: false },
        });
        const findings = checkPlanDrift(PLAN, read);
        expect(findings).toHaveLength(1);
        expect(findings[0].story).toBe(460);
        expect(findings[0].state).toBe("closed");
        expect(findings[0].detail).toContain("460");
    });

    it("names a story whose scope has been rewritten since the plan was pinned", () => {
        const read = readerOf({
            460: { title: PLAN.slices[0].pinned.title, body: "A rewritten body nobody pinned.", closed: false },
            461: { title: PLAN.slices[1].pinned.title, body: PLAN.slices[1].pinned.body, closed: false },
        });
        const findings = checkPlanDrift(PLAN, read);
        expect(findings).toHaveLength(1);
        expect(findings[0].story).toBe(460);
        expect(findings[0].state).toBe("changed");
    });

    it("names which of the title and the body changed, and what it changed from and to", () => {
        const read = readerOf({
            460: { title: PLAN.slices[0].pinned.title, body: "A rewritten body nobody pinned.", closed: false },
            461: { title: PLAN.slices[1].pinned.title, body: PLAN.slices[1].pinned.body, closed: false },
        });
        const detail = checkPlanDrift(PLAN, read)[0].detail;

        expect(detail).toContain("body");
        expect(detail).not.toContain("title");
        expect(detail).toContain("Original body.");
        expect(detail).toContain("A rewritten body nobody pinned.");
    });

    it("names both when both changed, and says what each changed from and to", () => {
        const read = readerOf({
            460: { title: "A different title", body: "A rewritten body nobody pinned.", closed: false },
            461: { title: PLAN.slices[1].pinned.title, body: PLAN.slices[1].pinned.body, closed: false },
        });
        const detail = checkPlanDrift(PLAN, read)[0].detail;

        expect(detail).toContain("title");
        expect(detail).toContain("body");
        expect(detail).toContain("A different title");
        expect(detail).toContain(PLAN.slices[0].pinned.title);
    });

    it("cuts a long value short rather than reprinting a whole rewritten issue at the learner", () => {
        const rewritten: string = `A rewritten body ${"nobody pinned ".repeat(40)}`;
        const read = readerOf({
            460: { title: PLAN.slices[0].pinned.title, body: rewritten, closed: false },
            461: { title: PLAN.slices[1].pinned.title, body: PLAN.slices[1].pinned.body, closed: false },
        });
        const detail = checkPlanDrift(PLAN, read)[0].detail;

        expect(detail).toContain("A rewritten body");
        expect(detail).toContain("…");
        expect(detail.length).toBeLessThan(rewritten.length);
    });

    it("treats whitespace-only differences as no drift", () => {
        const read = readerOf({
            460: { title: `  ${PLAN.slices[0].pinned.title}  `, body: PLAN.slices[0].pinned.body.replace(" ", "\n\n"), closed: false },
            461: { title: PLAN.slices[1].pinned.title, body: PLAN.slices[1].pinned.body, closed: false },
        });
        expect(checkPlanDrift(PLAN, read)).toEqual([]);
    });

    it("reports unverifiable rather than treating an unreadable story as unchanged", () => {
        const read = readerOf({ 461: { title: PLAN.slices[1].pinned.title, body: PLAN.slices[1].pinned.body, closed: false } });
        const findings = checkPlanDrift(PLAN, read);
        expect(findings).toEqual([{ story: 460, state: "unverifiable", detail: expect.stringContaining("460") }]);
    });
});

describe("gateNextLesson", () => {
    it("teaches on when the next slice matches its pinned state", () => {
        const read = readerOf({
            460: { title: PLAN.slices[0].pinned.title, body: PLAN.slices[0].pinned.body, closed: false },
            461: { title: PLAN.slices[1].pinned.title, body: PLAN.slices[1].pinned.body, closed: false },
        });
        const gate = gateNextLesson(PLAN, 460, read);
        expect(gate.blocked).toBe(false);
        expect(gate.finding).toBeNull();
    });

    it("blocks the next lesson when the story about to be taught has drifted", () => {
        const read = readerOf({
            460: { title: PLAN.slices[0].pinned.title, body: PLAN.slices[0].pinned.body, closed: true },
            461: { title: PLAN.slices[1].pinned.title, body: PLAN.slices[1].pinned.body, closed: false },
        });
        const gate = gateNextLesson(PLAN, 460, read);
        expect(gate.blocked).toBe(true);
        expect(gate.finding?.state).toBe("closed");
    });

    it("reports drift on a later slice without blocking the current one", () => {
        const read = readerOf({
            460: { title: PLAN.slices[0].pinned.title, body: PLAN.slices[0].pinned.body, closed: false },
            461: { title: PLAN.slices[1].pinned.title, body: "rewritten", closed: false },
        });
        const gate = gateNextLesson(PLAN, 460, read);
        expect(gate.blocked).toBe(false);
        expect(gate.finding).toBeNull();
        expect(gate.findings).toHaveLength(1);
        expect(gate.findings[0].story).toBe(461);
    });
});

describe("a story that was already closed when the plan was pinned", () => {
    const SHIPPED: TeachingPlan = {
        slices: [
            { story: 460, learnerBuilds: true, pinned: { title: "Already shipped", body: "Original body.", closed: true } },
            { story: 461, learnerBuilds: true, pinned: { title: "Still open", body: "Original body." } },
        ],
    };

    it("is teachable, because closure before the pin is not movement", () => {
        const findings = checkPlanDrift(SHIPPED, (story) => ({
            title: SHIPPED.slices.find((s) => s.story === story)?.pinned.title ?? "",
            body: "Original body.",
            closed: story === 460,
        }));
        expect(findings).toEqual([]);
    });

    it("still blocks a story that closed after the plan pinned it open", () => {
        const findings = checkPlanDrift(SHIPPED, (story) => ({
            title: SHIPPED.slices.find((s) => s.story === story)?.pinned.title ?? "",
            body: "Original body.",
            closed: true,
        }));
        expect(findings.map((f) => f.story)).toEqual([461]);
        expect(findings[0].state).toBe("closed");
    });
});
