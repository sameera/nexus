/**
 * `nexus version` (story #305): the one command that reports what is installed — the release
 * version, the component payload's fingerprint, and the `python3` the other half of the release
 * would run on. It is what a user runs when something is already wrong, so a broken environment
 * must not stop it reporting.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runNexusCli, type CliIo } from "./nexus-cli";
import { RELEASE_VERSION_FILE, releaseVersion } from "./release";
import { hashComponentTree } from "./vendor-components";

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

const REPO_ROOT: string = path.resolve(import.meta.dirname, "..", "..", "..");

describe("nexus version", () => {
    it("prints exactly one JSON object carrying the release, the payload fingerprint and the interpreter", async () => {
        const io: CapturedIo = makeIo(REPO_ROOT);
        const code: number = await runNexusCli(["version"], io);

        expect(code).toBe(0);
        expect(io.out).toHaveLength(1);
        const reported = JSON.parse(io.out[0]);
        expect(reported.version).toBe(releaseVersion());
        expect(reported.componentPayload).toBe(hashComponentTree(path.join(REPO_ROOT, ".claude")));
        expect(reported.python).toEqual({ path: expect.any(String), version: expect.any(String) });
    });

    it("reports the same release as the Python toolkit, because there is one declaration", () => {
        const declared: string = fs.readFileSync(path.join(REPO_ROOT, RELEASE_VERSION_FILE), "utf8").trim();
        expect(releaseVersion()).toBe(declared);
    });

    it("still reports, with the interpreter unresolved and exit zero, when python3 cannot be resolved", async () => {
        const io: CapturedIo = makeIo(REPO_ROOT);
        const emptyPath: string = makeTmpDir("no-python-");
        const saved: string | undefined = process.env["PATH"];
        process.env["PATH"] = emptyPath;
        let code: number;
        try {
            code = await runNexusCli(["version"], io);
        } finally {
            process.env["PATH"] = saved;
        }

        expect(code).toBe(0);
        expect(io.out).toHaveLength(1);
        const reported = JSON.parse(io.out[0]);
        expect(reported.python).toEqual({ path: null, version: null });
        expect(reported.version).toBe(releaseVersion());
    });

    it("rejects an unknown argument rather than reporting something it was not asked for", async () => {
        const io: CapturedIo = makeIo(REPO_ROOT);
        expect(await runNexusCli(["version", "--wat"], io)).toBe(2);
        expect(io.out).toHaveLength(0);
    });
});

describe("no repository carries a Nexus version (AC4 — the refuted per-repository pin)", () => {
    it("deploying the components writes no file naming a version into the target repo", async () => {
        const payload: string = makeTmpDir("version-payload-");
        fs.mkdirSync(path.join(payload, "commands"), { recursive: true });
        fs.writeFileSync(path.join(payload, "commands", "nxs.epic.md"), "epic\n");
        const target: string = makeTmpDir("version-target-");
        const io: CapturedIo = makeIo(target);

        expect(await runNexusCli(["deploy", "--payload", payload, "--target", target], io)).toBe(0);

        const version: string = releaseVersion() ?? "";
        const written: string[] = [];
        const walk = (dir: string): void => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const abs: string = path.join(dir, entry.name);
                if (entry.isDirectory()) walk(abs);
                else written.push(abs);
            }
        };
        walk(target);
        expect(written.length).toBeGreaterThan(0);
        for (const file of written) {
            expect(path.basename(file)).not.toBe(RELEASE_VERSION_FILE);
            expect(fs.readFileSync(file, "utf8")).not.toContain(version);
        }
    });
});
