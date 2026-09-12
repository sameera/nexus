import { describe, expect, it } from "vitest";
import { type KindClassification } from "@nexus/epic-resolve/classify";
import { resolveStories } from "./story-candidates.js";
import { type RunResult, type Runner } from "./run.js";

/** How the fixture repository files issues — labels, as this repo and most adopters do. */
const LABELS: KindClassification = {
    mode: "labels",
    epicLabel: "epic",
    epicType: "Epic",
    storyLabel: "story",
    storyType: "Story",
    recordLabel: "decision-record",
    recordType: "Decision Record",
};

interface IssueSpec {
    labels?: string[];
    issueType?: string | null;
    parent?: number | null;
    state?: string;
    stateReason?: string | null;
    subIssues?: number[];
}

/** A fake `gh api graphql` responder over a described issue graph. */
function makeGraphRunner(issues: Record<number, IssueSpec>): Runner {
    const node = (n: number) => {
        const spec = issues[n];
        if (spec === undefined) return null;
        return {
            number: n,
            parent: spec.parent === undefined || spec.parent === null ? null : { number: spec.parent },
            issueType: spec.issueType ? { name: spec.issueType } : null,
            state: spec.state ?? "OPEN",
            stateReason: spec.stateReason ?? null,
            labels: { nodes: (spec.labels ?? []).map((name) => ({ name })) },
        };
    };
    return (cmd: string, args: string[]): RunResult => {
        if (cmd !== "gh") return { status: 1, stdout: "", stderr: `unexpected command ${cmd}` };
        const query = args.find((a) => a.startsWith("query=")) ?? "";
        const num = Number((args.find((a) => a.startsWith("num=")) ?? "num=NaN").slice(4));
        if (query.includes("subIssues")) {
            const nodes = (issues[num]?.subIssues ?? []).map(node).filter((n) => n !== null);
            return { status: 0, stdout: JSON.stringify({ data: { repository: { issue: { subIssues: { nodes } } } } }), stderr: "" };
        }
        if (query.includes("parent{number}")) {
            return { status: 0, stdout: JSON.stringify({ data: { repository: { issue: node(num) } } }), stderr: "" };
        }
        return { status: 1, stdout: "", stderr: "unrecognized graphql query" };
    };
}

/** Epic #211 with three stories and a decision record — the shape this repo files. */
const EPIC_211: Record<number, IssueSpec> = {
    491: { labels: ["initiative"], subIssues: [211] },
    211: { labels: ["epic"], parent: 491, subIssues: [492, 493, 494, 495] },
    492: { labels: ["story"], parent: 211 },
    493: { labels: ["story"], parent: 211 },
    494: { labels: ["story"], parent: 211 },
    495: { labels: ["decision-record"], parent: 211 },
};

const SLUG = { owner: "acme", repo: "widget" };

describe("resolveStories — a story-level pull request", () => {
    it("resolves a single explicit story candidate to its epic", () => {
        const r = resolveStories(makeGraphRunner(EPIC_211), "/repo", SLUG, LABELS, { explicitStory: 493, closingIssues: [] });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.epic).toBe(211);
        expect(r.stories).toEqual([493]);
    });

    it("reads GitHub's own closing-issue linkage when the PR body carries it", () => {
        const r = resolveStories(makeGraphRunner(EPIC_211), "/repo", SLUG, LABELS, { closingIssues: [493] });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.stories).toEqual([493]);
    });

    it("falls through to a branch name naming a story", () => {
        const r = resolveStories(makeGraphRunner(EPIC_211), "/repo", SLUG, LABELS, {
            closingIssues: [],
            branchName: "story-493-check-the-story",
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.epic).toBe(211);
        expect(r.stories).toEqual([493]);
    });

    it("reads a body reference that names the issues repo and states scope", () => {
        const r = resolveStories(makeGraphRunner(EPIC_211), "/repo", SLUG, LABELS, {
            closingIssues: [],
            prBody: "Implements acme/widget#493 per the epic.",
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.stories).toEqual([493]);
    });

    it("covers every surviving story when several validate against the same epic", () => {
        const r = resolveStories(makeGraphRunner(EPIC_211), "/repo", SLUG, LABELS, { closingIssues: [492, 493] });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.epic).toBe(211);
        expect(r.stories).toEqual([492, 493]);
    });
});

describe("resolveStories — commit trailers, where an epic-branch PR actually names its stories", () => {
    it("reads Closes lines out of the commit messages when the PR body has none", () => {
        // GitHub's closingIssuesReferences reads the PR *body* only. A PR built one commit per
        // story carries its `Closes #<n>` lines in the commit bodies, so without this rung the
        // only signal left is the branch name — which names the epic, not a story.
        const r = resolveStories(makeGraphRunner(EPIC_211), "/repo", SLUG, LABELS, {
            closingIssues: [],
            commitMessages: [
                "analyze: accept a member repository's PR from the hub\n\nCloses #492",
                "analyze: scope a --pr run to the one story it implements\n\nCloses #493",
                "analyze: stamp the story and repo on a --pr verdict\n\nCloses #494",
            ],
            branchName: "epic-211-analyze-member-pr",
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.epic).toBe(211);
        expect(r.stories).toEqual([492, 493, 494]);
    });

    it("accepts every closing keyword GitHub accepts, in any casing", () => {
        const r = resolveStories(makeGraphRunner(EPIC_211), "/repo", SLUG, LABELS, {
            closingIssues: [],
            commitMessages: ["a\n\nfixes #492", "b\n\nRESOLVED #493", "c\n\nclose #494"],
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.stories).toEqual([492, 493, 494]);
    });

    it("reads a repo-qualified trailer naming the issues repo, and ignores one naming another", () => {
        const r = resolveStories(makeGraphRunner(EPIC_211), "/repo", SLUG, LABELS, {
            closingIssues: [],
            commitMessages: ["a\n\nCloses acme/widget#492", "b\n\nCloses other/repo#493"],
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.stories).toEqual([492]);
    });

    it("ignores a bare issue mention that is not a closing reference", () => {
        const r = resolveStories(makeGraphRunner(EPIC_211), "/repo", SLUG, LABELS, {
            closingIssues: [],
            commitMessages: ["a\n\nCloses #492\n\nRelated to #493, see also #494"],
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.stories).toEqual([492]);
    });
});

describe("resolveStories — an epic-level pull request stays supported", () => {
    it("resolves a branch named after the epic to that epic's whole story set", () => {
        // The shape `utils/implement-epic.sh` produces, and the shape supported before the
        // candidate ladder existed: one branch, all of an epic's stories. The epic is a valid
        // answer in its own right — not a story to be walked up from.
        const r = resolveStories(makeGraphRunner(EPIC_211), "/repo", SLUG, LABELS, {
            closingIssues: [],
            branchName: "epic-211-analyze-member-pr",
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.epic).toBe(211);
        expect(r.stories).toEqual([492, 493, 494]);
    });

    it("leaves the decision-record sub-issue out of the story set", () => {
        const r = resolveStories(makeGraphRunner(EPIC_211), "/repo", SLUG, LABELS, {
            closingIssues: [],
            branchName: "epic-211-analyze-member-pr",
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.stories).not.toContain(495);
    });

    it("leaves a withdrawn story out of the story set", () => {
        const graph = { ...EPIC_211, 494: { labels: ["story", "wontfix"], parent: 211 } };
        const r = resolveStories(makeGraphRunner(graph), "/repo", SLUG, LABELS, {
            closingIssues: [],
            branchName: "epic-211-analyze-member-pr",
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.stories).toEqual([492, 493]);
    });

    it("prefers the stories the PR names over the epic's whole set when both are signalled", () => {
        // The branch names the epic and the commits name two of its three stories: the PR is
        // telling us what it implements, so that wins over the epic's full scope.
        const r = resolveStories(makeGraphRunner(EPIC_211), "/repo", SLUG, LABELS, {
            closingIssues: [],
            commitMessages: ["a\n\nCloses #492", "b\n\nCloses #493"],
            branchName: "epic-211-analyze-member-pr",
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.epic).toBe(211);
        expect(r.stories).toEqual([492, 493]);
    });

    it("stops on an epic that has no stories at all", () => {
        const graph = { 491: { labels: ["initiative"], subIssues: [211] }, 211: { labels: ["epic"], parent: 491, subIssues: [] } };
        const r = resolveStories(makeGraphRunner(graph), "/repo", SLUG, LABELS, { closingIssues: [], branchName: "epic-211-x" });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("no-story-candidates");
    });
});

describe("resolveStories — what it refuses", () => {
    it("never walks up from an epic to the initiative above it", () => {
        // The defect this exists to prevent: validating a candidate only by "has a parent, and
        // that parent lists it back" accepts an epic as a story of its initiative, and the run
        // then checks the wrong issue's acceptance criteria and the wrong decision record.
        const r = resolveStories(makeGraphRunner(EPIC_211), "/repo", SLUG, LABELS, {
            closingIssues: [],
            branchName: "epic-211-analyze-member-pr",
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.epic).not.toBe(491);
    });

    it("drops a candidate the repository files as neither an epic nor a story", () => {
        const r = resolveStories(makeGraphRunner(EPIC_211), "/repo", SLUG, LABELS, {
            closingIssues: [491, 493],
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.epic).toBe(211);
        expect(r.stories).toEqual([493]);
    });

    it("drops a candidate that names no issue at all", () => {
        const r = resolveStories(makeGraphRunner(EPIC_211), "/repo", SLUG, LABELS, { closingIssues: [99999, 493] });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.stories).toEqual([493]);
    });

    it("stops and names every candidate, with why each was dropped, when none survive", () => {
        const r = resolveStories(makeGraphRunner(EPIC_211), "/repo", SLUG, LABELS, {
            closingIssues: [491],
            branchName: "chore-99999-tidy",
        });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("no-story-candidates");
        expect(r.error.message).toContain("#491");
        expect(r.error.message).toContain("#99999");
    });

    it("stops when surviving candidates resolve to more than one epic", () => {
        const graph = {
            ...EPIC_211,
            300: { labels: ["epic"], parent: 491, subIssues: [501] },
            501: { labels: ["story"], parent: 300 },
        };
        const r = resolveStories(makeGraphRunner(graph), "/repo", SLUG, LABELS, { closingIssues: [493, 501] });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("story-candidates-multiple-epics");
    });

    it("rejects a story whose epic does not name it back among its own sub-issues", () => {
        const graph = { ...EPIC_211, 211: { labels: ["epic"], parent: 491, subIssues: [492, 494, 495] } };
        const r = resolveStories(makeGraphRunner(graph), "/repo", SLUG, LABELS, { explicitStory: 493, closingIssues: [] });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("no-story-candidates");
    });

    it("rejects a story whose parent is not filed as an epic", () => {
        const graph = {
            ...EPIC_211,
            700: { labels: ["initiative"], subIssues: [701] },
            701: { labels: ["story"], parent: 700 },
        };
        const r = resolveStories(makeGraphRunner(graph), "/repo", SLUG, LABELS, { explicitStory: 701, closingIssues: [] });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("no-story-candidates");
        expect(r.error.message).toContain("#700");
    });

    it("stops when the declared classification does not match how the repository files issues", () => {
        // Settings say labels; the issue is typed instead. Reading the type anyway would let a
        // wrong `classification:` keep working here and disagree with every stage that trusts it.
        const graph = { 211: { labels: [], issueType: "Epic", parent: null, subIssues: [] } };
        const r = resolveStories(makeGraphRunner(graph), "/repo", SLUG, LABELS, { closingIssues: [211] });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("classification-mode-mismatch");
    });
});

describe("resolveStories — a reference qualified to another repository (story #565)", () => {
    it("keeps a body reference naming another repository out of the story list", () => {
        const r = resolveStories(makeGraphRunner(EPIC_211), "/repo", SLUG, LABELS, {
            closingIssues: [],
            prBody: "Implements acme/widget#493. Builds on acme/hub#492.",
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.stories).toEqual([493]);
    });

    it("never names a reference to another repository among what a refusal considered", () => {
        const r = resolveStories(makeGraphRunner(EPIC_211), "/repo", SLUG, LABELS, {
            closingIssues: [],
            prBody: "Implements other/repo#493.",
        });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("no-story-candidates");
        expect(r.error.message).not.toContain("#493");
    });

    it("ignores the platform closing-issue links of a pull request in another repository", () => {
        // GitHub's closing links are same-repository by construction: for a member pull request
        // they are member issue numbers, and a collision with a hub story would otherwise claim
        // that story as implemented.
        const r = resolveStories(makeGraphRunner(EPIC_211), "/repo", SLUG, LABELS, {
            prRepo: "acme/member",
            closingIssues: [493],
            commitMessages: ["a\n\nCloses #492"],
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.stories).toEqual([492]);
    });

    it("still reads the closing-issue links of a pull request in the issues repository", () => {
        const r = resolveStories(makeGraphRunner(EPIC_211), "/repo", SLUG, LABELS, {
            prRepo: "ACME/Widget",
            closingIssues: [493],
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.stories).toEqual([493]);
    });
});
