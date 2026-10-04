/**
 * /nxs.close honours a waiver a lead posted on the pull request, never asks for one, and states
 * each one it applied in both the close record and the close comment (epic #828, story #856,
 * decision record #849, D6, D11, G26, G33, G34). Which waiver clears which stop is a program; these
 * cases pin that the stage documents the form, acts on what it printed, and stamps it.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components";

/** The marker the one waiver reader looks for; the lead must post exactly this. */
const WAIVER_MARKER = "<!-- nexus:close-waiver -->";

const CLOSE: string = fs.readFileSync(path.join(authoredComponentRoot(import.meta.dirname), "commands", "nxs.close.md"), "utf8");

function rangeStep(): string {
    const start = CLOSE.indexOf("nexus epic-verdicts ranges --epic");
    return CLOSE.slice(start, CLOSE.indexOf("nexus pr-worktree open --pr", start));
}

function conformanceGate(): string {
    return CLOSE.slice(CLOSE.indexOf("## 1.2 Conformance analysis ran"), CLOSE.indexOf("## 1.3 Workspace preflight"));
}

function machineBlock(): string {
    const marker = CLOSE.indexOf("<!-- nexus:close-record -->\n```yaml");
    return CLOSE.slice(marker, CLOSE.indexOf("```\n", marker + 40));
}

describe("/nxs.close's posted waivers (story #856)", () => {
    it("documents the fixed form a lead posts, for both causes, under the reader's own marker", () => {
        const step = rangeStep();
        expect(step).toContain(WAIVER_MARKER);
        expect(step).toContain("waive: landed-change");
        expect(step).toContain("waive: record-revised");
    });

    it("never asks for a revised-record or landed-change waiver at the checkpoint (G34)", () => {
        const gate = conformanceGate();
        expect(gate).not.toContain('"Proceed against the revised record"');
        expect(gate).not.toMatch(/AskUserQuestion[^\n]*record/);
    });

    it("keeps the blocking-findings override at the checkpoint (G26)", () => {
        expect(conformanceGate()).toContain('"Override and close"');
    });

    it("stamps every applied waiver into the close comment's machine block and the close record (G33)", () => {
        expect(machineBlock()).toMatch(/^waivers:/m);
        const phase4 = CLOSE.slice(CLOSE.indexOf("# Phase 4"), CLOSE.indexOf("# Phase 5"));
        expect(phase4).toContain("`waivers`");
    });
});
