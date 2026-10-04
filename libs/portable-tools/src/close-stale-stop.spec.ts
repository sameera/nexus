/**
 * /nxs.close stops on a story whose evidence is stale, before it mines anything, naming every cause
 * and the remedy that can clear each (epic #828, story #842, decision record #849, D5–D6, G10–G12).
 * The classification is a program; these cases pin that the stage stops on what it printed and
 * names only remedies that can clear the stop.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components";

const CLOSE: string = fs.readFileSync(path.join(authoredComponentRoot(import.meta.dirname), "commands", "nxs.close.md"), "utf8");

/** Phase 0.5's range step, where the derivation's output is acted on. */
function rangeStep(): string {
    const start = CLOSE.indexOf("nexus epic-verdicts ranges --epic");
    return CLOSE.slice(start, CLOSE.indexOf("nexus pr-worktree open --pr", start));
}

/** The stop for a stale story, inside the range step. */
function staleStop(): string {
    const step = rangeStep();
    const start = step.indexOf("- `stale` — name");
    expect(start).toBeGreaterThan(-1);
    return step.slice(start, step.indexOf("- `never-reviewed` — name", start));
}

describe("/nxs.close's stale stop (story #842)", () => {
    it("sorts a story as stale for any of the three causes, and stops on it before it mines anything", () => {
        const step = rangeStep();
        for (const cause of ["`head-mismatch`", "`record-revised`", "`landed-change`"]) expect(step).toContain(cause);
        expect(CLOSE.indexOf("- `stale` — name")).toBeLessThan(CLOSE.indexOf("# Phase 2"));
    });

    it("names /nxs.analyze --pr for a moved head, analyze or a waiver for a revised record, and only a waiver for a landed change", () => {
        const stop = staleStop();
        const cause = (name: string) => stop.slice(stop.indexOf(`- \`${name}\``), stop.indexOf("\n        - ", stop.indexOf(`- \`${name}\``) + 1));
        expect(cause("head-mismatch")).toContain("/nxs.analyze --pr <N>");
        expect(cause("record-revised")).toContain("/nxs.analyze --pr <N>");
        expect(cause("record-revised")).toMatch(/waiver/);
        expect(cause("landed-change")).toMatch(/waiver/);
        expect(cause("landed-change")).not.toContain("/nxs.analyze --pr <N>");
    });

    it("tells the conformance gate that a revised record already stopped close in Phase 0.5", () => {
        const gate = CLOSE.slice(CLOSE.indexOf("## 1.2 Conformance analysis ran"), CLOSE.indexOf("## 1.3 Workspace preflight"));
        expect(gate).toMatch(/Phase 0\.5[^.]*`record-revised`/);
    });
});
