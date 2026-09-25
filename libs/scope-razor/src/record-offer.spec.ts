import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { recordChecklist, type RecordChecklistItem } from "./record-offer.js";

const NEW: string = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__", "record-new.labelled.md"), "utf8");

const DRAFT: string = [
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
    "- **Why:** the labels live there.",
    "- **Refuted alternative:** have the architect return its own list — it loses on single-source provenance.",
    "",
    "### The mechanical half moves into the checker",
    "",
    "- **Decision:** extend the checklist builder.",
    "- **Why:** a hand render cannot be pinned by a test.",
    "- **Refuted alternative:** change only the prompt — it loses on verifiability.",
    "",
    "### The ticks are unchanged",
    "",
    "- **Decision:** keep the removal convention.",
    "- **Why:** the razor page already settles it.",
    "",
    "## Constraints & Invariants",
    "",
    '1. Every model-added invariant appears on the list `[inferred]`',
    '2. The numbering runs as one sequence from one `[asked: "one typed number means the same thing"]`',
    "3. A flip edits the labelled draft before the filing body is derived `[inferred]`",
    "",
    "## Risks (BLOCKER / ADDRESS only)",
    "",
    "- **ADDRESS — a label claiming the lead asked for an invariant hides it:** mark the claim. `[inferred]`",
    '- **BLOCKER — the installed executable is older than the components:** stop on the diagnostic. `[asked: "the components and the executable ship in one package"]`',
    "",
].join("\n");

const items: RecordChecklistItem[] = recordChecklist(DRAFT);
const texts = (kind: RecordChecklistItem["kind"]): string[] => items.filter((item: RecordChecklistItem) => item.kind === kind).map((item: RecordChecklistItem) => item.text);

describe("the record checkpoint's checklist", () => {
    it("lists every invariant the model added, each as its own line", () => {
        expect(texts("invariant")).toEqual(["Every model-added invariant appears on the list", "A flip edits the labelled draft before the filing body is derived"]);
    });

    it("lists every risk the model added, each as its own line", () => {
        expect(texts("risk")).toEqual(["**ADDRESS — a label claiming the lead asked for an invariant hides it:** mark the claim."]);
    });

    it("lists no invariant and no risk the lead asked for, in any form", () => {
        const listed: string = items.map((item: RecordChecklistItem) => item.text).join("\n");
        expect(listed).not.toContain("The numbering runs as one sequence");
        expect(listed).not.toContain("the installed executable is older");
    });

    it("lists every refuted alternative under the decision it belongs to", () => {
        const alternatives: RecordChecklistItem[] = items.filter((item: RecordChecklistItem) => item.kind === "alternative");
        expect(alternatives.map((item: RecordChecklistItem) => item.parent)).toEqual(["The list is a render over the draft", "The mechanical half moves into the checker"]);
        expect(alternatives[0].text).toContain("have the architect return its own list");
    });

    it("leaves a decision that refutes nothing off the list entirely", () => {
        expect(items.map((item: RecordChecklistItem) => item.parent)).not.toContain("The ticks are unchanged");
    });

    it("numbers the whole list as one sequence from one, across every kind it holds", () => {
        expect(items.map((item: RecordChecklistItem) => item.number)).toEqual([1, 2, 3, 4, 5]);
        expect(items.map((item: RecordChecklistItem) => item.kind)).toEqual(["alternative", "alternative", "invariant", "invariant", "risk"]);
    });

    it("strips the provenance label off every line it renders, since the label is not the reviewer's to read", () => {
        expect(items.map((item: RecordChecklistItem) => item.text).join("\n")).not.toMatch(/\[inferred\]|\[asked:/);
    });

    it("holds nothing for a record that states no decision, no invariant and no risk", () => {
        expect(recordChecklist("# Decision Record: Empty\n\n## Summary\n\nNothing.\n")).toEqual([]);
    });
});

describe("the ticks the record checklist arrives with", () => {
    it("ticks every line, since a plain approval files the record minus nothing", () => {
        expect(items.every((item: RecordChecklistItem) => item.filed)).toBe(true);
    });

    it("marks no line frozen when the run has no approved body to compare against", () => {
        expect(items.some((item: RecordChecklistItem) => item.frozen)).toBe(false);
    });
});

describe("a line whose content an approved record already carries", () => {
    const approved: string = [
        "# Decision Record: Something",
        "",
        "## Constraints & Invariants",
        "",
        "1. Every model-added invariant appears on the list",
        "",
    ].join("\n");
    const frozen: RecordChecklistItem[] = recordChecklist(DRAFT, approved);
    const carried = (text: string): RecordChecklistItem => {
        const found: RecordChecklistItem | undefined = frozen.find((item: RecordChecklistItem) => item.text === text);
        if (found === undefined) throw new Error(`the checklist lists no line called ${text}`);
        return found;
    };

    it("marks the line as frozen, so the reviewer reads that before they type its number", () => {
        expect(carried("Every model-added invariant appears on the list").frozen).toBe(true);
    });

    it("leaves a line the approved body does not carry flippable", () => {
        expect(carried("A flip edits the labelled draft before the filing body is derived").frozen).toBe(false);
    });

    it("still ticks a frozen line, because a plain approval files the record as drafted", () => {
        expect(carried("Every model-added invariant appears on the list").filed).toBe(true);
    });

    it("compares the way the citation check does, so retyped quotes and spacing do not decide it", () => {
        const retyped: string = "1.  Every  model-added invariant appears on the LIST";
        expect(recordChecklist(DRAFT, retyped).find((item: RecordChecklistItem) => item.kind === "invariant")?.frozen).toBe(true);
    });

    it("freezes nothing when the approved body is absent, which is an epic with no record yet", () => {
        expect(recordChecklist(DRAFT, undefined).some((item: RecordChecklistItem) => item.frozen)).toBe(false);
    });
});

describe("the checklist of a new-format record (epic #787, story #789)", () => {
    const listed: RecordChecklistItem[] = recordChecklist(NEW);
    const of = (kind: RecordChecklistItem["kind"]): RecordChecklistItem[] => listed.filter((item: RecordChecklistItem) => item.kind === kind);

    it("lists every refuted alternative under its decision, two under a decision that refutes two", () => {
        expect(of("alternative").map((item: RecordChecklistItem) => item.parent)).toEqual([
            "D1 — A new function and a new provider",
            "D2 — Match in the store, keyed by the batch's own values",
            "D2 — Match in the store, keyed by the batch's own values",
        ]);
        expect(of("alternative")[2].text).toMatch(/^Query per value from inside the function/);
    });

    it("lists no alternative written as `none`, since `none` states that there was none", () => {
        expect(listed.map((item: RecordChecklistItem) => item.parent)).not.toContain("D3 — No match yields the empty value");
        expect(listed.some((item: RecordChecklistItem) => /^none$/i.test(item.text))).toBe(false);
    });

    it("lists every model-added guarantee from every group, Existing behaviour to preserve included", () => {
        expect(of("guarantee").map((item: RecordChecklistItem) => item.text.slice(0, 3))).toEqual(["G1.", "G3.", "G4."]);
        expect(of("guarantee").map((item: RecordChecklistItem) => item.parent)).toEqual(["Tenant boundary", "Fetching and cost", "Existing behaviour to preserve"]);
    });

    it("lists every model-added risk, and no line of the Approval brief", () => {
        expect(of("risk").map((item: RecordChecklistItem) => item.text.slice(0, 2))).toEqual(["R1", "R3"]);
        expect(listed.some((item: RecordChecklistItem) => item.text.startsWith("D1."))).toBe(false);
    });

    it("lists no guarantee and no risk the lead asked for", () => {
        const texts: string = listed.map((item: RecordChecklistItem) => item.text).join("\n");
        expect(texts).not.toMatch(/G2\.|G5\.|R2 ADDRESS/);
    });

    it("lists no invariant, since the new format has none", () => {
        expect(of("invariant")).toEqual([]);
    });

    it("numbers alternatives, guarantees and risks as one ticked sequence from one", () => {
        expect(listed.map((item: RecordChecklistItem) => item.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
        expect(listed.map((item: RecordChecklistItem) => item.kind)).toEqual(["alternative", "alternative", "alternative", "guarantee", "guarantee", "guarantee", "risk", "risk"]);
        expect(listed.every((item: RecordChecklistItem) => item.filed)).toBe(true);
    });

    it("strips the provenance label off every guarantee and risk it lists", () => {
        expect(listed.map((item: RecordChecklistItem) => item.text).join("\n")).not.toMatch(/\[inferred\]|\[asked:/);
    });

    it("marks a guarantee the approved record already carries as frozen, and leaves the rest flippable", () => {
        const approved: string = "## Guarantees\n\n### Fetching and cost\n\n- G3. Query never contacts the database while a record is being mapped. (D2)\n";
        const frozen: RecordChecklistItem[] = recordChecklist(NEW, approved);
        expect(frozen.filter((item: RecordChecklistItem) => item.frozen).map((item: RecordChecklistItem) => item.text.slice(0, 3))).toEqual(["G3."]);
        expect(frozen.every((item: RecordChecklistItem) => item.filed)).toBe(true);
    });
});
