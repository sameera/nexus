import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildWorkspaceFixture, initRepo, makeParent, sh } from "./git-fixtures";
import { type PreflightResult, closePreflight } from "./preflight";

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

    it("reports not-a-git-repo outside any checkout", () => {
        const parent = makeParent(tmpDirs);
        const bare = path.join(parent, "not-a-repo");
        fs.mkdirSync(bare, { recursive: true });

        const error = asError(closePreflight(bare));
        expect(error.problem).toBe("not-a-git-repo");
    });

    it("reports single-repo mode when neither workspace artifact is present", () => {
        const parent = makeParent(tmpDirs);
        const repo = path.join(parent, "solo");
        initRepo(repo, "git@github.com:acme/solo.git");
        sh(repo, "git", "commit", "--allow-empty", "-qm", "init");

        const preflight = asOk(closePreflight(repo));
        expect(preflight.role).toBe("single-repo");
        expect(preflight.repo.identity).toBe("github.com/acme/solo");
        expect(preflight).not.toHaveProperty("hub");
    });

    it("reports hub mode from the hub checkout", () => {
        const parent = makeParent(tmpDirs);
        const { hubRoot } = buildWorkspaceFixture(parent);

        const preflight = asOk(closePreflight(hubRoot));
        expect(preflight.role).toBe("hub");
        expect(preflight).not.toHaveProperty("hub");
    });

    it("treats a checkout holding both the manifest and a pointer as the hub", () => {
        const parent = makeParent(tmpDirs);
        const { hubRoot } = buildWorkspaceFixture(parent);
        fs.writeFileSync(
            path.join(hubRoot, ".nexus", "config", "hub.yml"),
            "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\n",
        );

        const preflight = asOk(closePreflight(hubRoot));
        expect(preflight.role).toBe("hub");
    });

    it("reports member mode with the hub's root, name, remote, and branch", () => {
        const parent = makeParent(tmpDirs);
        const { memberRoot } = buildWorkspaceFixture(parent);

        const preflight = asOk(closePreflight(memberRoot));
        expect(preflight.role).toBe("member");
        expect(preflight.repo.identity).toBe("github.com/acme/web-app");
        expect(preflight.hub).toEqual({
            name: "docs-hub",
            normalizedRemote: "github.com/acme/docs-hub",
            root: path.join(parent, "docs-hub"),
            branch: "main",
        });
    });

    it("passes through missing-hub-checkout when the hub sibling was renamed away", () => {
        const parent = makeParent(tmpDirs);
        const { hubRoot, memberRoot } = buildWorkspaceFixture(parent);
        fs.renameSync(hubRoot, `${hubRoot}-away`);

        const error = asError(closePreflight(memberRoot));
        expect(error.problem).toBe("missing-hub-checkout");
    });

    it("passes through undeclared-member when this checkout is not in the hub manifest", () => {
        const parent = makeParent(tmpDirs);
        buildWorkspaceFixture(parent);
        const worker = path.join(parent, "worker");
        initRepo(worker);
        fs.mkdirSync(path.join(worker, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(
            path.join(worker, ".nexus", "config", "hub.yml"),
            "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\n",
        );
        sh(worker, "git", "commit", "--allow-empty", "-qm", "init");

        const error = asError(closePreflight(worker));
        expect(error.problem).toBe("undeclared-member");
    });

    it("reports a detached hub HEAD as the branch, not a failure", () => {
        const parent = makeParent(tmpDirs);
        const { hubRoot, memberRoot } = buildWorkspaceFixture(parent);
        sh(hubRoot, "git", "checkout", "--detach", "-q");

        const preflight = asOk(closePreflight(memberRoot));
        expect(preflight.role).toBe("member");
        expect(preflight.hub?.branch).toBe("(detached HEAD)");
    });
});
