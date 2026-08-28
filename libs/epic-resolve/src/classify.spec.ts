import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { classifySubIssue, isWithdrawnStory, resolveRecordClassification } from "./classify.js";

/** A checkout declaring `settings` — the only thing the resolver reads. */
function repoWith(settings: string): string {
    const root: string = fs.mkdtempSync(path.join(os.tmpdir(), "classify-"));
    fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(path.join(root, ".nexus", "config", "settings.yml"), settings);
    return root;
}

describe("resolveRecordClassification — the one shared publishing resolver, called in process", () => {
    it("takes the mode and the record names from the resolver, reading no config itself", () => {
        const r = resolveRecordClassification(
            repoWith("github:\n  classification: labels\n  record-label: decision-record\n  record-type: Decision Record\n"),
        );
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.classification).toEqual({
            mode: "labels",
            recordLabel: "decision-record",
            recordType: "Decision Record",
        });
    });

    it("treats an unset mode as the resolver's legacy-auto default", () => {
        const r = resolveRecordClassification(repoWith("github:\n  project: none\n"));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.classification.mode).toBe("legacy-auto");
    });

    it("takes the record names from the resolver's built-ins when none are declared", () => {
        const r = resolveRecordClassification(repoWith("github:\n  project: none\n"));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.classification.recordLabel).toBe("decision-record");
        expect(r.classification.recordType).toBe("Decision Record");
    });

    it("resolves without spawning anything, from a checkout with nothing installed", () => {
        const root: string = fs.mkdtempSync(path.join(os.tmpdir(), "classify-bare-"));
        const r = resolveRecordClassification(root);
        expect(r.ok).toBe(true);
    });
});

describe("classifySubIssue — record-positive, everything else is a story", () => {
    const labels = { mode: "labels" as const, recordLabel: "decision-record", recordType: "Decision Record" };
    const types = { mode: "types" as const, recordLabel: "decision-record", recordType: "Decision Record" };
    const legacy = { mode: "legacy-auto" as const, recordLabel: "decision-record", recordType: "Decision Record" };

    it("classifies by the configured label when the mode is label-based", () => {
        expect(classifySubIssue(labels, { labels: ["decision-record"], issueType: null })).toBe("record");
        expect(classifySubIssue(labels, { labels: ["story", "pipeline"], issueType: null })).toBe("story");
    });

    it("matches the label case-insensitively, as GitHub's own label namespace is", () => {
        // Label names are case-insensitively unique on GitHub, and `gh label create --force`
        // updates an existing label without renaming it — so a repo that already carried
        // `Decision-Record` reads back with that casing. An exact match would drop the record
        // into the story set silently.
        expect(classifySubIssue(labels, { labels: ["Decision-Record"], issueType: null })).toBe("record");
        expect(classifySubIssue(labels, { labels: ["DECISION-RECORD"], issueType: null })).toBe("record");
        expect(classifySubIssue(legacy, { labels: ["Decision-Record"], issueType: null })).toBe("record");
        // Still record-positive: a differently-named label is a story, whatever its casing.
        expect(classifySubIssue(labels, { labels: ["Decision Record"], issueType: null })).toBe("story");
    });

    it("ignores a matching issue type when the mode is label-based", () => {
        expect(classifySubIssue(labels, { labels: [], issueType: "Decision Record" })).toBe("story");
    });

    it("classifies by the configured issue type when the mode is type-based", () => {
        expect(classifySubIssue(types, { labels: [], issueType: "Decision Record" })).toBe("record");
        expect(classifySubIssue(types, { labels: ["decision-record"], issueType: "Story" })).toBe("story");
    });

    it("matches the issue type case-insensitively", () => {
        expect(classifySubIssue(types, { labels: [], issueType: "DECISION RECORD" })).toBe("record");
        expect(classifySubIssue(types, { labels: [], issueType: "decision-record" })).toBe("story");
    });

    it("accepts either marker under legacy-auto, which files whichever the repo supports", () => {
        expect(classifySubIssue(legacy, { labels: ["decision-record"], issueType: null })).toBe("record");
        expect(classifySubIssue(legacy, { labels: [], issueType: "Decision Record" })).toBe("record");
        expect(classifySubIssue(legacy, { labels: ["story"], issueType: "Story" })).toBe("story");
    });
});

describe("isWithdrawnStory — a cancelled story is not live scope", () => {
    it("recognises the withdrawal labels", () => {
        expect(isWithdrawnStory(["story", "wontfix"], "OPEN", "")).toBe(true);
        expect(isWithdrawnStory(["story", "invalid"], "OPEN", "")).toBe(true);
    });

    it("leaves an ordinary story alone", () => {
        expect(isWithdrawnStory(["story", "pipeline"], "OPEN", "")).toBe(false);
        expect(isWithdrawnStory([], "OPEN", "")).toBe(false);
    });

    it("folds case, as GitHub's label namespace does", () => {
        expect(isWithdrawnStory(["WontFix"], "OPEN", "")).toBe(true);
        expect(isWithdrawnStory(["INVALID"], "OPEN", "")).toBe(true);
    });

    it("does not treat a merely similar label as withdrawal", () => {
        // Withdrawal drops work out of the epic, so the marker is exact — never a substring or a
        // prefix, or `wontfix-followup` would silently delete live scope.
        expect(isWithdrawnStory(["wontfix-followup"], "OPEN", "")).toBe(false);
        expect(isWithdrawnStory(["invalidated-assumption"], "OPEN", "")).toBe(false);
    });

    it("treats a closure reason of not planned or duplicate as withdrawal too", () => {
        expect(isWithdrawnStory([], "CLOSED", "NOT_PLANNED")).toBe(true);
        expect(isWithdrawnStory([], "CLOSED", "DUPLICATE")).toBe(true);
    });

    it("never treats completion as withdrawal — a delivered story is closed too", () => {
        expect(isWithdrawnStory([], "CLOSED", "COMPLETED")).toBe(false);
    });

    it("leaves a plain close with no cancellation reason alone", () => {
        expect(isWithdrawnStory([], "CLOSED", "")).toBe(false);
    });

    it("does not withdraw on the reason alone while the story is still open", () => {
        // A reason is only recordable at closure; while open, the label is the only signal.
        expect(isWithdrawnStory([], "OPEN", "NOT_PLANNED")).toBe(false);
    });

    it("folds case on the closure reason, as GitHub's enum casing is not to be trusted verbatim", () => {
        expect(isWithdrawnStory([], "closed", "not_planned")).toBe(true);
    });

    it("withdraws when either signal alone suffices, and combining them changes nothing", () => {
        expect(isWithdrawnStory(["wontfix"], "CLOSED", "NOT_PLANNED")).toBe(true);
    });
});
