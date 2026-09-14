import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { approve, committedPlan, gate, io, planned, type Captured, type Planned } from "./plan-commit-fixtures.js";
import { runWorkbookCli } from "./workbook-cli.js";
import { type PlanSliceRecord } from "./workbook-plan.js";
import { sliceId } from "./workbook-plan.js";
import { writtenLessonFiles } from "./workbook-store.js";

/** The decision record #100's stories are implemented against, as `gh` returns it. */
const RECORD_BODY: string = [
    "# Decision Record: Pin the plan",
    "",
    "## Key Decisions",
    "",
    "### Approval pins against the live issue graph",
    "",
    "- **Decision:** Pin the live state.",
    "",
    "## Constraints & Invariants",
    "",
    "1. A slice pins its story's live state at approval.",
    "",
].join("\n");

/** A planned and approved workbook whose epic #100 has decision record #150, as epic-resolve materializes it. */
function approvedWithRecord(state: "open" | "closed"): Planned {
    const p: Planned = planned();
    expect(approve(p).code).toBe(0);
    const materialized: string = path.join(p.repo, ".nexus", "tmp", "epic-100", "epic.md");
    fs.mkdirSync(path.dirname(materialized), { recursive: true });
    fs.writeFileSync(materialized, `---\nepic: "Pin the plan"\nlink: "#100"\nrecord: "#150"\nrecord_state: ${state}\n---\n\n# Epic: Pin the plan\n`);
    p.fake.live[150] = { title: "Decision Record: Pin the plan", body: RECORD_BODY, closed: state === "closed" };
    fs.mkdirSync(path.join(p.repo, "src"), { recursive: true });
    fs.writeFileSync(path.join(p.repo, "src", "pin.ts"), "export const pin = true;\n");
    return p;
}

function writeSources(p: Planned, entries: readonly Record<string, unknown>[]): string {
    const file: string = path.join(p.repo, "sources.json");
    fs.writeFileSync(file, JSON.stringify({ sources: entries }));
    return file;
}

const BOTH_STORIES: Record<string, unknown>[] = [
    { story: 11, section: "Approval pins against the live issue graph", exemplar: "src/pin.ts" },
    { story: 12, section: "Constraints & Invariants", exemplar: "src/pin.ts" },
];

function pin(p: Planned, epic: number, sources?: string): { code: number; captured: Captured } {
    const captured: Captured = io(p.repo);
    const args: string[] = ["pin", "alpha", "--root", p.repo, "--epic", String(epic), ...(sources === undefined ? [] : ["--sources", sources])];
    return { code: runWorkbookCli(args, captured, p.run), captured };
}

function slice(p: Planned, id: string): PlanSliceRecord {
    return committedPlan(p).slices.find((s) => sliceId(s) === id) as PlanSliceRecord;
}

describe("a stub gains its pinned sources once its epic's decision record is approved", () => {
    it("pins every slice the learner builds in that epic, before any of its lessons is written", () => {
        const p: Planned = approvedWithRecord("closed");
        const { code, captured } = pin(p, 100, writeSources(p, BOTH_STORIES));
        expect(code, captured.err.join("\n")).toBe(0);
        expect(slice(p, "story-11").sources?.section).toBe("Approval pins against the live issue graph");
        expect(slice(p, "story-11").sources?.exemplar).toBe("src/pin.ts");
        expect(slice(p, "story-12-part-1").sources?.section).toBe("Constraints & Invariants");
        expect(slice(p, "story-12-part-2").sources?.section).toBe("Constraints & Invariants");
        expect(writtenLessonFiles(p.repo, "alpha")).toEqual([]);
    });

    it("refuses, writing nothing, when a slice the learner builds in that epic is given no sources", () => {
        const p: Planned = approvedWithRecord("closed");
        const before: string = fs.readFileSync(path.join(p.repo, ".nexus", "workbook", "alpha", "plan.yml"), "utf8");
        const { code, captured } = pin(p, 100, writeSources(p, [BOTH_STORIES[0]]));
        expect(code).toBe(1);
        expect(captured.err.join("\n")).toContain("#12");
        expect(fs.readFileSync(path.join(p.repo, ".nexus", "workbook", "alpha", "plan.yml"), "utf8")).toBe(before);
    });

    it("writes no sources for a handoff slice or a scaffold", () => {
        const p: Planned = approvedWithRecord("closed");
        fs.mkdirSync(path.join(p.repo, ".nexus", "tmp", "epic-200"), { recursive: true });
        fs.writeFileSync(path.join(p.repo, ".nexus", "tmp", "epic-200", "epic.md"), `---\nepic: "Hand off"\nlink: "#200"\nrecord: "#150"\nrecord_state: closed\n---\n`);
        expect(pin(p, 100, writeSources(p, BOTH_STORIES)).code).toBe(0);
        expect(slice(p, "scaffold-issue-graph").sources).toBeUndefined();

        const handoff = pin(p, 200, writeSources(p, [{ story: 21, section: "Constraints & Invariants", exemplar: "src/pin.ts" }]));
        expect(handoff.code).toBe(1);
        expect(handoff.captured.err.join("\n")).toContain("#21");
        expect(slice(p, "story-21").sources).toBeUndefined();
        expect(fs.readFileSync(path.join(p.repo, ".nexus", "workbook", "alpha", "plan.yml"), "utf8")).not.toMatch(/story: 21[\s\S]*sources:/);
    });

    it("pins nothing and raises no error while the epic's decision record is unapproved", () => {
        const p: Planned = approvedWithRecord("open");
        const before: string = fs.readFileSync(path.join(p.repo, ".nexus", "workbook", "alpha", "plan.yml"), "utf8");
        const { code, captured } = pin(p, 100, writeSources(p, BOTH_STORIES));
        expect(code).toBe(0);
        expect(captured.out.join("\n")).toMatch(/not approved/);
        expect(fs.readFileSync(path.join(p.repo, ".nexus", "workbook", "alpha", "plan.yml"), "utf8")).toBe(before);
    });

    it("pins nothing and raises no error when the epic has no decision record yet", () => {
        const p: Planned = approvedWithRecord("closed");
        fs.writeFileSync(path.join(p.repo, ".nexus", "tmp", "epic-100", "epic.md"), `---\nepic: "Pin the plan"\nlink: "#100"\n---\n`);
        const { code } = pin(p, 100);
        expect(code).toBe(0);
        expect(slice(p, "story-11").sources).toBeUndefined();
    });

    it("leaves sources already pinned unchanged when the step runs again", () => {
        const p: Planned = approvedWithRecord("closed");
        expect(pin(p, 100, writeSources(p, BOTH_STORIES)).code).toBe(0);
        const again = pin(p, 100, writeSources(p, [{ story: 11, section: "Constraints & Invariants", exemplar: "src/pin.ts" }]));
        expect(again.code, again.captured.err.join("\n")).toBe(0);
        expect(slice(p, "story-11").sources?.section).toBe("Approval pins against the live issue graph");
        expect(slice(p, "story-12-part-1").sources?.section).toBe("Constraints & Invariants");
    });

    it("keeps pinned sources through a re-approval of the plan", () => {
        const p: Planned = approvedWithRecord("closed");
        expect(pin(p, 100, writeSources(p, BOTH_STORIES)).code).toBe(0);
        expect(gate(p).code).toBe(0);
        const reapproved = gate(p, "--approve");
        expect(reapproved.code, reapproved.captured.err.join("\n")).toBe(0);
        expect(slice(p, "story-11").sources?.section).toBe("Approval pins against the live issue graph");
    });

    it("asks for the epic to be resolved first when it has not been", () => {
        const p: Planned = planned();
        expect(approve(p).code).toBe(0);
        const { code, captured } = pin(p, 100);
        expect(code).toBe(1);
        expect(captured.err.join("\n")).toContain("epic-resolve");
    });

    it("refuses a plan that carries sources on a handoff slice", () => {
        const p: Planned = approvedWithRecord("closed");
        const file: string = path.join(p.repo, ".nexus", "workbook", "alpha", "plan.yml");
        fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/builds: handoff/, "builds: handoff\n      sources:\n          section: Anything\n          exemplar: src/pin.ts"));
        const { code, captured } = pin(p, 100);
        expect(code).toBe(1);
        expect(captured.err.join("\n")).toMatch(/handoff/);
    });
});
