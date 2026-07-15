/**
 * Test-support fixtures: real temp git repos arranged as a workspace.
 *
 * buildWorkspaceFixture creates the sibling pair the resolver expects:
 *   <parent>/docs-hub   — hub: committed workspace.yml declaring web-app; git repo on branch main
 *   <parent>/web-app    — member: committed hub.yml + a queue entry with two committed files
 *                          (epic.md, decision-record.md) and two UNTRACKED files
 *                          (close-record.md, analyze-receipt.md); origin remote set.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export function sh(cwd: string, cmd: string, ...args: string[]): string {
    const r = spawnSync(cmd, args, { cwd, encoding: "utf8" });
    if (r.status !== 0) {
        throw new Error(`${cmd} ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
    }
    return r.stdout.replace(/\n$/, "");
}

export function initRepo(dir: string, origin?: string): void {
    fs.mkdirSync(dir, { recursive: true });
    sh(dir, "git", "init", "-q", "-b", "main");
    sh(dir, "git", "config", "user.email", "spec@example.com");
    sh(dir, "git", "config", "user.name", "spec");
    if (origin) {
        sh(dir, "git", "remote", "add", "origin", origin);
    }
}

export function commitAll(dir: string, msg: string): string {
    sh(dir, "git", "add", "-A");
    sh(dir, "git", "commit", "-qm", msg);
    return sh(dir, "git", "rev-parse", "HEAD");
}

export interface WorkspaceFixture {
    parent: string;
    hubRoot: string;
    memberRoot: string;
    entryName: string;
    entryDir: string;
}

export function makeParent(tracked: string[]): string {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-close-mig-"));
    tracked.push(parent);
    return parent;
}

export function buildWorkspaceFixture(parent: string): WorkspaceFixture {
    const hubRoot = path.join(parent, "docs-hub");
    initRepo(hubRoot);
    fs.mkdirSync(path.join(hubRoot, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(
        path.join(hubRoot, ".nexus", "config", "workspace.yml"),
        "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\n" +
            "members:\n  - name: web-app\n    remote: git@github.com:acme/web-app.git\n",
    );
    commitAll(hubRoot, "init hub");

    const memberRoot = path.join(parent, "web-app");
    initRepo(memberRoot, "git@github.com:acme/web-app.git");
    fs.mkdirSync(path.join(memberRoot, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(
        path.join(memberRoot, ".nexus", "config", "hub.yml"),
        "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\n",
    );
    const entryName = "demo-epic-ab12cd34";
    const entryDir = path.join(memberRoot, ".nexus", "queue", entryName);
    fs.mkdirSync(entryDir, { recursive: true });
    fs.writeFileSync(path.join(entryDir, "epic.md"), "# epic\n");
    fs.writeFileSync(path.join(entryDir, "decision-record.md"), "# dr\n");
    commitAll(memberRoot, "plan epic");
    // Written at close time; deliberately UNTRACKED (constraint 6: migration carries the
    // full working-tree entry).
    fs.writeFileSync(path.join(entryDir, "close-record.md"), "# close\n");
    fs.writeFileSync(path.join(entryDir, "analyze-receipt.md"), "# receipt\n");
    return { parent, hubRoot, memberRoot, entryName, entryDir };
}
