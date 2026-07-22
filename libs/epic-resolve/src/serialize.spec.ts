import { describe, expect, it } from "vitest";
import { serializeEpic, type SerializeInput } from "./serialize.js";

const EPIC_BODY = [
    "# Epic: Sample",
    "",
    "## Description",
    "",
    "What it does.",
    "",
    "## Personas",
    "",
    "Per context.",
    "",
    "## Assumptions",
    "",
    "- an assumption",
    "",
    "## Out of Scope",
    "",
    "- excluded",
].join("\n");

function input(overrides: Partial<SerializeInput> = {}): SerializeInput {
    return {
        epic: { number: 115, title: "Sample", body: EPIC_BODY },
        stories: [
            { number: 116, title: "First story", body: "**As a** dev **I want** X.\n\n## Acceptance Criteria\n- [ ] a" },
            { number: 117, title: "Second story", body: "**As a** dev **I want** Y." },
        ],
        blockedBy: new Map([
            [116, []],
            [117, [116]],
        ]),
        ...overrides,
    };
}

describe("serializeEpic — frontmatter", () => {
    it("emits only the recoverable keys (epic title + link), never fabricated fields", () => {
        const md = serializeEpic(input());
        expect(md.startsWith("---\n")).toBe(true);
        expect(md).toContain('epic: "Sample"');
        expect(md).toContain('link: "#115"');
        // The filing skills strip these; the resolver must not invent them (§3 conflict).
        for (const key of ["complexity:", "feature_path:", "slug:", "complexity_drivers:", "concepts:"]) {
            expect(md).not.toContain(`\n${key}`);
        }
    });

    it("escapes a title containing quotes", () => {
        const md = serializeEpic(input({ epic: { number: 1, title: 'A "quoted" epic', body: "# Epic: x" } }));
        expect(md).toContain('epic: "A \\"quoted\\" epic"');
    });

    it("round-trips the raw meta frontmatter verbatim when present, resetting only link", () => {
        const raw = 'feature: "MRW"\nslug: mrw\ncomplexity: L\nconcepts: ["a", "b"]\nlink: ""';
        const md = serializeEpic(input({ epic: { number: 115, title: "Sample", body: EPIC_BODY, rawFrontmatter: raw } }));
        expect(md).toContain('feature: "MRW"');
        expect(md).toContain("slug: mrw");
        expect(md).toContain("complexity: L");
        expect(md).toContain('concepts: ["a", "b"]');
        expect(md).toContain('link: "#115"');
        expect(md).not.toContain('link: ""');
    });
});

describe("serializeEpic — section placement", () => {
    it("inserts ## User Stories after Personas and before Assumptions", () => {
        const md = serializeEpic(input());
        const personas = md.indexOf("## Personas");
        const stories = md.indexOf("## User Stories");
        const assumptions = md.indexOf("## Assumptions");
        expect(personas).toBeGreaterThan(-1);
        expect(stories).toBeGreaterThan(personas);
        expect(assumptions).toBeGreaterThan(stories);
    });

    it("appends ## User Stories when no anchor section exists", () => {
        const md = serializeEpic(input({ epic: { number: 115, title: "Sample", body: "# Epic: Sample\n\n## Description\n\nD." } }));
        expect(md.indexOf("## User Stories")).toBeGreaterThan(md.indexOf("## Description"));
    });

    it("does not split a fenced code block that contains a ## line", () => {
        const body = "# Epic: X\n\n## Notes\n\n```md\n## Not A Heading\n```\n\n## Assumptions\n\n- a";
        const md = serializeEpic(input({ epic: { number: 1, title: "X", body } }));
        // The fenced `## Not A Heading` stays inside Notes; User Stories lands before Assumptions.
        expect(md).toContain("```md\n## Not A Heading\n```");
        expect(md.indexOf("## User Stories")).toBeLessThan(md.indexOf("## Assumptions"));
    });
});

describe("serializeEpic — user stories", () => {
    it("renders one ### Story heading per story in ascending-number order with its body", () => {
        const md = serializeEpic(input());
        expect(md).toContain("### Story 1: First story");
        expect(md).toContain("### Story 2: Second story");
        expect(md.indexOf("### Story 1:")).toBeLessThan(md.indexOf("### Story 2:"));
        expect(md).toContain("**As a** dev **I want** X.");
    });

    it("renders a heading-only story when its body is empty", () => {
        const md = serializeEpic(
            input({ stories: [{ number: 116, title: "Bodyless", body: "  \n  " }], blockedBy: new Map([[116, []]]) }),
        );
        expect(md).toContain("### Story 1: Bodyless");
    });
});

describe("serializeEpic — implementation sequence (AC4)", () => {
    it("reproduces every blocked_by edge as story refs, inventing none", () => {
        const md = serializeEpic(input());
        expect(md).toContain("| STORY | Issue | blocked_by |");
        expect(md).toContain("| STORY-115.01 | #116 | none |");
        expect(md).toContain("| STORY-115.02 | #117 | STORY-115.01 |");
    });

    it("renders `none` for every story when there are no dependencies", () => {
        const md = serializeEpic(input({ blockedBy: new Map([[116, []], [117, []]]) }));
        const seqStart = md.indexOf("## Implementation Sequence");
        const seq = md.slice(seqStart);
        expect(seq).toContain("| STORY-115.01 | #116 | none |");
        expect(seq).toContain("| STORY-115.02 | #117 | none |");
        expect(seq).not.toMatch(/blocked_by \|\n\|---.*\n.*STORY-115\.0\d.*STORY-115/);
    });

    it("renders an out-of-epic blocker as its raw issue ref, still not inventing an in-epic edge", () => {
        const md = serializeEpic(input({ blockedBy: new Map([[116, [999]], [117, [116]]]) }));
        expect(md).toContain("| STORY-115.01 | #116 | #999 |");
        expect(md).toContain("| STORY-115.02 | #117 | STORY-115.01 |");
    });

    it("drops a stale Implementation Sequence baked into the epic body and rebuilds from live deps", () => {
        const staleBody = EPIC_BODY + "\n\n## Implementation Sequence\n\n| STORY | Issue | blocked_by |\n|---|---|---|\n| STORY-115.01 | #116 | STORY-115.02 |";
        const md = serializeEpic(input({ epic: { number: 115, title: "Sample", body: staleBody } }));
        expect(md.match(/## Implementation Sequence/g)?.length).toBe(1);
        expect(md).toContain("| STORY-115.02 | #117 | STORY-115.01 |"); // live edge, not the stale reversed one
    });
});

describe("serializeEpic — determinism (AC2)", () => {
    it("is byte-identical across repeated calls on the same input", () => {
        expect(serializeEpic(input())).toBe(serializeEpic(input()));
    });

    it("is independent of the stories' input order", () => {
        const forward = serializeEpic(input());
        const reversed = serializeEpic(
            input({
                stories: [
                    { number: 117, title: "Second story", body: "**As a** dev **I want** Y." },
                    { number: 116, title: "First story", body: "**As a** dev **I want** X.\n\n## Acceptance Criteria\n- [ ] a" },
                ],
            }),
        );
        expect(reversed).toBe(forward);
    });

    it("emits no volatile field (timestamp / run id / createdAt)", () => {
        const md = serializeEpic(input());
        expect(md).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/); // ISO timestamp
        expect(md).not.toMatch(/createdAt|updatedAt|run[-_]?id/i);
    });
});
