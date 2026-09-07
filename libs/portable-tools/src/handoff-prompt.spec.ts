import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultRunner } from "@nexus/close-migration/run";
import { startWorkbookSession } from "./handoffs.js";
import { learnerRecordDir, readLearnerRecord } from "./learner-store.js";
import { createWorkbook } from "./workbook-store.js";
import { pauseForHandoff, renderHandoffPrompt, siblingSlices, type HandoffContext } from "./handoff-prompt.js";
import { type TeachingPlan } from "./teaching-plan.js";

let tmpDirs: string[] = [];
function makeDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "handoff-prompt-"));
    tmpDirs.push(dir);
    return dir;
}
afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs = [];
});

function sh(cwd: string, cmd: string, ...args: string[]): string {
    return execFileSync(cmd, args, { cwd, encoding: "utf8" }).replace(/\n$/, "");
}
function repoWithWorkbook(slug = "rdl"): string {
    const dir = makeDir();
    sh(dir, "git", "init", "-q", "-b", "main");
    sh(dir, "git", "config", "user.email", "spec@example.com");
    sh(dir, "git", "config", "user.name", "spec");
    fs.writeFileSync(path.join(dir, ".gitignore"), ".nexus/tmp/\n");
    createWorkbook(dir, slug);
    return dir;
}

const CONTEXT: HandoffContext = {
    repo: "sameera/nexus",
    branch: "feat/407-session-teaches-one-lesson",
    epic: 407,
    story: 464,
    siblings: [460, 461, 462],
};

describe("renderHandoffPrompt", () => {
    it("names the repository, the branch, the epic and the story to build", () => {
        const prompt = renderHandoffPrompt(CONTEXT);
        expect(prompt).toContain("sameera/nexus");
        expect(prompt).toContain("feat/407-session-teaches-one-lesson");
        expect(prompt).toContain("#407");
        expect(prompt).toContain("#464");
    });

    it("names the sibling slices the coding agent must not touch", () => {
        const prompt = renderHandoffPrompt(CONTEXT);
        expect(prompt).toContain("#460");
        expect(prompt).toContain("#461");
        expect(prompt).toContain("#462");
    });

    it("says not to run the two epic-level commands", () => {
        const prompt = renderHandoffPrompt(CONTEXT);
        expect(prompt).toContain("/nxs.analyze");
        expect(prompt).toContain("/nxs.close");
    });
});

describe("siblingSlices", () => {
    it("names every other slice in the plan, and never the story itself", () => {
        const plan: TeachingPlan = {
            slices: [
                { story: 460, learnerBuilds: true, pinned: { title: "t", body: "b" } },
                { story: 464, learnerBuilds: false, pinned: { title: "t", body: "b" } },
                { story: 465, learnerBuilds: true, pinned: { title: "t", body: "b" } },
            ],
        };
        expect(siblingSlices(plan, 464)).toEqual([460, 465]);
    });
});

describe("pauseForHandoff", () => {
    it("neither builds nor teaches the slice — it only records the pause and writes the prompt", () => {
        const repo = repoWithWorkbook();
        const { handoff, promptPath } = pauseForHandoff(repo, "rdl", CONTEXT);

        expect(handoff.story).toBe("464");
        expect(fs.existsSync(promptPath)).toBe(true);
        expect(fs.readFileSync(promptPath, "utf8")).toContain("#464");
    });

    it("keeps the prompt under the learner folder, never as a page in the workbook", () => {
        const repo = repoWithWorkbook();
        pauseForHandoff(repo, "rdl", CONTEXT);

        const dir = learnerRecordDir(repo, "handoffs");
        const promptFile = fs.readdirSync(dir).find((f) => f.includes("prompt"));
        expect(promptFile).toBeDefined();
        expect(readLearnerRecord(repo, "handoffs", promptFile as string)).toContain("sameera/nexus");
        expect(sh(repo, "git", "status", "--porcelain")).not.toContain(".learner");
    });

    it("records the pause at the clock the session gave it, so the record is reproducible", () => {
        const repo = repoWithWorkbook();

        const { handoff } = pauseForHandoff(repo, "rdl", CONTEXT, defaultRunner, () => "2026-09-07T12:00:00.000Z");

        expect(handoff.recordedAt).toBe("2026-09-07T12:00:00.000Z");
    });

    it("a session opened later resumes at the story that was handed off", () => {
        const repo = repoWithWorkbook();
        pauseForHandoff(repo, "rdl", CONTEXT);

        const session = startWorkbookSession(repo, "rdl");
        expect(session.resumeAt?.story).toBe("464");
    });
});
