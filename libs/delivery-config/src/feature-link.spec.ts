/**
 * Epic #998, decision record #1010 (D8, D9): an epic or a stub is linked to its feature issue by a
 * relates-to link, never a parent link, after it exists; the named issue must read as a feature
 * before anything is filed; and the feature's related list is what proves the links landed.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { type GhRunner, type RunResult } from "./gh.js";
import { checkFeatureIssue, linkToFeature, missingFromFeature, parseIssueAt } from "./feature-link.js";

const HOME = { owner: "acme", name: "tracker" };

function repoWith(github: string): string {
    const root: string = fs.mkdtempSync(path.join(os.tmpdir(), "feature-link-"));
    fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(path.join(root, ".nexus", "config", "settings.yml"), `github:\n${github}`);
    return root;
}

const OPTED_IN: string = repoWith("  classification: labels\n  features-as-issues: true\n");

interface FakeIssue {
    labels: string[];
    issueType?: string | null;
    related: string[];
}

/** A GraphQL fake over a set of issues keyed `owner/name#n`, recording every mutation. */
function graph(issues: Record<string, FakeIssue>, opts: { failMutation?: boolean } = {}): { run: GhRunner; mutations: string[][] } {
    const mutations: string[][] = [];
    const run: GhRunner = (args): RunResult => {
        const vars: Record<string, string> = {};
        for (let i = 0; i < args.length; i++) {
            if (args[i] === "-f" || args[i] === "-F") {
                const [k, ...v] = args[i + 1].split("=");
                vars[k] = v.join("=");
            }
        }
        if ((vars.query ?? "").startsWith("mutation")) {
            mutations.push([vars.issue, vars.related]);
            if (opts.failMutation) return { status: 1, stdout: "", stderr: "HTTP 502" };
            const [from, to] = [vars.issue.replace(/^ID_/, ""), vars.related.replace(/^ID_/, "")];
            issues[from].related.push(to);
            issues[to].related.push(from);
            return { status: 0, stdout: "{}", stderr: "" };
        }
        const key = `${vars.owner}/${vars.repo}#${vars.num}`;
        const issue: FakeIssue | undefined = issues[key];
        const node =
            issue === undefined
                ? null
                : {
                      id: `ID_${key}`,
                      issueType: issue.issueType ? { name: issue.issueType } : null,
                      labels: { nodes: issue.labels.map((name) => ({ name })) },
                      relatesTo: {
                          nodes: issue.related.map((r) => {
                              const [repo, n] = r.split("#");
                              return { number: Number(n), repository: { nameWithOwner: repo } };
                          }),
                      },
                  };
        return { status: 0, stdout: JSON.stringify({ data: { repository: { issue: node } } }), stderr: "" };
    };
    return { run, mutations };
}

describe("parseIssueAt — the feature reference a work item or a draft carries", () => {
    it("reads a bare number, a #number, an owner/repo#number and an issue URL", () => {
        expect(parseIssueAt("#12", HOME)).toEqual({ ...HOME, number: "12" });
        expect(parseIssueAt("12", HOME)).toEqual({ ...HOME, number: "12" });
        expect(parseIssueAt("other/specs#7", HOME)).toEqual({ owner: "other", name: "specs", number: "7" });
        expect(parseIssueAt("https://github.com/other/specs/issues/7", HOME)).toEqual({ owner: "other", name: "specs", number: "7" });
        expect(parseIssueAt("soon", HOME)).toBeNull();
    });
});

describe("checkFeatureIssue — a filing names only an issue that reads as a feature (G16)", () => {
    it("accepts an issue carrying the feature marker", () => {
        const { run } = graph({ "acme/tracker#5": { labels: ["feature"], related: [] } });
        expect(checkFeatureIssue(run, OPTED_IN, "#5", HOME).ok).toBe(true);
    });

    it("refuses an epic, an unknown issue, and any issue in a repository that has not opted in", () => {
        const { run } = graph({ "acme/tracker#5": { labels: ["feature"], related: [] }, "acme/tracker#6": { labels: ["epic"], related: [] } });
        expect(checkFeatureIssue(run, OPTED_IN, "#6", HOME).ok).toBe(false);
        expect(checkFeatureIssue(run, OPTED_IN, "#404", HOME).ok).toBe(false);
        expect(checkFeatureIssue(run, repoWith("  classification: labels\n"), "#5", HOME).ok).toBe(false);
    });

    it("names the issue and why in its refusal", () => {
        const { run } = graph({ "acme/tracker#6": { labels: ["epic"], related: [] } });
        const verdict = checkFeatureIssue(run, OPTED_IN, "#6", HOME);
        expect(!verdict.ok && verdict.message).toMatch(/#6.*not.*feature/);
    });
});

describe("linkToFeature — a relates-to link, added once, never a parent (G15, G17)", () => {
    it("links the issue to the feature, which then lists it as related", () => {
        const issues: Record<string, FakeIssue> = { "acme/tracker#5": { labels: ["feature"], related: [] }, "acme/tracker#9": { labels: ["epic"], related: [] } };
        const { run } = graph(issues);
        expect(linkToFeature(run, { ...HOME, number: "9" }, { ...HOME, number: "5" })).toEqual({ outcome: "linked" });
        expect(missingFromFeature(run, { ...HOME, number: "5" }, [{ ...HOME, number: "9" }])).toEqual([]);
    });

    it("counts a link that already exists as success and adds nothing", () => {
        const { run, mutations } = graph({
            "acme/tracker#5": { labels: ["feature"], related: ["acme/tracker#9"] },
            "acme/tracker#9": { labels: ["epic"], related: ["acme/tracker#5"] },
        });
        expect(linkToFeature(run, { ...HOME, number: "9" }, { ...HOME, number: "5" })).toEqual({ outcome: "present" });
        expect(mutations).toEqual([]);
    });

    it("links an issue in another repository to the feature", () => {
        const issues: Record<string, FakeIssue> = { "acme/tracker#5": { labels: ["feature"], related: [] }, "other/specs#3": { labels: ["epic"], related: [] } };
        const { run } = graph(issues);
        const elsewhere = { owner: "other", name: "specs", number: "3" };
        expect(linkToFeature(run, elsewhere, { ...HOME, number: "5" }).outcome).toBe("linked");
        expect(missingFromFeature(run, { ...HOME, number: "5" }, [elsewhere])).toEqual([]);
    });

    it("reports a failed link with GitHub's reason instead of throwing", () => {
        const { run } = graph({ "acme/tracker#5": { labels: ["feature"], related: [] }, "acme/tracker#9": { labels: [], related: [] } }, { failMutation: true });
        const result = linkToFeature(run, { ...HOME, number: "9" }, { ...HOME, number: "5" });
        expect(result.outcome).toBe("failed");
        expect(result.outcome === "failed" && result.reason).toContain("HTTP 502");
    });
});

describe("missingFromFeature — the read-back (D9, G18)", () => {
    it("names every issue the feature does not list as related", () => {
        const { run } = graph({ "acme/tracker#5": { labels: ["feature"], related: ["acme/tracker#9"] } });
        const missing = missingFromFeature(run, { ...HOME, number: "5" }, [{ ...HOME, number: "9" }, { ...HOME, number: "10" }]);
        expect(missing).toEqual(["acme/tracker#10"]);
    });

    it("answers null when the feature cannot be read, so a caller cannot read that as complete", () => {
        const { run } = graph({});
        expect(missingFromFeature(run, { ...HOME, number: "5" }, [{ ...HOME, number: "9" }])).toBeNull();
    });
});
