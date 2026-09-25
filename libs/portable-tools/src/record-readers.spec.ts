/**
 * The stages that read a record after approval accept both formats (epic #787, story #790).
 *
 * `/nxs.analyze`, `/nxs.close` and `/nxs.distill` are prose a model executes, so what each one reads
 * off an approved record is a contract stated in its text. These assertions pin that each stage
 * learns the record's format and parts from the one section reader (D4) rather than by hunting for
 * headings, that a new-format record's guarantees and appendix are what the stage reads (D9), and
 * that an old-format or unreadable-format record is read as before (G20, G22).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const AUTHORED: string = path.join(path.resolve(import.meta.dirname, "..", "..", ".."), "components");

function read(rel: string): string {
    return fs.readFileSync(path.join(AUTHORED, rel), "utf8").replace(/\s+/g, " ");
}

const READER: RegExp = /nexus record-sections --body /;

describe("/nxs.analyze reads a record through the section reader", () => {
    const analyze: string = read("commands/nxs.analyze.md");

    it("calls the reader on the fetched record body", () => {
        expect(analyze).toMatch(READER);
    });

    it("checks every guarantee of a new-format record, Existing behaviour to preserve included, and a broken one is critical", () => {
        expect(analyze).toMatch(/every guarantee/i);
        expect(analyze).toContain("Existing behaviour to preserve");
        expect(analyze).toMatch(/breaks a guarantee[^.]*\*\*critical\*\*/i);
    });

    it("names a broken guarantee by its ID in the report", () => {
        expect(analyze).toMatch(/Guarantee violations: .*G<n>/);
    });

    it("keeps the invariants of an old-format record and reads a body in neither format whole", () => {
        expect(analyze).toMatch(/`old`[^.]*invariants/);
        expect(analyze).toMatch(/`neither`[^.]*whole/);
    });
});

describe("/nxs.close reads a record through the section reader", () => {
    const close: string = read("commands/nxs.close.md");

    it("calls the reader on the record body", () => {
        expect(close).toMatch(READER);
    });

    it("takes a new-format record's deviation baseline from How it works, the Mechanism and the guarantees", () => {
        expect(close).toMatch(/How it works.{0,40}Mechanism.{0,40}guarantees/);
    });

    it("writes Key Decisions from the appendix's decisions, reasons and refuted viable alternatives, and names a deviated decision by its ID", () => {
        expect(close).toMatch(/Decisions and reasons/);
        expect(close).toMatch(/names the decision it deviates from by its ID/);
    });

    it("keeps the old-format baseline and the hash stamping unchanged", () => {
        expect(close).toMatch(/`old`[^.]*chosen approach, constraints and invariants/i);
        expect(close).toMatch(/`neither`[^.]*whole/);
    });
});

describe("/nxs.distill reads a record through the section reader", () => {
    const distill: string = read("commands/nxs.distill.md");

    it("calls the reader on the why file", () => {
        expect(distill).toMatch(READER);
    });

    it("takes a new-format record's decision log entries from its decisions and reasons", () => {
        expect(distill).toMatch(/Decision Log entr[^.]*decisions[^.]*reasons/i);
    });

    it("rewrites each statement named under Concept-store changes as given, and does not report it as drift", () => {
        expect(distill).toMatch(/Concept-store changes/);
        expect(distill).toMatch(/not (reported|report[^.]*) as drift/i);
    });

    it("has its recovery path read the same sections", () => {
        const recovery: string = read("skills/nxs-distill-recovery/SKILL.md");
        expect(recovery).toMatch(READER);
    });
});

describe("the record checkpoint declares its draft a record", () => {
    it("passes --record to the razor check, so a draft in neither format blocks filing", () => {
        const record: string = read("commands/nxs.decision-record.md");
        expect(record).toMatch(/nexus razor-check --draft "<scratch>\/record-body\.labelled\.md" --source "<scratch>\/source\.md" --record/);
        expect(record).toMatch(/neither format/);
    });
});
