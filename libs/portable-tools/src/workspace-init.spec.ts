/**
 * `nexus workspace init` (STORY-60.02). Pins the epic's declaration contract: discovered
 * siblings are LISTED and the human designates hub and members (never proposed), nothing is
 * written before the designation is confirmed, a collision (via the resolver's remote-identity
 * rule) writes nothing, an existing declaration is reported and left unchanged absent explicit
 * confirmation, and a completed init yields resolver parity — the identical workspace
 * description from the hub and from every member — plus components in every declared repo.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveWorkspace } from "@nexus/workspace/resolve";
import { discoverSiblings, runWorkspaceInit } from "./workspace-init";

let tmpDirs: string[] = [];

function makeParent(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "ws-init-"));
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

/** Whole-tree file listing for before/after "nothing was written" assertions. */
function listTree(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const abs: string = path.join(dir, entry.name);
            out.push(path.relative(root, abs));
            if (entry.isDirectory()) {
                walk(abs);
            }
        }
    };
    walk(root);
    return out.sort();
}

interface Session {
    out: string[];
    err: string[];
    deployed: string[];
    run: (cwd: string, answers: string[]) => Promise<number>;
}

function makeSession(): Session {
    const out: string[] = [];
    const err: string[] = [];
    const deployed: string[] = [];
    return {
        out,
        err,
        deployed,
        run: (cwd: string, answers: string[]): Promise<number> => {
            const queue: string[] = [...answers];
            return runWorkspaceInit(
                {
                    cwd,
                    stdout: (line: string): void => {
                        out.push(line);
                    },
                    stderr: (line: string): void => {
                        err.push(line);
                    },
                    ask: (question: string): Promise<string> => {
                        out.push(question);
                        return Promise.resolve(queue.shift() ?? "");
                    },
                },
                {
                    deploy: (repoRoot: string): void => {
                        deployed.push(repoRoot);
                    },
                },
            );
        },
    };
}

describe("discoverSiblings", () => {
    it("lists every git checkout under the shared parent, including the invoking one", () => {
        const parent: string = makeParent();
        makeRepo(parent, "docs-hub", "git@github.com:acme/docs-hub.git");
        makeRepo(parent, "web-app", "git@github.com:acme/web-app.git");
        fs.mkdirSync(path.join(parent, "not-a-repo"));

        const found = discoverSiblings(path.join(parent, "docs-hub"));

        expect(found.map((c) => c.name)).toEqual(["docs-hub", "web-app"]);
        expect(found[0].remote).toBe("git@github.com:acme/docs-hub.git");
    });

    it("reports an existing manifest or pointer on a candidate", () => {
        const parent: string = makeParent();
        const hub: string = makeRepo(parent, "docs-hub", "git@github.com:acme/docs-hub.git");
        makeRepo(parent, "web-app", "git@github.com:acme/web-app.git");
        fs.mkdirSync(path.join(hub, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(path.join(hub, ".nexus", "config", "workspace.yml"), "hub:\n  name: docs-hub\n  remote: r\n");

        const found = discoverSiblings(hub);

        expect(found.find((c) => c.name === "docs-hub")?.hasManifest).toBe(true);
        expect(found.find((c) => c.name === "web-app")?.hasManifest).toBe(false);
    });
});

describe("runWorkspaceInit — declaration", () => {
    it("lists the discovered siblings, and a confirmed designation writes a parity-clean workspace with components everywhere", async () => {
        const parent: string = makeParent();
        const hub: string = makeRepo(parent, "docs-hub", "git@github.com:acme/docs-hub.git");
        const web: string = makeRepo(parent, "web-app", "git@github.com:acme/web-app.git");
        const api: string = makeRepo(parent, "api", "https://github.com/acme/api.git");
        const session: Session = makeSession();

        // Sorted candidate order: api(1), docs-hub(2), web-app(3).
        const code: number = await session.run(hub, ["2", "1,3", "y"]);

        expect(code).toBe(0);
        // The sibling list was presented before designation.
        const listing: string = session.out.join("\n");
        expect(listing).toContain("docs-hub");
        expect(listing).toContain("web-app");
        expect(listing).toContain("api");

        // Resolver parity: hub and every member resolve to the identical description.
        const fromHub = resolveWorkspace(hub);
        const fromWeb = resolveWorkspace(web);
        const fromApi = resolveWorkspace(api);
        expect(fromHub.ok && fromWeb.ok && fromApi.ok).toBe(true);
        expect(fromWeb).toEqual(fromHub);
        expect(fromApi).toEqual(fromHub);
        if (fromHub.ok && fromHub.workspace.mode === "workspace") {
            expect(fromHub.workspace.hub.name).toBe("docs-hub");
            expect(fromHub.workspace.members.map((m) => m.name).sort()).toEqual(["api", "web-app"]);
            expect(fromHub.workspace.members.every((m) => m.checkout === "present")).toBe(true);
        }

        // Components were deployed into every declared repo via the shared primitive.
        expect(session.deployed.sort()).toEqual([api, hub, web].sort());
    });

    it("writes nothing when the final confirmation is declined", async () => {
        const parent: string = makeParent();
        const hub: string = makeRepo(parent, "docs-hub", "git@github.com:acme/docs-hub.git");
        makeRepo(parent, "web-app", "git@github.com:acme/web-app.git");
        const before: string[] = listTree(parent);
        const session: Session = makeSession();

        const code: number = await session.run(hub, ["1", "2", "n"]);

        expect(code).toBe(1);
        expect(listTree(parent)).toEqual(before);
        expect(session.deployed).toEqual([]);
    });

    it("reports a member/hub remote collision through the resolver's rule and writes nothing", async () => {
        const parent: string = makeParent();
        // Same remote in two spellings: the normalized identity rule must catch it.
        const hub: string = makeRepo(parent, "docs-hub", "git@github.com:acme/docs-hub.git");
        makeRepo(parent, "docs-mirror", "https://github.com/acme/docs-hub");
        const before: string[] = listTree(parent);
        const session: Session = makeSession();

        const code: number = await session.run(hub, ["1", "2", "y"]);

        expect(code).toBe(1);
        expect(session.err.join("\n")).toContain("github.com/acme/docs-hub");
        expect(listTree(parent)).toEqual(before);
        expect(session.deployed).toEqual([]);
    });

    it("reports an existing declaration and changes nothing without explicit confirmation", async () => {
        const parent: string = makeParent();
        const hub: string = makeRepo(parent, "docs-hub", "git@github.com:acme/docs-hub.git");
        makeRepo(parent, "web-app", "git@github.com:acme/web-app.git");
        fs.mkdirSync(path.join(hub, ".nexus", "config"), { recursive: true });
        const manifest: string = "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\n";
        fs.writeFileSync(path.join(hub, ".nexus", "config", "workspace.yml"), manifest);
        const before: string[] = listTree(parent);
        const session: Session = makeSession();

        // First answer: decline the overwrite prompt.
        const code: number = await session.run(hub, [""]);

        expect(code).toBe(1);
        expect(session.out.join("\n") + session.err.join("\n")).toContain("docs-hub");
        expect(listTree(parent)).toEqual(before);
        expect(fs.readFileSync(path.join(hub, ".nexus", "config", "workspace.yml"), "utf8")).toBe(manifest);
    });

    it("rejects a designated repo with no remote and writes nothing", async () => {
        const parent: string = makeParent();
        const hub: string = makeRepo(parent, "docs-hub", "git@github.com:acme/docs-hub.git");
        makeRepo(parent, "web-app"); // no origin remote
        const before: string[] = listTree(parent);
        const session: Session = makeSession();

        const code: number = await session.run(hub, ["1", "2", "y"]);

        expect(code).toBe(1);
        expect(session.err.join("\n")).toContain("web-app");
        expect(listTree(parent)).toEqual(before);
    });

    it("fails when fewer than two sibling checkouts exist", async () => {
        const parent: string = makeParent();
        const hub: string = makeRepo(parent, "docs-hub", "git@github.com:acme/docs-hub.git");
        const session: Session = makeSession();

        const code: number = await session.run(hub, []);

        expect(code).toBe(1);
        expect(session.err.join("\n")).toContain("sibling");
    });
});
