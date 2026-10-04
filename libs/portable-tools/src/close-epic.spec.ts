import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const script = path.resolve(import.meta.dirname, "../../../utils/close-epic.sh");
let scratch: string;
let worktree: string;

beforeEach(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-close-epic-"));
    worktree = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-close-epic-wt-"));

    const gitStub = `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.NEXUS_TEST_LOG, JSON.stringify({name: "git", args}) + "\\n");
if (args[0] === "fetch") process.exit(0);
if (args[0] === "worktree" && args[1] === "list") {
    if (process.env.WT_OK !== "0") {
        const branch = process.env.WT_BRANCH || "distill/2026-01-01-epic-7";
        console.log("worktree /main/checkout\\nHEAD abc\\nbranch refs/heads/main\\n");
        console.log("worktree ${worktree.replace(/\\/g, "\\\\")}\\nHEAD def\\nbranch refs/heads/" + branch + "\\n");
    }
    process.exit(0);
}
if (args[0] === "rev-parse" && args.includes("--git-common-dir")) { console.log("/main/checkout/.git"); process.exit(0); }
if (args[0] === "ls-remote") {
    process.exit(process.env.BRANCH_PUSHED === "0" ? 1 : 0);
}
process.exit(0);
`;

    const ghStub = `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.NEXUS_TEST_LOG, JSON.stringify({name: "gh", args}) + "\\n");
if (args[0] === "pr" && args[1] === "view") {
    console.log(JSON.stringify({
        state: process.env.PR_STATE || "MERGED",
        isDraft: process.env.PR_DRAFT === "1",
        mergeable: process.env.PR_MERGEABLE || "MERGEABLE",
        number: 42,
    }));
    process.exit(0);
}
if (args[0] === "repo" && args[1] === "view") { console.log("acme/repo"); process.exit(0); }
if (args[0] === "pr" && args[1] === "merge") { process.exit(process.env.MERGE_FAILS === "1" ? 1 : 0); }
if (args[0] === "issue" && args[1] === "view") { console.log(process.env.EPIC_STATE || "CLOSED"); process.exit(0); }
if (args[0] === "pr" && args[1] === "list") { console.log(process.env.DISTILL_PR_URL || ""); process.exit(0); }
process.exit(0);
`;

    const nexusStub = `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.NEXUS_TEST_LOG, JSON.stringify({name: "nexus", args}) + "\\n");
if (args[0] === "close-role") { console.log("role: " + (process.env.ROLE || "single-repo") + "\\nrepo: acme/repo (from git)"); process.exit(0); }
if (args[0] === "trunk") { console.log("origin"); process.exit(0); }
if (args[0] === "merge-precheck") {
    if (process.env.PRECHECK_EXIT) { console.error("merge-precheck repo-unresolved: no remote"); process.exit(Number(process.env.PRECHECK_EXIT)); }
    const result = process.env.PRECHECK_RESULT || "clean";
    console.log(JSON.stringify({
        command: "merge-precheck", pr: 42, result, merge: result === "clean",
        message: process.env.PRECHECK_MESSAGE || ("precheck says " + result),
    }));
    process.exit(0);
}
// The deterministic close (decision record #872, D16): on success it writes the three-line
// hand-off note at --handoff and exits 0; on a stop it prints its stop block and exits 1.
if (args[0] === "close") {
    if (process.env.CLOSE_STOPS === "1") {
        console.log("nexus close: checking the gates");
        console.error("nexus close stopped: 1 thing to fix. Nothing was created or written.");
        console.error("");
        console.error("STOP");
        console.error("  reason: the verdict on acme/repo#42 has 1 open high item");
        console.error("  item:   acme/repo#42 F3");
        console.error("  remedy: answer F3 on the pull request, run /nxs.analyze --pr 42 --resolve, then re-run nexus close --pr 42");
        process.exit(1);
    }
    const at = args.indexOf("--handoff");
    if (at > -1 && process.env.WRITE_HANDOFF !== "0") {
        fs.mkdirSync(require("node:path").dirname(args[at + 1]), { recursive: true });
        fs.writeFileSync(args[at + 1], "epic: 7\\nbranch: distill/2026-01-01-epic-7\\nworktree: ${worktree.replace(/\\/g, "\\\\")}\\n");
    }
    console.log("Hand-off note written");
    process.exit(0);
}
process.exit(0);
`;

    const agentStub = `#!/usr/bin/env node
const fs = require("node:fs");
const name = require("node:path").basename(process.argv[1]);
const args = process.argv.slice(2);
fs.appendFileSync(process.env.NEXUS_TEST_LOG, JSON.stringify({name, args, cwd: process.cwd()}) + "\\n");
const headless = args.includes("-p") || args.includes("exec");
const prompt = args.find((a) => typeof a === "string" && (a.includes("/nxs.") || a.includes("$nxs-")));
if (headless) {
    const text = prompt && prompt.includes("distill") ? (process.env.DISTILL_FINAL || "done") : "done";
    console.log(JSON.stringify(name === "codex"
        ? {type: "item.completed", item: {type: "agent_message", text}}
        : {type: "result", result: text, is_error: process.env.DISTILL_FAILS === "1", duration_ms: 1, num_turns: 1}));
    process.exit(0);
}
process.exit(0);
`;

    for (const [name, body] of Object.entries({ git: gitStub, gh: ghStub, nexus: nexusStub, claude: agentStub, codex: agentStub })) {
        fs.writeFileSync(path.join(scratch, name), body, { mode: 0o755 });
    }
});

afterEach(() => {
    fs.rmSync(scratch, { recursive: true, force: true });
    fs.rmSync(worktree, { recursive: true, force: true });
});

function run(pr: string, extraArgs: string[] = [], env: NodeJS.ProcessEnv = {}, entry: string = script) {
    const log = path.join(scratch, "calls.jsonl");
    const cwd = fs.mkdtempSync(path.join(scratch, "repo-"));
    const result = spawnSync("bash", [entry, pr, ...extraArgs], {
        cwd,
        env: {
            ...process.env,
            PATH: `${scratch}:${process.env.PATH}`,
            NEXUS_TEST_LOG: log,
            HOME: scratch,
            ...env,
        },
        encoding: "utf8",
    });
    const calls: Array<{ name: string; args: string[]; cwd?: string }> = fs.existsSync(log)
        ? fs.readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l))
        : [];
    return { ...result, calls };
}

type Call = { name: string; args: string[]; cwd?: string };
const codexEntry = path.resolve(import.meta.dirname, "../../../utils/codex/close-epic.sh");
/** The close stage: a direct call to the deterministic command. */
const closeCall = (calls: Call[]) => calls.find((c) => c.name === "nexus" && c.args[0] === "close");
/** Any harness session that is not headless — the interactive stage D16 removes. */
const interactiveSession = (calls: Call[]) =>
    calls.some((c) => (c.name === "claude" && !c.args.includes("-p")) || (c.name === "codex" && !c.args.includes("exec")));
/** Any harness call that carries close — close must never run through a model. */
const closeThroughHarness = (calls: Call[]) =>
    calls.some((c) => (c.name === "claude" || c.name === "codex") && c.args.some((a) => a.includes("/nxs.close") || a.includes("$nxs-close")));
const distillCall = (calls: Call[]) =>
    calls.findIndex((c) => (c.name === "claude" || c.name === "codex") && c.args.some((a) => a.includes("/nxs.distill") || a.includes("$nxs-distill")));

describe("close-epic.sh — the pull request gate", () => {
    it("refuses a member checkout before any stage runs", () => {
        const result = run("42", [], { ROLE: "member" });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/member repository/);
        expect(result.calls.some((c) => c.name === "gh")).toBe(false);
    });

    it("refuses an open pull request without --merge, naming its state", () => {
        const result = run("42", [], { PR_STATE: "OPEN" });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/open, not merged/);
    });

    it("refuses a closed-without-merge pull request", () => {
        const result = run("42", [], { PR_STATE: "CLOSED" });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain("CLOSED");
    });

    it("continues past a merged pull request straight to close", () => {
        const result = run("42", [], { PR_STATE: "MERGED" });
        expect(result.status).toBe(0);
        expect(closeCall(result.calls)).toBeDefined();
    });
});

describe("close-epic.sh — the --merge readiness checks (D7)", () => {
    it("refuses to merge a draft pull request", () => {
        const result = run("42", ["--merge"], { PR_STATE: "OPEN", PR_DRAFT: "1" });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/draft/);
        expect(result.calls.some((c) => c.name === "gh" && c.args[0] === "pr" && c.args[1] === "merge")).toBe(false);
    });

    it("refuses to merge a pull request GitHub reports unmergeable", () => {
        const result = run("42", ["--merge"], { PR_STATE: "OPEN", PR_MERGEABLE: "CONFLICTING" });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/not mergeable/);
    });

    const merged = (calls: Array<{ name: string; args: string[] }>) =>
        calls.some((c) => c.name === "gh" && c.args[0] === "pr" && c.args[1] === "merge");

    for (const result of ["not-run", "read-failure", "head-moved", "blocking"]) {
        it(`refuses to merge when the pre-check reports ${result}, printing what it reports`, () => {
            const r = run("42", ["--merge"], { PR_STATE: "OPEN", PRECHECK_RESULT: result, PRECHECK_MESSAGE: `PR #42: ${result} detail` });
            expect(r.status).not.toBe(0);
            expect(r.stderr).toContain(`PR #42: ${result} detail`);
            expect(merged(r.calls)).toBe(false);
            expect(r.calls.some((c) => c.name === "claude" || c.name === "codex")).toBe(false);
        });
    }

    it("reports a pre-check that could not run as a read failure, and does not merge", () => {
        const r = run("42", ["--merge"], { PR_STATE: "OPEN", PRECHECK_EXIT: "1" });
        expect(r.status).not.toBe(0);
        expect(r.stderr).toMatch(/could not be read/);
        expect(r.stderr).not.toMatch(/has not run/);
        expect(merged(r.calls)).toBe(false);
    });

    it("reports the clean verdict before merging", () => {
        const r = run("42", ["--merge"], { PR_STATE: "OPEN", PRECHECK_MESSAGE: "PR #42: the receipt is clean (critical 0, high 0)" });
        expect(r.status).toBe(0);
        expect(r.stderr).toContain("PR #42: the receipt is clean (critical 0, high 0)");
        expect(merged(r.calls)).toBe(true);
    });

    it("reads the receipt only — no shipped record and no analyze run before the merge", () => {
        const r = run("42", ["--merge"], { PR_STATE: "OPEN" });
        const mergeAt = r.calls.findIndex((c) => c.name === "gh" && c.args[0] === "pr" && c.args[1] === "merge");
        const before = r.calls.slice(0, mergeAt);
        expect(before.some((c) => c.name === "nexus" && c.args[0] === "merge-precheck")).toBe(true);
        expect(before.some((c) => c.name === "nexus" && c.args[0] === "epic-verdicts")).toBe(false);
        expect(before.some((c) => c.name === "claude" || c.name === "codex")).toBe(false);
    });

    it("never runs the pre-check for an open pull request without --merge", () => {
        const r = run("42", [], { PR_STATE: "OPEN" });
        expect(r.status).not.toBe(0);
        expect(r.calls.some((c) => c.name === "nexus" && c.args[0] === "merge-precheck")).toBe(false);
        expect(merged(r.calls)).toBe(false);
    });

    it("merges a ready, clean, open pull request and continues", () => {
        const result = run("42", ["--merge"], { PR_STATE: "OPEN" });
        expect(result.status).toBe(0);
        expect(result.calls.some((c) => c.name === "gh" && c.args[0] === "pr" && c.args[1] === "merge")).toBe(true);
    });
});

describe("close-epic.sh — close and the hand-off note (D4, D5, D6)", () => {
    // Story #843 (decision record #849, D9, G17): the script starts close with no analyze stage,
    // no coverage check and no shipped-record requirement. Close's own evidence gate decides.
    const headlessAnalyze = (calls: Array<{ name: string; args: string[] }>) =>
        calls.some((c) => (c.args.includes("-p") || c.args.includes("exec")) && c.args.some((a) => a.includes("/nxs.analyze") || a.includes("$nxs-analyze")));

    it("starts close with no analyze stage, no coverage check and no shipped-record read", () => {
        const result = run("42");
        expect(result.status).toBe(0);
        expect(headlessAnalyze(result.calls)).toBe(false);
        expect(result.calls.some((c) => c.name === "nexus" && c.args[0] === "epic-verdicts")).toBe(false);
        expect(result.calls.some((c) => c.name === "nexus" && c.args[0] === "pr-verdict")).toBe(false);
        expect(closeCall(result.calls)).toBeDefined();
    });

    it("starts close after merging a pull request analyzed before the merge, with no analyze stage", () => {
        const result = run("42", ["--merge"], { PR_STATE: "OPEN" });
        expect(result.status).toBe(0);
        expect(headlessAnalyze(result.calls)).toBe(false);
        const mergeAt = result.calls.findIndex((c) => c.name === "gh" && c.args[0] === "pr" && c.args[1] === "merge");
        const closeAt = result.calls.findIndex((c) => c.name === "nexus" && c.args[0] === "close");
        expect(mergeAt).toBeGreaterThan(-1);
        expect(closeAt).toBeGreaterThan(mergeAt);
    });

    it("starts close under the Codex harness with no analyze stage", () => {
        const result = run("42", [], { HARNESS: "codex" });
        expect(result.status).toBe(0);
        expect(headlessAnalyze(result.calls)).toBe(false);
    });

    it("stops when close exits 0 but wrote no hand-off note (G50)", () => {
        const result = run("42", [], { WRITE_HANDOFF: "0" });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/no hand-off note/);
    });

    it("stops when the hand-off note's epic issue is not closed", () => {
        const result = run("42", [], { EPIC_STATE: "OPEN" });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/not closed/);
    });

    it("stops when the hand-off note's worktree does not exist", () => {
        const result = run("42", [], { WT_OK: "0" });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/worktree/);
    });

    it("stops when the hand-off note's worktree is registered on a different branch", () => {
        const result = run("42", [], { WT_BRANCH: "feat/something-else" });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/not a registered worktree/);
        expect(result.calls.some((c) => c.args.some((a) => a.includes("/nxs.distill")))).toBe(false);
    });

    it("stops when the hand-off note's branch was not pushed", () => {
        const result = run("42", [], { BRANCH_PUSHED: "0" });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/not pushed/);
    });
});

describe("close-epic.sh — distill runs unattended in the worktree (D1, D8, D9)", () => {
    it("runs /nxs.distill --unattended headlessly, cwd'd into the hand-off worktree", () => {
        const result = run("42");
        expect(result.status).toBe(0);
        const distillCall = result.calls.find(
            (c) => c.name === "claude" && c.args.includes("-p") && c.args.some((a) => a.includes("/nxs.distill --unattended")),
        );
        expect(distillCall).toBeDefined();
        expect(fs.realpathSync(distillCall!.cwd!)).toBe(fs.realpathSync(worktree));
    });

    it("hands close an absolute hand-off path", () => {
        const result = run("42");
        const close = closeCall(result.calls)!;
        const handoff = close.args[close.args.indexOf("--handoff") + 1];
        expect(path.isAbsolute(handoff)).toBe(true);
    });

    it("writes the outcome record naming the distillation pull request when one opened", () => {
        const result = run("42", [], { DISTILL_PR_URL: "https://github.com/acme/repo/pull/9" });
        expect(result.status).toBe(0);
        expect(result.stderr).toContain("https://github.com/acme/repo/pull/9");
    });

    it("writes a stopped outcome quoting distill's final message when no pull request opened", () => {
        const result = run("42", [], { DISTILL_PR_URL: "", DISTILL_FINAL: "Blocked: taxonomy forced fit for concept X." });
        expect(result.status).toBe(0);
        expect(result.stderr).toMatch(/stopped — no distillation pull request/);
        expect(result.stderr).toContain("Blocked: taxonomy forced fit for concept X.");
        expect(result.stderr).toContain(`nexus pr-worktree remove ${worktree}`);
    });

    it("returns immediately under --background, without waiting for distill", () => {
        const result = run("42", ["--background"]);
        expect(result.status).toBe(0);
        expect(result.stderr).toMatch(/background/);
    });
});

describe("close-epic.sh — Codex harness parity (D10)", () => {
    it("runs distill via codex exec, and close as nexus close, when HARNESS=codex", () => {
        const result = run("42", [], { HARNESS: "codex" });
        expect(result.status).toBe(0);
        expect(result.calls.some((c) => c.name === "codex" && c.args.includes("exec"))).toBe(true);
        expect(closeCall(result.calls)).toBeDefined();
        expect(interactiveSession(result.calls)).toBe(false);
        expect(result.calls.some((c) => c.name === "claude")).toBe(false);
    });

    it("gives codex distill the main checkout's git folder as a writable place (R2)", () => {
        const result = run("42", [], { HARNESS: "codex" });
        const distill = result.calls.find(
            (c) => c.name === "codex" && c.args.includes("exec") && c.args.some((a) => a.includes("$nxs-distill")),
        )!;
        const at = distill.args.indexOf("--add-dir");
        expect(at).toBeGreaterThan(-1);
        expect(distill.args[at + 1]).toBe("/main/checkout/.git");
    });
});

// Story #870 (decision record #872, D16): the close stage is a direct call to `nexus close`, read
// through its exit status. No harness session runs close, so both entry points run unattended.
const entryPoints: Array<[string, string, NodeJS.ProcessEnv]> = [
    ["the Claude entry point", script, {}],
    ["HARNESS=codex", script, { HARNESS: "codex" }],
    ["the Codex entry point", codexEntry, {}],
];

describe("close-epic.sh — close runs unattended, as nexus close (G40)", () => {
    for (const [label, entry, env] of entryPoints) {
        it(`${label}: runs nexus close then distill, with no interactive stage`, () => {
            const result = run("42", [], env, entry);
            expect(result.status).toBe(0);
            const close = closeCall(result.calls);
            expect(close).toBeDefined();
            expect(close!.args).toEqual(expect.arrayContaining(["--pr", "42", "--handoff"]));
            expect(interactiveSession(result.calls)).toBe(false);
            expect(closeThroughHarness(result.calls)).toBe(false);
            const closeAt = result.calls.indexOf(close!);
            expect(distillCall(result.calls)).toBeGreaterThan(closeAt);
        });
    }

    it("the Codex entry point sends distill to codex, not claude", () => {
        const result = run("42", [], {}, codexEntry);
        expect(result.calls.some((c) => c.name === "codex" && c.args.includes("exec"))).toBe(true);
        expect(result.calls.some((c) => c.name === "claude")).toBe(false);
    });

    it("passes extra harness arguments to distill only, never to nexus close", () => {
        const result = run("42", ["--model", "opus"]);
        expect(result.status).toBe(0);
        expect(closeCall(result.calls)!.args).not.toContain("--model");
        const distill = result.calls[distillCall(result.calls)];
        expect(distill.args).toEqual(expect.arrayContaining(["--model", "opus"]));
    });
});

describe("close-epic.sh — a close stop starts no distill (G41)", () => {
    for (const [label, entry, env] of entryPoints) {
        it(`${label}: prints close's reason and remedy and starts no distill`, () => {
            const result = run("42", [], { ...env, CLOSE_STOPS: "1" }, entry);
            expect(result.status).not.toBe(0);
            const repeat = result.stderr.slice(result.stderr.lastIndexOf("distill was not started"));
            expect(repeat).toContain("the verdict on acme/repo#42 has 1 open high item");
            expect(repeat).toContain("answer F3 on the pull request, run /nxs.analyze --pr 42 --resolve");
            expect(distillCall(result.calls)).toBe(-1);
            expect(result.calls.some((c) => c.name === "claude" || c.name === "codex")).toBe(false);
        });
    }

    it("checks no hand-off note after a stop", () => {
        const result = run("42", [], { CLOSE_STOPS: "1" });
        expect(result.status).not.toBe(0);
        expect(result.calls.some((c) => c.name === "gh" && c.args[0] === "issue")).toBe(false);
        expect(distillCall(result.calls)).toBe(-1);
    });
});
