import { describe, expect, it } from "vitest";
import { checkDraft, type RazorFinding } from "./check.js";

function draft(parts: { stories?: string; assumptions?: string[]; outOfScope?: string[]; personas?: string }): string {
    return [
        "# Epic: A Capability",
        "",
        "## Personas",
        "",
        parts.personas ?? "Per `docs/product/context.md`.",
        "",
        "## User Stories",
        "",
        parts.stories ?? ["### Story 1: One", "", "#### Acceptance Criteria", "", "- [ ] **Given** a, **when** b, **then** c"].join("\n"),
        "",
        "## Assumptions",
        "",
        ...(parts.assumptions ?? ["- one"]),
        "",
        "## Out of Scope",
        "",
        ...(parts.outOfScope ?? ["- one"]),
        "",
    ].join("\n");
}

const acs = (n: number): string[] => Array.from({ length: n }, (_, i) => `- [ ] **Given** a${i}, **when** b, **then** c`);
const story = (title: string, lines: string[]): string => ["### Story 1: " + title, "", "#### Acceptance Criteria", "", ...lines].join("\n");
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
        const found: RazorFinding[] = blocking(checkDraft(draft({ assumptions: acs(6).map((_, i) => `- assumption ${i}`) }), "src"));
        expect(found).toHaveLength(1);
        expect(found[0].where).toContain("Assumptions");
    });

    it("blocks an Out of Scope section holding more than five items, with no stated-reason escape", () => {
        const items: string[] = ["**Reason for six:** because.", ...Array.from({ length: 6 }, (_, i) => `- excluded ${i}`)];
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
