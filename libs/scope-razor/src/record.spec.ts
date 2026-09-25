import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cutCitations, readRecord, recordFormat, type CutCitation, type RecordDecision, type RecordField, type RecordGuarantee, type RecordLine, type RecordReading } from "./record.js";

const HERE: string = path.dirname(fileURLToPath(import.meta.url));
const NEW: string = fs.readFileSync(path.join(HERE, "__fixtures__", "record-new.labelled.md"), "utf8");

const OLD: string = [
    "# Decision Record: Something",
    "",
    "## Summary",
    "",
    "One paragraph.",
    "",
    "## Key Decisions",
    "",
    "### The list is a render over the draft",
    "",
    "- **Decision:** read the labelled draft.",
    "- **Refuted alternative:** have the architect return its own list.",
    "",
    "## Constraints & Invariants",
    "",
    "1. Every model-added invariant appears on the list `[inferred]`",
    "",
    "## Risks (BLOCKER / ADDRESS only)",
    "",
    "- **ADDRESS — a claimed citation hides an invariant:** mark the claim. `[inferred]`",
    "",
].join("\n");

describe("telling a record's format apart by its headings", () => {
    it("reads a body with a Guarantees section as the new format", () => {
        expect(recordFormat(NEW)).toBe("new");
    });

    it("reads a body with a Constraints & Invariants section as the old format", () => {
        expect(recordFormat(OLD)).toBe("old");
    });

    it("reads a body with neither section as neither format", () => {
        expect(recordFormat("# Decision Record: Empty\n\n## Summary\n\nNothing.\n")).toBe("neither");
        expect(readRecord("# Decision Record: Empty\n\n## Summary\n\nNothing.\n")).toMatchObject({ format: "neither", decisions: [], guarantees: [], invariants: [], risks: [] });
    });

    it("ignores a heading's trailing template comment when it decides", () => {
        expect(recordFormat("## Guarantees <!-- the primary contract -->\n\n- G1. A thing.\n")).toBe("new");
    });
});

describe("reading a new-format record", () => {
    const record: RecordReading = readRecord(NEW);

    it("lists every decision from the appendix, by its ID", () => {
        expect(record.decisions.map((d: RecordDecision) => d.id)).toEqual(["D1", "D2", "D3"]);
        expect(record.decisions[0].heading).toBe("D1 — A new function and a new provider");
    });

    it("lists every refuted alternative under its decision, and none written as `none`", () => {
        expect(record.decisions.map((d: RecordDecision) => d.alternatives.length)).toEqual([1, 2, 0]);
        expect(record.decisions[1].alternatives[1].value).toMatch(/^Query per value/);
    });

    it("keeps every field of a decision, the `none` ones included, for the checks that require them", () => {
        const fields: string[] = record.decisions[2].fields.map((f: RecordField) => f.name);
        expect(fields).toEqual(["Decision", "Why", "Refuted viable alternative", "Trade-off", "Epic commitment affected", "Delivered by", "Guarantees"]);
    });

    it("lists every guarantee in every group, Existing behaviour to preserve included", () => {
        expect(record.guarantees.map((g: RecordGuarantee) => g.id)).toEqual(["G1", "G2", "G3", "G4", "G5"]);
        expect(record.guarantees.map((g: RecordGuarantee) => g.group)).toEqual(["Tenant boundary", "Tenant boundary", "Fetching and cost", "Existing behaviour to preserve", "Existing behaviour to preserve"]);
    });

    it("lists every risk by its ID, and never a line of the Approval brief", () => {
        expect(record.risks.map((r: RecordLine) => r.id)).toEqual(["R1", "R2", "R3"]);
        expect(record.risks.every((r: RecordLine) => !r.text.includes("R1 BLOCKER:"))).toBe(true);
    });

    it("lists the concept-store changes", () => {
        expect(record.conceptChanges).toHaveLength(1);
        expect(record.conceptChanges[0].text).toContain("Lookup page");
    });

    it("names the body line each item sits on", () => {
        const lines: string[] = NEW.split("\n");
        expect(lines[record.guarantees[3].line - 1]).toContain("G4. Database and network failures");
        expect(lines[record.decisions[1].line - 1]).toBe("#### D2 — Match in the store, keyed by the batch's own values");
    });

    it("has no invariants, since the new format has none", () => {
        expect(record.invariants).toEqual([]);
    });
});

describe("reading an old-format record", () => {
    const record: RecordReading = readRecord(OLD);

    it("lists its decisions and their refuted alternatives from Key Decisions", () => {
        expect(record.decisions.map((d: RecordDecision) => d.heading)).toEqual(["The list is a render over the draft"]);
        expect(record.decisions[0].alternatives.map((a: RecordField) => a.value)).toEqual(["have the architect return its own list."]);
    });

    it("lists its invariants and risks, and no guarantees", () => {
        expect(record.invariants.map((i: RecordLine) => i.text)).toEqual(["1. Every model-added invariant appears on the list `[inferred]`"]);
        expect(record.risks).toHaveLength(1);
        expect(record.guarantees).toEqual([]);
    });
});

describe("finding a surviving line that still cites a cut guarantee or risk", () => {
    const draft: string = [
        "- G1. A thing. (D1)",
        "- G31. Another thing. (D2)",
        "- **Guarantees:** G1, G3",
        "- R2 ADDRESS — see G3.",
        '- G4. Quoted `[asked: "as G3 says"]`',
    ].join("\n");

    it("names every line that cites a cut ID, with its line number", () => {
        const found: CutCitation[] = cutCitations(draft, ["G3"]);
        expect(found.map((c: CutCitation) => c.line)).toEqual([3, 4]);
        expect(found[0].id).toBe("G3");
    });

    it("matches an ID as a whole token, so G3 does not match G31 or R2 match R21", () => {
        expect(cutCitations(draft, ["G3"]).some((c: CutCitation) => c.line === 2)).toBe(false);
        expect(cutCitations("- R21 ADDRESS — a risk.", ["R2"])).toEqual([]);
    });

    it("reads no provenance label's quoted fragment as a citation", () => {
        expect(cutCitations(draft, ["G3"]).some((c: CutCitation) => c.line === 5)).toBe(false);
    });

    it("finds nothing when nothing cites a cut item", () => {
        expect(cutCitations(draft, ["G9", "R7"])).toEqual([]);
    });
});
