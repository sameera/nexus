/**
 * `nexus workspace github-defaults` (epic #121, STORY-121.05). The verb is the resolver plus a
 * JSON projection of the hub manifest's optional top-level `github:` block — the seam the Python
 * publishing resolver reads for the `hub` layer of its precedence chain. These specs pin the
 * contract the Python side depends on: a workspace prints the hub defaults as JSON from the hub
 * AND from a member (parity), a workspace with no github block prints `{}`, single-repo prints
 * `{}` (exit 0), and a resolution failure still prints `{}` on stdout (exit 1) so a stdout-only
 * caller degrades to "no defaults" rather than crashing.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runNexusCli, type CliIo } from "./nexus-cli";

let tmpDirs: string[] = [];

function makeParent(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "ws-ghd-"));
    tmpDirs.push(dir);
    return dir;
}

afterEach(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});

/** A declared workspace: hub + one present member, with an optional hub github: block. */
function makeWorkspace(githubBlock: string[] = []): { parent: string; hub: string; member: string } {
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
            ...githubBlock,
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

describe("nexus workspace github-defaults", () => {
    const GITHUB_BLOCK = [
        "github:",
        "  classification: labels",
        "  project: none",
        "  epic-repo: acme/docs-hub",
    ];

    it("prints the hub github defaults as JSON, identically from the hub and from a member", async () => {
        const { hub, member } = makeWorkspace(GITHUB_BLOCK);

        const fromHub: Captured = makeIo(hub);
        const fromMember: Captured = makeIo(member);
        expect(await runNexusCli(["workspace", "github-defaults"], fromHub.io)).toBe(0);
        expect(await runNexusCli(["workspace", "github-defaults"], fromMember.io)).toBe(0);

        const expected = { classification: "labels", project: "none", "epic-repo": "acme/docs-hub" };
        expect(JSON.parse(fromHub.out.join(""))).toEqual(expected);
        // Parity: a member resolves the same hub, so it reads the same defaults.
        expect(fromMember.out.join("")).toBe(fromHub.out.join(""));
    });

    it("prints {} for a workspace whose manifest declares no github block", async () => {
        const { hub } = makeWorkspace();
        const captured: Captured = makeIo(hub);
        expect(await runNexusCli(["workspace", "github-defaults"], captured.io)).toBe(0);
        expect(captured.out.join("")).toBe("{}");
    });

    it("prints {} for single-repo mode (no workspace artifact), exit 0", async () => {
        const solo: string = path.join(makeParent(), "solo-repo");
        fs.mkdirSync(solo, { recursive: true });
        const captured: Captured = makeIo(solo);
        expect(await runNexusCli(["workspace", "github-defaults"], captured.io)).toBe(0);
        expect(captured.out.join("")).toBe("{}");
        expect(captured.err).toEqual([]);
    });

    it("prints {} on stdout and a diagnostic on stderr with exit 1 on a malformed manifest", async () => {
        const hub: string = path.join(makeParent(), "broken-hub");
        fs.mkdirSync(path.join(hub, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(path.join(hub, ".nexus", "config", "workspace.yml"), "hub: [\n");
        const captured: Captured = makeIo(hub);
        expect(await runNexusCli(["workspace", "github-defaults"], captured.io)).toBe(1);
        expect(captured.out.join("")).toBe("{}");
        expect(captured.err.join("\n")).not.toBe("");
    });

    it("names an unexpected extra argument and exits 2", async () => {
        const { hub } = makeWorkspace(GITHUB_BLOCK);
        const captured: Captured = makeIo(hub);
        expect(await runNexusCli(["workspace", "github-defaults", "extra"], captured.io)).toBe(2);
        expect(captured.err.join("\n")).toContain("github-defaults");
    });
});
