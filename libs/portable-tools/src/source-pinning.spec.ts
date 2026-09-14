import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { approve, committedPlan, gate, io, planned, type Captured, type Planned } from "./plan-commit-fixtures.js";
import { runWorkbookCli } from "./workbook-cli.js";
import { type PlanSliceRecord } from "./workbook-plan.js";
import { sliceId } from "./workbook-plan.js";
import { writtenLessonFiles } from "./workbook-store.js";
import { type RunResult, type Runner } from "@nexus/workspace/run";

/** The decision record #100's stories are implemented against, as `gh` returns it. */
const RECORD_BODY: string = [
    "# Decision Record: Pin the plan",
    "",
    "## Key Decisions",
    "",
    "### Approval pins against the live issue graph",
    "",
    "- **Decision:** Pin the live state.",
    "- **Refuted alternative:** Pin from the resolved roadmap's snapshot. It lost because the pins would not match a graph that moved.",
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
    {
        story: 11,
        section: "Approval pins against the live issue graph",
        exemplar: "src/pin.ts",
        refuted: { alternative: "Pin from the resolved roadmap's snapshot", lost_on: "the pins would not match a graph that moved" },
    },
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

    it("pins nothing and raises no error when the epic's decision record was closed as not planned", () => {
        const p: Planned = approvedWithRecord("closed");
        p.fake.reasons = { 150: "not_planned" };
        const before: string = fs.readFileSync(path.join(p.repo, ".nexus", "workbook", "alpha", "plan.yml"), "utf8");
        const { code, captured } = pin(p, 100, writeSources(p, BOTH_STORIES));
        expect(code, captured.err.join("\n")).toBe(0);
        expect(fs.readFileSync(path.join(p.repo, ".nexus", "workbook", "alpha", "plan.yml"), "utf8")).toBe(before);
    });

    it("pins from a checkout whose epic sits in its committed queue entry, as a --pr close leaves it", () => {
        const p: Planned = approvedWithRecord("closed");
        const queued: string = path.join(p.repo, ".nexus", "queue", "epic-100");
        fs.mkdirSync(queued, { recursive: true });
        fs.renameSync(path.join(p.repo, ".nexus", "tmp", "epic-100", "epic.md"), path.join(queued, "epic.md"));
        const { code, captured } = pin(p, 100, writeSources(p, BOTH_STORIES));
        expect(code, captured.err.join("\n")).toBe(0);
        expect(slice(p, "story-11").sources?.section).toBe("Approval pins against the live issue graph");
    });

    it("reads the epic and its decision record from the hub when the workbook lives in a workspace member", () => {
        const p: Planned = approvedWithRecord("closed");
        const parent: string = fs.mkdtempSync(path.join(os.tmpdir(), "pin-workspace-"));
        const hub: string = path.join(parent, "docs-hub");
        const member: string = path.join(parent, "web-app");
        fs.mkdirSync(path.join(hub, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(path.join(hub, ".nexus", "config", "workspace.yml"), "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\nmembers:\n  - name: web-app\n    remote: git@github.com:acme/web-app.git\n");
        execFileSync("git", ["init", "-q", "-b", "main"], { cwd: hub });
        fs.cpSync(p.repo, member, { recursive: true });
        fs.mkdirSync(path.join(member, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(path.join(member, ".nexus", "config", "hub.yml"), "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\n");
        fs.mkdirSync(path.join(hub, ".nexus", "tmp"), { recursive: true });
        fs.renameSync(path.join(member, ".nexus", "tmp", "epic-100"), path.join(hub, ".nexus", "tmp", "epic-100"));
        const ghCwds: string[] = [];
        const run: Runner = (cmd, args, opts): RunResult => {
            if (cmd === "gh" && args[0] === "api") ghCwds.push(opts.cwd);
            return p.run(cmd, args, opts);
        };
        const captured: Captured = io(member);
        const code: number = runWorkbookCli(["pin", "alpha", "--root", member, "--epic", "100", "--sources", writeSources({ ...p, repo: member }, BOTH_STORIES)], captured, run);
        expect(code, captured.err.join("\n")).toBe(0);
        expect(ghCwds).toEqual([hub]);
        expect(slice({ ...p, repo: member }, "story-11").sources?.section).toBe("Approval pins against the live issue graph");
        fs.rmSync(parent, { recursive: true, force: true });
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

describe("pinned sources name the record section, the refuted alternative and the exemplar", () => {
    function pinOne(entry: Record<string, unknown>): { p: Planned; code: number; err: string } {
        const p: Planned = approvedWithRecord("closed");
        const { code, captured } = pin(p, 100, writeSources(p, [entry, BOTH_STORIES[1]]));
        return { p, code, err: captured.err.join("\n") };
    }

    it("names the record section that states the invariant, and refuses one the record does not have", () => {
        const { code, err } = pinOne({ ...BOTH_STORIES[0], section: "A section nobody wrote" });
        expect(code).toBe(1);
        expect(err).toContain("A section nobody wrote");
    });

    it("names the refuted alternative and what it lost on when the record states one", () => {
        const { p, code, err } = pinOne(BOTH_STORIES[0]);
        expect(code, err).toBe(0);
        expect(slice(p, "story-11").sources?.refuted).toEqual({
            alternative: "Pin from the resolved roadmap's snapshot",
            lostOn: "the pins would not match a graph that moved",
        });
    });

    it("refuses sources that leave out the refuted alternative the record states", () => {
        const { code, err } = pinOne({ story: 11, section: "Approval pins against the live issue graph", exemplar: "src/pin.ts" });
        expect(code).toBe(1);
        expect(err).toMatch(/refuted alternative/);
    });

    it("refuses a refuted alternative the record's section does not state, or one with nothing it lost on", () => {
        expect(pinOne({ ...BOTH_STORIES[0], refuted: { alternative: "Something else entirely", lost_on: "a reason" } }).code).toBe(1);
        expect(pinOne({ ...BOTH_STORIES[0], refuted: { alternative: "Pin from the resolved roadmap's snapshot", lost_on: " " } }).code).toBe(1);
    });

    it("omits the refuted alternative rather than leaving a placeholder when the record states none", () => {
        const p: Planned = approvedWithRecord("closed");
        expect(pin(p, 100, writeSources(p, BOTH_STORIES)).code).toBe(0);
        expect(slice(p, "story-12-part-1").sources?.refuted).toBeUndefined();
        expect(fs.readFileSync(path.join(p.repo, ".nexus", "workbook", "alpha", "plan.yml"), "utf8").match(/refuted:/g)).toHaveLength(1);

        const invented = pinOne({ ...BOTH_STORIES[0], story: 11, section: "Constraints & Invariants", refuted: { alternative: "Anything", lost_on: "anything" } });
        expect(invented.code).toBe(1);
        expect(invented.err).toMatch(/states no refuted alternative/);
    });

    it("names one exemplar file that exists in the codebase", () => {
        expect(pinOne({ ...BOTH_STORIES[0], exemplar: "src/missing.ts" }).err).toContain("src/missing.ts");
        expect(pinOne({ ...BOTH_STORIES[0], exemplar: "src" }).code).toBe(1);
        expect(pinOne({ ...BOTH_STORIES[0], exemplar: "../outside.ts" }).code).toBe(1);
    });
});
