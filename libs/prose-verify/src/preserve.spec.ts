import { describe, expect, it } from "vitest";
import { comparePreservation, trackedTotal, type PreservationFinding } from "./preserve";

function labels(findings: readonly PreservationFinding[]): string[] {
    return findings.map((finding: PreservationFinding) => finding.label);
}

describe("comparePreservation — a faithful rewrite passes", () => {
    it("finds nothing when every tracked item survives", () => {
        const before = "The Nexus gate must hold at 95%, so the run reads epic.md.\n";
        const after = "The Nexus gate must hold at 95%. The run then reads epic.md.\n";
        expect(comparePreservation(before, after)).toEqual([]);
    });

    it("finds nothing when the two copies are identical", () => {
        const body = "The Nexus gate must hold at 95%.\n";
        expect(comparePreservation(body, body)).toEqual([]);
    });

    it("finds nothing in a body carrying no tracked item at all", () => {
        expect(comparePreservation("the gate holds\n", "the gate holds firm\n")).toEqual([]);
    });

    it("finds nothing when a numeral one is spelled out", () => {
        expect(comparePreservation("There is 1 copy.\n", "There is one copy.\n")).toEqual([]);
    });

    it("finds nothing when a spelled-out one becomes a numeral", () => {
        expect(comparePreservation("There is one copy.\n", "There is 1 copy.\n")).toEqual([]);
    });

    it("finds nothing when a pronoun one is replaced by the noun it stood for", () => {
        const before = "There are two copies of the record. One can go stale.\n";
        const after = "There are two copies of the record. The cached copy can go stale.\n";
        expect(comparePreservation(before, after)).toEqual([]);
    });
});

describe("comparePreservation — an item that did not survive", () => {
    it("names a numeric value the translation dropped, and the line it stood on", () => {
        const findings: PreservationFinding[] = comparePreservation(
            "intro\nCoverage is 95% of statements.\n",
            "intro\nCoverage is high.\n",
        );
        expect(findings).toHaveLength(1);
        expect(findings[0].kind).toBe("missing");
        expect(findings[0].item).toBe("numeric");
        expect(findings[0].label).toBe("95%");
        expect(findings[0].lines).toEqual([2]);
    });

    it("names a modal the translation weakened", () => {
        const findings: PreservationFinding[] = comparePreservation("The run must halt.\n", "The run should halt.\n");
        expect(labels(findings).sort()).toEqual(["must", "should"]);
    });

    it("treats a negated modal as its own item, so dropping the negation fails", () => {
        const findings: PreservationFinding[] = comparePreservation("The run must not proceed.\n", "The run must proceed.\n");
        expect(labels(findings).sort()).toEqual(["must", "must not"]);
    });

    it("names a tier-one token the translation lost", () => {
        const findings: PreservationFinding[] = comparePreservation(
            "It reads epic.md beside the entry.\n",
            "It reads the file beside the entry.\n",
        );
        expect(findings).toHaveLength(1);
        expect(findings[0].label).toBe("epic.md");
    });

    it("names a proper noun the translation lost", () => {
        const findings: PreservationFinding[] = comparePreservation(
            "the store is Nexus today\n",
            "the store is the store today\n",
        );
        expect(findings).toHaveLength(1);
        expect(findings[0].item).toBe("name");
        expect(findings[0].label).toBe("nexus");
    });

    it("fails when a repeated item survives at a lower count", () => {
        const findings: PreservationFinding[] = comparePreservation(
            "the gate holds Nexus. it holds Nexus again\n",
            "the gate holds Nexus again\n",
        );
        expect(findings).toHaveLength(1);
        expect(findings[0].kind).toBe("missing");
    });

    it("names every line a dropped item stood on", () => {
        const findings: PreservationFinding[] = comparePreservation(
            "the gate is Nexus\nthe store is Nexus\n",
            "the gate is a store\n",
        );
        expect(findings[0].lines).toEqual([1, 2]);
    });

    it("fails when the translation dropped a list item", () => {
        const findings: PreservationFinding[] = comparePreservation("- one\n- two\n", "- one and two\n");
        expect(findings).toHaveLength(1);
        expect(findings[0].item).toBe("list-item");
    });

    it("fails when the translation dropped a heading", () => {
        const findings: PreservationFinding[] = comparePreservation("## Phase\n\nprose\n", "prose\n");
        expect(findings).toHaveLength(1);
        expect(findings[0].item).toBe("heading");
    });

    it("fails when the translation dropped a table row", () => {
        const findings: PreservationFinding[] = comparePreservation("| a | b |\n| c | d |\n", "| a | b |\n");
        expect(findings).toHaveLength(1);
        expect(findings[0].item).toBe("table-row");
    });
});

describe("comparePreservation — an item the translation introduced", () => {
    it("fails and names the item when the run names no grounding source", () => {
        const findings: PreservationFinding[] = comparePreservation("the gate holds\n", "the gate holds at 95%\n");
        expect(findings).toHaveLength(1);
        expect(findings[0].kind).toBe("introduced");
        expect(findings[0].label).toBe("95%");
        expect(findings[0].lines).toEqual([1]);
    });

    it("permits an introduced item that appears in a named grounding source", () => {
        expect(comparePreservation("the gate holds\n", "the gate holds at 95%\n", ["coverage is 95% of statements\n"])).toEqual(
            [],
        );
    });

    it("permits an introduced item found in the second of several sources", () => {
        expect(comparePreservation("the gate holds\n", "the gate holds at 95%\n", ["nothing here\n", "95% of it\n"])).toEqual(
            [],
        );
    });

    it("fails and names the item when it appears in none of the named sources", () => {
        const findings: PreservationFinding[] = comparePreservation("the gate holds\n", "the gate holds at 95%\n", [
            "coverage is 90% of statements\n",
        ]);
        expect(findings).toHaveLength(1);
        expect(findings[0].kind).toBe("introduced");
    });

    it("permits an introduced proper noun a source names, wherever it stands in that source", () => {
        expect(comparePreservation("the gate holds\n", "the gate holds Postgres\n", ["Postgres stores the rows\n"])).toEqual(
            [],
        );
    });

    it("does not fail when an item already present is repeated more often", () => {
        expect(comparePreservation("the gate holds Nexus\n", "the gate holds Nexus. Nexus holds it\n")).toEqual([]);
    });
});

describe("comparePreservation — the equivalences the check must be blind to", () => {
    it("reports no change when a numeral becomes a word", () => {
        expect(comparePreservation("there are 40 words\n", "there are forty words\n")).toEqual([]);
    });

    it("reports no change when a word becomes a numeral", () => {
        expect(comparePreservation("coverage is ninety-five percent\n", "coverage is 95%\n")).toEqual([]);
    });

    it("reports no change when a name moves to the start of a sentence", () => {
        expect(comparePreservation("the store is Nexus and it holds\n", "the store is Nexus. Nexus holds\n")).toEqual([]);
    });

    it("reports no change when a repeated noun replaces a pronoun", () => {
        expect(comparePreservation("the Nexus store holds it\n", "the Nexus store holds the Nexus store\n")).toEqual([]);
    });

    it("reports no change when a sentence is split in two", () => {
        expect(
            comparePreservation("the gate must hold at 95%, so the run stops\n", "the gate must hold at 95%. So the run stops\n"),
        ).toEqual([]);
    });

    it("reports no change when the prose inside a list item is rewritten", () => {
        expect(comparePreservation("- the gate blocks the run\n", "- the gate blocks the run. it stops there\n")).toEqual([]);
    });
});

describe("comparePreservation — ordering", () => {
    it("orders two findings of the same class by the item they name", () => {
        const findings: PreservationFinding[] = comparePreservation(
            "the gate holds at 95% of 40 rows\n",
            "the gate holds\n",
        );
        expect(labels(findings)).toEqual(["40", "95%"]);
    });

    it("reports every missing item before every introduced one", () => {
        const findings: PreservationFinding[] = comparePreservation(
            "the gate holds at 95%\n",
            "the gate holds at 90%\n",
        );
        expect(findings.map((finding: PreservationFinding) => finding.kind)).toEqual(["missing", "introduced"]);
    });
});

describe("trackedTotal", () => {
    it("counts the tracked items a copy carries", () => {
        expect(trackedTotal("the gate must hold at 95%\n")).toBe(2);
    });

    it("counts a proper noun the copy names", () => {
        expect(trackedTotal("the store is Nexus\n")).toBe(1);
    });
});
