/**
 * /nxs.close stops on a story no receipt names, or one with open work, before it mines anything,
 * and no longer offers to close without the analysis (epic #828, story #847, decision record #849,
 * D5–D7, G13, G14). The classification is a program; these cases pin that the stage stops on what
 * it printed and names the remedy each state allows.
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

/** Phase 1.2, the conformance gate. */
function conformanceGate(): string {
    return CLOSE.slice(CLOSE.indexOf("## 1.2 Conformance analysis ran"), CLOSE.indexOf("## 1.3 Workspace preflight"));
}

describe("/nxs.close's story states (story #847)", () => {
    it("stops on a never-reviewed, unshipped or unknown story before it mines anything", () => {
        const step = rangeStep();
        expect(step).toContain("`closable`");
        for (const state of ["`never-reviewed`", "`unshipped`", "`unknown`"]) expect(step).toContain(state);
        expect(CLOSE.indexOf("`closable` must be `true`")).toBeLessThan(CLOSE.indexOf("# Phase 2"));
    });

    it("names /nxs.analyze --pr as a never-reviewed story's remedy, and no analyze remedy for unshipped work", () => {
        const step = rangeStep();
        const neverReviewed = step.slice(step.indexOf("- `never-reviewed` — name"), step.indexOf("- `unshipped` — name"));
        expect(neverReviewed).toContain("/nxs.analyze --pr <N>");
        const unshipped = step.slice(step.indexOf("- `unshipped` — name"), step.indexOf("- `unknown` — name"));
        expect(unshipped).not.toContain("/nxs.analyze --pr");
    });

    it("no longer offers to close without the analysis", () => {
        expect(conformanceGate()).not.toContain('"Close without analysis"');
        expect(CLOSE).not.toContain("closed without /nxs.analyze");
    });

    it("no longer offers the blocking-findings override: an answer on the pull request replaces it (record #871, G17)", () => {
        expect(conformanceGate()).not.toContain("Override and close");
    });
});
