/**
 * Test support: a route-table fake Runner, plus real temp git repos.
 *
 * The harness's job is to make live GitHub calls, so its specs must be able to
 * simulate `gh` precisely — an existing scratch repo, a token missing
 * `delete_repo`, a PR with an analyze comment on it — without any network or any
 * GitHub side effect. Routes match on the joined command line and are tried in
 * order, so a spec states only the calls it cares about; anything unrouted fails
 * loudly rather than silently succeeding.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { type RunResult, type Runner } from "./run.js";

export interface Route {
    /** Substring (string) or pattern (RegExp) matched against `cmd arg arg …`. */
    match: string | RegExp;
    /** Merged over `{ status: 0, stdout: "", stderr: "" }`. */
    result?: Partial<RunResult>;
    /** When set, the route yields a different result on each successive match. */
    sequence?: Partial<RunResult>[];
}

export interface FakeRunner extends Runner {
    /** Every command line the code under test issued, in order. */
    calls: string[];
    /** The working directory each call ran in, parallel to `calls`. */
    cwds: string[];
}

/** git subcommands that can reach a remote. Never passed through unrouted. */
const NETWORK_GIT = new Set(["push", "clone", "pull", "ls-remote"]);

function isPassthroughSafe(cmd: string, args: string[]): boolean {
    if (cmd === "gh") return false;
    if (cmd === "git") return !args.some((a) => NETWORK_GIT.has(a));
    return true;
}

/**
 * `fallback` runs unrouted **local** commands (git, tar) for real, so a spec can
 * assert against a genuine repository while still simulating GitHub. An unrouted
 * `gh` call — or a git subcommand that can reach a remote — is NEVER passed
 * through: a spec that forgets a route must fail, not quietly hit the live API
 * with the maintainer's own credential.
 */
export function fakeRunner(routes: Route[], fallback?: Runner): FakeRunner {
    const calls: string[] = [];
    const cwds: string[] = [];
    const hits = new Map<Route, number>();
    const run = ((cmd: string, args: string[], opts: { cwd: string }): RunResult => {
        const line = [cmd, ...args].join(" ");
        calls.push(line);
        cwds.push(opts.cwd);
        for (const route of routes) {
            const hit = typeof route.match === "string" ? line.includes(route.match) : route.match.test(line);
            if (!hit) continue;
            const n = hits.get(route) ?? 0;
            hits.set(route, n + 1);
            const picked = route.sequence ? (route.sequence[Math.min(n, route.sequence.length - 1)] ?? {}) : route.result;
            return { status: 0, stdout: "", stderr: "", ...picked };
        }
        if (fallback && isPassthroughSafe(cmd, args)) return fallback(cmd, args, opts);
        return { status: 1, stdout: "", stderr: `fakeRunner: no route for: ${line}` };
    }) as FakeRunner;
    run.calls = calls;
    run.cwds = cwds;
    return run;
}

/** Commands the fake saw, filtered to those containing `needle`. */
export function callsMatching(run: FakeRunner, needle: string): string[] {
    return run.calls.filter((c) => c.includes(needle));
}

/** Working directories the matching calls ran in — the invariant that decides what they target. */
export function cwdsMatching(run: FakeRunner, needle: string): string[] {
    return run.cwds.filter((_, i) => run.calls[i].includes(needle));
}

export function sh(cwd: string, cmd: string, ...args: string[]): string {
    const r = spawnSync(cmd, args, { cwd, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
    return r.stdout.replace(/\n$/, "");
}

export function makeTempDir(tracked: string[], prefix = "nexus-pr-acc-"): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tracked.push(dir);
    return dir;
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

/** A working repo with a bare origin and a pushed `main`. */
export function repoWithOrigin(parent: string): { repo: string; origin: string; mainSha: string } {
    const origin = path.join(parent, "origin.git");
    fs.mkdirSync(origin, { recursive: true });
    sh(origin, "git", "init", "-q", "--bare", "-b", "main");
    const repo = path.join(parent, "work");
    initRepo(repo, origin);
    const mainSha = writeCommit(repo, "base.txt", "base\n", "C0");
    sh(repo, "git", "push", "-q", "-u", "origin", "main");
    return { repo, origin, mainSha };
}
