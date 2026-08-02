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
        expect(r.markdown).toContain("### Story #116: Resolver");
        expect(r.markdown).toContain("### Story #117: Planning files");
        expect(r.markdown).toContain("### Story #118: From flag");
        expect(r.markdown).toContain("| #117 | #116 |");
        expect(r.markdown).toContain("| #118 | #116 |");
    });

    it("resolves an epic with zero sub-issues (empty User Stories, empty sequence table)", () => {
        const r = resolveEpic(makeGhRunner({ epic: { number: 200, title: "Empty", body: "# Epic: Empty" }, stories: [] }), "/repo", 200);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.markdown).toContain("## User Stories");
        expect(r.markdown).toContain("| Issue | blocked_by |");
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
        expect(r.markdown).toContain("### Story #116: Resolver");
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

describe("resolveEpic — STORY-139.01: a record sub-issue is not a story", () => {
    function withRecord(overrides: Partial<FixtureGraph> = {}): FixtureGraph {
        const base = graph();
        return {
            ...base,
            stories: [
                ...(base.stories ?? []),
                { number: 119, title: "Decision Record: Planning", body: "Why we did it.", labels: ["decision-record"] },
            ],
            ...overrides,
        };
    }

    it("keeps the story set to exactly the N stories, with the record absent from it", () => {
        const r = resolveEpic(makeGhRunner(withRecord()), "/repo", 115);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.markdown).toContain("### Story #118: From flag");
        expect(r.markdown).not.toContain("Decision Record: Planning");
        expect(r.markdown).not.toContain("### Story #119");
        // The record never appears as a row in the story sequence table.
        const sequence = r.markdown.slice(r.markdown.indexOf("## Implementation Sequence"));
        expect(sequence).not.toContain("#119");
    });

    it("carries the record's issue number and open/closed state as recoverable fields", () => {
        const open = resolveEpic(makeGhRunner(withRecord()), "/repo", 115);
        expect(open.ok).toBe(true);
        if (!open.ok) return;
        expect(open.markdown).toContain('record: "#119"');
        expect(open.markdown).toContain("record_state: open");
        expect(open.record).toEqual({ number: 119, state: "open" });

        const closed = resolveEpic(
            makeGhRunner(
                withRecord({
                    stories: [
                        ...(graph().stories ?? []),
                        {
                            number: 119,
                            title: "Decision Record: Planning",
                            body: "Why we did it.",
                            state: "CLOSED",
                            labels: ["decision-record"],
                        },
                    ],
                }),
            ),
            "/repo",
            115,
        );
        expect(closed.ok).toBe(true);
        if (!closed.ok) return;
        expect(closed.markdown).toContain("record_state: closed");
        expect(closed.record).toEqual({ number: 119, state: "closed" });
    });

    it("emits no record field, and byte-identical output, for an epic with no record sub-issue", () => {
        const before = resolveEpic(makeGhRunner(graph()), "/repo", 115);
        expect(before.ok).toBe(true);
        if (!before.ok) return;
        expect(before.markdown).not.toContain("record:");
        expect(before.markdown).not.toContain("record_state:");
        expect(before.record).toBeNull();
        // The regression guard: adding a record to the epic must not perturb the story rendering.
        const after = resolveEpic(makeGhRunner(withRecord()), "/repo", 115);
        expect(after.ok).toBe(true);
        if (!after.ok) return;
        const strip = (md: string): string => md.replace(/^record(_state)?: .*\n/gm, "");
        expect(strip(after.markdown)).toBe(before.markdown);
    });

    it("classifies by the configured issue type when the repo declares type-based publishing", () => {
        const typed: FixtureGraph = {
            ...graph(),
            classification: "types",
            stories: [
                ...(graph().stories ?? []),
                { number: 119, title: "Decision Record: Planning", body: "Why.", issueType: "Decision Record" },
            ],
        };
        const r = resolveEpic(makeGhRunner(typed), "/repo", 115);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.record).toEqual({ number: 119, state: "open" });
        expect(r.markdown).not.toContain("Decision Record: Planning");
    });

    it("keeps resolving under legacy-auto when the repo has no issue-types feature", () => {
        const r = resolveEpic(makeGhRunner(withRecord({ classification: "legacy-auto", failSubIssueTypes: true })), "/repo", 115);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.record).toEqual({ number: 119, state: "open" });
    });

    it("aborts when the declared type-based classification cannot read the issue types", () => {
        const r = resolveEpic(makeGhRunner(withRecord({ classification: "types", failSubIssueTypes: true })), "/repo", 115);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("gh-failed");
    });

    it("fails closed when the record sub-issue cannot be fetched (no output)", () => {
        const r = resolveEpic(makeGhRunner(withRecord({ failIssueView: new Set([119]) })), "/repo", 115);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("subissue-fetch-failed");
    });

    it("aborts rather than choosing when an epic carries two record sub-issues", () => {
        const two = withRecord({
            stories: [
                ...(graph().stories ?? []),
                { number: 119, title: "Record A", body: "a", labels: ["decision-record"] },
                { number: 120, title: "Record B", body: "b", labels: ["decision-record"] },
            ],
        });
        const r = resolveEpic(makeGhRunner(two), "/repo", 115);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("multiple-record-subissues");
        expect(r.error.message).toContain("#119");
        expect(r.error.message).toContain("#120");
    });

    it("aborts when the shared publishing resolver cannot classify", () => {
        const r = resolveEpic(makeGhRunner(withRecord({ failClassification: true })), "/repo", 115);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("record-classification-unresolved");
    });

    it("never invokes the classification resolver for an epic with no sub-issues", () => {
        const r = resolveEpic(
            makeGhRunner({ epic: { number: 200, title: "Empty", body: "# Epic: Empty" }, stories: [], failClassification: true }),
            "/repo",
            200,
        );
        expect(r.ok).toBe(true);
    });
});

describe("resolveEpic — a withdrawn story is not live scope", () => {
    function rescoped(): FixtureGraph {
        return {
            epic: { number: 115, title: "Planning", body: BODY },
            stories: [
                { number: 116, title: "Cancelled", body: "**As a** stage **I want** X.", state: "CLOSED", labels: ["story", "wontfix"] },
                { number: 117, title: "Misfiled", body: "**As a** PM **I want** Y.", state: "CLOSED", labels: ["story", "invalid"] },
                { number: 118, title: "Survivor", body: "**As an** engineer **I want** Z.", labels: ["story"], blockedBy: [116] },
            ],
        };
    }

    it("materializes only the stories that are still in scope", () => {
        const r = resolveEpic(makeGhRunner(rescoped()), "/repo", 115);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.markdown).toContain("### Story #118: Survivor");
        expect(r.markdown).not.toContain("Cancelled");
        expect(r.markdown).not.toContain("Misfiled");
    });

    it("renumbers the surviving stories from one, leaving no gap where a withdrawn one was", () => {
        const r = resolveEpic(makeGhRunner(rescoped()), "/repo", 115);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.markdown).toContain("| #118 |");
        expect(r.markdown).not.toContain("#116");
        expect(r.markdown).not.toContain("#117");
    });

    it("drops a dependency edge onto a withdrawn story rather than dangling a reference to it", () => {
        const r = resolveEpic(makeGhRunner(rescoped()), "/repo", 115);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.markdown).toContain("| #118 | none |");
    });

    it("keeps a closed story that was delivered, not withdrawn", () => {
        const delivered: FixtureGraph = {
            epic: { number: 115, title: "Planning", body: BODY },
            stories: [{ number: 116, title: "Shipped", body: "**As a** stage **I want** X.", state: "CLOSED", labels: ["story"] }],
        };
        const r = resolveEpic(makeGhRunner(delivered), "/repo", 115);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.markdown).toContain("### Story #116: Shipped");
    });

    it("still resolves when every story was withdrawn (an emptied epic, not a failure)", () => {
        const emptied: FixtureGraph = {
            epic: { number: 115, title: "Planning", body: BODY },
            stories: [{ number: 116, title: "Cancelled", body: "x", state: "CLOSED", labels: ["wontfix"] }],
        };
        const r = resolveEpic(makeGhRunner(emptied), "/repo", 115);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.markdown).toContain("## User Stories");
        expect(r.markdown).not.toContain("### Story #");
    });

    it("never drops the decision record, whatever labels it carries", () => {
        const labelled: FixtureGraph = {
            epic: { number: 115, title: "Planning", body: BODY },
            stories: [
                { number: 119, title: "Decision Record: Planning", body: "why", state: "CLOSED", labels: ["decision-record", "wontfix"] },
                { number: 118, title: "Survivor", body: "z", labels: ["story"] },
            ],
        };
        const r = resolveEpic(makeGhRunner(labelled), "/repo", 115);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        // The record's own withdrawal is the approval question, decided by state — a stage that
        // gates on it must still see the record, not an epic that appears to have none.
        expect(r.record).toEqual({ number: 119, state: "closed" });
        expect(r.markdown).toContain('record: "#119"');
    });
});

describe("resolveEpic — a story withdrawn by closure reason is not live scope (#168)", () => {
    function rescopedByClosure(): FixtureGraph {
        return {
            epic: { number: 115, title: "Planning", body: BODY },
            stories: [
                { number: 116, title: "Cancelled", body: "**As a** stage **I want** X.", state: "CLOSED", stateReason: "NOT_PLANNED" },
                { number: 117, title: "Duped", body: "**As a** PM **I want** Y.", state: "CLOSED", stateReason: "DUPLICATE" },
                { number: 118, title: "Survivor", body: "**As an** engineer **I want** Z.", labels: ["story"], blockedBy: [116] },
            ],
        };
    }

    it("drops a story closed as not planned, AC1", () => {
        const r = resolveEpic(makeGhRunner(rescopedByClosure()), "/repo", 115);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.markdown).toContain("### Story #118: Survivor");
        expect(r.markdown).not.toContain("Cancelled");
    });

    it("drops a story closed as a duplicate, AC2", () => {
        const r = resolveEpic(makeGhRunner(rescopedByClosure()), "/repo", 115);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.markdown).not.toContain("Duped");
    });

    it("keeps a story closed as completed — only the withdrawing reasons withdraw, AC3", () => {
        const delivered: FixtureGraph = {
            epic: { number: 115, title: "Planning", body: BODY },
            stories: [{ number: 116, title: "Shipped", body: "x", state: "CLOSED", stateReason: "COMPLETED" }],
        };
        const r = resolveEpic(makeGhRunner(delivered), "/repo", 115);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.markdown).toContain("### Story #116: Shipped");
    });

    it("treats a reopened story as live scope again — its state is no longer closed, AC4", () => {
        const reopened: FixtureGraph = {
            epic: { number: 115, title: "Planning", body: BODY },
            stories: [{ number: 116, title: "Un-cancelled", body: "x", state: "OPEN", stateReason: "" }],
        };
        const r = resolveEpic(makeGhRunner(reopened), "/repo", 115);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.markdown).toContain("### Story #116: Un-cancelled");
    });

    it("still withdraws an open story carrying a withdrawal label, AC5", () => {
        const labelled: FixtureGraph = {
            epic: { number: 115, title: "Planning", body: BODY },
            stories: [{ number: 116, title: "Live-labelled withdrawal", body: "x", labels: ["wontfix"] }],
        };
        const r = resolveEpic(makeGhRunner(labelled), "/repo", 115);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.markdown).not.toContain("Live-labelled withdrawal");
    });

    it("drops a dependency edge onto a story withdrawn by closure reason rather than dangling it, AC6", () => {
        const r = resolveEpic(makeGhRunner(rescopedByClosure()), "/repo", 115);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.markdown).toContain("| #118 | none |");
    });

    it("never drops a decision-record sub-issue closed as not planned, AC7", () => {
        const labelled: FixtureGraph = {
            epic: { number: 115, title: "Planning", body: BODY },
            stories: [
                { number: 119, title: "Decision Record: Planning", body: "why", state: "CLOSED", stateReason: "NOT_PLANNED", labels: ["decision-record"] },
                { number: 118, title: "Survivor", body: "z", labels: ["story"] },
            ],
        };
        const r = resolveEpic(makeGhRunner(labelled), "/repo", 115);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.record).toEqual({ number: 119, state: "closed" });
        expect(r.markdown).toContain('record: "#119"');
    });
});

describe("resolveEpic — AC4: dependency edges exact", () => {
    it("reproduces exactly the native blocked_by edges and invents none", () => {
        const r = resolveEpic(makeGhRunner(graph()), "/repo", 115);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const seq = r.markdown.slice(r.markdown.indexOf("## Implementation Sequence"));
        // Exactly two edges: 117→116 and 118→116. #116 itself has none.
        expect(seq).toContain("| #116 | none |");
        expect(seq).toContain("| #117 | #116 |");
        expect(seq).toContain("| #118 | #116 |");
    });
});

describe("resolveEpic — an unplanned epic is refused, not half-resolved (epic #185)", () => {
    // A backlog stub IS an epic issue — it just has no planning meta block and no story sub-issues
    // yet. Resolving one would emit an epic with an empty story set, which every downstream stage
    // would read as "an epic whose scope is nothing" rather than "work nobody has planned".
    // Invariant 14 makes that state say its own name.
    const unplanned: FixtureGraph = {
        epic: {
            number: 300,
            title: "Retire the sequencing table",
            body: "- **goal:** decide the fate of the wave ordering\n",
            labels: ["epic", "backlog"],
        },
        stories: [],
    };

    it("refuses with a diagnostic naming the unplanned state and emits no markdown", () => {
        const r = resolveEpic(makeGhRunner(unplanned), "/repo", 300);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("epic-not-planned");
        expect(r.error.message).toContain("#300");
        expect(r.error.message).toContain("backlog");
    });

    it("names the promotion path so the lead knows what to run next", () => {
        const r = resolveEpic(makeGhRunner(unplanned), "/repo", 300);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.message).toContain("/nxs.epic 300");
    });

    it("honours a repository's declared unplanned label rather than the built-in", () => {
        const declared: FixtureGraph = {
            ...unplanned,
            epic: { ...unplanned.epic, labels: ["epic", "icebox"] },
            unplannedLabel: "icebox",
        };
        const r = resolveEpic(makeGhRunner(declared), "/repo", 300);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("epic-not-planned");
        expect(r.error.message).toContain("icebox");
    });

    it("resolves a planned epic that happens to carry no labels at all", () => {
        const r = resolveEpic(makeGhRunner(graph()), "/repo", 115);
        expect(r.ok).toBe(true);
    });

    it("resolves an epic once the unplanned label has been removed by promotion", () => {
        const promoted: FixtureGraph = {
            ...unplanned,
            epic: { ...unplanned.epic, labels: ["epic"] },
            stories: [{ number: 301, title: "First story", body: "**As a** lead **I want** X.", blockedBy: [] }],
        };
        const r = resolveEpic(makeGhRunner(promoted), "/repo", 300);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.markdown).toContain("### Story #301: First story");
    });
});
