/**
 * The roadmap a teaching stage works through (epic #455, story #471).
 *
 * The stories a learner is about to be taught are already written down: their bodies and the
 * dependency edges between them live on the issue graph. So a roadmap is resolved from there rather
 * than authored by hand, and it is resolved through the same shared epic resolver the
 * decision-record, analyze and close stages already use (record #478). That resolver owns five
 * rules this module would otherwise write a second time — record-sub-issue exclusion, withdrawn-story
 * dropping, the epic-stub refusal, workspace-aware targeting, and fail-closed behaviour on a story it
 * cannot fetch — and a second copy of them drifts silently, which here means teaching work that was
 * withdrawn or was never planned.
 *
 * What this module adds is the part the resolver has no opinion about: many epics become one story
 * set, in one dependency-respecting order across all of them, with the edges that point outside the
 * roadmap kept and marked rather than dropped. An edge onto a withdrawn story is gone because the
 * blocker will never ship; an edge onto work that merely sits elsewhere is a real prerequisite
 * nobody on this roadmap will build, and erasing the difference hides it behind a clean-looking
 * order.
 *
 * The result is self-contained (invariant 5) and derived (invariant 6): it carries every story's
 * body and every edge, so no later phase goes back to the issue graph to learn what a story says,
 * and it materializes beside the other ephemeral resolver output where nothing commits it.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { type RunResult, type Runner } from "@nexus/workspace/run";
import { backlogQuery } from "@nexus/delivery-config/backlog";
import { layersAt } from "@nexus/delivery-config/resolve";
import { type ResolveEpicResult, type ResolvedEpic } from "@nexus/epic-resolve/resolve";
import { MATERIALIZED_DIR } from "@nexus/epic-resolve/write";

/** The most epics one roadmap may hold, refused before any fetch begins (invariant 13). */
export const ROADMAP_EPIC_CAP: number = 10;

/** One story of the roadmap, carrying everything a later phase would otherwise re-fetch. */
export interface RoadmapStory {
    number: number;
    title: string;
    body: string;
    /** The epic issue this story is a sub-issue of. */
    epic: number;
    /** Blockers that are themselves on the roadmap. These are what the order respects. */
    blockedBy: number[];
    /** Blockers that sit outside the roadmap: retained, never ordering, never silently dropped. */
    external: number[];
}

export interface Roadmap {
    /** The roadmap's name, which is also the workbook slug the interview is keyed on. */
    name: string;
    /** The epic issues it was resolved from, in ascending order. */
    epics: number[];
    /** Every story of every epic, in one dependency-respecting order across all of them. */
    stories: RoadmapStory[];
}

/** A named diagnostic, in the same shape the shared resolver reports its own. */
export interface RoadmapProblem {
    problem: string;
    message: string;
}

export type RoadmapResult = { ok: true; roadmap: Roadmap } | { ok: false; error: RoadmapProblem };

/**
 * The shared resolver, injected.
 *
 * What this module takes from it is the **structured** resolution, never the `epic.md` markdown it
 * also returns. A story body is a whole issue body and a real one carries its own `## Acceptance
 * Criteria` heading, which in the rendered document is indistinguishable from the epic's next H2
 * section — so a roadmap parsed back out of that markdown would silently drop everything a story
 * says past its first sub-heading, and invariant 5 would hold in name only.
 */
export type EpicResolver = (epic: number) => ResolveEpicResult;

/** A roadmap name derived from an epic's title — lower case, hyphenated, a plain directory name. */
export function nameFromTitle(title: string, epic: number): string {
    const slug: string = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return slug === "" ? `epic-${epic}` : slug;
}

export interface ResolveRoadmapOptions {
    /** The roadmap's name. A single-epic roadmap defaults it from the epic; a query must name it. */
    name?: string;
}

/**
 * Resolve one roadmap from a set of epic issues.
 *
 * The cap is checked before anything is fetched, because refusing by name costs nothing while an
 * unbounded set spends hundreds of sequential issue-graph calls before the learner is asked
 * anything. Every other failure — an epic that cannot be read, one that is not a planned epic, a
 * dependency cycle — is the shared resolver's own diagnostic or this module's, and it fails the
 * whole resolution: a roadmap that quietly omits an epic the learner asked for is
 * indistinguishable from a complete one.
 */
export function resolveRoadmap(resolve: EpicResolver, epics: readonly number[], opts: ResolveRoadmapOptions = {}): RoadmapResult {
    const wanted: number[] = [...new Set(epics)].sort((a, b) => a - b);
    if (wanted.length === 0) {
        return {
            ok: false,
            error: {
                problem: "roadmap-empty",
                message: "no epic was named, so there is no roadmap to resolve. Name an epic issue, or a query that returns one.",
            },
        };
    }
    if (wanted.length > ROADMAP_EPIC_CAP) {
        return {
            ok: false,
            error: {
                problem: "roadmap-too-many-epics",
                message:
                    `${wanted.length} epics were named, and a roadmap holds at most ${ROADMAP_EPIC_CAP}. ` +
                    `Resolution costs a couple of issue-graph calls per story, so narrow the set before re-running.`,
            },
        };
    }

    const resolved: ResolvedEpic[] = [];
    for (const epic of wanted) {
        const result: ResolveEpicResult = resolve(epic);
        if (!result.ok) return { ok: false, error: result.error };
        resolved.push(result.resolved);
    }

    const ordered = orderStories(resolved);
    if (!ordered.ok) return ordered;

    return {
        ok: true,
        roadmap: {
            name: opts.name ?? nameFromTitle(resolved[0].title, wanted[0]),
            epics: wanted,
            stories: ordered.stories,
        },
    };
}

type OrderResult = { ok: true; stories: RoadmapStory[] } | { ok: false; error: RoadmapProblem };

/**
 * One topological pass over the merged edge set, with ties broken by ascending issue number.
 *
 * Ordering epic by epic would answer a different question: the stories of several epics are one
 * set, and the order only means anything over the union of their edges. The tie-break makes the
 * order total and deterministic, so a roadmap re-resolved from an unchanged graph is the same
 * roadmap and every artifact derived from it is repeatable.
 */
function orderStories(epics: readonly ResolvedEpic[]): OrderResult {
    const stories: Map<number, RoadmapStory> = new Map();
    for (const epic of epics) {
        for (const story of epic.stories) {
            stories.set(story.number, {
                number: story.number,
                title: story.title,
                body: story.body,
                epic: epic.number,
                blockedBy: [],
                external: [],
            });
        }
    }
    for (const epic of epics) {
        for (const story of epic.stories) {
            const entry: RoadmapStory = stories.get(story.number) as RoadmapStory;
            for (const blocker of epic.blockedBy.get(story.number) ?? []) {
                (stories.has(blocker) ? entry.blockedBy : entry.external).push(blocker);
            }
            entry.blockedBy.sort((a, b) => a - b);
            entry.external.sort((a, b) => a - b);
        }
    }

    const remaining: Set<number> = new Set(stories.keys());
    const ordered: RoadmapStory[] = [];
    while (remaining.size > 0) {
        const ready: number[] = [...remaining]
            .filter((n) => (stories.get(n) as RoadmapStory).blockedBy.every((b) => !remaining.has(b)))
            .sort((a, b) => a - b);
        if (ready.length === 0) {
            const cycle: string = [...remaining].sort((a, b) => a - b).map((n) => `#${n}`).join(", ");
            return {
                ok: false,
                error: {
                    problem: "roadmap-cycle",
                    message:
                        `these stories block each other, so no order satisfies them all: ${cycle}. ` +
                        `Break the cycle on the issue graph and re-resolve.`,
                },
            };
        }
        const next: number = ready[0];
        remaining.delete(next);
        ordered.push(stories.get(next) as RoadmapStory);
    }
    return { ok: true, stories: ordered };
}

/** The file name a resolved roadmap materializes as. */
export const ROADMAP_FILENAME: string = "roadmap.json";

/** Where one roadmap materializes: beside the other ephemeral resolver output, never committed. */
export function roadmapPath(repoRoot: string, name: string): string {
    return path.join(repoRoot, MATERIALIZED_DIR, `roadmap-${name}`, ROADMAP_FILENAME);
}

/** Write the roadmap to its derived home. Byte-identical for an unchanged issue graph. */
export function writeRoadmap(repoRoot: string, roadmap: Roadmap): string {
    const target: string = roadmapPath(repoRoot, roadmap.name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(roadmap, null, 4)}\n`);
    return target;
}

/** Read a resolved roadmap back, or null when none of that name has been resolved. */
export function readRoadmap(repoRoot: string, name: string): Roadmap | null {
    const target: string = roadmapPath(repoRoot, name);
    if (!fs.existsSync(target)) return null;
    return JSON.parse(fs.readFileSync(target, "utf8")) as Roadmap;
}

/**
 * The epics a backlog query returns.
 *
 * The learner supplies a search expression; the stage composes it with the repository's configured
 * stub-exclusion form before running it (invariant 12). Every query enumerating epics for planned
 * work carries that negation, and the repository already exposes it, so a repository that renames
 * the label renames this query too. Composing it also means an under-specified expression cannot
 * pull an unplanned stub into a roadmap and trip the epic-stub refusal further down.
 *
 * The expression is passed as an argument vector after `--`, never assembled into a shell string:
 * the exclusion form begins with a hyphen, and a learner's expression is untrusted input.
 */
export function epicsFromQuery(run: Runner, repoRoot: string, expression: string): { ok: true; epics: number[] } | { ok: false; error: RoadmapProblem } {
    const exclusion: string = backlogQuery(layersAt(repoRoot), "exclude");
    const result: RunResult = run(
        "gh",
        ["search", "issues", "--json", "number,repository", "--limit", String(ROADMAP_EPIC_CAP + 1), "--", expression, exclusion],
        { cwd: repoRoot },
    );
    if (result.status !== 0) {
        return {
            ok: false,
            error: {
                problem: "roadmap-query-failed",
                message: `the backlog query could not be run: ${result.stderr.trim() || "gh exited non-zero"}`,
            },
        };
    }

    let rows: { number: number; repository?: { nameWithOwner?: string } }[];
    try {
        rows = JSON.parse(result.stdout) as { number: number; repository?: { nameWithOwner?: string } }[];
    } catch {
        return { ok: false, error: { problem: "roadmap-query-failed", message: "the backlog query returned something that is not a result set." } };
    }

    const repos: string[] = [...new Set(rows.map((row) => row.repository?.nameWithOwner ?? ""))].sort();
    if (repos.length > 1) {
        return {
            ok: false,
            error: {
                problem: "roadmap-multi-repo",
                message:
                    `the query returned epics in ${repos.join(" and ")}. A workbook lives in the one repository ` +
                    `whose roadmap it teaches, so a roadmap spanning repositories has no single home. Narrow the query to one.`,
            },
        };
    }

    const epics: number[] = [...new Set(rows.map((row) => row.number))].sort((a, b) => a - b);
    if (epics.length > ROADMAP_EPIC_CAP) {
        // The search is asked for one row past the cap and no more, so what came back is a floor
        // rather than a total: a query matching fifty epics is indistinguishable here from one
        // matching eleven. Saying "more than ten" is the whole of what was established; naming a
        // count would be reporting the fetch limit back to the learner as if it were their result.
        return {
            ok: false,
            error: {
                problem: "roadmap-too-many-epics",
                message:
                    `the query returned more than ${ROADMAP_EPIC_CAP} epics, which is the most a roadmap holds. ` +
                    `Narrow it before re-running — no epic was fetched.`,
            },
        };
    }
    return { ok: true, epics };
}
