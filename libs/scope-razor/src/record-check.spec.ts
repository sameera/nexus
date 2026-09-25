/**
 * The checkpoint's cross-reference checks over a new-format record draft (epic #787, story #792, D7).
 *
 * Each gap blocks filing unless the Approval brief lists the item's ID in the right group. These
 * specs assert which item is named and whether the draft blocks, not the wording of the finding.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkDraft, type RazorFinding } from "./check.js";

const HERE: string = path.dirname(fileURLToPath(import.meta.url));
const TRIAL: string = path.join(HERE, "..", "..", "..", "docs", "features", "artifact-prose-style", "decision-record-trial");
const RECORD_245: string = fs.readFileSync(path.join(TRIAL, "record-245.md"), "utf8");
const RECORD_786: string = fs.readFileSync(path.join(TRIAL, "record-786.md"), "utf8");

/** A source text holding the given number of stories, as the materialized epic writes them. */
const source = (stories: number): string =>
    ["# Epic: A Capability", "", "## User Stories", "", ...Array.from({ length: stories }, (_, i) => [`### Story #${100 + i}: Story ${i + 1}`, "", "Some text.", ""].join("\n"))].join("\n");

interface Decision {
    id: string;
    tradeOff?: string;
    commitment?: string;
    deliveredBy?: string;
    guarantees?: string;
}

function decision(d: Decision): string[] {
    const field = (name: string, value: string | undefined): string[] => (value === undefined ? [] : [`- **${name}:** ${value}`]);
    return [
        `#### ${d.id} — A choice`,
        "",
        "- **Decision:** a thing.",
        "- **Why:** a reason.",
        "- **Refuted viable alternative:** none",
        ...field("Trade-off", d.tradeOff ?? "none"),
        ...field("Epic commitment affected", d.commitment ?? "none"),
        ...field("Delivered by", d.deliveredBy),
        ...field("Guarantees", d.guarantees ?? "G1"),
        "",
    ];
}

function record(parts: { resolve?: string[]; choices?: string[]; before?: string[]; guarantees?: string[]; existing?: string[]; decisions?: Decision[] }): string {
    const group = (name: string, items: string[] | undefined): string[] => (items === undefined ? [] : [`**${name}**`, "", ...items, ""]);
    return [
        "# Decision Record: A Capability",
        "",
        "## How it works",
        "",
        "The design works (D1).",
        "",
        "## Approval brief",
        "",
        "Approval covers the whole record.",
        "",
        ...group("Resolve before approval", parts.resolve),
        ...group("Choices with trade-offs", parts.choices),
        ...group("Before implementation", parts.before),
        "## Guarantees",
        "",
        "### Filing",
        "",
        ...(parts.guarantees ?? ["- G1. A thing holds. (D1) `[inferred]`"]),
        "",
        "### Existing behaviour to preserve",
        "",
        ...(parts.existing ?? ["- G9. Logins keep working. `[inferred]`"]),
        "",
        "## Risks and dependencies",
        "",
        "- R1 ADDRESS — a thing. Delivered by #100. `[inferred]`",
        "",
        "## Design rationale and mechanism",
        "",
        "### Decisions and reasons",
        "",
        ...(parts.decisions ?? [{ id: "D1", deliveredBy: "#100" }]).flatMap(decision),
    ].join("\n");
}

const crossRefs = (body: string, src: string = source(1), options: { stories?: number } = {}): RazorFinding[] =>
    checkDraft(body, src, { record: true, ...options }).filter((f: RazorFinding) => f.rule === "cross-reference");
const named = (findings: RazorFinding[]): string[] => findings.map((f: RazorFinding) => f.where.match(/^[DG]\d+/)?.[0] ?? f.where);
const lineOf = (body: string, text: string): number => body.split("\n").findIndex((line: string) => line.includes(text)) + 1;

/** A worked example with a label on every guarantee and every risk, as a drafted record carries. */
function labelled(body: string): string {
    let section: string = "";
    return body
        .split("\n")
        .map((line: string) => {
            if (/^## /.test(line)) section = line;
            const listed: boolean = /^## (Guarantees|Risks)/.test(section) && /^- [GR]\d+\b/.test(line);
            return listed ? `${line} \`[inferred]\`` : line;
        })
        .join("\n");
}

describe("a clean new-format draft", () => {
    it("raises no finding at all", () => {
        const body: string = record({
            choices: ["- D1. A thing.", "  - Trade-off: a cost."],
            decisions: [{ id: "D1", tradeOff: "a cost.", deliveredBy: "#100" }],
        });
        expect(checkDraft(body, source(2), { record: true })).toEqual([]);
    });
});

describe("a guarantee that cites no decision (G12)", () => {
    const unsupported: string[] = ["- G1. A thing holds. (D1) `[inferred]`", "- G2. Another thing holds. `[inferred]`"];

    it("blocks, naming the guarantee and its line", () => {
        const body: string = record({ guarantees: unsupported });
        const found: RazorFinding[] = crossRefs(body);
        expect(named(found)).toEqual(["G2"]);
        expect(found[0].severity).toBe("blocking");
        expect(found[0].where).toContain(`line ${lineOf(body, "- G2.")}`);
    });

    it("passes when the Approval brief lists it under Resolve before approval", () => {
        expect(crossRefs(record({ guarantees: unsupported, resolve: ["- G2 has no supporting decision. Add one, or drop it."] }))).toEqual([]);
    });

    it("still blocks when the brief lists it in another group", () => {
        expect(named(crossRefs(record({ guarantees: unsupported, before: ["- G2 needs a decision."] })))).toEqual(["G2"]);
    });

    it("matches the ID as a whole token, so G21 does not stand for G2", () => {
        expect(named(crossRefs(record({ guarantees: unsupported, resolve: ["- G21 has no supporting decision."] })))).toEqual(["G2"]);
    });

    it("does not count an ID quoted inside a provenance label", () => {
        expect(named(crossRefs(record({ guarantees: unsupported, resolve: ['- A thing to settle. `[asked: "settle G2 before we ship"]`'] })))).toEqual(["G2"]);
    });

    it("does not require a decision for a guarantee under Existing behaviour to preserve", () => {
        expect(crossRefs(record({ existing: ["- G9. Logins keep working. `[inferred]`", "- G10. Logouts keep working. `[inferred]`"] }))).toEqual([]);
    });
});

describe("a decision that names no delivering story (G12)", () => {
    const decisions: Decision[] = [
        { id: "D1", deliveredBy: "#100" },
        { id: "D2", deliveredBy: "none" },
        { id: "D3" },
    ];

    it("blocks in a multi-story epic, naming each decision whose Delivered by is none or absent", () => {
        const body: string = record({ decisions });
        const found: RazorFinding[] = crossRefs(body, source(2));
        expect(named(found)).toEqual(["D2", "D3"]);
        expect(found[0].where).toContain(`line ${lineOf(body, "- **Delivered by:** none")}`);
    });

    it("passes a decision the brief lists under Resolve before approval", () => {
        expect(named(crossRefs(record({ decisions, resolve: ["- D2 and D3 have no delivering story. Amend a story, or drop them."] }), source(2)))).toEqual([]);
    });

    it("still blocks a decision the brief lists only under Choices with trade-offs", () => {
        expect(named(crossRefs(record({ decisions, choices: ["- D2. A thing.", "- D3. Another."] }), source(2)))).toEqual(["D2", "D3"]);
    });

    it("requires no delivering story in a single-story epic", () => {
        expect(crossRefs(record({ decisions }), source(1))).toEqual([]);
    });

    it("takes the story count from the caller when it is given, rather than from the source text", () => {
        expect(named(crossRefs(record({ decisions }), source(1), { stories: 3 }))).toEqual(["D2", "D3"]);
        expect(crossRefs(record({ decisions }), source(3), { stories: 1 })).toEqual([]);
    });
});

describe("a decision that changes epic or story text (G13)", () => {
    const withCommitment = (commitment: string, resolve?: string[]): string =>
        record({ decisions: [{ id: "D1", deliveredBy: "#100", commitment }], resolve: resolve ?? ["- #100 needs rewording (D1). Checked 2026-09-25: unchanged."] });

    it("blocks when the old wording is not given exactly, even when the brief lists the decision", () => {
        const body: string = withCommitment('#100. Old: no criterion. New: "a new criterion". Status: pending.');
        const found: RazorFinding[] = crossRefs(body);
        expect(named(found)).toEqual(["D1"]);
        expect(found[0].where).toContain(`line ${lineOf(body, "Epic commitment affected")}`);
    });

    it("blocks when the new wording is not given", () => {
        expect(named(crossRefs(withCommitment('#100 metric 1. Old: "a metric". New: none offered. Status: unresolved (the record declines to amend it).')))).toEqual(["D1"]);
        expect(named(crossRefs(withCommitment("#100. Status: unresolved (the lead has not chosen the wording).")))).toEqual(["D1"]);
    });

    it("passes both wordings given, with an empty old wording for an addition", () => {
        expect(crossRefs(withCommitment('#100. Old: "a thing". New: "another thing". Status: pending.'))).toEqual([]);
        expect(crossRefs(withCommitment('#100. Old: "". New: "a new criterion". Status: pending.'))).toEqual([]);
    });
});

describe("an epic or story change that is not yet made (G14)", () => {
    const pending = (status: string, brief: { resolve?: string[]; choices?: string[] } = {}): string =>
        record({ decisions: [{ id: "D1", deliveredBy: "#100", commitment: `#100. Old: "a thing". New: "another thing". Status: ${status}.` }], ...brief });

    it("blocks a pending change the brief does not list under Resolve before approval, naming the decision", () => {
        expect(named(crossRefs(pending("pending")))).toEqual(["D1"]);
    });

    it("passes a pending change listed under Resolve before approval", () => {
        expect(crossRefs(pending("pending", { resolve: ["- #100 needs rewording (D1). Checked 2026-09-25: unchanged."] }))).toEqual([]);
    });

    it("still blocks a pending change listed only under Choices with trade-offs", () => {
        expect(named(crossRefs(pending("pending", { choices: ["- D1. A thing."] })))).toEqual(["D1"]);
    });

    it("blocks an unresolved change the brief does not list, and passes one it does", () => {
        expect(named(crossRefs(pending("unresolved (the lead is deciding)")))).toEqual(["D1"]);
        expect(crossRefs(pending("unresolved (the lead is deciding)", { resolve: ["- D1's change is undecided."] }))).toEqual([]);
    });

    it("asks nothing of an amended change", () => {
        expect(crossRefs(pending("amended (verified 2026-09-25)"))).toEqual([]);
    });
});

describe("a decision with a trade-off (G14, G5)", () => {
    const traded = (brief: { resolve?: string[]; choices?: string[]; before?: string[] }, id: string = "D3"): string =>
        record({ decisions: [{ id: "D1", deliveredBy: "#100" }, { id, tradeOff: "a cost.", deliveredBy: "#100" }], ...brief });

    it("blocks when the Approval brief does not list it, naming the decision", () => {
        const body: string = traded({});
        const found: RazorFinding[] = crossRefs(body);
        expect(named(found)).toEqual(["D3"]);
        expect(found[0].where).toContain(`line ${lineOf(body, "- **Trade-off:** a cost.")}`);
    });

    it("passes when it is listed under Choices with trade-offs or under Resolve before approval", () => {
        expect(crossRefs(traded({ choices: ["- D3. A thing.", "  - Trade-off: a cost."] }))).toEqual([]);
        expect(crossRefs(traded({ resolve: ["- A thing to settle (D3).", "  - Trade-off: a cost."] }))).toEqual([]);
    });

    it("still blocks when it is listed in another group of the brief", () => {
        expect(named(crossRefs(traded({ before: ["- D3 needs a plan."] })))).toEqual(["D3"]);
    });

    it("matches the ID as a whole token, so D31 does not stand for D3", () => {
        expect(named(crossRefs(traded({ choices: ["- D31. A thing.", "  - Trade-off: a cost."] })))).toEqual(["D3"]);
        expect(named(crossRefs(traded({ choices: ["- D3. A thing.", "  - Trade-off: a cost."] }, "D31")))).toEqual(["D31"]);
    });

    it("blocks a decision listed under both Resolve before approval and Choices with trade-offs, since it appears once", () => {
        const found: RazorFinding[] = crossRefs(traded({ resolve: ["- A thing to settle (D3)."], choices: ["- D3. A thing."] }));
        expect(named(found)).toEqual(["D3"]);
    });

    it("asks nothing of a decision whose trade-off is none", () => {
        expect(crossRefs(record({ decisions: [{ id: "D1", deliveredBy: "#100", tradeOff: "None." }] }))).toEqual([]);
    });
});

describe("a guarantee or decision with no ID (G12, G14)", () => {
    it("blocks a guarantee with no ID, naming its line, even when it cites a decision", () => {
        const body: string = record({ guarantees: ["- G1. A thing holds. (D1) `[inferred]`", "- Another thing holds. (D1) `[inferred]`"] });
        const found: RazorFinding[] = crossRefs(body);
        expect(found).toHaveLength(1);
        expect(found[0].severity).toBe("blocking");
        expect(found[0].where).toContain(`line ${lineOf(body, "- Another thing holds.")}`);
    });

    it("blocks a guarantee with no ID under Existing behaviour to preserve", () => {
        const body: string = record({ existing: ["- Logins keep working. `[inferred]`"] });
        expect(crossRefs(body).map((f: RazorFinding) => f.where)).toEqual([expect.stringContaining(`line ${lineOf(body, "- Logins keep working.")}`)]);
    });

    it("blocks a decision with no ID, even when it names its story and has no trade-off", () => {
        const body: string = record({ decisions: [{ id: "D1", deliveredBy: "#100" }] }).replace("#### D1 — A choice", "#### A choice");
        const found: RazorFinding[] = crossRefs(body, source(2));
        expect(found).toHaveLength(1);
        expect(found[0].severity).toBe("blocking");
        expect(found[0].where).toContain(`line ${lineOf(body, "#### A choice")}`);
    });

    it("cannot be passed by listing the item in the brief, since it has no ID to list", () => {
        const body: string = record({
            guarantees: ["- A thing holds. `[inferred]`"],
            decisions: [{ id: "D1", tradeOff: "a cost.", deliveredBy: "none" }],
            resolve: ["- A thing holds, with no decision behind it.", "- A choice, delivered by no story.", "  - Trade-off: a cost."],
        }).replace("#### D1 — A choice", "#### A choice");
        expect(crossRefs(body, source(2))).toHaveLength(2);
    });
});

describe("drafts the cross-reference checks do not read", () => {
    it("raises no cross-reference finding on an old-format draft", () => {
        const old: string = [
            "# Decision Record: A Capability",
            "",
            "## Key Decisions",
            "",
            "### A thing",
            "",
            "- **Decision:** a thing.",
            "- **Trade-off:** a cost.",
            '- **Epic commitment affected:** #100. Old: no criterion. Status: pending.',
            "",
            "## Constraints & Invariants",
            "",
            "1. A thing holds. `[inferred]`",
            "",
        ].join("\n");
        expect(checkDraft(old, source(3), { record: true })).toEqual([]);
    });

    it("raises no cross-reference finding on a draft not declared a record", () => {
        const body: string = record({ guarantees: ["- G2. Unsupported. `[inferred]`"], decisions: [{ id: "D1", tradeOff: "a cost." }] });
        expect(checkDraft(body, source(3)).filter((f: RazorFinding) => f.rule === "cross-reference")).toEqual([]);
    });
});

describe("an unlabelled guarantee or risk (G7)", () => {
    it("blocks every guarantee in every group and every risk of a worked example that carries no label", () => {
        const found: RazorFinding[] = checkDraft(RECORD_786, source(3), { record: true }).filter((f: RazorFinding) => f.rule === "provenance-label");
        expect(found.filter((f: RazorFinding) => f.where === "Guarantees")).toHaveLength(16);
        expect(found.filter((f: RazorFinding) => f.where === "Risks and dependencies")).toHaveLength(2);
    });
});

describe("the worked examples, with labels added", () => {
    it("record #786 blocks only on D11, whose addition gives no quoted old wording", () => {
        const body: string = labelled(RECORD_786);
        expect(checkDraft(body, source(3), { record: true }).map((f: RazorFinding) => f.rule)).toEqual(["cross-reference"]);
        expect(named(crossRefs(body, source(3)))).toEqual(["D11"]);
    });

    it("record #786 passes D10, which no story delivers, because the brief lists it under Resolve before approval", () => {
        const body: string = labelled(RECORD_786).replace("- **Delivered by:** no story (see To approve).", "- **Delivered by:** none");
        expect(body).toContain("- **Delivered by:** none");
        expect(named(crossRefs(body, source(3)))).toEqual(["D11"]);
        expect(named(crossRefs(body.replace(/^- D10 has no delivering story\..*$/m, "- A decision has no delivering story."), source(3)))).toEqual(["D10", "D10", "D11"]);
    });

    it("record #245 passes G16 through the brief, and blocks D11, D12 and D13 for wording it does not give", () => {
        const body: string = labelled(RECORD_245);
        expect(named(crossRefs(body, source(1)))).toEqual(["D11", "D12", "D13"]);
    });

    it("record #245 in a multi-story epic also blocks every decision that names no story and is not under Resolve", () => {
        const found: string[] = named(crossRefs(labelled(RECORD_245), source(2)));
        expect(found.filter((id: string, i: number) => found.indexOf(id) === i)).toEqual(["D1", "D2", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12", "D13"]);
    });
});
