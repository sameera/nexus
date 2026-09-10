import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type PreflightResult, closePreflight } from "./close-role";

function sh(cwd: string, cmd: string, ...args: string[]): string {
    const r = spawnSync(cmd, args, { cwd, encoding: "utf8" });
    if (r.status !== 0) {
        throw new Error(`${cmd} ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
    }
    return r.stdout.replace(/\n$/, "");
}

function initRepo(dir: string, origin?: string): void {
    fs.mkdirSync(dir, { recursive: true });
    sh(dir, "git", "init", "-q", "-b", "main");
    sh(dir, "git", "config", "user.email", "spec@example.com");
    sh(dir, "git", "config", "user.name", "spec");
    if (origin) {
        sh(dir, "git", "remote", "add", "origin", origin);
    }
}

function asOk(result: PreflightResult) {
    expect(result.ok).toBe(true);
    if (!result.ok) {
        throw new Error(`expected ok result, got error: ${result.error.message}`);
    }
    return result.preflight;
}

function asError(result: PreflightResult) {
    expect(result.ok).toBe(false);
    if (result.ok) {
        throw new Error("expected an error result, got ok");
    }
    return result.error;
}

describe("closePreflight", () => {
    let tmpDirs: string[] = [];

    afterEach(() => {
        for (const dir of tmpDirs) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
        tmpDirs = [];
    });

    function makeParent(): string {
        const parent = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-close-role-"));
        tmpDirs.push(parent);
        return parent;
    }

    it("reports not-a-git-repo outside any checkout", () => {
        const parent = makeParent();
        const bare = path.join(parent, "not-a-repo");
        fs.mkdirSync(bare, { recursive: true });

        const error = asError(closePreflight(bare));
        expect(error.problem).toBe("not-a-git-repo");
    });

    it("reports single-repo mode when neither workspace artifact is present", () => {
        const parent = makeParent();
        const repo = path.join(parent, "solo");
        initRepo(repo, "git@github.com:acme/solo.git");
        sh(repo, "git", "commit", "--allow-empty", "-qm", "init");

        const preflight = asOk(closePreflight(repo));
        expect(preflight.role).toBe("single-repo");
        expect(preflight.repo.identity).toBe("github.com/acme/solo");
    });

    it("reports hub mode from a checkout carrying the workspace manifest", () => {
        const parent = makeParent();
        const hubRoot = path.join(parent, "docs-hub");
        initRepo(hubRoot, "git@github.com:acme/docs-hub.git");
        fs.mkdirSync(path.join(hubRoot, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(path.join(hubRoot, ".nexus", "config", "workspace.yml"), "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\n");
        sh(hubRoot, "git", "commit", "--allow-empty", "-qm", "init");

        const preflight = asOk(closePreflight(hubRoot));
        expect(preflight.role).toBe("hub");
    });

    it("treats a checkout holding both the manifest and a pointer as the hub", () => {
        const parent = makeParent();
        const hubRoot = path.join(parent, "docs-hub");
        initRepo(hubRoot, "git@github.com:acme/docs-hub.git");
        fs.mkdirSync(path.join(hubRoot, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(path.join(hubRoot, ".nexus", "config", "workspace.yml"), "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\n");
        fs.writeFileSync(path.join(hubRoot, ".nexus", "config", "hub.yml"), "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\n");
        sh(hubRoot, "git", "commit", "--allow-empty", "-qm", "init");

        const preflight = asOk(closePreflight(hubRoot));
        expect(preflight.role).toBe("hub");
    });

    it("reports member mode from a checkout carrying only a hub pointer, with no hub-location detail (epic #215)", () => {
        const parent = makeParent();
        const memberRoot = path.join(parent, "web-app");
        initRepo(memberRoot, "git@github.com:acme/web-app.git");
        fs.mkdirSync(path.join(memberRoot, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(path.join(memberRoot, ".nexus", "config", "hub.yml"), "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\n");
        sh(memberRoot, "git", "commit", "--allow-empty", "-qm", "init");

        const preflight = asOk(closePreflight(memberRoot));
        expect(preflight.role).toBe("member");
        expect(preflight.repo.identity).toBe("github.com/acme/web-app");
        expect(preflight).not.toHaveProperty("hub");
    });
});
