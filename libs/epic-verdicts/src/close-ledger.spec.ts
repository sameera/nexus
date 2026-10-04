import { describe, expect, it } from "vitest";
import { sumLedgerFindings } from "./close-ledger.js";
import { type ShippedRecord } from "./ledger.js";

function record(stories: number[], pr: number, repo = "acme/member", mergeCommit = `merge-${pr}`): ShippedRecord {
    return {
        epic: "acme/hub#769",
        stories,
        repo,
        pr,
        mergeCommit,
        mergedAt: "2026-09-10T00:00:00Z",
        base: `base-${pr}`,
        head: mergeCommit,
        findings: { critical: 0, high: 0, medium: 0, low: 0 },
        recordHash: null,
        nexusVersion: null,
    };
}

describe("sumLedgerFindings — findings summed once per record (epic #769, invariant 13)", () => {
    function withFindings(pr: number, high: number, stories = [770], repo = "acme/member"): ShippedRecord {
        return { ...record(stories, pr, repo), findings: { critical: 0, high, medium: 0, low: 0 } };
    }

    it("counts each pull request of a story that shipped in two", () => {
        expect(sumLedgerFindings([withFindings(10, 2), withFindings(11, 3)]).high).toBe(5);
    });

    it("counts a record naming two stories once", () => {
        expect(sumLedgerFindings([withFindings(10, 4, [770, 771])]).high).toBe(4);
    });

    it("counts one pull request once however many times it is handed over", () => {
        const one = withFindings(10, 4);
        expect(sumLedgerFindings([one, { ...one, repo: "github.com/Acme/Member" }]).high).toBe(4);
    });
});
