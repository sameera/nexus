/**
 * The allowlist entries where an adopter will look (story #318): the exact permission entry is
 * written down, so a first-time adopter grants the toolkits permission once for their account
 * instead of being prompted once per repository.
 *
 * Three surfaces must carry byte-identical text — the install documentation, the upgrade notes and
 * the install verb's own output. Three copies drift, so this comparison is what makes drift a
 * failing build rather than something a reader discovers.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ALLOWLIST_BLOCK, ALLOWLIST_ENTRIES } from "./allowlist";
import { CONFIG_DIR_VAR } from "./install-location";
import { runNexusCli, type CliIo } from "./nexus-cli";

const REPO_ROOT: string = path.resolve(import.meta.dirname, "..", "..", "..");
const README: string = fs.readFileSync(path.join(REPO_ROOT, "README.md"), "utf8");

/** The install documentation and the upgrade notes, split at the upgrade heading. */
function section(name: "install" | "upgrade"): string {
    const upgradeAt: number = README.indexOf("\n# Upgrading");
    expect(upgradeAt).toBeGreaterThan(-1);
    const installAt: number = README.indexOf("\n# Installing");
    expect(installAt).toBeGreaterThan(-1);
    return name === "install" ? README.slice(installAt, upgradeAt) : README.slice(upgradeAt);
}

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

describe("the documented allowlist entries", () => {
    it("carries exactly two entries in the install documentation, one per named toolkit (AC1)", () => {
        const install: string = section("install");
        expect(install).toContain(ALLOWLIST_BLOCK);
        for (const entry of ALLOWLIST_ENTRIES) {
            expect(install.split(entry)).toHaveLength(2);
        }
        expect(ALLOWLIST_ENTRIES).toHaveLength(2);
    });

    it("states each entry in the trailing-wildcard prefix form (AC1)", () => {
        for (const entry of ALLOWLIST_ENTRIES) {
            expect(entry).toMatch(/^Bash\([a-z-]+:\*\)$/);
        }
    });

    it("states that the entries belong in the account-scoped settings file, not a repository one (AC1)", () => {
        expect(ALLOWLIST_BLOCK).toContain("account-scoped settings file");
        expect(ALLOWLIST_BLOCK).toContain("not to a repository-local one");
    });

    it("carries the same two entries, byte-identical, in the upgrade notes (AC2)", () => {
        expect(section("upgrade")).toContain(ALLOWLIST_BLOCK);
    });

    it("prints the same text from the install verb as the documentation carries (AC3)", async () => {
        process.env[CONFIG_DIR_VAR] = makeTmpDir("allowlist-location-");
        const payload: string = makeTmpDir("allowlist-payload-");
        fs.mkdirSync(path.join(payload, "commands"), { recursive: true });
        fs.writeFileSync(path.join(payload, "commands", "nxs.epic.md"), "epic\n");
        const out: string[] = [];
        const io: CliIo = {
            cwd: makeTmpDir("allowlist-cwd-"),
            stdout: (line: string): void => {
                out.push(line);
            },
            stderr: (): void => undefined,
        };

        await runNexusCli(["install", "--payload", payload], io);

        expect(out.join("\n")).toContain(ALLOWLIST_BLOCK);
    });

    it("says Nexus writes no settings file and that adding the entries is the user's action (AC4)", () => {
        expect(section("install")).toContain("Nexus writes no settings file. Adding these entries is your action.");
    });

    it("no longer teaches installing the components into a repository as the way in", () => {
        const install: string = section("install");
        const firstDeploy: number = install.indexOf("nexus deploy");
        const firstInstall: number = install.indexOf("nexus install");
        expect(firstInstall).toBeGreaterThan(-1);
        // The repository-targeted verb survives, but it is not what the section teaches first.
        expect(firstDeploy === -1 || firstDeploy > firstInstall).toBe(true);
        expect(install).toContain("no longer the supported arrangement");
    });
});
