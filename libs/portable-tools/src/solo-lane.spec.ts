/**
 * The solo declaration and the workspace-shape check `/nxs.ship` runs first (epic #799, story
 * #800). Each case builds a real git checkout and asks the CLI, the way the stage does.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { runNexusCli, type CliIo } from "./nexus-cli.js";

function repo(settings?: string, marker?: "workspace.yml" | "hub.yml"): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "solo-lane-"));
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
    fs.mkdirSync(path.join(dir, ".nexus", "config"), { recursive: true });
    if (settings !== undefined) fs.writeFileSync(path.join(dir, ".nexus", "config", "settings.yml"), settings);
    if (marker !== undefined) fs.writeFileSync(path.join(dir, ".nexus", "config", marker), "hub: x\n");
    return dir;
}

async function soloCheck(cwd: string): Promise<{ code: number; out: string; err: string }> {
    const out: string[] = [];
    const err: string[] = [];
    const io: CliIo = { cwd, stdout: (l: string) => out.push(l), stderr: (l: string) => err.push(l) };
    const code: number = await runNexusCli(["solo-check"], io, { home: cwd });
    return { code, out: out.join("\n"), err: err.join("\n") };
}

const DECLARED: string = "github:\n  project: X\n\ndelivery:\n    solo: true\n";

describe("nexus solo-check (story #800)", () => {
    it("passes a single repository that declared solo mode", async () => {
        const r = await soloCheck(repo(DECLARED));
        expect(r.code).toBe(0);
        expect(JSON.parse(r.out)).toMatchObject({ shape: "single-repo", solo: true });
    });

    it("refuses an undeclared repository and says how to declare solo mode", async () => {
        const r = await soloCheck(repo("github:\n  project: X\n"));
        expect(r.code).toBe(1);
        expect(r.err).toContain("solo-undeclared");
        expect(r.err).toContain("delivery:");
        expect(r.err).toContain("solo: true");
    });

    it("refuses a repository with no pull requests, no upstream and no settings file, like any undeclared one", async () => {
        const r = await soloCheck(repo());
        expect(r.code).toBe(1);
        expect(r.err).toContain("solo-undeclared");
    });

    it("does not read solo from another section or another value", async () => {
        expect((await soloCheck(repo("github:\n  solo: true\n"))).code).toBe(1);
        expect((await soloCheck(repo("delivery:\n  solo: false\n"))).code).toBe(1);
    });

    it("refuses a hub or a member before reading the declaration", async () => {
        for (const marker of ["workspace.yml", "hub.yml"] as const) {
            const r = await soloCheck(repo(DECLARED, marker));
            expect(r.code).toBe(1);
            expect(r.err).toContain("workspace-not-single-repo");
            expect(r.err).not.toContain("solo-undeclared");
        }
    });
});
