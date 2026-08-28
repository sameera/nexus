/**
 * Install-location resolution (story #313). The failure modes are the substance of this story:
 * the caller population is a first-time adopter who cannot tell a wrong-location install from a
 * broken one, so an unusable explicit value must never be quietly replaced by the default.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
    CONFIG_DIR_VAR,
    describeInstallLocation,
    ensureInstallLocation,
    inspectInstallLocation,
    resolveInstallLocation,
} from "./install-location";
import { AUTHORED_ROOT_DIRNAME } from "./vendor-components";

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

describe("resolving the install location", () => {
    it("takes the home-directory default when the variable is unset", () => {
        const resolved = resolveInstallLocation({ env: {}, homedir: () => "/home/adopter" });
        expect(resolved).toMatchObject({ ok: true, path: path.join("/home/adopter", ".claude"), source: "home-default" });
    });

    it("takes an absolute value from the variable", () => {
        const resolved = resolveInstallLocation({ env: { [CONFIG_DIR_VAR]: "/opt/claude-config" }, homedir: () => "/home/adopter" });
        expect(resolved).toMatchObject({ ok: true, path: "/opt/claude-config", source: "environment" });
    });

    it("errors rather than falling back when the variable is set but empty", () => {
        const resolved = resolveInstallLocation({ env: { [CONFIG_DIR_VAR]: "   " }, homedir: () => "/home/adopter" });
        expect(resolved.ok).toBe(false);
        expect(resolved.ok === false && resolved.message).toContain(CONFIG_DIR_VAR);
    });

    it("errors rather than falling back when the variable is not an absolute path", () => {
        const resolved = resolveInstallLocation({ env: { [CONFIG_DIR_VAR]: "relative/config" }, homedir: () => "/home/adopter" });
        expect(resolved.ok).toBe(false);
        expect(resolved.ok === false && resolved.message).toContain("relative/config");
    });

    it("errors, naming the variable as the remedy, when no home directory resolves", () => {
        const resolved = resolveInstallLocation({
            env: {},
            homedir: () => {
                throw new Error("no home");
            },
        });
        expect(resolved.ok).toBe(false);
        expect(resolved.ok === false && resolved.message).toContain(CONFIG_DIR_VAR);
    });

    it("creates an absent but resolvable location", () => {
        const parent: string = makeTmpDir("install-loc-");
        const location: string = path.join(parent, "config", "claude");
        ensureInstallLocation(location);
        expect(fs.statSync(location).isDirectory()).toBe(true);
    });

    it("names the location and where it came from, for the line every verb prints first", () => {
        expect(describeInstallLocation({ path: "/opt/cfg", source: "environment" })).toContain("/opt/cfg");
        expect(describeInstallLocation({ path: "/opt/cfg", source: "environment" })).toContain(CONFIG_DIR_VAR);
        expect(describeInstallLocation({ path: "/home/a/.claude", source: "home-default" })).toContain("/home/a/.claude");
    });
});

describe("reading what the install location holds", () => {
    it("reports an unpopulated location", () => {
        const location: string = makeTmpDir("install-empty-");
        expect(inspectInstallLocation(location)).toMatchObject({ populated: false, content: null, checkout: null });
    });

    it("reports a copied release", () => {
        const location: string = makeTmpDir("install-copy-");
        fs.mkdirSync(path.join(location, "commands"), { recursive: true });
        fs.writeFileSync(path.join(location, "commands", "nxs.epic.md"), "epic\n");
        expect(inspectInstallLocation(location)).toMatchObject({ populated: true, content: "copy", checkout: null });
    });

    it("reports a pointer at a checkout, naming the tree pointed at", () => {
        const checkout: string = makeTmpDir("install-checkout-");
        const claude: string = path.join(checkout, AUTHORED_ROOT_DIRNAME, "commands");
        fs.mkdirSync(claude, { recursive: true });
        fs.writeFileSync(path.join(claude, "nxs.epic.md"), "epic\n");
        const location: string = makeTmpDir("install-pointer-");
        fs.mkdirSync(path.join(location, "commands"), { recursive: true });
        fs.symlinkSync(path.join(claude, "nxs.epic.md"), path.join(location, "commands", "nxs.epic.md"));

        const state = inspectInstallLocation(location);
        expect(state).toMatchObject({ populated: true, content: "checkout-pointer" });
        expect(state.checkout).toBe(path.join(checkout, AUTHORED_ROOT_DIRNAME));
    });

    it("ignores files it does not own", () => {
        const location: string = makeTmpDir("install-foreign-");
        fs.mkdirSync(path.join(location, "commands"), { recursive: true });
        fs.writeFileSync(path.join(location, "commands", "my-own.md"), "mine\n");
        expect(inspectInstallLocation(location).populated).toBe(false);
    });
});
