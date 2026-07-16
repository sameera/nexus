/**
 * The `nexus` CLI entrypoint (STORY-60.01). Pins the user-visible verb surface: `nexus deploy`
 * installs the vendored component payload into the invoking repo, usage errors are named and
 * non-zero, and the bundled artifact runs to completion on a plain `node` binary in a checkout
 * with no in-repo toolchain — resolving its payload beside itself (the vendored posture).
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildBundle } from "./bundle";
import { runNexusCli, type CliIo } from "./nexus-cli";
import { copyComponentTree, COMPONENT_PAYLOAD_DIRNAME } from "./vendor-components";

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

function makePayload(): string {
    const dir: string = makeTmpDir("cli-payload-");
    fs.mkdirSync(path.join(dir, "commands"), { recursive: true });
    fs.mkdirSync(path.join(dir, "skills", "nxs-setup"), { recursive: true });
    fs.writeFileSync(path.join(dir, "commands", "nxs.epic.md"), "epic\n");
    fs.writeFileSync(path.join(dir, "skills", "nxs-setup", "SKILL.md"), "setup\n");
    return dir;
}

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

describe("verb dispatch", () => {
    it("prints usage and exits 0 on --help", async () => {
        const io: CapturedIo = makeIo(makeTmpDir("cli-cwd-"));
        expect(await runNexusCli(["--help"], io)).toBe(0);
        expect(io.out.join("\n")).toContain("nexus deploy");
    });

    it("prints usage and exits 2 when no verb is given", async () => {
        const io: CapturedIo = makeIo(makeTmpDir("cli-cwd-"));
        expect(await runNexusCli([], io)).toBe(2);
        expect(io.err.join("\n")).toContain("usage");
    });

    it("names an unknown verb and exits 2", async () => {
        const io: CapturedIo = makeIo(makeTmpDir("cli-cwd-"));
        expect(await runNexusCli(["frobnicate"], io)).toBe(2);
        expect(io.err.join("\n")).toContain("frobnicate");
    });
});

describe("nexus deploy", () => {
    it("installs the payload into the invoking repo", async () => {
        const payload: string = makePayload();
        const repo: string = makeTmpDir("cli-repo-");
        const io: CapturedIo = makeIo(repo);

        const code: number = await runNexusCli(["deploy", "--payload", payload], io);

        expect(code).toBe(0);
        expect(fs.readFileSync(path.join(repo, ".claude", "commands", "nxs.epic.md"), "utf8")).toBe("epic\n");
        expect(io.out.join("\n")).toContain("deployed");
    });

    it("re-running converges to an identical component set and still exits 0", async () => {
        const payload: string = makePayload();
        const repo: string = makeTmpDir("cli-repo-");

        expect(await runNexusCli(["deploy", "--payload", payload], makeIo(repo))).toBe(0);
        expect(await runNexusCli(["deploy", "--payload", payload], makeIo(repo))).toBe(0);
        expect(fs.readFileSync(path.join(repo, ".claude", "commands", "nxs.epic.md"), "utf8")).toBe("epic\n");
    });

    it("fails with a named error when the payload directory does not exist", async () => {
        const repo: string = makeTmpDir("cli-repo-");
        const io: CapturedIo = makeIo(repo);

        const code: number = await runNexusCli(["deploy", "--payload", path.join(repo, "missing")], io);

        expect(code).toBe(1);
        expect(io.err.join("\n")).toContain("payload");
    });
});

describe("bare-runtime portability (epic #60 success metric)", () => {
    it("the bundled nexus.mjs deploys on plain node, resolving its payload beside itself", async () => {
        // Arrange a distributable: bundle + vendored payload side by side, no node_modules anywhere.
        const toolsDir: string = makeTmpDir("cli-tools-");
        const { code } = await buildBundle(path.join(__dirname, "nexus-cli.ts"));
        const bundlePath: string = path.join(toolsDir, "nexus.mjs");
        fs.writeFileSync(bundlePath, code);
        copyComponentTree(makePayload(), path.join(toolsDir, COMPONENT_PAYLOAD_DIRNAME));
        const repo: string = makeTmpDir("cli-bare-repo-");

        const stdout: string = execFileSync(process.execPath, [bundlePath, "deploy"], {
            cwd: repo,
            encoding: "utf8",
        });

        expect(stdout).toContain("deployed");
        expect(fs.readFileSync(path.join(repo, ".claude", "commands", "nxs.epic.md"), "utf8")).toBe("epic\n");
    });
});
