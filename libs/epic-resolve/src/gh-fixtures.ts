/**
 * Spec-only fixture: an in-memory epic issue graph and a {@link Runner} that answers the resolver's
 * `gh` calls from it — no network. Excluded from the lib build (see tsconfig.lib.json); imported by
 * the resolver specs the way pr-worktree's specs import git-fixtures.ts.
 *
 * It answers the four call shapes the read layer makes: `gh repo view`, `gh issue view <n>`,
 * `gh api graphql` (sub-issues), and `gh api …/dependencies/blocked_by`. Faults are injected per
 * call shape so a spec can prove fail-closed behavior at any fetch.
 */

import { type RunResult, type Runner } from "./run.js";

export interface FixtureStory {
    number: number;
    title: string;
    body: string;
    state?: string;
    /** Issue numbers this story is blocked_by (its native GitHub dependency edges). */
    blockedBy?: number[];
}

export interface FixtureGraph {
    /** "owner/repo" reported by `gh repo view`. */
    slug?: string;
    epic: { number: number; title: string; body: string; state?: string };
    stories?: FixtureStory[];
    /** Order the sub-issues GraphQL query returns (default: the stories' declared order). */
    subIssueOrder?: number[];
    failRepoView?: boolean;
    failSubIssues?: boolean;
    malformedSubIssues?: boolean;
    failIssueView?: Set<number>;
    malformedIssues?: Set<number>;
    failBlockedBy?: Set<number>;
}

function numberStream(numbers: number[]): string {
    return numbers.length === 0 ? "" : numbers.join("\n") + "\n";
}

export function makeGhRunner(graph: FixtureGraph): Runner {
    const slug = graph.slug ?? "acme/app";
    const stories = graph.stories ?? [];
    const storyByNumber = new Map(stories.map((s) => [s.number, s]));

    return (cmd: string, args: string[]): RunResult => {
        const ok = (stdout: string): RunResult => ({ status: 0, stdout, stderr: "" });
        const fail = (stderr: string): RunResult => ({ status: 1, stdout: "", stderr });

        if (cmd !== "gh") return fail(`unexpected command: ${cmd}`);

        if (args[0] === "repo" && args[1] === "view") {
            return graph.failRepoView ? fail("not a git repository") : ok(slug + "\n");
        }

        if (args[0] === "issue" && args[1] === "view") {
            const n = Number(args[2]);
            if (graph.failIssueView?.has(n)) return fail(`Could not resolve to an issue (not found): #${n}`);
            if (graph.malformedIssues?.has(n)) return ok("not json");
            if (n === graph.epic.number) {
                return ok(
                    JSON.stringify({
                        number: n,
                        title: graph.epic.title,
                        body: graph.epic.body,
                        state: graph.epic.state ?? "OPEN",
                    }),
                );
            }
            const story = storyByNumber.get(n);
            if (!story) return fail(`not found: #${n}`);
            return ok(
                JSON.stringify({ number: n, title: story.title, body: story.body, state: story.state ?? "OPEN" }),
            );
        }

        if (args[0] === "api" && args[1] === "graphql") {
            if (graph.failSubIssues) return fail("GraphQL error listing sub-issues");
            if (graph.malformedSubIssues) return ok("not-a-number\n");
            const order = graph.subIssueOrder ?? stories.map((s) => s.number);
            return ok(numberStream(order));
        }

        if (args[0] === "api" && typeof args[1] === "string" && args[1].includes("dependencies/blocked_by")) {
            const m = /issues\/(\d+)\/dependencies/.exec(args[1]);
            const n = m ? Number(m[1]) : NaN;
            if (graph.failBlockedBy?.has(n)) return fail(`blocked_by fetch failed: #${n}`);
            return ok(numberStream(storyByNumber.get(n)?.blockedBy ?? []));
        }

        return fail(`unexpected gh call: ${args.join(" ")}`);
    };
}
