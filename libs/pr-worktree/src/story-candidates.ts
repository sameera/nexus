/**
 * The validated candidate ladder that resolves a pull request to the story issue(s) it
 * implements (decision record #495).
 *
 * GitHub's closing-keyword linkage is same-repository only, so a member's PR whose story lives in
 * the hub can produce no closing-issue link at all — the walk `/nxs.analyze` used before this epic
 * (PR → closing issue → parent epic) is the one thing that does not survive the repository
 * boundary. Every rung here is therefore only a candidate, never trusted on its own: a candidate
 * survives only by being a real story sub-issue of some epic (its GraphQL parent resolves, and
 * that parent's own sub-issue list names it back), and every surviving candidate must share one
 * parent epic. Two or more survivors is not an error — the run covers all of them.
 */

import { fetchParentNumber, fetchSubIssueNumbers, type RepoSlug } from "@nexus/epic-resolve/gh";
import { type PrWorktreeDiagnostic } from "./diagnostic.js";
import { type Runner } from "./run.js";

export type CandidateSource = "explicit" | "closing-issue" | "branch-name" | "pr-body";

export interface CandidateSources {
    /** An explicit story reference given in the invocation, e.g. `--story 493`. */
    explicitStory?: number;
    /** The PR's linked/closing issue numbers (same-repository only; empty when none). */
    closingIssues: number[];
    /** The current branch name, scanned for an embedded issue number. */
    branchName?: string;
    /** The PR body, scanned for repo-qualified issue references (`#N` or `owner/repo#N`). */
    prBody?: string;
}

interface Candidate {
    number: number;
    source: CandidateSource;
}

const BRANCH_NUMBER_RE = /(?:^|[/-])(\d+)(?:[/-]|$)/;
/** A repository-qualified issue reference, e.g. `acme/widget#493` — never a bare `#N`. */
const BODY_REF_RE = /[\w.-]+\/[\w.-]+#(\d+)\b/g;

function gather(sources: CandidateSources): Candidate[] {
    const out: Candidate[] = [];
    const seen = new Set<number>();
    const push = (n: number, source: CandidateSource): void => {
        if (!Number.isInteger(n) || n <= 0 || seen.has(n)) return;
        seen.add(n);
        out.push({ number: n, source });
    };

    if (sources.explicitStory !== undefined) push(sources.explicitStory, "explicit");
    for (const n of sources.closingIssues) push(n, "closing-issue");
    if (sources.branchName) {
        const m = BRANCH_NUMBER_RE.exec(sources.branchName);
        if (m) push(Number(m[1]), "branch-name");
    }
    if (sources.prBody) {
        for (const m of sources.prBody.matchAll(BODY_REF_RE)) push(Number(m[1]), "pr-body");
    }
    return out;
}

export type ResolveStoriesResult =
    | { ok: true; epic: number; stories: number[] }
    | { ok: false; error: PrWorktreeDiagnostic };

/**
 * Resolve the story (or stories) a pull request implements, from the candidate sources in
 * `sources`, validated against the live issue graph in `slug`.
 */
export function resolveStories(run: Runner, cwd: string, slug: RepoSlug, sources: CandidateSources): ResolveStoriesResult {
    const candidates = gather(sources);
    const parentByStory = new Map<number, number>();

    for (const c of candidates) {
        const parent = fetchParentNumber(run, cwd, slug, c.number);
        if (!parent.ok) {
            return { ok: false, error: { problem: parent.error.problem, message: parent.error.message } };
        }
        if (parent.parent !== null) {
            parentByStory.set(c.number, parent.parent);
        }
    }

    const tried = (): string => candidates.map((c) => `#${c.number} (${c.source})`).join(", ") || "(none)";

    if (parentByStory.size === 0) {
        return {
            ok: false,
            error: {
                problem: "no-story-candidates",
                message: `no candidate resolved to a story sub-issue of any epic; considered: ${tried()}.`,
            },
        };
    }

    const epics = new Set(parentByStory.values());
    if (epics.size > 1) {
        const detail = [...parentByStory.entries()].map(([s, e]) => `#${s} → epic #${e}`).join(", ");
        return {
            ok: false,
            error: {
                problem: "story-candidates-multiple-epics",
                message: `surviving candidates resolve to more than one epic: ${detail}.`,
            },
        };
    }
    const epic = [...epics][0];

    // Defensive cross-check: the epic must name the candidate back among its own sub-issues, not
    // just report it as a parent — a stale or incorrect parent link can otherwise slip through.
    const subIssues = fetchSubIssueNumbers(run, cwd, slug, epic);
    if (!subIssues.ok) {
        return { ok: false, error: { problem: subIssues.error.problem, message: subIssues.error.message } };
    }
    const declared = new Set(subIssues.numbers);
    const stories = [...parentByStory.keys()].filter((n) => declared.has(n)).sort((a, b) => a - b);

    if (stories.length === 0) {
        return {
            ok: false,
            error: {
                problem: "no-story-candidates",
                message: `no candidate resolved to a story sub-issue of any epic; considered: ${tried()}.`,
            },
        };
    }

    return { ok: true, epic, stories };
}
