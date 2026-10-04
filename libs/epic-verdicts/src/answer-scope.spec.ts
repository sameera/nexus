/**
 * The answer-recording run (epic #829, story #861, decision record #871, D8; G18–G24). Analyze
 * records the answers on a pull request without judging unchanged code again: this module decides
 * whether the run may, which items and results a moved head's changed files affect, and merges what
 * was judged again with what is carried forward into one complete verdict.
 */

import { describe, expect, it } from "vitest";
import { type Departure, type Finding, type Judgments, type Result, renderJudgmentsBlock } from "@nexus/pr-acceptance/judgments-block";
import { verdictBody } from "@nexus/pr-acceptance/verdict-fixtures";
import { type Runner } from "./run.js";
import {
    type AnswerScope,
    type AnswerScopeDeps,
    type CurrentRun,
    type EarlierVerdict,
    decideAnswerMode,
    mergeAnswerRun,
    planAnswerRun,
    readEarlierVerdict,
    selectRejudge,
} from "./answer-scope.js";

const HEAD = "a".repeat(40);
const MOVED = "b".repeat(40);
const DIGEST = "d".repeat(64);

const dv = (over: Partial<Departure> = {}): Departure => ({
    id: "DV1",
    kind: "departure",
    found: true,
    severity: "high",
    departsFrom: "D4",
    summary: "keeps total counts",
    files: ["libs/a.ts"],
    stub: null,
    supersedes: null,
    answer: null,
    ...over,
});

const f = (over: Partial<Finding> = {}): Finding => ({
    id: "F1",
    kind: "finding",
    found: true,
    severity: "high",
    about: "#861 AC2",
    summary: "carries nothing forward",
    files: ["libs/b.ts"],
    answer: null,
    ...over,
});

const ACCEPTED = { verb: "accepted", author: "lead", link: "https://x/c/1", reason: "no batch endpoint" };

const results = (): Result[] => [
    { kind: "criterion", about: "#861 AC1", verdict: "met", files: ["libs/a.ts"] },
    { kind: "criterion", about: "#861 AC2", verdict: "unmet", files: ["libs/b.ts"] },
    { kind: "guarantee", about: "G20", verdict: "held", files: ["libs/c.ts"] },
    { kind: "guarantee", about: "G21", verdict: "held", files: ["libs/a.ts"] },
];

const judgments = (over: Partial<Judgments> = {}): Judgments => ({
    items: [dv(), dv({ id: "DV2", departsFrom: "G9", severity: "critical", files: ["libs/d.ts"], answer: ACCEPTED })],
    findings: [f()],
    other: [],
    results: results(),
    epicLevel: "skip",
    ...over,
});

const earlier = (over: Partial<EarlierVerdict> = {}): EarlierVerdict => ({
    head: HEAD,
    at: "2026-10-03T00:00:00Z",
    stories: [861],
    recordHash: DIGEST,
    judgments: judgments(),
    ...over,
});

const current = (over: Partial<CurrentRun> = {}): CurrentRun => ({ head: HEAD, stories: [861], recordHash: DIGEST, epicLevel: "skip", ...over });

describe("decideAnswerMode — whether the run may record answers without a full judgment", () => {
    it("stops and names a full run when the pull request carries no verdict (G23)", () => {
        expect(decideAnswerMode(null, current())).toEqual({ mode: "stop", reason: "no-verdict" });
    });

    it("stops and names a full run when the verdict was published before the judgments block existed (G23)", () => {
        expect(decideAnswerMode(earlier({ judgments: null }), current())).toEqual({ mode: "stop", reason: "no-judgments" });
    });

    it("judges the whole pull request again when the record was revised, even on the same head (G21)", () => {
        expect(decideAnswerMode(earlier(), current({ recordHash: "e".repeat(64) }))).toEqual({ mode: "full", reason: "record-revised" });
        expect(decideAnswerMode(earlier({ recordHash: null }), current())).toEqual({ mode: "full", reason: "record-revised" });
    });

    it("judges the whole pull request again when the story set changed", () => {
        expect(decideAnswerMode(earlier(), current({ stories: [861, 862] }))).toEqual({ mode: "full", reason: "stories-changed" });
    });

    it("reads the story set as a set, in any order", () => {
        expect(decideAnswerMode(earlier({ stories: [862, 861] }), current({ stories: [861, 862] })).mode).toBe("unchanged");
    });

    it("judges the whole pull request again when its epic-level state changed, so a completing pull request gets its metrics judged", () => {
        expect(decideAnswerMode(earlier(), current({ epicLevel: "judge" }))).toEqual({ mode: "full", reason: "epic-level-changed" });
    });

    it("judges the whole pull request again, and says why, when the verdict records no results to carry (G22, G24)", () => {
        expect(decideAnswerMode(earlier({ judgments: judgments({ results: undefined }) }), current())).toEqual({ mode: "full", reason: "results-unrecorded" });
    });

    it("reads no code when the head, the record and the story set are unchanged (G18)", () => {
        expect(decideAnswerMode(earlier(), current())).toEqual({ mode: "unchanged", reason: null });
    });

    it("carries an unchanged head forward even when the file lists were dropped: no change needs them", () => {
        expect(decideAnswerMode(earlier({ judgments: judgments({ filesDropped: true }) }), current()).mode).toBe("unchanged");
    });

    it("judges the whole pull request again on a moved head when the file lists were dropped (G22)", () => {
        expect(decideAnswerMode(earlier({ judgments: judgments({ filesDropped: true }) }), current({ head: MOVED }))).toEqual({
            mode: "full",
            reason: "file-lists-dropped",
        });
    });

    it("scopes a moved head by its changed files", () => {
        expect(decideAnswerMode(earlier(), current({ head: MOVED }))).toEqual({ mode: "moved", reason: null });
    });
});

describe("selectRejudge — what a moved head's changed files affect (G19, R5)", () => {
    it("re-judges every answered departure, whatever changed", () => {
        expect(selectRejudge(judgments(), []).items).toEqual(["DV2"]);
    });

    it("re-judges each item and result whose file list holds a changed file, and nothing else", () => {
        const s = selectRejudge(judgments(), ["libs/b.ts"]);
        expect(s.items).toEqual(["DV2", "F1"]);
        expect(s.results).toEqual([{ kind: "criterion", about: "#861 AC2" }]);
        expect(s.unlisted).toEqual([]);
    });

    it("counts an empty file list as affected by any change", () => {
        const j = judgments({ findings: [f({ files: [] })], results: [...results(), { kind: "metric", about: "SM1", verdict: "unverifiable", files: [] }] });
        const s = selectRejudge(j, ["libs/a.ts"]);
        expect(s.items).toContain("F1");
        expect(s.results).toContainEqual({ kind: "metric", about: "SM1" });
    });

    it("counts nothing affected when no file changed, an empty list included", () => {
        const j = judgments({ findings: [f({ files: [] })] });
        const s = selectRejudge(j, []);
        expect(s.items).toEqual(["DV2"]);
        expect(s.results).toEqual([]);
    });

    it("checks a changed file no list names for new departures and against every guarantee", () => {
        const s = selectRejudge(judgments(), ["libs/new.ts"]);
        expect(s.unlisted).toEqual(["libs/new.ts"]);
        expect(s.results).toEqual([
            { kind: "guarantee", about: "G20" },
            { kind: "guarantee", about: "G21" },
        ]);
    });

    it("compares paths with a leading ./ removed", () => {
        expect(selectRejudge(judgments({ findings: [f({ files: ["./libs/b.ts"] })] }), ["libs/b.ts"]).items).toContain("F1");
    });
});

const scopeOf = (j: Judgments, mode: "unchanged" | "moved", changed: string[] = []): AnswerScope => {
    const sel = mode === "moved" ? selectRejudge(j, changed) : { items: [], results: [], unlisted: [] };
    return { mode, reason: null, earlier: { head: HEAD, at: "2026-10-03T00:00:00Z" }, changedFiles: changed, rejudge: { items: sel.items, results: sel.results }, unlisted: sel.unlisted, lines: [] };
};

describe("mergeAnswerRun — one complete verdict from what was judged again and what is carried (G18, G19, G24)", () => {
    it("carries every item, answer and result unchanged when the head has not moved", () => {
        const r = mergeAnswerRun(judgments(), scopeOf(judgments(), "unchanged"), null);
        expect(r).toEqual({ ok: true, judgments: judgments() });
    });

    it("refuses a draft on an unchanged head, which reads no code", () => {
        const r = mergeAnswerRun(judgments(), scopeOf(judgments(), "unchanged"), { departures: [], findings: [], results: [] });
        expect(r.ok).toBe(false);
    });

    it("replaces what was judged again, keeps its IDs, and carries everything else forward unchanged", () => {
        const j = judgments();
        const scope = scopeOf(j, "moved", ["libs/b.ts"]);
        const r = mergeAnswerRun(j, scope, {
            departures: [{ departsFrom: "G9", summary: "still calls once per item", breaksGuarantee: true, files: ["libs/d.ts"], stub: null, supersedes: null }],
            findings: [],
            results: [{ kind: "criterion", about: "#861 AC2", verdict: "met", files: ["libs/b.ts"] }],
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const out = r.judgments;
        // DV1 was not affected: carried byte for byte.
        expect(out.items.find((d) => d.id === "DV1")).toEqual(dv());
        // DV2 was answered: judged again, found again, its answer kept.
        expect(out.items.find((d) => d.id === "DV2")).toMatchObject({ found: true, summary: "still calls once per item", answer: ACCEPTED });
        // F1 was affected and not found again: listed as no longer found, never dropped (G8).
        expect(out.findings).toEqual([f({ found: false })]);
        expect(out.results).toEqual([results()[0], { kind: "criterion", about: "#861 AC2", verdict: "met", files: ["libs/b.ts"] }, results()[2], results()[3]]);
        expect(out.epicLevel).toBe("skip");
    });

    it("numbers a new departure from an unlisted file above every number ever issued", () => {
        const j = judgments();
        const scope = scopeOf(j, "moved", ["libs/new.ts"]);
        const r = mergeAnswerRun(j, scope, {
            departures: [
                { departsFrom: "G9", summary: "s", breaksGuarantee: true, files: ["libs/d.ts"], stub: null, supersedes: null },
                { departsFrom: "D4", summary: "a second path keeps totals", breaksGuarantee: false, files: ["libs/new.ts"], stub: null, supersedes: null },
            ],
            findings: [],
            results: [
                { kind: "guarantee", about: "G20", verdict: "held", files: ["libs/c.ts"] },
                { kind: "guarantee", about: "G21", verdict: "broken", files: ["libs/a.ts", "libs/new.ts"] },
            ],
        });
        expect(r.ok && r.judgments.items.map((d) => d.id)).toEqual(["DV1", "DV2", "DV3"]);
        expect(r.ok && r.judgments.items.find((d) => d.id === "DV1")).toEqual(dv());
    });

    it("refuses a draft that leaves out a result it had to judge again, naming it", () => {
        const j = judgments();
        const r = mergeAnswerRun(j, scopeOf(j, "moved", ["libs/b.ts"]), { departures: [], findings: [], results: [] });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.message).toContain("#861 AC2");
    });

    it("refuses a draft that judges again a result the scope carries forward", () => {
        const j = judgments();
        const r = mergeAnswerRun(j, scopeOf(j, "moved", ["libs/b.ts"]), {
            departures: [],
            findings: [],
            results: [
                { kind: "criterion", about: "#861 AC2", verdict: "met", files: ["libs/b.ts"] },
                { kind: "criterion", about: "#861 AC1", verdict: "unmet", files: ["libs/a.ts"] },
            ],
        });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.message).toContain("#861 AC1");
    });
});

describe("planAnswerRun — the scope a run records answers in", () => {
    const deps = (over: Partial<AnswerScopeDeps> = {}): AnswerScopeDeps => ({
        readEarlier: () => ({ ok: true, earlier: earlier() }),
        ownChange: () => ({ ok: true, changed: ["libs/b.ts"] }),
        ...over,
    });

    it("names a full analyze run when it stops (G23)", () => {
        const r = planAnswerRun(deps({ readEarlier: () => ({ ok: true, earlier: null }) }), { pr: 7, current: current() });
        expect(r.ok && r.scope.mode).toBe("stop");
        expect(r.ok && r.scope.lines.join("\n")).toMatch(/\/nxs\.analyze --pr 7\b/);
    });

    it("reads no code on an unchanged head, and compares nothing", () => {
        const r = planAnswerRun(deps({ ownChange: () => { throw new Error("read code"); } }), { pr: 7, current: current() });
        expect(r.ok && r.scope).toMatchObject({ mode: "unchanged", changedFiles: [], rejudge: { items: [], results: [] }, unlisted: [] });
    });

    it("says why it judges the whole pull request again (G21, G22)", () => {
        const r = planAnswerRun(deps(), { pr: 7, current: current({ recordHash: "e".repeat(64) }) });
        expect(r.ok && r.scope.mode).toBe("full");
        expect(r.ok && r.scope.lines.join("\n")).toMatch(/record/);
    });

    it("judges the whole pull request again, and says why, when the earlier head cannot be read (G22)", () => {
        const r = planAnswerRun(deps({ ownChange: () => ({ ok: false, message: "commit aaa is not in /wt" }) }), { pr: 7, current: current({ head: MOVED }) });
        expect(r.ok && r.scope).toMatchObject({ mode: "full", reason: "earlier-head-unreadable" });
        expect(r.ok && r.scope.lines.join("\n")).toContain("commit aaa is not in /wt");
    });

    it("scopes a moved head to what its changed files affect (G19)", () => {
        const r = planAnswerRun(deps(), { pr: 7, current: current({ head: MOVED }) });
        expect(r.ok && r.scope).toMatchObject({
            mode: "moved",
            earlier: { head: HEAD },
            changedFiles: ["libs/b.ts"],
            rejudge: { items: ["DV2", "F1"], results: [{ kind: "criterion", about: "#861 AC2" }] },
            unlisted: [],
        });
    });

    it("marks nothing changed after a trunk merge, so only the answered departures are judged again (G20)", () => {
        const r = planAnswerRun(deps({ ownChange: () => ({ ok: true, changed: [] }) }), { pr: 7, current: current({ head: MOVED }) });
        expect(r.ok && r.scope.rejudge).toEqual({ items: ["DV2"], results: [] });
    });

    it("stops on a failed read rather than reading it as no verdict", () => {
        const r = planAnswerRun(deps({ readEarlier: () => ({ ok: false, error: { problem: "gh-failed", message: "down" } }) }), { pr: 7, current: current() });
        expect(r.ok).toBe(false);
    });
});

describe("readEarlierVerdict — the newest trusted verdict, read by the reader close uses", () => {
    const PR = 7;
    const REPO = "acme/widget";
    const runner =
        (comments: { body: string; createdAt: string; authorAssociation: string }[]): Runner =>
        (cmd, args) => {
            if (cmd === "gh" && args[0] === "pr" && args[1] === "view") {
                return { status: 0, stdout: JSON.stringify({ headRefOid: "f".repeat(40), reviews: [], comments }), stderr: "" };
            }
            return { status: 0, stdout: "0\n", stderr: "" };
        };

    it("reads no verdict as none", () => {
        expect(readEarlierVerdict(runner([]), "/repo", PR, REPO, REPO)).toEqual({ ok: true, earlier: null });
    });

    it("reads a verdict published before the judgments block as one without judgments (G23)", () => {
        const r = readEarlierVerdict(runner([{ body: verdictBody({ high: 0, repo: REPO, pr: PR }), createdAt: "2026-10-01T00:00:00Z", authorAssociation: "OWNER" }]), "/repo", PR, REPO, REPO);
        expect(r.ok && r.earlier?.judgments).toBeNull();
    });

    it("reads the head, stories, record digest and judgments of the newest trusted verdict", () => {
        const body = `${verdictBody({ high: 0, repo: REPO, pr: PR, issuesRepo: REPO })}\n\n${renderJudgmentsBlock(judgments())}`;
        const r = readEarlierVerdict(runner([{ body, createdAt: "2026-10-02T00:00:00Z", authorAssociation: "OWNER" }]), "/repo", PR, REPO, REPO);
        expect(r.ok).toBe(true);
        if (!r.ok || r.earlier === null) return;
        expect(r.earlier.at).toBe("2026-10-02T00:00:00Z");
        expect(r.earlier.head).toMatch(/^[0-9a-f]{40}$/);
        expect(r.earlier.stories.length).toBeGreaterThan(0);
        expect(r.earlier.judgments).toEqual(judgments());
    });

    it("refuses a newest verdict whose judgments cannot be read", () => {
        const body = `${verdictBody({ high: 0, repo: REPO, pr: PR, issuesRepo: REPO })}\n\n<!-- nexus:analyze-judgments -->\n\`\`\`json\n{ nope\n\`\`\`\n`;
        const r = readEarlierVerdict(runner([{ body, createdAt: "2026-10-02T00:00:00Z", authorAssociation: "OWNER" }]), "/repo", PR, REPO, REPO);
        expect(r.ok).toBe(false);
    });
});
