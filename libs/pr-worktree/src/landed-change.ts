/**
 * Did a merged pull request land each file as it was reviewed? (epic #828, story #846, decision
 * record #849, D4 and D3's not-landed half.)
 *
 * The reviewed change is what the analyzed head changed in each file against the point where it
 * left trunk: `git diff <base>...<analyzedHead>`, where `base` is the merge-anchored range's base,
 * so the three-dot form resolves to the fork point. The landed change is what the pull request's
 * own range changed: `git diff <base> <head>`. Queue and discovery paths are left out of both, as
 * range derivation leaves them out.
 *
 * The two are compared as changes, never as file contents. Contents at the merge include every
 * sibling pull request merged in between, and no re-analysis can make them equal. Each file's patch
 * is taken with no context lines, and the hunk positions, the function-context text and the blob
 * index are dropped. What is left is the lines removed and added, in order, plus the file-level
 * headers. So a sibling that moved the lines, or edited a line nearby, changes nothing, while a
 * rename, a deletion or a mode change shows up in the headers and counts as changed. Rename
 * detection is off, so a rename reads as the old path deleted and the new path added.
 *
 * A deletion is compared as a deletion alone: the lines it removed are whatever the file held at
 * the base, which a sibling may have edited first. A binary file is compared by the blob it
 * leaves behind, the one thing its patch states.
 *
 * Every file either change touches is reported. A file the range landed that analysis never
 * reviewed differs from a reviewed change of nothing, and is changed.
 *
 * Read-only: nothing here fetches, checks out or writes.
 */

import { canonicalTrunkRef } from "@nexus/workspace/canonical-remote";
import { type PrWorktreeDiagnostic } from "./diagnostic.js";
import { type Runner, git } from "./run.js";

export interface LandedFile {
    path: string;
    status: "unchanged" | "changed";
}

export type LandedChangeResult = { ok: true; files: LandedFile[] } | { ok: false; error: PrWorktreeDiagnostic };

export interface LandedChangeInput {
    /** The commit analysis reviewed. */
    analyzedHead: string;
    /** The pull request's merge-anchored range. */
    base: string;
    head: string;
}

const PIPELINE_EXCLUDES = [".", ":(exclude).nexus/queue", ":(exclude).nexus/discovery"];
const DIFF_FLAGS = ["--no-ext-diff", "--no-textconv", "--no-color", "--no-renames", "--src-prefix=a/", "--dst-prefix=b/"];

function fail(message: string): LandedChangeResult {
    return { ok: false, error: { problem: "git-failed", message } };
}

/** Changed paths for a diff spec, pipeline stores excluded; null on git error. */
function changedPaths(run: Runner, cwd: string, spec: string[], excludes: readonly string[]): string[] | null {
    const r = run("git", ["diff", ...DIFF_FLAGS, "--name-only", "-z", ...spec, "--", ...excludes], { cwd });
    if (r.status !== 0) return null;
    return r.stdout.split("\0").filter((p) => p.length > 0);
}

/** One file's patch with positions, context and blob identities removed; null on git error. */
function normalizedPatch(run: Runner, cwd: string, spec: string[], file: string): string | null {
    const r = run("git", ["--literal-pathspecs", "diff", ...DIFF_FLAGS, "-U0", ...spec, "--", file], { cwd });
    if (r.status !== 0) return null;
    const lines = r.stdout.split("\n");
    const deleted = lines.find((l) => l.startsWith("deleted file mode "));
    if (deleted !== undefined) return deleted;
    const binary = lines.some((l) => l.startsWith("Binary files "));
    const out: string[] = [];
    for (const line of lines) {
        if (line.startsWith("diff --git ")) continue;
        if (line.startsWith("index ")) {
            // A binary patch states nothing but the blobs: keep the one it leaves behind.
            if (binary) out.push(`blob ${line.slice("index ".length).split(" ")[0].split("..")[1] ?? ""}`);
            continue;
        }
        if (line.startsWith("@@")) {
            out.push("@@");
            continue;
        }
        out.push(line);
    }
    return out.join("\n");
}

export function compareLandedChange(run: Runner, cwd: string, input: LandedChangeInput): LandedChangeResult {
    for (const sha of [input.analyzedHead, input.base, input.head]) {
        if (git(run, cwd, "rev-parse", "--verify", "--quiet", `${sha}^{commit}`) === null) {
            return fail(`commit ${sha} is not in ${cwd}, so the landed check cannot compare against it.`);
        }
    }
    return compareChanges(run, cwd, [`${input.base}...${input.analyzedHead}`], [input.base, input.head], {
        list: `the reviewed change ${input.base}...${input.analyzedHead} or the landed change ${input.base}..${input.head}`,
        between: "the reviewed and the landed change",
    });
}

/** Compare two changes file by file, as normalized patches; every file either touches is reported. */
function compareChanges(
    run: Runner,
    cwd: string,
    firstSpec: string[],
    secondSpec: string[],
    names: { list: string; between: string },
    excludes: readonly string[] = PIPELINE_EXCLUDES,
): LandedChangeResult {
    const first = changedPaths(run, cwd, firstSpec, excludes);
    const second = changedPaths(run, cwd, secondSpec, excludes);
    if (first === null || second === null) return fail(`could not list ${names.list} in ${cwd}.`);

    const files: LandedFile[] = [];
    for (const file of [...new Set([...first, ...second])].sort()) {
        const a = first.includes(file) ? normalizedPatch(run, cwd, firstSpec, file) : "";
        const b = second.includes(file) ? normalizedPatch(run, cwd, secondSpec, file) : "";
        if (a === null || b === null) return fail(`could not compare ${file} between ${names.between} in ${cwd}.`);
        files.push({ path: file, status: a === b ? "unchanged" : "changed" });
    }
    return { ok: true, files };
}

export interface OwnChangeInput {
    /** The tip of the branch the pull request targets: the point each head's own change is measured from. */
    base: string;
    /** The head an earlier verdict analyzed. */
    earlierHead: string;
    /** The pull request's head now. */
    head: string;
    /**
     * Pathspecs the comparison leaves out. Defaults to the queue and discovery stores, as range
     * derivation leaves them out; a caller that knows the whole pipeline-store set passes it.
     */
    excludes?: readonly string[];
}

/**
 * Which files the pull request's own change touches differently at `head` than at `earlierHead`
 * (epic #829, story #861, decision record #871, D8, G20). Each head's own change is what it changed
 * against the point where it left trunk, `git diff <base>...<head>` — #849 D4's comparison, the one
 * the landed check above makes. Merging trunk into the branch moves that point forward and adds
 * nothing to the own change, and a rebase replays the same change onto a later point, so neither
 * marks a file changed by itself. The patches are compared with positions and context dropped, as
 * above, so trunk shifting the lines around a change does not count either.
 *
 * A head the checkout does not hold — the earlier head of a force-pushed branch, most often — is a
 * failure, never "nothing changed".
 */
export function compareOwnChange(run: Runner, cwd: string, input: OwnChangeInput): LandedChangeResult {
    for (const sha of [input.base, input.earlierHead, input.head]) {
        if (git(run, cwd, "rev-parse", "--verify", "--quiet", `${sha}^{commit}`) === null) {
            return fail(`commit ${sha} is not in ${cwd}, so the own change at it cannot be read.`);
        }
    }
    return compareChanges(
        run,
        cwd,
        [`${input.base}...${input.earlierHead}`],
        [`${input.base}...${input.head}`],
        {
            list: `the own change ${input.base}...${input.earlierHead} or ${input.base}...${input.head}`,
            between: `the own change at ${input.earlierHead} and at ${input.head}`,
        },
        input.excludes === undefined ? PIPELINE_EXCLUDES : [".", ...input.excludes],
    );
}

export type LandedOnTrunkResult = { ok: true; onTrunk: boolean; trunkRef: string } | { ok: false; error: PrWorktreeDiagnostic };

/**
 * Whether `commit`, which the checkout holds, is reachable from trunk: the canonical remote's
 * `main`, else the local `main`, the same trunk close cuts its worktree from. Nothing is fetched,
 * so a caller that has not first confirmed the checkout holds the commit must not read "no" as
 * "not landed" — a missing commit is a checkout that is behind.
 */
export function landedOnTrunk(run: Runner, cwd: string, commit: string): LandedOnTrunkResult {
    const remoteRef = canonicalTrunkRef(run, cwd);
    const trunkRef = git(run, cwd, "rev-parse", "--verify", "--quiet", `${remoteRef}^{commit}`) !== null ? remoteRef : "main";
    if (git(run, cwd, "rev-parse", "--verify", "--quiet", `${trunkRef}^{commit}`) === null) {
        return { ok: false, error: { problem: "git-failed", message: `neither ${remoteRef} nor main resolves in ${cwd}, so whether a merge reached trunk cannot be read.` } };
    }
    const anc = run("git", ["merge-base", "--is-ancestor", commit, trunkRef], { cwd });
    if (anc.status !== 0 && anc.status !== 1) {
        return { ok: false, error: { problem: "git-failed", message: `git merge-base --is-ancestor ${commit} ${trunkRef} failed in ${cwd}: ${anc.stderr.trim()}` } };
    }
    return { ok: true, onTrunk: anc.status === 0, trunkRef };
}
