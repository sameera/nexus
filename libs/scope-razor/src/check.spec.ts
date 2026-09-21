import { describe, expect, it } from "vitest";
import { checkApplied, checkDraft, checkFiledSet, type RazorFinding } from "./check.js";
import { renderRazorFindings } from "./render.js";

/** Every story the draft declares, ordered as independent of each other — the ordering block is not what these tests are about. */
function orderingFor(stories: string): string[] {
    return [...stories.matchAll(/^### Story #?\d+: (.+?)(?: `\[[^\]]*\]`)?$/gm)].map((m: RegExpMatchArray) => `- **${m[1].trim()}** — blocked by: none`);
}

function draft(parts: { stories?: string; assumptions?: string[]; outOfScope?: string[]; personas?: string }): string {
    const stories: string =
        parts.stories ?? ["### Story 1: One `[inferred]`", "", "#### Acceptance Criteria", "", "- [ ] **Given** a, **when** b, **then** c `[inferred]`"].join("\n");
    return [
        "# Epic: A Capability",
        "",
        "## Personas",
        "",
        parts.personas ?? "Per `docs/product/context.md`.",
        "",
        "## Implementation Order",
        "",
        ...orderingFor(stories),
        "",
        "## User Stories",
        "",
        stories,
        "",
        "## Assumptions",
        "",
        ...(parts.assumptions ?? ["- one `[inferred]`"]),
        "",
        "## Out of Scope",
        "",
        ...(parts.outOfScope ?? ["- one `[inferred]`"]),
        "",
    ].join("\n");
}

const acs = (n: number): string[] => Array.from({ length: n }, (_, i) => `- [ ] **Given** a${i}, **when** b, **then** c \`[inferred]\``);
const story = (title: string, lines: string[]): string => ["### Story 1: " + title + " `[inferred]`", "", "#### Acceptance Criteria", "", ...lines].join("\n");
const blocking = (findings: RazorFinding[]): RazorFinding[] => findings.filter((f: RazorFinding) => f.severity === "blocking");

describe("a draft that meets every rule", () => {
    it("produces no finding at all", () => {
        expect(checkDraft(draft({}), "a capability the lead described")).toEqual([]);
    });

    it("produces no finding when every asked fragment resolves in the source text", () => {
        const body: string = draft({ assumptions: ['- sessions end on close `[asked: "sessions end on close"]`'] });
        expect(checkDraft(body, "the lead said sessions end on close, nothing more")).toEqual([]);
    });
});

describe("the counted limits", () => {
    it("blocks a story carrying six acceptance criteria with no stated reason, naming the story", () => {
        const found: RazorFinding[] = blocking(checkDraft(draft({ stories: story("Six", acs(6)) }), "src"));
        expect(found).toHaveLength(1);
        expect(found[0].where).toContain("Six");
        expect(found[0].message).toContain("6");
    });

    it("allows six acceptance criteria when the story states a reason", () => {
        const body: string = draft({ stories: story("Six", ["**Reason for six:** the two content rules resolve differently.", "", ...acs(6)]) });
        expect(blocking(checkDraft(body, "src"))).toEqual([]);
    });

    it("does not block a story carrying two acceptance criteria — no floor exists", () => {
        expect(blocking(checkDraft(draft({ stories: story("Two", acs(2)) }), "src"))).toEqual([]);
    });

    it("blocks an Assumptions section holding more than five items, naming the section", () => {
        const found: RazorFinding[] = blocking(checkDraft(draft({ assumptions: acs(6).map((_, i) => `- assumption ${i} \`[inferred]\``) }), "src"));
        expect(found).toHaveLength(1);
        expect(found[0].where).toContain("Assumptions");
    });

    it("blocks an Out of Scope section holding more than five items, with no stated-reason escape", () => {
        const items: string[] = ["**Reason for six:** because.", ...Array.from({ length: 6 }, (_, i) => `- excluded ${i} \`[inferred]\``)];
        const found: RazorFinding[] = blocking(checkDraft(draft({ outOfScope: items }), "src"));
        expect(found).toHaveLength(1);
        expect(found[0].where).toContain("Out of Scope");
    });

    it("does not block an empty Assumptions or Out of Scope section", () => {
        expect(blocking(checkDraft(draft({ assumptions: [], outOfScope: [] }), "src"))).toEqual([]);
    });
});

describe("the citation check", () => {
    it("blocks an asked item whose fragment is absent from the source text, naming the item", () => {
        const body: string = draft({ assumptions: ['- an air-gapped deployment `[asked: "an air-gapped deployment"]`'] });
        const found: RazorFinding[] = blocking(checkDraft(body, "the lead described a login screen"));
        expect(found).toHaveLength(1);
        expect(found[0].where).toContain("an air-gapped deployment");
    });

    it("blocks an asked item whose fragment is too short to mean anything", () => {
        const body: string = draft({ assumptions: ['- sessions end `[asked: "sessions end"]`'] });
        expect(blocking(checkDraft(body, "sessions end on close"))).toHaveLength(1);
    });
});

describe("the personas rule", () => {
    it("blocks a draft carrying a table under its personas heading", () => {
        const body: string = draft({ personas: ["| Persona | Need |", "|---|---|", "| Lead | ships |"].join("\n") });
        const found: RazorFinding[] = blocking(checkDraft(body, "src"));
        expect(found).toHaveLength(1);
        expect(found[0].where).toContain("Personas");
    });

    it("does not block a table that appears elsewhere in the draft", () => {
        const body: string = draft({ stories: story("One", [...acs(1), "", "| a | b |", "|---|---|"]) });
        expect(blocking(checkDraft(body, "src"))).toEqual([]);
    });
});

describe("the provenance rule", () => {
    it("blocks an acceptance criterion carrying no label, naming the story", () => {
        const body: string = draft({ stories: story("Unlabelled", ["- [ ] **Given** a, **when** b, **then** c"]) });
        const found: RazorFinding[] = blocking(checkDraft(body, "src"));
        expect(found).toHaveLength(1);
        expect(found[0].where).toContain("Unlabelled");
    });

    it("blocks an assumption carrying no label, naming the section", () => {
        const found: RazorFinding[] = blocking(checkDraft(draft({ assumptions: ["- sessions end on close"] }), "src"));
        expect(found).toHaveLength(1);
        expect(found[0].where).toContain("Assumptions");
    });

    it("blocks an out-of-scope item carrying no label", () => {
        const found: RazorFinding[] = blocking(checkDraft(draft({ outOfScope: ["- billing"] }), "src"));
        expect(found).toHaveLength(1);
        expect(found[0].where).toContain("Out of Scope");
    });

    it("accepts either value of the two-valued vocabulary", () => {
        const body: string = draft({ assumptions: ['- sessions end on close `[asked: "sessions end on close"]`', "- one `[inferred]`"] });
        expect(blocking(checkDraft(body, "the lead said sessions end on close"))).toEqual([]);
    });

    it("does not demand a label on the story's own prose or on a stated reason", () => {
        const body: string = draft({ stories: story("Six", ["**As a** lead, **I want** x, **so that** y.", "", "**Reason for six:** because.", "", ...acs(6)]) });
        expect(blocking(checkDraft(body, "src"))).toEqual([]);
    });

    it("reports every unlabelled item, not just the first", () => {
        const body: string = draft({ outOfScope: ["- billing", "- reporting"] });
        expect(blocking(checkDraft(body, "src"))).toHaveLength(2);
    });
});

describe("the draft-time ordering block", () => {
    const withOrder = (rows: string[], stories: string[]): string =>
        ["# Epic: Something", "", "## Implementation Order", "", ...rows, "", "## User Stories", "", ...stories, ""].join("\n");

    it("raises nothing when every story has a row and every blocker names a story", () => {
        const draft: string = withOrder(
            ["- **One** — blocked by: none", "- **Two** — blocked by: One"],
            ["### Story 1: One `[inferred]`", "", "### Story 2: Two `[inferred]`"],
        );
        expect(checkDraft(draft, "").filter((f: RazorFinding) => f.rule === "ordering")).toEqual([]);
    });

    it("blocks a story the ordering block never places, so the gate can always say what it waits on", () => {
        const draft: string = withOrder(["- **One** — blocked by: none"], ["### Story 1: One", "", "### Story 2: Two"]);
        const findings: RazorFinding[] = checkDraft(draft, "").filter((f: RazorFinding) => f.rule === "ordering");
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe("blocking");
        expect(findings[0].where).toBe("Two");
    });

    it("blocks a blocker name that matches no story in the draft", () => {
        const draft: string = withOrder(["- **One** — blocked by: A story nobody wrote"], ["### Story 1: One"]);
        const findings: RazorFinding[] = checkDraft(draft, "").filter((f: RazorFinding) => f.rule === "ordering");
        expect(findings).toHaveLength(1);
        expect(findings[0].message).toContain("A story nobody wrote");
    });

    it("blocks a row that places a story the draft does not have", () => {
        const draft: string = withOrder(
            ["- **One** — blocked by: none", "- **Ghost** — blocked by: One"],
            ["### Story 1: One `[inferred]`"],
        );
        expect(checkDraft(draft, "").filter((f: RazorFinding) => f.rule === "ordering" && f.where === "Ghost")).toHaveLength(1);
    });

    it("blocks a cycle, which no ordering can satisfy", () => {
        const draft: string = withOrder(
            ["- **One** — blocked by: Two", "- **Two** — blocked by: One"],
            ["### Story 1: One `[inferred]`", "", "### Story 2: Two `[inferred]`"],
        );
        expect(checkDraft(draft, "").some((f: RazorFinding) => f.rule === "ordering" && /cycle/i.test(f.message))).toBe(true);
    });

    it("raises nothing on a draft that declares no story, so the record and discovery stages are untouched", () => {
        expect(checkDraft("# Decision Record\n\n## Key Decisions\n\n- A thing `[inferred]`\n", "")).toEqual([]);
    });
});

describe("the smallest usable version, as a checked boundary", () => {
    const epic = (necessity: string, rows: string[], stories: string[]): string =>
        [
            "# Epic: Something",
            "",
            "## Implementation Order",
            "",
            ...rows,
            "",
            "## Smallest Usable Version",
            "",
            necessity,
            "",
            "## User Stories",
            "",
            ...stories,
            "",
        ].join("\n");

    const three: string[] = ["- **One** — blocked by: none", "- **Two** — blocked by: One", "- **Three** — blocked by: none"];
    const headings: string[] = ["### Story 1: One `[inferred]`", "", "### Story 2: Two `[inferred]`", "", "### Story 3: Three `[inferred]`"];
    const closure = (draft: string): RazorFinding[] => checkDraft(draft, "").filter((f: RazorFinding) => f.rule === "closure");

    it("raises no finding when the named set needs nothing outside itself", () => {
        expect(closure(epic("One; Two", three, headings))).toEqual([]);
    });

    it("blocks when the named set holds a story that waits on an excluded one, and names both", () => {
        const findings: RazorFinding[] = closure(epic("Two", three, headings));
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe("blocking");
        expect(findings[0].where).toBe("Two");
        expect(findings[0].message).toContain("One");
    });

    it("blocks when the named set holds a story the draft does not have", () => {
        const findings: RazorFinding[] = closure(epic("One; A story nobody wrote", three, headings));
        expect(findings).toHaveLength(1);
        expect(findings[0].message).toContain("A story nobody wrote");
    });

    it("raises nothing on a draft that carries no smallest-usable-version section at all", () => {
        const draft: string = ["# Epic: Something", "", "## Implementation Order", "", ...three, "", "## User Stories", "", ...headings, ""].join("\n");
        expect(closure(draft)).toEqual([]);
    });

    it("adds no minimum-count rule — an empty answer is not a finding of its own", () => {
        expect(closure(epic("", three, headings))).toEqual([]);
    });
});

describe("the closure rule applied to a set approved for filing", () => {
    const entries = [
        { title: "One", blockedBy: [] },
        { title: "Two", blockedBy: ["One"] },
    ];

    it("blocks an approved set that waits on a story it leaves out, naming both", () => {
        const findings: RazorFinding[] = checkFiledSet(entries, ["Two"]);
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe("blocking");
        expect(findings[0].where).toBe("Two");
        expect(findings[0].message).toContain("One");
    });

    it("passes a set that is closed under its blockers", () => {
        expect(checkFiledSet(entries, ["One", "Two"])).toEqual([]);
    });
});

describe("the report a stopped run hands its author", () => {
    it("names the draft as well as the story at fault, not only that the check failed", () => {
        const findings: RazorFinding[] = checkFiledSet([{ title: "Two", blockedBy: ["One"] }], ["Two"]);
        const report: string = renderRazorFindings("scratch/epic.md", findings);
        expect(report).toContain("scratch/epic.md");
        expect(report).toContain("Two");
        expect(report).toContain("One");
    });
});

describe("the provenance label on a story heading", () => {
    const epic = (heading: string): string =>
        ["# Epic: Something", "", "## Implementation Order", "", "- **One** — blocked by: none", "", "## User Stories", "", heading, ""].join("\n");

    it("blocks a story heading that carries no label, the way an unlabelled criterion does", () => {
        const findings: RazorFinding[] = checkDraft(epic("### Story 1: One"), "").filter((f: RazorFinding) => f.rule === "provenance-label");
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe("blocking");
        expect(findings[0].where).toContain("One");
    });

    it("accepts a labelled heading", () => {
        expect(checkDraft(epic("### Story 1: One `[inferred]`"), "").filter((f: RazorFinding) => f.rule === "provenance-label")).toEqual([]);
    });

    it("checks the heading's asked fragment against the source text like any other citation", () => {
        const body: string = epic('### Story 1: One `[asked: "a thing the lead never said"]`');
        expect(checkDraft(body, "the lead asked for something else entirely").some((f: RazorFinding) => f.rule === "citation")).toBe(true);
    });
});

describe("the apply-time arm, over the set the reviewer approved", () => {
    const draft: string = [
        "---",
        'epic: "Reporting"',
        "complexity: M",
        "complexity_drivers: [two services]",
        "---",
        "",
        "## Implementation Order",
        "",
        "- **One** — blocked by: none",
        "- **Two** — blocked by: One",
        "",
        "## Smallest Usable Version",
        "",
        "One",
        "",
        "## User Stories",
        "",
        "### Story 1: One `[inferred]`",
        "",
        "- **size:** S",
        "",
        "### Story 2: Two `[inferred]`",
        "",
        "- **size:** M",
        "",
    ].join("\n");

    it("blocks an addition whose blocker the reviewer did not also take", () => {
        const findings: RazorFinding[] = checkApplied(draft, ["Two"]).filter((f: RazorFinding) => f.rule === "closure");
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe("blocking");
        expect(findings[0].where).toBe("Two");
        expect(findings[0].message).toContain("One");
    });

    it("blocks a selection naming a story the draft does not hold", () => {
        const findings: RazorFinding[] = checkApplied(draft, ["One", "Telemetry"]);
        expect(findings.some((f: RazorFinding) => f.message.includes("Telemetry"))).toBe(true);
    });

    it("passes the approved set the smallest usable version alone leaves closed", () => {
        expect(checkApplied(draft.replace("complexity: M", "complexity: S").replace("complexity_drivers: [two services]", "complexity_drivers: []"), ["One"])).toEqual([]);
    });

    it("blocks a rollup left below the largest size in the filed set", () => {
        const findings: RazorFinding[] = checkApplied(draft.replace("complexity: M", "complexity: S"), ["One", "Two"]).filter((f: RazorFinding) => f.rule === "rollup");
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe("blocking");
        expect(findings[0].message).toContain("M");
    });

    it("blocks a rollup left above the filed set with nothing stated to raise it", () => {
        const stale: string = draft.replace("complexity: M", "complexity: L").replace("complexity_drivers: [two services]", "complexity_drivers: []");
        const findings: RazorFinding[] = checkApplied(stale, ["One"]).filter((f: RazorFinding) => f.rule === "rollup");
        expect(findings).toHaveLength(1);
        expect(findings[0].message).toContain("complexity_drivers");
    });

    it("permits a rollup above the floor when the drivers state what raises it", () => {
        expect(checkApplied(draft.replace("complexity: M", "complexity: L"), ["One", "Two"]).filter((f: RazorFinding) => f.rule === "rollup")).toEqual([]);
    });

    it("blocks a filed story that states no size, because nothing can be re-derived from it", () => {
        const unsized: string = draft.replace("### Story 2: Two `[inferred]`\n\n- **size:** M", "### Story 2: Two `[inferred]`\n");
        const findings: RazorFinding[] = checkApplied(unsized, ["One", "Two"]).filter((f: RazorFinding) => f.rule === "rollup");
        expect(findings.some((f: RazorFinding) => f.where === "Two")).toBe(true);
    });
});

describe("a decision-record draft, whose third-level headings are decisions and not stories", () => {
    const record = (decisions: string[], invariants: string[] = ["1. Sessions end on close `[inferred]`"]): string =>
        ["# Decision Record: A Capability", "", "## Key Decisions", "", ...decisions, "", "## Constraints & Invariants", "", ...invariants, ""].join("\n");

    const decision = (title: string, lines: string[] = ["- **Decision:** the checker adopts one definition.", "- **Why:** one idea of a story, not two."]): string[] => [
        `### ${title}`,
        "",
        ...lines,
    ];

    it("raises no provenance-label finding for a decision, which the razor forbids labelling", () => {
        const body: string = record([...decision("The story check adopts the ordering check's definition"), "", ...decision("The ordering block dies at filing")]);
        expect(checkDraft(body, "src")).toEqual([]);
    });

    it("still reports a quoted fragment that is not in the run's source text", () => {
        const body: string = record(decision("The queue entry is born at close"), ['1. An air-gapped deployment `[asked: "an air-gapped deployment"]`']);
        const found: RazorFinding[] = blocking(checkDraft(body, "the lead described a login screen"));
        expect(found).toHaveLength(1);
        expect(found[0].rule).toBe("citation");
        expect(found[0].where).toContain("air-gapped deployment");
    });

    it("does not apply the acceptance-criteria ceiling to a heading that declares no story", () => {
        const body: string = record(decision("A decision that lists its follow-ups", acs(6)));
        expect(blocking(checkDraft(body, "src"))).toEqual([]);
    });
});

describe("an epic draft, whose third-level headings are stories", () => {
    it("still blocks a story heading carrying no provenance label, naming the story", () => {
        const body: string = draft({ stories: ["### Story 1: Unlabelled", "", "#### Acceptance Criteria", "", ...acs(1)].join("\n") });
        const found: RazorFinding[] = blocking(checkDraft(body, "src")).filter((f: RazorFinding) => f.rule === "provenance-label");
        expect(found).toHaveLength(1);
        expect(found[0].where).toContain("Unlabelled");
    });

    it("still blocks an unlabelled acceptance criterion and the ceiling, under an issue-numbered story heading", () => {
        const body: string = draft({
            stories: ["### Story #760: Numbered `[inferred]`", "", "#### Acceptance Criteria", "", ...acs(6), "- [ ] **Given** a, **when** b, **then** c"].join("\n"),
        });
        const found: RazorFinding[] = blocking(checkDraft(body, "src"));
        expect(found.filter((f: RazorFinding) => f.rule === "provenance-label")).toHaveLength(1);
        expect(found.filter((f: RazorFinding) => f.rule === "acceptance-criteria-ceiling")).toHaveLength(1);
    });
});
