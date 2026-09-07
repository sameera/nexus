import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { HubWorkbookError, assertWorkbookHome, resolveWorkbookHome } from "./workbook-placement";
import { createWorkbook, workbookStoreRoot } from "./workbook-store";

let tmpDirs: string[] = [];
function makeParent(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "workbook-placement-"));
    tmpDirs.push(dir);
    return dir;
}
afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs = [];
});

const MANIFEST: string = [
    "hub:",
    "  name: docs-hub",
    "  remote: git@github.com:acme/docs-hub.git",
    "members:",
    "  - name: web-app",
    "    remote: git@github.com:acme/web-app.git",
    "  - name: api",
    "    remote: https://github.com/acme/api.git",
    "",
].join("\n");

const POINTER: string = ["hub:", "  name: docs-hub", "  remote: git@github.com:acme/docs-hub.git", ""].join("\n");

/** A checkout under the shared parent, with the workspace artifact that gives it its role. */
function checkout(parent: string, name: string, file?: { name: string; contents: string }): string {
    const root = path.join(parent, name);
    fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
    if (file !== undefined) fs.writeFileSync(path.join(root, ".nexus", "config", file.name), file.contents);
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: root });
    return root;
}

/** A hub with both declared members checked out beside it. */
function workspace(): { parent: string; hub: string; webApp: string; api: string } {
    const parent = makeParent();
    const hub = checkout(parent, "docs-hub", { name: "workspace.yml", contents: MANIFEST });
    const webApp = checkout(parent, "web-app", { name: "hub.yml", contents: POINTER });
    const api = checkout(parent, "api", { name: "hub.yml", contents: POINTER });
    return { parent, hub, webApp, api };
}

function home(result: ReturnType<typeof resolveWorkbookHome>): { repoRoot: string; repo: string } {
    if (!result.ok) throw new Error(`expected a workbook home, got: ${result.message}`);
    return result.home;
}
function refusal(result: ReturnType<typeof resolveWorkbookHome>): string {
    if (result.ok) throw new Error(`expected a refusal, got a home at ${result.home.repoRoot}`);
    return result.message;
}

describe("in a hub workspace a workbook lives in the member repository whose roadmap it teaches", () => {
    it("puts it in the member the command was run in", () => {
        const { webApp } = workspace();

        expect(home(resolveWorkbookHome(webApp))).toEqual({ repoRoot: webApp, repo: "web-app", mode: "member" });
    });

    it("refuses to guess from the hub, and names the members it could mean", () => {
        const { hub } = workspace();

        const message = refusal(resolveWorkbookHome(hub));

        expect(message).toContain("web-app");
        expect(message).toContain("api");
    });

    it("puts it in the member named from the hub", () => {
        const { hub, api } = workspace();

        expect(home(resolveWorkbookHome(hub, "api"))).toEqual({ repoRoot: api, repo: "api", mode: "member" });
    });

    it("names a member the workspace does not declare rather than making one up", () => {
        const { hub } = workspace();

        expect(refusal(resolveWorkbookHome(hub, "billing"))).toContain("billing");
    });

    it("says where a declared member's workbook would live when that member is not checked out", () => {
        const parent = makeParent();
        const hub = checkout(parent, "docs-hub", { name: "workspace.yml", contents: MANIFEST });

        const message = refusal(resolveWorkbookHome(hub, "api"));

        expect(message).toContain(path.join(parent, "api"));
    });

    it("creates no workbook store in the hub, whatever root a caller passes", () => {
        const { hub } = workspace();

        expect(() => createWorkbook(hub, "rdl")).toThrow(HubWorkbookError);
        expect(fs.existsSync(workbookStoreRoot(hub))).toBe(false);
    });

    it("creates the workbook in a member's checkout", () => {
        const { webApp } = workspace();

        const made = createWorkbook(webApp, "rdl");

        expect(fs.existsSync(made.root)).toBe(true);
        expect(made.root.startsWith(webApp)).toBe(true);
    });
});

describe("a repository that declares no workspace holds its own workbooks", () => {
    it("resolves to the repository itself", () => {
        const parent = makeParent();
        const solo = checkout(parent, "solo");

        expect(home(resolveWorkbookHome(solo)).repoRoot).toBe(solo);
        expect(() => assertWorkbookHome(solo)).not.toThrow();
    });

    it("refuses a member name where there are no members", () => {
        const parent = makeParent();
        const solo = checkout(parent, "solo");

        expect(refusal(resolveWorkbookHome(solo, "web-app"))).toContain("web-app");
    });
});
