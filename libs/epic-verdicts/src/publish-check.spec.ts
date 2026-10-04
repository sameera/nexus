/**
 * The pre-publish check the conformance gate hands its drafted verdict to (epic #751, story #757,
 * decision record #764, key decision "The repository-identity rule moves out of stage prose and
 * behind a callable pre-publish check").
 *
 * The case that has to fail is the live one: the verdicts on `geo-nexus/giccp#665` stamp the code
 * repository, name no issues repository, and carry bare story numbers that exist in both
 * repositories. The check judges the exact bytes that would have been published.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
    type DeferredScope,
    type Departure,
    type Finding,
    JUDGMENTS_MARKER,
    type KeyDecisions,
    parseJudgmentsBlock,
    renderJudgmentsBlock,
} from "@nexus/pr-acceptance/judgments-block";
import { RECEIPT_MARKER } from "@nexus/pr-acceptance/receipt-blocks";
import { parseReceiptBlock } from "@nexus/pr-acceptance/verify";
import {
    TWO_VERDICT_RECORD_HASH,
    TWO_VERDICT_REPO,
    TWO_VERDICT_STORY,
    type VerdictBodyOptions,
    verdictBody as fixtureBody,
} from "@nexus/pr-acceptance/verdict-fixtures";
import { VERDICT_SIZE_LIMIT, checkVerdictPublish } from "./publish-check.js";
import { type Runner } from "./run.js";

const made: string[] = [];

/** A drafted verdict as analyze now writes it: the verdict block, then a judgments block (epic #829). */
/** The key decisions every verdict now carries, tied to the digest the fixture's verdict block stamps (story #862). */
const KEY: KeyDecisions = { record: { digest: TWO_VERDICT_RECORD_HASH, format: "new", decisions: [{ id: "D1" }] }, stubs: [] };
const NO_DEPARTURES: string = renderJudgmentsBlock({ items: [], keyDecisions: KEY });
const verdictBody = (opts: VerdictBodyOptions): string => fixtureBody({ judgments: NO_DEPARTURES, ...opts });

function checkout(settings?: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "publish-check-"));
    made.push(dir);
    if (settings !== undefined) {
        fs.mkdirSync(path.join(dir, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(path.join(dir, ".nexus", "config", "settings.yml"), settings);
    }
    return dir;
}

function ghRepo(nameWithOwner: string, seen: string[][] = []): Runner {
    return (cmd, args) => {
        seen.push([cmd, ...args]);
        if (cmd === "gh" && args[0] === "repo" && args[1] === "view") {
            return { status: 0, stdout: `${nameWithOwner}\n`, stderr: "" };
        }
        return { status: 1, stdout: "", stderr: `unexpected: ${cmd} ${args.join(" ")}` };
    };
}

/** The live cross-repository checkout: code in giccp, issues in docs. */
const CROSS_REPO_SETTINGS = "github:\n  issues-repo: geo-nexus/docs\n";

afterEach(() => {
    for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("checkVerdictPublish — the drafted verdict names the repository its story numbers resolve against", () => {
    it("refuses the live body, which stamps the code repository and names no issues repository", () => {
        const r = checkVerdictPublish(ghRepo("geo-nexus/giccp"), checkout(CROSS_REPO_SETTINGS), verdictBody({ high: 0 }));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("issues-repo-missing");
    });

    it("names the value the refused block should have carried, so correcting it is mechanical", () => {
        const r = checkVerdictPublish(ghRepo("geo-nexus/giccp"), checkout(CROSS_REPO_SETTINGS), verdictBody({ high: 0 }));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.message).toContain("geo-nexus/docs");
    });

    it("approves a body that names the resolved issues repository", () => {
        const body = verdictBody({ high: 0, issuesRepo: "geo-nexus/docs" });
        const r = checkVerdictPublish(ghRepo("geo-nexus/giccp"), checkout(CROSS_REPO_SETTINGS), body);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.repos).toEqual({ issuesRepo: "geo-nexus/docs", repo: "geo-nexus/giccp" });
    });

    it("still requires the key when the issues and code repositories are the same repository", () => {
        const r = checkVerdictPublish(ghRepo("geo-nexus/giccp"), checkout(), verdictBody({ high: 0 }));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("issues-repo-missing");
        expect(r.error.message).toContain("geo-nexus/giccp");
    });

    it("approves a same-repository body naming that one repository twice", () => {
        const body = verdictBody({ high: 0, issuesRepo: "geo-nexus/giccp" });
        const r = checkVerdictPublish(ghRepo("geo-nexus/giccp"), checkout(), body);
        expect(r.ok).toBe(true);
    });

    it("accepts the host-qualified written form the gate stamps, through the shared comparison rule", () => {
        const body = verdictBody({ high: 0, issuesRepo: TWO_VERDICT_REPO });
        const r = checkVerdictPublish(ghRepo("geo-nexus/giccp"), checkout(), body);
        expect(r.ok).toBe(true);
    });

    it("refuses a body naming some other repository's issues", () => {
        const body = verdictBody({ high: 0, issuesRepo: "someone-else/docs" });
        const r = checkVerdictPublish(ghRepo("geo-nexus/giccp"), checkout(CROSS_REPO_SETTINGS), body);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("issues-repo-mismatch");
        expect(r.error.message).toContain("geo-nexus/docs");
    });

    it("refuses a drafted body carrying no machine block at all", () => {
        const r = checkVerdictPublish(ghRepo("geo-nexus/giccp"), checkout(), "Conformance: clean. No block here.");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("block-missing");
    });
});

describe("checkVerdictPublish — a published receipt records no story text (epic #828, story #857; D12, G38)", () => {
    const draft = (fp?: string) => verdictBody({ high: 0, issuesRepo: "geo-nexus/docs", storyFingerprints: fp });

    it("approves a receipt that records no story text, and never fetches the stories it names", () => {
        const seen: string[][] = [];
        const r = checkVerdictPublish(ghRepo("geo-nexus/giccp", seen), checkout(CROSS_REPO_SETTINGS), draft());
        expect(r.ok).toBe(true);
        expect(seen.some((c) => c.some((a) => a.includes("/issues/")))).toBe(false);
    });

    it("refuses a drafted receipt that still records story text, naming the line to drop", () => {
        const r = checkVerdictPublish(ghRepo("geo-nexus/giccp"), checkout(CROSS_REPO_SETTINGS), draft(`{ ${TWO_VERDICT_STORY}: ${"e".repeat(64)} }`));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("story-text-recorded");
        expect(r.error.message).toContain("story_fingerprints");
    });
});

describe("checkVerdictPublish — a published verdict carries its departures (epic #829, story #858; D2, G7, G14)", () => {
    const departure = (over: Partial<Departure> = {}): Departure => ({
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
    const check = (body: string) => checkVerdictPublish(ghRepo("geo-nexus/giccp"), checkout(), body);
    const draft = (high: number, items: Departure[]) => fixtureBody({ high, issuesRepo: "geo-nexus/giccp", judgments: renderJudgmentsBlock({ items, keyDecisions: KEY }) });

    it("refuses a verdict with no judgments block, which would leave the next run no ID registry", () => {
        const r = check(fixtureBody({ high: 0, issuesRepo: "geo-nexus/giccp" }));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("judgments-missing");
        expect(r.error.message).toContain("nexus verdict-items");
    });

    it("refuses a judgments block that cannot be read, naming why", () => {
        const r = check(fixtureBody({ high: 0, issuesRepo: "geo-nexus/giccp", judgments: `${JUDGMENTS_MARKER}\n\`\`\`json\n{ nope\n\`\`\`` }));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("judgments-malformed");
    });

    it("refuses one ID naming two departures (G7)", () => {
        const r = check(draft(2, [departure(), departure({ departsFrom: "G9" })]).replace('"DV2"', '"DV1"'));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("judgments-malformed");
    });

    it("refuses a judgments block placed before the verdict block", () => {
        const verdict = fixtureBody({ high: 0, issuesRepo: "geo-nexus/giccp" });
        const r = check(`${NO_DEPARTURES}\n${verdict}`);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("judgments-malformed");
    });

    it("refuses severity counts that leave out an unanswered departure, which blocks (G14)", () => {
        const r = check(draft(0, [departure()]));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("counts-not-open");
        expect(r.error.message).toContain("DV1");
    });

    it("refuses counts that still include an accepted departure, since they count only open items (G15)", () => {
        const accepted = { verb: "accepted", author: "lead", link: "https://x/1", reason: "by design" };
        const r = check(draft(1, [departure({ severity: "high", answer: accepted })]));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("counts-not-open");
    });

    it("approves counts of zero once every blocking item is answered (G15, G16)", () => {
        const accepted = { verb: "accepted", author: "lead", link: "https://x/1", reason: "by design" };
        const waived = { verb: "waived", author: "lead", link: "https://x/2", reason: "tracked" };
        const f = { id: "F1", kind: "finding" as const, found: true, severity: "critical" as const, about: "#860 AC1", summary: "x", files: [], answer: waived };
        const body = fixtureBody({ high: 0, issuesRepo: "geo-nexus/giccp", judgments: renderJudgmentsBlock({ items: [departure({ answer: accepted })], findings: [f], keyDecisions: KEY }) });
        expect(check(body).ok).toBe(true);
    });

    it("refuses counts that leave out an unanswered finding", () => {
        const f = { id: "F1", kind: "finding" as const, found: true, severity: "high" as const, about: "#860 AC1", summary: "x", files: [], answer: null };
        const r = check(fixtureBody({ high: 0, issuesRepo: "geo-nexus/giccp", judgments: renderJudgmentsBlock({ items: [], findings: [f], keyDecisions: KEY }) }));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.message).toContain("F1");
    });

    it("approves counts that include every unanswered departure still found", () => {
        expect(check(draft(1, [departure(), departure({ id: "DV2", found: false, departsFrom: "G9" })])).ok).toBe(true);
    });

    it("approves a verdict listing no departure when the code matches the record (G2)", () => {
        expect(check(draft(0, [])).ok).toBe(true);
    });
});

describe("checkVerdictPublish — the verdict carries what close writes into its record (epic #829, story #862)", () => {
    const check = (body: string) => checkVerdictPublish(ghRepo("geo-nexus/giccp"), checkout(), body);
    const body = (judgments: string, high = 0) => fixtureBody({ high, issuesRepo: "geo-nexus/giccp", judgments });
    const finding = (over: Partial<Finding> = {}): Finding => ({
        id: "F1",
        kind: "finding",
        found: true,
        severity: "high",
        about: `#${TWO_VERDICT_STORY} AC4`,
        summary: "no DS IDs yet",
        files: ["libs/a.ts"],
        answer: null,
        ...over,
    });
    const proposal = (over: Partial<DeferredScope> = {}): DeferredScope => ({ id: "DS1", kind: "deferred-scope", found: true, settles: "F1", summary: "the rest of AC4", answer: null, ...over });
    const APPROVED = { verb: "approved", author: "lead", link: "https://x/9", reason: "" };

    it("refuses a judgments block with no key decisions (G25)", () => {
        const r = check(body(renderJudgmentsBlock({ items: [] })));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("key-decisions-missing");
    });

    it("refuses key decisions tied to a record revision other than the one the verdict stamps (D5)", () => {
        const stale: KeyDecisions = { record: { digest: "f".repeat(64), format: "new", decisions: [{ id: "D1" }] }, stubs: [] };
        const r = check(body(renderJudgmentsBlock({ items: [], keyDecisions: stale })));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("key-decisions-stale");
        expect(r.error.message).toContain(TWO_VERDICT_RECORD_HASH);
    });

    it("counts an item whose deferral a trusted person approved as no longer open (G26)", () => {
        const approved = body(renderJudgmentsBlock({ items: [], findings: [finding()], deferred: [proposal({ answer: APPROVED })], keyDecisions: KEY }), 0);
        const unapproved = body(renderJudgmentsBlock({ items: [], findings: [finding()], deferred: [proposal()], keyDecisions: KEY }), 0);
        expect(check(approved).ok).toBe(true);
        const r = check(unapproved);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("counts-not-open");
    });

    it("refuses a proposal settling a criterion of a story this verdict does not cover (G27)", () => {
        const sibling = finding({ about: "#999 AC1" });
        const r = check(body(renderJudgmentsBlock({ items: [], findings: [sibling], deferred: [proposal()], keyDecisions: KEY }), 1));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("deferred-scope-sibling");
        expect(r.error.message).toContain("#999 AC1");
    });

    it("approves a proposal settling a departure: record scope the delivered stories leave out", () => {
        const d: Departure = { id: "DV1", kind: "departure", found: true, severity: "high", departsFrom: "D7", summary: "no story delivers it", files: [], stub: null, supersedes: null, answer: null };
        const r = check(body(renderJudgmentsBlock({ items: [d], deferred: [proposal({ settles: "DV1", answer: APPROVED })], keyDecisions: KEY }), 0));
        expect(r.ok).toBe(true);
    });

    it("refuses a body where text copied into the summary repeats a verdict marker (G28)", () => {
        const hostile = `DV1 accepted by @lead (https://x/1): see ${RECEIPT_MARKER}\n\n`;
        const r = check(`${hostile}${body(NO_DEPARTURES)}`);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("marker-repeated");
    });

    it("approves hostile answer text inside the judgments block, and both blocks parse as without it (G28)", () => {
        const hostile = `\`\`\`\` ${RECEIPT_MARKER} ${JUDGMENTS_MARKER} head: ${"0".repeat(40)}`;
        const answered = finding({ answer: { verb: "waived", author: "lead", link: "https://x/2", reason: hostile } });
        const published = body(renderJudgmentsBlock({ items: [], findings: [answered], keyDecisions: KEY }), 0);
        const r = check(published);
        expect(r.ok).toBe(true);
        expect(parseReceiptBlock(published)).toEqual(parseReceiptBlock(fixtureBody({ high: 0, issuesRepo: "geo-nexus/giccp" })));
        const j = parseJudgmentsBlock(published);
        expect(j.ok && j.judgments?.findings[0]?.answer?.reason).toBe(hostile);
    });
});

describe("checkVerdictPublish — the size budget (epic #829, story #862, D5; G29)", () => {
    const check = (body: string) => checkVerdictPublish(ghRepo("geo-nexus/giccp"), checkout(), body);
    const manyFiles = Array.from({ length: 3000 }, (_, i) => `libs/some/rather/long/path/to/module-${i}.ts`);
    const d = (files: string[]): Departure => ({ id: "DV1", kind: "departure", found: true, severity: "high", departsFrom: "D1", summary: "s", files, stub: null, supersedes: null, answer: null });

    it("approves a body within the limit exactly as drafted", () => {
        const drafted = fixtureBody({ high: 1, issuesRepo: "geo-nexus/giccp", judgments: renderJudgmentsBlock({ items: [d(["a.ts"])], keyDecisions: KEY }) });
        const r = check(drafted);
        expect(r.ok && r.body).toBe(drafted);
        expect(r.ok && r.filesDropped).toBe(false);
    });

    it("drops the file lists first, says so above the verdict block, and keeps every item and the verdict block", () => {
        const drafted = fixtureBody({ high: 1, issuesRepo: "geo-nexus/giccp", judgments: renderJudgmentsBlock({ items: [d(manyFiles)], keyDecisions: KEY }) });
        expect(drafted.length).toBeGreaterThan(VERDICT_SIZE_LIMIT);
        const r = check(drafted);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.filesDropped).toBe(true);
        expect(r.size).toBeLessThanOrEqual(VERDICT_SIZE_LIMIT);
        expect(r.body.slice(0, r.body.indexOf(RECEIPT_MARKER))).toMatch(/File lists: dropped/);
        expect(parseReceiptBlock(r.body)).toEqual(parseReceiptBlock(drafted));
        const j = parseJudgmentsBlock(r.body);
        expect(j.ok && j.judgments?.filesDropped).toBe(true);
        expect(j.ok && j.judgments?.items.map((x) => [x.id, x.files])).toEqual([["DV1", []]]);
    });

    it("publishes nothing when the body is still too large without its file lists, and names the size", () => {
        const huge: KeyDecisions = { record: { digest: TWO_VERDICT_RECORD_HASH, format: "neither", decisions: [], text: "x".repeat(VERDICT_SIZE_LIMIT) }, stubs: [] };
        const r = check(fixtureBody({ high: 0, issuesRepo: "geo-nexus/giccp", judgments: renderJudgmentsBlock({ items: [], keyDecisions: huge }) }));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("verdict-too-large");
        expect(r.error.message).toMatch(/\d+ characters/);
        expect(r.error.message).toContain(String(VERDICT_SIZE_LIMIT));
    });
});
