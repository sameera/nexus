import { describe, expect, it } from "vitest";
import {
    SHIPPED_MARKER,
    collectShippedRecords,
    fetchShippedRecords,
    parseShippedRecord,
    postShippedRecord,
    renderShippedRecord,
    shippedRecordKey,
    type ShippedRecord,
} from "./ledger.js";
import { type Runner } from "./run.js";

const RECORD: ShippedRecord = {
    epic: "acme/hub#769",
    stories: [770],
    repo: "acme/member",
    pr: 12,
    mergeCommit: "a".repeat(40),
    mergedAt: "2026-09-10T09:00:00Z",
    base: "b".repeat(40),
    head: "a".repeat(40),
    findings: { critical: 0, high: 1, medium: 2, low: 3 },
    recordHash: "deadbeef",
    nexusVersion: "0.73.0",
};

function comment(body: string, opts: { id?: string; association?: string; login?: string } = {}): Record<string, unknown> {
    return {
        id: opts.id ?? "IC_1",
        body,
        authorAssociation: opts.association ?? "OWNER",
        author: { login: opts.login ?? "lead" },
    };
}

describe("the shipped record's body (epic #769)", () => {
    it("names the pull request, the story, the repository it merged in and the range it shipped", () => {
        const body = renderShippedRecord(RECORD);
        const back = parseShippedRecord(body);
        expect(back).toEqual(RECORD);
        expect(body).toContain(SHIPPED_MARKER);
    });

    it("keys a record by the code repository and pull-request number, through the shared identity rule", () => {
        expect(shippedRecordKey("github.com/Acme/Member", 12)).toBe(shippedRecordKey("acme/member", 12));
        expect(shippedRecordKey("acme/member", 12)).not.toBe(shippedRecordKey("acme/member", 13));
        expect(shippedRecordKey("acme/member", 12)).not.toBe(shippedRecordKey("acme/other", 12));
    });

    it("reads no record out of a body carrying no marker", () => {
        expect(parseShippedRecord("just a comment")).toBeNull();
    });
});

describe("collectShippedRecords — trust is the author's association, never the marker (invariant 12)", () => {
    it("keeps a record written by someone who can speak for the issues repository", () => {
        const collected = collectShippedRecords({ comments: [comment(renderShippedRecord(RECORD))] });
        expect(collected.records.map((f) => f.record.pr)).toEqual([12]);
        expect(collected.untrusted).toEqual([]);
    });

    it("names a record whose author cannot, rather than silently ignoring it", () => {
        const collected = collectShippedRecords({
            comments: [comment(renderShippedRecord(RECORD), { association: "NONE", login: "drive-by" })],
        });
        expect(collected.records).toEqual([]);
        expect(collected.untrusted).toEqual([
            { commentId: "IC_1", key: "acme/member#12", author: "drive-by", authorAssociation: "NONE" },
        ]);
    });

    it("reads one record per pull request when the same key was posted twice", () => {
        const older = renderShippedRecord({ ...RECORD, findings: { critical: 9, high: 0, medium: 0, low: 0 } });
        const newer = renderShippedRecord(RECORD);
        const collected = collectShippedRecords({
            comments: [comment(older, { id: "IC_1" }), comment(newer, { id: "IC_2" })],
        });
        expect(collected.records).toHaveLength(1);
        expect(collected.records[0].commentId).toBe("IC_2");
    });
});

describe("postShippedRecord — one record per pull request, replaced in place (invariant 2)", () => {
    function recorder(status = 0): { run: Runner; calls: string[][] } {
        const calls: string[][] = [];
        const run: Runner = (cmd, args) => {
            calls.push([cmd, ...args]);
            return { status, stdout: "", stderr: status === 0 ? "" : "gh: forbidden" };
        };
        return { run, calls };
    }

    it("adds a record when the epic issue carries none for this pull request", () => {
        const { run, calls } = recorder();
        const result = postShippedRecord(run, "/wt", "acme/hub", 769, RECORD, []);
        expect(result.ok && result.action).toBe("created");
        expect(calls[0].slice(0, 5)).toEqual(["gh", "issue", "comment", "769", "--repo"]);
        expect(calls[0][5]).toBe("acme/hub");
    });

    it("replaces that record's body alone on a re-run, leaving every other record untouched", () => {
        const { run, calls } = recorder();
        const existing = collectShippedRecords({
            comments: [
                comment(renderShippedRecord(RECORD), { id: "IC_mine" }),
                comment(renderShippedRecord({ ...RECORD, pr: 13 }), { id: "IC_other" }),
            ],
        }).records;
        const result = postShippedRecord(run, "/wt", "acme/hub", 769, RECORD, existing);
        expect(result.ok && result.action).toBe("updated");
        expect(calls).toHaveLength(1);
        expect(calls[0].join(" ")).toContain("id=IC_mine");
        expect(calls[0].join(" ")).not.toContain("IC_other");
    });

    it("writes on the epic issue in the issues repository even though the pull request merged elsewhere", () => {
        const { run, calls } = recorder();
        postShippedRecord(run, "/member-worktree", "acme/hub", 769, RECORD, []);
        expect(calls[0][calls[0].indexOf("--repo") + 1]).toBe("acme/hub");
        // The code repository is named *in* the record, never used as a target to write against.
        expect(calls[0].filter((a) => a === "acme/member")).toEqual([]);
    });

    it("keeps the composed body and reports the failure when the post does not land (invariant 10)", () => {
        const { run } = recorder(1);
        const result = postShippedRecord(run, "/wt", "acme/hub", 769, RECORD, []);
        expect(result.ok).toBe(false);
        expect(result.body).toContain(SHIPPED_MARKER);
        if (!result.ok) expect(result.error.message).toContain("acme/member#12");
    });
});

describe("fetchShippedRecords", () => {
    it("reads the epic issue's comments in the issues repository", () => {
        const calls: string[][] = [];
        const run: Runner = (cmd, args) => {
            calls.push([cmd, ...args]);
            return { status: 0, stdout: JSON.stringify({ comments: [comment(renderShippedRecord(RECORD))] }), stderr: "" };
        };
        const r = fetchShippedRecords(run, "/wt", "acme/hub", 769);
        expect(r.ok && r.collected.records).toHaveLength(1);
        expect(calls[0]).toEqual(["gh", "issue", "view", "769", "--repo", "acme/hub", "--json", "comments"]);
    });

    it("names the failure rather than reporting an epic with no records", () => {
        const run: Runner = () => ({ status: 1, stdout: "", stderr: "gh: not found" });
        const r = fetchShippedRecords(run, "/wt", "acme/hub", 769);
        expect(r.ok).toBe(false);
    });
});
