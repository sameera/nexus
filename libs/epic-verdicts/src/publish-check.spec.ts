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
import { type Departure, JUDGMENTS_MARKER, renderJudgmentsBlock } from "@nexus/pr-acceptance/judgments-block";
import { TWO_VERDICT_REPO, TWO_VERDICT_STORY, type VerdictBodyOptions, verdictBody as fixtureBody } from "@nexus/pr-acceptance/verdict-fixtures";
import { checkVerdictPublish } from "./publish-check.js";
import { type Runner } from "./run.js";

const made: string[] = [];

/** A drafted verdict as analyze now writes it: the verdict block, then a judgments block (epic #829). */
const NO_DEPARTURES: string = renderJudgmentsBlock({ items: [] });
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
    const draft = (high: number, items: Departure[]) => fixtureBody({ high, issuesRepo: "geo-nexus/giccp", judgments: renderJudgmentsBlock({ items }) });

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
        expect(r.error.problem).toBe("departures-uncounted");
        expect(r.error.message).toContain("DV1");
    });

    it("approves counts that include every unanswered departure still found", () => {
        expect(check(draft(1, [departure(), departure({ id: "DV2", found: false, departsFrom: "G9" })])).ok).toBe(true);
    });

    it("approves a verdict listing no departure when the code matches the record (G2)", () => {
        expect(check(draft(0, [])).ok).toBe(true);
    });
});
