import { describe, expect, it } from "vitest";
import { deriveFilingBody, stripLabels, survivingTokens, type Finding } from "./labels.js";

describe("stripping provenance labels to derive a filing body", () => {
    it("removes an asked label and its quoted fragment, leaving the item", () => {
        expect(stripLabels(`- The user can log out \`[asked: "the user can log out"]\``)).toBe("- The user can log out");
    });

    it("removes an inferred label, leaving the item", () => {
        expect(stripLabels("- Sessions expire after a day `[inferred]`")).toBe("- Sessions expire after a day");
    });

    it("removes a label written without backticks", () => {
        expect(stripLabels("- Sessions expire after a day [inferred]")).toBe("- Sessions expire after a day");
    });

    it("leaves every other line of the draft byte-identical", () => {
        const draft: string = ["# Epic: Something", "", "- One `[inferred]`", "", "## Notes", "A sentence with [brackets] in it."].join("\n");
        expect(stripLabels(draft)).toBe(["# Epic: Something", "", "- One", "", "## Notes", "A sentence with [brackets] in it."].join("\n"));
    });

    it("removes every label on a line that carries more than one", () => {
        expect(stripLabels("- One `[inferred]` and two `[asked: \"and two\"]`")).toBe("- One and two");
    });
});

describe("asserting a derived body carries no provenance label", () => {
    it("reports nothing for a body with no label", () => {
        expect(survivingTokens("- The user can log out\n- Sessions expire\n")).toEqual([]);
    });

    it("names the line and the token of a surviving asked label", () => {
        const found: Finding[] = survivingTokens("# Epic\n\n- One `[asked: \"one thing\"]`\n");
        expect(found).toHaveLength(1);
        expect(found[0].line).toBe(3);
        expect(found[0].token).toContain("asked");
    });

    it("names every surviving label, not just the first", () => {
        expect(survivingTokens("- One `[inferred]`\n- Two `[inferred]`\n").map((f: Finding) => f.line)).toEqual([1, 2]);
    });

    it("does not report ordinary bracketed prose as a label", () => {
        expect(survivingTokens("A sentence with [brackets] and [NEEDS CLARIFICATION: x] in it.")).toEqual([]);
    });
});

describe("asserting a derived body carries no template placeholder token", () => {
    it("names an unreplaced placeholder the template shipped", () => {
        const found: Finding[] = survivingTokens("- **Why:** {{RATIONALE}}\n");
        expect(found).toHaveLength(1);
        expect(found[0].line).toBe(1);
        expect(found[0].kind).toBe("placeholder");
        expect(found[0].token).toBe("{{RATIONALE}}");
    });

    it("names every placeholder on a line that carries more than one", () => {
        expect(survivingTokens("rating: {{S|M|L|XL}} date: {{YYYY-MM-DD}}\n")).toHaveLength(2);
    });

    it("does not report ordinary braced prose as a placeholder", () => {
        expect(survivingTokens("The shell writes ${DRAFT_DIR}/epic.md and { one brace } here.")).toEqual([]);
    });
});

describe("asserting a derived body carries no observation marker", () => {
    it("names the razor's observation marker where a render leaked into the body", () => {
        const found: Finding[] = survivingTokens("- **Refuted alternative:** a queue\n   ⚠️ razor: names no trade-off\n");
        expect(found).toHaveLength(1);
        expect(found[0].line).toBe(2);
        expect(found[0].kind).toBe("observation");
    });

    it("leaves a body's own warning callout alone, so a risk banner still files", () => {
        expect(survivingTokens("> ⚠️ **Utilization risk:** assessed L (1–2 weeks).")).toEqual([]);
    });
});

describe("the three token classes are asserted together", () => {
    it("reports a label, a placeholder and an observation from one body, in reading order", () => {
        const body: string = ["- One `[inferred]`", "- **Why:** {{RATIONALE}}", "   ⚠️ razor: names no trade-off"].join("\n");
        expect(survivingTokens(body).map((f: Finding) => f.kind)).toEqual(["label", "placeholder", "observation"]);
    });
});

describe("asserting a derived body carries none of this run's local asset paths (epic #594)", () => {
    it("reports a declared path that survived, naming its line, and nothing when none was declared", () => {
        const body: string = "# Epic\n\n![flow](assets/flow.png)\n";
        expect(survivingTokens(body)).toEqual([]);
        expect(survivingTokens(body, ["assets/flow.png"])).toEqual([{ line: 3, kind: "asset-path", token: "assets/flow.png" }]);
    });

    it("matches the declared path exactly, so a body's own repository-relative paths are not findings", () => {
        const body: string = "See docs/features/x/README.md and assets/flow-v2.png.\n";
        expect(survivingTokens(body, ["assets/flow.png"])).toEqual([]);
        expect(survivingTokens("a rewritten https://github.com/acme/assets/blob/c1/features/f/flow.png?raw=true\n", ["assets/flow.png"])).toEqual([]);
        // The published address of this very asset, under a feature whose slug ends in "assets".
        expect(survivingTokens("![f](https://github.com/acme/assets/blob/c1/features/issue-assets/flow.png?raw=true)\n", ["assets/flow.png"])).toEqual([]);
    });
});

describe("deriving the filing body", () => {
    const draft: string = [
        "# Epic: Something",
        "",
        "## Implementation Order",
        "",
        "- **One** — blocked by: none",
        "- **Two** — blocked by: One",
        "",
        "## User Stories",
        "",
        '### Story 1: One `[asked: "the first thing"]`',
        "",
    ].join("\n");

    it("removes the draft-level ordering block, which the native dependency edges own after filing", () => {
        const filed: string = deriveFilingBody(draft);
        expect(filed).not.toContain("Implementation Order");
        expect(filed).not.toContain("blocked by:");
    });

    it("keeps the sections on either side of the block, and the story it stripped the label off", () => {
        const filed: string = deriveFilingBody(draft);
        expect(filed).toContain("# Epic: Something");
        expect(filed).toContain("## User Stories");
        expect(filed).toContain("### Story 1: One");
        expect(filed).not.toContain("[asked:");
    });

    it("leaves a draft that carries no ordering block unchanged apart from its labels", () => {
        expect(deriveFilingBody("## Notes\n\n- A thing `[inferred]`")).toBe("## Notes\n\n- A thing");
    });
});

describe("the assertion over a body about to be filed", () => {
    it("reports a surviving ordering block, so the draft-time graph cannot reach an issue", () => {
        const findings: Finding[] = survivingTokens("# Epic\n\n## Implementation Order\n\n- **One** — blocked by: none\n");
        expect(findings.map((f: Finding) => f.kind)).toContain("ordering");
        expect(findings.find((f: Finding) => f.kind === "ordering")?.line).toBe(3);
    });

    it("reports a surviving ordering row even where the heading was removed by hand", () => {
        expect(survivingTokens("- **One** — blocked by: none").map((f: Finding) => f.kind)).toEqual(["ordering"]);
    });

    it("says nothing about a body that carries neither a label nor a graph", () => {
        expect(survivingTokens("# Epic\n\n## User Stories\n\n### Story 1: One\n")).toEqual([]);
    });
});
