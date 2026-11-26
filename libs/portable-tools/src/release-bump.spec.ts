/**
 * The release-bump check. A branch that changes what ships must also move the version in
 * `package.json`, or carry a `Nexus-No-Bump:` trailer saying why it needs none. It replaces the
 * fingerprint pin, whose only remaining effect was this pause.
 *
 * Every case runs against a scratch git repository with a `main` branch standing in for
 * `origin/main`, so the outcome depends on the commits each case makes, not on this checkout.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkReleaseBump } from "./release-bump";

const REPO_ROOT: string = path.resolve(__dirname, "../../..");

let tmpDirs: string[] = [];

afterEach(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});

function git(repo: string, ...args: string[]): string {
    return execFileSync("git", args, {
        cwd: repo,
        encoding: "utf8",
        env: {
            ...process.env,
            GIT_AUTHOR_NAME: "t",
            GIT_AUTHOR_EMAIL: "t@example.com",
            GIT_COMMITTER_NAME: "t",
            GIT_COMMITTER_EMAIL: "t@example.com",
        },
    });
}

function write(repo: string, rel: string, content: string): void {
    const abs: string = path.join(repo, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
}

function setVersion(repo: string, version: string): void {
    write(repo, "package.json", JSON.stringify({ name: "scratch", version }, null, 4) + "\n");
}

function commitAll(repo: string, message: string): void {
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", message);
}

/** A repository whose `main` holds one release, with a feature branch checked out on top. */
function scratchRepo(): string {
    const repo: string = fs.mkdtempSync(path.join(os.tmpdir(), "release-bump-"));
    tmpDirs.push(repo);
    git(repo, "init", "-q", "-b", "main");
    setVersion(repo, "1.0.0");
    write(repo, "components/commands/nxs.epic.md", "plan an epic\n");
    write(repo, "libs/close/src/close.ts", "export const close = 1;\n");
    write(repo, "README.md", "readme\n");
    commitAll(repo, "release 1.0.0");
    git(repo, "switch", "-q", "-c", "feature");
    return repo;
}

describe("a branch that changes what ships must move the version", () => {
    it("fails when a component changed and the version did not, naming the file", () => {
        const repo: string = scratchRepo();
        write(repo, "components/commands/nxs.epic.md", "plan an epic, differently\n");
        commitAll(repo, "change a stage");

        const result = checkReleaseBump(repo, "main");

        expect(result.status).toBe("fail");
        expect(result.message).toContain("components/commands/nxs.epic.md");
        expect(result.message).toContain("Nexus-No-Bump");
    });

    it("fails when library source changed and the version did not", () => {
        const repo: string = scratchRepo();
        write(repo, "libs/close/src/close.ts", "export const close = 2;\n");
        commitAll(repo, "change close");

        expect(checkReleaseBump(repo, "main").status).toBe("fail");
    });

    it("fails on uncommitted and untracked shipped changes, before anything is committed", () => {
        const repo: string = scratchRepo();
        write(repo, "components/skills/new-skill/SKILL.md", "a new skill\n");

        const result = checkReleaseBump(repo, "main");

        expect(result.status).toBe("fail");
        expect(result.message).toContain("components/skills/new-skill/SKILL.md");
    });

    it("passes when the version moved with the change", () => {
        const repo: string = scratchRepo();
        write(repo, "components/commands/nxs.epic.md", "plan an epic, differently\n");
        setVersion(repo, "1.1.0");
        commitAll(repo, "change a stage (1.1.0)");

        expect(checkReleaseBump(repo, "main").status).toBe("pass");
    });

    it("passes when only tests, fixtures or docs changed", () => {
        const repo: string = scratchRepo();
        write(repo, "libs/close/src/close.spec.ts", "test\n");
        write(repo, "libs/close/src/fixtures/case.md", "fixture\n");
        write(repo, "README.md", "readme, edited\n");
        commitAll(repo, "tests and docs");

        expect(checkReleaseBump(repo, "main").status).toBe("pass");
    });

    it("passes on the base branch itself, where nothing is ahead of it", () => {
        const repo: string = scratchRepo();
        git(repo, "switch", "-q", "main");

        expect(checkReleaseBump(repo, "main").status).toBe("pass");
    });
});

describe("a lead can waive the bump in the open", () => {
    it("passes when a commit on the branch carries a Nexus-No-Bump trailer, and reports the reason", () => {
        const repo: string = scratchRepo();
        write(repo, "components/commands/nxs.epic.md", "plan an epic (typo fixed)\n");
        git(repo, "add", "-A");
        git(repo, "commit", "-q", "-m", "fix a typo", "-m", "Nexus-No-Bump: typo fix, no stage behaviour change");

        const result = checkReleaseBump(repo, "main");

        expect(result.status).toBe("pass");
        expect(result.message).toContain("typo fix, no stage behaviour change");
    });

    it("does not count a waiver that is only in the body, not a trailer", () => {
        const repo: string = scratchRepo();
        write(repo, "components/commands/nxs.epic.md", "plan an epic (typo fixed)\n");
        git(repo, "add", "-A");
        git(repo, "commit", "-q", "-m", "fix a typo", "-m", "Mentions Nexus-No-Bump: in prose.\nThen keeps going.");

        expect(checkReleaseBump(repo, "main").status).toBe("fail");
    });
});

describe("the check skips, rather than fails, when it has no base to compare against", () => {
    it("skips and says why when the base ref does not exist", () => {
        const repo: string = scratchRepo();
        write(repo, "components/commands/nxs.epic.md", "changed\n");

        const result = checkReleaseBump(repo, "origin/main");

        expect(result.status).toBe("skip");
        expect(result.message).toContain("origin/main");
    });
});

describe("this checkout", () => {
    it("does not change what ships without moving the version or waiving the bump", (ctx) => {
        const result = checkReleaseBump(REPO_ROOT, "origin/main");
        if (result.status === "skip") {
            ctx.skip(result.message);
        }
        expect(result.status, result.message).toBe("pass");
    });
});
