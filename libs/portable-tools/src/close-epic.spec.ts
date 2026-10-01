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
if (args[0] === "pr-verdict") {
    console.log(JSON.stringify({
        found: process.env.VERDICT_FOUND !== "0",
        receipt: { epic: "#7", findings: { critical: Number(process.env.VERDICT_CRIT || "0"), high: Number(process.env.VERDICT_HIGH || "0") } },
    }));
    process.exit(0);
}
if (args[0] === "epic-verdicts" && args[1] === "coverage") {
    if (process.env.COVERAGE_READ_FAILS === "1") {
        console.error("epic-verdicts story-read-failed: the pull requests claiming 1 story could not be read:\\n  acme/repo#8 — HTTP 502");
        process.exit(1);
    }
    const recorded = process.env.RECORDED === "0" ? [] : [{ repo: "acme/repo", pr: 42, stories: [8], mergeCommit: "abc" }];
    console.log(JSON.stringify({ command: "coverage", epic: 7, fullyShipped: recorded.length > 0, recorded }));
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
if (!headless && prompt && (prompt.includes("/nxs.close") || prompt.includes("$nxs-close"))) {
    const m = prompt.match(/--handoff (\\S+)/);
    if (m && process.env.WRITE_HANDOFF !== "0") {
        fs.mkdirSync(require("node:path").dirname(m[1]), { recursive: true });
        fs.writeFileSync(m[1], "epic: 7\\nbranch: distill/2026-01-01-epic-7\\nworktree: ${worktree.replace(/\\/g, "\\\\")}\\n");
    }
    process.exit(process.env.CLOSE_FAILS === "1" ? 1 : 0);
}
if (headless) {
    const text = prompt && prompt.includes("distill") ? (process.env.DISTILL_FINAL || "done") : "done";
    console.log(JSON.stringify(name === "codex"
        ? {type: "item.completed", item: {type: "agent_message", text}}
        : {type: "result", result: text, is_error: process.env.ANALYZE_FAILS === "1" || process.env.DISTILL_FAILS === "1", duration_ms: 1, num_turns: 1}));
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

function run(pr: string, extraArgs: string[] = [], env: NodeJS.ProcessEnv = {}) {
    const log = path.join(scratch, "calls.jsonl");
    const cwd = fs.mkdtempSync(path.join(scratch, "repo-"));
    const result = spawnSync("bash", [script, pr, ...extraArgs], {
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

    it("continues past a merged pull request straight to analyze", () => {
        const result = run("42", [], { PR_STATE: "MERGED" });
        expect(result.status).toBe(0);
        expect(result.calls.some((c) => c.name === "claude" && c.args.includes("-p"))).toBe(true);
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

    it("refuses to merge a pull request with no clean conformance verdict", () => {
        const result = run("42", ["--merge"], { PR_STATE: "OPEN", VERDICT_CRIT: "1" });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/no clean conformance verdict/);
    });

    it("merges a ready, clean, open pull request and continues", () => {
        const result = run("42", ["--merge"], { PR_STATE: "OPEN" });
        expect(result.status).toBe(0);
        expect(result.calls.some((c) => c.name === "gh" && c.args[0] === "pr" && c.args[1] === "merge")).toBe(true);
    });
});

describe("close-epic.sh — analyze, close and the hand-off note (D4, D5, D6)", () => {
    it("runs /nxs.analyze --pr unattended before close, and stops before close on failure", () => {
        const result = run("42", [], { ANALYZE_FAILS: "1" });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/not starting close/);
        expect(result.calls.some((c) => c.name === "claude" && !c.args.includes("-p"))).toBe(false);
    });

    it("stops before close when analyze exits cleanly but the epic carries no shipped record for the pull request", () => {
        const result = run("42", [], { RECORDED: "0" });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/no shipped record for PR #42/);
        expect(result.calls.some((c) => c.name === "claude" && !c.args.includes("-p"))).toBe(false);
    });

    it("stops before close when a story's pull requests could not be read, rather than reading it as covered", () => {
        const result = run("42", [], { COVERAGE_READ_FAILS: "1" });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/story-read-failed/);
        expect(result.stderr).toMatch(/not starting close/);
        expect(result.calls.some((c) => c.name === "claude" && !c.args.includes("-p"))).toBe(false);
    });

    it("stops before close when analyze exits cleanly but published no verdict", () => {
        const result = run("42", [], { VERDICT_FOUND: "0" });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/not starting close/);
        expect(result.calls.some((c) => c.name === "claude" && !c.args.includes("-p"))).toBe(false);
    });

    it("runs close interactively (no -p / exec) with --handoff, after analyze succeeds", () => {
        const result = run("42");
        const interactive = result.calls.find((c) => c.name === "claude" && !c.args.includes("-p"));
        expect(interactive).toBeDefined();
        expect(interactive!.args.some((a) => a.includes("--handoff"))).toBe(true);
        expect(interactive!.args.some((a) => a.includes("/nxs.close --pr 42"))).toBe(true);
    });

    it("stops when close wrote no hand-off note", () => {
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
        const close = result.calls.find((c) => c.name === "claude" && !c.args.includes("-p"))!;
        const handoff = close.args.join(" ").match(/--handoff (\S+)/)![1];
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
    it("runs analyze and distill via codex exec, and close via plain codex, when HARNESS=codex", () => {
        const result = run("42", [], { HARNESS: "codex" });
        expect(result.status).toBe(0);
        expect(result.calls.some((c) => c.name === "codex" && c.args.includes("exec"))).toBe(true);
        expect(result.calls.some((c) => c.name === "codex" && !c.args.includes("exec"))).toBe(true);
        expect(result.calls.some((c) => c.name === "claude")).toBe(false);
    });

    it("sends close to codex as the $nxs-close skill", () => {
        const result = run("42", [], { HARNESS: "codex" });
        const close = result.calls.find((c) => c.name === "codex" && !c.args.includes("exec"))!;
        expect(close.args.some((a) => a.includes("$nxs-close --pr 42"))).toBe(true);
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
