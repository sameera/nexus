import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultRunner } from "./run.js";
import { combinedChangeSet } from "./combined.js";
import { type StoryVerdict } from "./verdict.js";

function sh(cwd: string, cmd: string, ...args: string[]): string {
    const r = spawnSync(cmd, args, { cwd, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
    return r.stdout.replace(/\n$/, "");
}

const tracked: string[] = [];
function makeParent(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "epic-verdicts-combined-"));
    tracked.push(d);
    return d;
}
function initRepo(dir: string, origin: string): void {
    fs.mkdirSync(dir, { recursive: true });
    sh(dir, "git", "init", "-q", "-b", "main");
    sh(dir, "git", "config", "user.email", "spec@example.com");
    sh(dir, "git", "config", "user.name", "spec");
    sh(dir, "git", "remote", "add", "origin", origin);
}
function writeCommit(dir: string, file: string, content: string, msg: string): string {
    fs.writeFileSync(path.join(dir, file), content);
    sh(dir, "git", "add", "-A");
    sh(dir, "git", "commit", "-qm", msg);
    return sh(dir, "git", "rev-parse", "HEAD");
}

afterEach(() => {
    for (const d of tracked.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function verdict(over: Partial<StoryVerdict> & { story: number; pr: number; base: string; head: string }): StoryVerdict {
    return {
        repo: "acme/widget",
        state: "OPEN",
        receipt: {
            epic: "#212",
            nexusVersion: null,
            pr: over.pr,
            date: "2026-09-01",
            head: over.head,
            mode: "full",
            findings: { critical: 0, high: 0, medium: 0, low: 0 },
            repo: "acme/widget",
            stories: [over.story],
            record: null,
            recordHash: null,
        },
        ...over,
    };
}

describe("combinedChangeSet — the union of each story pull request's own change set, read without a worktree", () => {
    it("unions the changed files across two story pull requests, read from their own diffs", () => {
        const origin = makeParent();
        sh(origin, "git", "init", "-q", "--bare");

        const work = makeParent();
        initRepo(work, origin);
        const trunk = writeCommit(work, "README.md", "root", "root");
        sh(work, "git", "push", "-q", "origin", "HEAD:main");

        sh(work, "git", "checkout", "-qb", "story-496");
        const head496 = writeCommit(work, "a.ts", "a", "story 496");
        sh(work, "git", "push", "-q", "origin", `${head496}:refs/pull/501/head`);

        sh(work, "git", "checkout", "-qb", "story-497", trunk);
        const head497 = writeCommit(work, "b.ts", "b", "story 497");
        sh(work, "git", "push", "-q", "origin", `${head497}:refs/pull/502/head`);

        const clone = makeParent();
        initRepo(clone, origin);
        sh(clone, "git", "fetch", "-q", "origin", "main");
        sh(clone, "git", "checkout", "-q", "main");

        const verdicts = [
            verdict({ story: 496, pr: 501, base: trunk, head: head496 }),
            verdict({ story: 497, pr: 502, base: trunk, head: head497 }),
        ];
        const r = combinedChangeSet(defaultRunner, clone, verdicts, []);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.combined.files).toEqual(["a.ts", "b.ts"]);
        expect(r.combined.perPr).toEqual([
            { repo: "acme/widget", pr: 501, files: ["a.ts"] },
            { repo: "acme/widget", pr: 502, files: ["b.ts"] },
        ]);
    });

    it("names the unfetchable pull request rather than silently omitting its code from the combined set", () => {
        const origin = makeParent();
        sh(origin, "git", "init", "-q", "--bare");
        const clone = makeParent();
        initRepo(clone, origin);
        writeCommit(clone, "README.md", "root", "root");

        const verdicts = [verdict({ story: 496, pr: 999, base: "a".repeat(40), head: "b".repeat(40) })];
        const r = combinedChangeSet(defaultRunner, clone, verdicts, []);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.message).toContain("999");
    });

    it("withholds a pipeline store from a per-pull-request change set through the caller's own exclusion pathspecs (invariant 5)", () => {
        const origin = makeParent();
        sh(origin, "git", "init", "-q", "--bare");

        const work = makeParent();
        initRepo(work, origin);
        const trunk = writeCommit(work, "README.md", "root", "root");
        sh(work, "git", "push", "-q", "origin", "HEAD:main");

        sh(work, "git", "checkout", "-qb", "story-496");
        fs.mkdirSync(path.join(work, ".nexus", "queue"), { recursive: true });
        fs.writeFileSync(path.join(work, ".nexus", "queue", "notes.md"), "scratch\n");
        fs.writeFileSync(path.join(work, "a.ts"), "a");
        sh(work, "git", "add", "-A");
        sh(work, "git", "commit", "-qm", "story 496");
        const head496 = sh(work, "git", "rev-parse", "HEAD");
        sh(work, "git", "push", "-q", "origin", `${head496}:refs/pull/501/head`);

        const clone = makeParent();
        initRepo(clone, origin);
        sh(clone, "git", "fetch", "-q", "origin", "main");
        sh(clone, "git", "checkout", "-q", "main");

        const verdicts = [verdict({ story: 496, pr: 501, base: trunk, head: head496 })];
        const r = combinedChangeSet(defaultRunner, clone, verdicts, [":(exclude).nexus/queue"]);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.combined.files).toEqual(["a.ts"]);
        expect(r.combined.perPr).toEqual([{ repo: "acme/widget", pr: 501, files: ["a.ts"] }]);
    });
});
