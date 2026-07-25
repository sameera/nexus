import * as fs from "node:fs";
import * as path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { type SeedContext, seedScenario } from "./scenario.js";
import { SCRATCH_REPO_NAME, scratchIdentity } from "./names.js";
import {
    type Route,
    callsMatching,
    cwdsMatching,
    fakeRunner,
    initRepo,
    makeTempDir,
    sh,
    writeCommit,
} from "./harness-fixtures.js";
import { defaultRunner } from "./run.js";

const tracked: string[] = [];
afterAll(() => {
    for (const d of tracked) fs.rmSync(d, { recursive: true, force: true });
});

const scratch = scratchIdentity("sameera");
const NWO = scratch.nameWithOwner;

/** The epic-creation component stamps `link:` back into the epic file it was handed. */
function epicCreator(issue: number): Route {
    return {
        match: "nxs_gh_create_epic.py",
        result: { stdout: `✅ Created issue #${issue}\n   https://github.com/${NWO}/issues/${issue}\n` },
    };
}

/** The story-creation component leaves a resume ledger naming each created issue. */
function storyCreator(numbers: number[], repo = NWO): Route {
    return {
        match: "create_gh_issues.py",
        result: { stdout: numbers.map((n) => `https://github.com/${repo}/issues/${n}`).join("\n") },
    };
}

function prCreator(number: number, repo = NWO): Route {
    return { match: "gh pr create", result: { stdout: `https://github.com/${repo}/pull/${number}\n` } };
}

function context(routes: Route[]): { ctx: SeedContext; run: ReturnType<typeof fakeRunner>; clone: string } {
    const parent = makeTempDir(tracked);
    const origin = path.join(parent, "origin.git");
    fs.mkdirSync(origin, { recursive: true });
    sh(origin, "git", "init", "-q", "--bare", "-b", "main");
    const clone = path.join(parent, "clone");
    initRepo(clone, origin);
    fs.mkdirSync(path.join(clone, "docs/features/acceptance-scratch"), { recursive: true });
    fs.writeFileSync(path.join(clone, "docs/features/acceptance-scratch/README.md"), "# scratch\n");
    writeCommit(clone, "README.md", "# scratch repo\n", "trunk");
    sh(clone, "git", "push", "-q", "-u", "origin", "main");

    const toolRoot = path.join(parent, "nexus");
    fs.mkdirSync(toolRoot, { recursive: true });
    const run = fakeRunner(routes, defaultRunner);
    return { ctx: { run, clonePath: clone, toolRoot, scratch, today: "2026-07-25" }, run, clone };
}

describe("seedScenario", () => {
    const happy = (): Route[] => [
        epicCreator(10),
        storyCreator([11, 12]),
        prCreator(13),
        { match: "gh issue close" },
        { match: /push .*origin acceptance\// },
    ];

    it("seeds an epic with at least two story sub-issues, a multi-commit branch, and an open PR", () => {
        const { ctx, run } = context(happy());
        const r = seedScenario(ctx, "chain");
        expect(r.ok ? "ok" : r.error).toBe("ok");
        if (!r.ok) return;
        expect(r.value.epicIssue).toBe(10);
        expect(r.value.storyIssues).toEqual([11, 12]);
        expect(r.value.storyIssues.length).toBeGreaterThanOrEqual(2);
        expect(r.value.prNumber).toBe(13);
        expect(r.value.commitCount).toBeGreaterThan(1);
        expect(callsMatching(run, "gh pr create").length).toBe(1);
    });

    it("gives the PR a genuinely non-empty diff outside the queue path", () => {
        const { ctx, clone } = context(happy());
        const r = seedScenario(ctx, "chain");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.changedFiles.length).toBeGreaterThan(0);
        for (const f of r.value.changedFiles) expect(f.startsWith(".nexus/queue")).toBe(false);
        const diff = sh(clone, "git", "diff", "--name-only", "main..." + r.value.branch);
        expect(diff.split("\n").filter(Boolean).sort()).toEqual([...r.value.changedFiles].sort());
    });

    it("creates the story issues through the shipped component, so parent linkage matches the real path", () => {
        const { ctx, run } = context(happy());
        seedScenario(ctx, "chain");
        expect(callsMatching(run, "nxs_gh_create_epic.py").length).toBe(1);
        expect(callsMatching(run, "create_gh_issues.py").length).toBe(1);
    });

    it("runs every issue, PR, and git command with the working directory inside the clone", () => {
        const { ctx, clone, run } = context(happy());
        seedScenario(ctx, "chain");
        // Targeting resolves from the cwd's remote, so this is what keeps the run off the Nexus repo.
        expect(cwdsMatching(run, "nxs_gh_create_epic.py")).toEqual([clone]);
        expect(cwdsMatching(run, "create_gh_issues.py")).toEqual([clone]);
        expect(cwdsMatching(run, "gh pr create")).toEqual([clone]);
        expect(cwdsMatching(run, "gh issue close")).toEqual([clone]);
        for (const cwd of run.cwds) expect(cwd).toBe(clone);
    });

    it("closes the story issues the PR will not close, so the close precondition can be met", () => {
        const { ctx, run } = context(happy());
        const r = seedScenario(ctx, "chain");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const closed = callsMatching(run, "gh issue close");
        // #11 is closed by the PR on merge; #12 must be closed by the seed.
        expect(closed.length).toBe(1);
        expect(closed[0]).toContain("12");
    });

    it("makes the PR close its story issue, which is how close navigates to the epic", () => {
        const { ctx, run } = context(happy());
        seedScenario(ctx, "chain");
        const body = callsMatching(run, "gh pr create")[0];
        expect(body).toContain("Closes #11");
    });

    it("produces an independently named scenario on each invocation", () => {
        const a = context(happy());
        const b = context(happy());
        const ra = seedScenario(a.ctx, "multi-commit");
        const rb = seedScenario(b.ctx, "multi-commit");
        expect(ra.ok && rb.ok).toBe(true);
        if (!ra.ok || !rb.ok) return;
        expect(ra.value.id).not.toBe(rb.value.id);
        expect(ra.value.branch).not.toBe(rb.value.branch);
    });

    it("seeds a single-commit PR for the rebase case the range derivation treats specially", () => {
        const { ctx } = context(happy());
        const r = seedScenario(ctx, "single-commit");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.commitCount).toBe(1);
    });

    it("refuses when the epic issue landed on a repo other than the scratch repo", () => {
        const { ctx } = context([
            {
                match: "nxs_gh_create_epic.py",
                result: { stdout: "https://github.com/sameera/nexus/issues/10\n" },
            },
            storyCreator([11, 12]),
            prCreator(13),
            { match: "gh issue close" },
            { match: /push .*origin acceptance\// },
        ]);
        const r = seedScenario(ctx, "chain");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("host-repo-mutation");
        expect(r.error.message).toContain("sameera/nexus");
    });

    it("refuses when the PR landed on a repo other than the scratch repo", () => {
        const { ctx } = context([
            epicCreator(10),
            storyCreator([11, 12]),
            prCreator(13, "sameera/nexus"),
            { match: "gh issue close" },
            { match: /push .*origin acceptance\// },
        ]);
        const r = seedScenario(ctx, "chain");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("host-repo-mutation");
    });

    it("reports a failing epic-creation component instead of continuing with a half-seeded scenario", () => {
        const { ctx, run } = context([
            { match: "nxs_gh_create_epic.py", result: { status: 1, stderr: "gh: not authenticated" } },
        ]);
        const r = seedScenario(ctx, "chain");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("scenario-failed");
        expect(callsMatching(run, "gh pr create")).toEqual([]);
    });

    it("refuses when fewer than two story issues came back", () => {
        const { ctx } = context([epicCreator(10), storyCreator([11]), prCreator(13)]);
        const r = seedScenario(ctx, "chain");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("scenario-failed");
    });

    it("leaves the scenario's planning scratch out of the committed diff", () => {
        const { ctx, clone } = context(happy());
        const r = seedScenario(ctx, "chain");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.changedFiles.every((f) => !f.includes(".nexus/tmp"))).toBe(true);
        expect(sh(clone, "git", "status", "--porcelain")).toBe("");
    });

    it("returns to the trunk so the next scenario is cut from main, not from this branch", () => {
        const { ctx, clone } = context(happy());
        seedScenario(ctx, "chain");
        expect(sh(clone, "git", "rev-parse", "--abbrev-ref", "HEAD")).toBe("main");
    });

    it("names the scratch repo in the seeded epic so the record can be traced back to it", () => {
        const { ctx } = context(happy());
        const r = seedScenario(ctx, "chain");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.id).toContain("chain");
        expect(SCRATCH_REPO_NAME).toBe("nexus-pr-acceptance-scratch");
    });
});

describe("seedScenario — failures that must not leave a half-seeded scenario", () => {
    const base = (over: Route[] = []): Route[] => [epicCreator(10), storyCreator([11, 12]), ...over];

    it("reports a failing story-creation component", () => {
        const { ctx, run } = context([
            epicCreator(10),
            { match: "create_gh_issues.py", result: { status: 1, stderr: "gh: HTTP 403" } },
        ]);
        const r = seedScenario(ctx, "chain");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("scenario-failed");
        expect(callsMatching(run, "gh pr create")).toEqual([]);
    });

    it("reports a failing branch push rather than opening a PR against nothing", () => {
        const { ctx, run } = context(base([{ match: /push .*origin acceptance\//, result: { status: 1, stderr: "denied" } }]));
        const r = seedScenario(ctx, "chain");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("git-failed");
        expect(callsMatching(run, "gh pr create")).toEqual([]);
    });

    it("reports a failing PR creation", () => {
        const { ctx } = context(
            base([
                { match: /push .*origin acceptance\// },
                { match: "gh pr create", result: { status: 1, stderr: "no commits between" } },
            ]),
        );
        const r = seedScenario(ctx, "chain");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("scenario-failed");
        expect(r.error.message).toContain("no commits between");
    });

    it("refuses when gh reports no PR URL to resolve the scenario from", () => {
        const { ctx } = context(base([{ match: /push .*origin acceptance\// }, { match: "gh pr create", result: { stdout: "" } }]));
        const r = seedScenario(ctx, "chain");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("scenario-failed");
    });

    it("reports a story issue that could not be closed, since the close precondition depends on it", () => {
        const { ctx } = context(
            base([
                { match: /push .*origin acceptance\// },
                prCreator(13),
                { match: "gh issue close", result: { status: 1, stderr: "not found" } },
            ]),
        );
        const r = seedScenario(ctx, "chain");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("scenario-failed");
        expect(r.error.message).toContain("#12");
    });

    it("refuses when the epic-creation component reported no issue URL", () => {
        const { ctx } = context([{ match: "nxs_gh_create_epic.py", result: { stdout: "done\n" } }]);
        const r = seedScenario(ctx, "chain");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("scenario-failed");
    });

    it("reports a branch it could not create", () => {
        const { ctx } = context(base([{ match: "checkout -q -b acceptance/", result: { status: 1, stderr: "exists" } }]));
        const r = seedScenario(ctx, "chain");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("git-failed");
    });
});
