/**
 * `nexus feature-issue migrate` (epic #999, decision record #1049): every existing feature folder
 * gets exactly one feature issue, and a repeat files nothing twice.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { type FeatureIssueRef, featureRef, parseFeaturePath, renderFeatureMeta, resolveFeatureSetting } from "./feature-issue.js";
import { type FeatureToFile, LEDGER_FILE, MIGRATION_DIR, type MigrationGh, type MigrationReport, migrateFeatures } from "./feature-migrate.js";

const OPTED_IN = "  classification: labels\n  features: labels\n";

function repoWith(github: string, folders: Record<string, string>): string {
    const root: string = fs.mkdtempSync(path.join(os.tmpdir(), "feature-migrate-"));
    fs.mkdirSync(path.join(root, ".git"));
    fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(path.join(root, ".nexus", "config", "settings.yml"), `github:\n${github}`);
    fs.mkdirSync(path.join(root, "docs", "features"), { recursive: true });
    fs.writeFileSync(path.join(root, "docs", "features", "README.md"), "# Features\n\nOne folder per feature.\n");
    for (const [slug, readme] of Object.entries(folders)) {
        fs.mkdirSync(path.join(root, "docs", "features", slug), { recursive: true });
        fs.writeFileSync(path.join(root, "docs", "features", slug, "README.md"), readme);
    }
    return root;
}

function readme(name: string, statement: string): string {
    return `---\nfeature: "${name}"\n---\n\n# ${name}\n\n${statement}\n\n## Epics\n\n- **Something** — [#5](https://github.com/o/r/issues/5)\n`;
}

/** An in-memory GitHub holding feature issues; filing appends to it, so a repeat sees what it filed. */
class FakeGh implements MigrationGh {
    filed: FeatureToFile[] = [];
    listCalls = 0;
    failAfter: number | null = null;
    private next = 500;

    constructor(public issues: FeatureIssueRef[] = []) {}

    listFeatures(): FeatureIssueRef[] | null {
        this.listCalls++;
        return this.issues.filter((i) => i.labels.includes("feature"));
    }

    closed: number[] = [];
    closeFails = false;
    closeFailsFor: number[] = [];
    issueTypes: string[] | null = null;

    hasIssueType(name: string): boolean {
        return this.issueTypes === null || this.issueTypes.includes(name);
    }

    closeFeature(number: number): boolean {
        if (this.closeFails || this.closeFailsFor.includes(number)) return false;
        this.closed.push(number);
        const issue = this.issues.find((i) => i.number === number);
        if (issue !== undefined) issue.state = "closed";
        return true;
    }

    fileFeatures(items: FeatureToFile[]): { numbers: Map<string, number>; failure: string | null } {
        const numbers: Map<string, number> = new Map();
        for (const item of items) {
            if (this.failAfter !== null && this.filed.length >= this.failAfter) return { numbers, failure: "connection reset" };
            const number: number = this.next++;
            this.filed.push(item);
            this.issues.push({ number, state: "open", body: `${item.statement}\n\n${renderFeatureMeta(item.featurePath)}`, labels: ["feature"], issueType: null });
            numbers.set(item.featurePath, number);
        }
        return { numbers, failure: null };
    }
}

function featureIssue(number: number, featurePath: string, extra: Partial<FeatureIssueRef> = {}): FeatureIssueRef {
    return { number, state: "open", body: `S\n\n${renderFeatureMeta(featurePath)}`, labels: ["feature"], issueType: null, ...extra };
}

function run(root: string, gh: FakeGh, apply: boolean): MigrationReport {
    return migrateFeatures({ root, setting: resolveFeatureSetting(root), apply, gh });
}

function snapshot(dir: string): string {
    const out: string[] = [];
    const walk = (d: string): void => {
        for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const p: string = path.join(d, e.name);
            if (e.isDirectory()) walk(p);
            else out.push(`${p}\n${fs.readFileSync(p, "utf8")}`);
        }
    };
    walk(dir);
    return out.join("\n");
}

describe("migrate — preconditions (D9)", () => {
    it("refuses before reading any issue when the repository has not opted in (G22)", () => {
        const gh = new FakeGh();
        const report = run(repoWith("  classification: labels\n", { alpha: readme("Alpha", "Does alpha.") }), gh, false);
        expect(report.refused).toMatch(/github\.features/);
        expect(gh.listCalls).toBe(0);
    });

    it("refuses and names the missing feature type under issue-type mode, never falling back to a label (G22)", () => {
        const gh = new FakeGh();
        const root = repoWith("  classification: types\n  epic-type: Epic\n  story-type: Story\n  features: types\n", { alpha: readme("Alpha", "Does alpha.") });
        const report = run(root, gh, true);
        expect(report.refused).toMatch(/feature-type/);
        expect(gh.listCalls).toBe(0);
        expect(gh.filed).toEqual([]);
    });
});

describe("migrate — feature filing (#1046)", () => {
    it("without --apply files nothing and lists every feature issue it would file (G1)", () => {
        const gh = new FakeGh();
        const report = run(repoWith(OPTED_IN, { alpha: readme("Alpha", "Does alpha."), beta: readme("Beta", "Does beta.") }), gh, false);
        expect(gh.filed).toEqual([]);
        expect(report.features.filter((f) => f.action === "file").map((f) => f.path)).toEqual(["docs/features/alpha", "docs/features/beta"]);
        expect(report.lines.join("\n")).toContain("docs/features/alpha");
    });

    it("with --apply files one feature issue per folder, closed (#1061 D9 replaces #999 D7), titled with the name and carrying the statement (G4, G7, G17)", () => {
        const gh = new FakeGh();
        const report = run(repoWith(OPTED_IN, { alpha: readme("Alpha", "Does alpha."), beta: readme("Beta", "Does beta.") }), gh, true);
        expect(gh.filed.map((f) => [f.name, f.statement])).toEqual([["Alpha", "Does alpha."], ["Beta", "Does beta."]]);
        expect(gh.issues.map((i) => parseFeaturePath(i.body))).toEqual(["docs/features/alpha", "docs/features/beta"]);
        expect(gh.issues.every((i) => i.state === "closed")).toBe(true);
        expect(report.complete).toBe(true);
    });

    it("a second run files no further feature issue (G5)", () => {
        const gh = new FakeGh();
        const root = repoWith(OPTED_IN, { alpha: readme("Alpha", "Does alpha.") });
        run(root, gh, true);
        const again = run(root, gh, true);
        expect(gh.filed).toHaveLength(1);
        expect(again.features[0]).toMatchObject({ action: "reuse", issue: 500 });
    });

    it("reuses a feature issue #998 filed, open or closed, and leaves its state alone (G5, G17)", () => {
        const gh = new FakeGh([featureIssue(42, "docs/features/alpha", { state: "closed" })]);
        const report = run(repoWith(OPTED_IN, { alpha: readme("Alpha", "Does alpha.") }), gh, true);
        expect(gh.filed).toEqual([]);
        expect(report.features[0]).toMatchObject({ action: "reuse", issue: 42 });
        expect(gh.issues[0].state).toBe("closed");
    });

    it("finds a feature issue carrying the retired label, files no second one, and leaves the label (G23)", () => {
        const gh = new FakeGh([featureIssue(42, "docs/features/alpha", { labels: ["feature", "retired-feature"] })]);
        const report = run(repoWith(OPTED_IN, { alpha: readme("Alpha", "Does alpha.") }), gh, true);
        expect(gh.filed).toEqual([]);
        expect(report.features[0]).toMatchObject({ action: "reuse", issue: 42, retired: true });
        expect(gh.issues[0].labels).toEqual(["feature", "retired-feature"]);
    });

    it("after an interruption files only the feature issues still missing, with or without the local ledger (G6)", () => {
        const gh = new FakeGh();
        gh.failAfter = 1;
        const root = repoWith(OPTED_IN, { alpha: readme("Alpha", "Does alpha."), beta: readme("Beta", "Does beta.") });
        const first = run(root, gh, true);
        expect(first.complete).toBe(false);
        fs.rmSync(path.join(root, ".nexus", "tmp"), { recursive: true, force: true });
        gh.failAfter = null;
        run(root, gh, true);
        expect(gh.filed.map((f) => f.name)).toEqual(["Alpha", "Beta"]);
    });

    it("reports a folder two feature issues record as ambiguous, files nothing for it, and goes on (D2)", () => {
        const gh = new FakeGh([featureIssue(42, "docs/features/alpha"), featureIssue(43, "docs/features/alpha")]);
        const report = run(repoWith(OPTED_IN, { alpha: readme("Alpha", "Does alpha."), beta: readme("Beta", "Does beta.") }), gh, true);
        expect(report.features[0]).toMatchObject({ action: "ambiguous", issues: [42, 43] });
        expect(gh.filed.map((f) => f.name)).toEqual(["Beta"]);
        expect(report.complete).toBe(false);
    });

    it("reports a folder with no capability statement and files no issue for it (G7)", () => {
        const gh = new FakeGh();
        const report = run(repoWith(OPTED_IN, { alpha: `---\nfeature: "Alpha"\n---\n\n# Alpha\n\n## Epics\n` }), gh, true);
        expect(report.features[0].action).toBe("no-statement");
        expect(gh.filed).toEqual([]);
    });

    it("takes the statement from the features index when the README has none (D3)", () => {
        const gh = new FakeGh();
        const root = repoWith(OPTED_IN, { alpha: `# Alpha\n\n## Epics\n` });
        fs.appendFileSync(path.join(root, "docs", "features", "README.md"), "\n- [Alpha](alpha/README.md) — Does alpha from the index.\n");
        run(root, gh, true);
        expect(gh.filed[0]).toMatchObject({ name: "Alpha", statement: "Does alpha from the index." });
    });

    it("without --apply writes nothing in the feature folders (#1061 G33)", () => {
        const gh = new FakeGh();
        const root = repoWith(OPTED_IN, { alpha: readme("Alpha", "Does alpha.") });
        const before: string = snapshot(path.join(root, "docs"));
        run(root, gh, false);
        expect(snapshot(path.join(root, "docs"))).toBe(before);
    });
});

describe("the README pointer line (epic #1000, story #1058, decision record #1061 D11)", () => {
    const alphaReadme: string = readme("Alpha", "Does alpha.");

    it("with --apply adds one line to each README pointing to its feature issue, and changes nothing else", () => {
        const gh = new FakeGh([featureIssue(42, "docs/features/beta")]);
        const root = repoWith(OPTED_IN, { alpha: alphaReadme, beta: readme("Beta", "Does beta.") });
        const index: string = fs.readFileSync(path.join(root, "docs", "features", "README.md"), "utf8");
        run(root, gh, true);
        const alpha: string = fs.readFileSync(path.join(root, "docs", "features", "alpha", "README.md"), "utf8");
        const beta: string = fs.readFileSync(path.join(root, "docs", "features", "beta", "README.md"), "utf8");
        expect(beta).toMatch(/#42\b/);
        expect(alpha).toMatch(/#500\b/);
        expect(beta.split("\n").filter((l) => !readme("Beta", "Does beta.").split("\n").includes(l))).toHaveLength(1);
        expect(fs.readFileSync(path.join(root, "docs", "features", "README.md"), "utf8")).toBe(index);
    });

    it("a repeated --apply run adds no second line", () => {
        const gh = new FakeGh([featureIssue(42, "docs/features/alpha")]);
        const root = repoWith(OPTED_IN, { alpha: alphaReadme });
        run(root, gh, true);
        const once: string = fs.readFileSync(path.join(root, "docs", "features", "alpha", "README.md"), "utf8");
        run(root, gh, true);
        expect(fs.readFileSync(path.join(root, "docs", "features", "alpha", "README.md"), "utf8")).toBe(once);
        expect(once.match(/#42\b/g)).toHaveLength(1);
    });
});

describe("the migration files feature issues closed (story #1059, decision record #1061 D9)", () => {
    it("closes each feature issue it files before it reports complete, and no other", () => {
        const gh = new FakeGh([featureIssue(42, "docs/features/beta")]);
        const root = repoWith(OPTED_IN, { alpha: readme("Alpha", "Does alpha."), beta: readme("Beta", "Does beta.") });
        run(root, gh, true);
        expect(gh.closed).toEqual([500]);
        expect(gh.issues.find((i) => i.number === 500)?.state).toBe("closed");
        expect(gh.issues.find((i) => i.number === 42)?.state).toBe("open");
    });
});

describe("a migration close that fails, and its repeat (decision record #1061 G23)", () => {
    it("reports the run incomplete when a feature issue it filed could not be closed", () => {
        const gh = new FakeGh();
        gh.closeFails = true;
        const root = repoWith(OPTED_IN, { alpha: readme("Alpha", "Does alpha.") });
        const report = run(root, gh, true);
        expect(gh.filed).toHaveLength(1);
        expect(report.complete).toBe(false);
    });

    it("reports the run incomplete when its ledger's open issue cannot be closed, even though new filings succeed", () => {
        const gh = new FakeGh([featureIssue(77, "docs/features/alpha")]);
        gh.closeFailsFor = [77];
        const root = repoWith(OPTED_IN, { alpha: readme("Alpha", "Does alpha."), beta: readme("Beta", "Does beta.") });
        fs.mkdirSync(path.join(root, MIGRATION_DIR), { recursive: true });
        fs.writeFileSync(path.join(root, MIGRATION_DIR, LEDGER_FILE), JSON.stringify({ [featureRef("docs/features/alpha")]: { number: 77 } }));
        const report = run(root, gh, true);
        expect(gh.filed).toHaveLength(1);
        expect(gh.issues.find((i) => i.number === 77)?.state).toBe("open");
        expect(report.complete).toBe(false);
    });

    it("a repeat closes the open feature issue its own ledger records, and files none", () => {
        const gh = new FakeGh([featureIssue(77, "docs/features/alpha")]);
        const root = repoWith(OPTED_IN, { alpha: readme("Alpha", "Does alpha.") });
        fs.mkdirSync(path.join(root, MIGRATION_DIR), { recursive: true });
        fs.writeFileSync(path.join(root, MIGRATION_DIR, LEDGER_FILE), JSON.stringify({ [featureRef("docs/features/alpha")]: { number: 77 } }));
        const report = run(root, gh, true);
        expect(gh.filed).toEqual([]);
        expect(gh.closed).toEqual([77]);
        expect(report.complete).toBe(true);
    });

    it("leaves a reused feature issue its ledger does not record in its state", () => {
        const gh = new FakeGh([featureIssue(42, "docs/features/alpha")]);
        const root = repoWith(OPTED_IN, { alpha: readme("Alpha", "Does alpha.") });
        run(root, gh, true);
        expect(gh.closed).toEqual([]);
    });
});

describe("the migration under features: types (decision record #1061 D3, G10)", () => {
    const TYPED = "  classification: labels\n  features: types\n  feature-type: Feature\n";

    it("refuses and files nothing when the epic repository lacks the named feature type", () => {
        const gh = new FakeGh();
        gh.issueTypes = ["Story"];
        const root = repoWith(TYPED, { alpha: readme("Alpha", "Does alpha.") });
        const report = run(root, gh, true);
        expect(report.refused).toMatch(/Feature/);
        expect(report.complete).toBe(false);
        expect(gh.filed).toEqual([]);
    });

    it("files when the type exists", () => {
        const gh = new FakeGh();
        gh.issueTypes = ["Feature"];
        const root = repoWith(TYPED, { alpha: readme("Alpha", "Does alpha.") });
        run(root, gh, true);
        expect(gh.filed).toHaveLength(1);
    });
});
