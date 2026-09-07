import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type RunResult, type Runner } from "@nexus/close-migration/run";
import {
    PROBE_SCRATCH_PATH,
    interpretReturn,
    renderBreachReport,
    runProbe,
    runSuite,
    sweepProbe,
} from "./fence-probe.js";

let tmpDirs: string[] = [];
function makeDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fence-probe-"));
    tmpDirs.push(dir);
    return dir;
}
afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs = [];
});

/** A fake runner that records the argument vector it was called with and returns a fixed result. */
function fakeRunner(status: number, calls: { cmd: string; args: string[] }[] = []): Runner {
    return (cmd, args): RunResult => {
        calls.push({ cmd, args });
        return { status, stdout: "", stderr: "" };
    };
}

describe("runSuite", () => {
    it("invokes the declared command as an argument vector, never a shell string", () => {
        const calls: { cmd: string; args: string[] }[] = [];
        const repo = makeDir();
        runSuite(repo, ["npx", "nx", "test", "@nexus/portable-tools"], fakeRunner(0, calls));
        expect(calls).toEqual([{ cmd: "npx", args: ["nx", "test", "@nexus/portable-tools"] }]);
    });

    it("reports the suite green when the command exits zero", () => {
        const repo = makeDir();
        expect(runSuite(repo, ["true"], fakeRunner(0)).passed).toBe(true);
    });

    it("reports the suite red when the command exits non-zero", () => {
        const repo = makeDir();
        expect(runSuite(repo, ["false"], fakeRunner(1)).passed).toBe(false);
    });

    it("refuses to run when the workbook declares no suite command", () => {
        const repo = makeDir();
        expect(() => runSuite(repo, [], fakeRunner(0))).toThrow(/declares no suite command/);
    });
});

describe("the probe's scratch path", () => {
    it("sweeps whatever was left there, and does nothing when nothing was", () => {
        const repo = makeDir();
        const target = path.join(repo, PROBE_SCRATCH_PATH);
        fs.mkdirSync(target, { recursive: true });
        fs.writeFileSync(path.join(target, "leftover.spec.ts"), "// leftover");

        sweepProbe(repo);
        expect(fs.existsSync(target)).toBe(false);
        expect(() => sweepProbe(repo)).not.toThrow();
    });
});

describe("runProbe", () => {
    it("materializes the pinning test at the scratch path, runs it, and removes it", () => {
        const repo = makeDir();
        const calls: { cmd: string; args: string[] }[] = [];
        const passed = runProbe(repo, "pinning.spec.ts", "// the pinning test text", ["true"], fakeRunner(0, calls));

        expect(passed).toBe(true);
        expect(calls).toEqual([{ cmd: "true", args: [] }]);
        expect(fs.existsSync(path.join(repo, PROBE_SCRATCH_PATH))).toBe(false);
    });

    it("leaves the working tree as it found it even when the probe command fails", () => {
        const repo = makeDir();
        const passed = runProbe(repo, "pinning.spec.ts", "// text", ["false"], fakeRunner(1));

        expect(passed).toBe(false);
        expect(fs.existsSync(path.join(repo, PROBE_SCRATCH_PATH))).toBe(false);
    });
});

describe("interpretReturn", () => {
    it("blocks teaching while the suite is red, whatever the probe found", () => {
        expect(interpretReturn(false, true, 465)).toEqual({ canTeach: false, reason: "suite-red" });
        expect(interpretReturn(false, false, 465)).toEqual({ canTeach: false, reason: "suite-red" });
        expect(interpretReturn(false, null, 465)).toEqual({ canTeach: false, reason: "suite-red" });
    });

    it("reports a breach when the pinning test already passes on a green suite", () => {
        expect(interpretReturn(true, true, 465)).toEqual({ canTeach: false, reason: "breach", story: 465 });
    });

    it("teaches on when the suite is green and the pinning test has not been reached into", () => {
        expect(interpretReturn(true, false, 465)).toEqual({ canTeach: true });
    });

    it("teaches on when there was no fence to probe at all", () => {
        expect(interpretReturn(true, null, 465)).toEqual({ canTeach: true });
    });
});

describe("renderBreachReport", () => {
    it("names the slice that was reached into", () => {
        expect(renderBreachReport(465)).toContain("465");
    });
});
