/**
 * /nxs.close checks that each reviewed file landed as it was reviewed, stops on a pull request that
 * did not land, and states each story's landed-check result in both the close record and the close
 * comment (epic #828, story #846, decision record #849, D3–D4, G3, G7). The check is a program;
 * these cases pin that the stage acts on and stamps what it printed.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components";

const CLOSE: string = fs.readFileSync(path.join(authoredComponentRoot(import.meta.dirname), "commands", "nxs.close.md"), "utf8");

function machineBlock(): string {
    const marker = CLOSE.indexOf("<!-- nexus:close-record -->\n```yaml");
    expect(marker).toBeGreaterThan(-1);
    return CLOSE.slice(marker, CLOSE.indexOf("```\n", marker + 40));
}

/** Phase 0.5's range step, where the derivation's output is acted on. */
function rangeStep(): string {
    const start = CLOSE.indexOf("nexus epic-verdicts ranges --epic");
    return CLOSE.slice(start, CLOSE.indexOf("nexus pr-worktree open --pr", start));
}

describe("/nxs.close's landed check (story #846)", () => {
    it("stops on a pull request that did not land, with no waiver, and keeps it apart from a checkout that is behind", () => {
        const step = rangeStep();
        expect(step).toContain("`not-landed`");
        expect(step).toContain("`checkout-behind`");
        expect(step).toContain("`landed-unreadable`");
    });

    it("stamps each story's landed-check result into the close comment's machine block", () => {
        expect(machineBlock()).toMatch(/^landed_check:/m);
    });

    it("writes the same landed-check result into the close record", () => {
        const phase4 = CLOSE.slice(CLOSE.indexOf("# Phase 4"), CLOSE.indexOf("# Phase 5"));
        expect(phase4).toContain("`landed_check`");
    });
});
