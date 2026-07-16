/**
 * `nexus workspace add-repo` (STORY-60.04). Pins the epic's headline metric: adding one member
 * mutates EXACTLY two files — the hub manifest (one appended entry, every existing entry
 * preserved verbatim) and the new member's pointer — and no file in any other repo changes.
 * Collisions are rejected through the resolver's rule with zero changes, and success is
 * observable through the status verb showing the new member present.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runNexusCli, type CliIo } from "./nexus-cli";
import { runWorkspaceAddRepo } from "./workspace-add-repo";

let tmpDirs: string[] = [];

function makeParent(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "ws-add-"));
    tmpDirs.push(dir);
    return dir;
}

afterEach(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});

function git(cwd: string, ...args: string[]): void {
    execFileSync("git", args, { cwd, stdio: "ignore" });
}

function makeRepo(parent: string, name: string, remote?: string): string {
    const dir: string = path.join(parent, name);
    fs.mkdirSync(dir, { recursive: true });
    git(dir, "init", "-q");
    if (remote !== undefined) {
        git(dir, "remote", "add", "origin", remote);
    }
    return dir;
}

const MANIFEST: string = `# hand-tuned — every line below must survive an add-repo verbatim
hub:
  name: docs-hub
  remote: git@github.com:acme/docs-hub.git
members:
  - name: web-app
    remote: git@github.com:acme/web-app.git # first member
`;

/** An existing declared workspace: hub (manifest) + one member (pointer), plus git dirs. */
function makeDeclaredWorkspace(): { parent: string; hub: string; web: string } {
    const parent: string = makeParent();
    const hub: string = makeRepo(parent, "docs-hub", "git@github.com:acme/docs-hub.git");
    const web: string = makeRepo(parent, "web-app", "git@github.com:acme/web-app.git");
    fs.mkdirSync(path.join(hub, ".nexus", "config"), { recursive: true });
    fs.mkdirSync(path.join(web, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(path.join(hub, ".nexus", "config", "workspace.yml"), MANIFEST);
    fs.writeFileSync(
        path.join(web, ".nexus", "config", "hub.yml"),
        "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\n",
    );
    return { parent, hub, web };
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

/** Full-tree snapshot: relative path → content hash (files) or "dir". */
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

describe("nexus workspace add-repo", () => {
    it("mutates exactly two files: one appended manifest entry (existing lines verbatim) and the new pointer", () => {
        const { parent, hub } = makeDeclaredWorkspace();
        const api: string = makeRepo(parent, "api", "https://github.com/acme/api.git");
        const before: Record<string, string> = snapshot(parent);
        const captured: Captured = makeIo(api);

        const code: number = runWorkspaceAddRepo(captured.io);

        expect(code, captured.err.join("\n")).toBe(0);
        const after: Record<string, string> = snapshot(parent);

        // The one changed file: the hub manifest.
        const changed: string[] = Object.keys(before).filter((k) => after[k] !== before[k]);
        expect(changed).toEqual([path.join("docs-hub", ".nexus", "config", "workspace.yml")]);
        // The additions: the new member's pointer (plus its parent dirs).
        const added: string[] = Object.keys(after).filter((k) => !(k in before));
        expect(added.filter((k) => !k.endsWith("/"))).toEqual([path.join("api", ".nexus", "config", "hub.yml")]);
        expect(added.every((k) => k.startsWith("api" + path.sep))).toBe(true);

        // Every pre-existing manifest line survives byte-for-byte; exactly one entry gained.
        const manifest: string = fs.readFileSync(path.join(hub, ".nexus", "config", "workspace.yml"), "utf8");
        for (const line of MANIFEST.trimEnd().split("\n")) {
            expect(manifest).toContain(line);
        }
        expect(manifest).toContain("api");
    });

    it("the new member appears as checked-out and present in workspace status afterward", async () => {
        const { parent, hub } = makeDeclaredWorkspace();
        const api: string = makeRepo(parent, "api", "https://github.com/acme/api.git");

        expect(runWorkspaceAddRepo(makeIo(api).io)).toBe(0);

        const status: Captured = makeIo(hub);
        expect(await runNexusCli(["workspace", "status"], status.io)).toBe(0);
        expect(status.out.join("\n")).toContain("[present] api");
    });

    it("rejects a remote collision (different spelling) through the resolver's rule and changes nothing", () => {
        const { parent } = makeDeclaredWorkspace();
        // Same remote as the declared web-app member, in the HTTPS spelling.
        const collider: string = makeRepo(parent, "web-clone", "https://github.com/acme/web-app");
        const before: Record<string, string> = snapshot(parent);
        const captured: Captured = makeIo(collider);

        const code: number = runWorkspaceAddRepo(captured.io);

        expect(code).toBe(1);
        expect(captured.err.join("\n")).toContain("github.com/acme/web-app");
        expect(snapshot(parent)).toEqual(before);
    });

    it("rejects a name collision with a declared-but-missing member and changes nothing", () => {
        const parent: string = makeParent();
        const hub: string = makeRepo(parent, "docs-hub", "git@github.com:acme/docs-hub.git");
        fs.mkdirSync(path.join(hub, ".nexus", "config"), { recursive: true });
        // 'api' is declared but not checked out; a new checkout reuses the name with another remote.
        fs.writeFileSync(
            path.join(hub, ".nexus", "config", "workspace.yml"),
            "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\nmembers:\n  - name: api\n    remote: git@github.com:acme/api.git\n",
        );
        const collider: string = makeRepo(parent, "api", "git@github.com:acme/api-fork.git");
        const before: Record<string, string> = snapshot(parent);
        const captured: Captured = makeIo(collider);

        const code: number = runWorkspaceAddRepo(captured.io);

        expect(code).toBe(1);
        expect(captured.err.join("\n")).toContain("api");
        expect(snapshot(parent)).toEqual(before);
    });

    it("fails with a named error when no sibling carries a manifest, writing nothing", () => {
        const parent: string = makeParent();
        makeRepo(parent, "lonely-hub", "git@github.com:acme/lonely.git"); // no manifest
        const api: string = makeRepo(parent, "api", "https://github.com/acme/api.git");
        const before: Record<string, string> = snapshot(parent);
        const captured: Captured = makeIo(api);

        const code: number = runWorkspaceAddRepo(captured.io);

        expect(code).toBe(1);
        expect(captured.err.join("\n")).toContain("manifest");
        expect(snapshot(parent)).toEqual(before);
    });

    it("reports an already-declared invoking checkout and changes nothing", () => {
        const { parent, web } = makeDeclaredWorkspace();
        const before: Record<string, string> = snapshot(parent);
        const captured: Captured = makeIo(web);

        const code: number = runWorkspaceAddRepo(captured.io);

        expect(code).toBe(1);
        expect(captured.err.join("\n")).toContain("already");
        expect(snapshot(parent)).toEqual(before);
    });

    it("fails when the invoking checkout has no origin remote, writing nothing", () => {
        const { parent } = makeDeclaredWorkspace();
        const api: string = makeRepo(parent, "api"); // no remote
        const before: Record<string, string> = snapshot(parent);
        const captured: Captured = makeIo(api);

        const code: number = runWorkspaceAddRepo(captured.io);

        expect(code).toBe(1);
        expect(captured.err.join("\n")).toContain("remote");
        expect(snapshot(parent)).toEqual(before);
    });
});
