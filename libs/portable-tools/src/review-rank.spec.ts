/**
 * `nexus review-rank` — groups and numbers the findings `/nxs.code-review` rated, by fixed rules, so
 * the same rated findings always get the same groups and the same numbers (record #921: G7, G16,
 * G17). The model rates; the executable groups, numbers and recommends a verdict.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runReviewRank } from "./review-rank.js";

interface Rated {
    probability: string;
    severity: string;
    fixEffort: string;
    regressionRisk: string;
    needsDecision?: boolean;
    judgmentCall?: boolean;
}

interface Ranked {
    command: string;
    findings: Array<{ finding: number; number: number; group: string }>;
    groups: Record<string, number>;
    recommendedVerdict: string;
}

let dir: string;
beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "review-rank-"));
});
afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});

function rank(input: unknown): { code: number; out: string[]; err: string[] } {
    const file: string = path.join(dir, "ratings.json");
    fs.writeFileSync(file, typeof input === "string" ? input : JSON.stringify(input));
    const out: string[] = [];
    const err: string[] = [];
    const code: number = runReviewRank(["--ratings", "ratings.json"], { cwd: dir, stdout: (l) => out.push(l), stderr: (l) => err.push(l) });
    return { code, out, err };
}

function ranked(findings: Rated[]): Ranked {
    const r = rank({ findings });
    expect(r.code, r.err.join("\n")).toBe(0);
    return JSON.parse(r.out.join("\n")) as Ranked;
}

const base: Rated = { probability: "medium", severity: "low", fixEffort: "low", regressionRisk: "low" };

describe("nexus review-rank puts each finding in the first group it matches (G7, G16)", () => {
    it("sends a finding that needs a decision, high effort or high regression risk to follow-up issues", () => {
        const r = ranked([
            { ...base, severity: "high", probability: "certain", needsDecision: true },
            { ...base, fixEffort: "high" },
            { ...base, regressionRisk: "high" },
        ]);
        expect(r.findings.map((f) => f.group)).toEqual(["follow-up", "follow-up", "follow-up"]);
    });

    it("fixes now a likely high-severity finding with a contained fix, or a trivial safe fix", () => {
        const r = ranked([
            { probability: "high", severity: "high", fixEffort: "medium", regressionRisk: "low" },
            { probability: "low", severity: "negligible", fixEffort: "very low", regressionRisk: "very low" },
        ]);
        expect(r.findings.map((f) => f.group)).toEqual(["fix-now", "fix-now"]);
    });

    it("leaves an unlikely high-severity finding, a medium-severity one, or a judgment call to the author", () => {
        const r = ranked([
            { probability: "low", severity: "high", fixEffort: "low", regressionRisk: "low" },
            { ...base, severity: "medium" },
            { ...base, judgmentCall: true },
        ]);
        expect(r.findings.map((f) => f.group)).toEqual(["if-agreed", "if-agreed", "if-agreed"]);
    });

    it("makes every remaining finding optional", () => {
        expect(ranked([base]).findings[0].group).toBe("optional");
    });
});

describe("nexus review-rank numbers findings in priority order (G7, G17)", () => {
    it("lists fix-now, if-agreed, optional, then follow-up, and numbers from 1 down the list", () => {
        const r = ranked([
            { ...base, fixEffort: "high" }, // follow-up
            base, // optional
            { ...base, severity: "medium" }, // if-agreed
            { probability: "high", severity: "high", fixEffort: "low", regressionRisk: "none" }, // fix-now
        ]);
        const byNumber = [...r.findings].sort((a, b) => a.number - b.number);
        expect(byNumber.map((f) => f.finding)).toEqual([4, 3, 2, 1]);
        expect(byNumber.map((f) => f.number)).toEqual([1, 2, 3, 4]);
    });

    it("sorts inside a group by severity, then probability, then lowest fix effort, ties in review order", () => {
        const r = ranked([
            { ...base, severity: "medium", probability: "low", fixEffort: "low" },
            { ...base, severity: "medium", probability: "high", fixEffort: "medium" },
            { ...base, severity: "medium", probability: "high", fixEffort: "low" },
            { ...base, severity: "high", probability: "low", fixEffort: "medium" },
            { ...base, severity: "medium", probability: "low", fixEffort: "low" },
        ]);
        const order = [...r.findings].sort((a, b) => a.number - b.number).map((f) => f.finding);
        expect(order).toEqual([4, 3, 2, 1, 5]);
    });

    it("gives the same rated findings the same numbers on every run", () => {
        const input: Rated[] = [base, { ...base, severity: "medium" }, { ...base, fixEffort: "high" }];
        expect(ranked(input)).toEqual(ranked(input));
    });
});

describe("nexus review-rank counts the groups and recommends a verdict", () => {
    it("recommends request changes when a fix-now finding has high severity", () => {
        const r = ranked([{ probability: "high", severity: "high", fixEffort: "low", regressionRisk: "low" }, base]);
        expect(r.recommendedVerdict).toBe("request-changes");
        expect(r.groups).toEqual({ "fix-now": 1, "if-agreed": 0, optional: 1, "follow-up": 0 });
    });

    it("recommends comment otherwise", () => {
        expect(ranked([{ ...base, fixEffort: "very low", regressionRisk: "none" }]).recommendedVerdict).toBe("comment");
    });
});

describe("nexus review-rank refuses input it cannot rank", () => {
    it("names the finding and the value that is off the scale, and prints nothing", () => {
        const r = rank({ findings: [base, { ...base, severity: "critical" }] });
        expect(r.code).toBe(1);
        expect(r.out).toEqual([]);
        expect(r.err.join("\n")).toMatch(/finding 2.*severity.*critical/);
    });

    it("refuses a needsDecision or judgmentCall that is not true or false, instead of reading it as false", () => {
        for (const flag of ["needsDecision", "judgmentCall"]) {
            const r = rank({ findings: [base, { ...base, [flag]: "true" }] });
            expect(r.code).toBe(1);
            expect(r.out).toEqual([]);
            expect(r.err.join("\n")).toMatch(new RegExp(`finding 2.*${flag}`));
        }
    });

    it("refuses an empty list, a file that is not JSON, and a missing --ratings", () => {
        expect(rank({ findings: [] }).code).toBe(1);
        expect(rank("not json").code).toBe(1);
        const err: string[] = [];
        expect(runReviewRank([], { cwd: dir, stdout: () => undefined, stderr: (l) => err.push(l) })).toBe(2);
        expect(err.join("\n")).toMatch(/--ratings/);
    });
});
