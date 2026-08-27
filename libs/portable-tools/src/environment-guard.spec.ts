/**
 * The environment guard (story #307): a defect in the environment is named on standard error, and
 * nothing about it disturbs a verb's contract — not its standard output, not its exit code.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { detectEnvironmentDefects, makeEnvironmentGuard } from "./environment-guard";
import { runNexusCli, type CliIo, type VerbEntry } from "./nexus-cli";

let tmpDirs: string[] = [];
function makeTmpDir(prefix: string): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmpDirs.push(dir);
    return dir;
}
afterEach(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});

interface CapturedIo extends CliIo {
    out: string[];
    err: string[];
}
function makeIo(cwd: string): CapturedIo {
    const out: string[] = [];
    const err: string[] = [];
    return {
        cwd,
        out,
        err,
        stdout: (s: string): void => {
            out.push(s);
        },
        stderr: (s: string): void => {
            err.push(s);
        },
    };
}

/** A directory holding an installed Nexus component set. */
function makeComponentSet(prefix: string): string {
    const root: string = makeTmpDir(prefix);
    fs.mkdirSync(path.join(root, ".claude", "commands"), { recursive: true });
    fs.writeFileSync(path.join(root, ".claude", "commands", "nxs.epic.md"), "epic\n");
    return root;
}

const REPO_ROOT: string = path.resolve(import.meta.dirname, "..", "..", "..");

describe("detecting environment defects", () => {
    it("names a missing required interpreter and its remedy", () => {
        const emptyPath: string = makeTmpDir("guard-no-python-");
        const saved: string | undefined = process.env["PATH"];
        process.env["PATH"] = emptyPath;
        try {
            const defects = detectEnvironmentDefects({ cwd: REPO_ROOT, home: makeTmpDir("guard-home-") });
            const missing = defects.find((d) => d.defect.includes("python3"));
            expect(missing).toBeDefined();
            expect(missing?.remedy).not.toBe("");
        } finally {
            process.env["PATH"] = saved;
        }
    });

    it("names two component sets resolving on one account, and where they are", () => {
        const home: string = makeComponentSet("guard-home-set-");
        const repo: string = makeComponentSet("guard-repo-set-");

        const defects = detectEnvironmentDefects({ cwd: repo, home });

        const duplicate = defects.find((d) => d.defect.includes("component set"));
        expect(duplicate).toBeDefined();
        expect(duplicate?.detail).toContain(path.join(home, ".claude"));
        expect(duplicate?.detail).toContain(path.join(repo, ".claude"));
        expect(duplicate?.remedy).not.toBe("");
    });

    it("reports no duplicate when only one component set resolves", () => {
        const repo: string = makeComponentSet("guard-single-set-");
        const defects = detectEnvironmentDefects({ cwd: repo, home: makeTmpDir("guard-empty-home-") });
        expect(defects.find((d) => d.defect.includes("component set"))).toBeUndefined();
    });
});

describe("the diagnostic appears once per invocation (AC4)", () => {
    it("reports the same defect once however often the guard is consulted", () => {
        const io: CapturedIo = makeIo(REPO_ROOT);
        const guard = makeEnvironmentGuard(io, [{ defect: "a defect", detail: "where", remedy: "do this" }]);

        guard.report();
        guard.report();
        guard.report();

        expect(io.err.filter((line) => line.includes("a defect"))).toHaveLength(1);
        expect(io.out).toHaveLength(0);
    });
});

describe("the guard never disturbs a verb's contract", () => {
    /** A verb registered after the guard existed, carrying no guard code of its own (AC5). */
    function laterVerb(exitCode: number): Record<string, VerbEntry> {
        return {
            "later-verb": {
                summary: "A verb added after the guard.",
                usage: "  nexus later-verb",
                run: (_argv: string[], io: CliIo): Promise<number> => {
                    io.stdout(JSON.stringify({ ok: true }));
                    return Promise.resolve(exitCode);
                },
            },
        };
    }

    async function runInDefectiveEnvironment(exitCode: number): Promise<CapturedIo & { code: number }> {
        const home: string = makeComponentSet("contract-home-");
        const repo: string = makeComponentSet("contract-repo-");
        const io: CapturedIo = makeIo(repo);
        const code: number = await runNexusCli(["later-verb"], io, { registry: laterVerb(exitCode), home });
        return { ...io, code };
    }

    it("names the defect on standard error for a verb with no guard code of its own (AC1, AC5)", async () => {
        const run = await runInDefectiveEnvironment(0);
        expect(run.err.join("\n")).toContain("component set");
    });

    it("leaves standard output as exactly the verb's own single JSON object (AC2)", async () => {
        const run = await runInDefectiveEnvironment(0);
        expect(run.out).toHaveLength(1);
        expect(JSON.parse(run.out[0])).toEqual({ ok: true });
    });

    it("returns the code the verb itself produced (AC3)", async () => {
        expect((await runInDefectiveEnvironment(0)).code).toBe(0);
        expect((await runInDefectiveEnvironment(3)).code).toBe(3);
    });
});
