/**
 * `nexus review-rank` — the grouping and numbering step of `/nxs.code-review`. The skill rates each
 * finding on four scales and says whether its fix needs a decision or rests on a judgment call;
 * this command applies the fixed group rules and numbering order, with no model judgment, so the
 * same rated findings always get the same groups and the same numbers (record #921: G7, G16, G17).
 */

import * as fs from "node:fs";
import * as path from "node:path";

interface ReviewRankIo {
    cwd: string;
    stdout: (line: string) => void;
    stderr: (line: string) => void;
}

export const REVIEW_RANK_USAGE: string = [
    "  nexus review-rank --ratings <path>",
    "      Group and number the findings /nxs.code-review rated. The file holds { findings: [...] },",
    "      in the order Claude Code's review returned them, each { probability, severity, fixEffort,",
    "      regressionRisk, needsDecision?, judgmentCall? } on the skill's scales. A finding goes into",
    "      the first group it matches: follow-up (needs a decision, high fix effort or high regression",
    "      risk), fix-now (high severity above low probability with fix effort medium or lower and",
    "      regression risk low or lower, or very low fix effort with regression risk very low or",
    "      lower), if-agreed (high or medium severity, or a judgment call), else optional. Numbers run",
    "      from 1 in the order fix-now, if-agreed, optional, follow-up; inside a group by severity,",
    "      then probability, highest first, then fix effort, lowest first; ties keep review order.",
    "      Prints { command, findings: [{ finding, number, group }], groups, recommendedVerdict }:",
    "      request-changes when a fix-now finding has high severity, else comment. Exits 2 without",
    "      --ratings, and 1, printing nothing, when the file is unreadable, empty or off the scales.",
].join("\n");

const SCALES = {
    probability: ["low", "medium", "high", "certain"],
    severity: ["negligible", "low", "medium", "high"],
    fixEffort: ["very low", "low", "medium", "high"],
    regressionRisk: ["none", "very low", "low", "medium", "high"],
} as const;

type Axis = keyof typeof SCALES;
const AXES: readonly Axis[] = ["probability", "severity", "fixEffort", "regressionRisk"];

export type Group = "fix-now" | "if-agreed" | "optional" | "follow-up";
const GROUP_ORDER: readonly Group[] = ["fix-now", "if-agreed", "optional", "follow-up"];

/** A rated finding, each axis held as its position on the scale (0 = lowest). */
interface Rated {
    finding: number;
    probability: number;
    severity: number;
    fixEffort: number;
    regressionRisk: number;
    needsDecision: boolean;
    judgmentCall: boolean;
}

const at = (axis: Axis, value: string): number => (SCALES[axis] as readonly string[]).indexOf(value);

/** The group rules, checked in order; the first that matches wins, so every finding lands in one. */
export function groupOf(f: Rated): Group {
    if (f.needsDecision || f.fixEffort === at("fixEffort", "high") || f.regressionRisk === at("regressionRisk", "high")) {
        return "follow-up";
    }
    const containedHighFix: boolean =
        f.severity === at("severity", "high") &&
        f.probability > at("probability", "low") &&
        f.fixEffort <= at("fixEffort", "medium") &&
        f.regressionRisk <= at("regressionRisk", "low");
    const trivialSafeFix: boolean = f.fixEffort === at("fixEffort", "very low") && f.regressionRisk <= at("regressionRisk", "very low");
    if (containedHighFix || trivialSafeFix) return "fix-now";
    if (f.severity >= at("severity", "medium") || f.judgmentCall) return "if-agreed";
    return "optional";
}

/** Read the rated findings, or say what is wrong with them. */
function readRatings(file: string): Rated[] | string {
    let raw: unknown;
    try {
        raw = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
        return `cannot read ${file} as JSON: ${(e as Error).message}`;
    }
    const list: unknown = (raw as { findings?: unknown } | null)?.findings;
    if (!Array.isArray(list) || list.length === 0) return "findings must be a non-empty list of rated findings";
    const rated: Rated[] = [];
    for (const [i, item] of list.entries()) {
        const x = (item ?? {}) as Record<string, unknown>;
        const r: Rated = {
            finding: i + 1,
            probability: 0,
            severity: 0,
            fixEffort: 0,
            regressionRisk: 0,
            needsDecision: x.needsDecision === true,
            judgmentCall: x.judgmentCall === true,
        };
        for (const axis of AXES) {
            const pos: number = typeof x[axis] === "string" ? at(axis, (x[axis] as string).trim().toLowerCase()) : -1;
            if (pos === -1) {
                return `finding ${i + 1}: ${axis} is ${JSON.stringify(x[axis])}, not one of ${SCALES[axis].join(", ")}`;
            }
            r[axis] = pos;
        }
        rated.push(r);
    }
    return rated;
}

export function runReviewRank(argv: string[], io: ReviewRankIo): number {
    let ratings: string | undefined;
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--ratings") ratings = argv[++i];
        else {
            io.stderr(`review-rank: unknown argument ${argv[i]}`);
            return 2;
        }
    }
    if (ratings === undefined || ratings.trim() === "") {
        io.stderr("review-rank: --ratings <path> is required");
        return 2;
    }
    const rated: Rated[] | string = readRatings(path.resolve(io.cwd, ratings));
    if (typeof rated === "string") {
        io.stderr(`review-rank: ${rated}. Nothing was ranked.`);
        return 1;
    }

    const grouped = rated.map((f) => ({ f, group: groupOf(f) }));
    // Array.prototype.sort is stable, so ties keep the review's order.
    const ordered = [...grouped].sort(
        (a, b) =>
            GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) ||
            b.f.severity - a.f.severity ||
            b.f.probability - a.f.probability ||
            a.f.fixEffort - b.f.fixEffort,
    );
    const numbers = new Map<number, number>(ordered.map((g, i) => [g.f.finding, i + 1]));
    const groups: Record<Group, number> = { "fix-now": 0, "if-agreed": 0, optional: 0, "follow-up": 0 };
    for (const g of grouped) groups[g.group]++;
    const requestChanges: boolean = grouped.some((g) => g.group === "fix-now" && g.f.severity === at("severity", "high"));

    io.stdout(
        JSON.stringify({
            command: "review-rank",
            findings: grouped.map((g) => ({ finding: g.f.finding, number: numbers.get(g.f.finding), group: g.group })),
            groups,
            recommendedVerdict: requestChanges ? "request-changes" : "comment",
        }),
    );
    return 0;
}
