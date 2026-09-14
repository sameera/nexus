import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
    canonicalRemote,
    canonicalRemoteName,
    canonicalRemoteUrl,
    canonicalRepoRef,
    canonicalTrunkRef,
} from "./canonical-remote";
import { defaultRunner } from "./run";

function sh(cwd: string, cmd: string, ...args: string[]): void {
    const r = spawnSync(cmd, args, { cwd, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
}

let tmpDirs: string[] = [];
afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs = [];
});

function makeRepo(remotes: Array<[string, string]>): string {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-canonical-remote-"));
    tmpDirs.push(parent);
    const repo = path.join(parent, "repo");
    fs.mkdirSync(repo, { recursive: true });
    sh(repo, "git", "init", "-q", "-b", "main");
    for (const [name, url] of remotes) sh(repo, "git", "remote", "add", name, url);
    return repo;
}

const FORK = "https://github.com/lead/docs.git";
const CANONICAL = "https://github.com/acme/docs.git";

describe("the remote a pull request is read from", () => {
    it("is upstream when the checkout declares one", () => {
        const repo = makeRepo([
            ["origin", FORK],
            ["upstream", CANONICAL],
        ]);

        expect(canonicalRemoteName(defaultRunner, repo)).toBe("upstream");
        expect(canonicalRemote(defaultRunner, repo)).toBe("upstream");
    });

    it("is origin when no upstream is declared", () => {
        const repo = makeRepo([["origin", CANONICAL]]);

        expect(canonicalRemoteName(defaultRunner, repo)).toBe("origin");
        expect(canonicalRemote(defaultRunner, repo)).toBe("origin");
    });

    it("is upstream even when it is the only remote", () => {
        const repo = makeRepo([["upstream", CANONICAL]]);

        expect(canonicalRemoteName(defaultRunner, repo)).toBe("upstream");
    });

    it("ignores a remote whose name merely contains 'upstream'", () => {
        const repo = makeRepo([
            ["origin", CANONICAL],
            ["upstream-mirror", FORK],
        ]);

        expect(canonicalRemoteName(defaultRunner, repo)).toBe("origin");
    });

    it("names nothing when the checkout has no remote at all, and still fetches under origin", () => {
        const repo = makeRepo([]);

        expect(canonicalRemoteName(defaultRunner, repo)).toBe(null);
        expect(canonicalRemote(defaultRunner, repo)).toBe("origin");
    });
});

describe("the URL and trunk ref that follow from it", () => {
    it("reads the upstream URL, not the fork's", () => {
        const repo = makeRepo([
            ["origin", FORK],
            ["upstream", CANONICAL],
        ]);

        expect(canonicalRemoteUrl(defaultRunner, repo)).toBe(CANONICAL);
        expect(canonicalTrunkRef(defaultRunner, repo)).toBe("upstream/main");
    });

    it("falls back to the origin URL and trunk when nothing else is declared", () => {
        const repo = makeRepo([["origin", CANONICAL]]);

        expect(canonicalRemoteUrl(defaultRunner, repo)).toBe(CANONICAL);
        expect(canonicalTrunkRef(defaultRunner, repo)).toBe("origin/main");
    });

    it("has no URL when the checkout has no remote", () => {
        const repo = makeRepo([]);

        expect(canonicalRemoteUrl(defaultRunner, repo)).toBe(null);
    });
});

describe("the repository reference gh is pointed at", () => {
    it("is the upstream repository, so gh and git read the same pull request", () => {
        const repo = makeRepo([
            ["origin", FORK],
            ["upstream", CANONICAL],
        ]);

        expect(canonicalRepoRef(defaultRunner, repo)).toBe("github.com/acme/docs");
    });

    it("carries a self-hosted forge's host through unchanged", () => {
        const repo = makeRepo([["origin", "git@git.acme.example:team/docs.git"]]);

        expect(canonicalRepoRef(defaultRunner, repo)).toBe("git.acme.example/team/docs");
    });

    it("is nothing for a remote that is not a forge repository", () => {
        const localMirror = makeRepo([]);
        const repo = makeRepo([["origin", localMirror]]);

        expect(canonicalRepoRef(defaultRunner, repo)).toBe(null);
    });

    it("is nothing when the checkout has no remote", () => {
        expect(canonicalRepoRef(defaultRunner, makeRepo([]))).toBe(null);
    });
});
