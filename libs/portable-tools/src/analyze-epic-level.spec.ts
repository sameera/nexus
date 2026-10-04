/**
 * Analyze judges the whole epic on the pull request that completes it (epic #829, story #859,
 * decision record #871, D9–D11; G30–G35). Whether a pull request completes its epic, whether its
 * head contains every merged sibling, and where an epic-number run goes are the toolkit's
 * (`nexus epic-verdicts completion` and `pr-target`); judging the metrics is the stage's. These
 * cases pin what the stage now says.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components";

const ANALYZE: string = fs.readFileSync(path.join(authoredComponentRoot(import.meta.dirname), "commands", "nxs.analyze.md"), "utf8");

function section(heading: string): string {
    const start = ANALYZE.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    const end = ANALYZE.indexOf("\n#", start + heading.length);
    return ANALYZE.slice(start, end < 0 ? undefined : end);
}

const EPIC_LEVEL = (): string => section("## 2.3 Epic-level judgment");

describe("whether a pull request completes its epic comes from the claiming read (D9)", () => {
    it("runs the completion check on every pull-request run", () => {
        expect(ANALYZE).toContain("nexus epic-verdicts completion --epic <epic-issue> --pr <N> --repo <repoIdentity>");
    });

    it("stops and publishes nothing when the claiming read fails (G34)", () => {
        expect(ANALYZE).toMatch(/`story-read-failed`[^\n]*\n?[^\n]*publish nothing/i);
    });

    it("judges no success metric on a pull request that leaves another live story unshipped (G31)", () => {
        expect(EPIC_LEVEL()).toMatch(/`skip`[\s\S]{0,200}judge \*\*no\*\* success metric/i);
    });
});

describe("the epic-level judgment on a completing pull request (D10)", () => {
    it("judges each success metric and each cross-story guarantee (G30)", () => {
        expect(EPIC_LEVEL()).toMatch(/`judge`[\s\S]*each success metric[\s\S]*each cross-story guarantee/);
    });

    it("reads this pull request's change plus each merged sibling's landed files", () => {
        expect(EPIC_LEVEL()).toMatch(/this pull request's own change[\s\S]{0,80}each merged sibling's landed\s+files/);
    });

    it("reports each metric as met, not moved, or unverifiable, and never passes an unverifiable one (G32)", () => {
        const text = EPIC_LEVEL();
        expect(text).toMatch(/\*\*met\*\*/);
        expect(text).toMatch(/\*\*not moved\*\*[^\n]*\(high\)/);
        expect(text).toMatch(/\*\*unverifiable\*\*[\s\S]{0,200}names? what would decide it/);
        expect(text).toMatch(/never passed/);
    });

    it("reports a broken cross-story guarantee as a departure", () => {
        expect(EPIC_LEVEL()).toMatch(/cross-story guarantee[^\n]*\n?[^\n]*departure \(§2\.5\)/);
    });

    it("reports the epic-level check as not run, as a high finding naming the update, when the head lacks a merged sibling (G33)", () => {
        const text = EPIC_LEVEL();
        expect(text).toMatch(/`not-run`/);
        expect(text).toContain("epic-level check not run");
        expect(text).toMatch(/\*\*high\*\*/);
        expect(text).toMatch(/names the update/);
    });
});

describe("analyze addressed by epic number combines nothing (D11, G35)", () => {
    it("no longer runs aggregate mode or the combined change set", () => {
        expect(ANALYZE).not.toContain("nexus epic-verdicts combined");
        expect(ANALYZE).not.toContain("nexus epic-verdicts derive");
        expect(ANALYZE).not.toMatch(/Aggregate mode/);
    });

    it("runs the claiming read first and names the pull request to analyze once a story has merged", () => {
        const text = section("## Phase 0.6 — Analyze addressed by epic number");
        expect(text).toContain("nexus epic-verdicts pr-target --epic <epic-issue>");
        expect(text).toMatch(/`"redirect"`[\s\S]*combine nothing/i);
        expect(text).toMatch(/`"local"`[\s\S]*Phase 1/);
    });
});
