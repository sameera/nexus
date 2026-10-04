import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const script = path.resolve(import.meta.dirname, "../../../utils/implement-epic.sh");
const codexScript = path.resolve(import.meta.dirname, "../../../utils/codex/implement-epic.sh");
let scratch: string;
beforeEach(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-runner-"));
    const stub = `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const name = path.basename(process.argv[1]);
const args = process.argv.slice(2);
fs.appendFileSync(process.env.NEXUS_TEST_LOG, JSON.stringify({name, args}) + "\\n");
if (name === "codex" || name === "claude") {
    const failed = process.env.NEXUS_TEST_FAIL === "1";
    // A local analyze run answers with the next scripted final report; every other run with a fixed text.
    const prompt = name === "claude" ? args[1] : args[args.length - 1];
    let text = "implementation complete";
    if ((prompt.startsWith("/nxs.analyze 42") || prompt.startsWith("$nxs-analyze 42")) && process.env.NEXUS_TEST_REPORTS) {
        const reports = JSON.parse(process.env.NEXUS_TEST_REPORTS);
        const counter = process.env.NEXUS_TEST_LOG + ".reports";
        const n = fs.existsSync(counter) ? Number(fs.readFileSync(counter, "utf8")) : 0;
        fs.writeFileSync(counter, String(n + 1));
        text = reports[Math.min(n, reports.length - 1)];
    }
    if (name === "codex" && !failed) console.log(JSON.stringify({type: "item.completed", item: {type: "agent_message", text: "working on it"}}));
    console.log(JSON.stringify(name === "codex"
        ? failed ? {type: "turn.failed", error: {message: "test failure"}} : {type: "item.completed", item: {type: "agent_message", text}}
        : {type: "result", result: text, is_error: failed, duration_ms: 1, num_turns: 1}));
} else if (name === "git" && args[0] === "rev-parse") console.log("feature/test");
else if (name === "gh" && args[1] === "list") console.log("https://github.com/example/repo/pull/1");
else if (name === "gh" && args[1] === "view") console.log("1");
else if (name === "nexus" && args[0] === "pr-answers") {
    // The first read is before the fix round; every later one is after it.
    const counter = process.env.NEXUS_TEST_LOG + ".answers";
    const n = fs.existsSync(counter) ? Number(fs.readFileSync(counter, "utf8")) : 0;
    fs.writeFileSync(counter, String(n + 1));
    if (process.env.NEXUS_TEST_ANSWERS_FAIL === "1") process.exit(1);
    const urls = (n === 0 ? process.env.NEXUS_TEST_ANSWERS_BEFORE : process.env.NEXUS_TEST_ANSWERS_AFTER) ?? "";
    if (urls) console.log(urls);
}
`;
    for (const name of ["codex", "claude", "git", "gh", "nexus"]) {
        fs.writeFileSync(path.join(scratch, name), stub, { mode: 0o755 });
    }
});
afterEach(() => fs.rmSync(scratch, { recursive: true, force: true }));

function run(harness?: string, failed = false) {
    const log = path.join(scratch, "calls.jsonl");
    const env: NodeJS.ProcessEnv = {
        ...process.env,
        PATH: `${scratch}:${process.env.PATH}`,
        ANALYZE: "0",
        NEXUS_TEST_LOG: log,
        NEXUS_TEST_FAIL: failed ? "1" : "0",
    };
    delete env["HARNESS"];
    if (harness !== undefined) env["HARNESS"] = harness;
    const result = spawnSync("bash", [script, "42", "--model", "test-model"], {
        cwd: scratch,
        env,
        encoding: "utf8",
    });
    const calls: Array<{ name: string; args: string[] }> = fs.existsSync(log)
        ? fs
              .readFileSync(log, "utf8")
              .trim()
              .split("\n")
              .map((line) => JSON.parse(line))
        : [];
    return { ...result, calls };
}

describe("headless epic runner", () => {
    it("keeps Claude as the default with its existing flags", () => {
        const result = run();
        expect(result.status).toBe(0);
        expect(result.calls[0].name).toBe("claude");
        expect(result.calls[0].args).toContain("--permission-mode");
        expect(result.calls[0].args[1]).toContain("/goal");
    });

    it("runs Codex with native skills, structured output and caller-supplied model options", () => {
        const result = run("codex");
        expect(result.status).toBe(0);
        expect(result.calls[0].name).toBe("codex");
        expect(result.calls[0].args).toEqual(
            expect.arrayContaining(["exec", "--json", "--sandbox", "workspace-write", "--model", "test-model"]),
        );
        const prompt = result.calls[0].args.at(-1)!;
        expect(prompt).toContain("$nxs-epic-resolve 42");
        expect(prompt).not.toContain("/goal");
        expect(prompt).not.toContain("/nxs");
        expect(result.stdout, JSON.stringify(result)).toContain("implementation complete");
        expect(result.calls.some((call) => call.name === "claude")).toBe(false);
    });

    it.each(["claude", "codex"])("stops before push or PR changes if %s reports a failed turn", (harness) => {
        const result = run(harness, true);
        expect(result.status).not.toBe(0);
        expect(result.calls.map((call) => call.name)).toEqual([harness]);
    });

    it("rejects an unknown harness before invoking anything", () => {
        const result = run("unknown");
        expect(result.status).not.toBe(0);
        expect(result.calls).toEqual([]);
    });
});

const HEAD = "abc1234def5678abc1234def5678abc1234def56";
const result = (critical: number, high: number, head = HEAD): string =>
    `Conformance: Epic 42\n\nSeverity: critical ${critical} · high ${high} · medium 0 · low 0\nAnalyze result: critical=${critical} high=${high} medium=0 low=0 head=${head}`;

type Call = { name: string; args: string[] };

/** One run of an entry point with analyze on, its local analyze runs answering with `reports` in turn. */
function conform(entry: string, opts: { reports?: string[]; before?: string[]; after?: string[]; fail?: boolean; rounds?: number } = {}) {
    const log = path.join(scratch, "calls.jsonl");
    const env: NodeJS.ProcessEnv = {
        ...process.env,
        PATH: `${scratch}:${process.env.PATH}`,
        ANALYZE: "1",
        CONFORM_ROUNDS: String(opts.rounds ?? 1),
        NEXUS_TEST_LOG: log,
        NEXUS_TEST_FAIL: "0",
        NEXUS_TEST_REPORTS: JSON.stringify(opts.reports ?? [result(1, 0)]),
        NEXUS_TEST_ANSWERS_BEFORE: (opts.before ?? []).join("\n"),
        NEXUS_TEST_ANSWERS_AFTER: (opts.after ?? opts.before ?? []).join("\n"),
        NEXUS_TEST_ANSWERS_FAIL: opts.fail ? "1" : "0",
    };
    delete env["HARNESS"];
    const run = spawnSync("bash", [entry, "42"], { cwd: scratch, env, encoding: "utf8" });
    const calls: Call[] = fs
        .readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
    return { ...run, calls };
}
const promptOf = (c: Call): string => (c.name === "claude" ? c.args[1] : (c.args.at(-1) ?? ""));
const agentPrompts = (calls: Call[]) => calls.filter((c) => c.name === "claude" || c.name === "codex").map(promptOf);
const fixPrompt = (calls: Call[]) => agentPrompts(calls).find((p) => /round 1 of/.test(p));

const ENTRIES: Array<[string, string]> = [
    ["the shared script", script],
    ["the Codex entry point", codexScript],
];

/**
 * A local analyze run writes no file and ends its terminal report with one fixed result line
 * (epic #829, story #863, decision record #871, D12, R2). The scripts capture each local run's
 * final report into their own scratch space, and their fix rounds work from it.
 */
describe("the conformance loop reads analyze's terminal report", () => {
    const reportPath = (prompt: string): string | undefined => /(\.nexus\/tmp\/implement-epic-42\/[^\s`]+)/.exec(prompt)?.[1];

    it.each(ENTRIES)("%s captures the report and hands the fix round that report, never a local analysis file", (_name, entry) => {
        const report = result(1, 2);
        const run = conform(entry, { reports: [report] });
        const fix = fixPrompt(run.calls);
        expect(fix, run.stderr).toBeDefined();
        const captured = reportPath(fix!);
        expect(captured).toBeDefined();
        expect(fs.readFileSync(path.join(scratch, captured!), "utf8")).toContain(report);
        expect(fix).not.toContain("analyze-receipt");
        expect(run.stderr).toContain("1 critical / 2 high");
    });

    it.each(ENTRIES)("%s stops clean, with no fix round, when the result line reports nothing open at critical or high", (_name, entry) => {
        const run = conform(entry, { reports: [result(0, 0)] });
        expect(fixPrompt(run.calls)).toBeUndefined();
        expect(run.stderr).toContain(`conformance clean at ${HEAD}`);
    });

    it.each(ENTRIES)("%s stops, naming the report, when analyze printed no result line", (_name, entry) => {
        const run = conform(entry, { reports: ["Conformance blocked: epic #42 — decision record #43 is open."] });
        expect(run.status).not.toBe(0);
        expect(run.stderr).toMatch(/printed no result line/);
        expect(run.stderr).toMatch(/\.nexus\/tmp\/implement-epic-42\//);
        expect(fixPrompt(run.calls)).toBeUndefined();
    });

    it("keeps a report per run, and judges each round on that run's own result", () => {
        const run = conform(script, { reports: [result(1, 0), result(0, 0, "f".repeat(40))], rounds: 2 });
        expect(run.stderr).toContain(`conformance clean at ${"f".repeat(40)}`);
        expect(fs.readdirSync(path.join(scratch, ".nexus", "tmp", "implement-epic-42")).length).toBe(2);
    });

    it("reads the last result line when the report quotes the line's form earlier", () => {
        const report = `The result line reads: Analyze result: critical=0 high=0 medium=0 low=0 head=${"0".repeat(40)}\n\n${result(1, 0)}`;
        const run = conform(script, { reports: [report] });
        expect(fixPrompt(run.calls)).toBeDefined();
    });

    it("never reads a local analysis file an older release left beside the epic", () => {
        fs.mkdirSync(path.join(scratch, ".nexus", "tmp", "epic-42"), { recursive: true });
        fs.writeFileSync(path.join(scratch, ".nexus", "tmp", "epic-42", "analyze-receipt.md"), "---\nhead: abc\nfindings: { critical: 0, high: 0, medium: 0, low: 0 }\n---\n");
        const run = conform(script, { reports: [result(1, 0)] });
        expect(fixPrompt(run.calls)).toBeDefined();
    });
});

/**
 * An unattended run must never answer an item on the pull request (epic #829, story #860, decision
 * record #871, D13, G39). It posts as the lead, whom the trusted-author filter trusts, so the fix
 * prompt forbids answering and the script stops a round after which a comment holding an answer
 * line has appeared, naming it. Both entry points run the one pipeline.
 */
describe("an unattended fix round that posts an answer", () => {
    const pushesAfterFix = (calls: Call[]) => {
        const fixAt = calls.findIndex((c) => (c.name === "claude" || c.name === "codex") && /round 1 of/.test(promptOf(c)));
        return calls.slice(fixAt + 1).filter((c) => c.name === "git" && c.args[0] === "push").length;
    };

    it.each([
        ["the shared script", script],
        ["the Codex entry point", codexScript],
    ])("%s tells the fix round never to post an answer", (_name, entry) => {
        const prompts = agentPrompts(conform(entry, {}).calls);
        const fix = prompts.find((p) => /round 1 of/.test(p));
        expect(fix).toMatch(/Never answer a departure, a finding or a deferred-scope proposal/);
        expect(fix).toMatch(/no answer line/);
    });

    it.each([
        ["the shared script", script],
        ["the Codex entry point", codexScript],
    ])("%s stops after the round and names the comment that answered an ID (G39)", (_name, entry) => {
        const posted = "https://github.com/example/repo/pull/1#issuecomment-99";
        const result = conform(entry, { before: ["https://github.com/example/repo/pull/1#issuecomment-5"], after: ["https://github.com/example/repo/pull/1#issuecomment-5", posted] });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain(posted);
        expect(result.stderr).not.toContain("issuecomment-5\n");
        expect(pushesAfterFix(result.calls)).toBe(0);
    });

    it("carries on when the round posted no answer, and an answer a person posted earlier does not stop it", () => {
        const result = conform(script, { before: ["https://github.com/example/repo/pull/1#issuecomment-5"] });
        expect(result.stderr).not.toMatch(/posted a comment answering/);
        expect(pushesAfterFix(result.calls)).toBe(1);
    });

    it("stops rather than read a failed comment read as no answer", () => {
        const result = conform(script, { fail: true });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/cannot read the comments on PR #1/);
        expect(agentPrompts(result.calls).some((p) => /round 1 of/.test(p))).toBe(false);
    });
});
