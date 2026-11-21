/**
 * Epic #998, decision record #1010 (D7, D8): an epic draft that names its feature issue is filed
 * with that number in its meta block and linked to the feature by relates-to; a draft naming an issue
 * that is not a feature is refused before the epic is created; a failed link warns.
 */

import * as fs from "node:fs";
import { describe, expect, it } from "vitest";
import { type RunResult } from "../gh";
import { FAIL, OK, checkoutWith, draft, fakeEnvironment, recordingIo, writeDraft } from "./fixtures";
import { runCreateEpic } from "./run";

interface Graph {
    labels: Record<string, string[]>;
    related: Record<string, string[]>;
    failLinks: boolean;
    bodies?: string[];
}

function answers(g: Graph) {
    return (args: string[]): RunResult | undefined => {
        if (args[0] === "issue" && args[1] === "create") (g.bodies ??= []).push(fs.readFileSync(args[args.indexOf("--body-file") + 1], "utf8"));
        if (args[0] !== "api" || args[1] !== "graphql") return undefined;
        const value = (name: string): string => args.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
        if (value("query").startsWith("mutation") && value("query").includes("addRelatesTo")) {
            if (g.failLinks) return FAIL("HTTP 502");
            const [from, to] = [value("issue").slice(3), value("related").slice(3)];
            (g.related[from] ??= []).push(`acme/repo#${to}`);
            (g.related[to] ??= []).push(`acme/repo#${from}`);
            return OK("{}");
        }
        if (!value("query").includes("relatesTo")) return undefined;
        const n: string = value("num");
        const issue = {
            id: `ID_${n}`,
            issueType: null,
            labels: { nodes: (g.labels[n] ?? []).map((name) => ({ name })) },
            relatesTo: { nodes: (g.related[n] ?? []).map((r) => ({ number: Number(r.split("#")[1]), repository: { nameWithOwner: "acme/repo" } })) },
        };
        return OK(JSON.stringify({ data: { repository: { issue } } }));
    };
}

function file(featureIssue: string, g: Graph) {
    const root: string = checkoutWith({ classification: "labels", project: "none", "features-as-issues": "true" });
    const path: string = writeDraft(root, draft({ complexity: "S", feature_issue: featureIssue }));
    const fake = fakeEnvironment({ answer: answers(g) });
    const io = recordingIo(root);
    const code: number = runCreateEpic([path], io, fake.env);
    return { code, io, path, calls: fake.calls };
}

describe("create-epic — an epic that names its feature issue", () => {
    it("files the number in the meta block and links the epic to the feature (G13, G15)", () => {
        const g: Graph = { labels: { "5": ["feature"] }, related: {}, failLinks: false };
        const run = file('"#5"', g);
        expect(run.code).toBe(0);
        expect(g.related["5"]).toEqual(["acme/repo#7"]);
        expect(g.bodies?.[0]).toMatch(/feature_issue: "#5"/);
    });

    it("refuses before creating anything when the named issue is not a feature (G16)", () => {
        const run = file('"#6"', { labels: { "6": ["epic"] }, related: {}, failLinks: false });
        expect(run.code).toBe(1);
        expect(run.calls.some((c) => c[0] === "issue" && c[1] === "create")).toBe(false);
        expect(run.io.all()).toMatch(/#6.*not declared a feature/);
    });

    it("warns on a failed link and still records the number on the draft (G17, G23)", () => {
        const run = file('"#5"', { labels: { "5": ["feature"] }, related: {}, failLinks: true });
        expect(run.code).toBe(0);
        expect(run.io.all()).toMatch(/could not link #7 to feature #5/i);
        expect(fs.readFileSync(run.path, "utf8")).toMatch(/link: "#7"/);
    });
});
