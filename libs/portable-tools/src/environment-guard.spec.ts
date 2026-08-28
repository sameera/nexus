/**
 * The environment guard (story #307): a defect in the environment is named on standard error, and
 * nothing about it disturbs a verb's contract — not its standard output, not its exit code.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectEnvironmentDefects, makeEnvironmentGuard } from "./environment-guard";
import { CONFIG_DIR_VAR } from "./install-location";
import { runNexusCli, type CliIo, type VerbEntry } from "./nexus-cli";

let tmpDirs: string[] = [];
function makeTmpDir(prefix: string): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmpDirs.push(dir);
    return dir;
}
afterEach(() => {
    if (priorConfigDir === undefined) {
        delete process.env[CONFIG_DIR_VAR];
    } else {
        process.env[CONFIG_DIR_VAR] = priorConfigDir;
    }
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

/** The duplicate check reads the install location; an inherited value would decide these tests. */
let priorConfigDir: string | undefined;
beforeEach(() => {
    priorConfigDir = process.env[CONFIG_DIR_VAR];
    delete process.env[CONFIG_DIR_VAR];
});

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

describe("the duplicate report after story #317", () => {
    /** A component root (not a repo root) holding one Nexus-owned file. */
    function makeComponentRoot(prefix: string): string {
        const root: string = makeTmpDir(prefix);
        fs.mkdirSync(path.join(root, "commands"), { recursive: true });
        fs.writeFileSync(path.join(root, "commands", "nxs.epic.md"), "epic\n");
        return root;
    }

    it("names both locations when a repository-local set and an installed one both resolve (AC1)", () => {
        const location: string = makeComponentRoot("dup-location-");
        process.env[CONFIG_DIR_VAR] = location;
        const repo: string = makeComponentSet("dup-repo-");

        const defects = detectEnvironmentDefects({ cwd: repo });

        const duplicate = defects.find((d) => d.defect.includes("component set"));
        expect(duplicate?.detail).toContain(location);
        expect(duplicate?.detail).toContain(path.join(repo, ".claude"));
    });

    it("looks at the configuration directory rather than a hard-coded home default (AC1)", () => {
        const location: string = makeComponentRoot("dup-env-location-");
        process.env[CONFIG_DIR_VAR] = location;
        const repo: string = makeComponentSet("dup-env-repo-");
        // A home directory that holds nothing must not make the duplicate disappear.
        const emptyHome: string = makeTmpDir("dup-env-home-");

        const defects = detectEnvironmentDefects({ cwd: repo, home: emptyHome });

        expect(defects.find((d) => d.defect.includes("component set"))?.detail).toContain(location);
    });

    it("reports no duplicate when the install location points at the repository's own tree (AC2)", () => {
        const repo: string = makeComponentSet("dup-checkout-");
        const location: string = makeTmpDir("dup-pointer-");
        fs.mkdirSync(path.join(location, "commands"), { recursive: true });
        fs.symlinkSync(path.join(repo, ".claude", "commands", "nxs.epic.md"), path.join(location, "commands", "nxs.epic.md"));
        process.env[CONFIG_DIR_VAR] = location;

        const defects = detectEnvironmentDefects({ cwd: repo });

        expect(defects.find((d) => d.defect.includes("component set"))).toBeUndefined();
    });

    it("scopes the check to the account, not the machine (AC3)", () => {
        // A second account's component set sits on the same machine and is never consulted.
        makeComponentSet("dup-other-account-");
        const location: string = makeComponentRoot("dup-this-account-");
        process.env[CONFIG_DIR_VAR] = location;
        const repo: string = makeTmpDir("dup-plain-repo-");

        const defects = detectEnvironmentDefects({ cwd: repo });

        expect(defects.find((d) => d.defect.includes("component set"))).toBeUndefined();
    });

    it("agrees with the installer about which files Nexus owns", () => {
        // A non-namespaced file in a managed subtree is not a component set.
        const location: string = makeComponentRoot("dup-owned-location-");
        process.env[CONFIG_DIR_VAR] = location;
        const repo: string = makeTmpDir("dup-unowned-repo-");
        fs.mkdirSync(path.join(repo, ".claude", "commands"), { recursive: true });
        fs.writeFileSync(path.join(repo, ".claude", "commands", "my-own.md"), "mine\n");

        const defects = detectEnvironmentDefects({ cwd: repo });

        expect(defects.find((d) => d.defect.includes("component set"))).toBeUndefined();
    });

    it("leaves the verb's exit code and standard output untouched when it fires (AC4)", async () => {
        const location: string = makeComponentRoot("dup-contract-location-");
        process.env[CONFIG_DIR_VAR] = location;
        const repo: string = makeComponentSet("dup-contract-repo-");
        const io: CapturedIo = makeIo(repo);

        const code: number = await runNexusCli(
            ["later-verb"],
            io,
            {
                registry: {
                    "later-verb": {
                        summary: "A verb added after the guard.",
                        usage: "  nexus later-verb",
                        run: (_argv: string[], verbIo: CliIo): Promise<number> => {
                            verbIo.stdout(JSON.stringify({ ok: true }));
                            return Promise.resolve(3);
                        },
                    },
                },
            },
        );

        expect(code).toBe(3);
        expect(io.out).toEqual([JSON.stringify({ ok: true })]);
        expect(io.err.filter((line) => line.includes("component set"))).toHaveLength(1);
    });
});
