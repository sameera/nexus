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
import { condenseEvent, distillDeps, runDistillCommand, spawnSession, type DistillDeps, type DistillInput, type SessionEnd, type SessionSpec } from "./distill-command.js";
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
        findBranch: () => ({ ok: true, branch: BRANCH, source: "local" }),
        worktreeOn: () => wtPath,
        mainCheckout: () => mainRoot,
        commonGitDir: () => path.join(mainRoot, ".git"),
        ignored: () => true,
        onPath: () => true,
        openPr: () => ({ ok: true, url: opened ? URL : null }),
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

function input(over: Partial<DistillInput> = {}): DistillInput {
    return { cwd: "/somewhere", pr: { repo: null, number: PR }, harness: "claude", permissionMode: null, harnessArgs: [], ...over };
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
        await run(a, { pr: { repo: null, number: 1 } });
        await run(b, { pr: { repo: "acme/app", number: 777 } });
        const prompt = (h: Harness): string => h.sessions[0].args[h.sessions[0].args.indexOf("-p") + 1];
        expect(prompt(a)).toBe(prompt(b));
        expect(prompt(a)).not.toMatch(/777|acme/);
    });

    it("writes the log, the outcome and the final message into an ignored folder of the main checkout (D5, G18)", async () => {
        const h = harness();
        const { out } = await run(h);
        const dir = path.join(h.mainRoot, ".nexus", "tmp", `distill-run-pr-${PR}`);
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
        const h = harness({ openPr: () => ({ ok: false, message: "HTTP 502" }) });
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

    it("reports success, noting the error, when the session opened the pull request and then failed", async () => {
        const h = harness({ openPr: () => ({ ok: true, url: URL }) }, { started: true, exitCode: 1, error: "crashed", finalMessage: null });
        const { code, out } = await run(h);
        expect(code).toBe(0);
        expect(out).toContain(URL);
        expect(out).toContain("crashed");
    });
});

describe("nexus distill — the cleanup command and the permission mode (AC4, D9, D10, G10, G14)", () => {
    it("names nexus pr-worktree remove <worktree> whether the run succeeded or stopped", async () => {
        for (const h of [harness(), harness({ openPr: () => ({ ok: true, url: null }) })]) {
            const { out } = await run(h);
            expect(out).toContain(`nexus pr-worktree remove ${h.wtPath}`);
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

describe("nexus distill — arguments", () => {
    async function cli(argv: string[]): Promise<{ code: number; err: string }> {
        const err: string[] = [];
        const code = await runNexusCli(["distill", ...argv], { cwd: makeDir(), stdout: () => undefined, stderr: (l) => err.push(l) });
        return { code, err: err.join("\n") };
    }

    it("needs --pr", async () => {
        const { code, err } = await cli([]);
        expect(code).toBe(2);
        expect(err).toContain("--pr");
    });

    it("refuses an unknown harness and an unknown option", async () => {
        expect((await cli(["--pr", "1", "--harness", "gpt"])).code).toBe(2);
        expect((await cli(["--pr", "1", "--bogus"])).code).toBe(2);
    });
});
