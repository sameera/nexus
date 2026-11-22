/**
 * `nexus feature-issue features | epics | stubs` (epic #1000, story #1056, decision record #1061
 * D4, D5, D10): the listings the planning stages read features from.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { type Runner } from "@nexus/workspace/run";
import { runFeatureIssue } from "./feature-issue-cli.js";
import { renderFeatureMeta } from "./feature-issue.js";

interface RestIssue {
    number: number;
    title: string;
    state: "open" | "closed";
    body: string;
    labels: { name: string }[];
    type: { name: string } | null;
    pull_request?: object;
}

function repoWith(github: string): string {
    const root: string = fs.mkdtempSync(path.join(os.tmpdir(), "feature-listing-"));
    fs.mkdirSync(path.join(root, ".git"));
    fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(path.join(root, ".nexus", "config", "settings.yml"), `github:\n${github}`);
    return root;
}

function issue(number: number, title: string, body: string, labels: string[], state: "open" | "closed" = "open", type: string | null = null): RestIssue {
    return { number, title, state, body, labels: labels.map((name) => ({ name })), type: type === null ? null : { name: type } };
}

function featureIssue(number: number, name: string, featurePath: string | null, state: "open" | "closed", labels: string[] = ["feature"]): RestIssue {
    return issue(number, name, featurePath === null ? "A request." : `One line.\n\n${renderFeatureMeta(featurePath)}`, labels, state);
}

function epicBody(feature: number): string {
    return `Epic.\n\n<!-- nexus:epic-meta\nfeature_path: "docs/features/x"\nfeature_issue: "#${feature}"\n-->`;
}

function stubBody(feature: number): string {
    return `Stub.\n\n## Meta\n\n- **feature:** docs/features/x\n- **feature issue:** #${feature}\n`;
}

/** Answers listings by the label or type filter in the endpoint, recording every call. */
function fakeGh(issues: RestIssue[], failOn: string | null = null): { run: Runner; calls: string[][] } {
    const calls: string[][] = [];
    const run: Runner = (cmd, args) => {
        calls.push([cmd, ...args]);
        const endpoint: string = args.find((a) => a.startsWith("repos/")) ?? "";
        if (failOn !== null && endpoint.includes(failOn)) return { status: 1, stdout: "", stderr: "HTTP 502" };
        const label: RegExpExecArray | null = /labels=([^&]+)/.exec(endpoint);
        const type: RegExpExecArray | null = /type=([^&]+)/.exec(endpoint);
        const matching: RestIssue[] = issues.filter((i) =>
            label !== null ? i.labels.some((l) => l.name === decodeURIComponent(label[1])) : type !== null ? i.type?.name === decodeURIComponent(type[1]) : true,
        );
        return { status: 0, stdout: JSON.stringify([matching]), stderr: "" };
    };
    return { run, calls };
}

async function call(argv: string[], root: string, run: Runner): Promise<{ code: number; out: string; err: string }> {
    let out = "";
    let err = "";
    const code: number = await runFeatureIssue(argv, { cwd: root, stdout: (l) => (out += `${l}\n`), stderr: (l) => (err += `${l}\n`) }, run);
    return { code, out, err };
}

const OPTED_IN = "  classification: labels\n  features-as-issues: true\n";

const GRAPH: RestIssue[] = [
    featureIssue(10, "Planning", "docs/features/planning", "open"),
    featureIssue(11, "Close", "docs/features/close", "closed"),
    featureIssue(12, "Old thing", "docs/features/old", "closed", ["feature", "retired-feature"]),
    featureIssue(13, "Please add dark mode", null, "open"),
    issue(20, "Planned open", epicBody(10), ["epic"], "open"),
    issue(21, "Planned closed", epicBody(10), ["epic"], "closed"),
    issue(22, "Open stub", stubBody(10), ["epic", "needs-refinement"], "open"),
    issue(23, "Dropped stub", stubBody(10), ["epic", "needs-refinement"], "closed"),
    issue(24, "Other feature's epic", epicBody(11), ["epic"], "open"),
    issue(25, "Unplaced epic", "Epic with no feature.", ["epic"], "open"),
];

describe("nexus feature-issue features", () => {
    it("lists every feature issue that records its feature, open and closed, and leaves out a request", async () => {
        const result = await call(["features"], repoWith(OPTED_IN), fakeGh(GRAPH).run);
        expect(result.code).toBe(0);
        const parsed = JSON.parse(result.out);
        expect(parsed.state).toBe("on");
        const listed = parsed.features.map((f: { number: number }) => f.number);
        expect(listed).toEqual([10, 11, 12]);
        expect(parsed.features[0]).toMatchObject({ number: 10, name: "Planning", state: "open", featurePath: "docs/features/planning", retired: false });
        expect(parsed.features[1]).toMatchObject({ number: 11, state: "closed" });
    });

    it("marks a feature that carries the retired-feature label as retired", async () => {
        const parsed = JSON.parse((await call(["features"], repoWith(OPTED_IN), fakeGh(GRAPH).run)).out);
        expect(parsed.features.find((f: { number: number }) => f.number === 12).retired).toBe(true);
    });

    it("says features as issues is off and reads nothing from GitHub when the repository has not opted in", async () => {
        for (const sub of [["features"], ["epics", "--feature", "10"], ["stubs", "--feature", "10"]]) {
            const gh = fakeGh(GRAPH);
            const result = await call(sub, repoWith("  classification: labels\n"), gh.run);
            expect(result.code).toBe(0);
            expect(JSON.parse(result.out).state).toBe("off");
            expect(gh.calls).toEqual([]);
        }
    });

    it("fails and prints no partial list when GitHub does not answer", async () => {
        const result = await call(["features"], repoWith(OPTED_IN), fakeGh(GRAPH, "labels=feature").run);
        expect(result.code).toBe(1);
        expect(result.out).toBe("");
    });
});

describe("nexus feature-issue epics", () => {
    it("lists every planned epic that names the feature, with its state, and no stub", async () => {
        const result = await call(["epics", "--feature", "10"], repoWith(OPTED_IN), fakeGh(GRAPH).run);
        expect(result.code).toBe(0);
        const parsed = JSON.parse(result.out);
        expect(parsed.epics).toEqual([
            { number: 20, title: "Planned open", state: "open" },
            { number: 21, title: "Planned closed", state: "closed" },
        ]);
    });

    it("never reads related links or sub-issues", async () => {
        const gh = fakeGh(GRAPH);
        await call(["epics", "--feature", "10"], repoWith(OPTED_IN), gh.run);
        expect(gh.calls.flat().some((a) => /sub_issues|dependencies|timeline|graphql/.test(a))).toBe(false);
    });

    it("fails and prints nothing when the epic listing is not fully answered", async () => {
        const result = await call(["epics", "--feature", "10"], repoWith(OPTED_IN), fakeGh(GRAPH, "labels=epic").run);
        expect(result.code).toBe(1);
        expect(result.out).toBe("");
    });
});

describe("nexus feature-issue stubs", () => {
    it("lists every open stub that names the feature, and no closed stub and no planned epic", async () => {
        const result = await call(["stubs", "--feature", "#10"], repoWith(OPTED_IN), fakeGh(GRAPH).run);
        expect(result.code).toBe(0);
        expect(JSON.parse(result.out).stubs).toEqual([{ number: 22, title: "Open stub", state: "open" }]);
    });

    it("refuses a feature number that is not a number", async () => {
        const result = await call(["stubs", "--feature", "abc"], repoWith(OPTED_IN), fakeGh(GRAPH).run);
        expect(result.code).toBe(2);
    });
});
