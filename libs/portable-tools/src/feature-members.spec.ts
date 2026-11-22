/**
 * `nexus feature-issue migrate`, story #1047 (decision record #1049, D4, D5): every existing epic and
 * stub names its feature issue and is listed in its related issues.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { type FeatureIssueRef, renderFeatureMeta, resolveFeatureSetting } from "./feature-issue.js";
import { type FeatureToFile, type MemberIssue, type MigrationGh, type MigrationReport, migrateFeatures } from "./feature-migrate.js";

const OPTED_IN = "  classification: labels\n  features-as-issues: true\n";

function repo(readmeEpics: Record<string, number[]> = {}): string {
    const root: string = fs.mkdtempSync(path.join(os.tmpdir(), "feature-members-"));
    fs.mkdirSync(path.join(root, ".git"));
    fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(path.join(root, ".nexus", "config", "settings.yml"), `github:\n${OPTED_IN}`);
    for (const slug of ["alpha", "beta"]) {
        fs.mkdirSync(path.join(root, "docs", "features", slug), { recursive: true });
        const list: string = (readmeEpics[slug] ?? []).map((n) => `- **E** — [#${n}](https://github.com/o/r/issues/${n})`).join("\n");
        fs.writeFileSync(path.join(root, "docs", "features", slug, "README.md"), `# ${slug}\n\nDoes ${slug}.\n\n## Epics\n\n${list}\n`);
    }
    return root;
}

const feature = (number: number, slug: string): FeatureIssueRef => ({
    number, state: "open", body: `S\n\n${renderFeatureMeta(`docs/features/${slug}`)}`, labels: ["feature"], issueType: null,
});

const epicWithMeta = (number: number, meta: string, extra: Partial<MemberIssue> = {}): MemberIssue => ({
    number, title: `Epic ${number}`, state: "open", labels: ["epic"], issueType: null, parent: null,
    body: `Description.\n\n<!-- nexus:epic-meta\nepic: "Epic ${number}"\n${meta}\n-->\n`, ...extra,
});

const stub = (number: number, featureLine: string, extra: Partial<MemberIssue> = {}): MemberIssue => ({
    number, title: `Stub ${number}`, state: "open", labels: ["epic", "needs-refinement"], issueType: null, parent: null,
    body: `Goal.\n\n## Meta\n\n${featureLine}\n- **source:** somewhere\n`, ...extra,
});

class FakeGh implements MigrationGh {
    edits: number[] = [];
    links: [number, number][] = [];
    failEditReadBack = false;
    constructor(public features: FeatureIssueRef[], public members: MemberIssue[]) {}
    listFeatures(): FeatureIssueRef[] { return this.features; }
    fileFeatures(_items: FeatureToFile[]): { numbers: Map<string, number>; failure: string | null } { return { numbers: new Map(), failure: null }; }
    listMembers(): MemberIssue[] { return this.members; }
    editBody(number: number, expected: string, body: string): boolean {
        this.edits.push(number);
        const m = this.members.find((i) => i.number === number) as MemberIssue;
        if (m.body !== expected) return false;
        m.body = this.failEditReadBack ? `${body}\nmangled` : body;
        return !this.failEditReadBack;
    }
    link(number: number, featureNumber: number): "linked" | "present" | "failed" {
        if (this.links.some(([a, b]) => a === number && b === featureNumber)) return "present";
        this.links.push([number, featureNumber]);
        return "linked";
    }
    missingRelated(featureNumber: number, numbers: number[]): number[] | null {
        return numbers.filter((n) => !this.links.some(([a, b]) => a === n && b === featureNumber));
    }
}

function migrate(root: string, gh: FakeGh, apply = true): MigrationReport {
    return migrateFeatures({ root, setting: resolveFeatureSetting(root), apply, gh });
}

describe("migrate — epics and stubs name their feature issue (#1047)", () => {
    it("adds only the feature reference to an epic's meta block, and links it (G10, G13, G15)", () => {
        const e = epicWithMeta(10, "feature_path: docs/features/alpha");
        const before = e.body;
        const gh = new FakeGh([feature(1, "alpha"), feature(2, "beta")], [e]);
        const report = migrate(repo(), gh);
        expect(e.body).toBe(before.replace("feature_path: docs/features/alpha", 'feature_path: docs/features/alpha\nfeature_issue: "#1"'));
        expect(gh.links).toEqual([[10, 1]]);
        expect(report.complete).toBe(true);
    });

    it("adds the feature issue Meta line under a stub's feature line (G10, G25)", () => {
        const s = stub(11, "- **feature:** docs/features/beta");
        const gh = new FakeGh([feature(2, "beta")], [s]);
        migrate(repo(), gh);
        expect(s.body).toContain("- **feature:** docs/features/beta\n- **feature issue:** #2\n");
        expect(s.labels).toEqual(["epic", "needs-refinement"]);
    });

    it("leaves a closed epic closed and an epic's parent, labels and type unchanged (G11)", () => {
        const e = epicWithMeta(12, "feature_path: docs/features/alpha", { state: "closed", parent: 99, labels: ["epic", "x"] });
        const gh = new FakeGh([feature(1, "alpha")], [e]);
        migrate(repo(), gh);
        expect(e).toMatchObject({ state: "closed", parent: 99, labels: ["epic", "x"], issueType: null });
        expect(e.body).toContain('feature_issue: "#1"');
    });

    it("places an epic that records no feature by the README list, adding a block that carries only the reference (D4, D5)", () => {
        const e: MemberIssue = { number: 13, title: "Hand filed", state: "closed", labels: ["epic"], issueType: null, parent: null, body: "Hand-filed body." };
        const gh = new FakeGh([feature(1, "alpha")], [e]);
        migrate(repo({ alpha: [13] }), gh);
        expect(e.body).toBe('Hand-filed body.\n\n<!-- nexus:epic-meta\nfeature_issue: "#1"\n-->\n');
    });

    it("adds a Meta line, not a block, to a stub placed only by a README (D5)", () => {
        const s: MemberIssue = stub(30, "- **source:** elsewhere");
        const gh = new FakeGh([feature(1, "alpha")], [s]);
        migrate(repo({ alpha: [30] }), gh);
        expect(s.body).toBe("Goal.\n\n## Meta\n\n- **source:** elsewhere\n- **source:** somewhere\n- **feature issue:** #1\n");
    });

    it("keeps the rest of a blockless epic's body byte-identical, trailing whitespace included (D5)", () => {
        const e: MemberIssue = { number: 31, title: "Hand filed", state: "open", labels: ["epic"], issueType: null, parent: null, body: "Hand-filed body.  \n" };
        const gh = new FakeGh([feature(1, "alpha")], [e]);
        migrate(repo({ alpha: [31] }), gh);
        expect(e.body.startsWith("Hand-filed body.  \n")).toBe(true);
        expect(e.body.slice("Hand-filed body.  \n".length)).toBe('\n<!-- nexus:epic-meta\nfeature_issue: "#1"\n-->\n');
    });

    it("skips and reports an epic that would read back through the resolver differently in anything but its feature issue (R2)", () => {
        const e: MemberIssue = { number: 32, title: "Spaced", state: "open", labels: ["epic"], issueType: null, parent: null, body: "First.\n\n\n\nSecond." };
        const gh = new FakeGh([feature(1, "alpha")], [e]);
        const report = migrate(repo({ alpha: [32] }), gh);
        expect(gh.edits).toEqual([]);
        expect(e.body).toBe("First.\n\n\n\nSecond.");
        expect(report.complete).toBe(false);
        expect(report.lines.join("\n")).toMatch(/#32: failed/);
    });

    it("gives an issue the feature its own body names when a README disagrees, and reports it (G8)", () => {
        const e = epicWithMeta(14, "feature_path: docs/features/alpha");
        const gh = new FakeGh([feature(1, "alpha"), feature(2, "beta")], [e]);
        const report = migrate(repo({ beta: [14] }), gh);
        expect(e.body).toContain('feature_issue: "#1"');
        expect(report.lines.join("\n")).toMatch(/#14.*docs\/features\/beta/);
    });

    it("reports an issue that no source places and writes nothing to it (G9)", () => {
        const e: MemberIssue = { number: 15, title: "Lost", state: "open", labels: ["epic"], issueType: null, parent: null, body: "Nothing." };
        const gh = new FakeGh([feature(1, "alpha")], [e]);
        const report = migrate(repo(), gh);
        expect(gh.edits).toEqual([]);
        expect(report.lines.join("\n")).toContain("#15");
        expect(report.complete).toBe(false);
    });

    it("never updates an initiative or a feature issue as an epic (G14)", () => {
        const init = epicWithMeta(16, "feature_path: docs/features/alpha", { labels: ["initiative"] });
        const feat = epicWithMeta(17, "feature_path: docs/features/alpha", { labels: ["feature"] });
        const gh = new FakeGh([feature(1, "alpha")], [init, feat]);
        migrate(repo(), gh);
        expect(gh.edits).toEqual([]);
        expect(gh.links).toEqual([]);
    });

    it("a re-run leaves an epic or stub that already names its feature issue byte-identical (G12)", () => {
        const e = epicWithMeta(18, "feature_path: docs/features/alpha");
        const gh = new FakeGh([feature(1, "alpha")], [e]);
        const root = repo();
        migrate(root, gh);
        const after = e.body;
        gh.edits = [];
        migrate(root, gh);
        expect(gh.edits).toEqual([]);
        expect(e.body).toBe(after);
    });

    it("without --apply edits and links nothing and lists each epic and stub it would update (G1)", () => {
        const e = epicWithMeta(19, "feature_path: docs/features/alpha");
        const gh = new FakeGh([feature(1, "alpha")], [e]);
        const report = migrate(repo(), gh, false);
        expect(gh.edits).toEqual([]);
        expect(gh.links).toEqual([]);
        expect(report.lines.join("\n")).toContain("#19");
    });

    it("reports an epic whose body did not read back as written (R2)", () => {
        const e = epicWithMeta(20, "feature_path: docs/features/alpha");
        const gh = new FakeGh([feature(1, "alpha")], [e]);
        gh.failEditReadBack = true;
        const report = migrate(repo(), gh);
        expect(report.complete).toBe(false);
        expect(report.lines.join("\n")).toMatch(/#20.*read back/);
    });

    it("reports, in its final check, an issue the feature issue does not list as related (G13)", () => {
        const e = epicWithMeta(21, 'feature_path: docs/features/alpha\nfeature_issue: "#1"');
        const gh = new FakeGh([feature(1, "alpha")], [e]);
        gh.link = () => "failed";
        const report = migrate(repo(), gh);
        expect(report.complete).toBe(false);
        expect(report.lines.join("\n")).toMatch(/#1 does not list #21/);
    });
});
