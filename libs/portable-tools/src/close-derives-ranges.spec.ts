/**
 * /nxs.close derives each story's commit ranges itself and stamps them into the close record and
 * the close comment (epic #828, story #841, decision record #849, D1–D2, G3). The derivation is a
 * program; these cases pin that the stage runs it, before it writes anything, and that both
 * durable surfaces carry what it printed.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components";

const CLOSE: string = fs.readFileSync(path.join(authoredComponentRoot(import.meta.dirname), "commands", "nxs.close.md"), "utf8");

/** The close comment's marker-anchored machine block, as the stage specifies it. */
function machineBlock(): string {
    const marker = CLOSE.indexOf("<!-- nexus:close-record -->\n```yaml");
    expect(marker).toBeGreaterThan(-1);
    return CLOSE.slice(marker, CLOSE.indexOf("```\n", marker + 40));
}

describe("/nxs.close derives its ranges (story #841)", () => {
    it("runs the one range derivation for every epic, before the worktree is opened and before anything is written", () => {
        const derive = CLOSE.indexOf("nexus epic-verdicts ranges --epic");
        expect(derive).toBeGreaterThan(-1);
        expect(derive).toBeLessThan(CLOSE.indexOf("nexus pr-worktree open"));
        expect(derive).toBeLessThan(CLOSE.indexOf("# Phase 4"));
    });

    it("stamps the range list and the per-story list, with a no-range entry, into the close comment's machine block", () => {
        const block = machineBlock();
        expect(block).toMatch(/^range:/m);
        expect(block).toMatch(/^story_ranges:/m);
        expect(block).toContain("range: none");
    });

    it("writes the per-story list into the close record too", () => {
        const phase4 = CLOSE.slice(CLOSE.indexOf("# Phase 4"), CLOSE.indexOf("# Phase 5"));
        expect(phase4).toContain("`story_ranges`");
        expect(phase4).toContain("range: none");
    });
});
