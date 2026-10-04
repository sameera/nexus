/**
 * Analyze names every departure from the decision record (epic #829, story #858, decision record
 * #871, D1 and D2's departure part; G1–G8, G14). The judgment is the stage's; the numbering, the
 * registry and the severity are the toolkit's (`nexus verdict-items`), and the publish check
 * refuses a verdict that leaves them out. These cases pin what the stage now says.
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

const DEPARTURES = (): string => section("## 2.5 Departures from the decision record");

describe("the departure pass compares the change with a baseline that depends on the record's format (D1)", () => {
    it("reads How it works, the Mechanism and every guarantee of a new-format record", () => {
        expect(DEPARTURES()).toMatch(/`new`[^\n]*How it works[^\n]*Mechanism[^\n]*every guarantee/);
    });

    it("reads an old-format record's approach, constraints and invariants, and a body in neither format whole", () => {
        expect(DEPARTURES()).toMatch(/`old`[^\n]*approach[^\n]*constraints[^\n]*invariants/);
        expect(DEPARTURES()).toMatch(/`neither`[^\n]*whole body/);
    });

    it("compares with the epic's description when the epic has no record", () => {
        expect(DEPARTURES()).toMatch(/degraded[^\n]*epic's description/);
    });
});

describe("what a departure says", () => {
    it("names what it departs from, and one that names nothing is never listed (G1)", () => {
        expect(DEPARTURES()).toMatch(/Each departure names what it departs from/);
        expect(DEPARTURES()).toMatch(/A departure that names nothing is never listed/);
    });

    it("lists no departure when the code matches the baseline (G2)", () => {
        expect(DEPARTURES()).toMatch(/matches\s+the baseline lists \*\*no\*\* departure/);
    });

    it("reports a broken guarantee once, as a departure, and never also as a finding (G3)", () => {
        expect(section("## 2.2 Guarantee and invariant conformance")).toMatch(/\*\*once, as a departure\*\*[\s\S]*\*\*never also as a separate finding\*\*/);
        expect(ANALYZE).not.toContain("Guarantee violations:");
    });

    it("shows a stub's reason beside the departure it explains, and the stub answers nothing (G4)", () => {
        expect(DEPARTURES()).toMatch(/A decision stub explains; it never answers/);
        expect(DEPARTURES()).toMatch(/departure stays \*\*unanswered\*\*/);
        expect(ANALYZE).toMatch(/stub: <stub path> says "<reason>"/);
    });

    it("marks superseding only a departure that does the opposite of a record decision, naming it and what the code does instead (G5)", () => {
        expect(DEPARTURES()).toMatch(/only when the code does the \*\*opposite\*\*/);
        expect(DEPARTURES()).toMatch(/\*\*never\*\* marked superseding/);
        expect(ANALYZE).toMatch(/supersedes <D<n>>: <what the code does instead>/);
    });

    it("counts an unanswered departure as blocking: critical when it breaks a guarantee or invariant, high otherwise (G14)", () => {
        expect(DEPARTURES()).toMatch(/unanswered departure is a blocking finding\*\*: \*\*critical\*\* when it breaks a guarantee or an\s+invariant, \*\*high\*\* otherwise/);
    });
});

describe("IDs come from the toolkit's registry, never from the stage (D2; G6–G8)", () => {
    it("hands the departures to the ID step, which reads the newest trusted verdict as the registry", () => {
        expect(DEPARTURES()).toContain('nexus verdict-items --pr <N> --repo <repoIdentity> --draft "<scratch>/items.json" --out "<scratch>/judgments.md" --record-body "<scratch>/record-body.md" --record-hash "$RECORD_HASH" --dir "$wtPath"');
        expect(DEPARTURES()).toMatch(/never by you/);
    });

    it("reports a departure the last verdict listed and this run did not find again as no longer found, never dropped (G8)", () => {
        expect(DEPARTURES()).toMatch(/\*\*no longer found\*\* — never dropped/);
        expect(ANALYZE).toMatch(/DV<n> no longer found/);
    });

    it("appends the judgments block after the verdict block on every publish, and hands it to the publish check", () => {
        const publish = section("## PR mode — publish a review, not a file");
        const appendAt = publish.indexOf("<!-- nexus:analyze-judgments -->");
        expect(appendAt).toBeGreaterThan(publish.indexOf("<!-- nexus:analyze-receipt -->"));
        expect(appendAt).toBeLessThan(publish.indexOf("nexus verdict-check"));
        expect(publish).toMatch(/a verdict with no\s+item included/);
        for (const refusal of ["judgments-missing", "counts-not-open", "judgments-malformed"]) {
            expect(publish).toContain(`\`${refusal}\``);
        }
    });

    it("lists departures without IDs when there is no pull request to number them on", () => {
        expect(DEPARTURES()).toMatch(/Without a pull request there is no registry: list the departures without IDs/);
    });
});
