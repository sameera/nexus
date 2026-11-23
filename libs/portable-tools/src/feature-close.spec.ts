/**
 * Feature issues are filed closed (epic #1000, story #1059, decision record #1061 D9).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { type Runner } from "@nexus/workspace/run";
import { runFeatureIssue } from "./feature-issue-cli.js";
import { featureRef } from "./feature-issue.js";

const FEATURE_PATH = "docs/features/x";

function repo(): { root: string; ledger: string } {
    const root: string = fs.mkdtempSync(path.join(os.tmpdir(), "feature-close-"));
    fs.mkdirSync(path.join(root, ".git"));
    fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(path.join(root, ".nexus", "config", "settings.yml"), "github:\n  classification: labels\n  features-as-issues: true\n");
    const ledger: string = path.join(root, "ledger.json");
    fs.writeFileSync(ledger, JSON.stringify({ [featureRef(FEATURE_PATH)]: { number: 77 } }));
    return { root, ledger };
}

function fakeGh(state: { value: "open" | "closed" }, closeFails = false): { run: Runner; writes: string[][] } {
    const writes: string[][] = [];
    const run: Runner = (_cmd, args) => {
        if (args.includes("PATCH")) {
            writes.push(args);
            if (closeFails) return { status: 1, stdout: "", stderr: "HTTP 502" };
            state.value = "closed";
            return { status: 0, stdout: "{}", stderr: "" };
        }
        return { status: 0, stdout: JSON.stringify({ number: 77, state: state.value, body: "", labels: [{ name: "feature" }], type: null }), stderr: "" };
    };
    return { run, writes };
}

async function call(argv: string[], root: string, run: Runner): Promise<{ code: number; out: string }> {
    let out = "";
    const code: number = await runFeatureIssue(argv, { cwd: root, stdout: (l) => (out += l), stderr: () => undefined }, run);
    return { code, out };
}

describe("nexus feature-issue close", () => {
    it("closes the feature issue the run's own ledger records", async () => {
        const { root, ledger } = repo();
        const state = { value: "open" as "open" | "closed" };
        const result = await call(["close", "--ledger", ledger, "--feature-path", FEATURE_PATH], root, fakeGh(state).run);
        expect(result.code).toBe(0);
        expect(state.value).toBe("closed");
        expect(JSON.parse(result.out)).toMatchObject({ issue: 77, state: "closed" });
    });

    it("leaves an already closed feature issue closed and writes nothing", async () => {
        const { root, ledger } = repo();
        const gh = fakeGh({ value: "closed" });
        expect((await call(["close", "--ledger", ledger, "--feature-path", FEATURE_PATH], root, gh.run)).code).toBe(0);
        expect(gh.writes).toEqual([]);
    });

    it("reports incomplete when the close fails, so a repeat can close it", async () => {
        const { root, ledger } = repo();
        expect((await call(["close", "--ledger", ledger, "--feature-path", FEATURE_PATH], root, fakeGh({ value: "open" }, true).run)).code).toBe(1);
    });

    it("closes nothing when the ledger records no feature issue for the path", async () => {
        const { root, ledger } = repo();
        const gh = fakeGh({ value: "open" });
        expect((await call(["close", "--ledger", ledger, "--feature-path", "docs/features/other"], root, gh.run)).code).toBe(1);
        expect(gh.writes).toEqual([]);
    });
});
