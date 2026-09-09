import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { deriveRepoIdentity } from "./identity";

function sh(cwd: string, cmd: string, ...args: string[]): string {
    const r = spawnSync(cmd, args, { cwd, encoding: "utf8" });
    if (r.status !== 0) {
        throw new Error(`${cmd} ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
    }
    return r.stdout.replace(/\n$/, "");
}

function initRepo(dir: string): void {
    fs.mkdirSync(dir, { recursive: true });
    sh(dir, "git", "init", "-q", "-b", "main");
    sh(dir, "git", "config", "user.email", "spec@example.com");
    sh(dir, "git", "config", "user.name", "spec");
}

describe("deriveRepoIdentity", () => {
    let tmpDirs: string[] = [];

    afterEach(() => {
        for (const dir of tmpDirs) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
        tmpDirs = [];
    });

    function makeRepo(): string {
        const parent = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-identity-"));
        tmpDirs.push(parent);
        const repo = path.join(parent, "repo");
        initRepo(repo);
        return repo;
    }

    it("derives identity from an SSH-form origin remote", () => {
        const repo = makeRepo();
        sh(repo, "git", "remote", "add", "origin", "git@github.com:acme/web-app.git");

        expect(deriveRepoIdentity(repo)).toEqual({
            identity: "github.com/acme/web-app",
            source: "origin",
        });
    });

    it("derives the same identity from an HTTPS-form origin remote", () => {
        const repo = makeRepo();
        sh(repo, "git", "remote", "add", "origin", "https://github.com/acme/web-app.git");

        expect(deriveRepoIdentity(repo)).toEqual({
            identity: "github.com/acme/web-app",
            source: "origin",
        });
    });

    it("falls back to the first remote when there is no origin", () => {
        const repo = makeRepo();
        sh(repo, "git", "remote", "add", "upstream", "git@github.com:acme/fork.git");

        expect(deriveRepoIdentity(repo)).toEqual({
            identity: "github.com/acme/fork",
            source: "first-remote",
        });
    });

    it("falls back to the directory name when there are no remotes at all", () => {
        const repo = makeRepo();

        expect(deriveRepoIdentity(repo)).toEqual({
            identity: path.basename(repo),
            source: "directory-name",
        });
    });
});
