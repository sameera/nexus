import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const script = path.resolve(import.meta.dirname, "../../../utils/implement-epic.sh");
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
    console.log(JSON.stringify(name === "codex"
        ? failed ? {type: "turn.failed", error: {message: "test failure"}} : {type: "item.completed", item: {type: "agent_message", text: "implementation complete"}}
        : {type: "result", result: "implementation complete", is_error: failed, duration_ms: 1, num_turns: 1}));
} else if (name === "git" && args[0] === "rev-parse") console.log("feature/test");
else if (name === "gh" && args[1] === "list") console.log("https://github.com/example/repo/pull/1");
else if (name === "gh" && args[1] === "view") console.log("1");
`;
    for (const name of ["codex", "claude", "git", "gh"]) {
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
