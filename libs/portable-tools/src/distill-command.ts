/**
 * `nexus distill --pr <N>` — distill a closed epic with one command (epic #909, decision record #946).
 *
 * After `nexus close` has closed the epic and prepared its worktree, this command finds that
 * worktree from a merged pull request of the epic, through close's own resolution (D2), and starts
 * one harness session there that runs `/nxs.distill --unattended` (D1). It judges nothing about the
 * distillation itself and never commits to, pushes, rebases or resets the distillation branch (G15).
 *
 * Success is read from GitHub, never from the session (D4): after the session ends, an open pull
 * request whose head is the distillation branch is success; anything else is a stop. Every ending
 * names `nexus pr-worktree remove <worktree>` (D10).
 *
 * The run folder holds the log, the outcome and the distillation's final message. It sits in the
 * main checkout's ignored scratch area, one folder per pull request, under a name no drainable
 * queue entry can have (D5, G18).
 *
 * With `--background` the same runner runs in a detached copy of the command, in its own process
 * session, so it outlives the terminal (D6). That terminal gets a status line at a fixed interval
 * and a final line. A live-run marker in the run folder refuses a second start for the same pull
 * request while the process it names exists (D7).
 *
 * Every platform read and the session itself are injected, so a spec stands in for GitHub, git and
 * the harness.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { closeCommandDeps, resolveEpicOfPr, type CloseStop } from "@nexus/epic-verdicts/close-command";
import { prRepoName, type ParsedPrReference } from "@nexus/pr-worktree/member-target";
import { findEpicDistillBranch, type EpicDistillBranchResult } from "@nexus/pr-worktree/worktree";
import { closePreflight, type PreflightResult } from "@nexus/workspace/close-role";
import { resolveWorkspace } from "@nexus/workspace/resolve";
import { git, type Runner } from "@nexus/workspace/run";

export type DistillHarness = "claude" | "codex";

/** The permission mode each harness runs under unless the lead names another for one run (D9). */
export const DEFAULT_PERMISSION_MODE: Record<DistillHarness, string> = {
    claude: "bypassPermissions",
    codex: "workspace-write",
};

/**
 * Appended to the session prompt so the model knows nobody can answer. It adds nothing to consent:
 * the distillation learns it is unattended only from its `--unattended` flag (G8).
 */
export const UNATTENDED_CLAUSE =
    "\n\nYou are running unattended inside a headless command. Nobody can answer a question, so never end by " +
    "asking which option to take, and never wait for a decision. If the stage cannot proceed, state in " +
    "your final message what blocked it and stop.";

/** The fixed prompt every session gets (G9): nothing read from GitHub or the worktree goes into it. */
export function sessionPrompt(harness: DistillHarness): string {
    const stage = harness === "codex" ? "$nxs-distill" : "/nxs.distill";
    return `${stage} --unattended${UNATTENDED_CLAUSE}`;
}

export interface DistillInput {
    cwd: string;
    pr: ParsedPrReference;
    harness: DistillHarness;
    /** A permission mode for this run only, or null for the harness default (G10). */
    permissionMode: string | null;
    /** Extra arguments for the harness, passed after `--`. They never reach the prompt. */
    harnessArgs: string[];
    /** Return once the detached runner has started, leaving the run going (D6). */
    background?: boolean;
}

/** One harness session, as the runner starts it. */
export interface SessionSpec {
    command: string;
    args: string[];
    cwd: string;
}

/** How a session ended. `started` is false when the harness could not be run at all. */
export interface SessionEnd {
    started: boolean;
    /** The harness's exit code, or null when it was killed or never started. */
    exitCode: number | null;
    /** An error the session itself reported, or why it could not start. */
    error: string | null;
    /** The distillation's final message, word for word, when there was one. */
    finalMessage: string | null;
}

export type OpenPrRead = { ok: true; url: string | null } | { ok: false; message: string };

export interface DistillDeps {
    /** The checkout's role, through close's own role gate. */
    role(cwd: string): PreflightResult;
    /** Close's own resolution of a pull request to its epic (D2). */
    epicOfPr(repoRoot: string, pr: ParsedPrReference, rerun: string): { ok: true; epic: number; issuesRepo: string } | { ok: false; stop: CloseStop };
    /** The newest distillation branch close cut for the epic, through close's own finder. */
    findBranch(repoRoot: string, epic: number): EpicDistillBranchResult;
    /** Whether the epic issue is closed. */
    epicClosed(repoRoot: string, issuesRepo: string, epic: number): { ok: true; closed: boolean } | { ok: false; message: string };
    /** Whether `branch` is on the push remote close pushes it to. */
    branchPushed(repoRoot: string, branch: string): { ok: true; pushed: boolean } | { ok: false; message: string };
    /** The worktree git has registered on `branch`, or null. */
    worktreeOn(repoRoot: string, branch: string): string | null;
    /** The repository's main checkout, whichever checkout the command ran from. */
    mainCheckout(repoRoot: string): string;
    /** The git folder every worktree of the repository shares. */
    commonGitDir(repoRoot: string): string;
    /** Whether git ignores `target` in the checkout at `root`. */
    ignored(root: string, target: string): boolean;
    /** Whether `command` resolves on the PATH. */
    onPath(command: string): boolean;
    /** The open pull request whose head is `branch`, asked of the repository the worktree pushes to (D4). */
    openPr(wtPath: string, branch: string): OpenPrRead;
    /** Run one session to its end, handing each condensed line to `line` as it arrives. */
    session(spec: SessionSpec, line: (text: string) => void): Promise<SessionEnd>;
    /** Whether a process with this id exists. */
    alive(pid: number): boolean;
    /** Start the detached runner for `plan` in its own process session; its id once it has started. */
    detach(plan: DistillPlan): Promise<{ ok: true; pid: number } | { ok: false; message: string }>;
}

export interface DistillIo {
    stdout: (line: string) => void;
    stderr: (line: string) => void;
}

/** What a refusal before any session says: the reason and a remedy. Nothing was started or changed (G7). */
export interface DistillRefusal {
    reason: string;
    remedy: string;
}

/** The files of one run, all in the run folder. */
export interface RunFiles {
    dir: string;
    log: string;
    outcome: string;
    final: string;
    /** The live-run marker: the id of the process that owns a run in progress (D7). */
    marker: string;
}

/** The run folder for a pull request, in the main checkout's ignored scratch area (D5). */
export function runFiles(mainRoot: string, pr: number): RunFiles {
    // `distill-run-pr-<N>` can never be read as `epic-<n>`, `fix-<n>` or `intake-<n>`, the drainable entries (G18).
    const dir = path.join(mainRoot, ".nexus", "tmp", `distill-run-pr-${pr}`);
    return {
        dir,
        log: path.join(dir, "distill.log"),
        outcome: path.join(dir, "outcome.txt"),
        final: path.join(dir, "distill-final.txt"),
        marker: path.join(dir, "running.pid"),
    };
}

/** The pull request as `nexus close --pr` takes it back. */
function prArg(pr: ParsedPrReference): string {
    if (pr.repo === null) return `${pr.number}`;
    return pr.host === undefined ? `${prRepoName(pr, null)}#${pr.number}` : `https://${pr.host}/${pr.repo}/pull/${pr.number}`;
}

function renderRefusal(r: DistillRefusal): string[] {
    return ["nexus distill refused. No session was started and nothing was changed.", "", "REFUSED", `  reason: ${r.reason}`, `  remedy: ${r.remedy}`];
}

/** Everything a run needs once the checks pass. */
export interface DistillPlan {
    pr: number;
    epic: number;
    issuesRepo: string;
    branch: string;
    wtPath: string;
    mainRoot: string;
    files: RunFiles;
    spec: SessionSpec;
    permissionMode: string;
}

/**
 * The checks before any session exists, cheapest first, in the Mechanism's order (D3). A refusal
 * names its remedy and changes nothing (G7).
 */
export function preStart(deps: DistillDeps, input: DistillInput): { ok: true; plan: DistillPlan } | { ok: false; refusal: DistillRefusal } {
    const refuse = (reason: string, remedy: string): { ok: false; refusal: DistillRefusal } => ({ ok: false, refusal: { reason, remedy } });
    const closeRerun = `nexus close --pr ${prArg(input.pr)}`;

    const rerun = `nexus distill --pr ${prArg(input.pr)}`;

    // 1. Single-repo checkouts only: the hub and member rules stay where /nxs.distill keeps them (G1).
    const role = deps.role(input.cwd);
    if (!role.ok) return refuse(role.error.message, "run nexus distill from inside a single-repo checkout");
    const { repoRoot } = role.preflight;
    if (role.preflight.role !== "single-repo") {
        return refuse(
            `this checkout is a workspace ${role.preflight.role}; nexus distill runs only in a single-repo checkout`,
            "distill by hand: run /nxs.distill <worktree-path> from your session, or /nxs.distill inside the worktree nexus close prepared",
        );
    }

    // 2. The epic, through close's own resolution: the pull request must have merged (D2, G2).
    const found = deps.epicOfPr(repoRoot, input.pr, closeRerun);
    if (!found.ok) return refuse(found.stop.reason, found.stop.remedy);
    const { epic, issuesRepo } = found;
    const epicRef = `${issuesRepo}#${epic}`;

    // 3. Close has finished only once the epic issue is closed (G2).
    const state = deps.epicClosed(repoRoot, issuesRepo, epic);
    if (!state.ok) return refuse(`the state of epic ${epicRef} could not be read: ${state.message}`, `re-run ${rerun} once the read succeeds`);
    if (!state.closed) return refuse(`epic ${epicRef} is still open, so nexus close has not finished`, `run ${closeRerun}`);

    // 4. Close's distillation branch, and the worktree on it, named apart (D2, G3).
    const branch = deps.findBranch(repoRoot, epic);
    if (!branch.ok) return refuse(branch.error.message, `re-run ${rerun} once the cause above is fixed`);
    if (branch.branch === null) {
        return refuse(`no distillation branch exists for epic ${epicRef}, locally or on the push remote`, `run ${closeRerun}, which cuts it and opens its worktree`);
    }
    const wtPath = deps.worktreeOn(repoRoot, branch.branch);
    if (wtPath === null) {
        return refuse(`no worktree is registered on the distillation branch ${branch.branch}`, `run ${closeRerun}, which reopens the worktree on the same branch`);
    }

    // 5. The distillation pushes to a branch that is already on the push remote (G4).
    const pushed = deps.branchPushed(repoRoot, branch.branch);
    if (!pushed.ok) return refuse(`the push remote could not be read for ${branch.branch}: ${pushed.message}`, `re-run ${rerun} once the remote can be read`);
    if (!pushed.pushed) return refuse(`the distillation branch ${branch.branch} is not pushed`, `run ${closeRerun}, which pushes ${branch.branch}`);

    // 6. A pull request already open would be read as this run's success (D4, G5).
    const open = deps.openPr(wtPath, branch.branch);
    if (!open.ok) return refuse(`GitHub could not be read for a pull request from ${branch.branch}: ${open.message}`, `re-run ${rerun} once GitHub can be read`);
    if (open.url !== null) {
        return refuse(`a distillation pull request from ${branch.branch} is already open: ${open.url}`, `review that pull request; to distill again, close it first, then re-run ${rerun}`);
    }

    // 7. One run per pull request at a time. A marker whose process is gone is stale (D7, G6).
    const mainRoot = deps.mainCheckout(repoRoot);
    const files = runFiles(mainRoot, input.pr.number);
    const owner = liveRun(deps, files);
    if (owner !== null) {
        return refuse(`a run for this pull request is still in progress (process ${owner}); its outcome will be written to ${files.outcome}`, `wait for it to end and read ${files.outcome}`);
    }

    // 8. The harness itself.
    const command = input.harness;
    if (!deps.onPath(command)) return refuse(`the ${command} command is not on the PATH, so no session can start`, `install and sign in to ${command}, then re-run nexus distill`);

    // 9. The run folder, which must be ignored before anything is written to it (G18).
    if (!deps.ignored(mainRoot, files.dir)) {
        return refuse(`git does not ignore ${files.dir}, so the run's files would show as changes`, "add .nexus/tmp/ to .gitignore, then re-run nexus distill");
    }

    const permissionMode = input.permissionMode ?? DEFAULT_PERMISSION_MODE[input.harness];
    const prompt = sessionPrompt(input.harness);
    const spec: SessionSpec =
        input.harness === "codex"
            ? {
                  command,
                  // Distill commits in the worktree, and git writes those commits into the shared git folder (G27).
                  args: ["exec", "--sandbox", permissionMode, "--json", "--add-dir", deps.commonGitDir(repoRoot), ...input.harnessArgs, "--", prompt],
                  cwd: wtPath,
              }
            : { command, args: ["-p", prompt, "--permission-mode", permissionMode, "--output-format", "stream-json", "--verbose", ...input.harnessArgs], cwd: wtPath };
    return { ok: true, plan: { pr: input.pr.number, epic, issuesRepo, branch: branch.branch, wtPath, mainRoot, files, spec, permissionMode } };
}

/** The process a live-run marker names, when that process still exists; null otherwise. */
function liveRun(deps: Pick<DistillDeps, "alive">, files: RunFiles): number | null {
    let pid: number;
    try {
        pid = Number(fs.readFileSync(files.marker, "utf8").trim());
    } catch {
        return null;
    }
    return Number.isInteger(pid) && pid > 0 && deps.alive(pid) ? pid : null;
}

/**
 * Create the marker naming `pid` only if no live run holds it, in one exclusive create, so two
 * starts at the same instant cannot both pass (G6). Returns the live owner when the claim is lost.
 */
function claimRun(deps: Pick<DistillDeps, "alive">, files: RunFiles, pid: number): number | null {
    fs.mkdirSync(files.dir, { recursive: true });
    for (let attempt = 0; ; attempt++) {
        try {
            fs.writeFileSync(files.marker, `${pid}\n`, { flag: "wx" });
            return null;
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
        }
        const owner = liveRun(deps, files);
        if (owner !== null || attempt > 0) return owner ?? -1;
        fs.rmSync(files.marker, { force: true });
    }
}

/** Hand the marker this process holds to `pid`. */
function handOverRun(files: RunFiles, pid: number): void {
    fs.writeFileSync(files.marker, `${pid}\n`);
}

/** Remove the marker, but only while it still names `pid`. */
function releaseRun(files: RunFiles, pid: number): void {
    try {
        if (fs.readFileSync(files.marker, "utf8").trim() === String(pid)) fs.rmSync(files.marker, { force: true });
    } catch {
        // Already gone.
    }
}

/** The line printed before every session (G10, R1). */
export function permissionLine(harness: DistillHarness, mode: string, overridden: boolean): string {
    const source = overridden ? "chosen for this run with --permission-mode" : `the ${harness} default for nexus distill`;
    const risk = harness === "claude" && mode === "bypassPermissions" ? "; the session can run any command with your git and GitHub credentials" : "";
    return `Permission mode: ${mode} (${source}${risk}). Choose another for one run with --permission-mode <mode>.`;
}

/** The outcome a run writes, and whether it is success. */
export interface RunOutcome {
    success: boolean;
    text: string[];
}

/** Read the outcome from GitHub, never from the session (D4, G11–G13). */
export function decideOutcome(plan: Pick<DistillPlan, "wtPath" | "branch" | "files">, end: SessionEnd, read: OpenPrRead): RunOutcome {
    const cleanup = `Remove the worktree once you no longer need it: nexus pr-worktree remove ${plan.wtPath}`;
    const sessionTrouble = !end.started
        ? `the session could not start: ${end.error ?? "unknown cause"}`
        : end.error !== null
          ? `the session ended with an error: ${end.error}`
          : end.exitCode !== 0
            ? `the session exited ${end.exitCode === null ? "without an exit code" : end.exitCode}`
            : null;
    const final = end.finalMessage !== null && end.finalMessage.trim() !== "" ? end.finalMessage.trim().split("\n") : [`(none — see ${plan.files.log})`];
    if (end.started && read.ok && read.url !== null) {
        return {
            success: true,
            text: [`distillation pull request: ${read.url}`, ...(sessionTrouble === null ? [] : [`note: ${sessionTrouble}, after the pull request opened`]), "", cleanup],
        };
    }
    if (!read.ok) {
        return {
            success: false,
            text: [
                `unconfirmed — GitHub could not be read to confirm a distillation pull request from ${plan.branch}: ${read.message}`,
                `Check with: gh pr list --head ${plan.branch}`,
                ...(sessionTrouble === null ? [] : [`note: ${sessionTrouble}`]),
                "",
                "Distill's final message:",
                "",
                ...final,
                "",
                cleanup,
            ],
        };
    }
    return {
        success: false,
        text: [
            read.url === null
                ? `stopped — no distillation pull request was opened from ${plan.branch}.`
                : `stopped — ${read.url} is open from ${plan.branch}, but this run's session never started, so it did not open it.`,
            ...(sessionTrouble === null ? [] : [`note: ${sessionTrouble}`]),
            "",
            "Distill's final message:",
            "",
            ...final,
            "",
            cleanup,
        ],
    };
}

/**
 * The runner (D5): start the session in the worktree, keep its condensed log and final message,
 * then check GitHub and write the outcome. `mirror` receives each log line as it is written.
 */
export async function runSession(deps: Pick<DistillDeps, "session" | "openPr">, plan: DistillPlan, mirror: (line: string) => void): Promise<RunOutcome> {
    fs.mkdirSync(plan.files.dir, { recursive: true });
    for (const f of [plan.files.log, plan.files.outcome, plan.files.final]) fs.rmSync(f, { force: true });
    const log = (text: string): void => {
        fs.appendFileSync(plan.files.log, text + "\n");
        mirror(text);
    };
    log(`>>> /nxs.distill --unattended in ${plan.wtPath} (${plan.spec.command}, permission mode ${plan.permissionMode})`);
    let end: SessionEnd;
    try {
        end = await deps.session(plan.spec, log);
    } catch (e) {
        end = { started: false, exitCode: null, error: e instanceof Error ? e.message : String(e), finalMessage: null };
    }
    if (end.finalMessage !== null) fs.writeFileSync(plan.files.final, end.finalMessage.trim() + "\n");
    const outcome = decideOutcome(plan, end, deps.openPr(plan.wtPath, plan.branch));
    fs.writeFileSync(plan.files.outcome, outcome.text.join("\n") + "\n");
    return outcome;
}

/** `nexus distill --pr <N>` in the foreground: checks, then the runner, then the outcome. */
export async function runDistillCommand(deps: DistillDeps, input: DistillInput, io: DistillIo): Promise<number> {
    const checked = preStart(deps, input);
    if (!checked.ok) {
        for (const line of renderRefusal(checked.refusal)) io.stderr(line);
        return 1;
    }
    const { plan } = checked;
    io.stderr(permissionLine(input.harness, plan.permissionMode, input.permissionMode !== null));
    const owner = claimRun(deps, plan.files, process.pid);
    if (owner !== null) {
        const held = owner > 0 ? ` (process ${owner})` : "";
        for (const line of renderRefusal({ reason: `a run for this pull request is still in progress${held}; its outcome will be written to ${plan.files.outcome}`, remedy: `wait for it to end and read ${plan.files.outcome}` })) io.stderr(line);
        return 1;
    }
    if (input.background === true) {
        const started = await deps.detach(plan);
        if (!started.ok) {
            releaseRun(plan.files, process.pid);
            io.stderr(`nexus distill stopped: the background run could not start: ${started.message}. No session was started.`);
            return 1;
        }
        handOverRun(plan.files, started.pid);
        io.stdout(`Distilling epic ${plan.issuesRepo}#${plan.epic} in the background (process ${started.pid}), in ${plan.wtPath}.`);
        io.stdout(`Log:     ${plan.files.log}`);
        io.stdout(`Outcome: ${plan.files.outcome} (written when the run ends)`);
        io.stdout(`This terminal gets a status line every ${STATUS_INTERVAL_MS / 60_000} minutes until the run ends.`);
        return 0;
    }
    io.stderr(`Distilling epic ${plan.issuesRepo}#${plan.epic} in ${plan.wtPath} (branch ${plan.branch}). Log: ${plan.files.log}`);
    let outcome: RunOutcome;
    try {
        outcome = await runSession(deps, plan, (line) => io.stdout(line));
    } finally {
        releaseRun(plan.files, process.pid);
    }
    io.stdout("");
    for (const line of outcome.text) io.stdout(line);
    io.stdout(`Outcome written to ${plan.files.outcome}`);
    return outcome.success ? 0 : 1;
}

/** How often a background run tells the terminal it started from that it is still going (D6). */
export const STATUS_INTERVAL_MS = 3 * 60_000;

/**
 * The detached runner (D6): the same runner as the foreground (G21), plus a status line to the
 * starting terminal every `intervalMs` and one final line. A failed status write stops further
 * status lines and never the run (G20).
 */
export async function runDetached(
    deps: Pick<DistillDeps, "session" | "openPr">,
    plan: DistillPlan,
    status: (line: string) => void,
    intervalMs: number = STATUS_INTERVAL_MS,
): Promise<RunOutcome> {
    let silent = false;
    const say = (line: string): void => {
        if (silent) return;
        try {
            status(line);
        } catch {
            silent = true;
        }
    };
    const label = `nexus distill (pull request ${plan.pr})`;
    const started = Date.now();
    const timer = setInterval(() => {
        const mins = Math.round((Date.now() - started) / 60_000);
        say(`${label}: still running after ${mins} min — log: ${plan.files.log}`);
    }, intervalMs);
    try {
        const outcome = await runSession(deps, plan, () => undefined);
        say(`${label}: ended — ${outcome.text[0]} Outcome: ${plan.files.outcome}`);
        return outcome;
    } finally {
        clearInterval(timer);
        releaseRun(plan.files, process.pid);
    }
}

/** The environment variable a detached runner reads its plan from. */
export const PLAN_ENV = "NEXUS_DISTILL_PLAN";

/**
 * Start the detached runner: this same executable, in its own process session, its stdout dropped
 * and its stderr on the starting terminal for the status lines. `entry` is how to run the executable.
 */
export function detachRunner(plan: DistillPlan, entry: { command: string; args: string[] }): Promise<{ ok: true; pid: number } | { ok: false; message: string }> {
    return new Promise((resolve) => {
        const child = spawn(entry.command, [...entry.args, "distill", "--detached-runner"], {
            cwd: plan.mainRoot,
            detached: true,
            stdio: ["ignore", "ignore", "inherit"],
            env: { ...process.env, [PLAN_ENV]: JSON.stringify(plan) },
        });
        child.once("error", (e) => resolve({ ok: false, message: e.message }));
        child.once("spawn", () => {
            child.unref();
            resolve({ ok: true, pid: child.pid ?? 0 });
        });
    });
}

/** The detached runner's own entry: read the plan, run, and keep going whatever happens to the terminal. */
export async function runDetachedFromEnv(deps: Pick<DistillDeps, "session" | "openPr">, env: NodeJS.ProcessEnv = process.env): Promise<number> {
    const raw = env[PLAN_ENV];
    if (raw === undefined) return 2;
    const plan = JSON.parse(raw) as DistillPlan;
    // A closed terminal turns status writes into errors and must never end the run (G20).
    process.on("SIGHUP", () => undefined);
    process.stderr.on("error", () => undefined);
    const outcome = await runDetached(deps, plan, (line) => {
        if (!process.stderr.writable) throw new Error("terminal gone");
        process.stderr.write(line + "\n");
    });
    return outcome.success ? 0 : 1;
}

/** One line of a harness's JSON event stream, condensed for the log. */
export interface CondensedEvent {
    lines: string[];
    final?: string;
    error?: string;
}

const clip = (s: unknown, n: number): string => {
    const t = String(s).replace(/\s+/g, " ").trim();
    return t.length > n ? t.slice(0, n) + "…" : t;
};

/** Condense one event of claude's stream-json or codex's --json output (the script's formatter, ported). */
export function condenseEvent(line: string): CondensedEvent {
    let ev: Record<string, unknown>;
    try {
        ev = JSON.parse(line) as Record<string, unknown>;
    } catch {
        return { lines: line.trim() === "" ? [] : [line] };
    }
    const item = (ev["item"] ?? {}) as Record<string, unknown>;
    const message = (ev["message"] ?? {}) as { content?: unknown[] };
    const blocks = (Array.isArray(message.content) ? message.content : []) as Record<string, unknown>[];
    switch (ev["type"]) {
        case "thread.started":
            return { lines: [`session ${String(ev["thread_id"])}`] };
        case "item.started":
            return { lines: item["type"] === "command_execution" ? [`  ● ${clip(item["command"], 120)}`] : [] };
        case "item.completed":
            if (item["type"] === "agent_message") return { lines: ["", String(item["text"] ?? "")], final: String(item["text"] ?? "") };
            return { lines: item["aggregated_output"] ? [`    ⎿ ${clip(item["aggregated_output"], 200)}`] : [] };
        case "turn.completed":
            return { lines: ["", "=== Codex turn completed ==="] };
        case "turn.failed": {
            const msg = String(((ev["error"] ?? {}) as Record<string, unknown>)["message"] ?? "Codex turn failed");
            return { lines: [msg], error: msg };
        }
        case "error": {
            const msg = String(ev["message"] ?? "Codex stream error");
            return { lines: [msg], error: msg };
        }
        case "system":
            return { lines: ev["subtype"] === "init" ? [`session ${String(ev["session_id"])} | model ${String(ev["model"])}`] : [] };
        case "assistant":
            return {
                lines: blocks.flatMap((b) => {
                    if (b["type"] === "text" && String(b["text"] ?? "").trim()) return ["", String(b["text"]).trim()];
                    if (b["type"] === "tool_use") {
                        const i = (b["input"] ?? {}) as Record<string, unknown>;
                        const detail = i["command"] ?? i["file_path"] ?? i["path"] ?? i["pattern"] ?? i["url"] ?? i["skill"] ?? i["description"] ?? "";
                        return [`  ● ${String(b["name"])}(${clip(detail, 120)})`];
                    }
                    return [];
                }),
            };
        case "user":
            return {
                lines: blocks.flatMap((b) => {
                    if (b["type"] !== "tool_result") return [];
                    const content = b["content"];
                    const parts = Array.isArray(content)
                        ? (content as Record<string, unknown>[]).filter((c) => c["type"] === "text").map((c) => String(c["text"]))
                        : [String(content ?? "")];
                    const text = parts.join(" ").trim();
                    return text ? [`    ⎿ ${clip(text, 200)}`] : [];
                }),
            };
        case "result": {
            const mins = (Number(ev["duration_ms"] ?? 0) / 60000).toFixed(1);
            const cost = typeof ev["total_cost_usd"] === "number" ? ` | $${(ev["total_cost_usd"] as number).toFixed(2)}` : "";
            const result = typeof ev["result"] === "string" ? ev["result"] : "";
            return {
                lines: ["", `=== ${String(ev["subtype"])} | ${String(ev["num_turns"])} turns | ${mins} min${cost} ===`, ...(result ? [result] : [])],
                ...(result ? { final: result } : {}),
                ...(ev["is_error"] === true ? { error: result || "the session reported an error" } : {}),
            };
        }
        default:
            return { lines: [] };
    }
}

/** Run a harness to its end, condensing its event stream line by line. */
export function spawnSession(spec: SessionSpec, line: (text: string) => void): Promise<SessionEnd> {
    return new Promise((resolve) => {
        let final: string | null = null;
        let error: string | null = null;
        let child;
        try {
            child = spawn(spec.command, spec.args, { cwd: spec.cwd, stdio: ["ignore", "pipe", "pipe"] });
        } catch (e) {
            resolve({ started: false, exitCode: null, error: e instanceof Error ? e.message : String(e), finalMessage: null });
            return;
        }
        let spawnError: string | null = null;
        child.on("error", (e) => {
            spawnError = e.message;
        });
        const out = readline.createInterface({ input: child.stdout });
        out.on("line", (raw) => {
            const ev = condenseEvent(raw);
            for (const l of ev.lines) line(l);
            if (ev.final !== undefined) final = ev.final;
            if (ev.error !== undefined) error = ev.error;
        });
        const err = readline.createInterface({ input: child.stderr });
        err.on("line", (raw) => line(raw));
        child.on("close", (code) => {
            if (spawnError !== null) resolve({ started: false, exitCode: null, error: spawnError, finalMessage: null });
            else resolve({ started: true, exitCode: code, error, finalMessage: final });
        });
    });
}

/** Whether `command` resolves to an executable file on the PATH. */
export function onPath(command: string, envPath: string = process.env["PATH"] ?? ""): boolean {
    return envPath
        .split(path.delimiter)
        .filter((d) => d !== "")
        .some((d) => {
            try {
                fs.accessSync(path.join(d, command), fs.constants.X_OK);
                return true;
            } catch {
                return false;
            }
        });
}

/** The worktree registered on `branch`, from git's porcelain list. */
export function worktreeOnBranch(porcelain: string, branch: string): string | null {
    for (const block of porcelain.split(/\n\n+/)) {
        const wt = /^worktree (.+)$/m.exec(block)?.[1];
        const br = /^branch (.+)$/m.exec(block)?.[1];
        if (wt !== undefined && br === `refs/heads/${branch}`) return wt;
    }
    return null;
}

/** The platform-backed deps, against the real git, gh and harness. */
export function distillDeps(run: Runner): DistillDeps {
    const close = closeCommandDeps(run, {
        singleRepo: (root) => {
            const ws = resolveWorkspace(root);
            return ws.ok && ws.workspace.mode === "single-repo";
        },
    });
    return {
        role: (cwd) => closePreflight(cwd, run),
        epicOfPr: (repoRoot, pr, rerun) => resolveEpicOfPr(close, repoRoot, pr, rerun, "pass a merged pull request that closes one of the epic's story issues"),
        epicClosed: (repoRoot, issuesRepo, epic) => {
            const r = run("gh", ["issue", "view", String(epic), "--repo", issuesRepo, "--json", "state", "--jq", ".state"], { cwd: repoRoot });
            if (r.status !== 0) return { ok: false, message: r.stderr.trim() || `gh exited ${r.status}` };
            return { ok: true, closed: r.stdout.trim().toUpperCase() === "CLOSED" };
        },
        branchPushed: (repoRoot, branch) => {
            // --exit-code: 2 means the remote was read and has no such branch.
            const r = run("git", ["ls-remote", "--exit-code", "--heads", "origin", `refs/heads/${branch}`], { cwd: repoRoot });
            if (r.status === 0) return { ok: true, pushed: true };
            if (r.status === 2) return { ok: true, pushed: false };
            return { ok: false, message: r.stderr.trim() || `git exited ${r.status}` };
        },
        findBranch: (repoRoot, epic) => findEpicDistillBranch(run, repoRoot, epic),
        worktreeOn: (repoRoot, branch) => worktreeOnBranch(git(run, repoRoot, "worktree", "list", "--porcelain") ?? "", branch),
        mainCheckout: (repoRoot) => {
            const common = git(run, repoRoot, "rev-parse", "--path-format=absolute", "--git-common-dir");
            return common === null ? repoRoot : path.dirname(common);
        },
        commonGitDir: (repoRoot) => git(run, repoRoot, "rev-parse", "--path-format=absolute", "--git-common-dir") ?? path.join(repoRoot, ".git"),
        ignored: (root, target) => run("git", ["check-ignore", "-q", "--no-index", target], { cwd: root }).status === 0,
        onPath: (command) => onPath(command),
        openPr: (wtPath, branch) => {
            const r = run("gh", ["pr", "list", "--head", branch, "--state", "open", "--json", "url", "--jq", ".[0].url // empty"], { cwd: wtPath });
            if (r.status !== 0) return { ok: false, message: r.stderr.trim() || `gh exited ${r.status}` };
            const url = r.stdout.trim();
            return { ok: true, url: url === "" ? null : url };
        },
        session: spawnSession,
        alive: (pid) => {
            try {
                process.kill(pid, 0);
                return true;
            } catch (e) {
                // EPERM: it exists, owned by someone else.
                return (e as NodeJS.ErrnoException).code === "EPERM";
            }
        },
        detach: (plan) => detachRunner(plan, { command: process.execPath, args: [...process.execArgv, process.argv[1] ?? ""] }),
    };
}
