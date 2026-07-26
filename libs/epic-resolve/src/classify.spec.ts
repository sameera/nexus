import { describe, expect, it } from "vitest";
import { classifySubIssue, resolveRecordClassification } from "./classify.js";
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
        // Every call is the shared resolver, invoked against the target repo root.
        expect(calls.length).toBe(3);
        for (const call of calls) {
            expect(call[0]).toBe("python3");
            expect(call.join(" ")).toContain("nxs-gh-shared/delivery_config.py");
            expect(call.join(" ")).toContain("--root /repo");
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
