/**
 * The largest verdict published on this repository before the release, re-rendered in the new
 * layout (epic #923, decision record #949, R1, G8, G24). `fixtures/pr-874-verdict.md` is the
 * verdict analyze published on pull request #874 (epic #829): six stories, 81 results, five items,
 * 46,731 characters in the old layout.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { type Judgments, parseJudgmentsBlock } from "@nexus/pr-acceptance/judgments-block";
import { parseReceiptBlock } from "@nexus/pr-acceptance/verify";
import { type AnswerScope, mergeAnswerRun } from "./answer-scope.js";
import { mergePrecheck } from "./merge-precheck.js";
import { readPrVerdict } from "./pr-verdict.js";
import { type Runner } from "./run.js";
import { VERDICT_SIZE_LIMIT } from "./publish-check.js";
import { applyAnswers } from "./verdict-items.js";
import { type VerdictFacts, missingFields, renderVerdict } from "./verdict-render.js";

const OLD = fs.readFileSync(path.join(import.meta.dirname, "fixtures", "pr-874-verdict.md"), "utf8");
const receipt = parseReceiptBlock(OLD)!;
const parsed = parseJudgmentsBlock(OLD);
const earlier = (parsed as { ok: true; judgments: Judgments }).judgments;

const facts: VerdictFacts = {
    epic: { ref: receipt.epic, title: "Analyze owns every judgment, and the engineer answers on the pull request" },
    pr: receipt.pr!,
    repo: receipt.repo!,
    issuesRepo: receipt.issuesRepo!,
    stories: receipt.stories.map((n) => ({ number: n, ref: `#${n}`, title: `Story ${n}` })),
    head: receipt.head,
    date: receipt.date,
    nexusVersion: "0.116.0",
    record: { ref: receipt.record!, hash: receipt.recordHash! },
    epicLevel: { state: earlier.epicLevel ?? "judge", lines: [] },
    concepts: { pages: [], checked: 0, notFound: [] },
    recorded: [],
};

const unchanged: AnswerScope = {
    mode: "unchanged",
    reason: null,
    earlier: { head: receipt.head, at: "2026-10-04T00:00:00Z" },
    changedFiles: [],
    rejudge: { items: [], results: [] },
    unlisted: [],
    lines: ["unchanged head"],
};

describe("the largest pre-release verdict in the new layout (R1)", () => {
    it("is a real verdict with judgments and results", () => {
        expect(parsed.ok).toBe(true);
        expect(earlier.results?.length).toBe(81);
    });

    it("fits the platform's limit in the new layout, with its file lists kept", () => {
        const { body } = renderVerdict({ judgments: earlier, facts, unapplied: [] });
        const size = [...body].length;
        // Measured 2026-10-17: 26,077 characters in the new layout; 46,731 as published in the old one.
        expect(size).toBeLessThan(VERDICT_SIZE_LIMIT);
        expect(size).toBeLessThan([...OLD].length);
    });
});

describe("a --resolve run on a pre-release verdict publishes the new layout (D3, D4; G8, G24)", () => {
    it("keeps every carried item's ID and answer, and refuses none for fields it never had", () => {
        const merged = mergeAnswerRun(earlier, unchanged, null);
        expect(merged.ok).toBe(true);
        const carried = (merged as { ok: true; judgments: Judgments }).judgments;
        const answered = applyAnswers(carried, []);
        expect(missingFields(answered.judgments, new Set())).toEqual([]);
        const { body } = renderVerdict({ judgments: answered.judgments, facts: { ...facts, recorded: unchanged.lines }, unapplied: [] });
        const again = parseJudgmentsBlock(body);
        expect(again.ok).toBe(true);
        const after = (again as { ok: true; judgments: Judgments }).judgments;
        const idsAndAnswers = (j: Judgments): unknown => [...j.items, ...j.findings, ...j.deferred].map((x) => [x.id, x.answer]);
        expect(idsAndAnswers(after)).toEqual(idsAndAnswers(earlier));
        for (const item of [...earlier.items, ...earlier.findings]) expect(body).toContain(item.id);
    });

    it("stamps a receipt the earlier reader takes the same way: same head, record, stories and open counts", () => {
        const { body } = renderVerdict({ judgments: earlier, facts, unapplied: [] });
        const next = parseReceiptBlock(body)!;
        expect({ head: next.head, recordHash: next.recordHash, stories: next.stories, findings: next.findings }).toEqual({
            head: receipt.head,
            recordHash: receipt.recordHash,
            stories: receipt.stories,
            findings: receipt.findings,
        });
    });
});

describe("the merge pre-check and close's verdict reader take the old and the new layout the same way (G24, G25, G26)", () => {
    const payload = (bodies: Array<{ body: string; at: string }>): unknown => ({
        state: "OPEN",
        headRefOid: receipt.head,
        reviews: bodies.map((b) => ({ body: b.body, submittedAt: b.at, authorAssociation: "MEMBER", state: "COMMENTED" })),
        comments: [],
    });
    const runner =
        (doc: unknown): Runner =>
        (cmd, args) => {
            if (cmd === "gh" && args[0] === "pr" && args[1] === "view") return { status: 0, stdout: JSON.stringify(doc), stderr: "" };
            if (cmd === "git") return { status: 0, stdout: "2\n", stderr: "" };
            return { status: 1, stdout: "", stderr: `unexpected: ${cmd} ${args.join(" ")}` };
        };
    const NEW = renderVerdict({ judgments: earlier, facts, unapplied: [] }).body;
    const check = (doc: unknown) => mergePrecheck(runner(doc), "/repo", receipt.pr!, receipt.repo!, receipt.issuesRepo!);
    const read = (doc: unknown) => readPrVerdict(runner(doc), "/repo", receipt.pr!, receipt.repo!, receipt.issuesRepo!);

    it("gives the pre-release verdict the merge pre-check result it has always had", () => {
        const old = check(payload([{ body: OLD, at: "2026-10-04T00:00:00Z" }]));
        expect({ result: old.result, merge: old.merge, findings: old.findings }).toEqual({ result: "clean", merge: true, findings: receipt.findings });
        const next = check(payload([{ body: NEW, at: "2026-10-04T00:00:00Z" }]));
        expect({ result: next.result, merge: next.merge, findings: next.findings }).toEqual({ result: old.result, merge: old.merge, findings: old.findings });
    });

    it("reads the same receipt from both layouts through close's one trusted reader", () => {
        const a = read(payload([{ body: OLD, at: "2026-10-04T00:00:00Z" }]));
        const b = read(payload([{ body: NEW, at: "2026-10-04T00:00:00Z" }]));
        expect(a.ok && b.ok).toBe(true);
        const pick = (r: typeof a): unknown => (r.ok && r.verdict.receipt ? { ...r.verdict.receipt, nexusVersion: null } : null);
        expect(pick(b)).toEqual(pick(a));
    });

    it("picks the newer verdict by the platform timestamp, never by layout (G26)", () => {
        const newerOld = read(payload([{ body: NEW, at: "2026-10-04T00:00:00Z" }, { body: OLD, at: "2026-10-05T00:00:00Z" }]));
        expect(newerOld.ok && newerOld.verdict.receipt?.nexusVersion).toBe("0.91.0");
        const newerNew = read(payload([{ body: OLD, at: "2026-10-04T00:00:00Z" }, { body: NEW, at: "2026-10-05T00:00:00Z" }]));
        expect(newerNew.ok && newerNew.verdict.receipt?.nexusVersion).toBe("0.116.0");
    });
});
