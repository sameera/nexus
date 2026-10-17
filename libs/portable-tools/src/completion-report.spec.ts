/**
 * Epic #889, story #892 — every completion report leads with what the lead is waited on for.
 *
 * The decision record (#905, D1 and D4) puts the report layout in the shared run-discipline skill:
 * Blocked on me, then Changed, then Found, with Blocked on me present even when nothing waits, in
 * one line that names the next stage. These assertions hold the checkable halves: the skill states
 * the layout; every completion report template a stage command writes carries the three headings
 * in order; stage-specific content keeps its place (the epic's implementation sequence under
 * Changed, distill's counts and analyze's per-story results under Found); analyze's terminal report
 * and published review are one layout whose fixed result line is still last and spelled as before;
 * and fix and intake turn their closing self-check into a line under Changed.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot, listComponentFiles } from "./vendor-components.js";

const ROOT: string = authoredComponentRoot(__dirname);

function read(rel: string): string {
    return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

/** Prose wraps at any space, so every phrase check reads the text with its whitespace collapsed. */
function flat(text: string): string {
    return text.replace(/\s+/g, " ");
}

/** The text from `start` up to `end` (or the end of the file), failing loudly when a marker moved. */
function between(text: string, start: string, end?: string): string {
    const from: number = text.indexOf(start);
    expect(from, `marker "${start}"`).toBeGreaterThan(-1);
    const to: number = end === undefined ? text.length : text.indexOf(end, from + start.length);
    expect(to, `marker "${end}"`).toBeGreaterThan(-1);
    return text.slice(from, to);
}

const HEADINGS = ["Blocked on me", "Changed", "Found"] as const;
type Heading = (typeof HEADINGS)[number];

/** A heading line: a markdown heading, a bullet or a bare line that opens with the heading's name. */
function headingAt(report: string, name: Heading): number {
    const match: RegExpExecArray | null = new RegExp(`^[ \\t]*(?:#{1,6} +|[-*] +)?\\**${name}\\b`, "m").exec(report);
    return match === null ? -1 : match.index;
}

/** The part of a report under one heading: from that heading to the next one, or to the end. */
function under(report: string, name: Heading): string {
    const at: number = headingAt(report, name);
    expect(at, `heading ${name}`).toBeGreaterThan(-1);
    const next: number = HEADINGS.indexOf(name) + 1;
    const end: number = next < HEADINGS.length ? headingAt(report, HEADINGS[next]!) : report.length;
    return report.slice(at, end > at ? end : report.length);
}

const SKILL: string = flat(read("skills/nxs-run-discipline/SKILL.md"));

const ANALYZE: string = read("commands/nxs.analyze.md");
const DISTILL: string = read("commands/nxs.distill.md");
const EPIC: string = read("commands/nxs.epic.md");
const FIX: string = read("commands/nxs.fix.md");
const INTAKE: string = read("commands/nxs.intake.md");

const ANALYZE_REPORT: string = between(ANALYZE, "Return a concise summary", "A broken guarantee appears on the");
const EPIC_REPORT: string = between(EPIC, "## Phase 7 — Report completion", "## Epic document structure");
const DISTILL_REPORT: string = between(DISTILL, "# Phase 8 — Report completion", "# Usage");
const FIX_REPORT: string = between(FIX, "# Phase 7 — Report, and stop");
const INTAKE_REPORT: string = between(INTAKE, "# Phase 8 — Report, and stop");

/** Every completion report a stage command writes, by the section that holds its template. */
const REPORTS: ReadonlyArray<[string, string]> = [
    ["setup", between(read("commands/nxs.setup.md"), "## Phase 7: Summary", "## Quality requirements")],
    ["discover start", between(read("commands/nxs.discover.md"), "## Phase 7 — Fire the research agents", "# Action: resume")],
    ["discover resume", between(read("commands/nxs.discover.md"), "## Phase R5 —", "# Action: close")],
    ["discover close", between(read("commands/nxs.discover.md"), "## Phase C2 —", "# Store file shapes")],
    ["epic --from", between(EPIC, "3. **On success**", "The phases below do not run for `--from`.")],
    ["epic oversized", between(EPIC, "Then **stop**. Do **not** create a queue entry", "## Phase 3 — Generate the epic")],
    ["epic", EPIC_REPORT],
    ["decision-record no record", between(read("commands/nxs.decision-record.md"), "4. **The no-design-needed outcome", "This is the only deliberate way")],
    ["decision-record revision", between(read("commands/nxs.decision-record.md"), "Report the revision", "## Phase 5 — Report")],
    ["decision-record", between(read("commands/nxs.decision-record.md"), "## Phase 5 — Report", "# Usage")],
    ["analyze", ANALYZE_REPORT],
    ["distill", DISTILL_REPORT],
    ["distill unattended stop", between(read("skills/nxs-distill-unattended/SKILL.md"), "## Phase 8 — the stop report")],
    ["fix", FIX_REPORT],
    ["intake", INTAKE_REPORT],
];

describe("the run-discipline skill states the report layout once", () => {
    it("names the three headings, in order", () => {
        const at: number[] = HEADINGS.map((h) => SKILL.indexOf(`**${h}**`));
        for (const [i, h] of HEADINGS.entries()) expect(at[i], h).toBeGreaterThan(-1);
        expect(at[0]).toBeLessThan(at[1]!);
        expect(at[1]).toBeLessThan(at[2]!);
        expect(SKILL).toMatch(/three headings, in this order/i);
    });

    it("keeps Blocked on me when nothing waits, as one line that names the next stage", () => {
        expect(SKILL).toMatch(/Blocked on me is never left out/);
        expect(SKILL).toMatch(/nothing waits on the lead, it says so in one line, and that line names the next stage to run/i);
    });

    it("keeps each stage's content and any line a script reads, and leaves deliverables and refusals alone", () => {
        expect(SKILL).toMatch(/nothing is dropped/i);
        expect(SKILL).toMatch(/result line, which stays the last line/i);
        expect(SKILL).toMatch(/not completion reports/i);
        expect(SKILL).toMatch(/council's recommendation/);
    });
});

describe("every completion report a stage command writes uses the layout", () => {
    it.each(REPORTS)("%s carries Blocked on me, Changed and Found, in that order", (_name, report) => {
        const at: number[] = HEADINGS.map((h) => headingAt(report, h));
        for (const [i, h] of HEADINGS.entries()) expect(at[i], h).toBeGreaterThan(-1);
        expect(at[0]).toBeLessThan(at[1]!);
        expect(at[1]).toBeLessThan(at[2]!);
    });

    it.each(REPORTS)("%s names a next stage or a command where nothing may wait on the lead", (_name, report) => {
        expect(under(report, "Blocked on me")).toMatch(/\/nxs\.|nexus |`gh pr|merge|no stage follows/);
    });

    it("states the layout rule only in the skill, never in a command", () => {
        for (const rel of listComponentFiles(ROOT).filter((r) => r.startsWith("commands/"))) {
            const text: string = flat(read(rel));
            expect(text, rel).not.toMatch(/Blocked on me is never left out/);
            expect(text, rel).not.toMatch(/three headings, in this order/i);
        }
    });

    it("leaves /nxs.close and the council's recommendation in their own formats", () => {
        for (const rel of ["commands/nxs.close.md", "commands/nxs.council.md"]) {
            expect(read(rel), rel).not.toMatch(/Blocked on me/);
        }
    });
});

describe("stage-specific content keeps its place under the heading it belongs to", () => {
    it("puts the epic's implementation sequence under Changed", () => {
        expect(under(EPIC_REPORT, "Changed")).toMatch(/implementation sequence/i);
        expect(under(EPIC_REPORT, "Changed")).toMatch(/Phase 6 step 5/);
    });

    it("puts distill's counts under Found, laid out over the one run summary", () => {
        const found: string = under(DISTILL_REPORT, "Found");
        expect(found).toMatch(/Entries drained:\s*<n>\s*\(<local-ids>\) — <n> epic, <n> fix, <n> intake/);
        expect(found).toMatch(/Pages created:/);
        expect(found).toMatch(/Entries skipped \(not closed\):/);
        expect(DISTILL_REPORT).toMatch(/run summary/i);
        expect(under(DISTILL_REPORT, "Changed")).toContain("DISTILLATION-PR OPENED: <url>");
    });

    it("puts analyze's per-story results and every finding, medium and low included, under Found", () => {
        const found: string = under(ANALYZE_REPORT, "Found");
        expect(found).toMatch(/Per-story AC conformance:/);
        expect(found).toMatch(/STORY <story-ref> <title>/);
        expect(found).toMatch(/Departures:/);
        expect(found).toMatch(/F<n> \(<critical\|high\|medium\|low>\)/);
        expect(found).toMatch(/Severity: ⛔ critical <C> · ⚠️ high <H> · medium <M> · low <L>/);
    });
});

describe("analyze's terminal report keeps its layout, and on a pull request the toolkit writes the published review (epic #923, D12)", () => {
    it("lists each open critical or high item by ID under Blocked on me, with its detail under Found", () => {
        const blocked: string = under(ANALYZE_REPORT, "Blocked on me");
        expect(blocked).toMatch(/DV<n> \(<critical\|high>\)/);
        expect(blocked).toMatch(/F<n> \(<critical\|high>\)/);
        expect(blocked).not.toMatch(/medium|low/);
    });

    it("publishes the body the ID step wrote, never one the stage writes, and keeps the short completion report in the terminal", () => {
        expect(flat(between(ANALYZE, "## PR mode — publish a review", "2. **Check the drafted body"))).toMatch(/which the ID step wrote[\s\S]*\*\*Never write or edit it by hand\.\*\*/);
        expect(flat(ANALYZE)).toMatch(/In `--pr` mode the two separate\*\* \(epic #923, record #949, D12\)/);
    });

    it("keeps the fixed result line last and spelled as before, after Found", () => {
        expect(ANALYZE).toContain("Analyze result: critical=<C> high=<H> medium=<M> low=<L> head=<full 40-hex HEAD>");
        expect(ANALYZE).toMatch(/The report's \*\*last line\*\* is one fixed result line/);
        expect(flat(ANALYZE)).toMatch(/after Found/);
        expect(ANALYZE_REPORT).not.toContain("Analyze result:");
    });
});

describe("fix and intake turn their closing self-check into a line under Changed", () => {
    it.each([
        ["fix", FIX_REPORT],
        ["intake", INTAKE_REPORT],
    ])("%s says under Changed that nothing else was written", (_name, report) => {
        const changed: string = under(report, "Changed");
        expect(changed).toMatch(/Nothing else was written: no issue, no comment, no branch, no pull request, no commit\./);
        expect(report).not.toMatch(/Confirm to yourself/);
    });
});
