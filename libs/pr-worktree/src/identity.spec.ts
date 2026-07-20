import * as fs from "node:fs";
import * as path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { resolveRole } from "./identity.js";
import { defaultRunner } from "./run.js";
import { initRepo, makeParent, writeCommit } from "./git-fixtures.js";

const tracked: string[] = [];
afterAll(() => {
    for (const d of tracked) fs.rmSync(d, { recursive: true, force: true });
});

function repoWithConfig(parent: string, name: string, config?: { file: string; body: string }): string {
    const repo = path.join(parent, name);
    initRepo(repo, "git@github.com:acme/thing.git");
    if (config) {
        const full = path.join(repo, ".nexus", "config", config.file);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, config.body);
    }
    writeCommit(repo, "base.txt", "base\n", "init");
    return repo;
}

describe("resolveRole", () => {
    it("allows single-repo and reports the normalized identity", () => {
        const repo = repoWithConfig(makeParent(tracked), "solo");
        const r = resolveRole(repo, defaultRunner);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.resolved.role).toBe("single-repo");
        expect(r.resolved.repoIdentity).toContain("acme/thing");
    });

    it("allows a hub", () => {
        const repo = repoWithConfig(makeParent(tracked), "hub", {
            file: "workspace.yml",
            body: "hub:\n  name: hub\n  remote: git@github.com:acme/hub.git\nmembers: []\n",
        });
        const r = resolveRole(repo, defaultRunner);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.resolved.role).toBe("hub");
    });

    it("rejects a member repo", () => {
        const repo = repoWithConfig(makeParent(tracked), "member", {
            file: "hub.yml",
            body: "hub:\n  name: hub\n  remote: git@github.com:acme/hub.git\n",
        });
        const r = resolveRole(repo, defaultRunner);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("member-unsupported");
    });
});
