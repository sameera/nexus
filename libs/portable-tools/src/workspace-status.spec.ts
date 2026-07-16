/**
 * `nexus workspace status` (STORY-60.03). The verb is nothing but the resolver plus its status
 * renderer — the identical code path the in-repo status skill runs — so these specs assert
 * output parity BY EQUALITY with the library render, from the hub and from a member, and pin
 * the read-only contract: single-repo mode is a normal report (exit 0), a missing member
 * checkout is state (exit 0), only a resolution failure is a hard failure (exit 1), and no
 * invocation mutates any file.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveWorkspace } from "@nexus/workspace/resolve";
import { renderWorkspaceStatus } from "@nexus/workspace/status";
import { buildBundle } from "./bundle";
import { runNexusCli, type CliIo } from "./nexus-cli";

let tmpDirs: string[] = [];

function makeParent(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "ws-status-"));
    tmpDirs.push(dir);
    return dir;
}

afterEach(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});

/** A declared workspace: hub + one present member + one missing member. */
function makeWorkspace(): { parent: string; hub: string; member: string } {
    const parent: string = makeParent();
    const hub: string = path.join(parent, "docs-hub");
    const member: string = path.join(parent, "web-app");
    fs.mkdirSync(path.join(hub, ".nexus", "config"), { recursive: true });
    fs.mkdirSync(path.join(member, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(
        path.join(hub, ".nexus", "config", "workspace.yml"),
        [
            "hub:",
            "  name: docs-hub",
            "  remote: git@github.com:acme/docs-hub.git",
            "members:",
            "  - name: web-app",
            "    remote: git@github.com:acme/web-app.git",
            "  - name: api",
            "    remote: https://github.com/acme/api.git",
            "",
        ].join("\n"),
    );
    fs.writeFileSync(
        path.join(member, ".nexus", "config", "hub.yml"),
        "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\n",
    );
    return { parent, hub, member };
}

interface Captured {
    io: CliIo;
    out: string[];
    err: string[];
}

function makeIo(cwd: string): Captured {
    const out: string[] = [];
    const err: string[] = [];
    return {
        out,
        err,
        io: {
            cwd,
            stdout: (line: string): void => {
                out.push(line);
            },
            stderr: (line: string): void => {
                err.push(line);
            },
        },
    };
}

/** Full-tree snapshot (paths + content hashes) for the read-only assertions. */
function snapshot(root: string): Record<string, string> {
    const out: Record<string, string> = {};
    const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const abs: string = path.join(dir, entry.name);
            const rel: string = path.relative(root, abs);
            if (entry.isDirectory()) {
                out[rel + "/"] = "dir";
                walk(abs);
            } else {
                out[rel] = createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
            }
        }
    };
    walk(root);
    return out;
}

describe("nexus workspace status", () => {
    it("matches the existing read-out exactly — equal to the library render, from hub and member alike", async () => {
        const { hub, member } = makeWorkspace();

        const fromHub: Captured = makeIo(hub);
        const fromMember: Captured = makeIo(member);
        expect(await runNexusCli(["workspace", "status"], fromHub.io)).toBe(0);
        expect(await runNexusCli(["workspace", "status"], fromMember.io)).toBe(0);

        expect(fromHub.out.join("\n")).toBe(renderWorkspaceStatus(resolveWorkspace(hub)));
        expect(fromMember.out.join("\n")).toBe(renderWorkspaceStatus(resolveWorkspace(member)));
        // Identical description from both entry points → identical read-out.
        expect(fromMember.out.join("\n")).toBe(fromHub.out.join("\n"));
    });

    it("reports a missing member checkout by name and expected path as state, exit 0", async () => {
        const { hub, parent } = makeWorkspace();
        const captured: Captured = makeIo(hub);

        expect(await runNexusCli(["workspace", "status"], captured.io)).toBe(0);

        const text: string = captured.out.join("\n");
        expect(text).toContain("[missing] api");
        expect(text).toContain(path.join(parent, "api"));
    });

    it("reports single-repo mode for a checkout with neither artifact — not an error", async () => {
        const solo: string = path.join(makeParent(), "solo-repo");
        fs.mkdirSync(solo, { recursive: true });
        const captured: Captured = makeIo(solo);

        expect(await runNexusCli(["workspace", "status"], captured.io)).toBe(0);

        expect(captured.out.join("\n")).toContain("single-repo mode");
        expect(captured.err).toEqual([]);
    });

    it("exits 1 with the resolver's diagnostic on a malformed manifest (hard failure)", async () => {
        const hub: string = path.join(makeParent(), "broken-hub");
        fs.mkdirSync(path.join(hub, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(path.join(hub, ".nexus", "config", "workspace.yml"), "hub: [\n");
        const captured: Captured = makeIo(hub);

        expect(await runNexusCli(["workspace", "status"], captured.io)).toBe(1);
        expect(captured.err.join("\n")).toContain("Workspace resolution failed");
    });

    it("performs no clone, fetch, or file mutation — the tree is byte-identical after every case", async () => {
        const { parent, hub, member } = makeWorkspace();
        const before: Record<string, string> = snapshot(parent);

        await runNexusCli(["workspace", "status"], makeIo(hub).io);
        await runNexusCli(["workspace", "status"], makeIo(member).io);

        expect(snapshot(parent)).toEqual(before);
    });

    it("runs on plain node from the bundled artifact with identical output (bare runtime)", async () => {
        const { hub } = makeWorkspace();
        const toolsDir: string = makeParent();
        const { code } = await buildBundle(path.join(__dirname, "nexus-cli.ts"));
        const bundlePath: string = path.join(toolsDir, "nexus.mjs");
        fs.writeFileSync(bundlePath, code);

        const stdout: string = execFileSync(process.execPath, [bundlePath, "workspace", "status"], {
            cwd: hub,
            encoding: "utf8",
        });

        expect(stdout.trimEnd()).toBe(renderWorkspaceStatus(resolveWorkspace(hub)));
    });
});
