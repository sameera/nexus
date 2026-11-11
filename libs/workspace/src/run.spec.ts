import * as os from "node:os";
import { describe, expect, it } from "vitest";
import { type RunResult, defaultRunner } from "./run";

/** A command on every platform that copies its standard input to its standard output. */
const ECHO: string[] = ["-e", "process.stdin.pipe(process.stdout)"];

describe("defaultRunner", () => {
    it("writes the input it is given to the command's standard input, byte for byte", () => {
        const input: string = "<!-- part 1/1 -->\n@not-a-file, $HOME and ünïcode stay literal\n";
        const r: RunResult = defaultRunner(process.execPath, ECHO, { cwd: os.tmpdir(), input });
        expect(r.status).toBe(0);
        expect(r.stdout).toBe(input);
    });

    it("gives the command an empty standard input when no input is given", () => {
        const r: RunResult = defaultRunner(process.execPath, ECHO, { cwd: os.tmpdir() });
        expect(r).toMatchObject({ status: 0, stdout: "" });
    });

    it("reports why a command could not start when it wrote nothing to standard error", () => {
        const r: RunResult = defaultRunner("nexus-no-such-command", [], { cwd: os.tmpdir() });
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain("ENOENT");
    });

    it("reads output larger than spawnSync's default buffer", () => {
        const big: string = "x".repeat(2 * 1024 * 1024);
        const r: RunResult = defaultRunner(process.execPath, ECHO, { cwd: os.tmpdir(), input: big });
        expect(r.stdout.length).toBe(big.length);
    });

    it("says a command was killed when it was", () => {
        const r: RunResult = defaultRunner(process.execPath, ["-e", "process.kill(process.pid, 'SIGTERM')"], { cwd: os.tmpdir() });
        expect(r.stderr).toContain("SIGTERM");
    });

    it("keeps what a killed command printed beside why it stopped", () => {
        const r: RunResult = defaultRunner(process.execPath, ["-e", "console.error('a warning'); process.kill(process.pid, 'SIGTERM')"], { cwd: os.tmpdir() });
        expect(r.stderr).toContain("a warning");
        expect(r.stderr).toContain("SIGTERM");
    });
});
