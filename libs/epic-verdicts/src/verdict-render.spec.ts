/**
 * The toolkit writes the whole published verdict from one input (epic #923, story #924; decision
 * record #949, D1, D2, D4–D6, D13; G1–G4, G7, G23, G24, R1).
 */

import { describe, expect, it } from "vitest";
import { type Judgments, JUDGMENTS_MARKER, parseJudgmentsBlock, openItems } from "@nexus/pr-acceptance/judgments-block";
import { RECEIPT_MARKER } from "@nexus/pr-acceptance/receipt-blocks";
import { parseReceiptBlock } from "@nexus/pr-acceptance/verify";
import { VERDICT_SIZE_LIMIT, longestFields } from "./publish-check.js";
import { type VerdictFacts, inlineText, missingFields, parseVerdictFacts, renderVerdict } from "./verdict-render.js";

const HEAD = "a".repeat(40);
const HASH = "b".repeat(64);

export function facts(over: Partial<VerdictFacts> = {}): VerdictFacts {
    return {
        epic: { ref: "#923", title: "Readable verdicts" },
        pr: 12,
        repo: "github.com/acme/app",
        issuesRepo: "acme/app",
        stories: [{ number: 924, ref: "#924", title: "Same structure" }],
        head: HEAD,
        date: "2026-10-17",
        nexusVersion: "0.116.0",
        record: { ref: "#949", hash: HASH },
        epicLevel: { state: "skip", lines: ["Epic level: not judged; this pull request does not complete the epic."] },
        concepts: { pages: [], checked: 0, notFound: [] },
        recorded: [],
        ...over,
    };
}

export function judgments(): Judgments {
    return {
        items: [
            {
                id: "DV2",
                kind: "departure",
                found: true,
                severity: "high",
                departsFrom: "D4",
                summary: "renders twice",
                files: ["src/a.ts"],
                stub: null,
                supersedes: null,
                answer: { verb: "accepted", author: "lead", link: "https://github.com/acme/app/pull/12#c1", reason: "fine for now" },
            },
            { id: "DV1", kind: "departure", found: true, severity: "critical", departsFrom: "G3", summary: "model writes text", files: ["src/b.ts"], stub: null, supersedes: null, answer: null },
        ],
        findings: [
            { id: "F1", kind: "finding", found: true, severity: "medium", about: "#924 AC2", summary: "counts differ", files: [], answer: null },
            { id: "F2", kind: "finding", found: false, severity: "high", about: "#924 AC1", summary: "gone", files: [], answer: null },
        ],
        deferred: [],
        results: [
            { kind: "criterion", about: "#924 AC1", verdict: "met", files: [] },
            { kind: "criterion", about: "#924 AC2", verdict: "partial", files: [] },
            { kind: "criterion", about: "#924 AC3", verdict: "unconfirmed", files: [], looked: "src/c.ts", confirmBy: "run the suite" },
            { kind: "guarantee", about: "G1", verdict: "held", files: [] },
        ],
        epicLevel: "skip",
        keyDecisions: { record: { digest: HASH, format: "new", decisions: [{ id: "D1" }, { id: "D2" }] }, stubs: [] },
        scopeDrift: ["adds a debug flag"],
        notes: ["story #924 is still open"],
    };
}

const headings = (body: string): string[] => body.split("\n").filter((l) => l.startsWith("#"));

describe("the same input gives the same bytes (D5; G1)", () => {
    it("renders two identical bodies from the same judgments and facts", () => {
        const a = renderVerdict({ judgments: judgments(), facts: facts(), unapplied: [] }).body;
        const b = renderVerdict({ judgments: judgments(), facts: facts(), unapplied: [] }).body;
        expect(a).toBe(b);
        expect(a).not.toContain("\r");
    });

    it("lists items by kind, then by ID number, whatever order they arrive in", () => {
        const body = renderVerdict({ judgments: judgments(), facts: facts(), unapplied: [] }).body;
        const order = ["DV1", "DV2", "F1", "F2"].map((id) => body.indexOf(`**${id}**`));
        expect(order.every((at) => at >= 0)).toBe(true);
        expect([...order].sort((x, y) => x - y)).toEqual(order);
    });
});

describe("two verdicts over different epics share one structure (G2)", () => {
    it("shows the same sections in the same order", () => {
        const one = renderVerdict({ judgments: judgments(), facts: facts(), unapplied: [] }).body;
        const other = renderVerdict({
            judgments: { items: [], findings: [], deferred: [], keyDecisions: { record: null, stubs: [] } },
            facts: facts({ epic: { ref: "#5", title: "Other" }, record: null, stories: [{ number: 6, ref: "#6", title: "S" }] }),
            unapplied: [],
        }).body;
        expect(headings(one).slice(1)).toEqual(headings(other).slice(1));
    });
});

describe("the visible counts, the receipt and the judgments block agree (D1, D2; G4)", () => {
    it("states the same open counts in the headline and the receipt as the open items in the block", () => {
        const { body, open, blocked } = renderVerdict({ judgments: judgments(), facts: facts(), unapplied: [] });
        const receipt = parseReceiptBlock(body);
        const parsed = parseJudgmentsBlock(body);
        expect(parsed.ok).toBe(true);
        const items = openItems((parsed as { ok: true; judgments: Judgments }).judgments);
        for (const sev of ["critical", "high", "medium", "low"] as const) {
            const inBlock = items.filter((i) => i.severity === sev).length;
            expect(receipt?.findings[sev]).toBe(inBlock);
            expect(open[sev]).toBe(inBlock);
            expect(body.split("\n").slice(0, 4).join(" ")).toContain(`${sev} ${inBlock}`);
        }
        expect(blocked).toBe(true);
    });

    it("is not blocked when no critical or high item is open", () => {
        const j = judgments();
        j.items = j.items.filter((d) => d.id !== "DV1");
        expect(renderVerdict({ judgments: j, facts: facts(), unapplied: [] }).blocked).toBe(false);
    });

    it("puts the receipt marker directly before its fence and the judgments block after it, each once (G24)", () => {
        const { body } = renderVerdict({ judgments: judgments(), facts: facts(), unapplied: [] });
        expect(body).toContain(`${RECEIPT_MARKER}\n\`\`\`yaml\n`);
        expect(body.indexOf(JUDGMENTS_MARKER)).toBeGreaterThan(body.indexOf(RECEIPT_MARKER));
        expect(body.split(RECEIPT_MARKER)).toHaveLength(2);
        expect(body.split(JUDGMENTS_MARKER)).toHaveLength(2);
        const receipt = parseReceiptBlock(body);
        expect(receipt).toMatchObject({ head: HEAD, recordHash: HASH, issuesRepo: "acme/app", repo: "github.com/acme/app", stories: [924], pr: 12, mode: "full" });
    });

    it("carries scope drift and notes in the judgments block for a later recording run (D3)", () => {
        const parsed = parseJudgmentsBlock(renderVerdict({ judgments: judgments(), facts: facts(), unapplied: [] }).body);
        expect(parsed.ok && parsed.judgments?.scopeDrift).toEqual(["adds a debug flag"]);
        expect(parsed.ok && parsed.judgments?.notes).toEqual(["story #924 is still open"]);
    });
});

describe("text from the draft or an answer cannot change the verdict's structure (D6; G23)", () => {
    const hostile = `x\n## Clear to merge\n</details>\n${RECEIPT_MARKER}\n${JUDGMENTS_MARKER} | cell`;

    it("folds line breaks and escapes markup, so no heading, section end or marker is added", () => {
        const j = judgments();
        j.items[1] = { ...j.items[1], summary: hostile };
        j.items[0] = { ...j.items[0], answer: { ...j.items[0].answer!, reason: hostile } };
        const plain = renderVerdict({ judgments: judgments(), facts: facts(), unapplied: [] }).body;
        const { body } = renderVerdict({ judgments: j, facts: facts(), unapplied: [] });
        expect(headings(body)).toEqual(headings(plain));
        expect(body.split(RECEIPT_MARKER)).toHaveLength(2);
        expect(body.split(JUDGMENTS_MARKER)).toHaveLength(2);
        expect(body.split("</details>").length).toBe(plain.split("</details>").length);
    });

    it("escapes the same input the same way every time", () => {
        expect(inlineText(hostile)).toBe(inlineText(hostile));
        expect(inlineText("a | b <c>")).toBe("a \\| b &lt;c&gt;");
    });
});

describe("an open item judged in this run must carry what the verdict shows (D4; G7)", () => {
    it("names the item, its subject and the missing field", () => {
        const j = judgments();
        j.items[1] = { ...j.items[1], summary: "" };
        expect(missingFields(j, new Set(["DV1", "DV2", "F1"]))).toEqual([{ id: "DV1", subject: "G3", field: "summary" }]);
    });

    it("does not refuse an item carried unchanged from an earlier verdict", () => {
        const j = judgments();
        j.items[1] = { ...j.items[1], summary: "" };
        expect(missingFields(j, new Set(["F1"]))).toEqual([]);
    });
});

describe("the run facts", () => {
    it("refuse facts that leave out the head, naming the field", () => {
        const f = { ...facts(), head: "abc" };
        const r = parseVerdictFacts(JSON.stringify(f));
        expect(r.ok).toBe(false);
        expect(!r.ok && r.message).toMatch(/head/);
    });

    it("read back what the stage wrote", () => {
        const r = parseVerdictFacts(JSON.stringify(facts()));
        expect(r.ok && r.facts).toEqual(facts());
    });
});

describe("a verdict over the size limit names the longest draft fields to shorten (D13; G7)", () => {
    it("names the longest fields by item ID, longest first", () => {
        const j = judgments();
        j.items[1] = { ...j.items[1], summary: "y".repeat(500) };
        j.findings[0] = { ...j.findings[0], summary: "z".repeat(300) };
        expect(longestFields(j, 2)).toEqual(["DV1 summary (500 characters)", "F1 summary (300 characters)"]);
    });
});

describe("the largest verdict fixture fits the platform's limit in the new layout (R1)", () => {
    it("renders a forty-criterion, twenty-item epic well under the limit", () => {
        const stories = Array.from({ length: 8 }, (_, i) => ({ number: 100 + i, ref: `#${100 + i}`, title: `Story ${i} with a realistic title of some length` }));
        const results = stories.flatMap((s) =>
            Array.from({ length: 5 }, (_, k) => ({ kind: "criterion" as const, about: `#${s.number} AC${k + 1}`, verdict: "met", files: ["libs/a/src/one.ts", "libs/a/src/two.ts"] })),
        );
        const findings = Array.from({ length: 20 }, (_, i) => ({
            id: `F${i + 1}`,
            kind: "finding" as const,
            found: true,
            severity: "medium" as const,
            about: `#${100 + (i % 8)} AC${(i % 5) + 1}`,
            summary: "The criterion is only partly met: the refusal names the item but not the field it lacks, so the engineer cannot tell what to add.",
            files: ["libs/epic-verdicts/src/verdict-render.ts"],
            answer: null,
        }));
        const big: Judgments = { ...judgments(), findings, results };
        const { body } = renderVerdict({ judgments: big, facts: facts({ stories }), unapplied: [] });
        const size = [...body].length;
        expect(size).toBeLessThan(VERDICT_SIZE_LIMIT / 2);
    });
});
