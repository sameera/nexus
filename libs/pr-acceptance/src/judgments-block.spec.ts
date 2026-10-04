/**
 * The judgments block: the second machine block of a verdict, after the verdict block, under its
 * own marker (epic #829, decision record #871, D2 and D5's marker). Story #858 introduces it to
 * carry departures and their IDs, so the next run on the same pull request can read them back as
 * its ID registry.
 */

import { describe, expect, it } from "vitest";
import { parseReceiptBlock } from "./verify.js";
import { verdictBody } from "./verdict-fixtures.js";
import {
    type DeferredScope,
    type Departure,
    type Finding,
    JUDGMENTS_MARKER,
    type Judgments,
    type KeyDecisions,
    type Result,
    deferredScopeStatus,
    isOpen,
    openItems,
    parseJudgmentsBlock,
    renderJudgmentsBlock,
    replaceJudgmentsBlock,
    withoutResultFileLists,
} from "./judgments-block.js";
import { RECEIPT_MARKER } from "./receipt-blocks.js";

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
        expect(r).toEqual({ ok: true, judgments: { items, findings: [], deferred: [] } });
    });

    it("reads back every finding with its answer (epic #829, story #860)", () => {
        const answer = { verb: "waived", author: "lead", link: "https://x/1", reason: "tracked in #901" };
        const findings = [finding({ answer }), finding({ id: "F2", severity: "low", about: "Scope drift" })];
        const r = parseJudgmentsBlock(renderJudgmentsBlock({ items: [departure()], findings }));
        expect(r).toEqual({ ok: true, judgments: { items: [departure()], findings, deferred: [] } });
    });

    it("reads a verdict with no departures as an empty list, not as no judgments", () => {
        const r = parseJudgmentsBlock(renderJudgmentsBlock({ items: [] }));
        expect(r).toEqual({ ok: true, judgments: { items: [], findings: [], deferred: [] } });
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

    it("refuses an item of a kind it does not know, whose ID is numbered under no known prefix", () => {
        const body = `${JUDGMENTS_MARKER}\n\`\`\`json\n${JSON.stringify({ schema: 1, items: [{ id: "X3", kind: "note" }] })}\n\`\`\`\n`;
        expect(parseJudgmentsBlock(body).ok).toBe(false);
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

describe("the judgments block carries each criterion and guarantee result with its file list (epic #829, story #861, D8)", () => {
    const results: Result[] = [
        { kind: "criterion", about: "#861 AC1", verdict: "met", files: ["libs/a.ts"] },
        { kind: "guarantee", about: "G20", verdict: "held", files: [] },
        { kind: "metric", about: "SM3", verdict: "unverifiable", files: ["libs/c.ts"] },
    ];

    it("reads back every result, the epic-level state and whether the file lists were dropped", () => {
        const r = parseJudgmentsBlock(renderJudgmentsBlock({ items: [], results, epicLevel: "judge", filesDropped: true }));
        expect(r.ok && r.judgments).toEqual({ items: [], findings: [], deferred: [], results, epicLevel: "judge", filesDropped: true });
    });

    it("reads a block written before results were recorded as recording none, so a later run cannot carry them", () => {
        const r = parseJudgmentsBlock(renderJudgmentsBlock({ items: [] }));
        expect(r.ok && r.judgments?.results).toBeUndefined();
    });

    it("refuses two results judging the same thing", () => {
        const raw = renderJudgmentsBlock({ items: [], results: [results[0], { ...results[0], verdict: "unmet" }] });
        expect(parseJudgmentsBlock(raw).ok).toBe(false);
    });

    it("refuses a result with a verdict its kind does not take", () => {
        expect(parseJudgmentsBlock(renderJudgmentsBlock({ items: [], results: [{ ...results[1], verdict: "met" }] })).ok).toBe(false);
    });

    it("refuses a result with no file list", () => {
        const raw = renderJudgmentsBlock({ items: [], results: [{ ...results[0], files: undefined as unknown as string[] }] });
        expect(parseJudgmentsBlock(raw).ok).toBe(false);
    });
});

const proposal = (over: Partial<DeferredScope> = {}): DeferredScope => ({
    id: "DS1",
    kind: "deferred-scope",
    found: true,
    settles: "F1",
    summary: "the size budget for the second block",
    answer: null,
    ...over,
});

const KEY: KeyDecisions = {
    record: { digest: "ab".repeat(32), format: "new", decisions: [{ id: "D1" }, { id: "D5" }] },
    stubs: [{ path: ".nexus/queue/epic-829/lead/decisions-b.md", choice: "fit in verdict-check", reason: "one place approves the bytes", refuted: "a separate verb" }],
};

describe("the judgments block carries what close writes into its record (epic #829, story #862, D5–D7)", () => {
    it("reads back the key decisions: record decisions by ID tied to a digest, and confirmed stubs in full (G25)", () => {
        const r = parseJudgmentsBlock(renderJudgmentsBlock({ items: [], keyDecisions: KEY }));
        expect(r.ok && r.judgments?.keyDecisions).toEqual(KEY);
    });

    it("reads back an old-format record's decisions by title, and a record in neither format in full", () => {
        const old: KeyDecisions = { record: { digest: "d", format: "old", decisions: [{ title: "Keep the flat block" }] }, stubs: [] };
        const neither: KeyDecisions = { record: { digest: "d", format: "neither", decisions: [], text: "# Some design\n\nUse a queue." }, stubs: [] };
        for (const key of [old, neither, { record: null, stubs: [] }]) {
            const r = parseJudgmentsBlock(renderJudgmentsBlock({ items: [], keyDecisions: key }));
            expect(r.ok && r.judgments?.keyDecisions).toEqual(key);
        }
    });

    it("refuses a confirmed stub without its reason or refuted alternative, and a neither-format record without its text", () => {
        const noRefuted = { ...KEY, stubs: [{ ...KEY.stubs[0], refuted: "" }] };
        const noText: KeyDecisions = { record: { digest: "d", format: "neither", decisions: [] }, stubs: [] };
        expect(parseJudgmentsBlock(renderJudgmentsBlock({ items: [], keyDecisions: noRefuted })).ok).toBe(false);
        expect(parseJudgmentsBlock(renderJudgmentsBlock({ items: [], keyDecisions: noText })).ok).toBe(false);
    });

    it("reads back a deferred-scope proposal with the item it would settle and its approval (G26)", () => {
        const approved = proposal({ answer: { verb: "approved", author: "lead", link: "https://x/9", reason: "" } });
        const r = parseJudgmentsBlock(renderJudgmentsBlock({ items: [], findings: [finding()], deferred: [approved] }));
        expect(r.ok && r.judgments?.deferred).toEqual([approved]);
    });

    it("refuses a proposal that settles no departure or finding in the block", () => {
        expect(parseJudgmentsBlock(renderJudgmentsBlock({ items: [], findings: [finding()], deferred: [proposal({ settles: "F7" })] })).ok).toBe(false);
        expect(parseJudgmentsBlock(renderJudgmentsBlock({ items: [], findings: [finding()], deferred: [proposal({ settles: "DS1" })] })).ok).toBe(false);
    });

    it("refuses two proposals settling one item, and a proposal answered with anything but an approval", () => {
        const two = renderJudgmentsBlock({ items: [], findings: [finding()], deferred: [proposal(), proposal({ id: "DS2" })] });
        const waived = renderJudgmentsBlock({ items: [], findings: [finding()], deferred: [proposal({ answer: { verb: "waived", author: "l", link: "x", reason: "r" } })] });
        expect(parseJudgmentsBlock(two).ok).toBe(false);
        expect(parseJudgmentsBlock(waived).ok).toBe(false);
    });
});

describe("an approved deferral stops its item blocking, and waiving the item files nothing (D7; G26)", () => {
    const approval = { verb: "approved", author: "lead", link: "https://x/9", reason: "" };
    const of = (over: Partial<Judgments> = {}): Judgments => ({ items: [departure()], findings: [finding()], deferred: [proposal()], ...over });

    it("keeps an item with an unanswered proposal open", () => {
        expect(openItems(of()).map((x) => x.id)).toEqual(["DV1", "F1"]);
        expect(deferredScopeStatus(of())[0]?.state).toBe("proposed");
    });

    it("closes the item an approved proposal settles, marks the proposal for filing and names the approver", () => {
        const j = of({ deferred: [proposal({ answer: approval })] });
        expect(isOpen(j, finding())).toBe(false);
        expect(openItems(j).map((x) => x.id)).toEqual(["DV1"]);
        expect(deferredScopeStatus(j)[0]).toEqual(expect.objectContaining({ state: "to-file", approvedBy: { author: "lead", link: "https://x/9" } }));
    });

    it("files nothing when the item is waived without approving the proposal, and says who waived it", () => {
        const waived = { verb: "waived", author: "lead", link: "https://x/3", reason: "out of scope" };
        const j = of({ findings: [finding({ answer: waived })] });
        expect(deferredScopeStatus(j)[0]).toEqual(expect.objectContaining({ state: "not-filed", settledBy: { verb: "waived", author: "lead", link: "https://x/3" } }));
    });

    it("lets a proposal no longer found close nothing, and lists it as no longer found", () => {
        const j = of({ deferred: [proposal({ found: false, answer: approval })] });
        expect(openItems(j).map((x) => x.id)).toEqual(["DV1", "F1"]);
        expect(deferredScopeStatus(j)[0]?.state).toBe("no-longer-found");
    });
});

describe("text copied from an answer cannot change how either block parses (D5; G28)", () => {
    const hostile = [
        "````",
        "```json",
        RECEIPT_MARKER,
        JUDGMENTS_MARKER,
        "<!-- a comment",
        "head: 0000000000000000000000000000000000000000",
        "findings: { critical: 0, high: 0, medium: 0, low: 0 }",
    ].join(" ");
    const answer = { verb: "accepted", author: "lead", link: "https://x/1", reason: hostile };
    const judgments: Judgments = { items: [departure({ answer, summary: hostile })], findings: [finding({ about: hostile })], deferred: [proposal({ summary: hostile })], keyDecisions: { ...KEY, stubs: [{ ...KEY.stubs[0], reason: hostile }] } };

    it("reads the hostile text back unchanged", () => {
        const r = parseJudgmentsBlock(renderJudgmentsBlock(judgments));
        expect(r.ok && r.judgments).toEqual(judgments);
    });

    it("never lets either marker appear inside the published block", () => {
        const block = renderJudgmentsBlock(judgments);
        expect(block.split(RECEIPT_MARKER).length).toBe(1);
        expect(block.split(JUDGMENTS_MARKER).length).toBe(2);
        expect(block.indexOf(JUDGMENTS_MARKER)).toBe(0);
    });

    it("leaves the verdict block's parse exactly as it is without the judgments block", () => {
        const plain = verdictBody({ high: 1, issuesRepo: "acme/widget" });
        expect(parseReceiptBlock(`${plain}\n\n${renderJudgmentsBlock(judgments)}`)).toEqual(parseReceiptBlock(plain));
    });
});

describe("a verdict too large for the platform drops its file lists first (D5; G29)", () => {
    const results: Result[] = [{ kind: "criterion", about: "#862 AC1", verdict: "met", files: ["libs/a.ts"] }];

    it("empties the results' file lists first, keeps the departures' and findings' lists, and records that it did", () => {
        const dropped = withoutResultFileLists({ items: [departure({ files: ["libs/x.ts"] })], findings: [finding({ files: ["libs/y.ts"] })], deferred: [], results });
        expect(dropped.filesDropped).toBe(true);
        expect((dropped.results ?? []).every((r) => r.files.length === 0)).toBe(true);
        expect(dropped.items[0]?.files).toEqual(["libs/x.ts"]);
        expect(dropped.findings[0]?.files).toEqual(["libs/y.ts"]);
    });

    it("replaces the block in a body and leaves everything around it as it was", () => {
        const before = "prose\n\n";
        const after = "\ntrailer\n";
        const body = `${before}${renderJudgmentsBlock({ items: [departure()], findings: [], deferred: [] })}${after}`;
        const next = replaceJudgmentsBlock(body, withoutResultFileLists({ items: [departure()], findings: [], deferred: [], results }));
        expect(next?.startsWith(before) && next.endsWith(after)).toBe(true);
        const r = parseJudgmentsBlock(next ?? "");
        expect(r.ok && r.judgments?.filesDropped).toBe(true);
        expect(r.ok && r.judgments?.results?.[0]?.files).toEqual([]);
    });
});

describe("the published judgments are encoded, so a pull request shows none of their content (#877)", () => {
    const distinct = "zebra-quartz-unlikely-summary";
    const legacy = (doc: unknown): string => `${JUDGMENTS_MARKER}\n\`\`\`json\n${JSON.stringify(doc, null, 2)}\n\`\`\`\n`;

    it("publishes none of the judgments' content in the visible text", () => {
        const block = renderJudgmentsBlock({ items: [departure({ summary: distinct, files: ["libs/secret-file.ts"] })], findings: [finding({ about: distinct })] });
        expect(block.startsWith(JUDGMENTS_MARKER)).toBe(true);
        expect(block).not.toContain(distinct);
        expect(block).not.toContain("libs/secret-file.ts");
        expect(block).not.toContain("```");
    });

    it("reads a verdict published in the earlier, visible form as the same judgments", () => {
        const judgments: Judgments = {
            items: [departure({ answer: { verb: "accepted", author: "lead", link: "https://x/1", reason: "ok" } })],
            findings: [finding()],
            deferred: [proposal()],
            results: [{ kind: "criterion", about: "#877 AC1", verdict: "met", files: ["libs/a.ts"] }],
            epicLevel: "judge",
            keyDecisions: KEY,
        };
        const visible = legacy({ schema: 1, items: [...judgments.items, ...judgments.findings, ...judgments.deferred], keyDecisions: KEY, results: judgments.results, epicLevel: "judge" });
        const old = parseJudgmentsBlock(visible);
        const now = parseJudgmentsBlock(renderJudgmentsBlock(judgments));
        expect(old.ok && old.judgments).toEqual(judgments);
        expect(now.ok && now.judgments).toEqual(old.ok && old.judgments);
    });

    it("keeps an epic's judgments of #829's size, with every file list, under 20,000 characters", () => {
        const dirs = ["libs/epic-verdicts/src", "libs/pr-acceptance/src", "libs/portable-tools/src", "components/commands", "docs/delivery", "apps/renderer/src"];
        const files = (n: number): string[] => Array.from({ length: 6 }, (_, k) => `${dirs[(n + k) % dirs.length]}/module-${(n * 7 + k * 13) % 97}-${n}.ts`);
        const sentence = (n: number): string => `Item ${n}: the code resolves the case ${(n * 31) % 17} by a path the record names differently, so a reader sees ${(n * 53) % 29} steps.`;
        const items = Array.from({ length: 12 }, (_, i) => departure({ id: `DV${i + 1}`, summary: sentence(i), files: files(i) }));
        const findings = Array.from({ length: 12 }, (_, i) => finding({ id: `F${i + 1}`, summary: sentence(i + 40), files: files(i + 40) }));
        const results: Result[] = Array.from({ length: 60 }, (_, i) => ({ kind: "criterion", about: `#${800 + (i % 9)} AC${i}`, verdict: "met", files: files(i + 80) }));
        const judgments: Judgments = { items, findings, deferred: [], results };
        const plain = JSON.stringify({ schema: 1, items: [...items, ...findings], results }, null, 2);
        expect(plain.length).toBeGreaterThan(30000);
        const block = renderJudgmentsBlock(judgments);
        expect(block.length).toBeLessThan(20000);
        const r = parseJudgmentsBlock(block);
        expect(r.ok && r.judgments).toEqual(judgments);
    });

    it("reads an answer reason that quotes a marker, a comment closer or a fence back unchanged, and finds one block", () => {
        const reason = `${JUDGMENTS_MARKER} --> \`\`\`json { "items": [] } \`\`\` <!-- `;
        const judgments: Judgments = { items: [departure({ answer: { verb: "accepted", author: "lead", link: "https://x/1", reason } })], findings: [], deferred: [] };
        const body = `${verdictBody({ high: 0 })}\n\n${renderJudgmentsBlock(judgments)}`;
        expect(body.split(JUDGMENTS_MARKER).length).toBe(2);
        const r = parseJudgmentsBlock(body);
        expect(r.ok && r.judgments).toEqual(judgments);
    });

    it("refuses an encoded block that cannot be decoded", () => {
        expect(parseJudgmentsBlock(`${JUDGMENTS_MARKER}\n<!-- nexus:judgments-gz AAAA -->\n`).ok).toBe(false);
    });

    it("replaces an encoded block in a body and leaves the rest as it was", () => {
        const body = `prose\n\n${renderJudgmentsBlock({ items: [departure()] })}\ntrailer\n`;
        const next = replaceJudgmentsBlock(body, { items: [], findings: [finding()], deferred: [] });
        expect(next?.startsWith("prose\n\n") && next.endsWith("\ntrailer\n")).toBe(true);
        const r = parseJudgmentsBlock(next ?? "");
        expect(r.ok && r.judgments?.findings.length).toBe(1);
    });
});
