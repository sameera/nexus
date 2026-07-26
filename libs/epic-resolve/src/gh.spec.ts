import { describe, expect, it } from "vitest";
import {
    fetchBlockedBy,
    fetchIssue,
    fetchParentNumber,
    fetchSubIssueNumbers,
    fetchSubIssueTypes,
    resolveRepoSlug,
} from "./gh.js";
import { makeGhRunner } from "./gh-fixtures.js";
import { type Runner } from "./run.js";

const GRAPH = {
    epic: { number: 115, title: "Sample", body: "# Epic: Sample" },
    stories: [
        { number: 116, title: "One", body: "b1", blockedBy: [] },
        { number: 117, title: "Two", body: "b2", blockedBy: [116] },
    ],
};

describe("resolveRepoSlug", () => {
    it("splits owner/repo from gh repo view", () => {
        const r = resolveRepoSlug(makeGhRunner({ ...GRAPH, slug: "acme/widget" }), "/repo");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.slug).toEqual({ owner: "acme", repo: "widget" });
    });

    it("maps a not-a-git-repo failure", () => {
        const r = resolveRepoSlug(makeGhRunner({ ...GRAPH, failRepoView: true }), "/repo");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("not-a-git-repo");
    });

    it("rejects a malformed repo identity", () => {
        const run: Runner = () => ({ status: 0, stdout: "noslash\n", stderr: "" });
        const r = resolveRepoSlug(run, "/repo");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("gh-failed");
    });
});

describe("fetchIssue", () => {
    it("parses number/title/body/state", () => {
        const r = fetchIssue(makeGhRunner(GRAPH), "/repo", 115, "epic-not-found");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.issue.title).toBe("Sample");
        expect(r.issue.number).toBe(115);
    });

    it("maps a missing issue to the caller's not-found problem", () => {
        const r = fetchIssue(makeGhRunner({ ...GRAPH, failIssueView: new Set([115]) }), "/repo", 115, "epic-not-found");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("epic-not-found");
    });

    it("maps a missing story to subissue-fetch-failed", () => {
        const r = fetchIssue(makeGhRunner({ ...GRAPH, failIssueView: new Set([117]) }), "/repo", 117, "subissue-fetch-failed");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("subissue-fetch-failed");
    });

    it("flags unparseable JSON", () => {
        const r = fetchIssue(makeGhRunner({ ...GRAPH, malformedIssues: new Set([115]) }), "/repo", 115, "epic-not-found");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("malformed-json");
    });

    it("maps a generic non-zero gh error to gh-failed", () => {
        const run: Runner = () => ({ status: 1, stdout: "", stderr: "GraphQL: API rate limit exceeded" });
        const r = fetchIssue(run, "/repo", 115, "epic-not-found");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("gh-failed");
    });
});

describe("fetchSubIssueNumbers", () => {
    it("returns the sub-issue numbers in the query's return order", () => {
        const r = fetchSubIssueNumbers(makeGhRunner({ ...GRAPH, subIssueOrder: [117, 116] }), "/repo", { owner: "a", repo: "b" }, 115);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.numbers).toEqual([117, 116]);
    });

    it("returns an empty list for an epic with no sub-issues", () => {
        const r = fetchSubIssueNumbers(makeGhRunner({ epic: GRAPH.epic, stories: [] }), "/repo", { owner: "a", repo: "b" }, 115);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.numbers).toEqual([]);
    });

    it("maps a query failure to gh-failed", () => {
        const r = fetchSubIssueNumbers(makeGhRunner({ ...GRAPH, failSubIssues: true }), "/repo", { owner: "a", repo: "b" }, 115);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("gh-failed");
    });

    it("flags a non-number stream as malformed", () => {
        const r = fetchSubIssueNumbers(makeGhRunner({ ...GRAPH, malformedSubIssues: true }), "/repo", { owner: "a", repo: "b" }, 115);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("malformed-json");
    });
});

describe("fetchParentNumber", () => {
    it("returns null when the issue has no parent (it is a top-level epic)", () => {
        const r = fetchParentNumber(makeGhRunner(GRAPH), "/repo", { owner: "a", repo: "b" }, 115);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.parent).toBeNull();
    });

    it("returns the parent number when the issue is a sub-issue (a story)", () => {
        const r = fetchParentNumber(makeGhRunner({ ...GRAPH, parents: { 116: 115 } }), "/repo", { owner: "a", repo: "b" }, 116);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.parent).toBe(115);
    });

    it("maps a parent-query failure to gh-failed", () => {
        const r = fetchParentNumber(makeGhRunner({ ...GRAPH, failParent: true }), "/repo", { owner: "a", repo: "b" }, 116);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("gh-failed");
    });

    it("flags a non-number parent stream as malformed", () => {
        const run: Runner = () => ({ status: 0, stdout: "nope\n", stderr: "" });
        const r = fetchParentNumber(run, "/repo", { owner: "a", repo: "b" }, 116);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("malformed-json");
    });
});

describe("fetchBlockedBy", () => {
    it("returns the blocker issue numbers", () => {
        const r = fetchBlockedBy(makeGhRunner(GRAPH), "/repo", 117);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.numbers).toEqual([116]);
    });

    it("returns an empty list when a story has no dependencies", () => {
        const r = fetchBlockedBy(makeGhRunner(GRAPH), "/repo", 116);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.numbers).toEqual([]);
    });

    it("maps a dependency-endpoint failure to subissue-fetch-failed", () => {
        const r = fetchBlockedBy(makeGhRunner({ ...GRAPH, failBlockedBy: new Set([117]) }), "/repo", 117);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("subissue-fetch-failed");
    });

    it("flags a non-number dependency stream as malformed", () => {
        const run: Runner = () => ({ status: 0, stdout: "oops\n", stderr: "" });
        const r = fetchBlockedBy(run, "/repo", 117);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("malformed-json");
    });
});

describe("fetchIssue — label names (STORY-139.01 classification input)", () => {
    it("reads the label names off the issue", () => {
        const graph = {
            ...GRAPH,
            stories: [{ number: 116, title: "One", body: "b1", labels: ["story", "pipeline"] }],
        };
        const r = fetchIssue(makeGhRunner(graph), "/repo", 116, "subissue-fetch-failed");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.issue.labels).toEqual(["story", "pipeline"]);
    });

    it("reads no labels when the field is absent or misshapen, rather than failing", () => {
        const run: Runner = () => ({
            status: 0,
            stdout: JSON.stringify({ number: 1, title: "t", body: "b", state: "OPEN", labels: ["bare", { name: 7 }] }),
            stderr: "",
        });
        const r = fetchIssue(run, "/repo", 1, "subissue-fetch-failed");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.issue.labels).toEqual([]);
    });
});

describe("fetchSubIssueTypes", () => {
    it("maps each typed sub-issue to its issue-type name", () => {
        const graph = {
            ...GRAPH,
            stories: [
                { number: 116, title: "One", body: "b1", issueType: "Story" },
                { number: 117, title: "Rec", body: "b2", issueType: "Decision Record" },
            ],
        };
        const r = fetchSubIssueTypes(makeGhRunner(graph), "/repo", { owner: "a", repo: "b" }, 115);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.types.get(116)).toBe("Story");
        expect(r.types.get(117)).toBe("Decision Record");
    });

    it("returns an empty map when no sub-issue carries a type", () => {
        const r = fetchSubIssueTypes(makeGhRunner(GRAPH), "/repo", { owner: "a", repo: "b" }, 115);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.types.size).toBe(0);
    });

    it("reports gh-failed when the repo has no issue-types feature", () => {
        const r = fetchSubIssueTypes(
            makeGhRunner({ ...GRAPH, failSubIssueTypes: true }),
            "/repo",
            { owner: "a", repo: "b" },
            115,
        );
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("gh-failed");
    });

    it("flags a stream that is not `<number> <type>` as malformed", () => {
        const run: Runner = () => ({ status: 0, stdout: "garbage\n", stderr: "" });
        const r = fetchSubIssueTypes(run, "/repo", { owner: "a", repo: "b" }, 115);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("malformed-json");
    });
});
