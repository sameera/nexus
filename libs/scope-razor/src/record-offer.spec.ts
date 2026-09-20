import { describe, expect, it } from "vitest";
import { recordChecklist, type RecordChecklistItem } from "./record-offer.js";

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
