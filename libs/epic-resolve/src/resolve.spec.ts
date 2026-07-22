import { describe, expect, it } from "vitest";
import { makeGhRunner, type FixtureGraph } from "./gh-fixtures.js";
import { resolveEpic } from "./resolve.js";

const BODY = "# Epic: Planning\n\n## Description\n\nDo the thing.\n\n## Assumptions\n\n- one";

function graph(): FixtureGraph {
    return {
        epic: { number: 115, title: "Planning", body: BODY },
        stories: [
            { number: 116, title: "Resolver", body: "**As a** stage **I want** X.", blockedBy: [] },
            { number: 117, title: "Planning files", body: "**As a** PM **I want** Y.", blockedBy: [116] },
            { number: 118, title: "From flag", body: "**As an** engineer **I want** Z.", blockedBy: [116] },
        ],
    };
}

describe("resolveEpic — AC1: all-or-nothing over N stories", () => {
    it("emits one epic with all N stories and the live dependency table", () => {
        const r = resolveEpic(makeGhRunner(graph()), "/repo", 115);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.markdown).toContain("### Story 1: Resolver");
        expect(r.markdown).toContain("### Story 2: Planning files");
        expect(r.markdown).toContain("### Story 3: From flag");
        expect(r.markdown).toContain("| STORY-115.02 | #117 | STORY-115.01 |");
        expect(r.markdown).toContain("| STORY-115.03 | #118 | STORY-115.01 |");
    });

    it("resolves an epic with zero sub-issues (empty User Stories, empty sequence table)", () => {
        const r = resolveEpic(makeGhRunner({ epic: { number: 200, title: "Empty", body: "# Epic: Empty" }, stories: [] }), "/repo", 200);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.markdown).toContain("## User Stories");
        expect(r.markdown).toContain("| STORY | Issue | blocked_by |");
    });

    it("fails closed when a referenced sub-issue cannot be fetched (no markdown produced)", () => {
        const r = resolveEpic(makeGhRunner({ ...graph(), failIssueView: new Set([117]) }), "/repo", 115);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("subissue-fetch-failed");
    });

    it("fails closed when the epic itself cannot be fetched", () => {
        const r = resolveEpic(makeGhRunner({ ...graph(), failIssueView: new Set([115]) }), "/repo", 115);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("epic-not-found");
    });

    it("fails closed when a story's blocked_by cannot be read", () => {
        const r = resolveEpic(makeGhRunner({ ...graph(), failBlockedBy: new Set([117]) }), "/repo", 115);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("subissue-fetch-failed");
    });

    it("fails closed when the repo identity cannot be resolved", () => {
        const r = resolveEpic(makeGhRunner({ ...graph(), failRepoView: true }), "/repo", 115);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("not-a-git-repo");
    });
});

describe("resolveEpic — Story 3: --from epic-vs-story validation (requireEpic)", () => {
    it("resolves a valid epic (no parent) when requireEpic is set", () => {
        const r = resolveEpic(makeGhRunner(graph()), "/repo", 115, { requireEpic: true });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.markdown).toContain("### Story 1: Resolver");
    });

    it("rejects a story issue (has a parent) with not-an-epic, producing no markdown", () => {
        const r = resolveEpic(makeGhRunner({ ...graph(), parents: { 116: 115 } }), "/repo", 116, { requireEpic: true });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("not-an-epic");
        expect(r.error.message).toContain("#115");
    });

    it("rejects a non-existent number with epic-not-found under requireEpic", () => {
        const r = resolveEpic(makeGhRunner({ ...graph(), failIssueView: new Set([900]) }), "/repo", 900, { requireEpic: true });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("epic-not-found");
    });

    it("does not run the parent check when requireEpic is off (internal stages)", () => {
        // A story-shaped issue with a parent still resolves for the internal stages that know it is an epic.
        const r = resolveEpic(makeGhRunner({ ...graph(), parents: { 115: 42 } }), "/repo", 115);
        expect(r.ok).toBe(true);
    });
});

describe("resolveEpic — AC2: byte-identical idempotency", () => {
    it("produces identical markdown on two runs over the same graph", () => {
        const a = resolveEpic(makeGhRunner(graph()), "/repo", 115);
        const b = resolveEpic(makeGhRunner(graph()), "/repo", 115);
        expect(a.ok && b.ok).toBe(true);
        if (!a.ok || !b.ok) return;
        expect(a.markdown).toBe(b.markdown);
    });

    it("is byte-identical even when GitHub returns the sub-issues in a different order", () => {
        const forward = resolveEpic(makeGhRunner({ ...graph(), subIssueOrder: [116, 117, 118] }), "/repo", 115);
        const shuffled = resolveEpic(makeGhRunner({ ...graph(), subIssueOrder: [118, 116, 117] }), "/repo", 115);
        expect(forward.ok && shuffled.ok).toBe(true);
        if (!forward.ok || !shuffled.ok) return;
        expect(shuffled.markdown).toBe(forward.markdown);
    });
});

describe("resolveEpic — Story 2: meta block round-trips the full frontmatter", () => {
    const META = ['feature: "MRW"', "feature_path: docs/features/mrw", "complexity: L", 'link: ""'].join("\n");

    function graphWithMeta(): FixtureGraph {
        return {
            epic: {
                number: 115,
                title: "Planning",
                body: `# Epic: Planning\n\n## Description\n\nDo it.\n\n<!-- nexus:epic-meta\n${META}\n-->\n`,
            },
            stories: [{ number: 116, title: "Resolver", body: "**As a** stage **I want** X.", blockedBy: [] }],
        };
    }

    it("emits the stripped planning fields with link set to the issue number", () => {
        const r = resolveEpic(makeGhRunner(graphWithMeta()), "/repo", 115);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.markdown).toContain("complexity: L");
        expect(r.markdown).toContain("feature_path: docs/features/mrw");
        expect(r.markdown).toContain('link: "#115"');
    });

    it("does not leave the meta block in the materialized body", () => {
        const r = resolveEpic(makeGhRunner(graphWithMeta()), "/repo", 115);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        // The block appears once (inside frontmatter round-trip is raw yaml, not the comment marker).
        expect(r.markdown).not.toContain("nexus:epic-meta");
        expect(r.markdown).toContain("## Description");
    });
});

describe("resolveEpic — AC4: dependency edges exact", () => {
    it("reproduces exactly the native blocked_by edges and invents none", () => {
        const r = resolveEpic(makeGhRunner(graph()), "/repo", 115);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const seq = r.markdown.slice(r.markdown.indexOf("## Implementation Sequence"));
        // Exactly two edges: 117→116 and 118→116, both rendered as STORY-115.01. #116 itself has none.
        expect(seq).toContain("| STORY-115.01 | #116 | none |");
        expect(seq).toContain("| STORY-115.02 | #117 | STORY-115.01 |");
        expect(seq).toContain("| STORY-115.03 | #118 | STORY-115.01 |");
    });
});
