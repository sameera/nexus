/**
 * The docs-root read-out (STORY-81.01). One resolved value — the repo-relative docs root — emitted
 * through both vehicles: the `nexus workspace docs-root` verb (in-process, and from the bundled
 * artifact) and the in-repo `docs_root.ts` tsx script. These specs pin the value per role (`.` for a
 * hub, `docs` for single-repo/member, the override when set), that a resolution failure exits 1 with
 * the resolver's diagnostic (never a silent "docs"), read-only-ness, and byte-parity between the two
 * vehicles (decision-record Invariant 8).
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildBundle } from "./bundle";
import { runNexusCli, type CliIo } from "./nexus-cli";

const REPO_ROOT: string = path.resolve(__dirname, "../../..");
const TSX_BIN: string = path.join(REPO_ROOT, "node_modules", ".bin", "tsx");
const SCRIPT: string = path.join(
    REPO_ROOT,
    ".claude",
    "skills",
    "nxs-workspace-status",
    "scripts",
    "docs_root.ts",
);

let tmpDirs: string[] = [];

function makeParent(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "docs-root-"));
    tmpDirs.push(dir);
    return dir;
}

afterEach(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});

/** Write a hub checkout with an optional docs-root override; returns its path. */
function writeHub(parent: string, override?: string): string {
    const hub: string = path.join(parent, "docs-hub");
    fs.mkdirSync(path.join(hub, ".nexus", "config"), { recursive: true });
    const lines: string[] = [
        "hub:",
        "  name: docs-hub",
        "  remote: git@github.com:acme/docs-hub.git",
        ...(override ? [`  docs-root: ${override}`] : []),
        "members: []",
        "",
    ];
    fs.writeFileSync(path.join(hub, ".nexus", "config", "workspace.yml"), lines.join("\n"));
    return hub;
}

/**
 * Write a full workspace — a hub that DECLARES the member plus the member's own checkout, both under
 * `parent` — and return the member path. A member whose hub is not checked out resolves to a hard
 * FAILURE, not "docs"; the member docs-root case only exists inside a resolvable workspace (mirrors
 * workspace-status.spec.ts's makeWorkspace).
 */
function writeMember(parent: string): string {
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
            "",
        ].join("\n"),
    );
    fs.writeFileSync(
        path.join(member, ".nexus", "config", "hub.yml"),
        "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\n",
    );
    return member;
}

/** A single-repo checkout: a bare dir with neither manifest nor pointer. */
function writeSolo(parent: string): string {
    const solo: string = path.join(parent, "solo");
    fs.mkdirSync(solo, { recursive: true });
    return solo;
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

interface CliResult {
    status: number;
    stdout: string;
    stderr: string;
}

/** Run the in-repo tsx script with cwd pointed at a checkout. */
function runScript(cwd: string): CliResult {
    try {
        const stdout = execFileSync(TSX_BIN, [SCRIPT], { cwd, encoding: "utf8" });
        return { status: 0, stdout, stderr: "" };
    } catch (error) {
        const err = error as { status: number; stdout: string; stderr: string };
        return { status: err.status, stdout: err.stdout, stderr: err.stderr };
    }
}

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

describe("nexus workspace docs-root (verb)", () => {
    it("prints '.' for a hub with no override, exit 0", async () => {
        const captured = makeIo(writeHub(makeParent()));
        expect(await runNexusCli(["workspace", "docs-root"], captured.io)).toBe(0);
        expect(captured.out.join("\n")).toBe(".");
        expect(captured.err).toEqual([]);
    });

    it("prints the override for a hub with an explicit docs-root", async () => {
        const captured = makeIo(writeHub(makeParent(), "docs"));
        expect(await runNexusCli(["workspace", "docs-root"], captured.io)).toBe(0);
        expect(captured.out.join("\n")).toBe("docs");
    });

    it("prints 'docs' for a member checkout", async () => {
        const captured = makeIo(writeMember(makeParent()));
        expect(await runNexusCli(["workspace", "docs-root"], captured.io)).toBe(0);
        expect(captured.out.join("\n")).toBe("docs");
    });

    it("prints 'docs' for a single-repo checkout (unchanged)", async () => {
        const captured = makeIo(writeSolo(makeParent()));
        expect(await runNexusCli(["workspace", "docs-root"], captured.io)).toBe(0);
        expect(captured.out.join("\n")).toBe("docs");
    });

    it("exits 1 with the resolver's diagnostic on a malformed manifest — never a silent 'docs'", async () => {
        const hub: string = path.join(makeParent(), "broken-hub");
        fs.mkdirSync(path.join(hub, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(path.join(hub, ".nexus", "config", "workspace.yml"), "hub: [\n");
        const captured = makeIo(hub);
        expect(await runNexusCli(["workspace", "docs-root"], captured.io)).toBe(1);
        expect(captured.err.join("\n")).toContain("Workspace resolution failed");
        expect(captured.out).toEqual([]);
    });

    it("rejects an unexpected argument, exit 2", async () => {
        const captured = makeIo(writeSolo(makeParent()));
        expect(await runNexusCli(["workspace", "docs-root", "extra"], captured.io)).toBe(2);
    });

    it("mutates nothing (read-only)", async () => {
        const parent = makeParent();
        writeHub(parent);
        const before = snapshot(parent);
        await runNexusCli(["workspace", "docs-root"], makeIo(path.join(parent, "docs-hub")).io);
        expect(snapshot(parent)).toEqual(before);
    });

    it("runs on plain node from the bundled artifact with identical output (bare runtime)", async () => {
        const hub = writeHub(makeParent());
        const toolsDir = makeParent();
        const { code } = await buildBundle(path.join(__dirname, "nexus-cli.ts"));
        const bundlePath = path.join(toolsDir, "nexus.mjs");
        fs.writeFileSync(bundlePath, code);
        const stdout = execFileSync(process.execPath, [bundlePath, "workspace", "docs-root"], {
            cwd: hub,
            encoding: "utf8",
        });
        expect(stdout.trimEnd()).toBe(".");
    });
});

describe("docs_root.ts (in-repo script) — parity with the verb", () => {
    it("prints '.' for a hub with no override, exit 0", () => {
        const result = runScript(writeHub(makeParent()));
        expect(result.status).toBe(0);
        expect(result.stdout.trimEnd()).toBe(".");
    });

    it("prints 'docs' for a single-repo checkout (unchanged)", () => {
        const result = runScript(writeSolo(makeParent()));
        expect(result.status).toBe(0);
        expect(result.stdout.trimEnd()).toBe("docs");
    });

    it("prints 'docs' for a member checkout", () => {
        const result = runScript(writeMember(makeParent()));
        expect(result.status).toBe(0);
        expect(result.stdout.trimEnd()).toBe("docs");
    });

    it("exits 1 on a malformed manifest, diagnostic on stderr", () => {
        const hub: string = path.join(makeParent(), "broken-hub");
        fs.mkdirSync(path.join(hub, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(path.join(hub, ".nexus", "config", "workspace.yml"), "hub: [\n");
        const result = runScript(hub);
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("Workspace resolution failed");
    });
});
