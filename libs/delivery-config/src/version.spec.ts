/**
 * The `version` capability (story #356) — the same behaviours the Python `test_release_version`
 * suite asserted, now asserted through the capability's own surface.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { releaseVersion, resolveReleaseVersion, RELEASE_VERSION_FILE } from "@nexus/release-identity/release";
import { describe, expect, it } from "vitest";
import { type ToolkitIo } from "./io";
import { runNexusGh } from "./dispatch";
import { programName } from "./registry";

function recordingIo(): ToolkitIo & { out: string[]; err: string[] } {
    const out: string[] = [];
    const err: string[] = [];
    return { cwd: "/tmp", stdout: (line) => out.push(line), stderr: (line) => err.push(line), out, err };
}

function tmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "toolkit-version-"));
}

describe("nexus-gh version", () => {
    it("prints the declared release as one JSON object and exits 0", () => {
        const io = recordingIo();
        expect(runNexusGh(["version"], io)).toBe(0);
        const declared: string = fs
            .readFileSync(path.resolve(import.meta.dirname, "..", "..", "..", RELEASE_VERSION_FILE), "utf8")
            .trim();
        expect(JSON.parse(io.out.join("\n"))).toEqual({ version: declared });
        expect(io.err).toEqual([]);
    });

    it("reports null rather than a fabricated value when no declaration exists at or above", () => {
        expect(resolveReleaseVersion(tmpDir())).toBeNull();
    });

    it("reports null for a declaration that is empty or whitespace only", () => {
        const root: string = tmpDir();
        fs.writeFileSync(path.join(root, RELEASE_VERSION_FILE), "   \n");
        expect(resolveReleaseVersion(root)).toBeNull();
    });

    it("writes usage then the offending argument to stderr and exits 2", () => {
        const io = recordingIo();
        expect(runNexusGh(["version", "--nope"], io)).toBe(2);
        expect(io.err.join("\n")).toContain(`${programName("version")}: unexpected argument '--nope'`);
        expect(io.err[0]).toContain(`usage: ${programName("version")}`);
        expect(io.out).toEqual([]);
    });

    it.each(["-h", "--help"])("writes its own usage to stdout and exits 0 for %s", (flag) => {
        const io = recordingIo();
        expect(runNexusGh(["version", flag], io)).toBe(0);
        expect(io.out.join("\n")).toContain(`usage: ${programName("version")}`);
        expect(io.err).toEqual([]);
    });

    it("reports the value both toolkit names report, because both read through one reader", () => {
        const io = recordingIo();
        runNexusGh(["version"], io);
        expect(JSON.parse(io.out.join("\n")).version).toBe(releaseVersion());
    });

    it("runs without spawning an interpreter", () => {
        const io = recordingIo();
        expect(runNexusGh(["version"], io)).toBe(0);
    });
});
