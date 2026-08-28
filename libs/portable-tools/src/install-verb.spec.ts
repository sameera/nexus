/**
 * `nexus install` (story #313): the one command that puts the components where Claude Code will
 * find them. Installing the package is followed by one explicit step, not by silence.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ALLOWLIST_BLOCK } from "./allowlist";
import { CONFIG_DIR_VAR } from "./install-location";
import { AUTHORED_ROOT_DIRNAME } from "./vendor-components";
import { runNexusCli, type CliIo } from "./nexus-cli";

let tmpDirs: string[] = [];
function makeTmpDir(prefix: string): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmpDirs.push(dir);
    return dir;
}

let priorConfigDir: string | undefined;
beforeEach(() => {
    priorConfigDir = process.env[CONFIG_DIR_VAR];
});
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

/** A payload holding one file per managed subtree, plus a second command to drop on the re-run. */
function makePayload(extra: boolean): string {
    const dir: string = makeTmpDir("install-payload-");
    fs.mkdirSync(path.join(dir, "commands"), { recursive: true });
    fs.mkdirSync(path.join(dir, "skills", "nxs-setup"), { recursive: true });
    fs.writeFileSync(path.join(dir, "commands", "nxs.epic.md"), "epic\n");
    fs.writeFileSync(path.join(dir, "skills", "nxs-setup", "SKILL.md"), "setup\n");
    if (extra) {
        fs.writeFileSync(path.join(dir, "commands", "nxs.retired.md"), "retired\n");
    }
    return dir;
}

describe("nexus install", () => {
    it("places the payload at the configuration directory named by the environment (AC1)", async () => {
        const location: string = path.join(makeTmpDir("install-home-"), "claude-config");
        process.env[CONFIG_DIR_VAR] = location;
        const io: CapturedIo = makeIo(makeTmpDir("install-cwd-"));

        const code: number = await runNexusCli(["install", "--payload", makePayload(false)], io);

        expect(code).toBe(0);
        expect(fs.readFileSync(path.join(location, "commands", "nxs.epic.md"), "utf8")).toBe("epic\n");
        expect(fs.readFileSync(path.join(location, "skills", "nxs-setup", "SKILL.md"), "utf8")).toBe("setup\n");
        expect(io.out.join("\n")).toContain(location);
    });

    it("converges an older component set onto the new payload (AC2)", async () => {
        const location: string = makeTmpDir("install-existing-");
        process.env[CONFIG_DIR_VAR] = location;
        const io: CapturedIo = makeIo(makeTmpDir("install-cwd-"));

        await runNexusCli(["install", "--payload", makePayload(true)], io);
        expect(fs.existsSync(path.join(location, "commands", "nxs.retired.md"))).toBe(true);

        await runNexusCli(["install", "--payload", makePayload(false)], makeIo(io.cwd));

        expect(fs.existsSync(path.join(location, "commands", "nxs.retired.md"))).toBe(false);
        expect(fs.existsSync(path.join(location, "commands", "nxs.epic.md"))).toBe(true);
    });

    it("leaves files it does not own untouched (AC3)", async () => {
        const location: string = makeTmpDir("install-foreign-");
        process.env[CONFIG_DIR_VAR] = location;
        fs.mkdirSync(path.join(location, "commands"), { recursive: true });
        fs.writeFileSync(path.join(location, "commands", "my-own.md"), "mine\n");
        fs.writeFileSync(path.join(location, "settings.json"), '{"permissions":{}}');

        await runNexusCli(["install", "--payload", makePayload(false)], makeIo(makeTmpDir("install-cwd-")));

        expect(fs.readFileSync(path.join(location, "commands", "my-own.md"), "utf8")).toBe("mine\n");
    });

    it("points the location at a checkout's authored tree and names it (AC4)", async () => {
        const checkout: string = makeTmpDir("install-checkout-");
        fs.mkdirSync(path.join(checkout, AUTHORED_ROOT_DIRNAME, "commands"), { recursive: true });
        fs.writeFileSync(path.join(checkout, AUTHORED_ROOT_DIRNAME, "commands", "nxs.epic.md"), "authored\n");
        const location: string = makeTmpDir("install-pointing-");
        process.env[CONFIG_DIR_VAR] = location;
        const io: CapturedIo = makeIo(makeTmpDir("install-cwd-"));

        const code: number = await runNexusCli(["install", "--from-checkout", checkout], io);

        expect(code).toBe(0);
        const installed: string = path.join(location, "commands", "nxs.epic.md");
        expect(fs.lstatSync(installed).isSymbolicLink()).toBe(true);
        expect(fs.readFileSync(installed, "utf8")).toBe("authored\n");
        expect(io.out.join("\n")).toContain(checkout);
    });

    it("never writes through a pointer when a later install copies over it", async () => {
        const checkout: string = makeTmpDir("install-checkout-");
        fs.mkdirSync(path.join(checkout, AUTHORED_ROOT_DIRNAME, "commands"), { recursive: true });
        fs.writeFileSync(path.join(checkout, AUTHORED_ROOT_DIRNAME, "commands", "nxs.epic.md"), "authored\n");
        const location: string = makeTmpDir("install-pointing-");
        process.env[CONFIG_DIR_VAR] = location;

        await runNexusCli(["install", "--from-checkout", checkout], makeIo(makeTmpDir("install-cwd-")));
        await runNexusCli(["install", "--payload", makePayload(false)], makeIo(makeTmpDir("install-cwd-")));

        expect(fs.readFileSync(path.join(checkout, AUTHORED_ROOT_DIRNAME, "commands", "nxs.epic.md"), "utf8")).toBe("authored\n");
    });

    it("prints the allowlist entry for each toolkit and says it wrote no settings file (AC5)", async () => {
        process.env[CONFIG_DIR_VAR] = makeTmpDir("install-notice-");
        const io: CapturedIo = makeIo(makeTmpDir("install-cwd-"));

        await runNexusCli(["install", "--payload", makePayload(false)], io);

        expect(io.out.join("\n")).toContain(ALLOWLIST_BLOCK);
    });

    it("changes neither the account-level nor the repository-local settings file (AC6)", async () => {
        const location: string = makeTmpDir("install-settings-");
        process.env[CONFIG_DIR_VAR] = location;
        const repo: string = makeTmpDir("install-repo-");
        fs.mkdirSync(path.join(repo, ".claude"), { recursive: true });
        const accountSettings: string = path.join(location, "settings.json");
        const localSettings: string = path.join(repo, ".claude", "settings.local.json");
        fs.writeFileSync(accountSettings, '{"account":true}');
        fs.writeFileSync(localSettings, '{"local":true}');

        await runNexusCli(["install", "--payload", makePayload(false)], makeIo(repo));

        expect(fs.readFileSync(accountSettings, "utf8")).toBe('{"account":true}');
        expect(fs.readFileSync(localSettings, "utf8")).toBe('{"local":true}');
    });

    it("refuses an unusable configuration-directory value rather than installing to the default", async () => {
        process.env[CONFIG_DIR_VAR] = "relative/config";
        const io: CapturedIo = makeIo(makeTmpDir("install-cwd-"));

        const code: number = await runNexusCli(["install", "--payload", makePayload(false)], io);

        expect(code).toBe(1);
        expect(io.err.join("\n")).toContain(CONFIG_DIR_VAR);
        expect(io.out).toHaveLength(0);
    });
});
