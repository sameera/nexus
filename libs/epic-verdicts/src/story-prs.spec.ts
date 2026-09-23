import { describe, expect, it } from "vitest";
import { resolveStoryMergedPrs } from "./story-prs.js";
import { type Runner } from "./run.js";

const SLUG = { owner: "acme", repo: "hub" };

interface FakePr {
    number: number;
    repo: string;
    merged?: boolean;
    mergedAt?: string;
    mergeCommit?: string | null;
    body?: string;
}

function pr(p: FakePr): Record<string, unknown> {
    return {
        number: p.number,
        merged: p.merged ?? true,
        mergedAt: p.mergedAt ?? "2026-09-01T00:00:00Z",
        mergeCommit: p.mergeCommit === null ? null : { oid: p.mergeCommit ?? `sha-${p.number}` },
        body: p.body ?? "",
        repository: { nameWithOwner: p.repo },
    };
}

function fakeGraph(opts: { closing?: FakePr[]; crossRefs?: FakePr[]; fails?: boolean; garbage?: boolean }): Runner {
    return (cmd, args) => {
        if (cmd !== "gh" || args[0] !== "api" || args[1] !== "graphql") {
            return { status: 1, stdout: "", stderr: `unexpected: ${cmd} ${args.join(" ")}` };
        }
        if (opts.fails) return { status: 1, stdout: "", stderr: "gh: rate limited" };
        if (opts.garbage) return { status: 0, stdout: "not json", stderr: "" };
        return {
            status: 0,
            stdout: JSON.stringify({
                data: {
                    repository: {
                        issue: {
                            closedByPullRequestsReferences: { nodes: (opts.closing ?? []).map(pr) },
                            timelineItems: { nodes: (opts.crossRefs ?? []).map((p) => ({ source: pr(p) })) },
                        },
                    },
                },
            }),
            stderr: "",
        };
    };
}

describe("resolveStoryMergedPrs — a story's merged pull requests, from the issue graph (epic #769)", () => {
    it("returns a pull request that merged in another repository, naming that repository", () => {
        const run = fakeGraph({ closing: [{ number: 12, repo: "acme/member", mergeCommit: "abc" }] });
        const out = resolveStoryMergedPrs(run, "/hub", SLUG, 770);
        expect(out.prs).toEqual([
            { story: 770, pr: 12, repo: "acme/member", mergeCommit: "abc", mergedAt: "2026-09-01T00:00:00Z", edge: "closing" },
        ]);
    });

    it("returns both merged pull requests when a story shipped in two", () => {
        const run = fakeGraph({
            closing: [
                { number: 21, repo: "acme/member", mergedAt: "2026-09-05T00:00:00Z" },
                { number: 9, repo: "acme/member", mergedAt: "2026-09-02T00:00:00Z" },
            ],
        });
        const out = resolveStoryMergedPrs(run, "/hub", SLUG, 770);
        expect(out.prs.map((p) => p.pr)).toEqual([9, 21]);
    });

    it("queries only the issues repository, so holding no copy of the code repository changes nothing", () => {
        const seen: string[] = [];
        const base = fakeGraph({ closing: [{ number: 12, repo: "acme/member" }] });
        const run: Runner = (cmd, args, opts) => {
            seen.push(args.filter((a) => a.startsWith("owner=") || a.startsWith("repo=")).join(","));
            return base(cmd, args, opts);
        };
        const fromHub = resolveStoryMergedPrs(run, "/hub", SLUG, 770);
        const fromElsewhere = resolveStoryMergedPrs(run, "/somewhere-with-no-member-checkout", SLUG, 770);
        expect(fromElsewhere).toEqual(fromHub);
        expect(new Set(seen)).toEqual(new Set(["owner=acme,repo=hub"]));
    });

    it("returns none and still names the story when nothing merged for it", () => {
        const run = fakeGraph({ closing: [{ number: 30, repo: "acme/hub", merged: false }] });
        const out = resolveStoryMergedPrs(run, "/hub", SLUG, 770);
        expect(out).toEqual({ story: 770, prs: [] });
    });

    it("accepts a cross-referencing pull request only once it claims the story", () => {
        const claiming = { number: 40, repo: "acme/member", body: "Closes acme/hub#770" };
        const mentioning = { number: 41, repo: "acme/member", body: "see acme/hub#770 for background" };
        const out = resolveStoryMergedPrs(fakeGraph({ crossRefs: [claiming, mentioning] }), "/hub", SLUG, 770);
        expect(out.prs.map((p) => p.pr)).toEqual([40]);
        expect(out.prs[0].edge).toBe("cross-reference");
    });

    it("does not read a bare number in another repository's pull request as a claim on this story", () => {
        const out = resolveStoryMergedPrs(
            fakeGraph({ crossRefs: [{ number: 42, repo: "acme/member", body: "Closes #770" }] }),
            "/hub",
            SLUG,
            770,
        );
        expect(out.prs).toEqual([]);
    });

    it("reads a bare claim inside the issues repository itself", () => {
        const out = resolveStoryMergedPrs(
            fakeGraph({ crossRefs: [{ number: 43, repo: "acme/hub", body: "Closes #770" }] }),
            "/hub",
            SLUG,
            770,
        );
        expect(out.prs.map((p) => p.pr)).toEqual([43]);
    });

    it("keeps the closing edge when a pull request arrives on both edges", () => {
        const both = { number: 50, repo: "acme/hub", body: "Closes #770" };
        const out = resolveStoryMergedPrs(fakeGraph({ closing: [both], crossRefs: [both] }), "/hub", SLUG, 770);
        expect(out.prs.map((p) => p.edge)).toEqual(["closing"]);
    });

    it("reports no pull requests rather than crashing when the platform refuses or answers nonsense", () => {
        expect(resolveStoryMergedPrs(fakeGraph({ fails: true }), "/hub", SLUG, 770).prs).toEqual([]);
        expect(resolveStoryMergedPrs(fakeGraph({ garbage: true }), "/hub", SLUG, 770).prs).toEqual([]);
    });
});
