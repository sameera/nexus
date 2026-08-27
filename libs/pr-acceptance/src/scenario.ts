/**
 * Seed one independent scenario into the scratch repo.
 *
 * A pull request merges once, so every merge strategy under test needs its own
 * scenario; the close gate's negative case needs one that is never merged; and
 * the chain scenario has to survive analysis, a post-analysis commit, a merge, a
 * close, and a drain. So seeding is **re-runnable** and mints a fresh,
 * independently numbered scenario per invocation — isolation between runs comes
 * from here, not from fresh repositories.
 *
 * Planning state is seeded **mechanically, through the shipped issue-creation
 * components**, not by running the interactive planning stages. Close and analyze
 * both navigate from a PR to the story it closes to that story's parent epic, so
 * the seeded issues must carry exactly the parent/child linkage and
 * classification the real creation path produces — reusing those components gets
 * that for free, and keeps a planning-stage failure from contaminating a signal
 * that is supposed to be about the post-merge flow.
 *
 * Every created URL is checked back against the scratch identity before the run
 * continues: targeting resolves from the current checkout's remote, so a command
 * run from the wrong directory would file against the Nexus repo itself, and it
 * would look like success.
 */

import { randomBytes } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { type Result, fail, ok } from "./diagnostic.js";
import { assertScratchTarget } from "./guard.js";
import { type ScratchIdentity, scenarioBranch } from "./names.js";
import { SCRATCH_FEATURE } from "./provision.js";
import { type Runner } from "./run.js";

export type ScenarioKind = "chain" | "multi-commit" | "single-commit" | "unmerged";

/** Commits on the PR branch. The single-commit case is the one range derivation treats separately. */
const COMMITS: Record<ScenarioKind, number> = {
    chain: 3,
    "multi-commit": 3,
    "single-commit": 1,
    unmerged: 2,
};

export interface SeedContext {
    run: Runner;
    /** The disposable clone. Every command runs with this as the working directory. */
    clonePath: string;
    /** The Nexus checkout the shipped issue-creation components are invoked from. */
    toolRoot: string;
    scratch: ScratchIdentity;
    today: string;
}

export interface Scenario {
    id: string;
    kind: ScenarioKind;
    branch: string;
    epicIssue: number;
    storyIssues: number[];
    /** The story the PR closes — how analyze and close navigate to the epic. */
    closesStory: number;
    prNumber: number;
    prUrl: string;
    commitCount: number;
    changedFiles: string[];
}

const ISSUE_URL = /https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/issues\/\d+/g;
const PR_URL = /https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/pull\/\d+/g;

function tail(url: string): number {
    return Number(url.slice(url.lastIndexOf("/") + 1));
}

function epicDoc(id: string, kind: ScenarioKind, today: string): string {
    return [
        "---",
        `feature: "Acceptance Scratch"`,
        `feature_path: docs/features/${SCRATCH_FEATURE}`,
        `epic: "Live acceptance scenario ${id}"`,
        `slug: ${id}`,
        `created: ${today}`,
        "type: enhancement",
        "complexity: S",
        "concepts: []",
        "---",
        "",
        `# Epic: Live acceptance scenario ${id}`,
        "",
        "## Description",
        "",
        `A throwaway epic seeded by the Nexus PR-flow live-acceptance harness (${kind} scenario).`,
        "It exists only to give the post-merge flow a real epic issue to navigate to.",
        "",
        "## Success Metrics",
        "",
        "- The post-merge flow can resolve this epic from the PR's linked story issue.",
        "",
        "## User Stories",
        "",
        "### Story 1: Carry a non-empty diff",
        "",
        "**As a** harness, **I want** a branch with a real diff, **so that** the derived range is checkable.",
        "",
        "## Acceptance Criteria",
        "",
        "- [ ] The branch carries a non-empty diff outside the queue path.",
        "",
        "### Story 2: Be closable",
        "",
        "**As a** harness, **I want** a second story issue, **so that** the epic has more than one child.",
        "",
        "## Acceptance Criteria",
        "",
        "- [ ] The story issue closes without a PR.",
        "",
        "## Out of Scope",
        "",
        "- Everything. This epic is disposable.",
        "",
    ].join("\n");
}

function storyDoc(ref: string, title: string, epicIssue: number, body: string): string {
    return [
        "---",
        `ref: "${ref}"`,
        `title: "${title}"`,
        "blocked_by: none",
        "labels: []",
        `parent: "#${epicIssue}"`,
        "---",
        "",
        body,
        "",
        "## Acceptance Criteria",
        "",
        "- [ ] Seeded by the live-acceptance harness; no implementation is expected.",
        "",
    ].join("\n");
}

function scenarioNote(id: string, n: number): string {
    return [
        `# Acceptance scenario ${id} — note ${n}`,
        "",
        `Commit ${n} of the seeded pull request. Its only job is to make the diff non-empty`,
        "and multi-commit, so the derived range can be checked against the PR's own file set.",
        "",
    ].join("\n");
}

export function seedScenario(ctx: SeedContext, kind: ScenarioKind, opts: { id?: string } = {}): Result<Scenario> {
    const id = opts.id ?? `${kind}-${randomBytes(4).toString("hex")}`;
    const branch = scenarioBranch(id);
    const { run, clonePath } = ctx;

    // Planning scratch lives outside the clone: it must never appear in the PR's diff.
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `nexus-acceptance-seed-${id}-`));
    try {
        // --- Epic issue, via the shipped component ---------------------------------
        const epicPath = path.join(workDir, "epic.md");
        fs.writeFileSync(epicPath, epicDoc(id, kind, ctx.today));
        const epicRun = run(
            "python3",
            [path.join(ctx.toolRoot, "libs/gh-toolkit/bin/nexus-gh"), "create-epic", "--yes", epicPath],
            { cwd: clonePath },
        );
        if (epicRun.status !== 0) {
            return fail(
                "scenario-failed",
                `seeding the epic issue failed: ${epicRun.stderr.trim() || epicRun.stdout.trim() || "the epic-creation component exited non-zero"}`,
            );
        }
        const epicUrl = (epicRun.stdout.match(ISSUE_URL) ?? [])[0];
        if (epicUrl === undefined) {
            return fail("scenario-failed", `the epic-creation component reported no issue URL; cannot resolve the seeded epic.`);
        }
        const epicChecked = assertScratchTarget(epicUrl, ctx.scratch, "seeded epic issue");
        if (!epicChecked.ok) return epicChecked;
        const epicIssue = tail(epicUrl);

        // --- Story sub-issues, via the shipped component ---------------------------
        const storiesDir = path.join(workDir, "stories");
        fs.mkdirSync(storiesDir, { recursive: true });
        fs.writeFileSync(
            path.join(storiesDir, "STORY-01.md"),
            storyDoc("STORY-01", `Carry a non-empty diff (${id})`, epicIssue, "**As a** harness, **I want** a real diff."),
        );
        fs.writeFileSync(
            path.join(storiesDir, "STORY-02.md"),
            storyDoc("STORY-02", `Be closable (${id})`, epicIssue, "**As a** harness, **I want** a second child issue."),
        );
        const storyRun = run(
            "python3",
            [
                path.join(ctx.toolRoot, "libs/gh-toolkit/bin/nexus-gh"),
                "create-story",
                storiesDir,
                "--no-project",
            ],
            { cwd: clonePath },
        );
        if (storyRun.status !== 0) {
            return fail(
                "scenario-failed",
                `seeding the story issues failed: ${storyRun.stderr.trim() || storyRun.stdout.trim() || "the story-creation component exited non-zero"}`,
            );
        }
        const storyUrls = storyRun.stdout.match(ISSUE_URL) ?? [];
        for (const u of storyUrls) {
            const checked = assertScratchTarget(u, ctx.scratch, "seeded story issue");
            if (!checked.ok) return checked;
        }
        const storyIssues = storyUrls.map(tail).filter((n) => n !== epicIssue);
        const closesStory = storyIssues[0];
        if (storyIssues.length < 2 || closesStory === undefined) {
            return fail(
                "scenario-failed",
                `the story-creation component reported ${storyIssues.length} story issue(s); the epic needs at least two children.`,
            );
        }

        // --- Feature branch with a real, multi-commit diff --------------------------
        const branched = run("git", ["-C", clonePath, "checkout", "-q", "-b", branch], { cwd: clonePath });
        if (branched.status !== 0) {
            return fail("git-failed", `could not create branch ${branch}: ${branched.stderr.trim()}`);
        }
        const commitCount = COMMITS[kind];
        const changedFiles: string[] = [];
        for (let n = 1; n <= commitCount; n++) {
            const rel = path.posix.join("docs", "features", SCRATCH_FEATURE, id, `note-${n}.md`);
            const abs = path.join(clonePath, rel);
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            fs.writeFileSync(abs, scenarioNote(id, n));
            changedFiles.push(rel);
            run("git", ["-C", clonePath, "add", "-A"], { cwd: clonePath });
            const c = run("git", ["-C", clonePath, "commit", "-qm", `feat(${id}): note ${n}`], { cwd: clonePath });
            if (c.status !== 0) return fail("git-failed", `commit ${n} on ${branch} failed: ${c.stderr.trim()}`);
        }
        const pushed = run("git", ["-C", clonePath, "push", "-q", "-u", "origin", branch], { cwd: clonePath });
        if (pushed.status !== 0) return fail("git-failed", `pushing ${branch} failed: ${pushed.stderr.trim()}`);

        // --- The pull request -------------------------------------------------------
        const prRun = run(
            "gh",
            [
                "pr",
                "create",
                "--base",
                "main",
                "--head",
                branch,
                "--title",
                `Live acceptance scenario ${id}`,
                "--body",
                `Seeded by the Nexus PR-flow live-acceptance harness.\n\nCloses #${closesStory}\n`,
            ],
            { cwd: clonePath },
        );
        if (prRun.status !== 0) {
            return fail("scenario-failed", `gh pr create for ${branch} failed: ${prRun.stderr.trim()}`);
        }
        const prUrl = (prRun.stdout.match(PR_URL) ?? [])[0];
        if (prUrl === undefined) {
            return fail("scenario-failed", `gh pr create reported no PR URL for ${branch}.`);
        }
        const prChecked = assertScratchTarget(prUrl, ctx.scratch, "seeded pull request");
        if (!prChecked.ok) return prChecked;

        // The PR closes its own story on merge; the rest must be closed here, or the
        // close precondition ("every child story issue closed") would block on harness
        // noise rather than on anything the flow did.
        for (const n of storyIssues.slice(1)) {
            const closed = run("gh", ["issue", "close", String(n), "--reason", "completed"], { cwd: clonePath });
            if (closed.status !== 0) {
                return fail("scenario-failed", `could not close seeded story issue #${n}: ${closed.stderr.trim()}`);
            }
        }

        // Back to the trunk, so the next scenario is cut from main rather than from this branch.
        run("git", ["-C", clonePath, "checkout", "-q", "main"], { cwd: clonePath });

        return ok({
            id,
            kind,
            branch,
            epicIssue,
            storyIssues,
            closesStory,
            prNumber: tail(prUrl),
            prUrl,
            commitCount,
            changedFiles,
        });
    } finally {
        fs.rmSync(workDir, { recursive: true, force: true });
    }
}
