import { describe, expect, it } from "vitest";
import { ledgerCloseGate, sumLedgerFindings } from "./close-ledger.js";
import { type ShippedRecord } from "./ledger.js";
import { type Runner } from "./run.js";

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

/** A platform that reports each pull request's merge commit, and records which repo it was asked. */
function platform(commits: Record<string, string | null>): { run: Runner; asked: string[] } {
    const asked: string[] = [];
    const run: Runner = (cmd, args) => {
        const repo = args[args.indexOf("--repo") + 1];
        const pr = args[2];
        asked.push(`${repo}#${pr}`);
        const oid = commits[`${repo}#${pr}`];
        if (oid === undefined) return { status: 1, stdout: "", stderr: "gh: not found" };
        return { status: 0, stdout: oid === null ? "" : oid, stderr: "" };
    };
    return { run, asked };
}

describe("ledgerCloseGate — merge state and range from the epic's record (epic #769)", () => {
    it("reports pull requests that merged in another repository as merged", () => {
        const { run } = platform({ "acme/member#10": "merge-10", "acme/other#11": "merge-11" });
        const gate = ledgerCloseGate(run, "/hub", {
            stories: [770, 771],
            records: [record([770], 10, "acme/member"), record([771], 11, "acme/other")],
        });
        expect(gate.ok).toBe(true);
        expect(gate.merged.every((m) => m.merged)).toBe(true);
        expect(gate.merged.map((m) => `${m.repo}#${m.pr}`)).toEqual(["acme/member#10", "acme/other#11"]);
    });

    it("attributes each range entry to the repository its record names, not the one close ran from", () => {
        const { run } = platform({ "acme/member#10": "merge-10" });
        const gate = ledgerCloseGate(run, "/hub", { stories: [770], records: [record([770], 10, "acme/member")] });
        expect(gate.range).toEqual([{ repo: "acme/member", pr: 10, base: "base-10", head: "merge-10" }]);
        expect(gate.range.some((e) => e.repo === "acme/hub")).toBe(false);
    });

    it("blocks and names the pull request whose merge commit the platform no longer reports", () => {
        const { run } = platform({ "acme/member#10": "a-different-commit" });
        const gate = ledgerCloseGate(run, "/hub", { stories: [770], records: [record([770], 10)] });
        expect(gate.ok).toBe(false);
        expect(gate.blocking).toEqual([
            { kind: "merge-commit-moved", repo: "acme/member", pr: 10, recorded: "merge-10", reported: "a-different-commit" },
        ]);
    });

    it("blocks when the platform reports no merge commit at all for a recorded pull request", () => {
        const { run } = platform({ "acme/member#10": null });
        const gate = ledgerCloseGate(run, "/hub", { stories: [770], records: [record([770], 10)] });
        expect(gate.ok).toBe(false);
        expect(gate.blocking[0]).toMatchObject({ kind: "merge-commit-moved", reported: null });
    });

    it("blocks and names a story with no recorded merged pull request", () => {
        const { run } = platform({ "acme/member#10": "merge-10" });
        const gate = ledgerCloseGate(run, "/hub", { stories: [770, 771], records: [record([770], 10)] });
        expect(gate.ok).toBe(false);
        expect(gate.blocking).toEqual([{ kind: "story-unrecorded", story: 771 }]);
    });

    it("does not block on a story marked as shipping without a pull request of its own", () => {
        const { run } = platform({ "acme/member#10": "merge-10" });
        const gate = ledgerCloseGate(run, "/hub", { stories: [770, 771], excluded: [771], records: [record([770], 10)] });
        expect(gate.ok).toBe(true);
    });

    it("asks each repository about its own pull request, never the repository close was started from", () => {
        const { run, asked } = platform({ "acme/member#10": "merge-10", "acme/other#11": "merge-11" });
        ledgerCloseGate(run, "/hub", {
            stories: [770, 771],
            records: [record([770], 10, "acme/member"), record([771], 11, "acme/other")],
        });
        expect(asked).toEqual(["acme/member#10", "acme/other#11"]);
    });
});

describe("a story that shipped as several pull requests contributes all of them (epic #769, story #774)", () => {
    function at(pr: number, mergedAt: string, repo = "acme/member"): ShippedRecord {
        return { ...record([770], pr, repo), mergedAt };
    }

    it("covers the commits of both, and the earlier one is not displaced by the later", () => {
        const feature = at(10, "2026-09-01T00:00:00Z");
        const fix = at(11, "2026-09-08T00:00:00Z");
        const { run } = platform({ "acme/member#10": "merge-10", "acme/member#11": "merge-11" });
        const gate = ledgerCloseGate(run, "/hub", { stories: [770], records: [feature, fix] });
        expect(gate.ok).toBe(true);
        expect(gate.range).toEqual([
            { repo: "acme/member", pr: 10, base: "base-10", head: "merge-10" },
            { repo: "acme/member", pr: 11, base: "base-11", head: "merge-11" },
        ]);
    });

    it("orders two of one story's pull requests in the same repository by which merged first", () => {
        // Numbered in one order, merged in the other — it is the merge order the range follows.
        const later = at(10, "2026-09-08T00:00:00Z");
        const earlier = at(11, "2026-09-01T00:00:00Z");
        const { run } = platform({ "acme/member#10": "merge-10", "acme/member#11": "merge-11" });
        const gate = ledgerCloseGate(run, "/hub", { stories: [770], records: [later, earlier] });
        expect(gate.range.map((e) => e.pr)).toEqual([11, 10]);
        expect(gate.merged.map((m) => m.pr)).toEqual([11, 10]);
    });
});

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
