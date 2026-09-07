import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type RunResult, type Runner } from "@nexus/close-migration/run";
import {
    PROBE_SCRATCH_PATH,
    interpretReturn,
    proveProbe,
    renderBreachReport,
    renderUncheckedReport,
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
        expect(calls).toEqual([{ cmd: "true", args: [`${PROBE_SCRATCH_PATH}/pinning.spec.ts`] }]);
        expect(fs.existsSync(path.join(repo, PROBE_SCRATCH_PATH))).toBe(false);
    });

    it("names the materialized test to the command, so the verdict is that test's and not the tree's", () => {
        const repo = makeDir();
        const calls: { cmd: string; args: string[] }[] = [];
        runProbe(repo, "tests/pinning.spec.ts", "// text", ["fake-grade", "--ci"], fakeRunner(0, calls));

        expect(calls).toEqual([
            { cmd: "fake-grade", args: ["--ci", `${PROBE_SCRATCH_PATH}/tests/pinning.spec.ts`] },
        ]);
    });

    it("has the pinning test's own text in place at the path it names while the command runs", () => {
        const repo = makeDir();
        let ran: string | null = null;
        const reader: Runner = (_cmd, args): RunResult => {
            const named = path.join(repo, args[args.length - 1]);
            ran = fs.existsSync(named) ? fs.readFileSync(named, "utf8") : null;
            return { status: 0, stdout: "", stderr: "" };
        };

        runProbe(repo, "tests/pinning.spec.ts", "// the pinning test text", ["fake-grade"], reader);

        expect(ran).toBe("// the pinning test text");
    });

    it("leaves the working tree as it found it even when the probe command fails", () => {
        const repo = makeDir();
        const passed = runProbe(repo, "pinning.spec.ts", "// text", ["false"], fakeRunner(1));

        expect(passed).toBe(false);
        expect(fs.existsSync(path.join(repo, PROBE_SCRATCH_PATH))).toBe(false);
    });
});

describe("proveProbe", () => {
    it("is proven when the declared control test passes, so one test file can run alone here", () => {
        const repo = makeDir();
        expect(proveProbe(repo, { file: "tests/control.spec.ts", text: "// passes" }, ["true"], fakeRunner(0))).toBe("proven");
    });

    it("is unrunnable when the control test does not pass, because a test known to pass could not", () => {
        const repo = makeDir();
        expect(proveProbe(repo, { file: "tests/control.spec.ts", text: "// passes" }, ["false"], fakeRunner(1))).toBe(
            "unrunnable",
        );
    });

    it("is unproven when the workbook declares no control, which is not the same as unrunnable", () => {
        const repo = makeDir();
        expect(proveProbe(repo, null, ["true"], fakeRunner(0))).toBe("unproven");
    });

    it("leaves the working tree as it found it", () => {
        const repo = makeDir();
        proveProbe(repo, { file: "tests/control.spec.ts", text: "// passes" }, ["true"], fakeRunner(0));
        expect(fs.existsSync(path.join(repo, PROBE_SCRATCH_PATH))).toBe(false);
    });
});

describe("interpretReturn", () => {
    it("blocks teaching while the suite is red, whatever the probe found", () => {
        expect(interpretReturn(false, "breached", 465)).toEqual({ canTeach: false, reason: "suite-red" });
        expect(interpretReturn(false, "intact", 465)).toEqual({ canTeach: false, reason: "suite-red" });
        expect(interpretReturn(false, "unchecked", 465)).toEqual({ canTeach: false, reason: "suite-red" });
        expect(interpretReturn(false, null, 465)).toEqual({ canTeach: false, reason: "suite-red" });
    });

    it("reports a breach when the pinning test already passes on a green suite", () => {
        expect(interpretReturn(true, "breached", 465)).toEqual({ canTeach: false, reason: "breach", story: 465 });
    });

    it("teaches on when the suite is green and the pinning test has not been reached into", () => {
        expect(interpretReturn(true, "intact", 465)).toEqual({ canTeach: true });
    });

    it("teaches on when there was no fence to probe at all", () => {
        expect(interpretReturn(true, null, 465)).toEqual({ canTeach: true });
    });

    it("refuses to teach when the fence could not be checked, rather than reading it as intact", () => {
        expect(interpretReturn(true, "unchecked", 465)).toEqual({ canTeach: false, reason: "unchecked", story: 465 });
    });
});

describe("renderUncheckedReport", () => {
    it("names the slice whose fence went unchecked and says the fence was not verified", () => {
        const report = renderUncheckedReport(465);
        expect(report).toContain("465");
        expect(report).toContain("not");
    });
});

describe("renderBreachReport", () => {
    it("names the slice that was reached into", () => {
        expect(renderBreachReport(465)).toContain("465");
    });
});
