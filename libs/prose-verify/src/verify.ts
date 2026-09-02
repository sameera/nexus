/**
 * The check the invoking command runs on the translator's write (story #417).
 *
 * It fails closed in both senses. A region that differs fails, and a copy it cannot read fails too
 * — an unreadable input is never reported as success, because the whole point of the check is that
 * nothing passes unproven.
 */

import { compareRegions, type RegionProblem } from "./compare.js";
import { extractRegions } from "./regions.js";

/** Reads one copy, throwing the way `fs.readFileSync` does when the path is not readable. */
export type ReadCopy = (path: string) => string;

/** The check's verdict. */
export type VerifyResult =
    | { ok: true; regions: number }
    | { ok: false; problem: "region-changed"; problems: RegionProblem[] }
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
 * A pass means every machine-read region is byte-identical. It means nothing about the prose.
 */
export function verifyTranslation(readCopy: ReadCopy, beforePath: string, afterPath: string): VerifyResult {
    const before = read(readCopy, beforePath, "pre-translation");
    if (!before.ok) {
        return { ok: false, problem: "unreadable", message: before.message };
    }
    const after = read(readCopy, afterPath, "post-translation");
    if (!after.ok) {
        return { ok: false, problem: "unreadable", message: after.message };
    }
    const problems: RegionProblem[] = compareRegions(before.content, after.content);
    if (problems.length > 0) {
        return { ok: false, problem: "region-changed", problems };
    }
    return { ok: true, regions: extractRegions(after.content).length };
}
