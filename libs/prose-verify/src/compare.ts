/**
 * The comparison itself (story #417): the machine-read regions of the pre-translation copy against
 * those of the post-translation copy.
 *
 * Regions are paired by their position within their own kind, so a body's second fenced block is
 * compared with the other copy's second fenced block. A surplus region on either side is reported
 * as added or removed rather than shifting every later pair, which would turn one edit into a run
 * of findings that name the wrong lines.
 */

import { extractRegions, type Region, type RegionKind } from "./regions.js";

/** What went wrong with one region. */
export type ProblemKind = "changed" | "added" | "removed";

/** One difference, named well enough to act on without re-running a search. */
export interface RegionProblem {
    kind: ProblemKind;
    region: RegionKind;
    /** The line the difference sits on: in the post-translation copy, except for a removal. */
    line: number;
    /** The offending line as written, or the region's opening line for an added or removed region. */
    detail: string;
}

const KINDS: readonly RegionKind[] = ["frontmatter", "fenced-block", "html-comment", "criteria-line"];

function ofKind(regions: readonly Region[], kind: RegionKind): Region[] {
    return regions.filter((region: Region) => region.kind === kind);
}

/** The first line at which two regions differ, as a problem, or undefined when they are identical. */
function difference(before: Region, after: Region): RegionProblem | undefined {
    const length: number = Math.max(before.lines.length, after.lines.length);
    for (let offset = 0; offset < length; offset++) {
        if (before.lines[offset] !== after.lines[offset]) {
            return {
                kind: "changed",
                region: after.kind,
                line: after.line + offset,
                detail: after.lines[offset] ?? "(the line is gone)",
            };
        }
    }
    return undefined;
}

/**
 * Every difference between the two copies' machine-read regions, in region-kind order. An empty
 * result is the only thing a caller may read as "nothing machine-read changed".
 */
export function compareRegions(before: string, after: string): RegionProblem[] {
    const beforeRegions: Region[] = extractRegions(before);
    const afterRegions: Region[] = extractRegions(after);
    const problems: RegionProblem[] = [];

    for (const kind of KINDS) {
        const mine: Region[] = ofKind(beforeRegions, kind);
        const theirs: Region[] = ofKind(afterRegions, kind);
        const paired: number = Math.min(mine.length, theirs.length);
        for (let index = 0; index < paired; index++) {
            const problem: RegionProblem | undefined = difference(mine[index], theirs[index]);
            if (problem !== undefined) {
                problems.push(problem);
            }
        }
        for (let index = paired; index < theirs.length; index++) {
            problems.push({ kind: "added", region: kind, line: theirs[index].line, detail: theirs[index].lines[0] });
        }
        for (let index = paired; index < mine.length; index++) {
            problems.push({ kind: "removed", region: kind, line: mine[index].line, detail: mine[index].lines[0] });
        }
    }

    return problems;
}
