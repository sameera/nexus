/**
 * The component-deploy primitive (STORY-60.01). These specs pin the mirror semantics the
 * decision record fixes: the destination is made to match the managed set (create, overwrite,
 * and remove stale Nexus-namespaced files), a second run with no upstream change converges to
 * an identical component set, and user-owned files — the per-repo local settings file and any
 * non-Nexus file — are never touched.
 */

import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { deployComponents } from "./deploy-components";

let tmpDirs: string[] = [];

function makeTmpDir(prefix: string): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmpDirs.push(dir);
    return dir;
}

afterEach(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});

function makePayload(): string {
    const dir: string = makeTmpDir("deploy-payload-");
    fs.mkdirSync(path.join(dir, "commands"), { recursive: true });
    fs.mkdirSync(path.join(dir, "agents"), { recursive: true });
    fs.mkdirSync(path.join(dir, "skills", "nxs-setup"), { recursive: true });
    fs.writeFileSync(path.join(dir, "commands", "nxs.epic.md"), "epic v2\n");
    fs.writeFileSync(path.join(dir, "agents", "nxs-pm.md"), "pm v2\n");
    fs.writeFileSync(path.join(dir, "skills", "nxs-setup", "SKILL.md"), "setup v2\n");
    return dir;
}

/** Walk a tree into { relPath: contentHash } for whole-tree equality assertions. */
function snapshot(root: string): Record<string, string> {
    const out: Record<string, string> = {};
    if (!fs.existsSync(root)) {
        return out;
    }
    const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const abs: string = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(abs);
            } else {
                const rel: string = path.relative(root, abs).split(path.sep).join("/");
                out[rel] = createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
            }
        }
    };
    walk(root);
    return out;
}

describe("deployComponents", () => {
    it("installs the full managed set into a repo with no components", () => {
        const payload: string = makePayload();
        const repo: string = makeTmpDir("deploy-target-");

        const result = deployComponents(payload, repo);

        expect(fs.readFileSync(path.join(repo, ".claude", "commands", "nxs.epic.md"), "utf8")).toBe("epic v2\n");
        expect(fs.readFileSync(path.join(repo, ".claude", "agents", "nxs-pm.md"), "utf8")).toBe("pm v2\n");
        expect(fs.readFileSync(path.join(repo, ".claude", "skills", "nxs-setup", "SKILL.md"), "utf8")).toBe(
            "setup v2\n",
        );
        expect(result.written.sort()).toEqual([
            "agents/nxs-pm.md",
            "commands/nxs.epic.md",
            "skills/nxs-setup/SKILL.md",
        ]);
        expect(result.removed).toEqual([]);
    });

    it("a second run with no upstream change leaves the component set byte-identical", () => {
        const payload: string = makePayload();
        const repo: string = makeTmpDir("deploy-target-");

        deployComponents(payload, repo);
        const first: Record<string, string> = snapshot(path.join(repo, ".claude"));
        deployComponents(payload, repo);
        const second: Record<string, string> = snapshot(path.join(repo, ".claude"));

        expect(second).toEqual(first);
    });

    it("overwrites a hand-edited managed file back to the payload content", () => {
        const payload: string = makePayload();
        const repo: string = makeTmpDir("deploy-target-");
        deployComponents(payload, repo);
        fs.writeFileSync(path.join(repo, ".claude", "commands", "nxs.epic.md"), "local edit\n");

        deployComponents(payload, repo);

        expect(fs.readFileSync(path.join(repo, ".claude", "commands", "nxs.epic.md"), "utf8")).toBe("epic v2\n");
    });

    it("leaves user-owned files untouched: settings.local.json and non-Nexus components", () => {
        const payload: string = makePayload();
        const repo: string = makeTmpDir("deploy-target-");
        const claude: string = path.join(repo, ".claude");
        fs.mkdirSync(path.join(claude, "commands"), { recursive: true });
        fs.writeFileSync(path.join(claude, "settings.local.json"), '{"mine":true}\n');
        fs.writeFileSync(path.join(claude, "commands", "my-command.md"), "user command\n");

        deployComponents(payload, repo);

        expect(fs.readFileSync(path.join(claude, "settings.local.json"), "utf8")).toBe('{"mine":true}\n');
        expect(fs.readFileSync(path.join(claude, "commands", "my-command.md"), "utf8")).toBe("user command\n");
    });

    it("removes Nexus-namespaced files the payload no longer carries (convergence)", () => {
        const payload: string = makePayload();
        const repo: string = makeTmpDir("deploy-target-");
        const claude: string = path.join(repo, ".claude");
        fs.mkdirSync(path.join(claude, "commands"), { recursive: true });
        fs.mkdirSync(path.join(claude, "skills", "nxs-oldskill"), { recursive: true });
        fs.writeFileSync(path.join(claude, "commands", "nxs.obsolete.md"), "gone upstream\n");
        fs.writeFileSync(path.join(claude, "skills", "nxs-oldskill", "SKILL.md"), "gone upstream\n");
        fs.writeFileSync(path.join(claude, "commands", "my-command.md"), "user command\n");

        const result = deployComponents(payload, repo);

        expect(fs.existsSync(path.join(claude, "commands", "nxs.obsolete.md"))).toBe(false);
        expect(fs.existsSync(path.join(claude, "skills", "nxs-oldskill"))).toBe(false);
        expect(fs.existsSync(path.join(claude, "commands", "my-command.md"))).toBe(true);
        expect(result.removed.sort()).toEqual(["commands/nxs.obsolete.md", "skills/nxs-oldskill/SKILL.md"]);
    });

    it("fails with a named error when the payload directory is missing", () => {
        const repo: string = makeTmpDir("deploy-target-");
        expect(() => deployComponents(path.join(repo, "no-such-payload"), repo)).toThrowError(/payload/i);
    });
});
