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
import { type DepartureDraft, assignDepartureIds, parseDepartureDraft, readItemRegistry } from "./verdict-items.js";

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
    const one = assignDepartureIds(null, first);
    return { one, two: assignDepartureIds(one, second) };
};

const ids = (j: Judgments): string[] => j.items.map((d) => d.id);

describe("a run on a pull request with no earlier verdict", () => {
    it("numbers its departures DV1 upwards, in the order it found them", () => {
        const j = assignDepartureIds(null, [draft(), draft({ departsFrom: "D4", breaksGuarantee: false })]);
        expect(ids(j)).toEqual(["DV1", "DV2"]);
        expect(j.items.every((d) => d.found && d.answer === null)).toBe(true);
    });

    it("lists no departure when the code matches the record (G2)", () => {
        expect(assignDepartureIds(null, []).items).toEqual([]);
    });

    it("rates an unanswered departure critical when it breaks a guarantee, high otherwise (G14)", () => {
        const j = assignDepartureIds(null, [draft(), draft({ departsFrom: "How it works", breaksGuarantee: false })]);
        expect(j.items.map((d) => d.severity)).toEqual(["critical", "high"]);
    });

    it("shows a stub's reason beside the departure it explains, and the stub answers nothing (G4)", () => {
        const stub = { path: ".nexus/queue/epic-829/sameera/decisions-b.md", reason: "the platform has no such API" };
        const [d] = assignDepartureIds(null, [draft({ stub })]).items;
        expect(d?.stub).toEqual(stub);
        expect(d?.answer).toBeNull();
    });

    it("carries the superseding mark with the decision it names and what the code does instead (G5)", () => {
        const supersedes = { decision: "D4", instead: "keeps total counts" };
        const [d] = assignDepartureIds(null, [draft({ departsFrom: "D4", supersedes })]).items;
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
        const one = assignDepartureIds(null, [draft()]);
        const answered: Judgments = { ...one, items: one.items.map((d) => ({ ...d, answer: ANSWER })) };
        expect(assignDepartureIds(answered, [draft()]).items[0]?.answer).toEqual(ANSWER);
    });
});

const ANSWER = { verb: "accepted", author: "sameera", link: "https://github.com/acme/widget/pull/7#issuecomment-1", reason: "kept on purpose" };

describe("a departure a later run does not find again (G8)", () => {
    it("is listed as no longer found, with its answer, and never dropped", () => {
        const one = assignDepartureIds(null, [draft(), draft({ departsFrom: "D4" })]);
        const answered: Judgments = { ...one, items: one.items.map((d) => (d.id === "DV1" ? { ...d, answer: ANSWER } : d)) };
        const two = assignDepartureIds(answered, [draft({ departsFrom: "D4" })]);
        const gone = two.items.find((d) => d.id === "DV1");
        expect(gone?.found).toBe(false);
        expect(gone?.answer).toEqual(ANSWER);
        expect(two.items.find((d) => d.id === "DV2")?.found).toBe(true);
    });

    it("gets its ID back if it is found again later", () => {
        const one = assignDepartureIds(null, [draft()]);
        const two = assignDepartureIds(one, []);
        const three = assignDepartureIds(two, [draft()]);
        expect(three.items).toEqual([expect.objectContaining({ id: "DV1", found: true })]);
    });

    it("keeps its number out of use, so a new departure never takes it", () => {
        const one = assignDepartureIds(null, [draft(), draft({ departsFrom: "G5" })]);
        const two = assignDepartureIds(one, [draft({ departsFrom: "G9" })]);
        expect(ids(two)).toEqual(["DV1", "DV2", "DV3"]);
    });

    it("carries an item of a kind this release does not judge through unchanged", () => {
        const other = [{ id: "F2", kind: "finding", note: "x" }];
        expect(assignDepartureIds({ items: [], other }, [draft()]).other).toEqual(other);
    });
});

describe("parseDepartureDraft — what analyze hands the ID step", () => {
    it("reads a well-formed draft", () => {
        const r = parseDepartureDraft(JSON.stringify({ departures: [draft()] }));
        expect(r).toEqual({ ok: true, drafts: [draft()] });
    });

    it("refuses a departure that names nothing it departs from, naming the entry (G1)", () => {
        const r = parseDepartureDraft(JSON.stringify({ departures: [draft(), draft({ departsFrom: "" })] }));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.message).toContain("departure 1");
    });

    it("refuses a superseding mark with nothing the code does instead (G5)", () => {
        const r = parseDepartureDraft(JSON.stringify({ departures: [draft({ supersedes: { decision: "D4", instead: " " } })] }));
        expect(r.ok).toBe(false);
    });

    it("refuses a departure that does not say whether it breaks a guarantee, which decides its severity", () => {
        const rest: Partial<DepartureDraft> = draft();
        delete rest.breaksGuarantee;
        expect(parseDepartureDraft(JSON.stringify({ departures: [rest] })).ok).toBe(false);
    });

    it("refuses a draft that is not JSON", () => {
        expect(parseDepartureDraft("departures: none").ok).toBe(false);
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
    const dv = (id: string): Departure => ({ ...assignDepartureIds(null, [draft()]).items[0], id }) as Departure;

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
