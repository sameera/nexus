/**
 * Test-support fixtures: real temp git repos with real merge topologies.
 *
 * Range derivation is only trustworthy if it is exercised against genuine squash,
 * merge-commit, and rebase histories, so these builders create them with real git
 * rather than mocking rev-parse. A bare "origin" lets the worktree fixtures test
 * `git fetch origin pull/<N>/head` and branch-from-trunk without a network.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export function sh(cwd: string, cmd: string, ...args: string[]): string {
    const r = spawnSync(cmd, args, { cwd, encoding: "utf8" });
    if (r.status !== 0) {
        throw new Error(`${cmd} ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
    }
    return r.stdout.replace(/\n$/, "");
}

export function makeParent(tracked: string[]): string {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-pr-wt-"));
    tracked.push(parent);
    return parent;
}

export function initRepo(dir: string, origin?: string): void {
    fs.mkdirSync(dir, { recursive: true });
    sh(dir, "git", "init", "-q", "-b", "main");
    sh(dir, "git", "config", "user.email", "spec@example.com");
    sh(dir, "git", "config", "user.name", "spec");
    if (origin) sh(dir, "git", "remote", "add", "origin", origin);
}

export function writeCommit(dir: string, file: string, content: string, msg: string): string {
    const full = path.join(dir, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
    sh(dir, "git", "add", "-A");
    sh(dir, "git", "commit", "-qm", msg);
    return sh(dir, "git", "rev-parse", "HEAD");
}

export interface Topology {
    repo: string;
    mergeCommit: string;
    prHead: string;
    baseRefOid: string;
    prCommitCount: number;
    /** Feature files expected in base...head (sorted). */
    expectedFiles: string[];
}

/** main advances to M1; a 2-commit feature is merged with --no-ff (true merge commit). */
export function buildMergeCommit(parent: string): Topology {
    const repo = path.join(parent, "merge-repo");
    initRepo(repo);
    const c0 = writeCommit(repo, "base.txt", "base\n", "C0");
    const m1 = writeCommit(repo, "m1.txt", "m1\n", "M1");
    sh(repo, "git", "checkout", "-q", "-b", "feature", c0);
    writeCommit(repo, "f1.txt", "f1\n", "F1");
    const prHead = writeCommit(repo, "f2.txt", "f2\n", "F2");
    sh(repo, "git", "checkout", "-q", "main");
    sh(repo, "git", "merge", "--no-ff", "-q", "-m", "Merge feature", "feature");
    const mergeCommit = sh(repo, "git", "rev-parse", "HEAD");
    return { repo, mergeCommit, prHead, baseRefOid: m1, prCommitCount: 2, expectedFiles: ["f1.txt", "f2.txt"] };
}

/** A 2-commit feature squash-merged onto main (single new commit, 1 parent). */
export function buildSquash(parent: string): Topology {
    const repo = path.join(parent, "squash-repo");
    initRepo(repo);
    const c0 = writeCommit(repo, "base.txt", "base\n", "C0");
    sh(repo, "git", "checkout", "-q", "-b", "feature", c0);
    writeCommit(repo, "f1.txt", "f1\n", "F1");
    const prHead = writeCommit(repo, "f2.txt", "f2\n", "F2");
    sh(repo, "git", "checkout", "-q", "main");
    sh(repo, "git", "merge", "--squash", "feature");
    sh(repo, "git", "commit", "-qm", "Squash feature (#1)");
    const mergeCommit = sh(repo, "git", "rev-parse", "HEAD");
    return { repo, mergeCommit, prHead, baseRefOid: c0, prCommitCount: 2, expectedFiles: ["f1.txt", "f2.txt"] };
}

/** main advances to M1; a 2-commit feature rebase-merged (replayed as 2 new commits). */
export function buildRebase(parent: string): Topology {
    const repo = path.join(parent, "rebase-repo");
    initRepo(repo);
    const c0 = writeCommit(repo, "base.txt", "base\n", "C0");
    const m1 = writeCommit(repo, "m1.txt", "m1\n", "M1");
    sh(repo, "git", "checkout", "-q", "-b", "feature", c0);
    const f1 = writeCommit(repo, "f1.txt", "f1\n", "F1");
    const prHead = writeCommit(repo, "f2.txt", "f2\n", "F2");
    sh(repo, "git", "checkout", "-q", "main");
    // Rebase-merge = replay the feature commits onto the current base tip as new commits.
    sh(repo, "git", "cherry-pick", f1, prHead);
    const mergeCommit = sh(repo, "git", "rev-parse", "HEAD");
    return { repo, mergeCommit, prHead, baseRefOid: m1, prCommitCount: 2, expectedFiles: ["f1.txt", "f2.txt"] };
}

/** A repo with a bare origin; main is pushed. Returns both paths. */
export function buildRepoWithOrigin(parent: string): { repo: string; origin: string; mainSha: string } {
    const origin = path.join(parent, "origin.git");
    fs.mkdirSync(origin, { recursive: true });
    sh(origin, "git", "init", "-q", "--bare", "-b", "main");
    const repo = path.join(parent, "work");
    initRepo(repo, origin);
    const mainSha = writeCommit(repo, "base.txt", "base\n", "C0");
    sh(repo, "git", "push", "-q", "-u", "origin", "main");
    return { repo, origin, mainSha };
}
