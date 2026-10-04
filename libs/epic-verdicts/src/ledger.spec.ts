import { describe, expect, it } from "vitest";
import {
    SHIPPED_MARKER,
    collectShippedRecords,
    fetchShippedRecords,
    parseShippedRecord,
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

/**
 * A record body as analyze's post-merge run wrote it until epic #828 retired the write (story
 * #843). Records like this are still on the issues of epics in flight, and are still read.
 */
function renderShippedRecord(record: ShippedRecord): string {
    const key = shippedRecordKey(record.repo, record.pr);
    const f = record.findings;
    return [
        SHIPPED_MARKER,
        `<!-- nexus:shipped-key ${key} -->`,
        "",
        `**Shipped** — ${key} merged as \`${record.mergeCommit}\`, covering ${record.stories.map((s) => `#${s}`).join(", ") || "no story"}.`,
        "",
        "```yaml",
        `epic: "${record.epic}"`,
        `stories: [${record.stories.join(", ")}]`,
        `repo: ${record.repo}`,
        `pr: ${record.pr}`,
        `merge_commit: ${record.mergeCommit}`,
        `merged_at: ${record.mergedAt}`,
        `range: { base: ${record.base}, head: ${record.head} }`,
        `findings: { critical: ${f.critical}, high: ${f.high}, medium: ${f.medium}, low: ${f.low} }`,
        `record_hash: ${record.recordHash ?? ""}`,
        `nexus_version: ${record.nexusVersion ?? ""}`,
        "```",
        "",
    ].join("\n");
}

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
