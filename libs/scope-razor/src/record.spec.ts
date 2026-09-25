import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
    cutCitations,
    readRecord,
    recordFormat,
    recordSections,
    type CutCitation,
    type RecordDecision,
    type RecordField,
    type RecordGuarantee,
    type RecordLine,
    type RecordReading,
    type RecordSections,
} from "./record.js";

const HERE: string = path.dirname(fileURLToPath(import.meta.url));
const NEW: string = fs.readFileSync(path.join(HERE, "__fixtures__", "record-new.labelled.md"), "utf8");
/** Record #725 as filed on GitHub, approved in the old format. */
const OLD_FILED: string = fs.readFileSync(path.join(HERE, "__fixtures__", "record-old.filed.md"), "utf8");
/** The worked examples of the approval-first format, as the trial rewrote records #245 and #786. */
const TRIAL: string = path.join(HERE, "..", "..", "..", "docs", "features", "artifact-prose-style", "decision-record-trial");
const RECORD_245: string = fs.readFileSync(path.join(TRIAL, "record-245.md"), "utf8");
const RECORD_786: string = fs.readFileSync(path.join(TRIAL, "record-786.md"), "utf8");

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

describe("the sections a later stage reads from an approved record (epic #787, story #790)", () => {
    describe("a new-format record", () => {
        const record: RecordSections = recordSections(RECORD_786);

        it("reads as the new format and lists every decision of the appendix with its parts", () => {
            expect(record.format).toBe("new");
            expect(record.decisions.map((d) => d.id)).toEqual(["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11"]);
            const d1 = record.decisions[0];
            expect(d1.title).toBe("Propose the objective inside the existing consent gate");
            expect(d1.decision).toMatch(/^Each consent option that files stubs/);
            expect(d1.why).toMatch(/^The objective must be settled/);
            expect(d1.refutedAlternatives).toEqual([expect.stringMatching(/^A second question about the objective/)]);
            expect(d1.tradeOff).toBe("the lead gets no recommendation and judges the objective unaided.");
            expect(d1.deliveredBy).toBe("#706");
            expect(d1.guarantees).toEqual(["G2", "G3", "G4"]);
        });

        it("keeps an epic or story change a decision states", () => {
            expect(record.decisions[1].commitmentAffected).toMatch(/^#706 criterion 1\. Old: /);
            expect(record.decisions[0].commitmentAffected).toBeUndefined();
        });

        it("lists every guarantee in every group, with the decisions it cites, Existing behaviour to preserve included", () => {
            expect(record.guarantees.map((g) => g.id)).toEqual(["G1", "G2", "G3", "G4", "G12", "G5", "G6", "G13", "G14", "G7", "G8", "G11", "G15", "G16", "G9", "G10"]);
            const g3 = record.guarantees.find((g) => g.id === "G3");
            expect(g3).toMatchObject({ group: "Consent", decisions: ["D1", "D3"] });
            expect(g3?.text).toBe("Nothing is filed until the lead has accepted or declined the initiative. (D1, D3)");
            expect(record.guarantees.filter((g) => g.group === "Existing behaviour to preserve").map((g) => g.id)).toEqual(["G9", "G10"]);
            expect(record.guarantees.find((g) => g.id === "G9")?.decisions).toEqual([]);
        });

        it("lists the risks by ID and severity", () => {
            expect(record.risks.map((r) => [r.id, r.severity])).toEqual([
                ["R1", "ADDRESS"],
                ["R2", "ADDRESS"],
            ]);
            expect(record.risks[0].text).toMatch(/^A repository that uses GitHub issue types/);
        });

        it("names the page, the old statement and the new one of each concept-store change it can split", () => {
            expect(record.conceptChanges).toEqual([
                expect.objectContaining({ page: "Epic stub", old: "no stub is ever a sub-issue", new: "no stub is ever a sub-issue of an epic" }),
                expect.objectContaining({ page: "Issue kind", old: undefined, new: undefined, text: "Issue kind page: epic, story and record gain a fourth kind, the initiative." }),
            ]);
        });

        it("has no invariants", () => {
            expect(record.invariants).toEqual([]);
        });
    });

    it("splits no change whose line says more after the new wording, so nothing of the rewrite is dropped", () => {
        const body: string = '## Guarantees\n\n- G1. A thing.\n\n## Concept-store changes\n\n- Derived Filing Body page: "Five things" becomes "Six things", with a `none` field added as the sixth.\n';
        expect(recordSections(body).conceptChanges[0]).toMatchObject({ page: "Derived Filing Body", old: undefined, new: undefined, text: expect.stringContaining("added as the sixth") });
    });

    it("reads a blocker risk and a guarantee that cites no decision in the other worked example", () => {
        const record: RecordSections = recordSections(RECORD_245);
        expect(record.format).toBe("new");
        expect(record.decisions).toHaveLength(13);
        expect(record.risks[0]).toMatchObject({ id: "R1", severity: "BLOCKER" });
        expect(record.guarantees.filter((g) => g.group === "No supporting decision").every((g) => g.decisions.length === 0)).toBe(true);
    });

    it("drops the labels and the fields written as `none` from a labelled draft", () => {
        const record: RecordSections = recordSections(NEW);
        const d3 = record.decisions[2];
        expect(d3.refutedAlternatives).toEqual([]);
        expect(d3.tradeOff).toBeUndefined();
        expect(d3.commitmentAffected).toBeUndefined();
        expect(d3.guarantees).toEqual([]);
        expect(record.guarantees[1].text).toBe("The table and column names sent to the database are the confirmed ones, never the author's raw text. (D1)");
    });

    describe("an old-format record, as filed", () => {
        const record: RecordSections = recordSections(OLD_FILED);

        it("reads as the old format and lists its Key Decisions with their reasons and refuted alternatives", () => {
            expect(record.format).toBe("old");
            expect(record.decisions).toHaveLength(8);
            const first = record.decisions[0];
            expect(first.id).toBeUndefined();
            expect(first.title).toBe("The list is a render over the labelled draft, not a new artifact");
            expect(first.decision).toMatch(/^The checkpoint sources its lines/);
            expect(first.why).toMatch(/^The labels exist in exactly one place/);
            expect(first.refutedAlternatives).toEqual([expect.stringMatching(/^Have the architect return/)]);
        });

        it("lists its invariants, numbered as written, and its risks, and no guarantees", () => {
            expect(record.invariants).toHaveLength(16);
            expect(record.invariants[0]).toMatchObject({ number: 1, text: expect.stringMatching(/^Every invariant and every risk in the draft/) });
            expect(record.invariants[15].number).toBe(16);
            expect(record.risks.map((r) => r.severity)).toEqual(["ADDRESS", "ADDRESS", "ADDRESS"]);
            expect(record.guarantees).toEqual([]);
            expect(record.conceptChanges).toEqual([]);
        });
    });

    it("reads a body in neither format as nothing, for the caller to read whole", () => {
        expect(recordSections("# Decision Record: X\n\n## Summary\n\nA thing.\n")).toEqual({ format: "neither", decisions: [], guarantees: [], invariants: [], risks: [], conceptChanges: [] });
    });
});
