/**
 * The feature issue's rules (epic #998, decision record #1010): the opt-in and marker, the lookup, and
 * the work item a new feature issue is filed from.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
    type FeatureIssueRef,
    type FeatureSetting,
    describeLookup,
    featureRef,
    lookupFeature,
    parseFeaturePath,
    readLedgerNumber,
    renderFeatureWorkItem,
    resolveFeatureSetting,
} from "./feature-issue.js";

function repoWith(github: string): string {
    const root: string = fs.mkdtempSync(path.join(os.tmpdir(), "feature-issue-"));
    fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(path.join(root, ".nexus", "config", "settings.yml"), `github:\n${github}`);
    return root;
}

const FEATURE_PATH = "docs/features/issue-sourced-planning";

function issue(number: number, featurePath: string | null, over: Partial<FeatureIssueRef> = {}): FeatureIssueRef {
    const meta: string = featurePath === null ? "" : renderFeatureWorkItem("F", "S", featurePath).content;
    return { number, state: "open", body: meta, labels: ["feature"], issueType: null, ...over };
}

describe("resolveFeatureSetting — what a repository declares about features as issues", () => {
    it("is off unless github.features is types or labels, whatever markers it declares, and the retired switch changes nothing (G1, G2)", () => {
        for (const github of ["  classification: labels\n", "  classification: labels\n  features: docs\n  feature-label: feature\n", "  classification: labels\n  features-as-issues: true\n"]) {
            expect(resolveFeatureSetting(repoWith(github))).toEqual({ state: "off" });
        }
    });

    it("is on with the built-in label, or the declared one, under label mode", () => {
        const builtin = resolveFeatureSetting(repoWith("  classification: labels\n  features: labels\n"));
        expect(builtin.state === "on" && builtin.label).toBe("feature");
        const declared = resolveFeatureSetting(repoWith("  classification: labels\n  features: labels\n  feature-label: capability\n"));
        expect(declared.state === "on" && declared.label).toBe("capability");
    });

    it("is on with the declared issue type under type mode", () => {
        const typed = resolveFeatureSetting(
            repoWith("  classification: types\n  epic-type: Epic\n  story-type: Story\n  features: types\n  feature-type: Feature\n"),
        );
        expect(typed.state === "on" && typed.type).toBe("Feature");
    });

    it("reports one line naming the missing setting under type mode with no feature type (G4)", () => {
        const none = resolveFeatureSetting(
            repoWith("  classification: types\n  epic-type: Epic\n  story-type: Story\n  features: types\n"),
        );
        expect(none.state).toBe("no-type");
        if (none.state !== "no-type") return;
        expect(none.message).toContain("github.feature-type");
        expect(none.message).not.toContain("\n");
    });
});

describe("lookupFeature — finding a feature's issue (D5, G8, G9, G12)", () => {
    const on: FeatureSetting = resolveFeatureSetting(repoWith("  classification: labels\n  features: labels\n"));
    const never = (): never => {
        throw new Error("no call was expected");
    };
    const input = (over: Partial<Parameters<typeof lookupFeature>[0]> = {}) => ({
        setting: on,
        featurePath: FEATURE_PATH,
        ledgerNumber: null,
        namedNumber: null,
        readIssue: () => null,
        listIssues: () => [] as FeatureIssueRef[],
        ...over,
    });

    it("makes no call at all when features are kept in the docs tree (G1)", () => {
        const off = lookupFeature(input({ setting: { state: "off" }, readIssue: never, listIssues: never }));
        expect(off).toEqual({ outcome: "off" });
    });

    it("files a new feature issue for a feature with no issue and no README", () => {
        expect(lookupFeature(input()).outcome).toBe("file-new");
    });

    it("files a new feature issue for a path with no issue, README or not (#1061 D7, retiring #998 G12)", () => {
        expect(lookupFeature(input()).outcome).toBe("file-new");
    });

    it("reuses the issue its listing matches on the recorded feature path, even after a rename", () => {
        const found = lookupFeature(input({ listIssues: () => [issue(41, "docs/features/other"), issue(42, FEATURE_PATH, { state: "closed" })] }));
        expect(found).toEqual({ outcome: "reuse", issue: 42, state: "closed", source: "listing" });
    });

    it("reuses the run's own ledger entry on a repeat without listing anything", () => {
        const found = lookupFeature(input({ ledgerNumber: 7, readIssue: () => issue(7, FEATURE_PATH), listIssues: never }));
        expect(found).toEqual({ outcome: "reuse", issue: 7, state: "open", source: "ledger" });
    });

    it("reuses the feature issue a promoted stub names", () => {
        const found = lookupFeature(input({ namedNumber: 9, readIssue: () => issue(9, FEATURE_PATH), listIssues: never }));
        expect(found).toEqual({ outcome: "reuse", issue: 9, state: "open", source: "named" });
    });

    it("stops on a named issue that does not read as a feature", () => {
        const found = lookupFeature(input({ namedNumber: 9, readIssue: () => issue(9, FEATURE_PATH, { labels: ["epic"] }) }));
        expect(found).toEqual({ outcome: "not-a-feature", issue: 9 });
    });

    it("stops on two matching issues, naming both", () => {
        const found = lookupFeature(input({ listIssues: () => [issue(52, FEATURE_PATH), issue(51, FEATURE_PATH)] }));
        expect(found).toEqual({ outcome: "ambiguous", issues: [51, 52] });
        expect(describeLookup(found, FEATURE_PATH)).toMatch(/#51 and #52/);
    });

    it("does not count an issue that carries another kind's marker beside the feature marker", () => {
        const found = lookupFeature(input({ listIssues: () => [issue(60, FEATURE_PATH, { labels: ["feature", "epic"] })] }));
        expect(found.outcome).toBe("file-new");
    });

    it("tells the lead whether a new issue is filed or which existing one is used", () => {
        expect(describeLookup({ outcome: "file-new" }, FEATURE_PATH)).toMatch(/new feature issue will be filed/);
        expect(describeLookup({ outcome: "reuse", issue: 42, state: "closed", source: "listing" }, FEATURE_PATH)).toMatch(/#42 \(closed\)/);
        expect(describeLookup({ outcome: "off" }, FEATURE_PATH)).toBe("");
    });
});

describe("renderFeatureWorkItem — the feature issue's work item (G10, G11)", () => {
    it("is titled with the feature name and holds the capability statement and the feature path", () => {
        const item = renderFeatureWorkItem("Issue-Sourced Planning", "Plan a feature from its issue.", FEATURE_PATH);
        expect(item.content).toContain('title: "Issue-Sourced Planning"');
        expect(item.content).toContain("Plan a feature from its issue.");
        expect(parseFeaturePath(item.content)).toBe(FEATURE_PATH);
    });

    it("names no parent and no label, so only the feature marker is added at filing", () => {
        const frontmatter: string = renderFeatureWorkItem("F", "S", FEATURE_PATH).content.split("---")[1];
        expect(frontmatter).not.toMatch(/^parent:/m);
        expect(frontmatter).not.toMatch(/^labels:/m);
    });

    it("files each distinct feature path under its own ref", () => {
        expect(featureRef(FEATURE_PATH)).not.toBe(featureRef("docs/features/other"));
        expect(renderFeatureWorkItem("F", "S", FEATURE_PATH).fileName).toMatch(/^STORY-.*\.md$/);
    });
});

describe("readLedgerNumber — a repeat finds the issue it filed", () => {
    it("reads the number the feature batch's ledger holds for the path, and nothing for an absent one", () => {
        const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "feature-ledger-"));
        const file: string = path.join(dir, ".nxs-created.json");
        fs.writeFileSync(file, JSON.stringify({ [featureRef(FEATURE_PATH)]: { number: "77", url: "u", title: "t" } }));
        expect(readLedgerNumber(file, FEATURE_PATH)).toBe(77);
        expect(readLedgerNumber(file, "docs/features/other")).toBeNull();
        expect(readLedgerNumber(path.join(dir, "missing.json"), FEATURE_PATH)).toBeNull();
    });
});
