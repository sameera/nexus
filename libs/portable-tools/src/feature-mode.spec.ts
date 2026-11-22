/**
 * Features use the Feature issue type even when epics use labels (epic #1000, story #1060,
 * decision record #1061 D1, D2, D3): one `github.features` setting decides how features are recorded.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { type Runner } from "@nexus/workspace/run";
import { classifyIssueKind, isDeclaredFeature, readKindMarkers } from "@nexus/delivery-config/issue-kind";
import { runFeatureIssue } from "./feature-issue-cli.js";
import { renderFeatureMeta } from "./feature-issue.js";

const FEATURE_PATH = "docs/features/x";

function repoWith(github: string): string {
    const root: string = fs.mkdtempSync(path.join(os.tmpdir(), "feature-mode-"));
    fs.mkdirSync(path.join(root, ".git"));
    fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(path.join(root, ".nexus", "config", "settings.yml"), `github:\n  epic-repo: o/r\n${github}`);
    return root;
}

interface Rest {
    number: number;
    title: string;
    state: string;
    body: string;
    labels: { name: string }[];
    type: { name: string } | null;
}

/** Answers listings by label or type filter, and the repository's issue types over GraphQL. */
function fakeGh(issues: Rest[], repoTypes: string[] = ["Feature", "Epic"]): { run: Runner; calls: string[][] } {
    const calls: string[][] = [];
    const run: Runner = (_cmd, args) => {
        calls.push(args);
        if (args.includes("graphql")) {
            return { status: 0, stdout: JSON.stringify({ data: { repository: { issueTypes: { nodes: repoTypes.map((name) => ({ name })) } } } }), stderr: "" };
        }
        const endpoint: string = args.find((a) => a.startsWith("repos/")) ?? "";
        const label: RegExpExecArray | null = /labels=([^&]+)/.exec(endpoint);
        const type: RegExpExecArray | null = /type=([^&]+)/.exec(endpoint);
        const hit: Rest[] = issues.filter((i) =>
            label !== null ? i.labels.some((l) => l.name === decodeURIComponent(label[1])) : type !== null ? i.type?.name === decodeURIComponent(type[1]) : true,
        );
        return { status: 0, stdout: JSON.stringify([hit]), stderr: "" };
    };
    return { run, calls };
}

async function call(argv: string[], root: string, run: Runner): Promise<{ code: number; out: string; err: string }> {
    let out = "";
    let err = "";
    const code: number = await runFeatureIssue(argv, { cwd: root, stdout: (l) => (out += l), stderr: (l) => (err += l) }, run);
    return { code, out, err };
}

const typedFeature: Rest = { number: 9, title: "X", state: "closed", body: `S\n\n${renderFeatureMeta(FEATURE_PATH)}`, labels: [], type: { name: "Feature" } };

describe("github.features: types with labelled epics", () => {
    const settings = "  classification: labels\n  features: types\n  feature-type: Feature\n";

    it("files a new feature issue with the Feature type and no feature label", async () => {
        const parsed = JSON.parse((await call(["lookup", "--feature-path", FEATURE_PATH], repoWith(settings), fakeGh([]).run)).out);
        expect(parsed).toMatchObject({ outcome: "file-new", type: "Feature", label: "" });
    });

    it("the feature listing finds the typed feature issue", async () => {
        const parsed = JSON.parse((await call(["features"], repoWith(settings), fakeGh([typedFeature]).run)).out);
        expect(parsed.features.map((f: { number: number }) => f.number)).toEqual([9]);
    });

    it("reads a Feature-typed issue as a feature, never with a classification mismatch, and an epic-labelled one as an epic", () => {
        const markers = readKindMarkers(repoWith(settings));
        expect(isDeclaredFeature(markers, { labels: [], issueType: "Feature" })).toBe(true);
        expect(isDeclaredFeature(markers, { labels: ["feature"], issueType: null })).toBe(false);
        expect(isDeclaredFeature(markers, { labels: ["epic"], issueType: "Feature" })).toBe(false);
        expect(classifyIssueKind(markers, { number: 9, labels: [], issueType: "Feature" })).toEqual({ ok: true, kind: "feature" });
    });

    it("stops before filing and names the setting when no feature type is named", async () => {
        const gh = fakeGh([]);
        const result = await call(["lookup", "--feature-path", FEATURE_PATH], repoWith("  classification: labels\n  features: types\n"), gh.run);
        expect(result.code).toBe(1);
        expect(result.err).toContain("github.feature-type");
        expect(gh.calls).toEqual([]);
    });

    it("stops before filing and names the type when the repository does not have it", async () => {
        const result = await call(["lookup", "--feature-path", FEATURE_PATH], repoWith(settings), fakeGh([], ["Epic"]).run);
        expect(result.code).toBe(1);
        expect(result.err).toContain("Feature");
        expect(JSON.parse(result.out).outcome).toBe("type-missing");
    });
});

describe("github.features: labels with typed epics", () => {
    const settings = "  classification: types\n  epic-type: Epic\n  story-type: Story\n  features: labels\n";

    it("files a new feature issue with the feature label and no type", async () => {
        const parsed = JSON.parse((await call(["lookup", "--feature-path", FEATURE_PATH], repoWith(settings), fakeGh([]).run)).out);
        expect(parsed).toMatchObject({ outcome: "file-new", label: "feature", type: "" });
    });

    it("reads a feature-labelled issue as a feature without a classification mismatch", () => {
        const markers = readKindMarkers(repoWith(settings));
        expect(classifyIssueKind(markers, { number: 3, labels: ["feature"], issueType: null })).toEqual({ ok: true, kind: "feature" });
    });
});

describe("the default and the legacy spelling", () => {
    it("no choice keeps features in the docs tree", async () => {
        const gh = fakeGh([]);
        expect(JSON.parse((await call(["features"], repoWith("  classification: labels\n"), gh.run)).out).state).toBe("off");
        expect(gh.calls).toEqual([]);
    });

    it("features: docs wins over features-as-issues: true", async () => {
        const gh = fakeGh([]);
        const root: string = repoWith("  classification: labels\n  features: docs\n  features-as-issues: true\n");
        expect(JSON.parse((await call(["lookup", "--feature-path", FEATURE_PATH], root, gh.run)).out).outcome).toBe("off");
        expect(gh.calls).toEqual([]);
    });

    it("features-as-issues: true alone keeps the marker classification gives", async () => {
        const parsed = JSON.parse((await call(["lookup", "--feature-path", FEATURE_PATH], repoWith("  classification: labels\n  features-as-issues: true\n"), fakeGh([]).run)).out);
        expect(parsed).toMatchObject({ outcome: "file-new", classification: "labels", label: "feature" });
    });
});
