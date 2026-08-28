/**
 * `nexus uninstall` (story #314): removing the package must not leave a component set behind that
 * nothing tracks. Removal is the same mirror as install, with emptiness declared out loud.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deployComponents, EMPTY_PAYLOAD, payloadDirectory } from "./deploy-components";
import { CONFIG_DIR_VAR } from "./install-location";
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

function makePayload(): string {
    const dir: string = makeTmpDir("uninstall-payload-");
    fs.mkdirSync(path.join(dir, "commands"), { recursive: true });
    fs.mkdirSync(path.join(dir, "skills", "nxs-setup"), { recursive: true });
    fs.writeFileSync(path.join(dir, "commands", "nxs.epic.md"), "epic\n");
    fs.writeFileSync(path.join(dir, "skills", "nxs-setup", "SKILL.md"), "setup\n");
    return dir;
}

describe("nexus uninstall", () => {
    it("leaves no Nexus-namespaced component file at the configuration directory (AC1)", async () => {
        const location: string = makeTmpDir("uninstall-location-");
        process.env[CONFIG_DIR_VAR] = location;
        await runNexusCli(["install", "--payload", makePayload()], makeIo(makeTmpDir("uninstall-cwd-")));

        const io: CapturedIo = makeIo(makeTmpDir("uninstall-cwd-"));
        const code: number = await runNexusCli(["uninstall"], io);

        expect(code).toBe(0);
        expect(fs.existsSync(path.join(location, "commands", "nxs.epic.md"))).toBe(false);
        expect(fs.existsSync(path.join(location, "skills", "nxs-setup"))).toBe(false);
        expect(io.out.join("\n")).toContain(location);
    });

    it("leaves files it does not own untouched (AC2)", async () => {
        const location: string = makeTmpDir("uninstall-foreign-");
        process.env[CONFIG_DIR_VAR] = location;
        await runNexusCli(["install", "--payload", makePayload()], makeIo(makeTmpDir("uninstall-cwd-")));
        fs.writeFileSync(path.join(location, "commands", "my-own.md"), "mine\n");
        fs.writeFileSync(path.join(location, "settings.json"), '{"account":true}');

        await runNexusCli(["uninstall"], makeIo(makeTmpDir("uninstall-cwd-")));

        expect(fs.readFileSync(path.join(location, "commands", "my-own.md"), "utf8")).toBe("mine\n");
        expect(fs.readFileSync(path.join(location, "settings.json"), "utf8")).toBe('{"account":true}');
    });

    it("says it must run before the package itself is removed, and why (AC3)", async () => {
        process.env[CONFIG_DIR_VAR] = makeTmpDir("uninstall-order-");
        const io: CapturedIo = makeIo(makeTmpDir("uninstall-cwd-"));

        await runNexusCli(["uninstall"], io);

        const printed: string = io.out.join("\n").toLowerCase();
        expect(printed).toContain("before");
        expect(printed).toContain("package");
        expect(printed).toContain("package manager");
    });

    it("unlinks the pointers and never deletes the checkout's files (AC4)", async () => {
        const checkout: string = makeTmpDir("uninstall-checkout-");
        fs.mkdirSync(path.join(checkout, ".claude", "commands"), { recursive: true });
        fs.writeFileSync(path.join(checkout, ".claude", "commands", "nxs.epic.md"), "authored\n");
        const location: string = makeTmpDir("uninstall-pointing-");
        process.env[CONFIG_DIR_VAR] = location;
        await runNexusCli(["install", "--from-checkout", checkout], makeIo(makeTmpDir("uninstall-cwd-")));

        const code: number = await runNexusCli(["uninstall"], makeIo(makeTmpDir("uninstall-cwd-")));

        expect(code).toBe(0);
        expect(fs.existsSync(path.join(location, "commands", "nxs.epic.md"))).toBe(false);
        expect(fs.readFileSync(path.join(checkout, ".claude", "commands", "nxs.epic.md"), "utf8")).toBe("authored\n");
    });

    it("names the checkout the pointers resolve to before it removes them (invariant 7)", async () => {
        const checkout: string = makeTmpDir("uninstall-named-checkout-");
        fs.mkdirSync(path.join(checkout, ".claude", "commands"), { recursive: true });
        fs.writeFileSync(path.join(checkout, ".claude", "commands", "nxs.epic.md"), "authored\n");
        const location: string = makeTmpDir("uninstall-named-location-");
        process.env[CONFIG_DIR_VAR] = location;
        await runNexusCli(["install", "--from-checkout", checkout], makeIo(makeTmpDir("uninstall-cwd-")));

        const io: CapturedIo = makeIo(makeTmpDir("uninstall-cwd-"));
        await runNexusCli(["uninstall"], io);

        const named: number = io.out.findIndex((line) => line.includes(checkout));
        const removalReport: number = io.out.findIndex((line) => line.startsWith("removed "));
        expect(named).toBeGreaterThanOrEqual(0);
        expect(named).toBeLessThan(removalReport);
    });

    it("says what a copied install location holds before it empties it (invariant 7)", async () => {
        const location: string = makeTmpDir("uninstall-copy-report-");
        process.env[CONFIG_DIR_VAR] = location;
        await runNexusCli(["install", "--payload", makePayload()], makeIo(makeTmpDir("uninstall-cwd-")));

        const io: CapturedIo = makeIo(makeTmpDir("uninstall-cwd-"));
        await runNexusCli(["uninstall"], io);

        const held: number = io.out.findIndex((line) => line.includes("copied release"));
        const removalReport: number = io.out.findIndex((line) => line.startsWith("removed "));
        expect(held).toBeGreaterThanOrEqual(0);
        expect(held).toBeLessThan(removalReport);
    });

    it("completes on a declared empty payload while the missing-payload throw survives (AC5)", () => {
        const location: string = makeTmpDir("uninstall-empty-");
        fs.mkdirSync(path.join(location, "commands"), { recursive: true });
        fs.writeFileSync(path.join(location, "commands", "nxs.epic.md"), "epic\n");

        const result = deployComponents(EMPTY_PAYLOAD, location);

        expect(result.removed).toEqual(["commands/nxs.epic.md"]);
        // The throw is satisfied, not changed: a payload directory that cannot be found is still
        // an error, so a regression in payload resolution can never become a silent uninstall.
        expect(() => deployComponents(payloadDirectory(path.join(location, "no-such-payload")), location)).toThrowError(/payload/i);
    });
});
