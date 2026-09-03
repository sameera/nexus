/**
 * The check the invoking command runs on the translator's write (stories #417 and #423).
 *
 * One invocation returns one verdict covering both properties. The regions the pipeline parses
 * must be byte-identical, and the items the prose is accountable for must survive. Joining them
 * here is the point: a caller cannot satisfy one property and skip the other, because there is no
 * second entry point to skip.
 *
 * It fails closed in both senses. Anything that differs fails, and a copy it cannot read fails too
 * — an unreadable input is never reported as success, because the whole point of the check is that
 * nothing passes unproven.
 */

import { compareRegions, type RegionProblem } from "./compare.js";
import { comparePreservation, trackedTotal, type PreservationFinding } from "./preserve.js";
import { extractRegions } from "./regions.js";

/** Reads one copy, throwing the way `fs.readFileSync` does when the path is not readable. */
export type ReadCopy = (path: string) => string;

/** The check's verdict: one result, both comparisons. */
export type VerifyResult =
    | { ok: true; regions: number; tracked: number }
    | { ok: false; problem: "changed"; problems: RegionProblem[]; findings: PreservationFinding[] }
    | { ok: false; problem: "unreadable"; message: string };

function read(readCopy: ReadCopy, path: string, role: string): { ok: true; content: string } | { ok: false; message: string } {
    try {
        return { ok: true, content: readCopy(path) };
    } catch (cause: unknown) {
        return { ok: false, message: `cannot read the ${role} copy ${path}: ${(cause as Error).message}` };
    }
}

/**
 * Compare the pre-translation copy at `beforePath` with the post-translation copy at `afterPath`.
 *
 * `sourcePaths` are the grounding sources the run named — the read-only files the translator was
 * allowed to lift a concrete span from. An item the translation introduced is permitted only when
 * one of those sources already carried it. A run that names none permits no introduction at all.
 */
export function verifyTranslation(
    readCopy: ReadCopy,
    beforePath: string,
    afterPath: string,
    sourcePaths: readonly string[] = [],
): VerifyResult {
    const before = read(readCopy, beforePath, "pre-translation");
    if (!before.ok) {
        return { ok: false, problem: "unreadable", message: before.message };
    }
    const after = read(readCopy, afterPath, "post-translation");
    if (!after.ok) {
        return { ok: false, problem: "unreadable", message: after.message };
    }
    const sources: string[] = [];
    for (const sourcePath of sourcePaths) {
        const source = read(readCopy, sourcePath, "grounding source");
        if (!source.ok) {
            return { ok: false, problem: "unreadable", message: source.message };
        }
        sources.push(source.content);
    }

    const problems: RegionProblem[] = compareRegions(before.content, after.content);
    const findings: PreservationFinding[] = comparePreservation(before.content, after.content, sources);
    if (problems.length > 0 || findings.length > 0) {
        return { ok: false, problem: "changed", problems, findings };
    }
    return { ok: true, regions: extractRegions(after.content).length, tracked: trackedTotal(after.content) };
}
