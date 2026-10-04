/**
 * The judgments block: the second machine block of a verdict, after the verdict block, under its
 * own marker (epic #829, decision record #871, D2 and D5's marker). Story #858 introduces it to
 * carry departures and their IDs, so the next run on the same pull request can read them back as
 * its ID registry.
 */

import { describe, expect, it } from "vitest";
import { parseReceiptBlock } from "./verify.js";
import { verdictBody } from "./verdict-fixtures.js";
import { type Departure, type Finding, JUDGMENTS_MARKER, parseJudgmentsBlock, renderJudgmentsBlock } from "./judgments-block.js";

const departure = (over: Partial<Departure> = {}): Departure => ({
    id: "DV1",
    kind: "departure",
    found: true,
    severity: "critical",
    departsFrom: "G3",
    summary: "a broken guarantee is also counted as a finding",
    files: ["libs/a.ts"],
    stub: null,
    supersedes: null,
    answer: null,
    ...over,
});

const finding = (over: Partial<Finding> = {}): Finding => ({
    id: "F1",
    kind: "finding",
    found: true,
    severity: "high",
    about: "#860 AC3",
    summary: "an unanswered departure is not counted",
    files: ["libs/b.ts"],
    answer: null,
    ...over,
});

describe("the judgments block round-trips what analyze wrote", () => {
    it("reads back every departure it was rendered with", () => {
        const items = [
            departure(),
            departure({
                id: "DV2",
                severity: "high",
                departsFrom: "D4",
                stub: { path: ".nexus/queue/epic-1/me/decisions-x.md", reason: "the platform has no such API" },
                supersedes: { decision: "D4", instead: "keeps both counts" },
            }),
        ];
        const r = parseJudgmentsBlock(`prose\n\n${renderJudgmentsBlock({ items })}`);
        expect(r).toEqual({ ok: true, judgments: { items, findings: [], other: [] } });
    });

    it("reads back every finding with its answer (epic #829, story #860)", () => {
        const answer = { verb: "waived", author: "lead", link: "https://x/1", reason: "tracked in #901" };
        const findings = [finding({ answer }), finding({ id: "F2", severity: "low", about: "Scope drift" })];
        const r = parseJudgmentsBlock(renderJudgmentsBlock({ items: [departure()], findings }));
        expect(r).toEqual({ ok: true, judgments: { items: [departure()], findings, other: [] } });
    });

    it("reads a verdict with no departures as an empty list, not as no judgments", () => {
        const r = parseJudgmentsBlock(renderJudgmentsBlock({ items: [] }));
        expect(r).toEqual({ ok: true, judgments: { items: [], findings: [], other: [] } });
    });

    it("reads a verdict published before the block existed as having no judgments, never as an error", () => {
        expect(parseJudgmentsBlock(verdictBody({ high: 0 }))).toEqual({ ok: true, judgments: null });
    });

    it("cannot be ended early by backticks in text it carries", () => {
        const items = [departure({ summary: "returns ```json\n``` early", stub: { path: "p", reason: "````" } })];
        const r = parseJudgmentsBlock(renderJudgmentsBlock({ items }));
        expect(r.ok && r.judgments?.items[0]?.summary).toBe("returns ```json\n``` early");
    });

    it("leaves the verdict block the deployed readers parse unchanged when it follows it", () => {
        const plain = verdictBody({ high: 1, issuesRepo: "acme/widget" });
        const withJudgments = `${plain}\n\n${renderJudgmentsBlock({ items: [departure({ departsFrom: "head" })] })}`;
        expect(parseReceiptBlock(withJudgments)).toEqual(parseReceiptBlock(plain));
    });

    it("keeps an item of a kind this release does not judge, so a later run can carry it forward", () => {
        const body = `${JUDGMENTS_MARKER}\n\`\`\`json\n${JSON.stringify({ schema: 1, items: [{ id: "DS3", kind: "deferred-scope", note: "x" }] })}\n\`\`\`\n`;
        const r = parseJudgmentsBlock(body);
        expect(r).toEqual({ ok: true, judgments: { items: [], findings: [], other: [{ id: "DS3", kind: "deferred-scope", note: "x" }] } });
    });
});

describe("a judgments block that cannot serve as an ID registry is refused, never half-read", () => {
    const raw = (doc: unknown): string => `${JUDGMENTS_MARKER}\n\`\`\`json\n${JSON.stringify(doc)}\n\`\`\`\n`;

    it("refuses a block whose JSON does not parse", () => {
        expect(parseJudgmentsBlock(`${JUDGMENTS_MARKER}\n\`\`\`json\n{ nope\n\`\`\`\n`).ok).toBe(false);
    });

    it("refuses a marker with no fenced block after it", () => {
        expect(parseJudgmentsBlock(`${JUDGMENTS_MARKER}\nnothing here`).ok).toBe(false);
    });

    it("refuses one ID naming two items (G7)", () => {
        const r = parseJudgmentsBlock(raw({ schema: 1, items: [departure(), departure({ departsFrom: "G9" })] }));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.message).toContain("DV1");
    });

    it("refuses a departure that names nothing it departs from (G1)", () => {
        expect(parseJudgmentsBlock(raw({ schema: 1, items: [departure({ departsFrom: " " })] })).ok).toBe(false);
    });

    it("refuses a superseding mark that does not say what the code does instead (G5)", () => {
        const r = parseJudgmentsBlock(raw({ schema: 1, items: [departure({ supersedes: { decision: "D4", instead: "" } })] }));
        expect(r.ok).toBe(false);
    });

    it("refuses an ID whose prefix is not its kind's", () => {
        expect(parseJudgmentsBlock(raw({ schema: 1, items: [departure({ id: "F1" })] })).ok).toBe(false);
    });

    it("refuses a departure severity other than critical or high", () => {
        expect(parseJudgmentsBlock(raw({ schema: 1, items: [{ ...departure(), severity: "medium" }] })).ok).toBe(false);
    });

    it("refuses a waiver on a medium or low finding, which cannot be waived (G13)", () => {
        const answer = { verb: "waived", author: "lead", link: "https://x/1", reason: "minor" };
        const r = parseJudgmentsBlock(raw({ schema: 1, items: [finding({ severity: "medium", answer })] }));
        expect(r.ok).toBe(false);
    });

    it("refuses a finding that names nothing it judges", () => {
        expect(parseJudgmentsBlock(raw({ schema: 1, items: [finding({ about: "" })] })).ok).toBe(false);
    });
});
