/**
 * The validated candidate ladder that resolves a pull request to the epic and the story issue(s)
 * it implements (decision record #495).
 *
 * GitHub's closing-keyword linkage is same-repository only, and it reads the pull request *body*
 * alone — so a member's PR whose story lives in the hub, and a PR that carries its `Closes #<n>`
 * lines one per commit, both produce no closing-issue link at all. The walk `/nxs.analyze` used
 * before this epic (PR → closing issue → parent epic) is the one thing that does not survive
 * either shape. Every rung here is therefore only a candidate, never trusted on its own.
 *
 * A candidate survives by being an issue this repository *files as* a story or an epic — read
 * from the declared classification, never inferred from the issue graph's shape. Shape alone is
 * what the predecessor checked ("has a parent, and that parent lists it back"), and shape alone
 * cannot tell a story of an epic from an epic of an initiative: in a repository that files epics
 * under initiatives, the epic's own number passes the story check one level too high, and the run
 * then checks the wrong acceptance criteria against the wrong decision record.
 *
 * Both pull-request shapes resolve:
 *   - **story-level** — the PR names one or more stories; the epic is their common parent.
 *   - **epic-level** — the PR names only the epic (a branch named for it, all of its stories on
 *     one branch); the story set is that epic's own stories. Supported before the ladder existed
 *     and still supported, because nothing about a PR that ships a whole epic is malformed.
 * When both are signalled, the stories the PR names win: the PR is stating its own scope.
 */

import {
    classifyIssueKind,
    isWithdrawnStory,
    type IssueKind,
    type KindClassification,
} from "@nexus/epic-resolve/classify";
import { fetchIssueFacts, fetchSubIssueFacts, type IssueFacts, type RepoSlug } from "@nexus/epic-resolve/gh";
import { type PrWorktreeDiagnostic } from "./diagnostic.js";
import { type Runner } from "./run.js";

export type CandidateSource = "explicit" | "closing-issue" | "commit-trailer" | "branch-name" | "pr-body";

export interface CandidateSources {
    /** An explicit story reference given in the invocation, e.g. `--story 493`. */
    explicitStory?: number;
    /** The PR's linked/closing issue numbers (same-repository, PR body only; empty when none). */
    closingIssues: number[];
    /**
     * The repository the pull request itself lives in, as `owner/repo`. The platform's closing
     * links are same-repository by construction, so for a member PR they are that member's issue
     * numbers and mean nothing here; the rung contributes nothing unless this is the issues repo.
     * Omitted means "not established" and leaves the rung alone.
     */
    prRepo?: string;
    /** Every commit message on the PR, scanned for closing trailers the PR body never carries. */
    commitMessages?: string[];
    /** The current branch name, scanned for an embedded issue number. */
    branchName?: string;
    /** The PR body, scanned for repo-qualified issue references (`owner/repo#N`). */
    prBody?: string;
}

interface Candidate {
    number: number;
    source: CandidateSource;
}

const BRANCH_NUMBER_RE = /(?:^|[/-])(\d+)(?:[/-]|$)/;
/**
 * A repository-qualified issue reference, e.g. `acme/widget#493` — never a bare `#N`, which in a
 * member pull request names that member's own issue. Used to find the near misses a refusal
 * prints; on its own it says nothing about what the pull request implements.
 */
const BODY_REF_RE = /([\w.-]+\/[\w.-]+)#(\d+)\b/g;
/**
 * A reference that *states scope* — the one grammar both rungs that read human-written text use,
 * so the body and the commit trailers cannot drift apart again.
 *
 * The vocabulary is GitHub's own closing keywords plus a project-recognised set. Nexus does not
 * author the bodies of member pull requests, and this project's own worked example introduces a
 * reference with "Implements", which is not a closing keyword: a rung accepting the platform set
 * alone would reject the form engineers already write. The repository qualifier is optional here
 * — each rung decides for itself whether one is required.
 */
const SCOPE_REF_RE = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|implement(?:s|ed)?|part of)\s+([\w.-]+\/[\w.-]+)?#(\d+)\b/gi;

/**
 * Does a repository qualifier name the issues repository? The one implementation of that rule,
 * shared by both rungs that read text a human wrote. A qualifier is only ever *compared* against
 * the configured issues repository — never used as the target of a lookup — so text an external
 * author controls cannot direct a query at a repository the workspace did not declare.
 */
function namesIssuesRepo(qualifier: string, slug: RepoSlug): boolean {
    return qualifier.toLowerCase() === `${slug.owner}/${slug.repo}`.toLowerCase();
}

/** A same-repository body reference that claimed nothing — a near miss worth printing. */
interface NearMiss {
    number: number;
}

function gather(sources: CandidateSources, slug: RepoSlug): { candidates: Candidate[]; nearMisses: NearMiss[] } {
    const out: Candidate[] = [];
    const seen = new Set<number>();
    const push = (n: number, source: CandidateSource): void => {
        if (!Number.isInteger(n) || n <= 0 || seen.has(n)) return;
        seen.add(n);
        out.push({ number: n, source });
    };

    // A reference the lead supplies at invocation *replaces* the collection. It exists so a lead
    // has a way through a pull request whose body no rule reads correctly, and priority ordering
    // cannot deliver that: every other reference would still be looked up, and any one of them
    // could still stop the run. It is still validated against the live issue graph below.
    if (sources.explicitStory !== undefined) {
        push(sources.explicitStory, "explicit");
        return { candidates: out, nearMisses: [] };
    }
    if (sources.prRepo === undefined || namesIssuesRepo(sources.prRepo, slug)) {
        for (const n of sources.closingIssues) push(n, "closing-issue");
    }
    for (const message of sources.commitMessages ?? []) {
        for (const m of message.matchAll(SCOPE_REF_RE)) {
            const qualifier: string | undefined = m[1];
            // A qualified trailer naming a different repository is a reference to that repo's
            // issue, not to a story of this epic — the one case we can rule out without asking.
            if (qualifier !== undefined && !namesIssuesRepo(qualifier, slug)) continue;
            push(Number(m[2]), "commit-trailer");
        }
    }
    if (sources.branchName) {
        const m = BRANCH_NUMBER_RE.exec(sources.branchName);
        if (m) push(Number(m[1]), "branch-name");
    }
    const claimed = new Set<number>();
    if (sources.prBody) {
        for (const m of sources.prBody.matchAll(SCOPE_REF_RE)) {
            const qualifier: string | undefined = m[1];
            // In a member pull request a bare number names the member's own issue, so the body
            // rung requires a qualifier, and requires it to name the issues repository. A
            // qualifier naming another repository is ruled out here, before the number is ever
            // looked up: the lookup is what can stop a run, and a foreign reference is not a near
            // miss worth printing in a refusal either.
            if (qualifier === undefined || !namesIssuesRepo(qualifier, slug)) continue;
            claimed.add(Number(m[2]));
            push(Number(m[2]), "pr-body");
        }
    }

    // Appearing in a body is a mention, not a claim. The story list is stamped verbatim onto the
    // receipt the epic's aggregate trusts, so a body that cites three sibling stories as
    // background would otherwise mark all three analyzed. A same-repository reference that
    // claimed nothing is still a near miss: a refusal names it, so a narrowed run can be read.
    const nearMisses: NearMiss[] = [];
    const seenMiss = new Set<number>();
    for (const m of (sources.prBody ?? "").matchAll(BODY_REF_RE)) {
        const number = Number(m[2]);
        if (!namesIssuesRepo(m[1], slug) || claimed.has(number) || seen.has(number) || seenMiss.has(number)) continue;
        seenMiss.add(number);
        nearMisses.push({ number });
    }
    return { candidates: out, nearMisses };
}

export type ResolveStoriesResult =
    | { ok: true; epic: number; stories: number[] }
    | { ok: false; error: PrWorktreeDiagnostic };

/** A candidate that did not survive, and the reason — so a refusal can say what it considered. */
interface Dropped {
    candidate: Candidate;
    why: string;
}

/**
 * Resolve the epic and the story (or stories) a pull request implements, from the candidate
 * sources in `sources`, validated against the live issue graph in `slug` under the repository's
 * declared `classification`.
 */
export function resolveStories(
    run: Runner,
    cwd: string,
    slug: RepoSlug,
    classification: KindClassification,
    sources: CandidateSources,
): ResolveStoriesResult {
    const { candidates, nearMisses } = gather(sources, slug);
    const cache = new Map<number, IssueFacts>();
    const dropped: Dropped[] = [];
    const storyCandidates: Candidate[] = [];
    const epicCandidates: number[] = [];
    const parentOf = new Map<number, number>();

    const facts = (n: number): { ok: true; facts: IssueFacts } | { ok: false; error: PrWorktreeDiagnostic } => {
        const hit: IssueFacts | undefined = cache.get(n);
        if (hit !== undefined) return { ok: true, facts: hit };
        const r = fetchIssueFacts(run, cwd, slug, n);
        if (!r.ok) return r;
        cache.set(n, r.facts);
        return { ok: true, facts: r.facts };
    };

    const kindOf = (n: number, f: IssueFacts): { ok: true; kind: IssueKind } | { ok: false; error: PrWorktreeDiagnostic } =>
        classifyIssueKind(classification, { number: n, labels: f.labels, issueType: f.issueType });

    for (const c of candidates) {
        const f = facts(c.number);
        if (!f.ok) return f;
        if (!f.facts.exists) {
            dropped.push({ candidate: c, why: "matches no issue in the issues repository" });
            continue;
        }
        const kind = kindOf(c.number, f.facts);
        if (!kind.ok) return kind;
        if (kind.kind === "epic") {
            epicCandidates.push(c.number);
        } else if (kind.kind === "story") {
            if (f.facts.parent === null) {
                dropped.push({ candidate: c, why: "is a story but is a sub-issue of no epic" });
                continue;
            }
            storyCandidates.push(c);
            parentOf.set(c.number, f.facts.parent);
        } else {
            dropped.push({ candidate: c, why: `is filed as ${kind.kind === "record" ? "a decision record" : "neither an epic nor a story"}` });
        }
    }

    // Every surviving candidate has to point at the same epic — a story at its parent, an epic at
    // itself. More than one is not a near-miss to be picked between; it means the PR spans epics.
    const epics = new Set<number>([...epicCandidates, ...parentOf.values()]);
    const considered = (): string => {
        const lines: string[] = candidates.map((c) => {
            const reason: Dropped | undefined = dropped.find((d) => d.candidate.number === c.number);
            return `#${c.number} (${c.source})${reason ? ` — ${reason.why}` : ""}`;
        });
        for (const miss of nearMisses) {
            lines.push(`#${miss.number} (pr-body) — names this repository but makes no claim of scope`);
        }
        const escape: string = nearMisses.length > 0 ? " Pass --story <n> to name the story explicitly." : "";
        return `${lines.length > 0 ? lines.join("; ") : "(none)"}.${escape}`;
    };

    if (epics.size === 0) {
        return {
            ok: false,
            error: {
                problem: "no-story-candidates",
                message: `no candidate resolved to a story or an epic of this repository; considered: ${considered()}`,
            },
        };
    }
    if (epics.size > 1) {
        const detail: string = [
            ...epicCandidates.map((e) => `#${e} → epic #${e}`),
            ...[...parentOf.entries()].map(([s, e]) => `#${s} → epic #${e}`),
        ].join(", ");
        return {
            ok: false,
            error: {
                problem: "story-candidates-multiple-epics",
                message: `surviving candidates resolve to more than one epic: ${detail}.`,
            },
        };
    }
    const epic: number = [...epics][0];

    // The resolved epic must itself be filed as an epic. Without this, a story filed under
    // something that is not an epic resolves to that something, and the run reads its body for
    // acceptance criteria it never had.
    const epicFacts = facts(epic);
    if (!epicFacts.ok) return epicFacts;
    const epicKind = kindOf(epic, epicFacts.facts);
    if (!epicKind.ok) return epicKind;
    if (epicKind.kind !== "epic") {
        return {
            ok: false,
            error: {
                problem: "no-story-candidates",
                message:
                    `candidates resolve to #${epic}, which this repository does not file as an epic; ` +
                    `considered: ${considered()}`,
            },
        };
    }

    // The epic's own live story set: its sub-issues, the decision record and any withdrawn story
    // removed. It is both the answer for an epic-level PR and the cross-check for a story-level
    // one — a candidate the epic does not name back never survived the predecessor either.
    const subs = fetchSubIssueFacts(run, cwd, slug, epic);
    if (!subs.ok) return subs;
    const epicStories: number[] = [];
    for (const [number, f] of subs.facts) {
        const kind = kindOf(number, f);
        if (!kind.ok) return kind;
        if (kind.kind !== "story") continue;
        if (isWithdrawnStory(f.labels, f.state, f.stateReason)) continue;
        epicStories.push(number);
    }
    epicStories.sort((a, b) => a - b);

    const named: number[] = storyCandidates.map((c) => c.number).filter((n) => epicStories.includes(n));
    const stories: number[] = (storyCandidates.length > 0 ? named : epicStories).sort((a, b) => a - b);

    if (stories.length === 0) {
        const why: string =
            storyCandidates.length > 0
                ? `epic #${epic} does not name ${storyCandidates.map((c) => `#${c.number}`).join(", ")} among its own stories`
                : `epic #${epic} has no live story sub-issues`;
        return {
            ok: false,
            error: { problem: "no-story-candidates", message: `${why}; considered: ${considered()}` },
        };
    }

    return { ok: true, epic, stories };
}
