/**
 * The ordinary distillation drain's loaded size, and where each exceptional rule lives
 * (epic #714, story #731).
 *
 * Two checks, because one cannot do both jobs. The **size check** holds the ordinary run's loaded
 * size under a recorded ceiling and names both numbers when it fails. The **residency check**
 * asserts, per named exceptional rule, that the rule is stated in its contract and not in the base
 * stage, so a rule moved back is named rather than showing up as a few hundred anonymous bytes.
 *
 * The measurement is authored source bytes: the base command document, plus the authored bodies of
 * the contracts an ordinary run selects (none), plus every contract's description line, which the
 * harness preloads whatever the run does. Authored bytes are the only anchor that is the same
 * number on both harnesses — one installs the source byte for byte, the other adds a runtime
 * preamble and rewrites command tokens.
 *
 * Node builtins only; bundled into the `nexus` entrypoint.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/** The base stage this epic re-partitioned. */
export const BASE_STAGE_FILE = "commands/nxs.distill.md";

/** Every contract the base stage can select, whatever the run's shape. */
export const CONTRACTS: readonly string[] = [
    "nxs-distill-recovery",
    "nxs-distill-continuation",
    "nxs-distill-hub",
    "nxs-distill-nonepic-entries",
    "nxs-distill-taxonomy",
];

/** The committed ceiling record, beside this source. */
export const CEILING_FILE = "distill-load-ceiling.json";

export interface CeilingRecord {
    /** Authored bytes the ordinary drain may load. */
    readonly bytes: number;
    /** The day the ceiling was measured. */
    readonly recorded: string;
    /** The value this ceiling replaced, or null for the first recording. */
    readonly replaces: number | null;
}

/** One exceptional rule: where it must be stated, and where it must not reappear. */
export interface ResidencyRule {
    /** What the rule is, in the words a failure should use. */
    readonly rule: string;
    /** The contract that owns it. */
    readonly contract: string;
    /** A phrase the owning contract states and the base stage must not. */
    readonly probe: string;
}

export const RESIDENCY: readonly ResidencyRule[] = [
    { rule: "the GitHub recovery procedure", contract: "nxs-distill-recovery", probe: "no-close-comment" },
    { rule: "the recovered close comment's trust rule", contract: "nxs-distill-recovery", probe: "nexus:close-record" },
    { rule: "the continuation branch and push rules", contract: "nxs-distill-continuation", probe: "Do not run `git checkout -`" },
    { rule: "the continuation merge precondition", contract: "nxs-distill-continuation", probe: "range-head-reachability" },
    { rule: "the continuation worktree cleanup", contract: "nxs-distill-continuation", probe: "git worktree remove --force <wtPath>" },
    { rule: "the hub drain-SLO attribution", contract: "nxs-distill-hub", probe: "attributed to every distinct repo its `range:` list names" },
    { rule: "the hub provenance form", contract: "nxs-distill-hub", probe: "form is **never emitted** here" },
    { rule: "the hub anchor mapping", contract: "nxs-distill-hub", probe: "per-repo mapping" },
    { rule: "the intake pull-request digest check", contract: "nxs-distill-nonepic-entries", probe: "pr_digest" },
    { rule: "the fix entry's append-only validation mode", contract: "nxs-distill-nonepic-entries", probe: "--append-only-log" },
    { rule: "the bounded vocabulary's missing-page block", contract: "nxs-distill-nonepic-entries", probe: "no-existing-page" },
    { rule: "domain filing against the registry's rubrics", contract: "nxs-distill-taxonomy", probe: "domain_fit" },
    { rule: "the taxonomy gate", contract: "nxs-distill-taxonomy", probe: "forced fit(s) resolved" },
    { rule: "the drift advisory", contract: "nxs-distill-taxonomy", probe: "nexus drift-advisory" },
];

function read(componentRoot: string, rel: string): string {
    return fs.readFileSync(path.join(componentRoot, rel), "utf8");
}

/** A skill's `description:` frontmatter line, including its newline — what every session preloads. */
export function descriptionLine(body: string): string {
    const line: string | undefined = body.split("\n").find((l) => l.startsWith("description: "));
    if (line === undefined) throw new Error("contract has no description line");
    return `${line}\n`;
}

/**
 * Authored bytes an ordinary single-repo epic drain loads: the base stage, no contract body, and
 * every contract's preloaded description line.
 */
export function ordinaryLoadedBytes(componentRoot: string): number {
    let bytes: number = Buffer.byteLength(read(componentRoot, BASE_STAGE_FILE), "utf8");
    for (const name of CONTRACTS) {
        bytes += Buffer.byteLength(descriptionLine(read(componentRoot, `skills/${name}/SKILL.md`)), "utf8");
    }
    return bytes;
}

/** The size check. Returns null when the measurement is at or under the ceiling. */
export function checkCeiling(measured: number, ceiling: CeilingRecord): string | null {
    if (measured <= ceiling.bytes) return null;
    return (
        `the ordinary drain now loads ${measured} authored bytes, over the ceiling of ${ceiling.bytes} ` +
        `recorded ${ceiling.recorded}. Move the added rule into the contract that owns its path, or ` +
        `re-record the ceiling with what it replaces.`
    );
}

/** The residency check. Returns one problem line per rule that is not where it belongs. */
export function checkResidency(componentRoot: string, rules: readonly ResidencyRule[] = RESIDENCY): string[] {
    const base: string = read(componentRoot, BASE_STAGE_FILE);
    const problems: string[] = [];
    for (const { rule, contract, probe } of rules) {
        const body: string = read(componentRoot, `skills/${contract}/SKILL.md`);
        if (!body.includes(probe)) problems.push(`${rule} is no longer stated in ${contract}`);
        if (base.includes(probe)) problems.push(`${rule} moved back into the base stage; it belongs in ${contract} alone`);
    }
    return problems;
}
