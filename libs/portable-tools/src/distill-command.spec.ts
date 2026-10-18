/**
 * `nexus distill --pr <N>` (epic #909, story #910, decision record #946: D1, D4, D5, D8, D9, D10).
 *
 * Every platform read and the session are stand-ins, so these specs read what a lead sees — the
 * printed lines, the run folder's files and the exit code — never how a check is computed. One
 * group runs a real session against a stub harness on the PATH.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { spawn, spawnSync } from "node:child_process";
import { condenseEvent, detachRunner, distillDeps, PLAN_ENV, runDetached, runDistillCommand, runFiles, spawnSession, type DistillDeps, type DistillInput, type DistillPlan, type SessionEnd, type SessionSpec } from "./distill-command.js";
import { runNexusCli } from "./nexus-cli.js";

const tmp: string[] = [];
afterEach(() => {
    for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
function makeDir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-distill-"));
    tmp.push(d);
    return d;
}

const EPIC = 830;
const PR = 901;
const BRANCH = `distill/2026-10-04-epic-${EPIC}`;
const URL = "https://github.com/acme/app/pull/950";

interface Harness {
    deps: DistillDeps;
    mainRoot: string;
    wtPath: string;
    sessions: SessionSpec[];
}

/** Every check passes and the session opens a distillation pull request, unless a spec overrides a dep. */
function harness(over: Partial<DistillDeps> = {}, end: SessionEnd = { started: true, exitCode: 0, error: null, finalMessage: "opened it" }): Harness {
    const mainRoot = makeDir();
    const wtPath = makeDir();
    const h: Harness = { deps: {} as DistillDeps, mainRoot, wtPath, sessions: [] };
    let opened = false;
    h.deps = {
        role: () => ({ ok: true, preflight: { role: "single-repo", repoRoot: mainRoot, repo: { identity: "acme/app", source: "origin" } as never } }),
        epicOfPr: () => ({ ok: true, epic: EPIC, issuesRepo: "acme/app" }),
        issuesRepo: () => ({ ok: true, issuesRepo: "acme/app" }),
        epicClosed: () => ({ ok: true, closed: true }),
        branchPushed: () => ({ ok: true, pushed: true }),
        findBranch: () => ({ ok: true, branch: BRANCH, source: "local" }),
        worktreeOn: () => wtPath,
        mainCheckout: () => mainRoot,
        commonGitDir: () => path.join(mainRoot, ".git"),
        ignored: () => true,
        onPath: () => true,
        openPr: () => ({ ok: true, url: opened ? URL : null }),
        alive: (pid) => pid === process.pid,
        detach: async () => ({ ok: true, pid: 4242 }),
        session: async (spec, line) => {
            h.sessions.push(spec);
            line("working");
            opened = end.started && end.finalMessage === "opened it";
            return end;
        },
        ...over,
    };
    return h;
}

/** GitHub shows no open pull request before the session, then `read` after it. */
function afterSession(read: ReturnType<DistillDeps["openPr"]>): DistillDeps["openPr"] {
    let calls = 0;
    return () => (calls++ === 0 ? { ok: true, url: null } : read);
}

function input(over: Partial<DistillInput> = {}): DistillInput {
    return { cwd: "/somewhere", target: { kind: "pr", pr: { repo: null, number: PR } }, harness: "claude", permissionMode: null, harnessArgs: [], ...over };
}

async function run(h: Harness, over: Partial<DistillInput> = {}): Promise<{ code: number; out: string; err: string }> {
    const out: string[] = [];
    const err: string[] = [];
    const code = await runDistillCommand(h.deps, input(over), { stdout: (l) => out.push(l), stderr: (l) => err.push(l) });
    return { code, out: out.join("\n"), err: err.join("\n") };
}

describe("nexus distill — a closed epic distills with one command (AC1, D1, G8, G9, G11)", () => {
    it("runs the unattended distillation in the close worktree, asking nothing, and prints the pull request's URL", async () => {
        const h = harness();
        const { code, out } = await run(h);
        expect(code).toBe(0);
        expect(out).toContain(URL);
        expect(h.sessions).toHaveLength(1);
        expect(h.sessions[0].cwd).toBe(h.wtPath);
        expect(h.sessions[0].args.join(" ")).toContain("/nxs.distill --unattended");
    });

    it("gives the session fixed text only, whatever pull request it was started for (G9)", async () => {
        const a = harness();
        const b = harness();
        await run(a, { target: { kind: "pr", pr: { repo: null, number: 1 } } });
        await run(b, { target: { kind: "pr", pr: { repo: "acme/app", number: 777 } } });
        const prompt = (h: Harness): string => h.sessions[0].args[h.sessions[0].args.indexOf("-p") + 1];
        expect(prompt(a)).toBe(prompt(b));
        expect(prompt(a)).not.toMatch(/777|acme/);
    });

    it("writes the log, the outcome and the final message into an ignored folder of the main checkout (D5, G18)", async () => {
        const h = harness();
        const { out } = await run(h);
        const dir = path.join(h.mainRoot, ".nexus", "tmp", `distill-run-epic-${EPIC}`);
        expect(fs.readFileSync(path.join(dir, "outcome.txt"), "utf8")).toContain(URL);
        expect(fs.readFileSync(path.join(dir, "distill.log"), "utf8")).toContain("working");
        expect(fs.readFileSync(path.join(dir, "distill-final.txt"), "utf8")).toContain("opened it");
        expect(out).toContain(path.join(dir, "outcome.txt"));
        expect(path.basename(dir)).not.toMatch(/^(epic|fix|intake)-\d+$/);
    });

    it("refuses before any session when git does not ignore the run folder (G18)", async () => {
        const h = harness({ ignored: () => false });
        const { code, err } = await run(h);
        expect(code).not.toBe(0);
        expect(err).toContain(".gitignore");
        expect(h.sessions).toHaveLength(0);
    });
});

describe("nexus distill — success is read from GitHub only (AC2, AC3, D4, G12, G13)", () => {
    it("reports a stop with the distillation's final message, and exits non-zero, when no pull request opened", async () => {
        const h = harness({}, { started: true, exitCode: 0, error: null, finalMessage: "BLOCKED: forced taxonomy fit" });
        const { code, out } = await run(h);
        expect(code).not.toBe(0);
        expect(out).toMatch(/no distillation pull request was opened/);
        expect(out).toContain("BLOCKED: forced taxonomy fit");
        expect(out).not.toContain("distillation pull request: http");
    });

    it("reports a stop when the session ended cleanly but GitHub shows no open pull request (AC3)", async () => {
        const h = harness({ openPr: () => ({ ok: true, url: null }) });
        const { code, out } = await run(h);
        expect(code).not.toBe(0);
        expect(out).toMatch(/stopped/);
    });

    it("reports an unconfirmed outcome, never success, when GitHub cannot be read", async () => {
        const h = harness({ openPr: afterSession({ ok: false, message: "HTTP 502" }) });
        const { code, out } = await run(h);
        expect(code).not.toBe(0);
        expect(out).toMatch(/unconfirmed/);
        expect(out).toContain("HTTP 502");
    });

    it("reports a session that could not start as a stop", async () => {
        const h = harness({}, { started: false, exitCode: null, error: "spawn claude ENOENT", finalMessage: null });
        const { code, out } = await run(h);
        expect(code).not.toBe(0);
        expect(out).toContain("could not start");
    });

    it("reports a session that could not start as a stop, even when a pull request is open by then (G13)", async () => {
        const h = harness({ openPr: afterSession({ ok: true, url: URL }) }, { started: false, exitCode: null, error: "spawn claude ENOENT", finalMessage: null });
        const { code, out } = await run(h);
        expect(code).not.toBe(0);
        expect(out).toContain("could not start");
        expect(out).not.toMatch(/after the pull request opened/);
    });

    it("reports success, noting the error, when the session opened the pull request and then failed", async () => {
        const h = harness({ openPr: afterSession({ ok: true, url: URL }) }, { started: true, exitCode: 1, error: "crashed", finalMessage: null });
        const { code, out } = await run(h);
        expect(code).toBe(0);
        expect(out).toContain(URL);
        expect(out).toContain("crashed");
    });
});

describe("nexus distill — the cleanup command and the permission mode (AC4, D9, D10, G10, G14)", () => {
    it("names nexus distill cleanup N whether the run succeeded or stopped", async () => {
        for (const h of [harness(), harness({ openPr: () => ({ ok: true, url: null }) })]) {
            const { out } = await run(h);
            expect(out).toContain(`nexus distill cleanup `);
        }
    });

    it("prints the permission mode before the session starts, bypass by default for claude", async () => {
        const h = harness();
        const { err } = await run(h);
        expect(err).toContain("bypassPermissions");
        expect(h.sessions[0].args).toEqual(expect.arrayContaining(["--permission-mode", "bypassPermissions"]));
    });

    it("runs one session under the mode the lead names, and prints that mode", async () => {
        const h = harness();
        const { err } = await run(h, { permissionMode: "acceptEdits" });
        expect(err).toContain("acceptEdits");
        expect(h.sessions[0].args).toEqual(expect.arrayContaining(["--permission-mode", "acceptEdits"]));
        expect(h.sessions[0].args).not.toContain("bypassPermissions");
    });
});

describe("nexus distill — codex (D8, G27)", () => {
    it("runs codex exec in the worktree under the workspace-write sandbox, with the shared git folder writable", async () => {
        const h = harness();
        const { err } = await run(h, { harness: "codex" });
        const spec = h.sessions[0];
        expect(spec.command).toBe("codex");
        expect(spec.cwd).toBe(h.wtPath);
        expect(spec.args).toEqual(expect.arrayContaining(["exec", "--sandbox", "workspace-write", "--add-dir", path.join(h.mainRoot, ".git")]));
        expect(spec.args[spec.args.length - 1]).toContain("$nxs-distill --unattended");
        expect(err).toContain("workspace-write");
    });

    it("refuses before any session when the harness is not on the PATH", async () => {
        const h = harness({ onPath: () => false });
        const { code, err } = await run(h, { harness: "codex" });
        expect(code).not.toBe(0);
        expect(err).toContain("codex");
        expect(h.sessions).toHaveLength(0);
    });
});

describe("nexus distill — refusals before a session starts (story #911, D2, D3, D4)", () => {
    /** A refusal: non-zero, no session, and no run folder written (G7). */
    async function refused(h: Harness, over: Partial<DistillInput> = {}): Promise<string> {
        const { code, err } = await run(h, over);
        expect(code).not.toBe(0);
        expect(h.sessions).toHaveLength(0);
        expect(fs.existsSync(path.join(h.mainRoot, ".nexus"))).toBe(false);
        expect(err).toContain("No session was started");
        return err;
    }

    it("refuses while the epic is still open, naming nexus close --pr <N> (AC1, G2)", async () => {
        const err = await refused(harness({ epicClosed: () => ({ ok: true, closed: false }) }));
        expect(err).toMatch(/still open/);
        expect(err).toContain(`nexus close --pr ${PR}`);
    });

    it("passes on close's own stop for a pull request that has not merged (G2)", async () => {
        const stop = { reason: "pull request 901 is not merged (it is open)", item: "pr", remedy: `merge it, then re-run nexus close --pr ${PR}` };
        let rerun = "";
        const err = await refused(harness({ epicOfPr: (_r, _p, again) => ((rerun = again), { ok: false, stop }) }));
        expect(rerun).toBe(`nexus close --pr ${PR}`);
        expect(err).toContain("not merged");
        expect(err).toContain(`nexus close --pr ${PR}`);
    });

    it("names a missing distillation branch apart from a missing worktree, with nexus close --pr <N> as the remedy (AC2, G3)", async () => {
        const noBranch = await refused(harness({ findBranch: () => ({ ok: true, branch: null }) }));
        expect(noBranch).toMatch(/no distillation branch/);
        expect(noBranch).toContain(`nexus close --pr ${PR}`);
        const noWorktree = await refused(harness({ worktreeOn: () => null }));
        expect(noWorktree).toMatch(/no worktree/);
        expect(noWorktree).toContain(BRANCH);
        expect(noWorktree).toContain(`nexus close --pr ${PR}`);
    });

    it("refuses when the distillation branch is not pushed, naming the branch (AC3, G4)", async () => {
        const err = await refused(harness({ branchPushed: () => ({ ok: true, pushed: false }) }));
        expect(err).toMatch(/not pushed/);
        expect(err).toContain(BRANCH);
    });

    it("refuses in a hub or a member checkout, naming the manual route (AC4, G1)", async () => {
        for (const role of ["hub", "member"] as const) {
            const h = harness({ role: () => ({ ok: true, preflight: { role, repoRoot: "/r", repo: { identity: "acme/app", source: "origin" } as never } }) });
            let resolved = false;
            h.deps.epicOfPr = () => ((resolved = true), { ok: true, epic: EPIC, issuesRepo: "acme/app" });
            const err = await refused(h);
            expect(err).toContain("/nxs.distill <worktree-path>");
            expect(resolved).toBe(false);
        }
    });

    it("refuses when a distillation pull request from the branch is already open, printing its URL (D4, G5)", async () => {
        const err = await refused(harness({ openPr: () => ({ ok: true, url: URL }) }));
        expect(err).toContain(URL);
        expect(err).toMatch(/already open/);
    });

    it("runs the cheap checks before the GitHub reads: a hub is refused without resolving anything (D3)", async () => {
        const reads: string[] = [];
        const h = harness({
            role: () => ({ ok: true, preflight: { role: "hub", repoRoot: "/r", repo: { identity: "acme/app", source: "origin" } as never } }),
            epicClosed: () => (reads.push("epic"), { ok: true, closed: true }),
            openPr: () => (reads.push("pr"), { ok: true, url: null }),
        });
        await refused(h);
        expect(reads).toEqual([]);
    });

    it("reads the epic state and the push remote through gh and git", () => {
        const calls: string[][] = [];
        const deps = distillDeps((cmd, args) => (calls.push([cmd, ...args]), cmd === "git" ? { status: 2, stdout: "", stderr: "" } : { status: 0, stdout: "CLOSED\n", stderr: "" }));
        expect(deps.epicClosed("/r", "acme/app", EPIC)).toEqual({ ok: true, closed: true });
        expect(deps.branchPushed("/r", BRANCH)).toEqual({ ok: true, pushed: false });
        expect(calls[0]).toEqual(expect.arrayContaining(["gh", "issue", "view", String(EPIC), "--repo", "acme/app"]));
        expect(calls[1]).toEqual(expect.arrayContaining(["git", "ls-remote", `refs/heads/${BRANCH}`]));
    });
});

describe("nexus distill --background (story #912, D5, D6, D7)", () => {
    function plan(h: Harness): DistillPlan {
        return {
            pr: PR,
            epic: EPIC,
            issuesRepo: "acme/app",
            branch: BRANCH,
            wtPath: h.wtPath,
            mainRoot: h.mainRoot,
            files: runFiles(h.mainRoot, EPIC),
            spec: { command: "claude", args: [], cwd: h.wtPath },
            permissionMode: "bypassPermissions",
        };
    }

    it("returns once the detached runner has started, naming where the log and the outcome will be written (AC1, G16)", async () => {
        let detached: DistillPlan | null = null;
        const h = harness({ detach: async (p) => ((detached = p), { ok: true, pid: 4242 }) });
        const { code, out } = await run(h, { background: true });
        expect(code).toBe(0);
        expect(h.sessions).toHaveLength(0);
        const files = runFiles(h.mainRoot, EPIC);
        expect(out).toContain(files.log);
        expect(out).toContain(files.outcome);
        expect(detached).not.toBeNull();
        expect(fs.readFileSync(files.marker, "utf8").trim()).toBe("4242");
    });

    it("refuses a second start while a run for the same pull request is in progress, naming where its outcome will be written (G6)", async () => {
        const h = harness({ alive: () => true });
        const files = runFiles(h.mainRoot, EPIC);
        fs.mkdirSync(files.dir, { recursive: true });
        fs.writeFileSync(files.marker, "4242\n");
        const { code, err } = await run(h);
        expect(code).not.toBe(0);
        expect(err).toMatch(/still in progress/);
        expect(err).toContain(files.outcome);
        expect(h.sessions).toHaveLength(0);
    });

    it("refuses a start that loses the race for the marker to another run started at the same instant (G6)", async () => {
        const h = harness({ alive: (pid) => pid === 4242 });
        const files = runFiles(h.mainRoot, EPIC);
        const onPath = h.deps.onPath;
        h.deps.onPath = (command) => {
            fs.mkdirSync(files.dir, { recursive: true });
            fs.writeFileSync(files.marker, "4242\n");
            return onPath(command);
        };
        const { code, err } = await run(h);
        expect(code).not.toBe(0);
        expect(err).toMatch(/still in progress/);
        expect(h.sessions).toHaveLength(0);
        expect(fs.readFileSync(files.marker, "utf8").trim()).toBe("4242");
    });

    it("is not blocked by a marker whose process no longer exists (G6)", async () => {
        const h = harness({ alive: () => false });
        const files = runFiles(h.mainRoot, EPIC);
        fs.mkdirSync(files.dir, { recursive: true });
        fs.writeFileSync(files.marker, "4242\n");
        const { code } = await run(h);
        expect(code).toBe(0);
        expect(fs.existsSync(files.marker)).toBe(false);
    });

    it("writes the same outcome in the background as in the foreground (AC2, G17, G21)", async () => {
        const fg = harness();
        await run(fg);
        const bg = harness();
        await runDetached(bg.deps, plan(bg), () => undefined, 60_000);
        const read = (h: Harness): string => fs.readFileSync(runFiles(h.mainRoot, EPIC).outcome, "utf8").replaceAll(h.wtPath, "<wt>");
        expect(read(bg)).toBe(read(fg));
        expect(read(bg)).toContain(URL);
        expect(read(bg)).toContain(`nexus distill cleanup `);
    });

    it("states the stop and the final message when a background run opens no pull request (AC2, G17)", async () => {
        const h = harness({}, { started: true, exitCode: 0, error: null, finalMessage: "BLOCKED: hash mismatch" });
        const lines: string[] = [];
        const outcome = await runDetached(h.deps, plan(h), (l) => lines.push(l), 60_000);
        expect(outcome.success).toBe(false);
        expect(fs.readFileSync(runFiles(h.mainRoot, EPIC).outcome, "utf8")).toContain("BLOCKED: hash mismatch");
        expect(lines[lines.length - 1]).toMatch(/stopped/);
    });

    it("sends the terminal a status line at each interval and a final line when the run ends (AC4, G19)", async () => {
        const h = harness({
            session: async () => {
                await new Promise((r) => setTimeout(r, 120));
                return { started: true, exitCode: 0, error: null, finalMessage: "opened it" };
            },
            openPr: afterSession({ ok: true, url: URL }),
        });
        h.deps.openPr({} as never, BRANCH);
        const lines: string[] = [];
        await runDetached(h.deps, plan(h), (l) => lines.push(l), 25);
        expect(lines.filter((l) => /still running/.test(l)).length).toBeGreaterThanOrEqual(2);
        expect(lines[lines.length - 1]).toContain(URL);
        expect(lines[lines.length - 1]).toContain(`nexus distill cleanup ${EPIC}`);
    });

    it("keeps running and writes its outcome when the terminal can no longer be written to (G20)", async () => {
        const h = harness({
            session: async () => {
                await new Promise((r) => setTimeout(r, 80));
                return { started: true, exitCode: 0, error: null, finalMessage: "x" };
            },
        });
        let writes = 0;
        const outcome = await runDetached(h.deps, plan(h), () => {
            writes += 1;
            throw new Error("EIO");
        }, 10);
        expect(writes).toBe(1);
        expect(outcome.success).toBe(false);
        expect(fs.existsSync(runFiles(h.mainRoot, EPIC).outcome)).toBe(true);
    });

    it("writes nothing git reports as a change, in the main checkout or the worktree (AC3, G18)", async () => {
        const repo = makeDir();
        const g = (...args: string[]): string => spawnSync("git", args, { cwd: repo, encoding: "utf8" }).stdout;
        g("init", "-q");
        fs.writeFileSync(path.join(repo, ".gitignore"), ".nexus/tmp/\n");
        g("add", ".gitignore");
        g("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init");
        const wt = path.join(makeDir(), "wt");
        g("worktree", "add", "-q", "-b", BRANCH, wt);
        const real = distillDeps((cmd, args, opts) => {
            const r = spawnSync(cmd, args, { cwd: opts.cwd, encoding: "utf8" });
            return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
        });
        const h = harness({ mainCheckout: () => real.mainCheckout(wt), ignored: real.ignored, worktreeOn: () => wt });
        await runDetached(h.deps, { ...plan(h), mainRoot: real.mainCheckout(wt), wtPath: wt, files: runFiles(real.mainCheckout(wt), EPIC) }, () => undefined, 60_000);
        expect(fs.existsSync(path.join(fs.realpathSync(repo), ".nexus", "tmp", `distill-run-epic-${EPIC}`, "outcome.txt"))).toBe(true);
        expect(g("status", "--porcelain")).toBe("");
        expect(spawnSync("git", ["status", "--porcelain"], { cwd: wt, encoding: "utf8" }).stdout).toBe("");
    });

    it("starts a detached runner that outlives its parent and receives the plan", async () => {
        const dir = makeDir();
        const out = path.join(dir, "got.json");
        const script = path.join(dir, "runner.cjs");
        fs.writeFileSync(script, `require("fs").writeFileSync(${JSON.stringify(out)}, JSON.stringify({ args: process.argv.slice(2), plan: JSON.parse(process.env.${PLAN_ENV}) }));`);
        const h = harness();
        const started = await detachRunner(plan(h), { command: process.execPath, args: [script] });
        expect(started.ok).toBe(true);
        for (let i = 0; i < 100 && !fs.existsSync(out); i++) await new Promise((r) => setTimeout(r, 20));
        const got = JSON.parse(fs.readFileSync(out, "utf8")) as { args: string[]; plan: DistillPlan };
        expect(got.args).toEqual(["distill", "--detached-runner"]);
        expect(got.plan.pr).toBe(PR);
    });
});

describe("nexus distill — a real session against a stub harness", () => {
    function stubHarness(dir: string, body: string): void {
        fs.writeFileSync(path.join(dir, "claude"), `#!/usr/bin/env node\n${body}\n`, { mode: 0o755 });
    }

    it("starts the harness in the worktree with the unattended flag, and keeps its final message", async () => {
        const bin = makeDir();
        const wt = makeDir();
        const seen = path.join(bin, "seen.json");
        stubHarness(
            bin,
            `require("fs").writeFileSync(${JSON.stringify(seen)}, JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2) }));
console.log(JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", input: { command: "git status" } }] } }));
console.log(JSON.stringify({ type: "result", subtype: "success", num_turns: 3, duration_ms: 60000, result: "Distillation PR opened" }));`,
        );
        const lines: string[] = [];
        const end = await spawnSession({ command: path.join(bin, "claude"), args: ["-p", "/nxs.distill --unattended"], cwd: wt }, (l) => lines.push(l));
        expect(end).toMatchObject({ started: true, exitCode: 0, error: null, finalMessage: "Distillation PR opened" });
        const got = JSON.parse(fs.readFileSync(seen, "utf8")) as { cwd: string; args: string[] };
        expect(fs.realpathSync(got.cwd)).toBe(fs.realpathSync(wt));
        expect(got.args.join(" ")).toContain("--unattended");
        expect(lines.join("\n")).toContain("Bash(git status)");
    });

    it("reports a harness that cannot be run as not started", async () => {
        const end = await spawnSession({ command: path.join(makeDir(), "missing"), args: [], cwd: makeDir() }, () => undefined);
        expect(end.started).toBe(false);
        expect(end.error).not.toBeNull();
    });

    it("keeps a session's reported error", () => {
        expect(condenseEvent(JSON.stringify({ type: "result", subtype: "error", is_error: true, result: "boom", num_turns: 1, duration_ms: 1 })).error).toBe("boom");
        expect(condenseEvent(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "codex done" } })).final).toBe("codex done");
        expect(condenseEvent("plain text").lines).toEqual(["plain text"]);
    });

    it("reads the open pull request from the worktree, through gh", () => {
        const calls: { args: string[]; cwd: string }[] = [];
        const deps = distillDeps((cmd, args, opts) => (calls.push({ args: [cmd, ...args], cwd: opts.cwd }), { status: 0, stdout: `${URL}\n`, stderr: "" }));
        expect(deps.openPr("/wt", BRANCH)).toEqual({ ok: true, url: URL });
        expect(calls[0]).toMatchObject({ cwd: "/wt" });
        expect(calls[0].args).toEqual(expect.arrayContaining(["gh", "pr", "list", "--head", BRANCH, "--state", "open"]));
    });
});

describe("nexus distill — a closed epic is named by its number (AC1, AC4, AC5, D1, D2, D4, G2, G5, G7)", () => {
    const BY_EPIC: DistillInput["target"] = { kind: "epic", epic: EPIC };

    it("runs the same unattended session for the epic as for a pull request of it, without reading a pull request (AC1, G1)", async () => {
        const h = harness({
            epicOfPr: () => {
                throw new Error("a pull request was read");
            },
        });
        const { code, out } = await run(h, { target: BY_EPIC });
        expect(code).toBe(0);
        expect(out).toContain(URL);
        expect(h.sessions).toHaveLength(1);
        expect(h.sessions[0].cwd).toBe(h.wtPath);
        expect(h.sessions[0].args.join(" ")).toContain("/nxs.distill --unattended");
    });

    it("refuses an open epic before any session, naming nexus close --epic N (G2)", async () => {
        const h = harness({ epicClosed: () => ({ ok: true, closed: false }) });
        const { code, err } = await run(h, { target: BY_EPIC });
        expect(code).not.toBe(0);
        expect(err).toContain(`nexus close --epic ${EPIC}`);
        expect(h.sessions).toHaveLength(0);
    });

    it("names its own re-run as --epic N in a refusal from an epic start (D4, G7)", async () => {
        const h = harness({ epicClosed: () => ({ ok: false, message: "rate limited" }) });
        const { err } = await run(h, { target: BY_EPIC });
        expect(err).toContain(`nexus distill --epic ${EPIC}`);
    });

    it("refuses a second start for the same epic whichever form each start used (AC4, G5)", async () => {
        const h = harness();
        const files = runFiles(h.mainRoot, EPIC);
        fs.mkdirSync(files.dir, { recursive: true });
        fs.writeFileSync(files.marker, `${process.pid}\n`);
        for (const target of [BY_EPIC, { kind: "pr", pr: { repo: null, number: PR } }] as const) {
            const { code, err } = await run(h, { target });
            expect(code).not.toBe(0);
            expect(err).toContain("still in progress");
        }
        expect(h.sessions).toHaveLength(0);
    });
});

describe("nexus distill — arguments", () => {
    async function cli(argv: string[]): Promise<{ code: number; err: string }> {
        const err: string[] = [];
        const code = await runNexusCli(["distill", ...argv], { cwd: makeDir(), stdout: () => undefined, stderr: (l) => err.push(l) });
        return { code, err: err.join("\n") };
    }

    it("needs a target, names the number form, and says a shell may drop an unquoted #N (D3, G4)", async () => {
        const { code, err } = await cli([]);
        expect(code).toBe(2);
        expect(err).toContain("nexus distill N");
        expect(err).toMatch(/comment/);
    });

    it("takes N, #N and --epic N as the epic, reaching the checks rather than the argument refusal (AC1, AC2)", async () => {
        for (const argv of [["123"], ["#123"], ["--epic", "123"], ["--epic", "#123"]]) {
            const { code, err } = await cli(argv);
            expect(code, argv.join(" ")).toBe(1);
            expect(err, argv.join(" ")).toContain("nexus distill refused");
        }
    });

    it("refuses two targets before any read (G4)", async () => {
        const { code, err } = await cli(["123", "--pr", "4"]);
        expect(code).toBe(2);
        expect(err).toContain("one target");
    });

    it("refuses an epic that is not a number, or a missing one (G4)", async () => {
        expect((await cli(["--epic", "owner/repo#3"])).code).toBe(2);
        expect((await cli(["--epic"])).code).toBe(2);
        expect((await cli(["acme/app#3"])).code).toBe(2);
    });

    it("refuses an unknown harness and an unknown option", async () => {
        expect((await cli(["--pr", "1", "--harness", "gpt"])).code).toBe(2);
        expect((await cli(["--pr", "1", "--bogus"])).code).toBe(2);
    });
});
