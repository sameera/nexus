/**
 * Epic #998, decision record #1010 (D8): a stub that names its feature issue is linked to it by a
 * relates-to link after it is filed, never as its sub-issue; a batch naming an issue that is not a
 * feature is refused before anything is created; a failed link warns and a repeat retries it.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { type RunResult } from "../gh";
import { FAIL, OK, checkoutWith, filingPlatform, recordingIo, scratch, writeItem } from "./fixtures";
import { LEDGER_NAME } from "./ledger";
import { runCreateStory } from "./run";

const REPO = "acme/tracker";

function repo(): string {
    return checkoutWith({ classification: "labels", "story-repo": REPO, project: "none", "features-as-issues": "true" });
}

function stub(ref: string, extra = ""): string {
    return `---\nref: ${ref}\ntitle: "Goal ${ref}"\nlabels: [unplanned]\n${extra}---\n\nA goal.\n`;
}

interface Graph {
    /** Labels per issue number in the tracker. */
    labels: Record<string, string[]>;
    related: Record<string, Set<string>>;
    mutations: number;
    failLinks: boolean;
}

function graphAnswers(g: Graph) {
    return (args: string[]): RunResult | undefined => {
        if (args[0] !== "api" || args[1] !== "graphql") return undefined;
        const value = (name: string): string => args.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
        if (value("query").startsWith("mutation")) {
            g.mutations++;
            if (g.failLinks) return FAIL("HTTP 502");
            const [from, to] = [value("issue").slice(3), value("related").slice(3)];
            (g.related[from] ??= new Set()).add(`${REPO}#${to}`);
            (g.related[to] ??= new Set()).add(`${REPO}#${from}`);
            return OK("{}");
        }
        if (!value("query").includes("relatesTo")) return undefined;
        const n: string = value("num");
        const issue = {
            id: `ID_${n}`,
            issueType: null,
            labels: { nodes: (g.labels[n] ?? []).map((name) => ({ name })) },
            relatesTo: { nodes: [...(g.related[n] ?? [])].map((r) => ({ number: Number(r.split("#")[1]), repository: { nameWithOwner: REPO } })) },
        };
        return OK(JSON.stringify({ data: { repository: { issue } } }));
    };
}

function graph(labels: Record<string, string[]> = { "5": ["feature"] }): Graph {
    return { labels, related: {}, mutations: 0, failLinks: false };
}

describe("create-story — stubs that name their feature issue", () => {
    it("links each filed stub to the feature issue by relates-to, never as its sub-issue (G15)", () => {
        const root: string = repo();
        writeItem(root, "STORY-STUB-01.md", stub("STUB-01", 'feature_issue: "#5"\n'));
        writeItem(root, "STORY-STUB-02.md", stub("STUB-02", 'feature_issue: "#5"\n'));
        const g: Graph = graph();
        const gh = filingPlatform(graphAnswers(g));
        const io = recordingIo(root);

        expect(runCreateStory([scratch(root), "--classification-label", "epic"], io, gh.env)).toBe(0);
        expect([...g.related["5"]].sort()).toEqual([`${REPO}#100`, `${REPO}#101`]);
        const flat: string = gh.calls.map((c) => c.join(" ")).join("\n");
        expect(flat).not.toMatch(/sub_issues|addSubIssue/);
    });

    it("refuses the whole batch, creating nothing, when the named issue is not a feature (G16)", () => {
        const root: string = repo();
        writeItem(root, "STORY-STUB-01.md", stub("STUB-01", 'feature_issue: "#6"\n'));
        const gh = filingPlatform(graphAnswers(graph({ "6": ["epic"] })));
        const io = recordingIo(root);

        expect(runCreateStory([scratch(root), "--classification-label", "epic"], io, gh.env)).toBe(1);
        expect(gh.calls.some((c) => c[0] === "issue" && c[1] === "create")).toBe(false);
        expect(io.all()).toMatch(/#6.*not declared a feature/);
    });

    it("warns on a failed link without failing the run, and a repeat adds the link and files nothing twice (G17)", () => {
        const root: string = repo();
        writeItem(root, "STORY-STUB-01.md", stub("STUB-01", 'feature_issue: "#5"\n'));
        const g: Graph = graph();
        g.failLinks = true;
        const first = filingPlatform(graphAnswers(g));
        const io = recordingIo(root);
        expect(runCreateStory([scratch(root), "--classification-label", "epic", "--keep-manifest"], io, first.env)).toBe(0);
        expect(io.all()).toMatch(/[Ww]arning.*#5/);
        expect(fs.existsSync(path.join(scratch(root), LEDGER_NAME))).toBe(true);

        g.failLinks = false;
        const second = filingPlatform(graphAnswers(g));
        expect(runCreateStory([scratch(root), "--classification-label", "epic"], recordingIo(root), second.env)).toBe(0);
        expect(second.calls.some((c) => c[0] === "issue" && c[1] === "create")).toBe(false);
        expect(g.related["5"]).toContain(`${REPO}#100`);
    });

    it("reads a bare feature reference in the epic repository when stubs file into another story repository (G9, G10)", () => {
        const root: string = checkoutWith({
            classification: "labels",
            "story-repo": "acme/specs",
            "epic-repo": REPO,
            project: "none",
            "features-as-issues": "true",
        });
        writeItem(root, "STORY-STUB-01.md", stub("STUB-01", 'feature_issue: "#5"\n'));
        const g: Graph = graph();
        const answer = graphAnswers(g);
        const asked: string[] = [];
        const gh = filingPlatform((args: string[]): RunResult | undefined => {
            const repoArg: string | undefined = args.find((a) => a.startsWith("repo="));
            if (repoArg !== undefined) asked.push(repoArg.slice(5));
            if (repoArg !== undefined && repoArg !== "repo=tracker") return FAIL("Could not resolve to an Issue");
            return answer(args);
        });

        expect(runCreateStory([scratch(root), "--classification-label", "epic"], recordingIo(root), gh.env)).toBe(0);
        expect(asked.length).toBeGreaterThan(0);
        expect(asked.every((r) => r === "tracker")).toBe(true);
        expect(g.related["5"]).toBeDefined();
    });

    it("makes no feature call for a batch that names no feature issue (G1)", () => {
        const root: string = repo();
        writeItem(root, "STORY-STUB-01.md", stub("STUB-01"));
        const g: Graph = graph();
        const gh = filingPlatform(graphAnswers(g));
        expect(runCreateStory([scratch(root), "--classification-label", "epic"], recordingIo(root), gh.env)).toBe(0);
        expect(gh.calls.some((c) => c.join(" ").includes("relatesTo"))).toBe(false);
    });
});
