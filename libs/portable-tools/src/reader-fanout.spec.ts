/**
 * Epic #889, story #895 — analyze and distill fan out per item and check the evidence before
 * consolidating.
 *
 * Decision record #905, D8: with more than one item, each story or entry goes to its own
 * general-purpose reader, and the readers run in parallel (G27). With one item there is no reader,
 * and the stage reads it itself in the same evidence form (G28). A reader writes nothing (G31). The
 * stage confirms each quote appears at its cited location, reads a failing location once itself,
 * and otherwise marks the claim unconfirmed; nothing goes back to a reader (G29). Every gate and
 * judgment stays in the stage (G30). One table under Found, built from the saved results, has one
 * row per item; analyze's evidence is locations only (G32). Under Codex the readers run one after
 * another, and the run says so (G38). The rules live in the `nxs-long-run` skill; each stage names
 * what its readers judge and its table's columns. No run can be watched from a spec, so these
 * assertions hold what the components say.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { renderCodexComponents } from "./codex-components.js";
import { authoredComponentRoot } from "./vendor-components.js";

const ROOT: string = authoredComponentRoot(__dirname);

function read(rel: string): string {
    return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

/** Prose wraps at any space, so every phrase check reads the text with its whitespace collapsed. */
function flat(text: string): string {
    return text.replace(/\s+/g, " ");
}

function between(text: string, start: string, end: string): string {
    const from: number = text.indexOf(start);
    expect(from, start).toBeGreaterThan(-1);
    const to: number = text.indexOf(end, from + start.length);
    expect(to, end).toBeGreaterThan(-1);
    return text.slice(from, to);
}

function frontmatterLine(body: string, key: string): string {
    return body.split("\n").find((l) => l.startsWith(`${key}: `)) ?? "";
}

const RAW_SKILL: string = read("skills/nxs-long-run/SKILL.md");
const SKILL: string = flat(RAW_SKILL);
const ANALYZE: string = read("commands/nxs.analyze.md");
const DISTILL: string = read("commands/nxs.distill.md");

/** A numbered section of the skill, by its title. */
function section(title: string): string {
    const match: RegExpExecArray | null = new RegExp(`^## \\d+\\. ${title}\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, "m").exec(RAW_SKILL);
    expect(match, title).not.toBeNull();
    return flat(match![1]!);
}

describe("the long-run skill states the readers, the evidence form and the evidence check", () => {
    it("gives each item its own general-purpose reader when there is more than one, run in parallel (G27)", () => {
        const readers: string = section("Readers");
        expect(readers).toMatch(/more than one item/i);
        expect(readers).toMatch(/its own general-purpose reader/i);
        expect(readers).toMatch(/in parallel/i);
        expect(readers).toMatch(/repeated analyze rounds/i);
    });

    it("launches no reader for one item, and the stage reads it in the same evidence form (G28)", () => {
        const readers: string = section("Readers");
        expect(readers).toMatch(/one item[^.]*no reader/i);
        expect(readers).toMatch(/read it yourself/i);
        expect(readers).toMatch(/evidence form/i);
    });

    it("hands each reader a brief that writes nothing, cites every claim and marks the rest unconfirmed (G31)", () => {
        const brief: string = section("Readers");
        expect(brief).toMatch(/reader brief/i);
        expect(brief).toMatch(/read only/i);
        expect(brief).toMatch(/write nothing: no file, no commit, no GitHub write/i);
        expect(brief).toMatch(/cite every claim/i);
        expect(brief).toMatch(/unconfirmed/i);
        expect(brief).toMatch(/where you looked/i);
    });

    it("defines the evidence form as a location plus a short quote, and what a location is", () => {
        expect(SKILL).toMatch(/a location plus a short quote/i);
        expect(SKILL).toMatch(/file and line/i);
        expect(SKILL).toMatch(/diff hunk/i);
        expect(SKILL).toMatch(/decision ID in the record/i);
    });

    it("checks each quote at its location, reads a failing one once itself, and sends nothing back (G29)", () => {
        const check: string = section("The evidence check");
        expect(check).toMatch(/each quote appears at (its|the) cited location/i);
        expect(check).toMatch(/read that location yourself, once/i);
        expect(check).toMatch(/mark[^.]*unconfirmed/i);
        expect(check).toMatch(/never send[^.]*back to (its|a) reader/i);
    });

    it("saves the accepted result in the run folder before ticking the item's line (G22)", () => {
        expect(section("The evidence check")).toMatch(/save the accepted result in the run folder; only then may the item.s line be ticked/i);
    });

    it("keeps every gate and judgment in the stage (G30)", () => {
        const readers: string = section("Readers");
        expect(readers).toMatch(/every gate and judgment stays with the stage/i);
        for (const judgment of ["severity", "IDs", "departures", "guarantees", "deltas", "page prose", "checkpoint", "publish"]) {
            expect(readers, judgment).toContain(judgment);
        }
    });

    it("builds one table under Found, one row per item, from the saved results (G32)", () => {
        const table: string = section("The final table");
        expect(table).toMatch(/one table/i);
        expect(table).toMatch(/under Found/);
        expect(table).toMatch(/one row per item/i);
        expect(table).toMatch(/from the saved results in the run folder/i);
    });
});

describe("analyze and distill can launch readers, and still run on the session's model", () => {
    it.each([
        ["analyze", ANALYZE],
        ["distill", DISTILL],
    ])("%s carries the subagent tool and model: inherit (G39)", (_name, text) => {
        expect(frontmatterLine(text, "tools").replace("tools: ", "").split(",").map((t) => t.trim())).toContain("Task");
        expect(frontmatterLine(text, "model")).toBe("model: inherit");
    });
});

describe("analyze's readers judge one story's criteria, and the stage keeps the rest", () => {
    const CRITERIA: string = flat(between(ANALYZE, "## 2.1 Acceptance-criteria conformance", "## 2.2 Guarantee"));

    it("gives each story its own reader, which judges only that story's acceptance criteria (G27)", () => {
        expect(CRITERIA).toMatch(/more than one story/i);
        expect(CRITERIA).toMatch(/its own reader/i);
        expect(CRITERIA).toMatch(/only that story's acceptance criteria/i);
    });

    it("runs the evidence check before it saves a story's results and ticks its line (G29, G22)", () => {
        expect(CRITERIA).toMatch(/evidence check/i);
        expect(CRITERIA.indexOf("evidence check")).toBeLessThan(CRITERIA.indexOf("Save each story's results"));
    });

    it("keeps severity, IDs and deferral with the stage (G30)", () => {
        expect(CRITERIA).toMatch(/severity[^.]*(stay|yours|stage)/i);
    });

    it("lays the per-story results out as one table whose evidence is locations only (G32)", () => {
        const found: string = between(ANALYZE, "### Found", "Departures:");
        expect(found).toContain("| Story | Met | Partial | Unmet | Contradicted | Unconfirmed | Evidence |");
        expect(found).toContain("STORY <story-ref> <title>");
        expect(flat(found)).toMatch(/locations only/i);
        expect(flat(found)).toMatch(/no quotes?/i);
    });

    it("keeps medium and low out of Blocked on me, and the result line last", () => {
        expect(between(ANALYZE, "### Blocked on me", "### Changed")).not.toMatch(/medium|low/);
        expect(ANALYZE).toContain("Analyze result: critical=<C> high=<H> medium=<M> low=<L> head=<full 40-hex HEAD>");
    });
});

describe("distill's readers read one entry each, and the stage keeps the deltas and the prose", () => {
    const SYNTH: string = flat(between(DISTILL, "# Phase 3 — Synthesize", "# Phase 4"));

    it("gives each entry its own reader, which derives the diff again and never writes it (G27, G36)", () => {
        expect(SYNTH).toMatch(/more than one entry/i);
        expect(SYNTH).toMatch(/its own reader/i);
        expect(SYNTH).toMatch(/nexus derive-entry-diff/);
        expect(SYNTH).toMatch(/never writ\w*[^.]*diff|diff[^.]*never writ/i);
        expect(SYNTH).toMatch(/\*why\* file/i);
        expect(SYNTH).toMatch(/close-record\.md/);
    });

    it("has readers return behaviour changes and decisions with evidence, never deltas or prose (G30)", () => {
        expect(SYNTH).toMatch(/behaviour changes and decisions/i);
        expect(SYNTH).toMatch(/never deltas or prose/i);
    });

    it("gives a blocked entry no reader, so the stage decides it (G30)", () => {
        expect(SYNTH).toMatch(/blocked entry[^.]*no reader|no reader[^.]*blocked/i);
    });

    it("adds one run-summary field that only the report shows", () => {
        const summary: string = between(DISTILL, "| Field | Holds |", "Provenance in every field");
        const row: string | undefined = summary.split("\n").find((l) => l.startsWith("| `evidence` |"));
        expect(row).toBeDefined();
        expect(row).toMatch(/drained/);
        expect(row).toMatch(/blocked/);
        expect(row).toMatch(/skipped/);
        expect(row).toMatch(/report only/i);
    });

    it("leaves the checkpoint and the pull-request body without the new field (G36)", () => {
        const checkpoint: string = between(DISTILL, "CHECKPOINT: Distillation-PR", "About to:");
        const prBody: string = between(DISTILL, "## Distillation: <epic title(s)>", "# Phase 8");
        for (const layout of [checkpoint, prBody]) {
            expect(layout).not.toMatch(/evidence/i);
            expect(layout).not.toContain("| Entry | Outcome |");
        }
    });

    it("lays the entries out as one table under Found, from the run summary (G32)", () => {
        const report: string = between(DISTILL, "# Phase 8", "# Usage");
        const found: string = report.slice(report.indexOf("## Found"));
        expect(found).toContain("| Entry | Outcome | Concepts changed | Evidence |");
        expect(found).toMatch(/drained \| blocked \| skipped|drained, blocked or skipped/);
        expect(flat(report)).toMatch(/reading it from `<run>\/run-summary\.md`/);
    });
});

describe("under Codex the readers run one after another, and the run says so (G38)", () => {
    it.each(["nxs-analyze", "nxs-distill"])("%s tells Codex to read each item in turn and say so", (name) => {
        const rendered: string = renderCodexComponents(ROOT).get(`skills/${name}/SKILL.md`)?.toString("utf8") ?? "";
        const runtime: string = flat(rendered.slice(0, rendered.indexOf("## Workflow")));
        expect(runtime).toMatch(/reader[^.]*one after another/i);
        expect(runtime).toMatch(/say so under Found/i);
    });
});
