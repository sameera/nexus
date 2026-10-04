/**
 * Departure IDs come from a per-pull-request registry (epic #829, story #858, decision record #871,
 * D2; G6–G8). Each run reads the newest trusted verdict on the pull request, reuses the ID of a
 * departure it finds again, gives a new one the next unused number, and lists one it no longer
 * finds instead of dropping it.
 */

import { describe, expect, it } from "vitest";
import { type Departure, type Judgments, renderJudgmentsBlock } from "@nexus/pr-acceptance/judgments-block";
import { verdictBody } from "@nexus/pr-acceptance/verdict-fixtures";
import { type Runner } from "./run.js";
import { type PrAnswer } from "@nexus/pr-acceptance/waiver";
import {
    type DepartureDraft,
    type FindingDraft,
    applyAnswers,
    assignItemIds,
    openCounts,
    parseItemDraft,
    readItemRegistry,
    recordKeyDecisions,
} from "./verdict-items.js";

const draft = (over: Partial<DepartureDraft> = {}): DepartureDraft => ({
    departsFrom: "G3",
    summary: "a broken guarantee is also counted as a finding",
    breaksGuarantee: true,
    files: ["libs/a.ts"],
    stub: null,
    supersedes: null,
    ...over,
});

/** One run on a pull request with no earlier verdict, then a second run reading the first's output. */
const twice = (first: DepartureDraft[], second: DepartureDraft[]): { one: Judgments; two: Judgments } => {
    const one = assignItemIds(null, first);
    return { one, two: assignItemIds(one, second) };
};

const ids = (j: Judgments): string[] => j.items.map((d) => d.id);

describe("a run on a pull request with no earlier verdict", () => {
    it("numbers its departures DV1 upwards, in the order it found them", () => {
        const j = assignItemIds(null, [draft(), draft({ departsFrom: "D4", breaksGuarantee: false })]);
        expect(ids(j)).toEqual(["DV1", "DV2"]);
        expect(j.items.every((d) => d.found && d.answer === null)).toBe(true);
    });

    it("lists no departure when the code matches the record (G2)", () => {
        expect(assignItemIds(null, []).items).toEqual([]);
    });

    it("rates an unanswered departure critical when it breaks a guarantee, high otherwise (G14)", () => {
        const j = assignItemIds(null, [draft(), draft({ departsFrom: "How it works", breaksGuarantee: false })]);
        expect(j.items.map((d) => d.severity)).toEqual(["critical", "high"]);
    });

    it("shows a stub's reason beside the departure it explains, and the stub answers nothing (G4)", () => {
        const stub = { path: ".nexus/queue/epic-829/sameera/decisions-b.md", reason: "the platform has no such API" };
        const [d] = assignItemIds(null, [draft({ stub })]).items;
        expect(d?.stub).toEqual(stub);
        expect(d?.answer).toBeNull();
    });

    it("carries the superseding mark with the decision it names and what the code does instead (G5)", () => {
        const supersedes = { decision: "D4", instead: "keeps total counts" };
        const [d] = assignItemIds(null, [draft({ departsFrom: "D4", supersedes })]).items;
        expect(d?.supersedes).toEqual(supersedes);
    });
});

describe("a second run on the same pull request reuses the registry (G6, G7)", () => {
    it("gives every departure it finds again the same ID, whatever order it finds them in", () => {
        const a = draft();
        const b = draft({ departsFrom: "D4", breaksGuarantee: false, files: ["libs/b.ts"] });
        const { one, two } = twice([a, b], [b, a]);
        const idOf = (j: Judgments, from: string) => j.items.find((d) => d.departsFrom === from && d.found)?.id;
        expect(idOf(two, "D4")).toBe(idOf(one, "D4"));
        expect(idOf(two, "G3")).toBe(idOf(one, "G3"));
    });

    it("counts two departures as the same when they cite the same element and share a file", () => {
        const { two } = twice([draft({ files: ["a.ts", "b.ts"] })], [draft({ files: ["b.ts", "c.ts"], summary: "reworded" })]);
        expect(ids(two)).toEqual(["DV1"]);
        expect(two.items[0]?.summary).toBe("reworded");
    });

    it("gives a departure citing a different element the next unused number, never a reused one", () => {
        const { two } = twice([draft(), draft({ departsFrom: "G5" })], [draft({ departsFrom: "G9" })]);
        const fresh = two.items.find((d) => d.departsFrom === "G9");
        expect(fresh?.id).toBe("DV3");
        expect(new Set(ids(two)).size).toBe(ids(two).length);
    });

    it("tells apart two departures against one element when their files differ", () => {
        const a = draft({ files: ["a.ts"] });
        const b = draft({ files: ["b.ts"] });
        const { one, two } = twice([a, b], [b, a]);
        const idFor = (j: Judgments, file: string) => j.items.find((d) => d.files.includes(file))?.id;
        expect(idFor(two, "b.ts")).toBe(idFor(one, "b.ts"));
        expect(idFor(two, "a.ts")).toBe(idFor(one, "a.ts"));
    });

    it("keeps an answer on a departure it finds again", () => {
        const one = assignItemIds(null, [draft()]);
        const answered: Judgments = { ...one, items: one.items.map((d) => ({ ...d, answer: ANSWER })) };
        expect(assignItemIds(answered, [draft()]).items[0]?.answer).toEqual(ANSWER);
    });
});

const ANSWER = { verb: "accepted", author: "sameera", link: "https://github.com/acme/widget/pull/7#issuecomment-1", reason: "kept on purpose" };

describe("a departure a later run does not find again (G8)", () => {
    it("is listed as no longer found, with its answer, and never dropped", () => {
        const one = assignItemIds(null, [draft(), draft({ departsFrom: "D4" })]);
        const answered: Judgments = { ...one, items: one.items.map((d) => (d.id === "DV1" ? { ...d, answer: ANSWER } : d)) };
        const two = assignItemIds(answered, [draft({ departsFrom: "D4" })]);
        const gone = two.items.find((d) => d.id === "DV1");
        expect(gone?.found).toBe(false);
        expect(gone?.answer).toEqual(ANSWER);
        expect(two.items.find((d) => d.id === "DV2")?.found).toBe(true);
    });

    it("gets its ID back if it is found again later", () => {
        const one = assignItemIds(null, [draft()]);
        const two = assignItemIds(one, []);
        const three = assignItemIds(two, [draft()]);
        expect(three.items).toEqual([expect.objectContaining({ id: "DV1", found: true })]);
    });

    it("keeps its number out of use, so a new departure never takes it", () => {
        const one = assignItemIds(null, [draft(), draft({ departsFrom: "G5" })]);
        const two = assignItemIds(one, [draft({ departsFrom: "G9" })]);
        expect(ids(two)).toEqual(["DV1", "DV2", "DV3"]);
    });

});

describe("parseItemDraft — what analyze hands the ID step", () => {
    it("reads the findings beside the departures", () => {
        const finding = { about: "#860 AC3", severity: "high", summary: "not counted", files: ["a.ts"] };
        expect(parseItemDraft(JSON.stringify({ departures: [], findings: [finding] }))).toEqual({ ok: true, departures: [], findings: [finding] });
    });

    it("refuses a finding with no severity it can be counted under, naming the entry", () => {
        const r = parseItemDraft(JSON.stringify({ departures: [], findings: [{ about: "x", severity: "blocker", summary: "y", files: [] }] }));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.message).toContain("finding 0");
    });

    it("reads a well-formed draft", () => {
        const r = parseItemDraft(JSON.stringify({ departures: [draft()] }));
        expect(r).toEqual({ ok: true, departures: [draft()], findings: [] });
    });

    it("refuses a departure that names nothing it departs from, naming the entry (G1)", () => {
        const r = parseItemDraft(JSON.stringify({ departures: [draft(), draft({ departsFrom: "" })] }));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.message).toContain("departure 1");
    });

    it("refuses a superseding mark with nothing the code does instead (G5)", () => {
        const r = parseItemDraft(JSON.stringify({ departures: [draft({ supersedes: { decision: "D4", instead: " " } })] }));
        expect(r.ok).toBe(false);
    });

    it("reads each criterion and guarantee result with its file list, and the epic-level state (story #861, D8)", () => {
        const results = [
            { kind: "criterion", about: "#861 AC1", verdict: "met", files: ["a.ts"] },
            { kind: "guarantee", about: "G20", verdict: "held", files: [] },
        ];
        const r = parseItemDraft(JSON.stringify({ departures: [], results, epicLevel: "skip" }));
        expect(r).toEqual({ ok: true, departures: [], findings: [], results, epicLevel: "skip" });
    });

    it("refuses a result with no file list, naming the entry", () => {
        const r = parseItemDraft(JSON.stringify({ departures: [], results: [{ kind: "criterion", about: "#861 AC1", verdict: "met" }] }));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.message).toContain("result 0");
    });

    it("refuses an epic-level state other than judge, not-run or skip", () => {
        expect(parseItemDraft(JSON.stringify({ departures: [], epicLevel: "maybe" })).ok).toBe(false);
    });

    it("refuses a departure that does not say whether it breaks a guarantee, which decides its severity", () => {
        const rest: Partial<DepartureDraft> = draft();
        delete rest.breaksGuarantee;
        expect(parseItemDraft(JSON.stringify({ departures: [rest] })).ok).toBe(false);
    });

    it("refuses a draft that is not JSON", () => {
        expect(parseItemDraft("departures: none").ok).toBe(false);
    });
});

describe("readItemRegistry — the newest trusted verdict on the pull request", () => {
    const PR = 7;
    const REPO = "acme/widget";
    const withJudgments = (items: Departure[]): string =>
        `${verdictBody({ high: 0, repo: REPO, pr: PR, issuesRepo: REPO })}\n\n${renderJudgmentsBlock({ items })}`;
    const runner =
        (comments: { body: string; createdAt: string; authorAssociation: string }[]): Runner =>
        (cmd, args) => {
            if (cmd === "gh" && args[0] === "pr" && args[1] === "view") {
                return { status: 0, stdout: JSON.stringify({ headRefOid: "f".repeat(40), reviews: [], comments }), stderr: "" };
            }
            return { status: 0, stdout: "0\n", stderr: "" };
        };
    const dv = (id: string): Departure => ({ ...assignItemIds(null, [draft()]).items[0], id }) as Departure;

    it("is empty when the pull request carries no verdict", () => {
        expect(readItemRegistry(runner([]), "/repo", PR, REPO, REPO)).toEqual({ ok: true, source: "none", registry: null });
    });

    it("is empty, never an error, for a verdict published before the judgments block existed (G40)", () => {
        const r = readItemRegistry(runner([{ body: verdictBody({ high: 0, repo: REPO, pr: PR }), createdAt: "2026-10-01T00:00:00Z", authorAssociation: "OWNER" }]), "/repo", PR, REPO, REPO);
        expect(r).toEqual({ ok: true, source: "no-judgments", registry: null });
    });

    it("reads the newest trusted verdict's items, ignoring an untrusted newer one", () => {
        const r = readItemRegistry(
            runner([
                { body: withJudgments([dv("DV4")]), createdAt: "2026-10-01T00:00:00Z", authorAssociation: "OWNER" },
                { body: withJudgments([dv("DV1")]), createdAt: "2026-10-02T00:00:00Z", authorAssociation: "OWNER" },
                { body: withJudgments([dv("DV9")]), createdAt: "2026-10-03T00:00:00Z", authorAssociation: "NONE" },
            ]),
            "/repo",
            PR,
            REPO,
            REPO,
        );
        expect(r.ok && r.registry?.items.map((d) => d.id)).toEqual(["DV1"]);
    });

    it("stops on a newest verdict whose judgments cannot serve as a registry", () => {
        const broken = `${verdictBody({ high: 0, repo: REPO, pr: PR })}\n\n<!-- nexus:analyze-judgments -->\n\`\`\`json\n{ nope\n\`\`\`\n`;
        const r = readItemRegistry(runner([{ body: broken, createdAt: "2026-10-01T00:00:00Z", authorAssociation: "OWNER" }]), "/repo", PR, REPO, REPO);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("judgments-malformed");
    });

    it("stops when the pull request cannot be read", () => {
        const failing: Runner = () => ({ status: 1, stdout: "", stderr: "HTTP 502" });
        const r = readItemRegistry(failing, "/repo", PR, REPO, REPO);
        expect(r.ok).toBe(false);
    });
});

/** One finding as analyze judged it (epic #829, story #860, D2's findings part). */
const finding = (over: Partial<FindingDraft> = {}): FindingDraft => ({
    about: "#860 AC3",
    severity: "high",
    summary: "an unanswered departure is not counted",
    files: ["libs/b.ts"],
    ...over,
});

describe("findings take F IDs from the same registry (D2)", () => {
    it("numbers findings F1 upwards beside the departures' DV numbers", () => {
        const j = assignItemIds(null, [draft()], [finding(), finding({ about: "success metric 2", severity: "medium" })]);
        expect(ids(j)).toEqual(["DV1"]);
        expect(j.findings.map((f) => f.id)).toEqual(["F1", "F2"]);
    });

    it("gives a finding found again its ID and its waiver back, and lists one no longer found", () => {
        const one = assignItemIds(null, [], [finding(), finding({ about: "#860 AC5", files: ["c.ts"] })]);
        const waived: Judgments = { ...one, findings: one.findings.map((f) => (f.id === "F1" ? { ...f, answer: WAIVER } : f)) };
        const two = assignItemIds(waived, [], [finding({ summary: "reworded" })]);
        expect(two.findings).toEqual([
            expect.objectContaining({ id: "F1", found: true, summary: "reworded", answer: WAIVER }),
            expect.objectContaining({ id: "F2", found: false }),
        ]);
    });

    it("drops a waiver from a finding now found as medium or low, which cannot be waived (G13)", () => {
        const one = assignItemIds(null, [], [finding()]);
        const waived: Judgments = { ...one, findings: one.findings.map((f) => ({ ...f, answer: WAIVER })) };
        expect(assignItemIds(waived, [], [finding({ severity: "low" })]).findings[0]?.answer).toBeNull();
    });
});

const WAIVER = { verb: "waived", author: "lead", link: "https://github.com/acme/widget/pull/7#issuecomment-2", reason: "tracked in #901" };

/** An answer line as the one waiver reader returns it. */
const answer = (over: Partial<PrAnswer> = {}): PrAnswer => ({
    id: "DV1",
    verb: "accepted",
    reason: "the platform has no batch endpoint",
    author: "lead",
    url: "https://github.com/acme/widget/pull/7#issuecomment-10",
    at: "2026-10-02T00:00:00Z",
    trusted: true,
    ...over,
});

describe("applyAnswers — an engineer answers a departure or a finding on the pull request (D3, D4)", () => {
    const judged = (): Judgments =>
        assignItemIds(null, [draft(), draft({ departsFrom: "D4", breaksGuarantee: false, files: ["d.ts"] })], [finding(), finding({ about: "Scope drift", severity: "medium", files: ["e.ts"] })]);

    it("counts a departure a trusted comment accepts with a reason as accepted, naming who and linking the comment (G9)", () => {
        const r = applyAnswers(judged(), [answer()]);
        expect(r.judgments.items.find((d) => d.id === "DV1")?.answer).toEqual({
            verb: "accepted",
            author: "lead",
            link: "https://github.com/acme/widget/pull/7#issuecomment-10",
            reason: "the platform has no batch endpoint",
        });
        expect(r.applied.map((a) => a.id)).toEqual(["DV1"]);
        expect(r.unapplied).toEqual([]);
    });

    it("leaves a departure only a decision stub explains unanswered (G4)", () => {
        const stub = { path: ".nexus/queue/epic-829/lead/decisions-b.md", reason: "the platform has no such API" };
        const r = applyAnswers(assignItemIds(null, [draft({ stub })]), []);
        expect(r.judgments.items[0]?.answer).toBeNull();
        expect(openCounts(r.judgments).critical).toBe(1);
    });

    it("counts an unanswered departure as a blocking finding (G14)", () => {
        expect(openCounts(applyAnswers(judged(), []).judgments)).toEqual({ critical: 1, high: 2, medium: 1, low: 0 });
    });

    it("waives a critical or high finding a trusted comment waives with a reason, so it no longer blocks (G13, G15)", () => {
        const r = applyAnswers(judged(), [answer({ id: "F1", verb: "waived", reason: "tracked in #901" })]);
        expect(r.judgments.findings[0]?.answer?.author).toBe("lead");
        expect(openCounts(r.judgments)).toEqual({ critical: 1, high: 1, medium: 1, low: 0 });
    });

    it("counts only open items, so an accepted departure and a waived finding count nothing (G15)", () => {
        const r = applyAnswers(judged(), [answer(), answer({ id: "DV2" }), answer({ id: "F1", verb: "waived" })]);
        expect(openCounts(r.judgments)).toEqual({ critical: 0, high: 0, medium: 1, low: 0 });
    });

    it("applies nothing from an author who cannot speak for the repository, and names the comment (G10)", () => {
        const r = applyAnswers(judged(), [answer({ author: "drive-by", trusted: false, url: "https://x/11" })]);
        expect(r.judgments.items[0]?.answer).toBeNull();
        expect(r.unapplied).toEqual([{ id: "DV1", verb: "accepted", author: "drive-by", url: "https://x/11", why: "untrusted" }]);
    });

    it("names, and applies nothing for, an unknown ID, a verb that does not fit, or a missing reason (G11)", () => {
        const r = applyAnswers(judged(), [
            answer({ id: "DV9" }),
            answer({ id: "F1", verb: "accepted" }),
            answer({ id: "DV2", verb: "waived" }),
            answer({ id: "DV2", reason: "" }),
            answer({ id: "F1", verb: "waived", reason: "" }),
        ]);
        expect(r.unapplied.map((u) => `${u.id}:${u.why}`)).toEqual(["DV9:unknown-id", "F1:wrong-verb", "DV2:wrong-verb", "DV2:no-reason", "F1:no-reason"]);
        expect(r.applied).toEqual([]);
        expect(openCounts(r.judgments)).toEqual(openCounts(judged()));
    });

    it("never waives a medium or low finding (G13)", () => {
        const r = applyAnswers(judged(), [answer({ id: "F2", verb: "waived" })]);
        expect(r.unapplied.map((u) => u.why)).toEqual(["not-waivable"]);
        expect(r.judgments.findings[1]?.answer).toBeNull();
    });

    it("takes the newest trusted answer for an ID, and still names an untrusted one", () => {
        const r = applyAnswers(judged(), [
            answer({ reason: "newest", at: "2026-10-03T00:00:00Z", url: "https://x/new" }),
            answer({ reason: "older", at: "2026-10-01T00:00:00Z", url: "https://x/old" }),
            answer({ trusted: false, author: "drive-by", at: "2026-10-04T00:00:00Z", url: "https://x/untrusted" }),
        ]);
        expect(r.judgments.items[0]?.answer?.reason).toBe("newest");
        expect(r.unapplied.map((u) => u.url)).toEqual(["https://x/untrusted"]);
    });

    it("keeps the answer the registry carried when no comment answers the item again", () => {
        const one = applyAnswers(judged(), [answer()]).judgments;
        expect(applyAnswers(assignItemIds(one, [draft()]), []).judgments.items[0]?.answer?.reason).toBe("the platform has no batch endpoint");
    });

    it("reads an approval with no reason, which needs none, against a deferred-scope proposal", () => {
        const withDs = assignItemIds(null, [draft()], [finding({ deferred: "the size budget" })]);
        const r = applyAnswers(withDs, [answer({ id: "DS1", verb: "approved", reason: "" })]);
        expect(r.unapplied).toEqual([]);
        expect(r.judgments.deferred[0]).toEqual(expect.objectContaining({ answer: expect.objectContaining({ verb: "approved", author: "lead" }) }));
    });
});

describe("deferred-scope proposals take DS IDs from the same registry (epic #829, story #862, D2, D7)", () => {
    const unmet = (over: Partial<FindingDraft> = {}): FindingDraft =>
        finding({ about: "#862 AC4", summary: "no DS IDs yet", deferred: "number deferred scope from the registry", ...over });

    it("numbers each proposal DS1 upwards and ties it to the finding or departure it would settle (G26)", () => {
        const j = assignItemIds(null, [draft({ departsFrom: "D7", breaksGuarantee: false, deferred: "record scope no story delivered" })], [unmet()]);
        expect(j.deferred.map((ds) => [ds.id, ds.settles])).toEqual([
            ["DS1", "DV1"],
            ["DS2", "F1"],
        ]);
        expect(j.deferred.every((ds) => ds.found && ds.answer === null)).toBe(true);
    });

    it("proposes nothing for an item that defers no scope", () => {
        expect(assignItemIds(null, [draft()], [finding()]).deferred).toEqual([]);
    });

    it("keeps a proposal's ID and its approval on a later run that proposes it for the same item again", () => {
        const one = applyAnswers(assignItemIds(null, [], [unmet()]), [answer({ id: "DS1", verb: "approved", reason: "" })]).judgments;
        const two = assignItemIds(one, [], [unmet({ deferred: "reworded" })]);
        expect(two.deferred).toEqual([expect.objectContaining({ id: "DS1", settles: "F1", summary: "reworded", answer: expect.objectContaining({ verb: "approved" }) })]);
    });

    it("lists a proposal not made again as no longer found, with its answer, and never reuses its number", () => {
        const one = applyAnswers(assignItemIds(null, [], [unmet()]), [answer({ id: "DS1", verb: "approved", reason: "" })]).judgments;
        const two = assignItemIds(one, [draft({ deferred: "something else" })], [unmet({ deferred: null })]);
        expect(two.deferred.map((ds) => [ds.id, ds.found, ds.settles])).toEqual([
            ["DS1", false, "F1"],
            ["DS2", true, "DV1"],
        ]);
        expect(two.deferred[0]?.answer?.verb).toBe("approved");
    });

    it("carries a proposal forward with its item when an answer-recording run does not judge that item again", () => {
        const one = assignItemIds(null, [draft()], [unmet()]);
        const two = assignItemIds(one, [draft()], [], new Set(["DV1"]));
        expect(two.deferred).toEqual(one.deferred);
    });

    it("stops the item blocking once a trusted person approves its deferral, and an untrusted approval changes nothing (G26, G10)", () => {
        const j = assignItemIds(null, [], [unmet()]);
        expect(openCounts(applyAnswers(j, [answer({ id: "DS1", verb: "approved", reason: "", trusted: false })]).judgments).high).toBe(1);
        expect(openCounts(applyAnswers(j, [answer({ id: "DS1", verb: "approved", reason: "" })]).judgments).high).toBe(0);
    });

    it("refuses approving a departure or accepting a proposal: each verb fits one kind", () => {
        const j = assignItemIds(null, [draft()], [unmet()]);
        const r = applyAnswers(j, [answer({ id: "DV1", verb: "approved" }), answer({ id: "DS1", verb: "accepted" })]);
        expect(r.unapplied.map((u) => u.why)).toEqual(["wrong-verb", "wrong-verb"]);
    });

    it("reads a deferral drafted on a departure or a finding, and refuses an empty one", () => {
        const ok = parseItemDraft(JSON.stringify({ departures: [{ ...draft(), deferred: "left out" }], findings: [{ ...finding(), deferred: null }] }));
        expect(ok.ok && ok.departures[0]?.deferred).toBe("left out");
        const bad = parseItemDraft(JSON.stringify({ departures: [], findings: [{ ...finding(), deferred: " " }] }));
        expect(bad.ok).toBe(false);
    });
});

describe("the key decisions are the record's decisions plus confirmed stubs (epic #829, story #862, D5, D6)", () => {
    it("names a new-format record's decisions by ID, tied to the digest the verdict stamps (G25)", () => {
        const r = recordKeyDecisions({ digest: "abc", format: "new", decisions: [{ id: "D1", title: "One" }, { id: "D2", title: "Two" }], body: "whole body" });
        expect(r).toEqual({ digest: "abc", format: "new", decisions: [{ id: "D1" }, { id: "D2" }] });
    });

    it("names an old-format record's decisions by title, and carries a record in neither format in full", () => {
        expect(recordKeyDecisions({ digest: "abc", format: "old", decisions: [{ title: "Keep the flat block" }], body: "b" }).decisions).toEqual([{ title: "Keep the flat block" }]);
        expect(recordKeyDecisions({ digest: "abc", format: "neither", decisions: [], body: "the whole body" })).toEqual({ digest: "abc", format: "neither", decisions: [], text: "the whole body" });
    });

    it("reads each confirmed stub with its choice, reason and refuted alternative, and refuses one without them", () => {
        const stub = { path: ".nexus/queue/epic-829/lead/decisions-b.md", choice: "fit in verdict-check", reason: "one place approves the bytes", refuted: "none" };
        const ok = parseItemDraft(JSON.stringify({ departures: [], confirmedStubs: [stub] }));
        expect(ok.ok && ok.stubs).toEqual([stub]);
        expect(parseItemDraft(JSON.stringify({ departures: [], confirmedStubs: [{ ...stub, reason: "" }] })).ok).toBe(false);
    });
});
