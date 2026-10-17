/**
 * The toolkit writes the whole published verdict from one input (epic #923, story #924; decision
 * record #949, D1, D2, D4–D6, D13; G1–G4, G7, G23, G24, R1).
 */

import { describe, expect, it } from "vitest";
import { type Judgments, JUDGMENTS_MARKER, parseJudgmentsBlock, openItems } from "@nexus/pr-acceptance/judgments-block";
import { RECEIPT_MARKER } from "@nexus/pr-acceptance/receipt-blocks";
import { parseReceiptBlock } from "@nexus/pr-acceptance/verify";
import { VERDICT_SIZE_LIMIT, longestFields } from "./publish-check.js";
import { parseAnswerLines } from "@nexus/pr-acceptance/waiver";
import { applyAnswers } from "./verdict-items.js";
import { type VerdictFacts, inlineText, locationLink, missingFields, parseVerdictFacts, renderVerdict } from "./verdict-render.js";

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
            {
                id: "DV1",
                kind: "departure",
                found: true,
                severity: "critical",
                departsFrom: "G3",
                summary: "model writes text",
                files: ["src/b.ts"],
                stub: null,
                supersedes: null,
                answer: null,
                fix: "render the body in the ID step",
                location: { file: "src/b.ts", line: 12 },
            },
        ],
        findings: [
            { id: "F1", kind: "finding", found: true, severity: "medium", about: "#924 AC2", summary: "counts differ", files: [], answer: null, fix: "count once" },
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
        const j = judgments();
        j.items[0] = { ...j.items[0], answer: null, fix: "x", location: { file: "src/a.ts", line: 1 } };
        j.findings[0] = { ...j.findings[0], severity: "high" };
        const body = renderVerdict({ judgments: j, facts: facts(), unapplied: [] }).body;
        const order = ["DV1", "DV2", "F1"].map((id) => body.indexOf(`**${id}**`));
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
        const canonical = ["### Needs action", "### Worth a look", "### Already answered", "### No longer found", "### Stories", "### Epic level"];
        for (const body of [one, other]) {
            const shown = headings(body).slice(1);
            expect(shown).toEqual(canonical.filter((h) => shown.includes(h)));
        }
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

    it("requires a fix, and a location when the item has files (#925)", () => {
        const j = judgments();
        const { fix: _fix, location: _location, ...bare } = j.items[1] as typeof j.items[1] & { fix?: string };
        j.items[1] = bare;
        expect(missingFields(j, new Set(["DV1"]))).toEqual([
            { id: "DV1", subject: "G3", field: "fix" },
            { id: "DV1", subject: "G3", field: "location" },
        ]);
    });

    it("does not refuse an item carried unchanged from an earlier verdict", () => {
        const j = judgments();
        j.items[1] = { ...j.items[1], summary: "" };
        expect(missingFields(j, new Set(["F1"]))).toEqual([]);
    });
});

describe("the verdict shows what blocks first, and how to resolve each item (epic #923, story #925)", () => {
    const render = (j: Judgments = judgments(), unapplied: Parameters<typeof renderVerdict>[0]["unapplied"] = []): string => renderVerdict({ judgments: j, facts: facts(), unapplied }).body;

    it("says blocked or clear to merge on the first line, then the open count per severity (D7; G9)", () => {
        expect(render().split("\n")[0]).toMatch(/^## Blocked · critical 1 · high 0 · medium 1 · low 0 · checks by hand 1$/);
        const clear = judgments();
        clear.items = clear.items.filter((d) => d.id !== "DV1");
        expect(render(clear).split("\n")[0]).toMatch(/^## Clear to merge · critical 0 · high 0 · medium 1 · low 0/);
    });

    it("orders the item sections needs action, worth a look, already answered, no longer found (D8; G10)", () => {
        const at = ["### Needs action", "### Worth a look", "### Already answered", "### No longer found"].map((h) => render().indexOf(h));
        expect(at.every((x) => x > 0)).toBe(true);
        expect([...at].sort((a, b) => a - b)).toEqual(at);
    });

    it("shows an open item's ID, severity and subject, then what is wrong, the location link, and how to resolve it (G11)", () => {
        const body = render();
        const item = body.slice(body.indexOf("**DV1**"), body.indexOf("### Worth a look"));
        expect(item.split("\n")[0]).toBe("**DV1** · critical · G3");
        const order = ["What is wrong: model writes text", "Location: [src/b.ts:12]", "Fix: render the body in the ID step", "DV1 — accepted:", "/nxs.analyze --pr 12 --resolve"].map((t) => item.indexOf(t));
        expect(order.every((x) => x > 0)).toBe(true);
        expect([...order].sort((a, b) => a - b)).toEqual(order);
    });

    it("links the location at the analyzed head in the code repository, host included (D10; G16)", () => {
        expect(render()).toContain(`(https://github.com/acme/app/blob/${HEAD}/src/b.ts#L12)`);
        expect(locationLink({ repo: "git.example.com/acme/app", head: HEAD }, { file: "a b.ts", line: 3 })).toBe(`[a b.ts:3](https://git.example.com/acme/app/blob/${HEAD}/a%20b.ts#L3)`);
    });

    it("prints a paste line in its own code block that applies nothing pasted unedited (D9; G12, R2)", () => {
        const body = render();
        expect(body).toContain("  ```text\n  DV1 — accepted:\n  ```");
        const pasted = parseAnswerLines("DV1 — accepted:");
        expect(pasted.every((a) => a.reason.length === 0)).toBe(true);
        const applied = applyAnswers(judgments(), pasted.map((a) => ({ ...a, author: "lead", url: "u", at: "2026-10-17T00:00:00Z", trusted: true })));
        expect(applied.unapplied.map((u) => u.why)).toEqual(["no-reason"]);
    });

    it("gives medium and low findings a fix and no paste line", () => {
        const body = render();
        const worth = body.slice(body.indexOf("### Worth a look"), body.indexOf("### Already answered"));
        expect(worth).toContain("Fix: count once");
        expect(worth).not.toContain("F1 — waived:");
    });

    it("shows the deferral approval line only on the item it settles (R2)", () => {
        const j = judgments();
        j.deferred = [{ id: "DS1", kind: "deferred-scope", found: true, settles: "DV1", summary: "the rest", answer: null }];
        const body = render(j);
        expect(body.split("DS1 — approved:")).toHaveLength(2);
        expect(body.indexOf("DS1 — approved:")).toBeLessThan(body.indexOf("### Worth a look"));
    });

    it("shows an answered item's subject, then the answer, who gave it, the reason and its ID (G13)", () => {
        expect(render()).toMatch(/- D4 — accepted by @lead \(\[comment\]\(https:\/\/github\.com\/acme\/app\/pull\/12#c1\)\): fine for now · DV2/);
    });

    it("lists an item no longer found with its answer, never dropping it (G14)", () => {
        const body = render();
        expect(body.slice(body.indexOf("### No longer found"))).toContain("#924 AC1 · F2 · unanswered");
    });

    it("names every answer that applied nothing, with its author and link (G15)", () => {
        const body = render(judgments(), [
            { id: "DV1", verb: "accepted", author: "guest", url: "https://x/1", why: "untrusted" },
            { id: "F9", verb: "waived", author: "lead", url: "https://x/2", why: "unknown-id" },
        ]);
        const needs = body.slice(body.indexOf("### Needs action"), body.indexOf("### Worth a look"));
        expect(needs).toContain("Answer not applied: @guest on DV1 ([comment](https://x/1)): untrusted");
        expect(needs).toContain("Answer not applied: @lead on F9 ([comment](https://x/2)): unknown-id");
    });
});

describe("supporting detail is collapsed so the issues stay on top (epic #923, story #926)", () => {
    const render = (j: Judgments = judgments(), f: VerdictFacts = facts()): string => renderVerdict({ judgments: j, facts: f, unapplied: [] }).body;
    const between = (body: string, from: string, to: string): string => body.slice(body.indexOf(from), body.indexOf(to, body.indexOf(from)));

    it("shows counts only in the stories table, and the evidence per criterion in a collapsed section (D11; G17)", () => {
        const j = judgments();
        j.results = j.results!.map((r) => (r.about === "#924 AC1" ? { ...r, evidence: "src/a.ts:4" } : r));
        const body = render(j);
        expect(between(body, "### Stories", "<details>")).not.toContain("src/a.ts");
        expect(between(body, "| Story |", "\n\n")).toContain("| #924 Same structure | 1/3 | 1 | 0 | 0 | 1 |");
        const evidence = between(body, "<summary>Evidence</summary>", "</details>");
        expect(body.indexOf("<details>\n<summary>Evidence</summary>")).toBeGreaterThan(0);
        expect(evidence).toContain("| #924 AC1 | met | src/a.ts:4 |");
    });

    it("shows the epic-level results in one table, one row per check (G18)", () => {
        const j = judgments();
        j.results = [...j.results!, { kind: "metric", about: "verdicts lead with blockers", verdict: "met", files: [] }];
        const body = render(j, facts({ epicLevel: { state: "judge", lines: [] } }));
        const table = between(body, "### Epic level", "<details>\n<summary>Run details");
        expect(table).toContain("| Check | Result |");
        expect(table).toContain("| G1 | held |");
        expect(table).toContain("| verdicts lead with blockers | met |");
        expect(table.match(/^###/gm)).toHaveLength(1);
        expect(render(j, facts({ epicLevel: { state: "not-run", lines: ["update the branch"] } }))).toMatch(/\| Epic-level check \| not run: update the branch \|/);
        expect(render(j)).not.toContain("### Epic level");
    });

    it("leaves out a section with nothing to report (G19)", () => {
        const body = render({ items: [], findings: [], deferred: [], keyDecisions: { record: null, stubs: [] } }, facts({ record: null }));
        for (const h of ["### Needs action", "### Worth a look", "### Already answered", "### No longer found", "<summary>Evidence</summary>", "### Epic level"]) {
            expect(body).not.toContain(h);
        }
        expect(body).not.toContain("None.");
    });

    it("puts the mode, the record and its full hash, the head and the key decisions in a collapsed run-details section, ending with both blocks (G20, G21, G24)", () => {
        const body = render();
        const details = body.slice(body.indexOf("<details>\n<summary>Run details</summary>"));
        expect(details).toContain("- Mode: full");
        expect(details).toContain(`- Record: #949 @ ${HASH}`);
        expect(details).toContain(`- Head: ${HEAD}`);
        expect(details).toContain(`- Key decisions: D1, D2 @ ${HASH}`);
        expect(details.indexOf(RECEIPT_MARKER)).toBeGreaterThan(details.indexOf("- Key decisions"));
        expect(details.indexOf(JUDGMENTS_MARKER)).toBeGreaterThan(details.indexOf(RECEIPT_MARKER));
        expect(details.trimEnd().endsWith("</details>")).toBe(true);
        expect(body.slice(0, body.indexOf("<summary>Run details"))).not.toContain(RECEIPT_MARKER);
    });

    it("says no concept invariants were checked when the epic lists no concept pages (G22)", () => {
        expect(render()).toContain("No concept invariants were checked: the epic lists no concept pages.");
        expect(render(judgments(), facts({ concepts: { pages: ["record-digest"], checked: 3, notFound: [] } }))).toContain("3 concept invariants checked, from record-digest.");
    });

    it("carries each result's evidence in the judgments block for a later recording run (D3)", () => {
        const j = judgments();
        j.results = j.results!.map((r) => ({ ...r, evidence: `${r.about} at src/x.ts:1` }));
        const parsed = parseJudgmentsBlock(render(j));
        expect(parsed.ok && parsed.judgments?.results?.[0].evidence).toBe("#924 AC1 at src/x.ts:1");
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
