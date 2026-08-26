import { describe, expect, it } from "vitest";
import { classifySubIssue, isWithdrawnStory, resolveRecordClassification } from "./classify.js";
import { type RunResult, type Runner } from "./run.js";

/** A Runner that answers the shared publishing resolver's `resolve <key>` calls from a map. */
function resolverRunner(values: Record<string, string>, opts: { fail?: string } = {}): {
    run: Runner;
    calls: string[][];
} {
    const calls: string[][] = [];
    const run: Runner = (cmd: string, args: string[]): RunResult => {
        calls.push([cmd, ...args]);
        const key = args[args.indexOf("resolve") + 1];
        if (opts.fail === key) return { status: 1, stdout: "", stderr: "boom" };
        return { status: 0, stdout: (values[key] ?? "") + "\n", stderr: "" };
    };
    return { run, calls };
}

describe("resolveRecordClassification — the one shared publishing resolver, across a process seam", () => {
    it("takes the mode and the record names from the resolver, reading no config itself", () => {
        const { run, calls } = resolverRunner({
            classification: "labels",
            "record-label": "decision-record",
            "record-type": "Decision Record",
        });
        const r = resolveRecordClassification(run, "/repo");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.classification).toEqual({
            mode: "labels",
            recordLabel: "decision-record",
            recordType: "Decision Record",
        });
        // Every call names the Python toolkit's resolver capability and targets the repo root —
        // and no call names a path inside that repo (story #300).
        expect(calls.length).toBe(3);
        for (const call of calls) {
            expect(call.join(" ")).toContain("config resolve");
            expect(call.join(" ")).toContain("--root /repo");
            expect(call.join(" ")).not.toContain("/repo/.claude");
        }
    });

    it("treats an unset mode as the resolver's legacy-auto default", () => {
        const { run } = resolverRunner({
            classification: "",
            "record-label": "decision-record",
            "record-type": "Decision Record",
        });
        const r = resolveRecordClassification(run, "/repo");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.classification.mode).toBe("legacy-auto");
    });

    it("reports a named diagnostic when the resolver cannot be invoked", () => {
        const { run } = resolverRunner({}, { fail: "classification" });
        const r = resolveRecordClassification(run, "/repo");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("record-classification-unresolved");
    });

    it("reports a named diagnostic when the resolver yields no record label", () => {
        const { run } = resolverRunner({ classification: "labels", "record-label": "", "record-type": "X" });
        const r = resolveRecordClassification(run, "/repo");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("record-classification-unresolved");
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
